/**
 * QATTAH — Profile & Settings Page
 */

Pages.profile = function() {
  const u = State.user;
  setContent(`
    <div class="page-content fade-in">
      <!-- Hero -->
      <div class="profile-hero">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar" id="profile-avatar-el">
            ${u.avatar
              ? `<img src="${u.avatar}" alt="${u.name}">`
              : `<span>${initials(u.name)}</span>`}
          </div>
          <div class="avatar-edit-btn" onclick="document.getElementById('avatar-file').click()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <input type="file" id="avatar-file" accept="image/*" class="hidden">
        </div>
        <div class="profile-name">${u.name}</div>
        <div class="profile-email">${u.email}</div>
      </div>

      <!-- Settings list -->
      <div class="settings-list">

        <div class="settings-section-lbl">Account</div>

        <div class="settings-item" onclick="showEditProfile()">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:#D1FAE5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span class="settings-lbl">Edit Profile</span>
          </div>
          <div class="settings-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>
        </div>

        <div class="settings-item" onclick="showChangePassword()">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:#DBEAFE">
              <svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <span class="settings-lbl">Change Password</span>
          </div>
          <div class="settings-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>
        </div>

        <div class="settings-section-lbl">Preferences</div>

        <div class="settings-item">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:#FEF3C7">
              <svg viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </div>
            <span class="settings-lbl">Dark Mode</span>
          </div>
          <button class="toggle ${State.theme==='dark'?'on':''}" id="dark-mode-toggle"></button>
        </div>

        <div class="settings-item">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:#EDE9FE">
              <svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div>
              <div class="settings-lbl">Language</div>
              <div class="settings-val" id="lang-val">${State.lang === 'ar' ? 'العربية' : 'English'}</div>
            </div>
          </div>
          <button class="toggle ${State.lang==='ar'?'on':''}" id="lang-toggle"></button>
        </div>

        <div class="settings-section-lbl">Data</div>

        <div class="settings-item" onclick="Pages.analytics()">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:#D1FAE5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span class="settings-lbl">Analytics</span>
          </div>
          <div class="settings-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>
        </div>

        <div class="settings-item" onclick="Pages.payments()">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:#FEE2E2">
              <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            </div>
            <span class="settings-lbl">Payment History</span>
          </div>
          <div class="settings-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>
        </div>

        ${(State.user && (State.user.email||'').toLowerCase() === 'theowner@gmail.com') ? `
        <div class="settings-section-lbl">Administration</div>
        <div class="settings-item" onclick="window.location.hash='#admin'" style="cursor:pointer">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:var(--primary-light)">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.4 7.7 8 9 4.6-1.3 8-4 8-9V5l-8-3z"/></svg>
            </div>
            <span class="settings-lbl">Owner Dashboard</span>
          </div>
          <div class="settings-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>
        </div>` : ''}

        <div class="settings-section-lbl">Support</div>

        <div class="settings-item" onclick="showAbout()">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:var(--bg-input)">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </div>
            <span class="settings-lbl">About QATTAH</span>
          </div>
          <div class="settings-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></div>
        </div>

        <div class="settings-item" onclick="confirmLogout()" style="cursor:pointer">
          <div class="settings-item-left">
            <div class="settings-icon" style="background:#FEE2E2">
              <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </div>
            <span class="settings-lbl" style="color:var(--danger)">Logout</span>
          </div>
        </div>

        <div style="height:8px"></div>
      </div>
    </div>
  `);

  // Dark mode toggle
  document.getElementById('dark-mode-toggle').addEventListener('click', function() {
    const newTheme = State.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    this.classList.toggle('on', newTheme === 'dark');
    // Persist to server
    Api.auth.update({ theme: newTheme }).catch(() => {});
  });

  // Language toggle
  document.getElementById('lang-toggle').addEventListener('click', function() {
    const newLang = State.lang === 'ar' ? 'en' : 'ar';
    applyLang(newLang);
    this.classList.toggle('on', newLang === 'ar');
    document.getElementById('lang-val').textContent = newLang === 'ar' ? 'العربية' : 'English';
    Api.auth.update({ language: newLang }).catch(() => {});
  });
};

// ── Payment history page ──────────────────────────────────────
Pages.payments = async function() {
  showLoading();
  try {
    const payments = await Api.payments.list();
    setContent(`
      <div class="page-content fade-in">
        <div style="padding:16px;display:flex;align-items:center;gap:12px">
          <button class="icon-btn" onclick="window.location.hash='#profile'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h2 style="font-size:1.25rem;font-weight:800">Payment History</h2>
        </div>
        ${payments.length === 0
          ? `<div class="empty-state"><div class="empty-emoji">💸</div><h3>No payments yet</h3></div>`
          : `<div class="card-p stagger" style="padding:0 16px">
              ${payments.map(p => {
                const sent = p.from_id === State.user.id;
                return `
                  <div class="payment-item">
                    <div class="person-avatar" style="background:${sent?'#FEE2E2':'#D1FAE5'};color:${sent?'#DC2626':'#059669'}">
                      ${sent ? '↑' : '↓'}
                    </div>
                    <div style="flex:1">
                      <div style="font-size:.9375rem;font-weight:600">${sent ? p.to_name : p.from_name}</div>
                      <div style="font-size:.775rem;color:var(--text-muted)">${p.bill_title ? `For: ${p.bill_title}` : (p.note||'Direct payment')} · ${fmtDate(p.payment_date)}</div>
                    </div>
                    <div class="${sent?'text-danger':'text-success'}" style="font-weight:700">
                      ${sent?'-':'+'} ${fmtCurrency(p.amount)}
                    </div>
                  </div>`;
              }).join('')}
            </div>`}
      </div>
    `);
  } catch(e) {
    setContent(`<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`);
  }
};

// ── Edit profile ──────────────────────────────────────────────
window.showEditProfile = () => {
  const u = State.user;
  Modal.open('Edit Profile', `
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input class="form-control" id="ep-name" value="${u.name}">
    </div>
    <div class="form-group">
      <label class="form-label">Phone</label>
      <input class="form-control" id="ep-phone" type="tel" value="${u.phone||''}">
    </div>
    <div class="form-group">
      <label class="form-label">Bio</label>
      <textarea class="form-control" id="ep-bio" rows="2">${u.bio||''}</textarea>
    </div>
  `, [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Save', cls:'btn-primary', onClick: async () => {
      const name  = document.getElementById('ep-name').value.trim();
      const phone = document.getElementById('ep-phone').value.trim();
      const bio   = document.getElementById('ep-bio').value.trim();
      if (!name) { toast('Name is required','error'); return; }
      try {
        await Api.auth.update({ name, phone, bio });
        State.user.name = name; State.user.phone = phone; State.user.bio = bio;
        Modal.close(); toast('Profile updated!', 'success');
        const hi = document.getElementById('header-initials');
        if (hi) hi.textContent = initials(name);
        Pages.profile();
      } catch(e) { toast(e.message,'error'); }
    }}
  ]);
};

window.showChangePassword = () => {
  Modal.open('Change Password', `
    <div class="form-group">
      <label class="form-label">Current Password</label>
      <input class="form-control" id="pw-old" type="password" placeholder="••••••••">
    </div>
    <div class="form-group">
      <label class="form-label">New Password</label>
      <input class="form-control" id="pw-new" type="password" placeholder="Min. 6 characters">
    </div>
    <div class="form-group">
      <label class="form-label">Confirm New Password</label>
      <input class="form-control" id="pw-confirm" type="password" placeholder="••••••••">
    </div>
  `, [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Change Password', cls:'btn-primary', onClick: async () => {
      const oldPw = document.getElementById('pw-old').value;
      const newPw = document.getElementById('pw-new').value;
      const conf  = document.getElementById('pw-confirm').value;
      if (!oldPw || !newPw) { toast('All fields required','error'); return; }
      if (newPw !== conf)   { toast('Passwords do not match','error'); return; }
      if (newPw.length < 6) { toast('Min. 6 characters','error'); return; }
      try {
        await Api.auth.update({ password: newPw, old_password: oldPw });
        Modal.close(); toast('Password changed!', 'success');
      } catch(e) { toast(e.message,'error'); }
    }}
  ]);
};

window.confirmLogout = () => {
  Modal.open('Logout', '<p>Are you sure you want to logout?</p>', [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Logout', cls:'btn-danger', onClick: async () => {
      await Api.auth.logout();
      window.location.href = 'login.html';
    }}
  ]);
};

window.showAbout = () => {
  Modal.open('About QATTAH', `
    <div style="text-align:center;padding:16px 0">
      <div style="width:72px;height:72px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));border-radius:22px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      </div>
      <div style="font-size:1.5rem;font-weight:900;color:var(--primary);letter-spacing:2px">QATTAH</div>
      <div style="color:var(--text-muted);margin-top:6px;font-size:.875rem">Split bills with friends, effortlessly.</div>
      <div style="color:var(--text-light);margin-top:20px;font-size:.775rem">Version 1.0.0</div>
    </div>
  `, [{ label:'Close', cls:'btn-secondary btn-block', onClick: Modal.close }]);
};
