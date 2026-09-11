<?php
/**
 * QATTAH — AI configuration TEMPLATE.
 *
 * Copy this file to api/config/ai.php and paste your own key. ai.php is
 * gitignored so keys never reach the repo.
 *
 * Pick a provider, paste its API key, choose a model. If the active key is
 * blank (or a call fails) the receipt "extract" step falls back to editable
 * placeholder rows (manual entry) so the app still works.
 *
 * ⚠️ Keep keys private — don't commit them to a public repo.
 */

// Which provider to use: 'google' (Gemini) or 'anthropic' (Claude).
const AI_PROVIDER = 'google';

/* ── Google Gemini — FREE TIER available ──────────────────────────────
 *  Get a key at:  https://aistudio.google.com/apikey
 *  A valid key looks like:  AIzaSy............................
 *  (NOTE: 'gen-lang-client-...' is a project/client id, NOT an API key.)
 */
const GOOGLE_API_KEY = '';               // ← replace with your AIzaSy… key
const GOOGLE_MODEL   = 'gemini-2.5-flash';             // 2.0-flash often has 0 free quota; 2.5-flash works

/* ── Anthropic Claude — paid ──────────────────────────────────────────
 *  Get a key at:  https://console.anthropic.com  (Settings → API Keys)
 *  A valid key looks like:  sk-ant-api03-............
 */
const ANTHROPIC_API_KEY = '';
const ANTHROPIC_MODEL   = 'claude-opus-4-8';           // or 'claude-sonnet-4-6', 'claude-haiku-4-5'

// ── Helpers (used by extract / ai-status / admin settings) ────────────
function aiProvider(): string { return AI_PROVIDER; }
function aiKey(): string      { return AI_PROVIDER === 'google' ? GOOGLE_API_KEY : ANTHROPIC_API_KEY; }
function aiEnabled(): bool    { return trim(aiKey()) !== ''; }
function aiDefaultModel(): string { return AI_PROVIDER === 'google' ? GOOGLE_MODEL : ANTHROPIC_MODEL; }
function aiModelChoices(): array {
    return AI_PROVIDER === 'google'
        ? ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash']
        : ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'];
}

/**
 * Find a CA bundle that actually exists, for cURL HTTPS verification.
 * XAMPP's php.ini often points openssl.cafile at a missing file, which
 * breaks every HTTPS call ("error setting certificate file"). We pick the
 * first bundle that exists instead of trusting the ini value.
 */
function caBundle(): ?string {
    $candidates = [
        'C:\\xampp\\apache\\bin\\curl-ca-bundle.crt',
        ini_get('curl.cainfo'),
        ini_get('openssl.cafile'),
        __DIR__ . '/cacert.pem',
        '/etc/ssl/certs/ca-certificates.crt',
    ];
    foreach ($candidates as $p) {
        if ($p && @is_file($p)) { return $p; }
    }
    return null;
}

/** Active model: owner setting in DB if valid for this provider, else default. */
function aiActiveModel(PDO $db): string {
    $choices = aiModelChoices();
    try {
        $stmt = $db->query("SELECT setting_value FROM app_settings WHERE setting_key = 'ai_model'");
        $val  = $stmt ? (string)$stmt->fetchColumn() : '';
        if (in_array($val, $choices, true)) { return $val; }
    } catch (Throwable $e) { /* table may be missing — fall back */ }
    return aiDefaultModel();
}
