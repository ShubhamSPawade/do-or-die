import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users').select('email, name, role').order('email');
    if(error) throw error;
    res.json({ users: data });
  } catch(err){ next(err); }
});

router.post('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || email.split('@')[0];
    const role = req.body?.role === 'ADMIN' ? 'ADMIN' : 'USER';

    if(!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if(password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

    const { data: existing } = await supabase.from('users').select('email').eq('email', email);
    if(existing?.length) return res.status(409).json({ error: 'A user with that email already exists.' });

    const password_hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('users')
      .insert({ email, password_hash, name, role });
    if(error){
      if(error.code === '23505') return res.status(409).json({ error: 'A user with that email already exists.' });
      throw error;
    }
    res.status(201).json({ ok: true, user: { email, name, role } });
  } catch(err){ next(err); }
});

router.delete('/users/:email', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const email = decodeURIComponent(String(req.params.email || '')).trim().toLowerCase();
    if(!email) return res.status(400).json({ error: 'Email is required.' });

    if(email === req.user.email.toLowerCase()){
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('email, name, role')
      .eq('email', email)
      .maybeSingle();

    if(findErr) throw findErr;
    if(!existing) return res.status(404).json({ error: 'User not found.' });

    // Explicit cleanup for tasks, daily progress, and email settings
    await supabase.from('daily_progress').delete().eq('user_email', email);
    await supabase.from('tasks').delete().eq('user_email', email);
    await supabase.from('email_settings').delete().eq('user_email', email);

    const { error: delErr } = await supabase
      .from('users')
      .delete()
      .eq('email', email);

    if(delErr) throw delErr;

    res.json({ ok: true, message: `User "${existing.name}" (${email}) deleted successfully.` });
  } catch(err){ next(err); }
});

export default router;