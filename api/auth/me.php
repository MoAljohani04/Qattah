<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $auth = requireAuth();
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT id, name, email, avatar, phone, bio, language, theme, created_at
         FROM users WHERE id = ?"
    );
    $stmt->execute([$auth['id']]);
    $user = $stmt->fetch();
    if (!$user) { error('User not found', 404); }
    success($user);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $auth = requireAuth();
    $body = getBody();
    $db   = Database::getInstance()->getConnection();

    $fields = [];
    $params = [];

    if (!empty($body['name'])) {
        if (mb_strlen($body['name']) < 2) { error('Name too short'); }
        $fields[] = 'name = ?';
        $params[] = clean($body['name']);
    }
    if (!empty($body['phone'])) {
        $fields[] = 'phone = ?';
        $params[] = clean($body['phone']);
    }
    if (!empty($body['bio'])) {
        $fields[] = 'bio = ?';
        $params[] = clean($body['bio']);
    }
    if (!empty($body['language']) && in_array($body['language'], ['en','ar'])) {
        $fields[] = 'language = ?';
        $params[] = $body['language'];
    }
    if (!empty($body['theme']) && in_array($body['theme'], ['light','dark'])) {
        $fields[] = 'theme = ?';
        $params[] = $body['theme'];
    }
    if (!empty($body['password'])) {
        if (mb_strlen($body['password']) < 6) { error('Password must be at least 6 characters'); }
        // Verify old password
        $s = $db->prepare("SELECT password FROM users WHERE id = ?");
        $s->execute([$auth['id']]);
        $row = $s->fetch();
        if (!$row || !password_verify($body['old_password'] ?? '', $row['password'])) {
            error('Current password is incorrect', 403);
        }
        $fields[] = 'password = ?';
        $params[] = password_hash($body['password'], PASSWORD_BCRYPT);
    }

    if (empty($fields)) { error('No fields to update'); }

    $params[] = $auth['id'];
    $db->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
    success(null, 'Profile updated');
}

error('Method not allowed', 405);
