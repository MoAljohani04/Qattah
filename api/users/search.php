<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { error('Method not allowed', 405); }
$auth = requireAuth();
$uid  = $auth['id'];
$q    = trim($_GET['q'] ?? '');
if (mb_strlen($q) < 2) { error('Query must be at least 2 characters'); }

$db   = Database::getInstance()->getConnection();
$stmt = $db->prepare(
    "SELECT id, name, email, avatar FROM users
     WHERE (name LIKE ? OR email LIKE ?) AND id != ?
     LIMIT 10"
);
$stmt->execute(["%{$q}%", "%{$q}%", $uid]);
success($stmt->fetchAll());
