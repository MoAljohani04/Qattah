<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { error('Method not allowed', 405); }
requireAuth();
$db   = Database::getInstance()->getConnection();
$rows = $db->query("SELECT * FROM categories ORDER BY id")->fetchAll();
success($rows);
