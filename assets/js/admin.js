/**
 * QATTAH — Owner Admin Dashboard (#admin)
 * Visible only to OWNER_EMAIL. Server enforces it too (every admin
 * endpoint calls requireOwner()), this is just the UI gate.
 */
const OWNER_EMAIL = 'theowner@gmail.com';
const adminEsc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const adminCharts = {};

function isOwner() {
  return State.user && (State.user.email || '').toLowerCase() === OWNER_EMAIL;
}

Pages.admin = function (params = {}) {
  if (!isOwner()) {
    setContent(`
      <div class="empty-state" style="margin-top:80px">
        <div class="empty-emoji">🔒</div>
        <h3>Access denied</h3>
        <p>The owner dashboard is restricted to the administrator account.</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="window.location.hash='#dashboard'">Back to app</button>
      </div>`);
    return;
  }

  const tab = params.tab || 'overview';
  const tabs = [
    ['overview',  'Overview'],
    ['receipts',  'Receipts'],
    ['users',     'Users'],
    ['analytics', 'Analytics'],
    ['settings',  'Settings'],
  ];
  setContent(`
    <div class="page-title-bar"><div>
      <h2>Owner Dashboard</h2>
      <p>Administration · ${adminEsc(State.user.email)}</p>
    </div></div>
    <div class="admin-tabs">
      ${tabs.map(([k, l]) => `<button class="admin-tab${k === tab ? ' active' : ''}"
          onclick="window.location.hash='#admin?tab=${k}'">${l}</button>`).join('')}
    </div>
    <div id="admin-body"><div class="loading-center"><div class="spinner"></div></div></div>
  `);

  if (tab === 'overview')  adminOverview();
  if (tab === 'receipts')  adminReceipts();
  if (tab === 'users')     adminUsers();
  if (tab === 'analytics') adminAnalytics();
  if (tab === 'settings')  adminSettings();
};

// ── Settings (AI receipt reading) ─────────────────────────────
async function adminSettings() {
  try {
    const s = await Api.admin.settings();
    const labels = {
      'claude-opus-4-8'  : 'Opus 4.8 — most accurate',
      'claude-sonnet-4-6': 'Sonnet 4.6 — balanced',
      'claude-haiku-4-5' : 'Haiku 4.5 — fastest / cheapest',
      'gemini-2.5-flash'  : 'Gemini 2.5 Flash — recommended (free tier)',
      'gemini-flash-latest': 'Gemini Flash (latest)',
      'gemini-2.0-flash'  : 'Gemini 2.0 Flash — may need billing',
    };
    const providerName = s.provider === 'google' ? 'Google Gemini' : 'Claude vision';
    $('admin-body').innerHTML = `
      <div class="card card-p">
        <h4 class="admin-chart-title">Receipt AI (${adminEsc(providerName)})</h4>
        <div class="set-row">
          <span>API key</span>
          <span class="badge-status ${s.ai_enabled ? 'open' : 'closed'}">${s.ai_enabled ? 'configured' : 'not set'}</span>
        </div>
        ${s.ai_enabled ? '' : `<p class="admin-row-sub" style="margin:6px 0 14px">
          Add a key to <code>api/config/ai.php</code> on the server to enable automatic receipt reading.</p>`}

        <label class="form-label" style="margin-top:12px">Vision model</label>
        <select class="form-control" id="set-model" ${s.ai_enabled ? '' : 'disabled'}>
          ${s.model_choices.map(m => `<option value="${m}" ${m === s.ai_model ? 'selected' : ''}>${adminEsc(labels[m] || m)}</option>`).join('')}
        </select>
        <p class="admin-row-sub" style="margin-top:8px">Used when scanning a receipt photo. Opus is most accurate; Haiku is cheapest.</p>

        <button class="btn btn-primary" id="set-save" style="margin-top:14px" ${s.ai_enabled ? '' : 'disabled'}>Save</button>
      </div>`;

    const saveBtn = $('set-save');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      saveBtn.classList.add('loading');
      saveBtn.disabled = true;
      try {
        await Api.admin.saveSettings({ ai_model: $('set-model').value });
        toast('Settings saved', 'success');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        saveBtn.classList.remove('loading');
        saveBtn.disabled = false;
      }
    });
  } catch (e) { adminError(e); }
}

// ── Overview ──────────────────────────────────────────────────
async function adminOverview() {
  try {
    const d = await Api.admin.overview();
    const cards = [
      ['Total Receipts',     d.total_receipts,   '🧾', 'var(--primary)'],
      ['Active Receipts',    d.active_receipts,  '🟢', 'var(--info)'],
      ['Total Users',        d.total_users,      '👥', 'var(--accent)'],
      ['Total Transactions', d.total_transactions, '💳', 'var(--secondary)'],
      ['Pending Payments',   d.pending_payments, '⏳', 'var(--warning)'],
      ['Completed Payments', d.completed_payments, '✅', 'var(--success)'],
    ];
    $('admin-body').innerHTML = `
      <div class="stat-grid">
        ${cards.map(([label, val, icon, color]) => `
          <div class="stat-card">
            <div class="stat-ic" style="background:${color}1a;color:${color}">${icon}</div>
            <div class="stat-val">${val}</div>
            <div class="stat-lbl">${label}</div>
          </div>`).join('')}
      </div>
      <div class="card card-p admin-collected">
        <span>Total collected</span>
        <strong>${fmtCurrency(d.total_collected)}</strong>
      </div>`;
  } catch (e) { adminError(e); }
}

// ── Receipts management ───────────────────────────────────────
async function adminReceipts() {
  try {
    const { receipts } = await Api.admin.receipts();
    if (!receipts.length) { $('admin-body').innerHTML = emptyMsg('No receipts yet'); return; }
    $('admin-body').innerHTML = `
      <div class="admin-list">
        ${receipts.map(r => `
          <div class="admin-row" data-id="${r.id}">
            <div class="admin-row-main">
              <div class="admin-row-title">${adminEsc(r.restaurant_name)}
                <span class="badge-status ${r.status}">${r.status}</span></div>
              <div class="admin-row-sub">
                by ${adminEsc(r.creator_name)} · ${fmtDate(r.receipt_date)} ·
                ${r.participant_count} joined · ${r.paid_count} paid
              </div>
            </div>
            <div class="admin-row-amt">${fmtCurrency(r.total_amount, r.currency)}</div>
            <div class="admin-row-actions">
              <button class="btn-mini" title="View" onclick="window.open('receipt.html?t=${r.share_token}','_blank')">View</button>
              <button class="btn-mini" title="${r.status === 'open' ? 'Close' : 'Reopen'}"
                onclick="adminToggleReceipt(${r.id}, '${r.status}')">${r.status === 'open' ? 'Close' : 'Reopen'}</button>
              <button class="btn-mini danger" title="Delete" onclick="adminDeleteReceipt(${r.id}, '${adminEsc(r.restaurant_name)}')">Delete</button>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (e) { adminError(e); }
}

window.adminToggleReceipt = async (id, cur) => {
  const next = cur === 'open' ? 'closed' : 'open';
  try {
    await Api.admin.setReceipt(id, next);
    toast(`Receipt ${next === 'closed' ? 'closed' : 'reopened'}`, 'success');
    adminReceipts();
  } catch (e) { toast(e.message, 'error'); }
};

window.adminDeleteReceipt = (id, name) => {
  Modal.open('Delete receipt', `<p>Delete <strong>${name}</strong> and all its items, claims and payments? This cannot be undone.</p>`, [
    { label: 'Cancel', cls: 'btn-secondary', onClick: () => Modal.close() },
    { label: 'Delete', cls: 'btn-danger', onClick: async () => {
        try { await Api.admin.deleteReceipt(id); Modal.close(); toast('Receipt deleted', 'success'); adminReceipts(); }
        catch (e) { toast(e.message, 'error'); }
      } },
  ]);
};

// ── User management ───────────────────────────────────────────
async function adminUsers() {
  try {
    const { users } = await Api.admin.users();
    $('admin-body').innerHTML = `
      <div class="admin-list">
        ${users.map(u => {
          const active = +u.is_active === 1;
          const owner  = (u.email || '').toLowerCase() === OWNER_EMAIL;
          return `
          <div class="admin-row">
            <div class="admin-row-main">
              <div class="admin-row-title">${adminEsc(u.name)}
                ${owner ? '<span class="badge-status owner">owner</span>' : (active ? '' : '<span class="badge-status closed">disabled</span>')}</div>
              <div class="admin-row-sub">${adminEsc(u.email)} · joined ${fmtDate(u.created_at)} ·
                ${u.receipts_joined} receipts · ${u.payments_made} payments</div>
            </div>
            <div class="admin-row-actions">
              ${owner ? '<span class="admin-row-sub">—</span>' :
                `<button class="btn-mini ${active ? 'danger' : ''}"
                   onclick="adminToggleUser(${u.id}, ${active ? 0 : 1})">${active ? 'Disable' : 'Enable'}</button>`}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  } catch (e) { adminError(e); }
}

window.adminToggleUser = async (id, active) => {
  try {
    await Api.admin.setUserActive(id, active);
    toast(active ? 'User enabled' : 'User disabled', 'success');
    adminUsers();
  } catch (e) { toast(e.message, 'error'); }
};

// ── Analytics ─────────────────────────────────────────────────
async function adminAnalytics() {
  try {
    const d = await Api.admin.analytics();
    Object.values(adminCharts).forEach(c => c?.destroy());

    $('admin-body').innerHTML = `
      <div class="card card-p"><h4 class="admin-chart-title">Receipts created (6 months)</h4><canvas id="ch-receipts" height="160"></canvas></div>
      <div class="card card-p"><h4 class="admin-chart-title">Payments collected (6 months)</h4><canvas id="ch-payments" height="160"></canvas></div>
      <div class="card card-p"><h4 class="admin-chart-title">Most shared receipts</h4><canvas id="ch-shared" height="160"></canvas></div>`;

    const grid = getComputedStyle(document.documentElement).getPropertyValue('--border') || '#E5E7EB';
    const baseOpts = { responsive: true, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { color: grid } }, x: { grid: { display: false } } } };

    adminCharts.receipts = new Chart($('ch-receipts'), {
      type: 'bar',
      data: { labels: d.labels, datasets: [{ data: d.receipts_created, backgroundColor: '#10B981', borderRadius: 6 }] },
      options: baseOpts,
    });
    adminCharts.payments = new Chart($('ch-payments'), {
      type: 'line',
      data: { labels: d.labels, datasets: [{ data: d.payments_collected, borderColor: '#F59E0B',
        backgroundColor: 'rgba(245,158,11,.15)', fill: true, tension: .35, pointRadius: 3 }] },
      options: baseOpts,
    });
    adminCharts.shared = new Chart($('ch-shared'), {
      type: 'bar',
      data: { labels: d.most_shared.map(r => r.restaurant_name),
        datasets: [{ data: d.most_shared.map(r => +r.participants), backgroundColor: '#3B82F6', borderRadius: 6 }] },
      options: { ...baseOpts, indexAxis: 'y' },
    });
  } catch (e) { adminError(e); }
}

// ── helpers ───────────────────────────────────────────────────
function emptyMsg(msg) {
  return `<div class="empty-state"><div class="empty-emoji">📭</div><p>${msg}</p></div>`;
}
function adminError(e) {
  $('admin-body').innerHTML = emptyMsg(adminEsc(e.message || 'Failed to load'));
}
