<?php
/**
 * QATTAH — Shared response helpers, input helpers, auth guard.
 */

function setHeaders(): void {
    header('Content-Type: application/json; charset=UTF-8');
    header('Access-Control-Allow-Origin: http://localhost');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}

function success(mixed $data = null, string $message = 'Success', int $code = 200): void {
    http_response_code($code);
    echo json_encode(['success' => true,  'message' => $message, 'data' => $data]);
    exit();
}

function error(string $message = 'Error', int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message, 'data' => null]);
    exit();
}

/** Start session safely and return current user info, or 401. */
function requireAuth(): array {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['user_id'])) {
        error('Unauthorized. Please log in.', 401);
    }
    return ['id' => (int)$_SESSION['user_id'], 'name' => $_SESSION['user_name']];
}

/** Return current user info if logged in, or null — never exits.
 *  Used by endpoints that are partly public (e.g. a shared receipt). */
function currentUser(): ?array {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    return ['id' => (int)$_SESSION['user_id'], 'name' => $_SESSION['user_name']];
}

/** The single email allowed into the owner/admin area. */
const OWNER_EMAIL = 'TheOwner@gmail.com';

/** Require the logged-in user to be the owner, or 403. Returns owner id. */
function requireOwner(PDO $db): int {
    $auth = requireAuth();
    $stmt = $db->prepare("SELECT email FROM users WHERE id = ?");
    $stmt->execute([$auth['id']]);
    $email = (string)$stmt->fetchColumn();
    if (strcasecmp($email, OWNER_EMAIL) !== 0) {
        error('Forbidden — admin access only.', 403);
    }
    return $auth['id'];
}

/** Decode JSON request body. */
function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

/** Basic XSS sanitiser for output. */
function clean(string $value): string {
    return htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
}

/** Insert a notification row. */
function notify(PDO $db, int $userId, string $type, string $title, string $message,
                ?int $refId = null, ?string $refType = null): void {
    $sql = "INSERT INTO notifications (user_id,type,title,message,reference_id,reference_type)
            VALUES (?,?,?,?,?,?)";
    $db->prepare($sql)->execute([$userId, $type, $title, $message, $refId, $refType]);
}
