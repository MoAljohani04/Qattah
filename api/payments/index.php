<?php
require_once '../config/database.php';
require_once '../config/response.php';
setHeaders();
$auth = requireAuth();
$uid  = $auth['id'];
$db   = Database::getInstance()->getConnection();

// ── GET: payment history ──────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare(
        "SELECT p.id, p.amount, p.note, p.payment_date,
                uf.id AS from_id, uf.name AS from_name, uf.avatar AS from_avatar,
                ut.id AS to_id,   ut.name AS to_name,   ut.avatar AS to_avatar,
                b.title AS bill_title
         FROM payments p
         JOIN users uf ON uf.id = p.from_user
         JOIN users ut ON ut.id = p.to_user
         LEFT JOIN bills b ON b.id = p.bill_id
         WHERE p.from_user = ? OR p.to_user = ?
         ORDER BY p.payment_date DESC
         LIMIT 50"
    );
    $stmt->execute([$uid, $uid]);
    success($stmt->fetchAll());
}

// ── POST: record a direct payment (without settling a specific bill) ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body   = getBody();
    $toUser = (int)($body['to_user'] ?? 0);
    $amount = (float)($body['amount'] ?? 0);
    $note   = trim($body['note'] ?? '');

    if (!$toUser || $toUser === $uid) { error('Invalid recipient'); }
    if ($amount <= 0) { error('Amount must be greater than 0'); }

    $uStmt = $db->prepare("SELECT name FROM users WHERE id = ?");
    $uStmt->execute([$toUser]);
    $toUserRow = $uStmt->fetch();
    if (!$toUserRow) { error('Recipient not found', 404); }

    $db->prepare("INSERT INTO payments (from_user,to_user,amount,note) VALUES (?,?,?,?)")
       ->execute([$uid, $toUser, $amount, clean($note)]);

    notify($db, $toUser, 'payment_received', 'Payment Received',
        "{$auth['name']} sent you SAR " . number_format($amount, 2) .
        ($note ? " — {$note}" : ''));

    success(null, 'Payment recorded', 201);
}

error('Method not allowed', 405);
