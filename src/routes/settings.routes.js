import { Router } from 'express';
import { supabase } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/settings', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('settings').select('morning_hour, evening_hour').eq('id', true).single();
    if(error && error.code !== 'PGRST116') throw error;
    res.json(data || { morning_hour: 9, evening_hour: 20 });
  } catch(err){ next(err); }
});

router.post('/settings', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const m = Number(req.body?.morning_hour), e = Number(req.body?.evening_hour);
    if(!Number.isInteger(m) || m < 0 || m > 23 || !Number.isInteger(e) || e < 0 || e > 23){
      return res.status(400).json({ error: 'Hours must be integers between 0 and 23.' });
    }
    const { error } = await supabase.from('settings').upsert({ id: true, morning_hour: m, evening_hour: e });
    if(error) throw error;
    res.json({ ok: true });
  } catch(err){ next(err); }
});

router.get('/my-settings', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('email_settings').select('morning_hour, evening_hour').eq('user_email', req.user.email).single();
    if(error && error.code !== 'PGRST116') throw error;
    res.json(data || { morning_hour: 9, evening_hour: 20 });
  } catch(err){ next(err); }
});

router.post('/my-settings', requireAuth, async (req, res, next) => {
  try {
    const m = Number(req.body?.morning_hour), e = Number(req.body?.evening_hour);
    if(!Number.isInteger(m) || m < 0 || m > 23 || !Number.isInteger(e) || e < 0 || e > 23){
      return res.status(400).json({ error: 'Hours must be integers between 0 and 23.' });
    }
    const { error } = await supabase
      .from('email_settings')
      .upsert({ user_email: req.user.email, morning_hour: m, evening_hour: e });
    if(error) throw error;
    res.json({ ok: true });
  } catch(err){ next(err); }
});

export default router;