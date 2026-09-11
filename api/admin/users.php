<?php
/**
 * /api/admin/users.php   (owner only)
 *   GET                          → all users with participation counts
 *   PUT ?id=X  {is_active}       → enable/disable a user
 */
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$db = Database::getInstance()->getConnection();
$ownerId = requireOwner($db);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $db->query(
        "SELECT u.id, u.name, u.email, u.created_at, u.is_active,
                (SELECT COUNT(DISTINCT receipt_id) FROM receipt_claims WHERE user_id = u.id) AS receipts_joined,
                (SELECT COUNT(*) FROM receipt_payments WHERE user_id = u.id)                 AS payments_made
         FROM users u
         ORDER BY u.created_at DESC"
    )->fetchAll();
    success(['users' => $rows]);
}

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) { error('Missing user id'); }

if ($method === 'PUT') {
    if ($id === $ownerId) { error('You cannot disable the owner account'); }

    // Prevent disabling the owner email even if id differs.
    $chk = $db->prepare("SELECT email FROM users WHERE id = ?");
    $chk->execute([$id]);
    $email = $chk->fetchColumn();
    if ($email === false) { error('User not found', 404); }
    if (strcasecmp((string)$email, OWNER_EMAIL) === 0) { error('You cannot disable the owner account'); }

    $body   = getBody();
    $active = (int)!empty($body['is_active']);
    $db->prepare("UPDATE users SET is_active = ? WHERE id = ?")->execute([$active, $id]);
    success(['id' => $id, 'is_active' => $active], $active ? 'User enabled' : 'User disabled');
}

error('Method not allowed', 405);
