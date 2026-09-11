<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$auth    = requireAuth();
$uid     = $auth['id'];
$db      = Database::getInstance()->getConnection();
$groupId = (int)($_GET['id'] ?? 0);
if (!$groupId) { error('Group ID required'); }

// Verify membership
$mStmt = $db->prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?");
$mStmt->execute([$groupId, $uid]);
$member = $mStmt->fetch();
if (!$member) { error('Access denied', 403); }

// ── GET ───────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare("SELECT * FROM groups WHERE id = ?");
    $stmt->execute([$groupId]);
    $group = $stmt->fetch();
    if (!$group) { error('Group not found', 404); }

    // Members
    $mStmt2 = $db->prepare(
        "SELECT gm.role, gm.joined_at, u.id, u.name, u.email, u.avatar
         FROM group_members gm JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?"
    );
    $mStmt2->execute([$groupId]);
    $group['members'] = $mStmt2->fetchAll();

    // Recent bills
    $bStmt = $db->prepare(
        "SELECT b.id, b.title, b.amount, b.bill_date,
                c.icon AS cat_icon, c.color AS cat_color,
                u.name AS paid_by_name,
                bp.amount_owed, bp.is_settled
         FROM bills b
         LEFT JOIN categories c ON c.id = b.category_id
         LEFT JOIN users u ON u.id = b.paid_by
         LEFT JOIN bill_participants bp ON bp.bill_id = b.id AND bp.user_id = ?
         WHERE b.group_id = ?
         ORDER BY b.bill_date DESC LIMIT 20"
    );
    $bStmt->execute([$uid, $groupId]);
    $group['bills'] = $bStmt->fetchAll();

    // Scanned receipts filed under this group
    $rStmt = $db->prepare(
        "SELECT r.id, r.share_token, r.restaurant_name, r.receipt_date,
                r.total_amount, r.currency, r.status, r.created_at,
                u.name AS creator_name,
                (SELECT COUNT(DISTINCT user_id) FROM receipt_claims  WHERE receipt_id = r.id) AS participant_count,
                (SELECT COUNT(*)               FROM receipt_payments WHERE receipt_id = r.id) AS paid_count
         FROM receipts r
         JOIN users u ON u.id = r.created_by
         WHERE r.group_id = ?
         ORDER BY r.created_at DESC LIMIT 20"
    );
    $rStmt->execute([$groupId]);
    $group['receipts'] = $rStmt->fetchAll();

    $group['my_role'] = $member['role'];
    success($group);
}

// ── PUT: update group ─────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    if ($member['role'] !== 'admin') { error('Only admins can edit the group', 403); }
    $body = getBody();
    $fields = []; $params = [];
    if (!empty($body['name']))        { $fields[] = 'name = ?';        $params[] = clean($body['name']); }
    if (isset($body['description']))  { $fields[] = 'description = ?'; $params[] = clean($body['description']); }
    if (empty($fields)) { error('Nothing to update'); }
    $params[] = $groupId;
    $db->prepare("UPDATE groups SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    success(null, 'Group updated');
}

// ── DELETE: delete group ──────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if ($member['role'] !== 'admin') { error('Only admins can delete the group', 403); }
    $db->prepare("DELETE FROM groups WHERE id = ?")->execute([$groupId]);
    success(null, 'Group deleted');
}

error('Method not allowed', 405);
