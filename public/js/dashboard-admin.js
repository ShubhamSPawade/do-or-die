/* =========================================================
   ADMIN DASHBOARD
   Globals used: state, stateOwner, me, adminUsers,
                 viewingEmail, editingTaskId, emailSettings
                 (all declared in app.js)
========================================================= */
function renderAdminDashboard(){
  const now = new Date();
  const today = formatYMD(now);
  const todayS = dayStats(today);
  const ms = monthStats(now.getFullYear(), now.getMonth());
  const { current } = computeStreaks();
  const score = accountabilityScore();
  const sevenDay = last7Average();
  const subject = adminUsers.find(u => u.email === viewingEmail);

  const taskDefs = state.tasks.length === 0
    ? `<p style="color:var(--gray-3); font-style:italic; font-family:var(--font-display);">No tasks defined yet.</p>`
    : state.tasks.slice().reverse().map(t => {
        if(t.id === editingTaskId){
          return `
          <div class="task-def-row" style="flex-direction:column; align-items:stretch; gap:10px;">
            <div class="field" style="margin-bottom:0;">
              <label for="edit-name">Task Name</label>
              <input type="text" id="edit-name" value="${escapeHtml(t.name)}">
            </div>
            <div class="field" style="margin-bottom:0;">
              <label for="edit-time">Expected Time</label>
              <input type="text" id="edit-time" value="${escapeHtml(t.timeLabel)}">
            </div>
            <div class="field" style="margin-bottom:0;">
              <label>Importance</label>
              ${segHtml('edit-importance-seg', t.importance)}
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-filled btn-sm" data-action="save-edit" data-id="${t.id}">Save</button>
              <button class="btn btn-ghost btn-sm" data-action="cancel-edit">Cancel</button>
            </div>
          </div>`;
        }
        return `
          <div class="task-def-row">
            <div>
              <strong>${escapeHtml(t.name)}</strong>
              <div style="color:var(--gray-4); font-size:10px; margin-top:2px; text-transform:uppercase; letter-spacing:.06em;">${escapeHtml(t.timeLabel)} · since ${prettyDateLong(t.createdDate)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${importanceBadge(t.importance)}
              <button class="btn btn-sm" data-action="edit" data-id="${t.id}">Edit</button>
              <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${t.id}">Delete</button>
            </div>
          </div>`;
      }).join('');

  const subjectOptions = adminUsers.map(u =>
    `<option value="${escapeHtml(u.email)}"${u.email === viewingEmail ? ' selected' : ''}>${escapeHtml(u.name)} (${u.role})</option>`
  ).join('');

  const html = `
    <div class="case-box case-box-pad">
      <div class="admin-tag">Case File</div>
      <div class="section-title" style="font-size:20px;">${escapeHtml(subject ? subject.name : 'Subject')}</div>
      <div class="section-sub">Subject under observation</div>

      <div class="field">
        <label for="subject-select">Subject</label>
        <select id="subject-select">${subjectOptions}</select>
      </div>

      <div class="stat-grid">
        <div class="stat-cell"><div class="eyebrow">Today</div><div class="big-num">${todayS.total ? todayS.pct + '%' : '-'}</div><div class="stat-note">${todayS.completed}/${todayS.total} tasks</div></div>
        <div class="stat-cell"><div class="eyebrow">7-Day Average</div><div class="big-num">${sevenDay}%</div></div>
        <div class="stat-cell"><div class="eyebrow">Month</div><div class="big-num">${ms.avgCompletion}%</div><div class="stat-note">verdict: ${ms.verdict}</div></div>
        <div class="stat-cell"><div class="eyebrow">Current Streak</div><div class="big-num">${current} <span style="font-size:11px;">DAYS</span></div></div>
        <div class="stat-cell"><div class="eyebrow">Missed (Month)</div><div class="big-num">${ms.tasksMissed}</div><div class="stat-note">tasks</div></div>
        <div class="stat-cell"><div class="eyebrow">Accountability</div><div class="big-num">${score.score}<span style="font-size:11px;"> /100</span></div><div class="stat-note">${score.label}</div></div>
      </div>
    </div>

    <div class="case-box case-box-pad" id="admin-chart-holder">
      ${renderContributionChart(now.getFullYear(), now.getMonth())}
      <div class="lock-note">tap a day to inspect it.</div>
    </div>

    <div class="case-box case-box-pad">
      <div class="section-title">Assign a Task</div>
      <div class="section-sub">Applies from today onward - history stays untouched.</div>
      <div class="field">
        <label for="task-name">Task Name</label>
        <input type="text" id="task-name" placeholder="e.g. Revise DSA">
      </div>
      <div class="field">
        <label for="task-time">Expected Time</label>
        <input type="text" id="task-time" placeholder="e.g. 2 hours">
      </div>
      <div class="field">
        <label>Importance</label>
        ${segHtml('importance-seg', 'MEDIUM')}
      </div>
      <button class="btn btn-filled btn-block" id="add-task-btn">Add Task</button>
      <div class="error-text hidden" id="task-error">Enter a task name and expected time.</div>
    </div>

    <div class="case-box case-box-pad">
      <div class="section-title">Today's Tasks</div>
      <div class="section-sub">${prettyDateLong(today)}</div>
      ${todayS.total === 0 ? '<p style="color:var(--gray-3); font-style:italic; font-family:var(--font-display);">Nothing assigned for today.</p>' :
        tasksForDate(today).map(t => {
          const rec = state.dailyProgress[today];
          const done = rec && rec.statuses[t.id] === true;
          return `<div class="task-def-row"><span>${escapeHtml(t.name)}</span><span style="font-weight:700;">${done ? 'DONE' : 'PENDING'}</span></div>`;
        }).join('')
      }
    </div>

    <div class="case-box case-box-pad">
      <div class="section-title">All Tasks Defined</div>
      <div class="section-sub">Edits and deletions apply to the whole ledger.</div>
      ${taskDefs}
    </div>

    <div class="case-box case-box-pad">
      <div class="section-title">Email Schedule</div>
      <div class="section-sub">Daily task email &amp; evening summary - sent via Apps Script.</div>
      <div style="display:flex; gap:12px;">
        <div class="field" style="flex:1; margin-bottom:0;">
          <label for="morning-hour">Morning Hour (0–23)</label>
          <input type="number" id="morning-hour" min="0" max="23" value="${emailSettings.morning_hour}">
        </div>
        <div class="field" style="flex:1; margin-bottom:0;">
          <label for="evening-hour">Evening Hour (0–23)</label>
          <input type="number" id="evening-hour" min="0" max="23" value="${emailSettings.evening_hour}">
        </div>
      </div>
      <button class="btn btn-filled btn-block" id="save-schedule-btn" style="margin-top:12px;">Save Schedule</button>
      <div class="lock-note hidden" id="schedule-success"></div>
    </div>

    <div class="case-box case-box-pad">
      <div class="section-title">Create User</div>
      <div class="section-sub">New accounts can sign in immediately.</div>
      <div class="field">
        <label for="new-name">Display Name</label>
        <input type="text" id="new-name" placeholder="e.g. Rahul">
      </div>
      <div class="field">
        <label for="new-email">Email</label>
        <input type="email" id="new-email" placeholder="rahul@doordie.app" autocomplete="off">
      </div>
      <div class="field">
        <label for="new-password">Password</label>
        <input type="password" id="new-password" placeholder="min 4 characters" autocomplete="new-password">
      </div>
      <div class="field">
        <label>Role</label>
        <div class="seg" id="role-seg">
          <button type="button" class="seg-btn active" data-val="USER">User</button>
          <button type="button" class="seg-btn" data-val="ADMIN">Admin</button>
        </div>
      </div>
      <button class="btn btn-filled btn-block" id="create-user-btn">Create User</button>
      <div class="error-text hidden" id="user-error"></div>
      <div class="lock-note hidden" id="user-success"></div>
    </div>
  `;

  const view = document.getElementById('admin-view');
  view.innerHTML = html;

  // subject switcher
  view.querySelector('#subject-select').addEventListener('change', async e => {
    viewingEmail = e.target.value;
    editingTaskId = null;
    try{
      state = await fetchState(viewingEmail);
      stateOwner = viewingEmail;
      renderAdminDashboard();
    }catch(err){
      console.warn(err);
    }
  });

  // add task
  bindSeg(view, '#importance-seg');
  view.querySelector('#add-task-btn').addEventListener('click', () => {
    const nameEl = view.querySelector('#task-name');
    const timeEl = view.querySelector('#task-time');
    const errEl = view.querySelector('#task-error');
    const name = nameEl.value.trim();
    const time = timeEl.value.trim();
    if(!name || !time){
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    addTask(name, time, segValue(view, '#importance-seg'));
    renderAdminDashboard();
  });

  // task CRUD actions
  view.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if(action === 'edit'){
      btn.addEventListener('click', () => { editingTaskId = id; renderAdminDashboard(); });
    } else if(action === 'cancel-edit'){
      btn.addEventListener('click', () => { editingTaskId = null; renderAdminDashboard(); });
    } else if(action === 'delete'){
      btn.addEventListener('click', () => {
        const t = state.tasks.find(x => x.id === id);
        if(!t) return;
        if(!confirm(`Delete "${t.name}"? Past days will no longer count it.`)) return;
        state.tasks = state.tasks.filter(x => x.id !== id);
        if(editingTaskId === id) editingTaskId = null;
        saveState();
        renderAdminDashboard();
      });
    } else if(action === 'save-edit'){
      btn.addEventListener('click', () => {
        const t = state.tasks.find(x => x.id === id);
        if(!t) return;
        const name = view.querySelector('#edit-name').value.trim();
        const time = view.querySelector('#edit-time').value.trim();
        if(!name || !time) return;
        t.name = name;
        t.timeLabel = time;
        t.importance = segValue(view, '#edit-importance-seg');
        editingTaskId = null;
        saveState();
        renderAdminDashboard();
      });
    }
  });
  if(editingTaskId) bindSeg(view, '#edit-importance-seg');

  // create user
  bindSeg(view, '#role-seg');
  view.querySelector('#create-user-btn').addEventListener('click', async () => {
    const btn = view.querySelector('#create-user-btn');
    const errEl = view.querySelector('#user-error');
    const okEl = view.querySelector('#user-success');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');
    const payload = {
      name: view.querySelector('#new-name').value,
      email: view.querySelector('#new-email').value,
      password: view.querySelector('#new-password').value,
      role: segValue(view, '#role-seg')
    };
    btn.disabled = true;
    try{
      const r = await postJson('/api/users', payload);
      if(r.ok){
        adminUsers.push(r.data.user);
        const sel = view.querySelector('#subject-select');
        sel.insertAdjacentHTML('beforeend',
          `<option value="${escapeHtml(r.data.user.email)}">${escapeHtml(r.data.user.name)} (${r.data.user.role})</option>`);
        view.querySelector('#new-name').value = '';
        view.querySelector('#new-email').value = '';
        view.querySelector('#new-password').value = '';
        okEl.textContent = `User "${r.data.user.name}" created.`;
        okEl.classList.remove('hidden');
      } else {
        errEl.textContent = r.data.error || 'Could not create user.';
        errEl.classList.remove('hidden');
      }
    }catch(e){
      errEl.textContent = 'Cannot reach the server.';
      errEl.classList.remove('hidden');
    }finally{
      btn.disabled = false;
    }
  });

  // email schedule
  view.querySelector('#save-schedule-btn').addEventListener('click', async () => {
    const btn = view.querySelector('#save-schedule-btn');
    const okEl = view.querySelector('#schedule-success');
    okEl.classList.add('hidden');
    const m = parseInt(view.querySelector('#morning-hour').value, 10);
    const e = parseInt(view.querySelector('#evening-hour').value, 10);
    if(!Number.isInteger(m) || m < 0 || m > 23 || !Number.isInteger(e) || e < 0 || e > 23) return;
    btn.disabled = true;
    try{
      const r = await postJson('/api/settings', { morning_hour: m, evening_hour: e });
      if(r.ok){
        emailSettings = { morning_hour: m, evening_hour: e };
        okEl.textContent = 'Schedule saved.';
        okEl.classList.remove('hidden');
      }
    }catch(err){ console.warn(err); }
    finally{ btn.disabled = false; }
  });

  bindChartClicks(view);
}
