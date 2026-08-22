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

import { sendPasswordResetEmail } from '../services/mail.service.js';

router.post('/forgot-password', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('email, name')
      .eq('email', email)
      .single();

    if(error && error.code !== 'PGRST116') throw error;
    if(!user){
      // For security, don't expose whether the email exists, but return ok
      return res.json({ ok: true, message: 'If an account exists with that email, a reset link has been sent.' });
    }

    const resetToken = jwt.sign(
      { email: user.email, type: 'pwd_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const origin = req.headers.origin || (req.headers.host ? `${req.protocol || 'https'}://${req.headers.host}` : 'https://doordie.shubhamsp.site');
    const resetUrl = `${origin.replace(/\/+$/, '')}/app.html?token=${resetToken}`;

    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.json({ ok: true, message: 'Password reset link sent to your email.' });
  } catch(err){ next(err); }
});

router.post('/reset-password', loginLimiter, async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    let email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || req.body?.new_password || '');

    if(!password || password.length < 4){
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    if(token){
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(decoded.type !== 'pwd_reset' || !decoded.email){
          return res.status(400).json({ error: 'Invalid or expired reset link.' });
        }
        email = decoded.email;
      } catch(tokenErr){
        return res.status(400).json({ error: 'Reset link has expired or is invalid. Please request a new one.' });
      }
    }

    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      return res.status(400).json({ error: 'Valid email is required.' });
    }

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
    const sessionToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token: sessionToken, ...payload });
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