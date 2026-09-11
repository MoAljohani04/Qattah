<?php
/**
 * /api/auth/google.php
 *   GET  → { enabled, client_id }  so the front-end knows whether to render
 *           the Google button, and with which client id
 *   POST → { credential }          the ID token from Google Identity Services;
 *           verifies it and logs the user in, creating or linking as needed
 *
 * ── Why the verification below matters ───────────────────────────────
 * The browser hands us a token it claims came from Google. Anyone can POST
 * this endpoint with a made-up token, so we must never read the token's
 * contents until we have checked that Google actually signed it. The order
 * is: verify the RS256 signature against Google's published certificates,
 * then check the claims (who issued it, who it was issued FOR, and whether
 * it has expired), and only then trust the email inside.
 */
require_once '../config/database.php';
require_once '../config/response.php';
require_once '../config/google.php';
setHeaders();

// ── GET: tell the client whether Google sign-in is available ──────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    success([
        'enabled'   => googleEnabled(),
        'client_id' => googleEnabled() ? GOOGLE_CLIENT_ID : null,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { error('Method not allowed', 405); }
if (!googleEnabled()) {
    error('Google sign-in is not configured on this server. Add a Client ID in api/config/google.php.', 503);
}

$body  = getBody();
$token = trim($body['credential'] ?? '');
if ($token === '') { error('Missing Google credential'); }

try {
    $claims = verifyGoogleIdToken($token, GOOGLE_CLIENT_ID);
} catch (Throwable $e) {
    // Don't echo internals back to the browser; log for the developer.
    error_log('[QATTAH] Google ID token rejected: ' . $e->getMessage());
    error('Could not verify your Google sign-in. Please try again.', 401);
}

$googleId = (string)($claims['sub'] ?? '');
$email    = strtolower(trim((string)($claims['email'] ?? '')));
$name     = trim((string)($claims['name'] ?? ''));
$picture  = trim((string)($claims['picture'] ?? ''));

if ($googleId === '' || $email === '') { error('Google did not return an email address', 400); }
if ($name === '') { $name = explode('@', $email)[0]; }

$db = Database::getInstance()->getConnection();

// ── 1. Already linked? ────────────────────────────────────────────────
$stmt = $db->prepare("SELECT * FROM users WHERE google_id = ?");
$stmt->execute([$googleId]);
$user = $stmt->fetch();

// ── 2. Same verified email, signed up with a password before? Link it. ─
//    Safe because we only reach here with Google's email_verified = true,
//    so the person at the keyboard provably controls that mailbox.
if (!$user) {
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if ($user) {
        $db->prepare("UPDATE users SET google_id = ? WHERE id = ?")
           ->execute([$googleId, $user['id']]);
        $user['google_id'] = $googleId;
    }
}

// ── 3. Brand new account ──────────────────────────────────────────────
if (!$user) {
    $stmt = $db->prepare(
        "INSERT INTO users (name, email, password, google_id, avatar, avatar_source)
         VALUES (?, ?, NULL, ?, ?, ?)"
    );
    $stmt->execute([
        clean($name), $email, $googleId,
        $picture ?: null, $picture ? 'google' : null,
    ]);
    $newId = (int)$db->lastInsertId();

    $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$newId]);
    $user = $stmt->fetch();
    $isNew = true;
}

if (isset($user['is_active']) && (int)$user['is_active'] === 0) {
    error('This account has been disabled. Contact the administrator.', 403);
}

// Keep a Google profile picture fresh, but never clobber an uploaded one.
if ($picture !== '' && ($user['avatar_source'] ?? null) !== 'upload'
    && ($user['avatar'] ?? '') !== $picture) {
    $db->prepare("UPDATE users SET avatar = ?, avatar_source = 'google' WHERE id = ?")
       ->execute([$picture, $user['id']]);
    $user['avatar'] = $picture;
}

startSession();
session_regenerate_id(true);
$_SESSION['user_id']   = (int)$user['id'];
$_SESSION['user_name'] = $user['name'];

// A linked account keeps the password it already had; a fresh Google
// account has none. The client uses this to offer "set a password".
$hasPassword = !empty($user['password']);

unset($user['password'], $user['is_active']);
$user['id']           = (int)$user['id'];
$user['has_password'] = $hasPassword;
$user['is_new']       = !empty($isNew);

success($user, !empty($isNew) ? 'Welcome to QATTAH!' : 'Login successful');


/**
 * Verify a Google ID token and return its claims.
 * Throws on anything that doesn't check out. Never returns unverified data.
 */
function verifyGoogleIdToken(string $jwt, string $clientId): array {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) { throw new RuntimeException('Malformed token'); }
    [$b64Header, $b64Payload, $b64Sig] = $parts;

    $header = json_decode(b64urlDecode($b64Header), true);
    if (!is_array($header)) { throw new RuntimeException('Malformed token header'); }

    // Only RS256 — refusing anything else blocks the classic "alg: none"
    // and HMAC-confusion attacks.
    if (($header['alg'] ?? '') !== 'RS256') {
        throw new RuntimeException('Unexpected signing algorithm: ' . ($header['alg'] ?? '?'));
    }
    $kid = (string)($header['kid'] ?? '');
    if ($kid === '') { throw new RuntimeException('Token has no key id'); }

    // ── Signature ─────────────────────────────────────────────────────
    $certs = googleCerts();
    if (!isset($certs[$kid])) {
        $certs = googleCerts(true);                       // key rotated? refetch once
        if (!isset($certs[$kid])) { throw new RuntimeException('Unknown signing key'); }
    }
    $pubKey = openssl_pkey_get_public($certs[$kid]);
    if ($pubKey === false) { throw new RuntimeException('Bad Google certificate'); }

    $ok = openssl_verify(
        "{$b64Header}.{$b64Payload}",
        b64urlDecode($b64Sig),
        $pubKey,
        OPENSSL_ALGO_SHA256
    );
    if ($ok !== 1) { throw new RuntimeException('Signature does not verify'); }

    // ── Claims — only trustworthy now that the signature checked out ───
    $claims = json_decode(b64urlDecode($b64Payload), true);
    if (!is_array($claims)) { throw new RuntimeException('Malformed token payload'); }

    $iss = (string)($claims['iss'] ?? '');
    if ($iss !== 'https://accounts.google.com' && $iss !== 'accounts.google.com') {
        throw new RuntimeException('Wrong issuer: ' . $iss);
    }

    // The token must have been minted for THIS app. Without this check any
    // valid Google token from any other site would be accepted.
    if (!hash_equals($clientId, (string)($claims['aud'] ?? ''))) {
        throw new RuntimeException('Token audience is not this app');
    }

    $now    = time();
    $leeway = 60;                                          // clock skew
    if (($claims['exp'] ?? 0) + $leeway < $now)  { throw new RuntimeException('Token expired'); }
    if (($claims['iat'] ?? 0) - $leeway > $now)  { throw new RuntimeException('Token issued in the future'); }

    // Google sends this as a real boolean or the string "true".
    $verified = $claims['email_verified'] ?? false;
    if ($verified !== true && $verified !== 'true') {
        throw new RuntimeException('Google email is not verified');
    }

    return $claims;
}

/** URL-safe base64 decode (JWT flavour — no padding). */
function b64urlDecode(string $s): string {
    $out = base64_decode(strtr($s, '-_', '+/'), true);
    if ($out === false) { throw new RuntimeException('Bad base64 in token'); }
    return $out;
}

/**
 * Google's signing certificates, as [kid => PEM].
 * Cached on disk because Google rotates them only every few days and we
 * don't want an HTTPS round-trip on every single login.
 */
function googleCerts(bool $forceRefresh = false): array {
    $cacheFile = sys_get_temp_dir() . '/qattah_google_certs.json';

    if (!$forceRefresh && is_file($cacheFile)) {
        $cached = json_decode((string)@file_get_contents($cacheFile), true);
        if (is_array($cached) && ($cached['expires'] ?? 0) > time() && !empty($cached['certs'])) {
            return $cached['certs'];
        }
    }

    $ch = curl_init('https://www.googleapis.com/oauth2/v1/certs');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER         => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    // Reuse the CA-bundle fix XAMPP needs for any outbound HTTPS.
    if ($ca = qattahCaBundle()) { curl_setopt($ch, CURLOPT_CAINFO, $ca); }
    $raw      = curl_exec($ch);
    $code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hdrSize  = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($raw === false) { throw new RuntimeException('Cannot reach Google certs: ' . $curlErr); }
    if ($code !== 200)  { throw new RuntimeException("Google certs returned HTTP {$code}"); }

    $headers = substr($raw, 0, $hdrSize);
    $certs   = json_decode(substr($raw, $hdrSize), true);
    if (!is_array($certs) || !$certs) { throw new RuntimeException('Google certs response was empty'); }

    // Respect Google's own cache lifetime, within sane bounds.
    $ttl = 3600;
    if (preg_match('/max-age=(\d+)/i', $headers, $m)) {
        $ttl = max(300, min((int)$m[1], 86400));
    }
    @file_put_contents($cacheFile, json_encode(['expires' => time() + $ttl, 'certs' => $certs]));

    return $certs;
}
