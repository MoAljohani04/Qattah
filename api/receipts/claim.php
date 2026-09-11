<?php
/**
 * POST /api/receipts/claim.php
 *   body: { token, claims: [ {item_id, quantity}, ... ] }
 *
 * Upserts the current user's per-item quantities for a shared receipt.
 * quantity 0 removes the claim.
 *   • normal items — quantities are capped at what remains available so
 *     two people can't claim the same unit twice.
 *   • shared items — quantity is just an in/out flag (clamped to 0 or 1);
 *     the line is split evenly between everyone who's in.
 * Returns the recomputed per-item state and this user's total.
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
$claims = $body['claims'] ?? [];
if ($token === '')        { error('Missing receipt token'); }
if (!is_array($claims))   { error('Invalid claims'); }

$db = Database::getInstance()->getConnection();

$rStmt = $db->prepare("SELECT id, status FROM receipts WHERE share_token = ?");
$rStmt->execute([$token]);
$receipt = $rStmt->fetch();
if (!$receipt)                       { error('Receipt not found', 404); }
if ($receipt['status'] === 'closed') { error('This receipt is closed'); }
$receiptId = (int)$receipt['id'];

// Index requested quantities by item id.
$wanted = [];
foreach ($claims as $c) {
    $itemId = (int)($c['item_id'] ?? 0);
    $qty    = max(0, (int)($c['quantity'] ?? 0));
    if ($itemId > 0) { $wanted[$itemId] = $qty; }
}

$db->beginTransaction();
try {
    // Lock the receipt's items so the available-quantity check is consistent.
    $items = $db->prepare(
        "SELECT id, quantity, is_shared FROM receipt_items WHERE receipt_id = ? FOR UPDATE"
    );
    $items->execute([$receiptId]);

    $upsert = $db->prepare(
        "INSERT INTO receipt_claims (receipt_id, item_id, user_id, quantity)
         VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)"
    );
    $del = $db->prepare("DELETE FROM receipt_claims WHERE item_id = ? AND user_id = ?");

    foreach ($items->fetchAll() as $item) {
        $itemId = (int)$item['id'];
        if (!array_key_exists($itemId, $wanted)) { continue; }
        $qty = $wanted[$itemId];

        if ((int)$item['is_shared'] === 1) {
            // Shared line: in or out, no per-unit scarcity.
            $qty = $qty > 0 ? 1 : 0;
        } else {
            // How many units are taken by OTHER users?
            $others = $db->prepare(
                "SELECT COALESCE(SUM(quantity),0) FROM receipt_claims
                 WHERE item_id = ? AND user_id <> ?"
            );
            $others->execute([$itemId, $uid]);
            $available = (int)$item['quantity'] - (int)$others->fetchColumn();
            if ($qty > $available) { $qty = max(0, $available); }
        }

        if ($qty === 0) { $del->execute([$itemId, $uid]); }
        else            { $upsert->execute([$receiptId, $itemId, $uid, $qty]); }
    }

    $db->commit();
} catch (Exception $e) {
    $db->rollBack();
    error('Failed to save selection', 500);
}

// Return fresh state (mirrors show.php item shape).
$out = receiptItemsFor($db, $receiptId, $uid);
success(['items' => $out, 'my_total' => receiptTotalFor($out)], 'Selection saved');
