<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$auth = requireAuth();
$uid  = $auth['id'];
$db   = Database::getInstance()->getConnection();

// ── GET: list user's groups ───────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare(
        "SELECT g.id, g.name, g.description, g.cover_image, g.created_at,
                (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count,
                (SELECT COUNT(*) FROM bills b WHERE b.group_id = g.id) AS bill_count,
                gm.role,
                COALESCE((
                    SELECT SUM(bp.amount_owed) FROM bill_participants bp
                    JOIN bills b2 ON b2.id = bp.bill_id
                    WHERE b2.group_id = g.id AND b2.paid_by = :uid2 AND bp.user_id != :uid3 AND bp.is_settled = 0
                ), 0) AS owe_me,
                COALESCE((
                    SELECT SUM(bp2.amount_owed) FROM bill_participants bp2
                    JOIN bills b3 ON b3.id = bp2.bill_id
                    WHERE b3.group_id = g.id AND bp2.user_id = :uid4 AND b3.paid_by != :uid5 AND bp2.is_settled = 0
                ), 0) AS i_owe
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = :uid
         ORDER BY g.updated_at DESC"
    );
    $stmt->execute([':uid' => $uid, ':uid2' => $uid, ':uid3' => $uid, ':uid4' => $uid, ':uid5' => $uid]);
    success($stmt->fetchAll());
}

// ── POST: create group ────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = getBody();
    $name = trim($body['name'] ?? '');
    $desc = trim($body['description'] ?? '');
    if (mb_strlen($name) < 2) { error('Group name must be at least 2 characters'); }

    $db->beginTransaction();
    try {
        $db->prepare("INSERT INTO groups (name,description,created_by) VALUES (?,?,?)")
           ->execute([clean($name), clean($desc), $uid]);
        $gid = (int)$db->lastInsertId();
        // Creator is admin
        $db->prepare("INSERT INTO group_members (group_id,user_id,role) VALUES (?,?,'admin')")
           ->execute([$gid, $uid]);
        // Add extra members if provided
        $members = $body['members'] ?? [];
        $mStmt   = $db->prepare("INSERT IGNORE INTO group_members (group_id,user_id,role) VALUES (?,?,'member')");
        foreach ($members as $mid) {
            $mid = (int)$mid;
            if ($mid && $mid !== $uid) {
                $mStmt->execute([$gid, $mid]);
                notify($db, $mid, 'added_to_group', 'Added to Group',
                    "{$auth['name']} added you to \"{$name}\"", $gid, 'group');
            }
        }
        $db->commit();
        success(['id' => $gid], 'Group created', 201);
    } catch (Exception $e) {
        $db->rollBack();
        error('Failed to create group', 500);
    }
}

error('Method not allowed', 405);
