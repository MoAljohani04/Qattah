<?php
/**
 * POST /api/receipts/pay.php
 *   body: { token, method? }
 *
 * Mock payment. Recomputes the user's total from their saved claims
 * (never trusts a client-sent amount) and records a paid row. Real
 * gateway integration (Apple Pay / Mada / Visa / STC Pay) plugs in here.
 */
require_once '../config/database.php';
require_once '../config/response.php';
require_once '_items.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { error('Method not allowed', 405); }
$auth = requireAuth();
$uid  = $auth['id'];

$body   = getBody();
$token  = trim($body['token'] ?? '');
$method = trim($body['method'] ?? 'mock');
if ($token === '') { error('Missing receipt token'); }

$db = Database::getInstance()->getConnection();

$rStmt = $db->prepare("SELECT id, currency FROM receipts WHERE share_token = ?");
$rStmt->execute([$token]);
$receipt = $rStmt->fetch();
if (!$receipt) { error('Receipt not found', 404); }
$receiptId = (int)$receipt['id'];

// Server-side total from this user's claims — the same maths the order
// screen shows, so a shared line is split rather than charged whole.
$amount = receiptTotalFor(receiptItemsFor($db, $receiptId, $uid));

if ($amount <= 0) { error('Select at least one item before paying'); }

$stmt = $db->prepare(
    "INSERT INTO receipt_payments (receipt_id, user_id, amount, method)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE amount = VALUES(amount), method = VALUES(method), paid_at = CURRENT_TIMESTAMP"
);
$stmt->execute([$receiptId, $uid, $amount, $method]);

success([
    'amount'   => $amount,
    'currency' => $receipt['currency'],
    'method'   => $method,
], 'Payment confirmed');
