<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$auth    = requireAuth();
$uid     = $auth['id'];
$db      = Database::getInstance()->getConnection();
$groupId = (int)($_GET['group_id'] ?? 0);
if (!$groupId) { error('group_id required'); }

// Verify admin
$mStmt = $db->prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?");
$mStmt->execute([$groupId, $uid]);
$member = $mStmt->fetch();
if (!$member) { error('Not a member of this group', 403); }

// ── POST: add member ──────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($member['role'] !== 'admin') { error('Only admins can add members', 403); }
    $body      = getBody();
    $newUserId = (int)($body['user_id'] ?? 0);
    if (!$newUserId) { error('user_id required'); }

    // Verify user exists
    $uStmt = $db->prepare("SELECT name FROM users WHERE id = ?");
    $uStmt->execute([$newUserId]);
    $user = $uStmt->fetch();
    if (!$user) { error('User not found', 404); }

    try {
        $db->prepare("INSERT INTO group_members (group_id,user_id,role) VALUES (?,?,'member')")
           ->execute([$groupId, $newUserId]);
        // Fetch group name for notification
        $gStmt = $db->prepare("SELECT name FROM groups WHERE id = ?");
        $gStmt->execute([$groupId]);
        $group = $gStmt->fetch();
        notify($db, $newUserId, 'added_to_group', 'Added to Group',
            "{$auth['name']} added you to \"{$group['name']}\"", $groupId, 'group');
        success(null, 'Member added', 201);
    } catch (PDOException $e) {
        error('User is already in this group', 409);
    }
}

// ── DELETE: remove member ─────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $body      = getBody();
    $remUserId = (int)($body['user_id'] ?? 0);
    if (!$remUserId) { error('user_id required'); }
    // Admin can remove anyone; member can only leave
    if ($member['role'] !== 'admin' && $remUserId !== $uid) {
        error('Only admins can remove other members', 403);
    }
    $db->prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?")
       ->execute([$groupId, $remUserId]);
    success(null, 'Member removed');
}

error('Method not allowed', 405);
