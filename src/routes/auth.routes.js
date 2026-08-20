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