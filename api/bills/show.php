<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$auth   = requireAuth();
$uid    = $auth['id'];
$db     = Database::getInstance()->getConnection();
$billId = (int)($_GET['id'] ?? 0);
if (!$billId) { error('Bill ID required'); }

// ── GET: single bill with participants ────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare(
        "SELECT b.*, c.icon AS cat_icon, c.color AS cat_color, c.name_en AS cat_name,
                u.name AS paid_by_name, g.name AS group_name
         FROM bills b
         LEFT JOIN categories c ON c.id = b.category_id
         LEFT JOIN users u      ON u.id = b.paid_by
         LEFT JOIN groups g     ON g.id = b.group_id
         WHERE b.id = ?"
    );
    $stmt->execute([$billId]);
    $bill = $stmt->fetch();
    if (!$bill) { error('Bill not found', 404); }

    // Check access: paid_by OR participant
    $pStmt = $db->prepare(
        "SELECT * FROM bill_participants WHERE bill_id = ? AND user_id = ?"
    );
    $pStmt->execute([$billId, $uid]);
    $myShare = $pStmt->fetch();
    if ($bill['paid_by'] != $uid && !$myShare) { error('Access denied', 403); }

    // All participants
    $pStmt = $db->prepare(
        "SELECT bp.*, u.name, u.avatar FROM bill_participants bp
         JOIN users u ON u.id = bp.user_id WHERE bp.bill_id = ?"
    );
    $pStmt->execute([$billId]);
    $bill['participants'] = $pStmt->fetchAll();

    success($bill);
}

// ── PUT: update bill ──────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $stmt = $db->prepare("SELECT paid_by FROM bills WHERE id = ?");
    $stmt->execute([$billId]);
    $bill = $stmt->fetch();
    if (!$bill) { error('Bill not found', 404); }
    if ($bill['paid_by'] != $uid) { error('Only the payer can edit this bill', 403); }

    $body = getBody();
    $fields = []; $params = [];
    $allowed = ['title','description','amount','category_id','group_id','split_type','bill_date','notes'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "{$f} = ?";
            $params[] = in_array($f, ['title','description','notes']) ? clean((string)$body[$f]) : $body[$f];
        }
    }
    if (empty($fields)) { error('No fields to update'); }
    $params[] = $billId;
    $db->prepare("UPDATE bills SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    success(null, 'Bill updated');
}

// ── DELETE: remove bill ───────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $stmt = $db->prepare("SELECT paid_by FROM bills WHERE id = ?");
    $stmt->execute([$billId]);
    $bill = $stmt->fetch();
    if (!$bill) { error('Bill not found', 404); }
    if ($bill['paid_by'] != $uid) { error('Only the payer can delete this bill', 403); }
    $db->prepare("DELETE FROM bills WHERE id = ?")->execute([$billId]);
    success(null, 'Bill deleted');
}

error('Method not allowed', 405);
