/**
 * QATTAH — Bills Page (list, add, detail, edit)
 */

// ── Bills list ────────────────────────────────────────────────
Pages.bills = async function({ q = '' } = {}) {
  showLoading();
  try {
    const data = await Api.bills.list({ q });
    const bills = data.bills || [];

    setContent(`
      <div class="page-content fade-in">
        <div class="page-title-bar">
          <div><h2>${t('bills')}</h2><p>${data.total} total</p></div>
          <button class="btn btn-primary" style="padding:8px 14px;font-size:.85rem" onclick="window.location.hash='#add-bill'">
            + Add
          </button>
        </div>

        <div class="search-wrap">
          <div class="search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
          <input class="search-input" placeholder="Search by name…" id="bills-search" value="${q}">
        </div>

        ${bills.length === 0
          ? `<div class="empty-state"><div class="empty-emoji">🧾</div><h3>${t('no_bills')}</h3><p>Tap + Add to create your first bill</p></div>`
          : `<div class="bills-list stagger" id="bills-list">${bills.map(renderBillItem).join('')}</div>`}
      </div>
    `);

    // Search by name
    let searchTimer;
    document.getElementById('bills-search')?.addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        Pages.bills({ q: e.target.value });
      }, 400);
    });

    attachBillClicks();
  } catch(e) {
    setContent(`<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`);
  }
};

// ── Bill detail ───────────────────────────────────────────────
Pages['bill-detail'] = async function({ id } = {}) {
  if (!id) { window.location.hash = '#bills'; return; }
  showLoading();
  try {
    const b = await Api.bills.get(id);
    const isPayer = b.paid_by === State.user.id;
    const myShare = b.participants?.find(p => p.user_id == State.user.id);

    setContent(`
      <div class="page-content fade-in">
        <div style="padding:16px;display:flex;align-items:center;gap:12px">
          <button class="icon-btn" onclick="window.location.hash='#bills'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h2 style="font-size:1.25rem;font-weight:800">${b.title}</h2>
          ${isPayer ? `
            <div style="margin-left:auto;display:flex;gap:6px">
              <button class="btn btn-secondary" style="padding:7px 12px;font-size:.8rem" onclick="editBill(${b.id})">Edit</button>
              <button class="btn btn-danger"    style="padding:7px 12px;font-size:.8rem" onclick="deleteBill(${b.id})">Delete</button>
            </div>` : ''}
        </div>

        <div class="card mx-4" style="margin:0 16px 16px">
          <div style="padding:18px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border-radius:var(--radius)">
            <div style="font-size:2rem;font-weight:900">${fmtCurrency(b.amount, b.currency)}</div>
            <div style="opacity:.8;font-size:.875rem;margin-top:4px">${b.title}</div>
          </div>
          <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div><div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Date</div><div style="font-weight:600;margin-top:3px">${fmtDate(b.bill_date)}</div></div>
            <div><div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Category</div><div style="font-weight:600;margin-top:3px">${b.cat_icon||''} ${b.cat_name||'Uncategorized'}</div></div>
            <div><div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Paid by</div><div style="font-weight:600;margin-top:3px">${isPayer ? 'You' : b.paid_by_name}</div></div>
            <div><div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Split</div><div style="font-weight:600;margin-top:3px;text-transform:capitalize">${b.split_type}</div></div>
            ${b.group_name ? `<div style="grid-column:1/-1"><div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">Group</div><div style="font-weight:600;margin-top:3px">${b.group_name}</div></div>` : ''}
          </div>
        </div>

        ${b.receipt_image ? `
          <div style="padding:0 16px 16px">
            <div style="font-size:.875rem;font-weight:600;margin-bottom:8px">Receipt</div>
            <img src="${b.receipt_image}" style="width:100%;border-radius:var(--radius);max-height:220px;object-fit:cover" alt="Receipt">
          </div>` : ''}

        <div class="section-header"><span class="section-title">Participants</span></div>
        <div class="people-list px-4">
          ${(b.participants||[]).map(p => {
            const isMe = p.user_id == State.user.id;
            return `
              <div class="person-row">
                <div class="person-avatar">${initials(p.name)}</div>
                <div style="flex:1">
                  <div class="person-name">${p.name}${isMe?' (You)':''}</div>
                  <div style="font-size:.75rem;color:var(--text-muted)">${p.is_settled?'Settled ✓':'Pending'}</div>
                </div>
                <span class="person-amount ${p.is_settled?'':'owe'}">${fmtCurrency(p.amount_owed)}</span>
                ${!isPayer && isMe && !p.is_settled ? `<button class="settle-btn" onclick="settleBill(${b.id})">Settle</button>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>
    `);

  } catch(e) {
    setContent(`<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Error loading bill</h3><p>${e.message}</p></div>`);
  }
};

// ── Add / Edit Bill ───────────────────────────────────────────
Pages['add-bill'] = async function({ id } = {}) {
  const isEdit = !!id;
  let existing = null;
  if (isEdit) {
    try { existing = await Api.bills.get(id); } catch(e) { toast(e.message,'error'); return; }
  }

  let selectedParticipants = existing?.participants?.map(p => ({
    user_id: p.user_id, name: p.name, amount_owed: p.amount_owed
  })) || [{ user_id: State.user.id, name: State.user.name, amount_owed: 0 }];

  let receiptPath = existing?.receipt_image || '';

  setContent(`
    <div class="page-content fade-in">
      <div style="padding:16px;display:flex;align-items:center;gap:12px">
        <button class="icon-btn" onclick="history.back()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h2 style="font-size:1.25rem;font-weight:800">${isEdit ? 'Edit Bill' : 'New Bill'}</h2>
      </div>

      <form id="bill-form" style="padding:0 16px 16px">
        <div class="form-group">
          <label class="form-label">Title <span class="req">*</span></label>
          <input class="form-control" id="bill-title" placeholder="e.g. Dinner at Restaurant"
            value="${existing?.title||''}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Amount (SAR) <span class="req">*</span></label>
          <input class="form-control" id="bill-amount" type="number" step="0.01" min="0.01"
            placeholder="0.00" value="${existing?.amount||''}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Date <span class="req">*</span></label>
          <input class="form-control" id="bill-date" type="date"
            value="${existing?.bill_date||new Date().toISOString().split('T')[0]}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Split Type</label>
          <select class="form-control" id="bill-split">
            <option value="equal" ${existing?.split_type==='equal'?'selected':''}>Split Equally</option>
            <option value="custom" ${existing?.split_type==='custom'?'selected':''}>Custom Amounts</option>
          </select>
        </div>

        <!-- Receipt upload -->
        <div class="form-group">
          <label class="form-label">Receipt (optional)</label>
          <div class="receipt-drop ${receiptPath?'has-file':''}" id="receipt-drop"
            onclick="document.getElementById('receipt-file').click()">
            ${receiptPath
              ? `<img src="${receiptPath}" class="receipt-preview" id="receipt-preview">`
              : `<div class="receipt-drop-icon">📷</div><div class="receipt-drop-text">Tap to upload photo</div>`}
          </div>
          <input type="file" id="receipt-file" accept="image/*" class="hidden">
        </div>

        <!-- Participants -->
        <div class="form-group">
          <label class="form-label">Participants</label>
          <div class="input-wrap" style="margin-bottom:10px">
            <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
            <input class="form-control" id="participant-search" placeholder="Search by name or email…">
          </div>
          <div id="participant-results"></div>
          <div id="split-rows" style="margin-top:10px"></div>
        </div>

        <div id="split-total-warn" class="form-error hidden"></div>

        <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px">
          <span class="btn-text">${isEdit ? 'Save Changes' : 'Add Bill'}</span>
        </button>
      </form>
    </div>
  `);

  // ── Receipt upload logic ──────────────────────────────────
  const fileInput = document.getElementById('receipt-file');
  fileInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('receipt', file);
    try {
      const res  = await Api.upload.receipt(fd);
      receiptPath = res.path;
      const drop = document.getElementById('receipt-drop');
      drop.classList.add('has-file');
      drop.innerHTML = `<img src="${receiptPath}" class="receipt-preview" id="receipt-preview">`;
      toast('Receipt uploaded', 'success');
    } catch(err) { toast(err.message, 'error'); }
  });

  // ── Participant search ────────────────────────────────────
  let searchTimer;
  document.getElementById('participant-search').addEventListener('input', async e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { document.getElementById('participant-results').innerHTML=''; return; }
    searchTimer = setTimeout(async () => {
      try {
        const users = await Api.users.search(q);
        document.getElementById('participant-results').innerHTML = users.map(u => `
          <div class="participant-result${selectedParticipants.find(p=>p.user_id==u.id)?' selected':''}"
            onclick="addParticipant(${u.id},'${u.name.replace(/'/g,"\\'")}')">
            <div class="person-avatar" style="width:32px;height:32px;font-size:.75rem">${initials(u.name)}</div>
            <div>
              <div style="font-size:.875rem;font-weight:600">${u.name}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${u.email}</div>
            </div>
          </div>`).join('');
      } catch(_){}
    }, 350);
  });

  renderSplitRows();

  function renderSplitRows() {
    const splitType = document.getElementById('bill-split')?.value || 'equal';
    const amount    = parseFloat(document.getElementById('bill-amount')?.value || 0);
    const share     = splitType === 'equal' && selectedParticipants.length > 0
      ? (amount / selectedParticipants.length) : 0;

    document.getElementById('split-rows').innerHTML = selectedParticipants.map((p, i) => `
      <div class="split-row">
        <div class="person-avatar" style="width:32px;height:32px;font-size:.75rem">${initials(p.name)}</div>
        <span class="split-row-name">${p.name}${p.user_id===State.user.id?' (You)':''}</span>
        ${splitType === 'custom'
          ? `<input class="split-amount-input" data-idx="${i}" type="number" step="0.01" value="${p.amount_owed||''}" placeholder="0.00">`
          : `<span style="font-size:.875rem;font-weight:700;color:var(--text-muted)">SAR ${share.toFixed(2)}</span>`}
        ${p.user_id !== State.user.id
          ? `<button type="button" onclick="removeParticipant(${p.user_id})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;padding:0">✕</button>`
          : ''}
      </div>`).join('');

    // Custom amount change listeners
    document.querySelectorAll('.split-amount-input').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.idx);
        selectedParticipants[idx].amount_owed = parseFloat(e.target.value) || 0;
        validateSplitTotal();
      });
    });
  }

  function validateSplitTotal() {
    const amount = parseFloat(document.getElementById('bill-amount')?.value || 0);
    const total  = selectedParticipants.reduce((s,p) => s + (p.amount_owed||0), 0);
    const warn   = document.getElementById('split-total-warn');
    if (Math.abs(total - amount) > 0.01) {
      warn.textContent = `Amounts total SAR ${total.toFixed(2)} but bill is SAR ${amount.toFixed(2)}`;
      warn.classList.remove('hidden');
    } else {
      warn.classList.add('hidden');
    }
  }

  document.getElementById('bill-split').addEventListener('change', renderSplitRows);
  document.getElementById('bill-amount').addEventListener('input', renderSplitRows);

  window.addParticipant = (userId, name) => {
    if (!selectedParticipants.find(p => p.user_id === userId)) {
      selectedParticipants.push({ user_id: userId, name, amount_owed: 0 });
    }
    document.getElementById('participant-search').value = '';
    document.getElementById('participant-results').innerHTML = '';
    renderSplitRows();
  };

  window.removeParticipant = (userId) => {
    if (userId === State.user.id) return;
    selectedParticipants = selectedParticipants.filter(p => p.user_id !== userId);
    renderSplitRows();
  };

  // ── Submit ────────────────────────────────────────────────
  document.getElementById('bill-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn        = e.target.querySelector('[type=submit]');
    const title      = document.getElementById('bill-title').value.trim();
    const amount     = parseFloat(document.getElementById('bill-amount').value);
    const billDate   = document.getElementById('bill-date').value;
    const splitType  = document.getElementById('bill-split').value;

    if (!title)              { toast('Title is required','error'); return; }
    if (!amount || amount<=0){ toast('Enter a valid amount','error'); return; }
    if (!selectedParticipants.length){ toast('Add at least one participant','error'); return; }

    // Equalise amounts if equal split
    const finalParticipants = selectedParticipants.map(p => ({
      ...p,
      amount_owed: splitType==='equal' ? (amount/selectedParticipants.length) : p.amount_owed
    }));

    btn.classList.add('loading');
    try {
      const payload = {
        title, amount, bill_date: billDate,
        split_type: splitType,
        participants: finalParticipants,
        receipt_image: receiptPath || null,
      };
      if (isEdit) {
        await Api.bills.update(id, payload);
        toast('Bill updated!', 'success');
      } else {
        await Api.bills.create(payload);
        toast('Bill added!', 'success');
      }
      window.location.hash = '#bills';
    } catch(err) {
      toast(err.message, 'error');
    } finally {
      btn.classList.remove('loading');
    }
  });
};

window.settleBill = async (billId) => {
  Modal.open('Settle Bill', '<p>Mark your share of this bill as paid?</p>', [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Mark as Paid', cls:'btn-primary', onClick: async () => {
      try {
        await Api.bills.settle({ bill_id: billId });
        Modal.close();
        toast('Settled! ✓', 'success');
        Pages['bill-detail']({ id: billId });
      } catch(e) { toast(e.message,'error'); }
    }}
  ]);
};

window.deleteBill = async (billId) => {
  Modal.open('Delete Bill', '<p>Are you sure you want to delete this bill? This cannot be undone.</p>', [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Delete', cls:'btn-danger', onClick: async () => {
      try {
        await Api.bills.remove(billId);
        Modal.close();
        toast('Bill deleted', 'success');
        window.location.hash = '#bills';
      } catch(e) { toast(e.message,'error'); }
    }}
  ]);
};

window.editBill = (id) => {
  window.location.hash = `#add-bill?id=${id}`;
};
