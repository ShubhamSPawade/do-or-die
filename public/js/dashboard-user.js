/* =========================================================
   USER DASHBOARD
   Globals used: state, stateOwner, me, myEmailSettings,
                 myEditingTaskId (all declared in app.js)
========================================================= */
function renderUserDashboard(){
  const view = document.getElementById('user-view');
  const now = new Date();
  const today = formatYMD(now);
  const tasks = tasksForDate(today);
  const rec = getDayRecord(today);
  const completed = tasks.filter(t => rec.statuses[t.id] === true).length;
  const total = tasks.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const { current, best } = computeStreaks();
  const ms = monthStats(now.getFullYear(), now.getMonth());
  const score = accountabilityScore();

  const taskRows = tasks.length === 0
    ? `<p style="color:var(--gray-3); font-style:italic; font-family:var(--font-display);">No tasks yet. Add your first one below.</p>`
    : tasks.map(t => {
        if(t.id === myEditingTaskId){
          return `
          <div class="task-row" style="flex-direction:column; align-items:stretch; gap:10px;">
            <div class="field" style="margin-bottom:0;"><label>Task Name</label><input type="text" id="my-edit-name" value="${escapeHtml(t.name)}"></div>
            <div class="field" style="margin-bottom:0;"><label>Expected Time</label><input type="text" id="my-edit-time" value="${escapeHtml(t.timeLabel)}"></div>
            <div class="field" style="margin-bottom:0;"><label>Importance</label>${segHtml('my-edit-importance-seg', t.importance)}</div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-filled btn-sm" data-action="save-my-edit" data-id="${t.id}">Save</button>
              <button class="btn btn-ghost btn-sm" data-action="cancel-my-edit">Cancel</button>
            </div>
          </div>`;
        }
        const done = rec.statuses[t.id] === true;
        return `
        <div class="task-row">
          <div class="task-info">
            <div class="task-name">${escapeHtml(t.name)}</div>
            <div class="task-meta">
              <span class="task-time">${escapeHtml(t.timeLabel)}</span>
              ${importanceBadge(t.importance)}
            </div>
          </div>
          <div class="task-toggle" style="display:flex; gap:6px; align-items:center; min-width:auto;">
            <button class="btn ${done ? 'btn-done' : ''}" data-task-id="${t.id}">${done ? 'Done' : 'Mark Done'}</button>
            <button class="btn btn-sm" data-action="edit" data-id="${t.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${t.id}">Delete</button>
          </div>
        </div>`;
      }).join('');

  let verdictLine = '';
  if(total === 0){ verdictLine = ''; }
  else if(pct === 100){ verdictLine = `<div class="verdict-line verdict-good">DAY COMPLETE</div>`; }
  else if(pct < 50){ verdictLine = `<div class="verdict-line verdict-bad">YOU ARE FALLING BEHIND</div>`; }

  const html = `
    <div class="case-box case-box-pad">
      <div class="section-title">Add a Task</div>
      <div class="section-sub">Your own work, from today onward.</div>
      <div class="field">
        <label for="my-task-name">Task Name</label>
        <input type="text" id="my-task-name" placeholder="e.g. Revise DSA">
      </div>
      <div class="field">
        <label for="my-task-time">Expected Time</label>
        <input type="text" id="my-task-time" placeholder="e.g. 2 hours">
      </div>
      <div class="field">
        <label>Importance</label>
        ${segHtml('my-importance-seg', 'MEDIUM')}
      </div>
      <button class="btn btn-filled btn-block" id="my-add-task-btn">Add Task</button>
      <div class="error-text hidden" id="my-task-error">Enter a task name and expected time.</div>
    </div>

    <div class="dash-wrap">
      <div class="dash-main">
        <div class="case-box dash-today">
          <div class="case-box-pad">
            <div class="section-title">Today - ${prettyDateLong(today)}</div>
            <div class="section-sub">Mark today's tasks. Nothing else can be touched.</div>
            ${taskRows}
          </div>
        </div>

        <div class="case-box case-box-pad dash-sched">
          <div class="section-title">Email Schedule</div>
          <div class="section-sub">Your personal daily emails (Apps Script).</div>
          <div style="display:flex; gap:12px;">
            <div class="field" style="flex:1; margin-bottom:0;">
              <label for="my-morning-hour">Morning Hour (0-23)</label>
              <input type="number" id="my-morning-hour" min="0" max="23" value="${myEmailSettings.morning_hour}">
            </div>
            <div class="field" style="flex:1; margin-bottom:0;">
              <label for="my-evening-hour">Evening Hour (0-23)</label>
              <input type="number" id="my-evening-hour" min="0" max="23" value="${myEmailSettings.evening_hour}">
            </div>
          </div>
          <button class="btn btn-filled btn-block" id="my-save-schedule-btn" style="margin-top:12px;">Save Schedule</button>
          <div class="lock-note hidden" id="my-schedule-success"></div>
        </div>

        <div class="case-box dash-score">
          <div class="score-box">
            <div class="eyebrow">Accountability Score</div>
            <div class="big-num score-num">${score.score} <span style="font-size:16px;">/ 100</span></div>
            <div class="score-label ${score.cls}">${score.label}</div>
          </div>
        </div>
      </div>

      <div class="dash-side">
        <div class="case-box dash-hero">
          <div class="today-hero">
            <div class="eyebrow">Today</div>
            <span class="big-num">${completed} / ${total}</span>
            <div style="font-size:20px; font-family:var(--font-mono); font-weight:600;">${total ? pct + '%' : '-'}</div>
            ${verdictLine}
          </div>
          <div class="streak-row">
            <div class="streak-cell">
              <div class="eyebrow">Current Streak</div>
              <div class="big-num">${current} <span style="font-size:12px;">DAYS</span></div>
            </div>
            <div class="streak-cell">
              <div class="eyebrow">Best Streak</div>
              <div class="big-num">${best} <span style="font-size:12px;">DAYS</span></div>
            </div>
          </div>
        </div>

        <div class="case-box case-box-pad dash-chart" id="chart-holder">
          ${renderContributionChart(now.getFullYear(), now.getMonth())}
          <div class="lock-note">past days are read-only.</div>
        </div>

        <div class="case-box dash-monthly">
          <div class="case-box-pad">
            <div class="section-title">Monthly Progress</div>
            <div class="section-sub">${prettyMonthYear(now.getFullYear(), now.getMonth())}</div>
            <div class="stat-grid">
              <div class="stat-cell"><div class="eyebrow">Average Completion</div><div class="big-num">${ms.avgCompletion}%</div></div>
              <div class="stat-cell"><div class="eyebrow">Tasks Completed</div><div class="big-num">${ms.tasksCompleted}</div></div>
              <div class="stat-cell"><div class="eyebrow">Tasks Missed</div><div class="big-num">${ms.tasksMissed}</div></div>
              <div class="stat-cell"><div class="eyebrow">Successful Days</div><div class="big-num">${ms.successfulDays}/${ms.countedDays}</div></div>
            </div>
            <hr class="rule-light">
            <div class="eyebrow" style="text-align:center;">Month Verdict</div>
            <div style="text-align:center; font-family:var(--font-sc); font-size:20px; letter-spacing:.08em; margin-top:6px; color:${ms.verdict === 'PASS' ? 'var(--ink)' : 'var(--stamp)'};">${ms.verdict}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  view.innerHTML = html;

  // self task crud
  bindSeg(view, '#my-importance-seg');
  view.querySelector('#my-add-task-btn').addEventListener('click', () => {
    const name = view.querySelector('#my-task-name').value.trim();
    const time = view.querySelector('#my-task-time').value.trim();
    const errEl = view.querySelector('#my-task-error');
    if(!name || !time){ errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');
    addTask(name, time, segValue(view, '#my-importance-seg'));
    renderUserDashboard();
  });

  view.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if(action === 'edit'){
      btn.addEventListener('click', () => { myEditingTaskId = id; renderUserDashboard(); });
    } else if(action === 'cancel-my-edit'){
      btn.addEventListener('click', () => { myEditingTaskId = null; renderUserDashboard(); });
    } else if(action === 'delete'){
      btn.addEventListener('click', () => {
        const t = state.tasks.find(x => x.id === id);
        if(!t) return;
        if(!confirm(`Delete "${t.name}"? Past days will no longer count it.`)) return;
        state.tasks = state.tasks.filter(x => x.id !== id);
        if(myEditingTaskId === id) myEditingTaskId = null;
        saveState();
        renderUserDashboard();
      });
    } else if(action === 'save-my-edit'){
      btn.addEventListener('click', () => {
        const t = state.tasks.find(x => x.id === id);
        if(!t) return;
        const name = view.querySelector('#my-edit-name').value.trim();
        const time = view.querySelector('#my-edit-time').value.trim();
        if(!name || !time) return;
        t.name = name;
        t.timeLabel = time;
        t.importance = segValue(view, '#my-edit-importance-seg');
        myEditingTaskId = null;
        saveState();
        renderUserDashboard();
      });
    }
  });
  if(myEditingTaskId && document.getElementById('my-edit-name')) bindSeg(view, '#my-edit-importance-seg');

  // personal email schedule
  view.querySelector('#my-save-schedule-btn').addEventListener('click', async () => {
    const sBtn = view.querySelector('#my-save-schedule-btn');
    const okEl = view.querySelector('#my-schedule-success');
    okEl.classList.add('hidden');
    const m = parseInt(view.querySelector('#my-morning-hour').value, 10);
    const e2 = parseInt(view.querySelector('#my-evening-hour').value, 10);
    if(!Number.isInteger(m) || m < 0 || m > 23 || !Number.isInteger(e2) || e2 < 0 || e2 > 23) return;
    sBtn.disabled = true;
    try{
      const r = await postJson('/api/my-settings', { morning_hour: m, evening_hour: e2 });
      if(r.ok){
        myEmailSettings = { morning_hour: m, evening_hour: e2 };
        okEl.textContent = 'Schedule saved.';
        okEl.classList.remove('hidden');
      }
    }catch(err){ console.warn(err); }
    finally{ sBtn.disabled = false; }
  });

  view.querySelectorAll('[data-task-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.getAttribute('data-task-id');
      const nowDone = rec.statuses[taskId] === true;
      setTaskStatus(today, taskId, !nowDone);
      renderUserDashboard();
    });
  });
  bindChartClicks(view);
}
