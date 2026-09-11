/**
 * QATTAH — Sign in with Google
 *
 * Shared by login.html, register.html and the shared-receipt gate. Self
 * contained on purpose: receipt.html doesn't load app.js, so this file
 * can't depend on anything but fetch.
 *
 * Flow: Google Identity Services renders its own button. When the user
 * picks an account it hands us a signed ID token ("credential"). We post
 * that to api/auth/google.php, which verifies Google's signature before
 * trusting a single field inside it — see that file for why.
 */
const GoogleSignIn = (function () {

  const GSI_SRC   = 'https://accounts.google.com/gsi/client';
  const OUT_FLAG  = 'qattah_signed_out';
  let config      = null;  // { enabled, client_id } from the server
  let onDone      = null;  // where to send the user afterwards

  /* ── "I meant to log out" ────────────────────────────────────────
     auto_select signs a returning user straight back in, which is the
     whole point — except immediately after they pressed Logout, where it
     would yank them back into the app. Logout sets this flag; we honour it
     once, then clear it on the next successful sign-in so One Tap resumes
     on later visits. Kept in localStorage rather than calling Google's
     disableAutoSelect() so the app pages never have to load Google's
     script just to be able to log out. */
  const suppressed  = () => { try { return localStorage.getItem(OUT_FLAG) === '1'; } catch (_) { return false; } };
  const clearSuppress = () => { try { localStorage.removeItem(OUT_FLAG); } catch (_) {} };

  /** Load the GSI script once, resolving when window.google is ready. */
  function loadScript() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve();
      const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', reject);
        return;
      }
      const s = document.createElement('script');
      s.src = GSI_SRC;
      s.async = true;
      s.defer = true;
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error('Could not reach Google'));
      document.head.appendChild(s);
    });
  }

  /** Ask the server whether Google sign-in is switched on. */
  async function fetchConfig() {
    if (config) return config;
    const res  = await fetch('api/auth/google.php', { credentials: 'include' });
    const json = await res.json();
    config = json.data || { enabled: false };
    return config;
  }

  /** Google calls this with the signed ID token. */
  async function handleCredential(response) {
    const btnWrap = document.getElementById('g-btn');
    if (btnWrap) btnWrap.classList.add('g-busy');
    try {
      const res = await fetch('api/auth/google.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Google sign-in failed');
      clearSuppress();
      onDone ? onDone(json.data) : window.location.reload();
    } catch (e) {
      if (btnWrap) btnWrap.classList.remove('g-busy');
      (window.showToast || window.toast || alert)(e.message || 'Google sign-in failed', 'error');
    }
  }

  /**
   * Render the Google button into #g-btn.
   *
   * @param {object}  opts
   * @param {function} opts.onSuccess  called with the signed-in user
   * @param {boolean}  opts.oneTap     also show the One Tap prompt — the
   *                                   "already signed in to Google? just
   *                                   tap once" bubble. Login page only;
   *                                   it would be pushy anywhere else.
   */
  async function mount({ onSuccess, oneTap = false } = {}) {
    const slot = document.getElementById('g-btn');
    if (!slot) return;
    onDone = onSuccess;

    let cfg;
    try { cfg = await fetchConfig(); } catch (_) { return hideBlock(); }
    if (!cfg.enabled) return hideBlock();      // no client id → stay hidden

    try { await loadScript(); } catch (_) { return hideBlock(); }

    const justLoggedOut = suppressed();

    window.google.accounts.id.initialize({
      client_id: cfg.client_id,
      callback : handleCredential,
      // Lets a returning user sign in without the account chooser at all —
      // unless they just pressed Logout.
      auto_select: !justLoggedOut,
      cancel_on_tap_outside: false,
    });

    // Unhide BEFORE measuring: a display:none slot reports offsetWidth 0,
    // and Google would then render a default-width button that overhangs
    // the form fields next to it.
    slot.closest('.g-block')?.classList.remove('hidden');

    window.google.accounts.id.renderButton(slot, {
      type : 'standard',
      theme: document.documentElement.getAttribute('data-theme') === 'dark'
               ? 'filled_black' : 'outline',
      size : 'large',
      shape: 'pill',
      text : 'continue_with',
      logo_alignment: 'center',
      // Google clamps this to 400 and rejects 0, hence the floor.
      width: Math.max(200, Math.min(Math.round(slot.offsetWidth) || 360, 400)),
      // Follow the app's own language toggle rather than the browser's,
      // so an English UI doesn't sprout an Arabic Google button.
      locale: (localStorage.getItem('lang') || 'en'),
    });

    if (oneTap && !justLoggedOut) window.google.accounts.id.prompt();
  }

  /** No client id configured (or Google unreachable) — hide the whole block
   *  so the page doesn't show a dead button or a stray "or" divider. */
  function hideBlock() {
    document.getElementById('g-btn')?.closest('.g-block')?.remove();
  }

  /** Call from Logout so One Tap doesn't sign the user straight back in. */
  function markSignedOut() {
    try { localStorage.setItem(OUT_FLAG, '1'); } catch (_) {}
    // If Google's script happens to be on this page, tell it properly too.
    window.google?.accounts?.id?.disableAutoSelect?.();
  }

  return { mount, markSignedOut };
})();
