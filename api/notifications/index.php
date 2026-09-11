<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$auth = requireAuth();
$uid  = $auth['id'];
$db   = Database::getInstance()->getConnection();

// ── GET: list notifications ───────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare(
        "SELECT * FROM notifications WHERE user_id = ?
         ORDER BY created_at DESC LIMIT 50"
    );
    $stmt->execute([$uid]);
    $notifs = $stmt->fetchAll();

    $unread = $db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
    $unread->execute([$uid]);

    success(['notifications' => $notifs, 'unread_count' => (int)$unread->fetchColumn()]);
}

// ── PUT: mark read ────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $body = getBody();
    if (!empty($body['id'])) {
        $db->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?")
           ->execute([(int)$body['id'], $uid]);
    } else {
        // mark all read
        $db->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?")
           ->execute([$uid]);
    }
    success(null, 'Marked as read');
}

error('Method not allowed', 405);
