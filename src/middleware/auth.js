import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // {email, role, name}
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireAdmin(req, res, next){
  if(req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admins only.' });
  next();
}

// admins may target any user's ledger; users only their own
export function resolveTarget(requestedEmail, req){
  if(!requestedEmail || requestedEmail === req.user.email) return req.user.email;
  return req.user.role === 'ADMIN' ? String(requestedEmail) : null;
}