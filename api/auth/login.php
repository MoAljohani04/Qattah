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

// An account created through Google has no password yet. Say so plainly —
// "invalid email or password" would send them round in circles. This leaks
// nothing an attacker can use: the Google button is on the same page.
if ($user && empty($user['password'])) {
    error('This account uses Sign in with Google. Tap the Google button above.', 401);
}
if (!$user || !password_verify($password, (string)$user['password'])) {
    error('Invalid email or password', 401);
}
if ((int)$user['is_active'] === 0) {
    error('This account has been disabled. Contact the administrator.', 403);
}
unset($user['is_active']);

startSession();
session_regenerate_id(true);
$_SESSION['user_id']   = $user['id'];
$_SESSION['user_name'] = $user['name'];

unset($user['password']);
success($user, 'Login successful');
