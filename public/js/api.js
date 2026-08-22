/* =========================================================
   API & AUTH HELPERS
   All server communication goes through these functions.
========================================================= */
const SESSION_KEY = 'doOrDie_session_v1';

function authHeaders(){
  const h = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(SESSION_KEY);
  if(token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

async function postJson(path, body){
  const res = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function getJson(path){
  const res = await fetch(path, { headers: { 'Authorization': 'Bearer ' + (localStorage.getItem(SESSION_KEY) || '') } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function attemptLogin(email, password){
  const r = await postJson('/api/login', { email, password });
  if(!r.ok) return null;
  localStorage.setItem(SESSION_KEY, r.data.token);
  return r.data; // {email, role, name}
}

async function getSession(){
  const token = localStorage.getItem(SESSION_KEY);
  if(!token) return null;
  const r = await postJson('/api/session', { token });
  if(!r.ok){ localStorage.removeItem(SESSION_KEY); return null; }
  return r.data.user;
}

function logout(){
  const token = localStorage.getItem(SESSION_KEY);
  if(token) postJson('/api/logout', { token });
  localStorage.removeItem(SESSION_KEY);
}

async function fetchState(ownerEmail){
  const q = ownerEmail ? '?user=' + encodeURIComponent(ownerEmail) : '';
  const r = await getJson('/api/state' + q);
  if(!r.ok) throw new Error('Failed to load ledger');
  const s = r.data.state;
  if(!s || !Array.isArray(s.tasks)) return { tasks: [], dailyProgress: {} };
  if(!s.dailyProgress) s.dailyProgress = {};
  return s;
}

function saveState(){
  postJson('/api/state', { user: stateOwner, state }).catch(e => console.warn('Save failed:', e));
}
