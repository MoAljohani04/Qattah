/**
 * QATTAH — Dashboard Page
 */
Pages.dashboard = async function() {
  showLoading();
  try {
    const d = await Api.dashboard.get();
    const s = d.stats;

    const greetHour = new Date().getHours();
    const greet = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

    setContent(`
      <div class="page-content fade-in">

        <!-- Greeting -->
        <div class="page-title-bar">
          <div>
            <h2>${greet}, ${(State.user.name || '').split(' ')[0]} 👋</h2>
            <p>${new Date().toLocaleDateString(State.lang==='ar'?'ar-SA':'en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
          </div>
          <div class="person-avatar" style="width:44px;height:44px;font-size:.95rem">
            ${State.user.avatar
              ? `<img src="${State.user.avatar}" alt="">`
              : initials(State.user.name)}
          </div>
        </div>

        <!-- Hero balance card -->
        <div class="hero-card">
          <div class="hero-label">${t('net_balance')||'Net Balance'}</div>
          <div class="hero-amount">${fmtCurrency(Math.abs(s.net))}</div>
          <div class="hero-sub">${s.net >= 0 ? '↑ Overall you are owed money' : '↓ Overall you owe money'}</div>
          <div class="hero-row">
            <div class="hero-stat">
              <div class="hero-stat-label">${t('owe_me')}</div>
              <div class="hero-stat-val">${fmtCurrency(s.owe_me)}</div>
            </div>
            <div class="hero-stat">
              <div class="hero-stat-label">${t('i_owe')}</div>
              <div class="hero-stat-val">${fmtCurrency(s.i_owe)}</div>
            </div>
          </div>
        </div>

        <!-- Quick stats -->
        <div class="quick-stats stagger">
          <div class="stat-card">
            <div class="stat-val">${fmtCurrency(s.total_spent).replace('SAR ','')}</div>
            <div class="stat-lbl">${t('total_spent')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${s.bill_count}</div>
            <div class="stat-lbl">${t('bill_count')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${s.group_count}</div>
            <div class="stat-lbl">${t('group_count')}</div>
          </div>
        </div>

        <!-- Who owes me -->
        ${d.owe_me_list.length ? `
        <div class="section-header">
          <span class="section-title">💸 ${t('who_owes_me')}</span>
        </div>
        <div class="people-list px-4 stagger">
          ${d.owe_me_list.map(p => `
            <div class="person-row">
              <div class="person-avatar">${initials(p.name)}</div>
              <span class="person-name">${p.name}</span>
              <span class="person-amount lent">${fmtCurrency(p.amount)}</span>
              <button class="settle-btn" onclick="quickSettle(${p.id},'${p.name}',${p.amount})">
                Remind
              </button>
            </div>`).join('')}
        </div>` : ''}

        <!-- Who I owe -->
        ${d.i_owe_list.length ? `
        <div class="section-header">
          <span class="section-title">💳 ${t('i_owe_lbl')}</span>
        </div>
        <div class="people-list px-4 stagger">
          ${d.i_owe_list.map(p => `
            <div class="person-row">
              <div class="person-avatar">${initials(p.name)}</div>
              <span class="person-name">${p.name}</span>
              <span class="person-amount owe">${fmtCurrency(p.amount)}</span>
              <button class="settle-btn" onclick="recordPayment(${p.id},'${p.name}',${p.amount})">
                Pay
              </button>
            </div>`).join('')}
        </div>` : ''}

        <!-- Recent bills -->
        <div class="section-header">
          <span class="section-title">🧾 ${t('recent_bills')}</span>
          <button class="section-link" onclick="window.location.hash='#bills'">${t('see_all')}</button>
        </div>

        ${d.recent_bills.length === 0
          ? `<div class="empty-state"><div class="empty-emoji">🧾</div><h3>${t('no_bills')}</h3><p>Add your first shared expense!</p></div>`
          : `<div class="bills-list stagger">${d.recent_bills.map(renderBillItem).join('')}</div>`}

        <div style="height:8px"></div>
      </div>
    `);

    // Attach bill click handlers
    attachBillClicks();

  } catch(e) {
    setContent(`<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Couldn't load dashboard</h3><p>${e.message}</p></div>`);
  }
};

function renderBillItem(b) {
  const isLent   = b.paid_by_id === State.user.id;
  const settled  = b.is_settled;
  let   youLabel = '';
  let   youClass = '';
  if (settled) {
    youLabel = 'Settled ✓'; youClass = 'settled';
  } else if (isLent) {
    youLabel = `Lent ${fmtCurrency(b.amount_owed||0)}`; youClass = 'lent';
  } else {
    youLabel = `You owe ${fmtCurrency(b.amount_owed||0)}`; youClass = 'owe';
  }
  return `
    <div class="bill-item card-interactive" data-bill-id="${b.id}">
      <div class="bill-cat-icon" style="background:${(b.cat_color||'#E5E7EB')}22">
        <span>${b.cat_icon || '📦'}</span>
      </div>
      <div class="bill-info">
        <div class="bill-title">${b.title}</div>
        <div class="bill-meta">${fmtDate(b.bill_date)} · ${b.paid_by_name}</div>
      </div>
      <div class="bill-right">
        <div class="bill-amount">${fmtCurrency(b.amount)}</div>
        <div class="bill-you ${youClass}">${youLabel}</div>
      </div>
    </div>`;
}

function attachBillClicks() {
  document.querySelectorAll('[data-bill-id]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = `#bill-detail?id=${el.dataset.billId}`;
    });
  });
}

window.quickSettle = (userId, name, amount) => {
  toast(`Reminder sent to ${name}`, 'success');
};

window.recordPayment = (toUserId, name, amount) => {
  Modal.open(`Pay ${name}`, `
    <div class="form-group">
      <label class="form-label">Amount (SAR)</label>
      <input id="pay-amount" class="form-control" type="number" step="0.01" value="${amount}" min="0.01">
    </div>
    <div class="form-group">
      <label class="form-label">Note (optional)</label>
      <input id="pay-note" class="form-control" type="text" placeholder="e.g. Rent payment">
    </div>
  `, [
    { label: 'Cancel', cls: 'btn-secondary', onClick: Modal.close },
    { label: 'Record Payment', cls: 'btn-primary', onClick: async () => {
      const amount = parseFloat(document.getElementById('pay-amount').value);
      const note   = document.getElementById('pay-note').value;
      if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
      try {
        await Api.payments.record({ to_user: toUserId, amount, note });
        Modal.close();
        toast('Payment recorded!', 'success');
        Pages.dashboard();
      } catch(e) { toast(e.message, 'error'); }
    }}
  ]);
};
