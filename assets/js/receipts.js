/**
 * QATTAH — Receipt scan → confirm → QR share flow
 * In-app screens for the receipt owner:
 *   #add-receipt[?group_id=N]  →  capture/upload  →  item-confirm popup  →  share (QR + link)
 *
 * Scanning is the only way to create a split in QATTAH — the confirm popup
 * is where the owner fixes whatever the AI misread before sharing the link.
 */

const ReceiptFlow = {
  draft    : null,   // {restaurant_name, receipt_date, receipt_image, items:[{name,unit_price,quantity,is_shared}]}
  imageFile: null,
  groupId  : null,   // set when the scan was started from a group
  groups   : [],     // the user's groups, for the picker in the popup
};

const todayISO   = () => new Date().toISOString().slice(0, 10);
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const blankItem = () => ({ name: '', unit_price: 0, quantity: 1, is_shared: false });

// ── Step 1: capture / upload ──────────────────────────────────
Pages['add-receipt'] = function ({ group_id } = {}) {
  ReceiptFlow.draft     = null;
  ReceiptFlow.imageFile = null;
  ReceiptFlow.groupId   = group_id ? parseInt(group_id) : null;

  setContent(`
    <div class="page-title-bar"><div>
      <h2>Scan Receipt</h2>
      <p>Snap or upload a receipt — QATTAH reads the items, you confirm, friends pick.</p>
    </div></div>

    <div class="card card-p receipt-capture">
      <div class="rc-ai" id="rc-ai"></div>
      <div class="rc-group" id="rc-group"></div>

      <div class="rc-dropzone" id="rc-dropzone">
        <div class="rc-placeholder" id="rc-placeholder">
          <div class="rc-icon">📷</div>
          <p>Take a photo or upload an image of your receipt</p>
        </div>
      </div>

      <div class="rc-pick">
        <label class="btn btn-secondary">
          <input type="file" accept="image/*" capture="environment" id="rc-camera" hidden> 📸 Take Photo
        </label>
        <label class="btn btn-secondary">
          <input type="file" accept="image/*" id="rc-file" hidden> 🖼️ Upload Image
        </label>
      </div>

      <button class="btn btn-primary btn-block" id="rc-process" disabled>Scan Receipt</button>
      <p class="rc-hint">You can fix names, prices and quantities before sharing.</p>
    </div>
  `);

  const onPick = e => {
    const f = e.target.files[0];
    if (!f) return;
    ReceiptFlow.imageFile = f;
    const url = URL.createObjectURL(f);
    $('rc-dropzone').innerHTML = `<img class="rc-preview" src="${url}" alt="receipt preview">`;
    $('rc-process').disabled = false;
  };
  $('rc-camera').addEventListener('change', onPick);
  $('rc-file').addEventListener('change', onPick);
  $('rc-process').addEventListener('click', processReceipt);

  // Show whether AI auto-read is available.
  Api.receipts.aiStatus().then(s => {
    const el = $('rc-ai');
    if (!el) return;
    el.className = `rc-ai ${s.ai_enabled ? 'on' : 'off'}`;
    el.innerHTML = s.ai_enabled
      ? `<span class="rc-ai-dot"></span>🤖 AI auto-read is ON — items are read from your photo`
      : `<span class="rc-ai-dot"></span>⚠️ AI auto-read is off — add an API key in <code>api/config/ai.php</code>, or fill the items in by hand after scanning`;
  }).catch(() => {});

  // Keep the user's groups handy so the confirm popup can file the receipt.
  Api.groups.list().then(gs => {
    ReceiptFlow.groups = gs || [];
    const g = ReceiptFlow.groups.find(x => x.id == ReceiptFlow.groupId);
    const el = $('rc-group');
    if (g && el) {
      el.innerHTML = `<span class="rc-group-chip">👥 Splitting with <strong>${escapeHtml(g.name)}</strong></span>`;
    }
  }).catch(() => {});
};

async function processReceipt() {
  if (!ReceiptFlow.imageFile) { toast('Take or upload a photo first', 'error'); return; }
  const btn = $('rc-process');
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    const fd = new FormData();
    fd.append('receipt', ReceiptFlow.imageFile);
    const data = await Api.receipts.extract(fd);
    if (data.ai_used) toast('Items read from your receipt — please review', 'success');
    else if (data.ai_error) toast('Auto-read failed — check the items below', 'warning');
    startConfirm(data);
  } catch (e) {
    toast(e.message || 'Could not process receipt', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Step 2: item confirmation popup ───────────────────────────
function startConfirm(data) {
  const items = (data.items && data.items.length ? data.items : [blankItem()])
    .map(it => ({
      name      : it.name || '',
      unit_price: Number(it.unit_price) || 0,
      quantity  : Math.max(1, parseInt(it.quantity) || 1),
      is_shared : !!it.is_shared,
    }));
  ReceiptFlow.draft = {
    restaurant_name: data.restaurant_name || '',
    receipt_date   : data.receipt_date || todayISO(),
    receipt_image  : data.receipt_image || null,
    items,
  };
  openConfirmPopup();
}

function groupPickerHtml() {
  if (!ReceiptFlow.groups.length) return '';
  const opts = ReceiptFlow.groups.map(g =>
    `<option value="${g.id}" ${g.id == ReceiptFlow.groupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`
  ).join('');
  return `
    <label class="form-label" style="margin-top:10px">Group (optional)</label>
    <select class="form-control" id="rcp-group">
      <option value="">No group — share by link only</option>
      ${opts}
    </select>`;
}

function openConfirmPopup() {
  let overlay = $('rcp-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'rcp-overlay';
    overlay.className = 'rcp-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="rcp-dialog">
      <div class="rcp-head">
        <h3>Confirm Items</h3>
        <button class="icon-btn" id="rcp-close" style="width:32px;height:32px">✕</button>
      </div>
      <p class="rcp-note">Edit anything the scan got wrong. Tick <strong>Shareable</strong> on
        items the table splits — everyone who picks them pays an equal part.</p>
      <div class="rcp-meta">
        <label class="form-label">Restaurant</label>
        <input class="form-control" id="rcp-rest" placeholder="e.g. Al Baik" value="${escapeHtml(ReceiptFlow.draft.restaurant_name)}">
        <label class="form-label" style="margin-top:10px">Date</label>
        <input class="form-control" id="rcp-date" type="date" value="${escapeHtml(ReceiptFlow.draft.receipt_date)}">
        ${groupPickerHtml()}
      </div>
      <div class="rcp-items" id="rcp-items"></div>
      <button class="btn btn-ghost btn-block" id="rcp-add">+ Add item</button>
      <div class="rcp-total"><span>Total</span><strong id="rcp-grand">SAR 0.00</strong></div>
      <div class="rcp-foot">
        <button class="btn btn-secondary" id="rcp-cancel">Cancel</button>
        <button class="btn btn-primary" id="rcp-confirm">Confirm &amp; Generate Link</button>
      </div>
    </div>`;
  document.body.style.overflow = 'hidden';
  overlay.classList.add('show');

  renderConfirmRows();

  $('rcp-rest').addEventListener('input', e => ReceiptFlow.draft.restaurant_name = e.target.value);
  $('rcp-date').addEventListener('input', e => ReceiptFlow.draft.receipt_date = e.target.value);
  $('rcp-group')?.addEventListener('change', e => {
    ReceiptFlow.groupId = e.target.value ? parseInt(e.target.value) : null;
  });
  $('rcp-add').addEventListener('click', () => {
    ReceiptFlow.draft.items.push(blankItem());
    renderConfirmRows();
  });
  $('rcp-close').addEventListener('click', closeConfirmPopup);
  $('rcp-cancel').addEventListener('click', closeConfirmPopup);
  $('rcp-confirm').addEventListener('click', confirmReceipt);
}

function closeConfirmPopup() {
  const overlay = $('rcp-overlay');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
}

function renderConfirmRows() {
  const wrap = $('rcp-items');
  wrap.innerHTML = ReceiptFlow.draft.items.map((it, i) => `
    <div class="rcp-row${it.is_shared ? ' is-shared' : ''}" data-idx="${i}">
      <div class="rcp-row-top">
        <div class="rcp-row-main">
          <input class="form-control rcp-name" data-idx="${i}" placeholder="Item name" value="${escapeHtml(it.name)}">
          <div class="rcp-price">
            <input class="form-control rcp-pricein" data-idx="${i}" type="number" min="0" step="0.01"
                   inputmode="decimal" placeholder="0.00" value="${it.unit_price || ''}">
            <span class="rcp-cur">SAR</span>
          </div>
        </div>
        <div class="qstep">
          <button class="qstep-btn" data-act="dec" data-idx="${i}">−</button>
          <span class="qstep-val" id="qv-${i}">${it.quantity}</span>
          <button class="qstep-btn" data-act="inc" data-idx="${i}">+</button>
        </div>
      </div>
      <label class="rcp-share">
        <input type="checkbox" class="rcp-sharecb" data-idx="${i}" ${it.is_shared ? 'checked' : ''}>
        <span>Shareable — split between everyone who picks it</span>
      </label>
    </div>`).join('');

  wrap.querySelectorAll('.rcp-name').forEach(el =>
    el.addEventListener('input', e => {
      ReceiptFlow.draft.items[+e.target.dataset.idx].name = e.target.value;
    }));
  wrap.querySelectorAll('.rcp-pricein').forEach(el =>
    el.addEventListener('input', e => {
      ReceiptFlow.draft.items[+e.target.dataset.idx].unit_price = parseFloat(e.target.value) || 0;
      updateGrandTotal();
    }));
  wrap.querySelectorAll('.rcp-sharecb').forEach(el =>
    el.addEventListener('change', e => {
      ReceiptFlow.draft.items[+e.target.dataset.idx].is_shared = e.target.checked;
      e.target.closest('.rcp-row').classList.toggle('is-shared', e.target.checked);
    }));
  wrap.querySelectorAll('.qstep-btn').forEach(el =>
    el.addEventListener('click', e => {
      const i   = +e.currentTarget.dataset.idx;
      const act = e.currentTarget.dataset.act;
      const it  = ReceiptFlow.draft.items[i];
      if (act === 'inc') it.quantity += 1;
      else               it.quantity -= 1;          // spec: 0 removes the item
      if (it.quantity <= 0) {
        ReceiptFlow.draft.items.splice(i, 1);
        if (ReceiptFlow.draft.items.length === 0)
          ReceiptFlow.draft.items.push(blankItem());
        renderConfirmRows();
      } else {
        $(`qv-${i}`).textContent = it.quantity;
      }
      updateGrandTotal();
    }));

  updateGrandTotal();
}

function draftTotal() {
  return ReceiptFlow.draft.items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
}
function updateGrandTotal() {
  const el = $('rcp-grand');
  if (el) el.textContent = fmtCurrency(draftTotal());
}

async function confirmReceipt() {
  const items = ReceiptFlow.draft.items.filter(it => it.name.trim() !== '' && it.quantity >= 1);
  if (items.length === 0) { toast('Add at least one named item', 'error'); return; }

  const btn = $('rcp-confirm');
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    const res = await Api.receipts.create({
      restaurant_name: ReceiptFlow.draft.restaurant_name,
      receipt_date   : ReceiptFlow.draft.receipt_date,
      receipt_image  : ReceiptFlow.draft.receipt_image,
      group_id       : ReceiptFlow.groupId || null,
      items,
    });
    closeConfirmPopup();
    showShareScreen(res);
  } catch (e) {
    toast(e.message || 'Could not create receipt', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Step 3: share (QR + link) ─────────────────────────────────
function shareUrlFor(token) {
  return new URL('receipt.html?t=' + encodeURIComponent(token), window.location.href).href;
}

function showShareScreen(res) {
  const url      = shareUrlFor(res.share_token);
  const groupId  = res.group_id;
  const doneHash = groupId ? `#group-detail?id=${groupId}` : '#dashboard';
  setContent(`
    <div class="page-title-bar"><div>
      <h2>Receipt Ready 🎉</h2>
      <p>${groupId
        ? 'Your group has been notified — they can also scan this code.'
        : 'Share this link or QR code so friends can pick their items.'}</p>
    </div></div>

    <div class="card card-p share-card">
      <div class="share-rest">${escapeHtml(ReceiptFlow.draft?.restaurant_name || 'Receipt')}</div>
      <div class="share-total">${fmtCurrency(res.total)}</div>

      <div class="qr-wrap" id="qr-wrap"><canvas id="qr-canvas"></canvas></div>

      <div class="share-link" id="share-link">${escapeHtml(url)}</div>

      <div class="share-actions">
        <button class="btn btn-secondary" id="copy-link">🔗 Copy Link</button>
        <button class="btn btn-secondary" id="dl-qr">⬇️ Download QR</button>
      </div>
      <a class="btn btn-primary btn-block" href="${url}" target="_blank" rel="noopener">Open Receipt Page</a>
      <button class="btn btn-ghost btn-block" id="rc-done">Done</button>
    </div>
  `);

  renderQR(url);
  $('rc-done').addEventListener('click', () => { window.location.hash = doneHash; });
  $('copy-link').addEventListener('click', () => {
    navigator.clipboard?.writeText(url)
      .then(() => toast('Link copied', 'success'))
      .catch(() => toast('Copy failed — select the link manually', 'error'));
  });
  $('dl-qr').addEventListener('click', () => downloadQR(url));
}

function renderQR(url) {
  if (typeof QRCode === 'undefined') {
    $('qr-wrap').innerHTML = '<p style="color:var(--text-muted);font-size:.8rem">QR library unavailable offline — use the link above.</p>';
    return;
  }
  QRCode.toCanvas($('qr-canvas'), url, { width: 200, margin: 1,
    color: { dark: '#1F2937', light: '#FFFFFF' } }, err => {
    if (err) $('qr-wrap').innerHTML = '<p style="color:var(--danger)">Could not render QR.</p>';
  });
}

function downloadQR(url) {
  if (typeof QRCode === 'undefined') { toast('QR unavailable offline', 'error'); return; }
  QRCode.toDataURL(url, { width: 600, margin: 2 }, (err, dataUrl) => {
    if (err) { toast('Download failed', 'error'); return; }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'qattah-receipt-qr.png';
    a.click();
  });
}
