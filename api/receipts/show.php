<?php
/**
 * GET /api/receipts/show.php?token=ABC123
 *
 * Public-readable: anyone with the link can see the restaurant, items
 * and totals. `authenticated` tells the client whether to show the
 * sign-in gate or the order-selection screen. When logged in, each
 * item also carries `my_quantity` (this user's current claim) and
 * `my_share` (what that claim costs — see _items.php for shared lines).
 */
require_once '../config/database.php';
require_once '../config/response.php';
require_once '_items.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { error('Method not allowed', 405); }

$token = trim($_GET['token'] ?? '');
if ($token === '') { error('Missing receipt token'); }

$db   = Database::getInstance()->getConnection();
$me   = currentUser();           // null when not logged in
$uid  = $me['id'] ?? 0;

$stmt = $db->prepare(
    "SELECT r.id, r.share_token, r.restaurant_name, r.receipt_date, r.total_amount,
            r.currency, r.receipt_image, r.status, r.group_id,
            u.name AS creator_name, g.name AS group_name
     FROM receipts r
     JOIN users u ON u.id = r.created_by
     LEFT JOIN `groups` g ON g.id = r.group_id
     WHERE r.share_token = ?"
);
$stmt->execute([$token]);
$receipt = $stmt->fetch();
if (!$receipt) { error('Receipt not found', 404); }

$receiptId = (int)$receipt['id'];
$items     = receiptItemsFor($db, $receiptId, $uid);

$hasPaid = false;
if ($uid) {
    $pStmt = $db->prepare("SELECT 1 FROM receipt_payments WHERE receipt_id = ? AND user_id = ?");
    $pStmt->execute([$receiptId, $uid]);
    $hasPaid = (bool)$pStmt->fetch();
}

success([
    'authenticated' => $me !== null,
    'receipt'       => [
        'token'           => $receipt['share_token'],
        'restaurant_name' => $receipt['restaurant_name'],
        'receipt_date'    => $receipt['receipt_date'],
        'total_amount'    => (float)$receipt['total_amount'],
        'currency'        => $receipt['currency'],
        'receipt_image'   => $receipt['receipt_image'],
        'status'          => $receipt['status'],
        'creator_name'    => $receipt['creator_name'],
        'group_id'        => $receipt['group_id'] ? (int)$receipt['group_id'] : null,
        'group_name'      => $receipt['group_name'],
    ],
    'items'          => $items,
    'my_total'       => receiptTotalFor($items),
    'has_paid'       => $hasPaid,
]);
