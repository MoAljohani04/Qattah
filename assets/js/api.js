/**
 * QATTAH — API Client
 * Thin wrapper around fetch that targets the PHP backend.
 */
const API_BASE = 'api';

const Api = {
  /** Core request method */
  async request(method, endpoint, data = null, isFormData = false) {
    const opts = {
      method,
      credentials: 'include',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    };
    if (data && method !== 'GET') {
      opts.body = isFormData ? data : JSON.stringify(data);
    }
    try {
      const res  = await fetch(`${API_BASE}/${endpoint}`, opts);
      const json = await res.json();
      if (!json.success) {
        // 401 = session expired → redirect to login
        if (res.status === 401) {
          window.location.href = 'login.html';
        }
        throw new Error(json.message || 'Request failed');
      }
      return json.data;
    } catch (err) {
      if (err.name === 'TypeError') throw new Error('Network error — check your connection');
      throw err;
    }
  },

  get   : (ep, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return Api.request('GET', q ? `${ep}?${q}` : ep);
  },
  post  : (ep, data)      => Api.request('POST',   ep, data),
  put   : (ep, data)      => Api.request('PUT',    ep, data),
  del   : (ep, data)      => Api.request('DELETE', ep, data),

  // ── Named helpers ──────────────────────────────────────────
  auth: {
    login    : d  => Api.post('auth/login.php', d),
    register : d  => Api.post('auth/register.php', d),
    logout   : () => Api.post('auth/logout.php'),
    me       : () => Api.get ('auth/me.php'),
    update   : d  => Api.put ('auth/me.php', d),
  },
  dashboard: {
    get: () => Api.get('dashboard/index.php'),
  },
  bills: {
    list    : p  => Api.get ('bills/index.php', p),
    create  : d  => Api.post('bills/index.php', d),
    get     : id => Api.get (`bills/show.php?id=${id}`),
    update  : (id, d) => Api.put(`bills/show.php?id=${id}`, d),
    remove  : id => Api.del (`bills/show.php?id=${id}`),
    settle  : d  => Api.post('bills/settle.php', d),
  },
  groups: {
    list        : ()     => Api.get ('groups/index.php'),
    create      : d      => Api.post('groups/index.php', d),
    get         : id     => Api.get (`groups/show.php?id=${id}`),
    update      : (id,d) => Api.put (`groups/show.php?id=${id}`, d),
    remove      : id     => Api.del (`groups/show.php?id=${id}`),
    addMember   : (gid,uid)=> Api.post(`groups/members.php?group_id=${gid}`, {user_id:uid}),
    removeMember: (gid,uid)=> Api.del(`groups/members.php?group_id=${gid}`, {user_id:uid}),
  },
  payments: {
    list  : () => Api.get ('payments/index.php'),
    record: d  => Api.post('payments/index.php', d),
  },
  notifications: {
    list    : ()  => Api.get('notifications/index.php'),
    markRead: (id)=> Api.put('notifications/index.php', id ? {id} : {}),
  },
  analytics: {
    get: (year) => Api.get('analytics/index.php', year ? {year} : {}),
  },
  categories: {
    list: () => Api.get('categories/index.php'),
  },
  users: {
    search: q => Api.get('users/search.php', {q}),
  },
  upload: {
    receipt: fd => Api.request('POST', 'upload/receipt.php', fd, true),
  },
  receipts: {
    list   : ()      => Api.get ('receipts/index.php'),
    create : d       => Api.post('receipts/index.php', d),
    extract: fd      => Api.request('POST', 'receipts/extract.php', fd, true),
    get    : token   => Api.get ('receipts/show.php', { token }),
    claim  : d       => Api.post('receipts/claim.php', d),
    pay    : d       => Api.post('receipts/pay.php', d),
    aiStatus: ()     => Api.get ('receipts/ai-status.php'),
  },
  admin: {
    overview     : ()       => Api.get('admin/overview.php'),
    analytics    : ()       => Api.get('admin/analytics.php'),
    receipts     : ()       => Api.get('admin/receipts.php'),
    setReceipt   : (id, s)  => Api.put(`admin/receipts.php?id=${id}`, { status: s }),
    deleteReceipt: (id)     => Api.del(`admin/receipts.php?id=${id}`),
    users        : ()       => Api.get('admin/users.php'),
    setUserActive: (id, a)  => Api.put(`admin/users.php?id=${id}`, { is_active: a }),
    settings     : ()       => Api.get('admin/settings.php'),
    saveSettings : d        => Api.put('admin/settings.php', d),
  },
};
