/**
 * QATTAH — Shared receipt page (receipt.html)
 * Handles: sign-in gate → order selection (live calc) → payment confirm → paid.
 * Self-contained: defines its own small helpers (no app.js dependency).
 */

// ── tiny helpers ──────────────────────────────────────────────
const $id = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = (n, cur = 'SAR') =>
  `${cur} ${(parseFloat(n) || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function toast(msg, type = 'info') {
  const area = $id('toast-area');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  area.appendChild(el);
  setTimeout(() => { el.classList.add('hiding'); setTimeout(() => el.remove(), 350); }, 3500);
}

// ── state ─────────────────────────────────────────────────────
const R = {
  token: new URLSearchParams(location.search).get('t') || '',
  data : null,   // full show.php payload
  view : 'loading',
  confirmed: false,
  saveTimer: null,
};

const root = () => $id('r-root');

// ── boot ──────────────────────────────────────────────────────
(async function init() {
  if (!R.token) { renderError('No receipt specified.'); return; }
  await loadReceipt();
})();

async function loadReceipt() {
  try {
    R.data = await Api.receipts.get(R.token);
    if (!R.data.authenticated)       R.view = 'gate';
    else if (R.data.has_paid)        R.view = 'paid';
    else                             R.view = 'order';
    render();
  } catch (e) {
    renderError(e.message || 'Receipt not found.');
  }
}

// ── shared chrome ─────────────────────────────────────────────
function brandHeader() {
  return `
    <div class="r-brand">
      <div class="r-brand-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span>QATTAH</span>
    </div>`;
}

function receiptSummaryCard(r) {
  return `
    <div class="r-summary">
      <div class="r-rest">${esc(r.restaurant_name)}</div>
      <div class="r-sub">Shared by ${esc(r.creator_name)}${r.group_name ? ` in ${esc(r.group_name)}` : ''} · ${esc(r.receipt_date)}</div>
      <div class="r-grand">${money(r.total_amount, r.currency)}</div>
    </div>`;
}

function render() {
  if (R.view === 'gate')    return renderGate();
  if (R.view === 'order')   return renderOrder();
  if (R.view === 'payment') return renderPayment();
  if (R.view === 'paid')    return renderPaid();
}

function renderError(msg) {
  root().innerHTML = `
    ${brandHeader()}
    <div class="empty-state" style="margin-top:80px">
      <div class="empty-emoji" style="font-size:48px">🧾</div>
      <h3>Receipt unavailable</h3>
      <p>${esc(msg)}</p>
    </div>`;
}

// ── sign-in gate (sections 5–6) ───────────────────────────────
function renderGate() {
  const r = R.data.receipt;
  const back = encodeURIComponent(location.href);
  root().innerHTML = `
    ${brandHeader()}
    ${receiptSummaryCard(r)}
    <div class="card card-p r-gate">
      <div class="r-gate-emoji">🔒</div>
      <h3>Please sign in to participate in this receipt.</h3>
      <p>Sign in to pick the items you ordered and pay your share.</p>
      <a class="btn btn-primary btn-block" href="login.html?redirect=${back}">Login</a>
      <a class="btn btn-secondary btn-block" href="register.html?redirect=${back}">Register</a>
      <button class="btn btn-ghost btn-block" id="g-google">Continue with Google</button>
    </div>`;
  $id('g-google').addEventListener('click', () => toast('Google sign-in coming soon', 'info'));
}

// ── order selection + live calc (sections 7–9) ────────────────
function renderOrder() {
  const r = R.data.receipt;
  root().innerHTML = `
    ${brandHeader()}
    ${receiptSummaryCard(r)}

    <div class="r-section-title">Choose what you ordered</div>
    <div class="card r-items" id="r-items"></div>

    <div class="card card-p r-order" id="r-order"></div>

    <label class="r-confirm">
      <input type="checkbox" id="r-confirm-cb">
      <span>I confirm my selected items are correct.</span>
    </label>

    <button class="btn btn-primary btn-block r-pay" id="r-paybtn" disabled>Pay Now</button>
  `;
  renderItemRows();
  renderOrderPanel();

  $id('r-confirm-cb').addEventListener('change', e => {
    R.confirmed = e.target.checked;
    syncPayButton();
  });
  $id('r-paybtn').addEventListener('click', () => {
    if (myTotal() <= 0) { toast('Select at least one item', 'error'); return; }
    R.view = 'payment';
    render();
  });
}

// What a line costs this user right now. Shared lines split the whole line
// between everyone who's in — mirrors receiptTotalFor() on the server.
function myShare(it) {
  if (!it.is_shared) return it.unit_price * it.my_quantity;
  if (it.my_quantity <= 0) return 0;
  const line    = it.unit_price * it.quantity;
  // The server hasn't seen an un-saved tick yet, so count ourselves in.
  const sharers = Math.max(1, it.sharer_count || 1);
  return line / sharers;
}

// The "SAR x each · y left" / "Shared · split n ways" line under an item name.
function itemMetaText(it) {
  const cur = R.data.receipt.currency;
  if (it.is_shared) {
    const n = Math.max(1, it.sharer_count || (it.my_quantity > 0 ? 1 : 0) || 1);
    const line = money(it.unit_price * it.quantity, cur);
    return it.my_quantity > 0
      ? `${line} shared · split ${n} way${n === 1 ? '' : 's'} · you pay ${money(myShare(it), cur)}`
      : `${line} shared · tick to split it`;
  }
  return `${money(it.unit_price, cur)} each · ${it.remaining} left`;
}

function renderItemRows() {
  $id('r-items').innerHTML = R.data.items.map(it => {
    const picker = it.is_shared
      ? `<label class="r-sharepick">
           <input type="checkbox" class="r-sharecb" data-id="${it.id}" ${it.my_quantity > 0 ? 'checked' : ''}>
           <span>I shared this</span>
         </label>`
      : `<div class="qstep">
           <button class="qstep-btn" data-act="dec" data-id="${it.id}">−</button>
           <span class="qstep-val" id="rq-${it.id}">${it.my_quantity}</span>
           <button class="qstep-btn" data-act="inc" data-id="${it.id}">+</button>
         </div>`;
    return `
    <div class="r-item${it.is_shared ? ' is-shared' : ''}" data-id="${it.id}">
      <div class="r-item-info">
        <div class="r-item-name">${esc(it.name)}${it.is_shared ? '<span class="r-shared-tag">Shared</span>' : ''}</div>
        <div class="r-item-meta">${itemMetaText(it)}</div>
      </div>
      ${picker}
    </div>`;
  }).join('');

  $id('r-items').querySelectorAll('.qstep-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      const id  = +e.currentTarget.dataset.id;
      const act = e.currentTarget.dataset.act;
      const it  = R.data.items.find(x => x.id === id);
      if (act === 'inc') {
        if (it.my_quantity >= it.remaining) { toast('No more of this item left', 'info'); return; }
        it.my_quantity += 1;
      } else {
        if (it.my_quantity <= 0) return;
        it.my_quantity -= 1;
      }
      $id(`rq-${id}`).textContent = it.my_quantity;
      refreshItemMeta(it);
      renderOrderPanel();
      syncPayButton();
      scheduleSave();
    }));

  $id('r-items').querySelectorAll('.r-sharecb').forEach(cb =>
    cb.addEventListener('change', e => {
      const it = R.data.items.find(x => x.id === +e.target.dataset.id);
      const wasIn = it.my_quantity > 0;
      it.my_quantity = e.target.checked ? 1 : 0;
      // Optimistic sharer count so the split updates before the server replies.
      if (e.target.checked && !wasIn)      it.sharer_count += 1;
      else if (!e.target.checked && wasIn) it.sharer_count = Math.max(0, it.sharer_count - 1);
      R.data.items.filter(x => x.is_shared).forEach(refreshItemMeta);
      renderOrderPanel();
      syncPayButton();
      scheduleSave();
    }));
}

function refreshItemMeta(it) {
  const el = document.querySelector(`.r-item[data-id="${it.id}"] .r-item-meta`);
  if (el) el.textContent = itemMetaText(it);
}

function myTotal() {
  return R.data.items.reduce((s, it) => s + myShare(it), 0);
}

function renderOrderPanel() {
  const r = R.data.receipt;
  const chosen = R.data.items.filter(it => it.my_quantity > 0);
  const lines = chosen.length
    ? chosen.map(it => `
        <div class="r-order-line">
          <span>${esc(it.name)} ${it.is_shared
            ? `<em class="r-order-split">split ${Math.max(1, it.sharer_count || 1)} ways</em>`
            : `×${it.my_quantity}`}</span>
          <span>${money(myShare(it), r.currency)}</span>
        </div>`).join('')
    : `<div class="r-order-empty">No items selected yet</div>`;
  $id('r-order').innerHTML = `
    <div class="r-order-title">Your Order</div>
    ${lines}
    <div class="r-order-total"><span>Total</span><strong>${money(myTotal(), r.currency)}</strong></div>`;
}

function syncPayButton() {
  const btn = $id('r-paybtn');
  if (!btn) return;
  btn.disabled = !(R.confirmed && myTotal() > 0);
}

// Persist selection (debounced). Server returns authoritative remaining counts.
function scheduleSave() {
  clearTimeout(R.saveTimer);
  R.saveTimer = setTimeout(saveClaims, 450);
}
async function saveClaims() {
  try {
    const claims = R.data.items.map(it => ({ item_id: it.id, quantity: it.my_quantity }));
    const res = await Api.receipts.claim({ token: R.token, claims });
    // Reconcile remaining/claimed from server without disrupting the user's view.
    res.items.forEach(si => {
      const it = R.data.items.find(x => x.id === si.id);
      if (!it) return;
      it.claimed_total = si.claimed_total;
      it.remaining     = si.remaining;
      it.my_quantity   = si.my_quantity;
      it.sharer_count  = si.sharer_count;
      const valEl = $id(`rq-${it.id}`);
      if (valEl) valEl.textContent = it.my_quantity;
      const cb = document.querySelector(`.r-sharecb[data-id="${it.id}"]`);
      if (cb) cb.checked = it.my_quantity > 0;
      refreshItemMeta(it);
    });
    renderOrderPanel();
    syncPayButton();
  } catch (e) {
    toast(e.message || 'Could not save selection', 'error');
  }
}

// ── payment screen (section 10) ───────────────────────────────
function renderPayment() {
  const r = R.data.receipt;
  const chosen = R.data.items.filter(it => it.my_quantity > 0);
  const methods = ['Apple Pay', 'Mada', 'Visa', 'Mastercard', 'STC Pay'];
  root().innerHTML = `
    ${brandHeader()}
    <div class="r-section-title">Payment</div>
    <div class="card card-p">
      <div class="r-rest" style="font-size:1.05rem">${esc(r.restaurant_name)}</div>
      <div class="r-sub" style="margin-bottom:12px">Your items</div>
      ${chosen.map(it => `
        <div class="r-order-line">
          <span>${esc(it.name)} ${it.is_shared
            ? `<em class="r-order-split">split ${Math.max(1, it.sharer_count || 1)} ways</em>`
            : `×${it.my_quantity}`}</span>
          <span>${money(myShare(it), r.currency)}</span>
        </div>`).join('')}
      <div class="r-order-total"><span>Total due</span><strong>${money(myTotal(), r.currency)}</strong></div>
    </div>

    <div class="r-section-title">Pay with</div>
    <div class="r-methods">
      ${methods.map(m => `<button class="r-method" disabled>${m}<small>soon</small></button>`).join('')}
    </div>

    <button class="btn btn-primary btn-block r-pay" id="r-paynow">Pay ${money(myTotal(), r.currency)}</button>
    <button class="btn btn-ghost btn-block" id="r-back">← Back to items</button>
  `;
  $id('r-back').addEventListener('click', () => { R.view = 'order'; render(); });
  $id('r-paynow').addEventListener('click', doPay);
}

async function doPay() {
  const btn = $id('r-paynow');
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    await saveClaims();                       // make sure latest selection is stored
    const res = await Api.receipts.pay({ token: R.token, method: 'mock' });
    R.data.has_paid = true;
    R.paidInfo = res;
    R.view = 'paid';
    render();
  } catch (e) {
    toast(e.message || 'Payment failed', 'error');
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── paid confirmation ─────────────────────────────────────────
function renderPaid() {
  const r = R.data.receipt;
  const amount = R.paidInfo ? money(R.paidInfo.amount, R.paidInfo.currency) : money(myTotal(), r.currency);
  root().innerHTML = `
    ${brandHeader()}
    <div class="card card-p r-paid">
      <div class="r-paid-check">✓</div>
      <h3>Payment confirmed</h3>
      <p>You paid <strong>${amount}</strong> for your share of<br>${esc(r.restaurant_name)}.</p>
      <a class="btn btn-primary btn-block" href="index.html">Go to QATTAH</a>
    </div>`;
}
