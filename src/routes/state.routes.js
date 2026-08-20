import { Router } from 'express';
import { supabase } from '../db.js';
import { requireAuth, resolveTarget } from '../middleware/auth.js';

const router = Router();

function taskRowToClient(t){
  return { id: t.id, name: t.name, timeLabel: t.time_label, importance: t.importance, createdDate: t.created_date };
}

function assembleState(tasks, progress){
  const dailyProgress = {};
  for(const p of progress){
    if(!dailyProgress[p.date]) dailyProgress[p.date] = { statuses: {} };
    dailyProgress[p.date].statuses[p.task_id] = p.done === true;
  }
  return { tasks: tasks.map(taskRowToClient), dailyProgress };
}

router.get('/state', requireAuth, async (req, res, next) => {
  try {
    const target = resolveTarget(req.query.user, req);
    if(!target) return res.status(403).json({ error: 'Forbidden' });

    const [tasksRes, progRes] = await Promise.all([
      supabase.from('tasks').select('id, name, time_label, importance, created_date').eq('user_email', target),
      supabase.from('daily_progress').select('date, task_id, done').eq('user_email', target)
    ]);
    if(tasksRes.error) throw tasksRes.error;
    if(progRes.error) throw progRes.error;

    res.json({ state: assembleState(tasksRes.data, progRes.data) });
  } catch(err){ next(err); }
});

router.post('/state', requireAuth, async (req, res, next) => {
  try {
    const target = resolveTarget(req.body?.user, req);
    if(!target) return res.status(403).json({ error: 'Forbidden' });

    const state = req.body?.state;
    if(!state || !Array.isArray(state.tasks) || typeof state.dailyProgress !== 'object' || !state.dailyProgress){
      return res.status(400).json({ error: 'Invalid state.' });
    }

    // replace strategy: wipe the user's rows, insert the submitted ledger
    await supabase.from('tasks').delete().eq('user_email', target);
    await supabase.from('daily_progress').delete().eq('user_email', target);

    const taskRows = state.tasks.map(t => ({
      id: String(t.id), user_email: target, name: String(t.name),
      time_label: String(t.timeLabel), importance: String(t.importance), created_date: String(t.createdDate)
    }));
    const progRows = [];
    for(const [date, rec] of Object.entries(state.dailyProgress || {})){
      for(const [taskId, done] of Object.entries(rec.statuses || {})){
        progRows.push({ user_email: target, date, task_id: taskId, done: done === true });
      }
    }

    if(taskRows.length){
      const { error } = await supabase.from('tasks').insert(taskRows);
      if(error) throw error;
    }
    if(progRows.length){
      const { error } = await supabase.from('daily_progress').insert(progRows);
      if(error) throw error;
    }
    res.json({ ok: true });
  } catch(err){ next(err); }
});

export default router;