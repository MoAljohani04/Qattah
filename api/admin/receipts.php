<?php
/**
 * /api/admin/receipts.php   (owner only)
 *   GET                      → all receipts with creator + counts
 *   PUT    ?id=X  {status}   → close/reopen a receipt
 *   DELETE ?id=X             → delete a receipt (cascades items/claims/payments)
 */
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$db = Database::getInstance()->getConnection();
requireOwner($db);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $db->query(
        "SELECT r.id, r.share_token, r.restaurant_name, r.receipt_date, r.total_amount,
                r.currency, r.status, r.created_at, u.name AS creator_name,
                (SELECT COUNT(DISTINCT user_id) FROM receipt_claims  WHERE receipt_id = r.id) AS participant_count,
                (SELECT COUNT(*)               FROM receipt_payments WHERE receipt_id = r.id) AS paid_count,
                (SELECT COALESCE(SUM(amount),0) FROM receipt_payments WHERE receipt_id = r.id) AS collected
         FROM receipts r
         JOIN users u ON u.id = r.created_by
         ORDER BY r.created_at DESC"
    )->fetchAll();
    success(['receipts' => $rows]);
}

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) { error('Missing receipt id'); }

if ($method === 'PUT') {
    $body   = getBody();
    $status = $body['status'] ?? '';
    if (!in_array($status, ['open', 'closed'], true)) { error('Invalid status'); }
    $stmt = $db->prepare("UPDATE receipts SET status = ? WHERE id = ?");
    $stmt->execute([$status, $id]);
    success(['id' => $id, 'status' => $status], 'Receipt updated');
}

if ($method === 'DELETE') {
    $db->prepare("DELETE FROM receipts WHERE id = ?")->execute([$id]);
    success(['id' => $id], 'Receipt deleted');
}

error('Method not allowed', 405);
