/**
 * QATTAH — Main Application
 * SPA router, state management, global utilities.
 */

// ── Global state ─────────────────────────────────────────────
const State = {
  user      : null,
  lang      : localStorage.getItem('lang') || 'en',
  theme     : localStorage.getItem('theme') || 'light',
  categories: [],
};

// ── Translations ─────────────────────────────────────────────
const i18n = {
  en: {
    dashboard:'Dashboard', bills:'Bills', groups:'Groups',
    profile:'Profile', analytics:'Analytics',
    add_bill:'Add Bill', save:'Save', cancel:'Cancel', delete:'Delete',
    edit:'Edit', settle:'Settle', loading:'Loading...',
    no_bills:'No bills yet', no_groups:'No groups yet',
    owe_me:'Owe Me', i_owe:'I Owe', net:'Net Balance',
    total_spent:'Total Spent', bill_count:'Bills', group_count:'Groups',
    logout:'Logout', settings:'Settings', theme:'Theme', language:'Language',
    dark:'Dark', light:'Light', english:'English', arabic:'Arabic',
    search:'Search bills…', all:'All', food:'Food', transport:'Transport',
    mark_paid:'Mark as Paid', amount:'Amount', date:'Date', category:'Category',
    split_equal:'Split Equally', split_custom:'Custom Amounts',
    participants:'Participants', receipt:'Receipt (optional)',
    bill_title:'Bill Title', group_name:'Group Name', members:'Members',
    add_member:'Add Member', remove:'Remove', created:'Created',
    welcome:'Welcome back', total_balance:'Total Balance',
    you_lent:'You lent', you_borrowed:'You borrowed',
    recent_bills:'Recent Bills', see_all:'See All',
    who_owes_me:"Who Owes Me", i_owe_lbl:"I Owe",
  },
  ar: {
    dashboard:'الرئيسية', bills:'الفواتير', groups:'المجموعات',
    profile:'الملف الشخصي', analytics:'التحليلات',
    add_bill:'إضافة فاتورة', save:'حفظ', cancel:'إلغاء', delete:'حذف',
    edit:'تعديل', settle:'تسوية', loading:'جاري التحميل...',
    no_bills:'لا توجد فواتير', no_groups:'لا توجد مجموعات',
    owe_me:'مديونون لي', i_owe:'مديون لهم', net:'الرصيد الصافي',
    total_spent:'إجمالي الإنفاق', bill_count:'الفواتير', group_count:'المجموعات',
    logout:'تسجيل الخروج', settings:'الإعدادات', theme:'المظهر', language:'اللغة',
    dark:'داكن', light:'فاتح', english:'الإنجليزية', arabic:'العربية',
    search:'ابحث في الفواتير…', all:'الكل', food:'طعام', transport:'مواصلات',
    mark_paid:'تمييز كمدفوع', amount:'المبلغ', date:'التاريخ', category:'الفئة',
    split_equal:'تقسيم متساوٍ', split_custom:'مبالغ مخصصة',
    participants:'المشاركون', receipt:'الإيصال (اختياري)',
    bill_title:'عنوان الفاتورة', group_name:'اسم المجموعة', members:'الأعضاء',
    add_member:'إضافة عضو', remove:'إزالة', created:'تم الإنشاء',
    welcome:'مرحباً بعودتك', total_balance:'الرصيد الإجمالي',
    you_lent:'أقرضت', you_borrowed:'اقترضت',
    recent_bills:'آخر الفواتير', see_all:'عرض الكل',
    who_owes_me:"من يدين لي", i_owe_lbl:"أنا مدين",
  }
};
const t = key => (i18n[State.lang] || i18n.en)[key] || key;

// ── DOM helpers ───────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function setContent(html) {
  $('page-content').innerHTML = html;
}

function showLoading() {
  setContent('<div class="loading-center"><div class="spinner"></div></div>');
}

// ── Toast notifications ───────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const area = $('toast-area');
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${msg}</span>`;
  area.appendChild(el);
  setTimeout(() => {
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 350);
  }, duration);
}

// ── Theme ─────────────────────────────────────────────────────
function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = $('theme-btn');
  if (btn) btn.querySelector('svg').innerHTML = theme === 'dark'
    ? '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" stroke="currentColor" stroke-width="2" fill="none"/>'
    : '<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/>';
}

function applyLang(lang) {
  State.lang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  refreshNavLabels();
}

function refreshNavLabels() {
  $$('.nav-item[data-page]').forEach(btn => {
    const page = btn.dataset.page;
    const lbl  = btn.querySelector('.nav-lbl');
    if (lbl && t(page)) lbl.textContent = t(page);
  });
}

// ── Format helpers ────────────────────────────────────────────
function fmtCurrency(n, currency = 'SAR') {
  return `${currency} ${parseFloat(n || 0).toLocaleString('en-SA', {minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(State.lang === 'ar' ? 'ar-SA' : 'en-US',
    {year:'numeric',month:'short',day:'numeric'});
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function initials(name = '') {
  return name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
}

function avatarEl(name, avatar, size = 40) {
  if (avatar) return `<img src="${avatar}" alt="${name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
  const colors = ['#10B981','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#06B6D4'];
  const color  = colors[name.charCodeAt(0) % colors.length];
  return `<div class="person-avatar" style="background:${color};width:${size}px;height:${size}px">${initials(name)}</div>`;
}

// ── Router ────────────────────────────────────────────────────
const Pages = {};

function navigate(page, params = {}) {
  const handler = Pages[page];
  if (!handler) return;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  handler(params);
  window.scrollTo(0, 0);
}

function currentPage() {
  return window.location.hash.slice(1).split('?')[0] || 'dashboard';
}

/** Query params in the current hash — so a deep link survives a reload. */
function currentParams() {
  return Object.fromEntries(
    new URLSearchParams(window.location.hash.slice(1).split('?')[1] || ''));
}

window.addEventListener('hashchange', () => {
  const hash   = window.location.hash.slice(1);
  const [page] = hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(hash.split('?')[1] || ''));
  navigate(page || 'dashboard', params);
});

// ── Modal system ──────────────────────────────────────────────
const Modal = {
  open(title, bodyHtml, actions = []) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML    = bodyHtml;
    const footer = $('modal-footer');
    footer.innerHTML = '';
    actions.forEach(({ label, cls, id, onClick }) => {
      const btn = document.createElement('button');
      btn.className   = `btn ${cls || 'btn-secondary'}`;
      btn.textContent = label;
      if (id) btn.id  = id;
      if (onClick) btn.addEventListener('click', onClick);
      footer.appendChild(btn);
    });
    $('modal-overlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  },
  close() {
    $('modal-overlay').classList.remove('show');
    document.body.style.overflow = '';
  }
};

// ── Notification badge ────────────────────────────────────────
async function refreshNotifBadge() {
  try {
    const data = await Api.notifications.list();
    const badge = $('notif-badge');
    if (badge) {
      badge.dataset.count = data.unread_count;
      badge.textContent   = data.unread_count || '';
    }
    return data;
  } catch (_) {}
}

function renderNotifPanel(data) {
  const panel = $('notif-panel');
  const list  = data?.notifications || [];
  panel.querySelector('.notif-list').innerHTML = list.length === 0
    ? `<div class="empty-state" style="padding:24px"><div class="empty-emoji">🔔</div><p>No notifications</p></div>`
    : list.map(n => `
      <div class="notif-item ${n.is_read ? 'read' : 'unread'}" onclick="markNotifRead(${n.id},this)">
        <div class="notif-dot"></div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>`).join('');
}

window.markNotifRead = async (id, el) => {
  el.closest('.notif-item').classList.remove('unread');
  el.closest('.notif-item').classList.add('read');
  el.querySelector('.notif-dot').style.opacity = '0';
  await Api.notifications.markRead(id);
  refreshNotifBadge();
};

// ── App initialisation ────────────────────────────────────────
async function initApp() {
  applyTheme(State.theme);
  applyLang(State.lang);

  // Show splash
  const splash = $('splash');

  try {
    State.user = await Api.auth.me();
    State.categories = await Api.categories.list();
  } catch (e) {
    // Not logged in
    window.location.href = 'login.html';
    return;
  }

  // Update header avatar
  const hi = $('header-initials');
  if (hi) hi.textContent = initials(State.user.name);

  // Hide splash, show app
  setTimeout(() => {
    if (splash) splash.classList.add('hide');
    $('app').classList.remove('hidden');
    navigate(currentPage(), currentParams());
    refreshNotifBadge();
    setInterval(refreshNotifBadge, 30000);
  }, 1200);

  // Event: theme toggle
  $('theme-btn')?.addEventListener('click', () =>
    applyTheme(State.theme === 'dark' ? 'light' : 'dark'));

  // Event: notification toggle
  $('notif-btn')?.addEventListener('click', async () => {
    const panel = $('notif-panel');
    const isOpen = panel.classList.contains('show');
    if (isOpen) { panel.classList.remove('show'); return; }
    const data = await refreshNotifBadge();
    renderNotifPanel(data);
    panel.classList.add('show');
  });

  // Mark all read
  $('notif-read-all')?.addEventListener('click', async () => {
    await Api.notifications.markRead(null);
    $$('.notif-item').forEach(el => {
      el.classList.remove('unread'); el.classList.add('read');
      el.querySelector('.notif-dot').style.opacity = '0';
    });
    refreshNotifBadge();
  });

  // Close notif panel on outside click
  document.addEventListener('click', e => {
    const panel = $('notif-panel');
    const btn   = $('notif-btn');
    if (panel?.classList.contains('show') &&
        !panel.contains(e.target) && !btn?.contains(e.target)) {
      panel.classList.remove('show');
    }
  });

  // Close modal on overlay click
  $('modal-overlay')?.addEventListener('click', e => {
    if (e.target === $('modal-overlay')) Modal.close();
  });

  // FAB → scan a receipt (the only way to start a split)
  $('fab-btn')?.addEventListener('click', () => {
    window.location.hash = '#add-receipt';
  });

  // Bottom nav
  $$('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `#${btn.dataset.page}`;
    });
  });
}

document.addEventListener('DOMContentLoaded', initApp);
