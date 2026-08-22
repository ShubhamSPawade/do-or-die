import { supabase } from '../db.js';
import { sendMorningBriefing, sendEveningReport } from './mail.service.js';

function pad(n){ return String(n).padStart(2, '0'); }

function todayStr(){
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

async function runScheduledTick(){
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const today = todayStr();

    // 1. Fetch global settings fallback
    const { data: globalSettings } = await supabase
      .from('settings')
      .select('morning_hour, evening_hour')
      .eq('id', true)
      .single();

    const defaultMorning = globalSettings?.morning_hour ?? 9;
    const defaultEvening = globalSettings?.evening_hour ?? 20;

    // 2. Fetch all users and custom email settings
    const [usersRes, emailSettingsRes] = await Promise.all([
      supabase.from('users').select('email, name'),
      supabase.from('email_settings').select('user_email, morning_hour, evening_hour')
    ]);

    if(usersRes.error || !usersRes.data) return;

    const customSettingsMap = new Map();
    (emailSettingsRes.data || []).forEach(s => {
      customSettingsMap.set(s.user_email, s);
    });

    for(const user of usersRes.data){
      const setting = customSettingsMap.get(user.email);
      const mHour = setting?.morning_hour ?? defaultMorning;
      const eHour = setting?.evening_hour ?? defaultEvening;

      if(currentHour === mHour){
        // Fetch tasks on/before today
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, name, time_label, importance, created_date')
          .eq('user_email', user.email)
          .lte('created_date', today);

        if(tasks && tasks.length > 0){
          await sendMorningBriefing(user.email, user.name, tasks, today);
        }
      }

      if(currentHour === eHour){
        const [tasksRes, progRes] = await Promise.all([
          supabase.from('tasks').select('id, name, time_label, importance, created_date').eq('user_email', user.email).lte('created_date', today),
          supabase.from('daily_progress').select('task_id, done').eq('user_email', user.email).eq('date', today)
        ]);

        const tasks = tasksRes.data || [];
        if(tasks.length > 0){
          const progressMap = new Map((progRes.data || []).map(p => [p.task_id, p.done]));
          const completed = [];
          const pending = [];

          tasks.forEach(t => {
            if(progressMap.get(t.id) === true) completed.push(t);
            else pending.push(t);
          });

          const total = tasks.length;
          const pct = Math.round((completed.length / total) * 100);

          await sendEveningReport(user.email, user.name, { total, completed, pending, pct }, today);
        }
      }
    }
  } catch(err){
    console.error('[SCHEDULER] Tick error:', err.message);
  }
}

let timer = null;

export function startScheduler(){
  if(timer) return;
  // Run hourly tick check
  timer = setInterval(runScheduledTick, 60 * 60 * 1000);
  console.log('[SCHEDULER] Native Node.js email scheduler started (evaluating hourly)');
}

export function stopScheduler(){
  if(timer){
    clearInterval(timer);
    timer = null;
  }
}
