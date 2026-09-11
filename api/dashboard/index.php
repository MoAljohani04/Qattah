<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { error('Method not allowed', 405); }
$auth = requireAuth();
$uid  = $auth['id'];
$db   = Database::getInstance()->getConnection();

// ── Total spent this month ────────────────────────────────────
$stmt = $db->prepare(
    "SELECT COALESCE(SUM(b.amount),0) AS total
     FROM bills b WHERE b.paid_by = ?
     AND MONTH(b.bill_date) = MONTH(CURDATE()) AND YEAR(b.bill_date) = YEAR(CURDATE())"
);
$stmt->execute([$uid]);
$totalSpent = (float)$stmt->fetchColumn();

// ── Amount others owe me (unsettled, I paid) ─────────────────
$stmt = $db->prepare(
    "SELECT COALESCE(SUM(bp.amount_owed),0) AS owed
     FROM bill_participants bp
     JOIN bills b ON b.id = bp.bill_id
     WHERE b.paid_by = ? AND bp.user_id != ? AND bp.is_settled = 0"
);
$stmt->execute([$uid, $uid]);
$oweMe = (float)$stmt->fetchColumn();

// ── Amount I owe others (unsettled, others paid) ─────────────
$stmt = $db->prepare(
    "SELECT COALESCE(SUM(bp.amount_owed),0) AS owed
     FROM bill_participants bp
     JOIN bills b ON b.id = bp.bill_id
     WHERE bp.user_id = ? AND b.paid_by != ? AND bp.is_settled = 0"
);
$stmt->execute([$uid, $uid]);
$iOwe = (float)$stmt->fetchColumn();

// ── Bills count ───────────────────────────────────────────────
$stmt = $db->prepare(
    "SELECT COUNT(*) FROM bills b
     LEFT JOIN bill_participants bp ON bp.bill_id = b.id AND bp.user_id = ?
     WHERE b.paid_by = ? OR bp.user_id = ?"
);
$stmt->execute([$uid, $uid, $uid]);
$billCount = (int)$stmt->fetchColumn();

// ── Groups count ─────────────────────────────────────────────
$stmt = $db->prepare("SELECT COUNT(*) FROM group_members WHERE user_id = ?");
$stmt->execute([$uid]);
$groupCount = (int)$stmt->fetchColumn();

// ── Recent bills (last 10) ────────────────────────────────────
$stmt = $db->prepare(
    "SELECT b.id, b.title, b.amount, b.bill_date, b.split_type,
            c.icon AS cat_icon, c.color AS cat_color, c.name_en AS cat_name,
            u.name AS paid_by_name,
            bp.amount_owed, bp.is_settled,
            CASE WHEN b.paid_by = :uid THEN 'paid' ELSE 'owe' END AS relation
     FROM bills b
     LEFT JOIN categories c ON c.id = b.category_id
     LEFT JOIN users u ON u.id = b.paid_by
     LEFT JOIN bill_participants bp ON bp.bill_id = b.id AND bp.user_id = :uid2
     WHERE b.paid_by = :uid3 OR bp.user_id = :uid4
     ORDER BY b.created_at DESC
     LIMIT 10"
);
$stmt->execute([':uid' => $uid, ':uid2' => $uid, ':uid3' => $uid, ':uid4' => $uid]);
$recentBills = $stmt->fetchAll();

// ── Who owes me (detail) ─────────────────────────────────────
$stmt = $db->prepare(
    "SELECT u.id, u.name, u.avatar,
            SUM(bp.amount_owed) AS amount
     FROM bill_participants bp
     JOIN bills b  ON b.id  = bp.bill_id
     JOIN users u  ON u.id  = bp.user_id
     WHERE b.paid_by = ? AND bp.user_id != ? AND bp.is_settled = 0
     GROUP BY u.id, u.name, u.avatar
     ORDER BY amount DESC LIMIT 5"
);
$stmt->execute([$uid, $uid]);
$oweMeList = $stmt->fetchAll();

// ── Who I owe (detail) ───────────────────────────────────────
$stmt = $db->prepare(
    "SELECT u.id, u.name, u.avatar,
            SUM(bp.amount_owed) AS amount
     FROM bill_participants bp
     JOIN bills b  ON b.id  = bp.bill_id
     JOIN users u  ON u.id  = b.paid_by
     WHERE bp.user_id = ? AND b.paid_by != ? AND bp.is_settled = 0
     GROUP BY u.id, u.name, u.avatar
     ORDER BY amount DESC LIMIT 5"
);
$stmt->execute([$uid, $uid]);
$iOweList = $stmt->fetchAll();

success([
    'stats'       => [
        'total_spent' => $totalSpent,
        'owe_me'      => $oweMe,
        'i_owe'       => $iOwe,
        'net'         => round($oweMe - $iOwe, 2),
        'bill_count'  => $billCount,
        'group_count' => $groupCount,
    ],
    'recent_bills' => $recentBills,
    'owe_me_list'  => $oweMeList,
    'i_owe_list'   => $iOweList,
]);
