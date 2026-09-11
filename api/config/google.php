<?php
/**
 * QATTAH — Sign in with Google.
 *
 * Paste your OAuth Client ID below. Unlike an API key this value is NOT a
 * secret — it is embedded in the sign-in button and visible in the page
 * source — so it is safe to commit. There is no client *secret* here: the
 * Google Identity Services flow used by QATTAH returns a signed ID token
 * straight to the browser, and the server verifies that token's signature
 * against Google's public certificates. Nothing confidential is involved.
 *
 * ── Getting a Client ID ──────────────────────────────────────────────
 *  1. https://console.cloud.google.com  → create (or pick) a project
 *  2. APIs & Services → OAuth consent screen → External → fill in the
 *     app name and your email → Save
 *  3. APIs & Services → Credentials → Create Credentials
 *     → OAuth client ID → Web application
 *  4. Under "Authorised JavaScript origins" add every origin you open the
 *     app from. For XAMPP that is:
 *          http://localhost
 *     (Add the port too if you use one, e.g. http://localhost:8080.
 *      The path does NOT belong here — origins only, so no /Qattah.)
 *  5. Copy the Client ID. It ends in .apps.googleusercontent.com
 *
 * Leave it blank and the Google buttons simply don't render — email and
 * password sign-in keeps working exactly as before.
 */

const GOOGLE_CLIENT_ID = '';   // ← e.g. '1234567890-abc123.apps.googleusercontent.com'

/** Is Sign in with Google configured? */
function googleEnabled(): bool {
    return trim(GOOGLE_CLIENT_ID) !== '';
}
