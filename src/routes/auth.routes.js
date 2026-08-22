import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db.js';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Try again later.' }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if(!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const { data: user, error } = await supabase
      .from('users')
      .select('email, password_hash, name, role')
      .eq('email', email)
      .single();

    if(error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    const ok = user && await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(401).json({ error: 'Incorrect email or password.' });

    const payload = { email: user.email, role: user.role, name: user.name };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, ...payload });
  } catch(err){ next(err); }
});

router.post('/register', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || email.split('@')[0];

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if(password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

    const { data: existing } = await supabase.from('users').select('email').eq('email', email);
    if(existing?.length) return res.status(409).json({ error: 'An account with that email already exists.' });

    const password_hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('users').insert({ email, password_hash, name, role: 'USER' });
    if(error){
      if(error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
      throw error;
    }

    const payload = { email, role: 'USER', name };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, ...payload });
  } catch(err){ next(err); }
});

router.post('/reset-password', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || req.body?.new_password || '');

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if(password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

    const { data: user, error } = await supabase
      .from('users')
      .select('email, name, role')
      .eq('email', email)
      .single();

    if(error || !user) return res.status(404).json({ error: 'No account found with that email.' });

    const password_hash = await bcrypt.hash(password, 10);
    const { error: updateErr } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('email', email);

    if(updateErr) throw updateErr;

    const payload = { email: user.email, role: user.role, name: user.name };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, ...payload });
  } catch(err){ next(err); }
});

router.post('/session', (req, res) => {
  try {
    const user = jwt.verify(String(req.body?.token || ''), process.env.JWT_SECRET);
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'No session.' });
  }
});

router.post('/logout', (req, res) => res.json({ ok: true }));

export default router;