/**
 * QATTAH — Groups Page
 */

Pages.groups = async function() {
  showLoading();
  try {
    const groups = await Api.groups.list();

    setContent(`
      <div class="page-content fade-in">
        <div class="page-title-bar">
          <div><h2>${t('groups')}</h2><p>${groups.length} groups</p></div>
        </div>

        <div class="groups-grid stagger">
          ${groups.map(renderGroupCard).join('')}
          <div class="group-card group-card-add card-interactive" onclick="showCreateGroup()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
            <span>New Group</span>
          </div>
        </div>
      </div>
    `);

    document.querySelectorAll('.group-card[data-group-id]').forEach(el => {
      el.addEventListener('click', () => {
        window.location.hash = `#group-detail?id=${el.dataset.groupId}`;
      });
    });

  } catch(e) {
    setContent(`<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`);
  }
};

function renderGroupCard(g) {
  const bal = g.owe_me - g.i_owe;
  const balClass  = bal > 0 ? 'positive' : bal < 0 ? 'negative' : 'neutral';
  const balLabel  = bal > 0 ? `+${fmtCurrency(bal)}` : bal < 0 ? `-${fmtCurrency(Math.abs(bal))}` : 'Settled';
  const emojis    = ['🏠','🍕','✈️','🎮','🛒','🎓','💼','🌴','🎉','⚽'];
  const emoji     = emojis[g.id % emojis.length];

  return `
    <div class="group-card card-interactive" data-group-id="${g.id}">
      <span class="group-emoji">${emoji}</span>
      <div class="group-name">${g.name}</div>
      <div class="group-meta">${g.member_count} members · ${g.bill_count} bills</div>
      <div class="group-balance ${balClass}">${balLabel}</div>
    </div>`;
}

// ── Group Detail ──────────────────────────────────────────────
Pages['group-detail'] = async function({ id } = {}) {
  if (!id) { window.location.hash = '#groups'; return; }
  showLoading();
  try {
    const g = await Api.groups.get(id);
    const isAdmin = g.my_role === 'admin';

    setContent(`
      <div class="page-content fade-in">
        <div style="padding:16px;display:flex;align-items:center;gap:12px">
          <button class="icon-btn" onclick="window.location.hash='#groups'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h2 style="font-size:1.25rem;font-weight:800">${g.name}</h2>
          ${isAdmin ? `
            <div style="margin-left:auto;display:flex;gap:6px">
              <button class="btn btn-secondary" style="padding:7px 12px;font-size:.8rem" onclick="editGroup(${g.id},'${g.name.replace(/'/g,"\\'")}','${(g.description||'').replace(/'/g,"\\'")}')">Edit</button>
              <button class="btn btn-danger"    style="padding:7px 12px;font-size:.8rem" onclick="deleteGroup(${g.id})">Delete</button>
            </div>` : ''}
        </div>

        ${g.description ? `<p style="padding:0 16px 12px;color:var(--text-muted);font-size:.875rem">${g.description}</p>` : ''}

        <!-- Members -->
        <div class="section-header">
          <span class="section-title">Members (${g.members.length})</span>
          ${isAdmin ? `<button class="section-link" onclick="showAddMember(${g.id})">+ Add</button>` : ''}
        </div>
        <div class="people-list px-4">
          ${g.members.map(m => `
            <div class="person-row">
              <div class="person-avatar">${initials(m.name)}</div>
              <div style="flex:1">
                <div class="person-name">${m.name}${m.id==State.user.id?' (You)':''}</div>
                <div style="font-size:.75rem;color:var(--text-muted);text-transform:capitalize">${m.role}</div>
              </div>
              ${isAdmin && m.id != State.user.id
                ? `<button class="settle-btn" style="background:#FEE2E2;color:#DC2626" onclick="removeMember(${g.id},${m.id},'${m.name.replace(/'/g,"\\'")}')">Remove</button>`
                : ''}
            </div>`).join('')}
        </div>

        <!-- Bills -->
        <div class="section-header">
          <span class="section-title">Bills (${g.bills.length})</span>
          <button class="section-link" onclick="window.location.hash='#add-bill'">+ Add Bill</button>
        </div>
        ${g.bills.length === 0
          ? `<div class="empty-state" style="padding:24px"><div class="empty-emoji">🧾</div><p>No bills yet</p></div>`
          : `<div class="bills-list stagger">${g.bills.map(renderBillItem).join('')}</div>`}
      </div>
    `);

    attachBillClicks();

  } catch(e) {
    setContent(`<div class="empty-state"><div class="empty-emoji">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`);
  }
};

// ── Create group modal ────────────────────────────────────────
window.showCreateGroup = () => {
  Modal.open('New Group', `
    <div class="form-group">
      <label class="form-label">Group Name <span class="req">*</span></label>
      <input class="form-control" id="grp-name" placeholder="e.g. Apartment Mates" required>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-control" id="grp-desc" placeholder="Optional description">
    </div>
  `, [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Create Group', cls:'btn-primary', onClick: async () => {
      const name = document.getElementById('grp-name').value.trim();
      const desc = document.getElementById('grp-desc').value.trim();
      if (!name) { toast('Group name is required','error'); return; }
      try {
        await Api.groups.create({ name, description: desc });
        Modal.close();
        toast('Group created!', 'success');
        Pages.groups();
      } catch(e) { toast(e.message,'error'); }
    }}
  ]);
};

window.editGroup = (id, name, description) => {
  Modal.open('Edit Group', `
    <div class="form-group">
      <label class="form-label">Group Name</label>
      <input class="form-control" id="egrp-name" value="${name}">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <input class="form-control" id="egrp-desc" value="${description}">
    </div>
  `, [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Save', cls:'btn-primary', onClick: async () => {
      const newName = document.getElementById('egrp-name').value.trim();
      const newDesc = document.getElementById('egrp-desc').value.trim();
      if (!newName) { toast('Name required','error'); return; }
      try {
        await Api.groups.update(id, { name: newName, description: newDesc });
        Modal.close(); toast('Group updated!','success');
        Pages['group-detail']({ id });
      } catch(e) { toast(e.message,'error'); }
    }}
  ]);
};

window.deleteGroup = (id) => {
  Modal.open('Delete Group', '<p>Delete this group and all its data? This cannot be undone.</p>', [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Delete', cls:'btn-danger', onClick: async () => {
      try {
        await Api.groups.remove(id);
        Modal.close(); toast('Group deleted','success');
        window.location.hash = '#groups';
      } catch(e) { toast(e.message,'error'); }
    }}
  ]);
};

window.showAddMember = (groupId) => {
  Modal.open('Add Member', `
    <div class="form-group">
      <label class="form-label">Search by name or email</label>
      <div class="input-wrap">
        <div class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
        <input class="form-control" id="member-search" placeholder="Type to search…">
      </div>
    </div>
    <div id="member-search-results"></div>
  `, [
    { label:'Close', cls:'btn-secondary', onClick: Modal.close }
  ]);

  let timer;
  document.getElementById('member-search').addEventListener('input', async e => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (q.length < 2) { document.getElementById('member-search-results').innerHTML=''; return; }
    timer = setTimeout(async () => {
      try {
        const users = await Api.users.search(q);
        document.getElementById('member-search-results').innerHTML = users.map(u => `
          <div class="participant-result" onclick="addMemberToGroup(${groupId},${u.id},'${u.name.replace(/'/g,"\\'")}')">
            <div class="person-avatar" style="width:32px;height:32px;font-size:.75rem">${initials(u.name)}</div>
            <div>
              <div style="font-size:.875rem;font-weight:600">${u.name}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${u.email}</div>
            </div>
            <button class="btn btn-primary" style="padding:6px 12px;font-size:.8rem">Add</button>
          </div>`).join('');
      } catch(_){}
    }, 350);
  });
};

window.addMemberToGroup = async (groupId, userId, name) => {
  try {
    await Api.groups.addMember(groupId, userId);
    toast(`${name} added to group!`, 'success');
    Modal.close();
    Pages['group-detail']({ id: groupId });
  } catch(e) { toast(e.message,'error'); }
};

window.removeMember = (groupId, userId, name) => {
  Modal.open('Remove Member', `<p>Remove ${name} from this group?</p>`, [
    { label:'Cancel', cls:'btn-secondary', onClick: Modal.close },
    { label:'Remove', cls:'btn-danger', onClick: async () => {
      try {
        await Api.groups.removeMember(groupId, userId);
        Modal.close(); toast(`${name} removed`,'success');
        Pages['group-detail']({ id: groupId });
      } catch(e) { toast(e.message,'error'); }
    }}
  ]);
};
