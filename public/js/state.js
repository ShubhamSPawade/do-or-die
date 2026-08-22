/* =========================================================
   STATE MANAGEMENT - task CRUD, progress, statistics
   Globals used: state, stateOwner (set in app.js)
========================================================= */

/* --- Task Management --- */
function uid(){ return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function addTask(name, timeLabel, importance){
  state.tasks.push({
    id: uid(),
    name: name.trim(),
    timeLabel: timeLabel.trim(),
    importance,             // 'HIGH' | 'MEDIUM' | 'LOW'
    createdDate: todayStr()
  });
  saveState();
}

// Tasks that were live on a given date (created on/before that date).
function tasksForDate(dateStr){
  return state.tasks.filter(t => t.createdDate <= dateStr);
}

/* --- Progress --- */
function isEditableDate(dateStr){
  return dateStr === todayStr();
}

function getDayRecord(dateStr){
  return state.dailyProgress[dateStr] || { statuses: {} };
}

function setTaskStatus(dateStr, taskId, done){
  if(!isEditableDate(dateStr)) return; // hard guard: past days are immutable
  if(!state.dailyProgress[dateStr]) state.dailyProgress[dateStr] = { statuses: {} };
  state.dailyProgress[dateStr].statuses[taskId] = done;
  saveState();
}

function dayStats(dateStr){
  const tasks = tasksForDate(dateStr);
  const total = tasks.length;
  if(total === 0) return { total: 0, completed: 0, pct: null };
  const rec = state.dailyProgress[dateStr];
  const completed = tasks.filter(t => rec && rec.statuses[t.id] === true).length;
  return { total, completed, pct: Math.round((completed / total) * 100) };
}

/* --- Statistics --- */
function firstTrackedDate(){
  if(state.tasks.length === 0) return todayStr();
  return state.tasks.reduce((min, t) => t.createdDate < min ? t.createdDate : min, state.tasks[0].createdDate);
}

function allDatesWithTasks(){
  const first = parseYMD(firstTrackedDate());
  const end = parseYMD(todayStr());
  const out = [];
  for(let d = new Date(first); d <= end; d.setDate(d.getDate() + 1)){
    const ds = formatYMD(d);
    const s = dayStats(ds);
    if(s.total > 0) out.push({ date: ds, ...s });
  }
  return out; // chronological ascending
}

function computeStreaks(){
  const days = allDatesWithTasks();
  let current = 0;
  for(let i = days.length - 1; i >= 0; i--){
    if(days[i].pct >= 80) current++; else break;
  }
  let best = 0, run = 0;
  days.forEach(d => {
    if(d.pct >= 80){ run++; best = Math.max(best, run); }
    else run = 0;
  });
  return { current, best };
}

function last7Average(){
  const end = parseYMD(todayStr());
  const pcts = [];
  for(let i = 6; i >= 0; i--){
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const pct = dayStats(formatYMD(d)).pct;
    if(pct !== null) pcts.push(pct);
  }
  if(pcts.length === 0) return 0;
  return Math.round(pcts.reduce((a, p) => a + p, 0) / pcts.length);
}

function monthStats(year, month){
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let completedSum = 0, totalSum = 0, successfulDays = 0, countedDays = 0;
  for(let day = 1; day <= daysInMonth; day++){
    const ds = year + '-' + pad(month + 1) + '-' + pad(day);
    if(ds > todayStr()) break;
    const s = dayStats(ds);
    if(s.total > 0){
      completedSum += s.completed;
      totalSum += s.total;
      countedDays++;
      if(s.pct >= 80) successfulDays++;
    }
  }
  const avg = totalSum ? Math.round((completedSum / totalSum) * 100) : 0;
  return {
    avgCompletion: avg,
    tasksCompleted: completedSum,
    tasksMissed: totalSum - completedSum,
    successfulDays,
    countedDays,
    verdict: avg >= 80 ? 'PASS' : 'FAILED'
  };
}

function accountabilityScore(){
  const now = new Date();
  const ms = monthStats(now.getFullYear(), now.getMonth());
  const { current } = computeStreaks();
  const consistency = ms.countedDays ? (ms.successfulDays / ms.countedDays * 100) : 0;
  const streakBonus = Math.min(current / 14 * 100, 100);
  let score = Math.round(0.5 * ms.avgCompletion + 0.3 * consistency + 0.2 * streakBonus);
  score = Math.max(0, Math.min(100, score));
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 50 ? 'Falling Behind' : 'Critical';
  const cls = score >= 90 ? 'score-excellent' : score >= 75 ? 'score-strong' : score >= 50 ? 'score-falling' : 'score-critical';
  return { score, label, cls };
}
