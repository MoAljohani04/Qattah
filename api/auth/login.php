<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { error('Method not allowed', 405); }

$body     = getBody();
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (empty($email) || empty($password)) { error('Email and password are required'); }
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { error('Invalid email format'); }

$db   = Database::getInstance()->getConnection();
$stmt = $db->prepare(
    "SELECT id, name, email, password, avatar, phone, language, theme, is_active
     FROM users WHERE email = ?"
);
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    error('Invalid email or password', 401);
}
if ((int)$user['is_active'] === 0) {
    error('This account has been disabled. Contact the administrator.', 403);
}
unset($user['is_active']);

if (session_status() === PHP_SESSION_NONE) { session_start(); }
session_regenerate_id(true);
$_SESSION['user_id']   = $user['id'];
$_SESSION['user_name'] = $user['name'];

unset($user['password']);
success($user, 'Login successful');
