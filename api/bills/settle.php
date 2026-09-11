<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { error('Method not allowed', 405); }

$auth   = requireAuth();
$uid    = $auth['id'];
$db     = Database::getInstance()->getConnection();
$body   = getBody();
$billId = (int)($body['bill_id'] ?? 0);

if (!$billId) { error('Bill ID required'); }

$stmt = $db->prepare(
    "SELECT bp.*, b.paid_by, b.title, b.amount FROM bill_participants bp
     JOIN bills b ON b.id = bp.bill_id
     WHERE bp.bill_id = ? AND bp.user_id = ?"
);
$stmt->execute([$billId, $uid]);
$row = $stmt->fetch();
if (!$row) { error('Participant record not found', 404); }
if ($row['is_settled']) { error('Already settled'); }

$db->prepare(
    "UPDATE bill_participants SET is_settled = 1, settled_at = NOW()
     WHERE bill_id = ? AND user_id = ?"
)->execute([$billId, $uid]);

// Record payment
$db->prepare(
    "INSERT INTO payments (from_user, to_user, bill_id, amount, note)
     VALUES (?, ?, ?, ?, ?)"
)->execute([$uid, $row['paid_by'], $billId, $row['amount_owed'],
    "Settled: {$row['title']}"]);

// Notify payer
notify($db, (int)$row['paid_by'], 'payment_received',
    'Payment Received',
    "{$auth['name']} paid SAR " . number_format($row['amount_owed'], 2) . " for \"{$row['title']}\"",
    $billId, 'bill');

success(null, 'Marked as settled');
