/**
 * DO OR DIE — daily email notifications (free, via Gmail)
 *
 * Setup (once):
 *   1. Go to script.google.com > New project, paste this file.
 *   2. Fill in SUPABASE_URL and SERVICE_ROLE_KEY below
 *      (Supabase Dashboard > Project Settings > API).
 *   3. Project Settings > set your time zone (e.g. Asia/Kolkata) —
 *      the schedule hours are evaluated in this time zone.
 *   4. Run installTriggers() once and approve the permissions.
 *
 * The script wakes up every hour; when the current hour matches the
 * admin-configured morning/evening hour (from the app's Email Schedule
 * box), it sends the emails to every registered user.
 */

const SUPABASE_URL = 'PASTE_YOUR_PROJECT_URL';
const SERVICE_ROLE_KEY = 'PASTE_YOUR_SERVICE_ROLE_KEY';

// ---------- Supabase helpers ----------

function sb_(path){
  const url = SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + path;
  const res = UrlFetchApp.fetch(url, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY },
    muteHttpExceptions: true
  });
  if(res.getResponseCode() !== 200) throw new Error('Supabase error on ' + path + ': ' + res.getContentText());
  return JSON.parse(res.getContentText());
}

function todayStr_(){
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function getSettings_(){
  const rows = sb_('settings?id=eq.true&select=morning_hour,evening_hour');
  return rows[0] || { morning_hour: 9, evening_hour: 20 };
}

function getUsers_(){
  return sb_('users?select=email,name&order=email.asc');
}

function getLedger_(email){
  const enc = encodeURIComponent(email);
  const tasks = sb_('tasks?user_email=eq.' + enc + '&select=id,name,time_label,importance,created_date');
  const progress = sb_('daily_progress?user_email=eq.' + enc + '&select=date,task_id,done');
  return { tasks: tasks, progress: progress };
}

// true / false / null (= never marked)
function statusFor_(ledger, today, taskId){
  for(const p of ledger.progress){
    if(p.date === today && p.task_id === taskId) return p.done === true;
  }
  return null;
}

function tasksForToday_(ledger, today){
  return ledger.tasks.filter(function(t){ return t.created_date <= today; });
}

// ---------- Scheduling ----------

function installTriggers(){
  ScriptApp.getProjectTriggers().forEach(function(t){ ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('hourlyTick').timeBased().everyHours(1).create();
}

function hourlyTick(){
  const hour = Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'H'));
  const s = getSettings_();
  if(hour === Number(s.morning_hour)) sendMorningEmails();
  if(hour === Number(s.evening_hour)) sendEveningEmails();
}

// ---------- Emails ----------

const STYLE =
  'font-family:Georgia,serif;color:#111;line-height:1.5;' +
  'border:1px solid #171717;padding:20px;max-width:520px;background:#fff;';
const RED = '#8f2318';

function wrap_(inner){
  return '<div style="' + STYLE + '">' +
    '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#55554f;">Do or Die — Accountability Ledger</div>' +
    inner + '</div>';
}

function taskTable_(tasks){
  let rows = '';
  tasks.forEach(function(t){
    rows += '<tr>' +
      '<td style="padding:6px 10px 6px 0;border-top:1px solid #ececea;font-weight:bold;">' + t.name + '</td>' +
      '<td style="padding:6px 10px;border-top:1px solid #ececea;">' + t.time_label + '</td>' +
      '<td style="padding:6px 0;border-top:1px solid #ececea;font-weight:bold;">' + t.importance + '</td>' +
    '</tr>';
  });
  return '<table style="border-collapse:collapse;font-size:13px;width:100%;">' + rows + '</table>';
}

function sendMorningEmails(){
  const today = todayStr_();
  getUsers_().forEach(function(u){
    const ledger = getLedger_(u.email);
    const tasks = tasksForToday_(ledger, today);
    let body;
    if(tasks.length === 0){
      body = '<p><b>' + u.name + '</b>, no tasks are assigned for today.</p>';
    } else {
      body = '<p><b>' + u.name + '</b>, here is what you owe today (' + today + '):</p>' +
        taskTable_(tasks) +
        '<p style="color:' + RED + ';font-style:italic;margin-top:16px;">You can improve tomorrow. You cannot rewrite yesterday.</p>';
    }
    MailApp.sendEmail({ to: u.email, subject: 'DO OR DIE — Your tasks for ' + today, htmlBody: wrap_(body) });
  });
}

function sendEveningEmails(){
  const today = todayStr_();
  getUsers_().forEach(function(u){
    const ledger = getLedger_(u.email);
    const tasks = tasksForToday_(ledger, today);
    if(tasks.length === 0) return; // nothing assigned -> nothing to report

    const completed = [], pending = [], untouched = [];
    tasks.forEach(function(t){
      const st = statusFor_(ledger, today, t.id);
      if(st === true) completed.push(t);
      else if(st === false) pending.push(t);
      else untouched.push(t);
    });

    const total = tasks.length;
    const doneCount = completed.length;
    const pct = Math.round((doneCount / total) * 100);
    const notUpdatedAtAll = (completed.length + pending.length) === 0;

    let message, color = '#111111';
    if(notUpdatedAtAll){
      message = "You haven't updated your progress today. Open DO OR DIE and mark your tasks before the day closes.";
      color = RED;
    } else if(pct === 100){
      message = '100% complete. Outstanding discipline — every task accounted for. Keep the streak alive.';
    } else if(doneCount === 0){
      message = '0% completed. You are falling behind. Do not let today slip away.';
      color = RED;
    } else {
      message = pct + '% done. Still pending: ' +
        pending.concat(untouched).map(function(t){ return t.name; }).join(', ') + '.';
      color = RED;
    }

    let body = '<p>Evening report for <b>' + today + '</b></p>' +
      '<div style="font-size:34px;font-weight:bold;">' + doneCount + ' / ' + total +
      ' <span style="font-size:16px;">(' + pct + '%)</span></div>';

    if(completed.length){
      body += '<p style="margin-bottom:4px;"><b>Completed</b></p><ul style="margin-top:0;">' +
        completed.map(function(t){ return '<li>' + t.name + '</li>'; }).join('') + '</ul>';
    }
    if(pending.length || untouched.length){
      body += '<p style="margin-bottom:4px;"><b>Pending</b></p><ul style="margin-top:0;">' +
        pending.concat(untouched).map(function(t){ return '<li>' + t.name + '</li>'; }).join('') + '</ul>';
    }

    body += '<p style="font-weight:bold;color:' + color + ';margin-top:16px;">' + message + '</p>';
    MailApp.sendEmail({ to: u.email, subject: 'DO OR DIE — Evening report ' + today, htmlBody: wrap_(body) });
  });
}