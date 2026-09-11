<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { error('Method not allowed', 405); }
requireAuth();

if (empty($_FILES['receipt'])) { error('No file uploaded'); }
$file = $_FILES['receipt'];

if ($file['error'] !== UPLOAD_ERR_OK) { error('Upload error: ' . $file['error']); }

$maxSize  = 5 * 1024 * 1024; // 5 MB
if ($file['size'] > $maxSize) { error('File too large (max 5MB)'); }

$allowed  = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$finfo    = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowed)) { error('Only JPEG, PNG, GIF and WebP images are allowed'); }

$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$safeName = bin2hex(random_bytes(16)) . '.' . strtolower($ext);
$dir      = __DIR__ . '/../../uploads/receipts/';

if (!is_dir($dir)) { mkdir($dir, 0755, true); }

$dest = $dir . $safeName;
if (!move_uploaded_file($file['tmp_name'], $dest)) { error('Failed to save file', 500); }

success(['path' => 'uploads/receipts/' . $safeName], 'Receipt uploaded');
