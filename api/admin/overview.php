<?php
/**
 * GET /api/admin/overview.php   (owner only)
 * Aggregate counters for the dashboard overview cards.
 */
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { error('Method not allowed', 405); }
$db = Database::getInstance()->getConnection();
requireOwner($db);

$one = fn(string $sql) => (float)$db->query($sql)->fetchColumn();

$totalReceipts  = $one("SELECT COUNT(*) FROM receipts");
$activeReceipts = $one("SELECT COUNT(*) FROM receipts WHERE status = 'open'");
$totalUsers     = $one("SELECT COUNT(*) FROM users");
$completed      = $one("SELECT COUNT(*) FROM receipt_payments");
$collected      = $one("SELECT COALESCE(SUM(amount),0) FROM receipt_payments");

// Pending = (receipt,user) pairs that have claimed items but haven't paid.
$pending = $one(
    "SELECT COUNT(*) FROM (
        SELECT c.receipt_id, c.user_id
        FROM receipt_claims c
        WHERE c.quantity > 0
        GROUP BY c.receipt_id, c.user_id
     ) claimed
     LEFT JOIN receipt_payments p
        ON p.receipt_id = claimed.receipt_id AND p.user_id = claimed.user_id
     WHERE p.id IS NULL"
);

success([
    'total_receipts'     => (int)$totalReceipts,
    'active_receipts'    => (int)$activeReceipts,
    'total_users'        => (int)$totalUsers,
    'total_transactions' => (int)$completed,
    'pending_payments'   => (int)$pending,
    'completed_payments' => (int)$completed,
    'total_collected'    => round($collected, 2),
]);
