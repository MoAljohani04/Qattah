<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$auth = requireAuth();
$uid  = $auth['id'];
$db   = Database::getInstance()->getConnection();

// ── GET: list bills for current user ─────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $search   = trim($_GET['q']        ?? '');
    $catId    = (int)($_GET['category'] ?? 0);
    $groupId  = (int)($_GET['group']    ?? 0);
    $page     = max(1, (int)($_GET['page'] ?? 1));
    $perPage  = 20;
    $offset   = ($page - 1) * $perPage;

    $where  = ["(b.paid_by = :uid OR bp2.user_id = :uid2)"];
    $params = [':uid' => $uid, ':uid2' => $uid];

    if ($search) {
        $where[]  = "b.title LIKE :q";
        $params[':q'] = "%{$search}%";
    }
    if ($catId)   { $where[] = "b.category_id = :cat";   $params[':cat']   = $catId; }
    if ($groupId) { $where[] = "b.group_id    = :grp";   $params[':grp']   = $groupId; }

    $whereSQL = implode(' AND ', $where);

    $stmt = $db->prepare(
        "SELECT b.id, b.title, b.amount, b.currency, b.bill_date, b.split_type, b.receipt_image,
                c.icon AS cat_icon, c.color AS cat_color, c.name_en AS cat_name,
                u.name AS paid_by_name, u.id AS paid_by_id,
                g.name AS group_name,
                bp.amount_owed, bp.is_settled
         FROM bills b
         LEFT JOIN categories c ON c.id = b.category_id
         LEFT JOIN users u      ON u.id = b.paid_by
         LEFT JOIN groups g     ON g.id = b.group_id
         LEFT JOIN bill_participants bp  ON bp.bill_id = b.id AND bp.user_id  = :uid3
         LEFT JOIN bill_participants bp2 ON bp2.bill_id = b.id AND bp2.user_id = :uid4
         WHERE {$whereSQL}
         GROUP BY b.id
         ORDER BY b.bill_date DESC, b.created_at DESC
         LIMIT {$perPage} OFFSET {$offset}"
    );
    $params[':uid3'] = $uid;
    $params[':uid4'] = $uid;
    $stmt->execute($params);
    $bills = $stmt->fetchAll();

    // total count
    // NOTE: the bp2 join must NOT re-filter on :uid2 — that placeholder is
    // already used by $whereSQL, and reusing a named param throws HY093 when
    // PDO emulation is off. The WHERE clause handles the user match.
    $cntStmt = $db->prepare(
        "SELECT COUNT(DISTINCT b.id) FROM bills b
         LEFT JOIN bill_participants bp2 ON bp2.bill_id = b.id
         WHERE {$whereSQL}"
    );
    $cntParams = $params;
    unset($cntParams[':uid3'], $cntParams[':uid4']);
    $cntStmt->execute($cntParams);
    $total = (int)$cntStmt->fetchColumn();

    success(['bills' => $bills, 'total' => $total, 'page' => $page, 'per_page' => $perPage]);
}

// ── POST: create a new bill ───────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body         = getBody();
    $title        = trim($body['title']        ?? '');
    $amount       = (float)($body['amount']    ?? 0);
    $billDate     = trim($body['bill_date']    ?? date('Y-m-d'));
    $categoryId   = !empty($body['category_id'])  ? (int)$body['category_id']  : null;
    $groupId      = !empty($body['group_id'])      ? (int)$body['group_id']      : null;
    $splitType    = $body['split_type']  ?? 'equal';
    $notes        = trim($body['notes']        ?? '');
    $participants = $body['participants'] ?? [];   // [{user_id, amount_owed}]
    $receiptImage = trim($body['receipt_image'] ?? '');

    if (empty($title))                       { error('Bill title is required'); }
    if ($amount <= 0)                        { error('Amount must be greater than 0'); }
    if (empty($participants))                { error('At least one participant is required'); }
    if (!in_array($splitType, ['equal','custom','percentage'])) { error('Invalid split type'); }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $billDate)) { error('Invalid date format'); }

    // Equal split recalculation
    if ($splitType === 'equal') {
        $share = round($amount / count($participants), 2);
        foreach ($participants as &$p) { $p['amount_owed'] = $share; }
        unset($p);
    }

    $db->beginTransaction();
    try {
        $stmt = $db->prepare(
            "INSERT INTO bills (title,description,amount,category_id,group_id,paid_by,split_type,receipt_image,bill_date,notes)
             VALUES (?,?,?,?,?,?,?,?,?,?)"
        );
        $stmt->execute([
            clean($title), clean($notes ?: ''), $amount,
            $categoryId, $groupId, $uid, $splitType,
            $receiptImage ?: null, $billDate, clean($notes)
        ]);
        $billId = (int)$db->lastInsertId();

        $pStmt = $db->prepare(
            "INSERT INTO bill_participants (bill_id,user_id,amount_owed) VALUES (?,?,?)"
        );
        foreach ($participants as $p) {
            $pStmt->execute([$billId, (int)$p['user_id'], (float)$p['amount_owed']]);
            // Notify participant (skip payer)
            if ((int)$p['user_id'] !== $uid) {
                notify($db, (int)$p['user_id'], 'bill_added',
                    'New Bill Added',
                    "{$auth['name']} added \"{$title}\" — SAR " . number_format($amount, 2),
                    $billId, 'bill');
            }
        }

        $db->commit();
        success(['id' => $billId], 'Bill created', 201);
    } catch (Exception $e) {
        $db->rollBack();
        error('Failed to create bill', 500);
    }
}

error('Method not allowed', 405);
