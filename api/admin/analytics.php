<?php
/**
 * GET /api/admin/analytics.php   (owner only)
 * Chart datasets: receipts created / payments collected (last 6 months),
 * and the most-shared receipts.
 */
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { error('Method not allowed', 405); }
$db = Database::getInstance()->getConnection();
requireOwner($db);

// Build the last 6 month buckets (YYYY-MM) ending this month.
$months = [];
for ($i = 5; $i >= 0; $i--) {
    $months[date('Y-m', strtotime("first day of -$i month"))] = ['label' => date('M', strtotime("first day of -$i month"))];
}

// Receipts created per month
$rc = $db->query(
    "SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS n
     FROM receipts
     WHERE created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 5 MONTH)
     GROUP BY ym"
)->fetchAll(PDO::FETCH_KEY_PAIR);

// Payments collected per month
$pc = $db->query(
    "SELECT DATE_FORMAT(paid_at, '%Y-%m') AS ym, COALESCE(SUM(amount),0) AS total
     FROM receipt_payments
     WHERE paid_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 5 MONTH)
     GROUP BY ym"
)->fetchAll(PDO::FETCH_KEY_PAIR);

$labels         = [];
$receiptsSeries = [];
$paymentsSeries = [];
foreach ($months as $ym => $meta) {
    $labels[]         = $meta['label'];
    $receiptsSeries[] = (int)($rc[$ym] ?? 0);
    $paymentsSeries[] = round((float)($pc[$ym] ?? 0), 2);
}

// Most shared receipts (top 5 by distinct participants)
$top = $db->query(
    "SELECT r.restaurant_name,
            (SELECT COUNT(DISTINCT user_id) FROM receipt_claims WHERE receipt_id = r.id) AS participants
     FROM receipts r
     ORDER BY participants DESC, r.created_at DESC
     LIMIT 5"
)->fetchAll();

success([
    'labels'           => $labels,
    'receipts_created' => $receiptsSeries,
    'payments_collected' => $paymentsSeries,
    'most_shared'      => $top,
]);
