<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { error('Method not allowed', 405); }
$auth = requireAuth();
$uid  = $auth['id'];
$db   = Database::getInstance()->getConnection();
$year = (int)($_GET['year'] ?? date('Y'));

// ── Monthly spending (last 6 months) ─────────────────────────
$stmt = $db->prepare(
    "SELECT DATE_FORMAT(b.bill_date,'%Y-%m') AS month,
            SUM(b.amount) AS total
     FROM bills b
     WHERE b.paid_by = ? AND b.bill_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
     GROUP BY month ORDER BY month ASC"
);
$stmt->execute([$uid]);
$monthly = $stmt->fetchAll();

// ── Spending by category (this year) ─────────────────────────
$stmt = $db->prepare(
    "SELECT c.name_en, c.name_ar, c.icon, c.color,
            SUM(b.amount) AS total
     FROM bills b
     JOIN categories c ON c.id = b.category_id
     WHERE b.paid_by = ? AND YEAR(b.bill_date) = ?
     GROUP BY c.id ORDER BY total DESC"
);
$stmt->execute([$uid, $year]);
$byCategory = $stmt->fetchAll();

// ── Total this year ───────────────────────────────────────────
$stmt = $db->prepare(
    "SELECT COALESCE(SUM(amount),0) FROM bills WHERE paid_by = ? AND YEAR(bill_date) = ?"
);
$stmt->execute([$uid, $year]);
$yearTotal = (float)$stmt->fetchColumn();

// ── Bills count per month ─────────────────────────────────────
$stmt = $db->prepare(
    "SELECT DATE_FORMAT(bill_date,'%Y-%m') AS month, COUNT(*) AS cnt
     FROM bills WHERE paid_by = ? AND YEAR(bill_date) = ?
     GROUP BY month ORDER BY month"
);
$stmt->execute([$uid, $year]);
$billsPerMonth = $stmt->fetchAll();

// ── Top 5 biggest bills ───────────────────────────────────────
$stmt = $db->prepare(
    "SELECT b.title, b.amount, b.bill_date, c.icon, c.color
     FROM bills b LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.paid_by = ? AND YEAR(b.bill_date) = ?
     ORDER BY b.amount DESC LIMIT 5"
);
$stmt->execute([$uid, $year]);
$topBills = $stmt->fetchAll();

success([
    'monthly'        => $monthly,
    'by_category'    => $byCategory,
    'year_total'     => $yearTotal,
    'bills_per_month'=> $billsPerMonth,
    'top_bills'      => $topBills,
    'year'           => $year,
]);
