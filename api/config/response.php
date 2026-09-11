<?php
/**
 * QATTAH — Shared response helpers, input helpers, auth guard.
 */

function setHeaders(): void {
    header('Content-Type: application/json; charset=UTF-8');

    /* The front-end and the API are served from the same origin, so the
     * only cross-origin request we ever want to allow is the page's own.
     * Echoing back the request's origin only when it matches this host
     * keeps that working on localhost, on qattah.online, and on any
     * future domain, without ever becoming the wildcard that would let
     * another site make credentialed calls on a user's behalf. */
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $self = parse_url($origin, PHP_URL_HOST) ?? '';
        // Same host, or any localhost port during development.
        $isSelf  = ($self !== '' && strcasecmp($self, preg_replace('/:\d+$/', '', $host)) === 0);
        $isLocal = in_array($self, ['localhost', '127.0.0.1'], true);
        if ($isSelf || $isLocal) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }
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

/** How long a signed-in session survives. Sign-in should be a rare event,
 *  so the cookie outlives the browser window instead of dying with it. */
const SESSION_LIFETIME = 60 * 60 * 24 * 30;   // 30 days

/**
 * Start the session with QATTAH's cookie settings.
 * Must be used everywhere instead of a bare session_start(), because the
 * cookie lifetime and flags can only be set BEFORE the session starts.
 */
function startSession(): void {
    if (session_status() !== PHP_SESSION_NONE) { return; }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
          || (($_SERVER['SERVER_PORT'] ?? '') === '443');

    ini_set('session.gc_maxlifetime', (string)SESSION_LIFETIME);
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path'     => '/',
        'httponly' => true,          // JS can't read it — blunts XSS session theft
        'secure'   => $https,        // only sent over HTTPS when we're on HTTPS
        'samesite' => 'Lax',         // survives a normal link click, blocks CSRF POSTs
    ]);
    session_start();
}

/** Start session safely and return current user info, or 401. */
function requireAuth(): array {
    startSession();
    if (empty($_SESSION['user_id'])) {
        error('Unauthorized. Please log in.', 401);
    }
    return ['id' => (int)$_SESSION['user_id'], 'name' => $_SESSION['user_name']];
}

/**
 * A CA bundle that actually exists, for cURL HTTPS verification.
 * XAMPP's php.ini often points at a missing file, which breaks every
 * outbound HTTPS call. Named distinctly from ai.php's caBundle() so the
 * two can coexist without a redeclare fatal.
 */
function qattahCaBundle(): ?string {
    foreach ([
        'C:\\xampp\\apache\\bin\\curl-ca-bundle.crt',
        ini_get('curl.cainfo'),
        ini_get('openssl.cafile'),
        __DIR__ . '/cacert.pem',
        '/etc/ssl/certs/ca-certificates.crt',
    ] as $p) {
        if ($p && @is_file($p)) { return $p; }
    }
    return null;
}

/** Return current user info if logged in, or null — never exits.
 *  Used by endpoints that are partly public (e.g. a shared receipt). */
function currentUser(): ?array {
    startSession();
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
