<?php
require_once '../config/response.php';
setHeaders();

if (session_status() === PHP_SESSION_NONE) { session_start(); }
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
              $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();
success(null, 'Logged out successfully');
