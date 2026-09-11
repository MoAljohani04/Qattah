<?php
/**
 * /api/receipts/index.php
 *   GET  → list receipts created by the current user
 *          ?group_id=N → receipts attached to a group the user belongs to
 *   POST → create a receipt from confirmed items, returns share token + url
 */
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$auth = requireAuth();
$uid  = $auth['id'];
$db   = Database::getInstance()->getConnection();

// ── GET: my receipts, or a group's receipts ──────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $groupId = (int)($_GET['group_id'] ?? 0);

    $cols = "r.id, r.share_token, r.restaurant_name, r.receipt_date,
             r.total_amount, r.currency, r.status, r.created_at, r.group_id,
             g.name AS group_name, u.name AS creator_name,
             (SELECT COUNT(DISTINCT user_id) FROM receipt_claims  WHERE receipt_id = r.id) AS participant_count,
             (SELECT COUNT(*)               FROM receipt_payments WHERE receipt_id = r.id) AS paid_count";

    if ($groupId) {
        requireGroupMember($db, $groupId, $uid);
        $stmt = $db->prepare(
            "SELECT {$cols}
             FROM receipts r
             LEFT JOIN `groups` g ON g.id = r.group_id
             JOIN users u ON u.id = r.created_by
             WHERE r.group_id = ?
             ORDER BY r.created_at DESC"
        );
        $stmt->execute([$groupId]);
    } else {
        $stmt = $db->prepare(
            "SELECT {$cols}
             FROM receipts r
             LEFT JOIN `groups` g ON g.id = r.group_id
             JOIN users u ON u.id = r.created_by
             WHERE r.created_by = ?
             ORDER BY r.created_at DESC"
        );
        $stmt->execute([$uid]);
    }
    success(['receipts' => $stmt->fetchAll()]);
}

// ── POST: create receipt ─────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body       = getBody();
    $restaurant = trim($body['restaurant_name'] ?? '') ?: 'Receipt';
    $date       = trim($body['receipt_date']    ?? date('Y-m-d'));
    $currency   = trim($body['currency']        ?? 'SAR');
    $image      = trim($body['receipt_image']   ?? '');
    $groupId    = (int)($body['group_id']       ?? 0);
    $items      = $body['items'] ?? [];   // [{name, unit_price, quantity, is_shared}]

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) { error('Invalid date format'); }

    // A receipt can only be filed under a group the creator belongs to.
    if ($groupId) { requireGroupMember($db, $groupId, $uid); }

    // Keep only valid rows (name present, quantity >= 1).
    $clean = [];
    foreach ($items as $it) {
        $name = trim($it['name'] ?? '');
        $qty  = (int)($it['quantity']   ?? 0);
        $price= round((float)($it['unit_price'] ?? 0), 2);
        if ($name === '' || $qty < 1 || $price < 0) { continue; }
        $clean[] = [
            'name'       => $name,
            'unit_price' => $price,
            'quantity'   => $qty,
            'is_shared'  => !empty($it['is_shared']) ? 1 : 0,
        ];
    }
    if (empty($clean)) { error('Add at least one item with a name and quantity'); }

    $total = 0;
    foreach ($clean as $it) { $total += $it['unit_price'] * $it['quantity']; }
    $total = round($total, 2);

    // Unique short share token (retry on the rare collision).
    $token = '';
    for ($i = 0; $i < 5; $i++) {
        $token = substr(strtoupper(bin2hex(random_bytes(5))), 0, 8);
        $chk = $db->prepare("SELECT 1 FROM receipts WHERE share_token = ?");
        $chk->execute([$token]);
        if (!$chk->fetch()) { break; }
    }

    $db->beginTransaction();
    try {
        $stmt = $db->prepare(
            "INSERT INTO receipts (share_token, restaurant_name, receipt_date, total_amount, currency, receipt_image, created_by, group_id)
             VALUES (?,?,?,?,?,?,?,?)"
        );
        $stmt->execute([$token, clean($restaurant), $date, $total, $currency, $image ?: null, $uid, $groupId ?: null]);
        $receiptId = (int)$db->lastInsertId();

        $iStmt = $db->prepare(
            "INSERT INTO receipt_items (receipt_id, name, unit_price, quantity, is_shared) VALUES (?,?,?,?,?)"
        );
        foreach ($clean as $it) {
            $iStmt->execute([$receiptId, clean($it['name']), $it['unit_price'], $it['quantity'], $it['is_shared']]);
        }

        // Let the rest of the group know there's something to claim.
        if ($groupId) {
            $gStmt = $db->prepare("SELECT name FROM `groups` WHERE id = ?");
            $gStmt->execute([$groupId]);
            $groupName = (string)$gStmt->fetchColumn();

            $mStmt = $db->prepare("SELECT user_id FROM group_members WHERE group_id = ? AND user_id <> ?");
            $mStmt->execute([$groupId, $uid]);
            foreach ($mStmt->fetchAll() as $m) {
                notify($db, (int)$m['user_id'], 'group_receipt', 'New receipt to split',
                    "{$auth['name']} scanned \"{$restaurant}\" in {$groupName} — pick your items",
                    $receiptId, 'receipt');
            }
        }

        $db->commit();
        success([
            'id'          => $receiptId,
            'share_token' => $token,
            'share_path'  => "receipt.html?t={$token}",
            'total'       => $total,
            'group_id'    => $groupId ?: null,
        ], 'Receipt created', 201);
    } catch (Exception $e) {
        $db->rollBack();
        error('Failed to create receipt', 500);
    }
}

error('Method not allowed', 405);


/** 403 unless $uid is a member of $groupId. */
function requireGroupMember(PDO $db, int $groupId, int $uid): void {
    $stmt = $db->prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?");
    $stmt->execute([$groupId, $uid]);
    if (!$stmt->fetch()) { error('You are not a member of this group', 403); }
}
