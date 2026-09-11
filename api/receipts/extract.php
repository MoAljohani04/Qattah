<?php
/**
 * POST /api/receipts/extract.php   (multipart: field "receipt")
 *
 * Saves the uploaded receipt image and extracts restaurant name, date,
 * total, and line items using the configured AI provider (api/config/ai.php).
 * Falls back to editable placeholder rows if no key is set or a call fails.
 * The response shape is identical either way.
 */
require_once '../config/database.php';
require_once '../config/response.php';
require_once '../config/ai.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { error('Method not allowed', 405); }
requireAuth();

$imagePath = null;   // web path stored on the receipt
$diskPath  = null;   // absolute path for reading bytes
$mimeType  = null;

// Image is optional — user may skip the photo and enter items by hand.
if (!empty($_FILES['receipt']) && $_FILES['receipt']['error'] === UPLOAD_ERR_OK) {
    $file = $_FILES['receipt'];

    if ($file['size'] > 5 * 1024 * 1024) { error('File too large (max 5MB)'); }

    $allowed  = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $finfo    = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mimeType, $allowed)) { error('Only JPEG, PNG, GIF and WebP images are allowed'); }

    $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) ?: 'jpg';
    $safeName = bin2hex(random_bytes(16)) . '.' . $ext;
    $dir      = __DIR__ . '/../../uploads/receipts/';
    if (!is_dir($dir)) { mkdir($dir, 0755, true); }

    $diskPath = $dir . $safeName;
    if (!move_uploaded_file($file['tmp_name'], $diskPath)) {
        error('Failed to save file', 500);
    }
    $imagePath = 'uploads/receipts/' . $safeName;
}

// ── Try the configured AI provider when a key is set and we have an image ──
if ($imagePath !== null && aiEnabled()) {
    try {
        $db    = Database::getInstance()->getConnection();
        $model = aiActiveModel($db);
        $ai = aiProvider() === 'google'
            ? extractWithGemini($diskPath, $mimeType, $model)
            : extractWithClaude($diskPath, $mimeType, $model);
        $ai['receipt_image'] = $imagePath;
        $ai['ai_used']       = true;
        success($ai, 'Receipt processed with AI');
    } catch (Throwable $e) {
        $aiError = $e->getMessage();   // fall through to manual rows
    }
}

// ── Fallback: editable placeholder rows (manual entry) ──────────────
success([
    'restaurant_name' => '',
    'receipt_date'    => date('Y-m-d'),
    'total_amount'    => 0,
    'receipt_image'   => $imagePath,
    'items' => [
        ['name' => 'Item 1', 'unit_price' => 0, 'quantity' => 1, 'is_shared' => false],
        ['name' => 'Item 2', 'unit_price' => 0, 'quantity' => 1, 'is_shared' => false],
        ['name' => 'Item 3', 'unit_price' => 0, 'quantity' => 1, 'is_shared' => false],
    ],
    'ai_used'  => false,
    'ai_error' => $aiError ?? null,
], 'Receipt processed');


// ── Prompt shared by all providers ──────────────────────────────────
function extractInstruction(): string {
    return
        "You are reading a restaurant/store receipt from the image. Extract ONLY:\n" .
        "- restaurant_name: the venue/store name\n" .
        "- receipt_date: the purchase date as YYYY-MM-DD (empty string if not visible)\n" .
        "- total_amount: the grand total as a number\n" .
        "- items: each ordered line item with its name, PER-UNIT price (unit_price), quantity,\n" .
        "  and is_shared — true only when the line is plainly meant for the table rather than\n" .
        "  one person (mezze/appetiser platters, a large pizza, a shisha, a jug/pitcher, a side\n" .
        "  to share, 'family size'). A single drink, sandwich or main course is is_shared=false.\n" .
        "  When in doubt, use false — the user can tick the box themselves.\n" .
        "If a line shows a quantity and a line total (e.g. '2 Burger 40.00'), set quantity=2 and unit_price=20.00.\n" .
        "IGNORE taxes, service charges, tips, payment method, card numbers, receipt/order IDs, barcodes, and store messages.\n" .
        "Use the same currency numbers shown on the receipt. If something is unreadable, use an empty string or 0.\n" .
        "Respond with ONLY a JSON object: {\"restaurant_name\":string,\"receipt_date\":string,\"total_amount\":number," .
        "\"items\":[{\"name\":string,\"unit_price\":number,\"quantity\":integer,\"is_shared\":boolean}]}.";
}

/** Normalize raw model JSON into the shape the front-end expects. */
function normalizeReceipt(array $data): array {
    $date = trim((string)($data['receipt_date'] ?? ''));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) { $date = date('Y-m-d'); }

    $items = [];
    foreach ($data['items'] ?? [] as $it) {
        $name = trim((string)($it['name'] ?? ''));
        if ($name === '') { continue; }
        $items[] = [
            'name'       => $name,
            'unit_price' => round((float)($it['unit_price'] ?? 0), 2),
            'quantity'   => max(1, (int)($it['quantity'] ?? 1)),
            'is_shared'  => !empty($it['is_shared']),
        ];
    }
    if (empty($items)) { $items[] = ['name' => '', 'unit_price' => 0, 'quantity' => 1, 'is_shared' => false]; }

    return [
        'restaurant_name' => trim((string)($data['restaurant_name'] ?? '')),
        'receipt_date'    => $date,
        'total_amount'    => round((float)($data['total_amount'] ?? 0), 2),
        'items'           => $items,
    ];
}

/** Pull the first JSON object out of a text blob (handles ```json fences). */
function decodeJsonLoose(string $text): array {
    $text = trim($text);
    $text = preg_replace('/^```(?:json)?|```$/m', '', $text); // strip code fences
    $data = json_decode(trim($text), true);
    if (is_array($data)) { return $data; }
    if (preg_match('/\{.*\}/s', $text, $m)) {                  // last resort: first {...}
        $data = json_decode($m[0], true);
        if (is_array($data)) { return $data; }
    }
    throw new RuntimeException('Could not parse AI output as JSON');
}

// ── Google Gemini (generativelanguage API) ──────────────────────────
function extractWithGemini(string $diskPath, string $mimeType, string $model): array {
    $bytes = @file_get_contents($diskPath);
    if ($bytes === false) { throw new RuntimeException('Could not read uploaded image'); }

    $schema = [
        'type' => 'OBJECT',
        'properties' => [
            'restaurant_name' => ['type' => 'STRING'],
            'receipt_date'    => ['type' => 'STRING'],
            'total_amount'    => ['type' => 'NUMBER'],
            'items' => ['type' => 'ARRAY', 'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'name'       => ['type' => 'STRING'],
                    'unit_price' => ['type' => 'NUMBER'],
                    'quantity'   => ['type' => 'INTEGER'],
                    'is_shared'  => ['type' => 'BOOLEAN'],
                ],
                'required' => ['name', 'unit_price', 'quantity', 'is_shared'],
            ]],
        ],
        'required' => ['restaurant_name', 'receipt_date', 'total_amount', 'items'],
    ];

    $payload = [
        'contents' => [[
            'parts' => [
                ['inline_data' => ['mime_type' => $mimeType, 'data' => base64_encode($bytes)]],
                ['text' => extractInstruction()],
            ],
        ]],
        'generationConfig' => [
            'temperature'      => 0,
            'responseMimeType' => 'application/json',
            'responseSchema'   => $schema,
        ],
    ];

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
         . rawurlencode($model) . ':generateContent';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . trim(GOOGLE_API_KEY),
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);
    if ($ca = caBundle()) { curl_setopt($ch, CURLOPT_CAINFO, $ca); }
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_error($ch);
    curl_close($ch);

    if ($raw === false) { throw new RuntimeException('Network error contacting Gemini: ' . $cerr); }
    if ($code !== 200)  { throw new RuntimeException("Gemini API returned HTTP {$code}: " . substr($raw, 0, 300)); }

    $resp = json_decode($raw, true);
    $text = '';
    foreach ($resp['candidates'][0]['content']['parts'] ?? [] as $p) {
        if (isset($p['text'])) { $text .= $p['text']; }
    }
    if ($text === '') { throw new RuntimeException('Empty response from Gemini'); }

    return normalizeReceipt(decodeJsonLoose($text));
}

// ── Anthropic Claude (Messages API) ─────────────────────────────────
function extractWithClaude(string $diskPath, string $mimeType, string $model): array {
    $bytes = @file_get_contents($diskPath);
    if ($bytes === false) { throw new RuntimeException('Could not read uploaded image'); }

    $schema = [
        'type' => 'object',
        'properties' => [
            'restaurant_name' => ['type' => 'string'],
            'receipt_date'    => ['type' => 'string'],
            'total_amount'    => ['type' => 'number'],
            'items' => ['type' => 'array', 'items' => [
                'type' => 'object',
                'properties' => [
                    'name'       => ['type' => 'string'],
                    'unit_price' => ['type' => 'number'],
                    'quantity'   => ['type' => 'integer'],
                    'is_shared'  => ['type' => 'boolean'],
                ],
                'required' => ['name', 'unit_price', 'quantity', 'is_shared'],
                'additionalProperties' => false,
            ]],
        ],
        'required' => ['restaurant_name', 'receipt_date', 'total_amount', 'items'],
        'additionalProperties' => false,
    ];

    $payload = [
        'model'      => $model,
        'max_tokens' => 2000,
        'output_config' => ['format' => ['type' => 'json_schema', 'schema' => $schema]],
        'messages' => [[
            'role' => 'user',
            'content' => [
                ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mimeType, 'data' => base64_encode($bytes)]],
                ['type' => 'text', 'text' => extractInstruction()],
            ],
        ]],
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_HTTPHEADER     => [
            'content-type: application/json',
            'x-api-key: ' . trim(ANTHROPIC_API_KEY),
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);
    if ($ca = caBundle()) { curl_setopt($ch, CURLOPT_CAINFO, $ca); }
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_error($ch);
    curl_close($ch);

    if ($raw === false) { throw new RuntimeException('Network error contacting Claude: ' . $cerr); }
    if ($code !== 200)  { throw new RuntimeException("Claude API returned HTTP {$code}: " . substr($raw, 0, 300)); }

    $resp = json_decode($raw, true);
    $text = '';
    foreach ($resp['content'] ?? [] as $block) {
        if (($block['type'] ?? '') === 'text') { $text = $block['text']; break; }
    }
    if ($text === '') { throw new RuntimeException('Empty response from Claude'); }

    return normalizeReceipt(decodeJsonLoose($text));
}
