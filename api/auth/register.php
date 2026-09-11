<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { error('Method not allowed', 405); }

$body = getBody();
$name     = trim($body['name']     ?? '');
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');
$phone    = trim($body['phone']    ?? '');

// ── Validation ──────────────────────────────────────────────
if (empty($name) || empty($email) || empty($password)) {
    error('Name, email and password are required');
}
if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
    error('Name must be between 2 and 100 characters');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    error('Invalid email address');
}
if (mb_strlen($password) < 6) {
    error('Password must be at least 6 characters');
}

$db = Database::getInstance()->getConnection();

// ── Duplicate email check ────────────────────────────────────
$stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$email]);
if ($stmt->fetch()) { error('Email is already registered', 409); }

// ── Insert ───────────────────────────────────────────────────
$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $db->prepare(
    "INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)"
);
$stmt->execute([$name, $email, $hash, $phone]);
$userId = (int)$db->lastInsertId();

// ── Auto-login ───────────────────────────────────────────────
startSession();
session_regenerate_id(true);
$_SESSION['user_id']   = $userId;
$_SESSION['user_name'] = $name;

success(['id' => $userId, 'name' => $name, 'email' => $email], 'Registration successful', 201);
