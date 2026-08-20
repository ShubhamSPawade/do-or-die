const base = 'http://localhost:4321';
const j = async (path, opts) => { const r = await fetch(base + path, opts); let d = {}; try { d = await r.json(); } catch {} return { s: r.status, d }; };
const post = (path, body, token) => j(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
let pass = 0, fail = 0;
function check(name, cond, extra){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); }
}
(async () => {
  // ---- frontend ----
  const idx = await fetch(base + '/');
  const html = await idx.text();
  check('GET / serves frontend', idx.status === 200 && html.includes('id="login-screen"'));
  check('frontend has email schedule UI', html.includes('morning-hour'));
  const blocked = await fetch(base + '/.env');
  check('.env not served', blocked.status === 403 || blocked.status === 404);

  // ---- auth ----
  let r = await post('/api/login', { email: 'admin@doordie.app', password: 'admin123' });
  check('admin login', r.s === 200 && r.d.role === 'ADMIN', JSON.stringify(r.d));
  const A = r.d.token;
  r = await post('/api/login', { email: 'friend@doordie.app', password: 'friend123' });
  check('friend login', r.s === 200 && r.d.role === 'USER');
  const F = r.d.token;
  r = await post('/api/login', { email: 'admin@doordie.app', password: 'wrong' });
  check('wrong password rejected', r.s === 401);
  r = await post('/api/login', { email: 'ADMIN@doordie.app', password: 'admin123' });
  check('case-insensitive email login', r.s === 200);
  r = await post('/api/session', { token: A });
  check('session restore', r.s === 200 && r.d.user.role === 'ADMIN');
  r = await post('/api/session', { token: 'garbage' });
  check('bad session rejected', r.s === 401);

  // ---- users ----
  r = await j('/api/users', { headers: { Authorization: 'Bearer ' + A } });
  check('list users (admin)', r.s === 200 && r.d.users.length >= 2 && !JSON.stringify(r.d).includes('password'), JSON.stringify(r.d));
  r = await post('/api/users', { email: 'test.user@doordie.app', password: 'test123', name: 'Test User', role: 'USER' }, A);
  check('create user', r.s === 201 && r.d.user.email === 'test.user@doordie.app', JSON.stringify(r.d));
  r = await post('/api/users', { email: 'test.user@doordie.app', password: 'test123' }, A);
  check('duplicate user rejected', r.s === 409);
  r = await post('/api/users', { email: 'not-an-email', password: 'test123' }, A);
  check('invalid email rejected', r.s === 400);
  r = await post('/api/users', { email: 'ok@doordie.app', password: 'abc' }, A);
  check('short password rejected', r.s === 400);
  r = await j('/api/users', { headers: { Authorization: 'Bearer ' + F } });
  check('non-admin list users forbidden', r.s === 403);
  r = await post('/api/users', { email: 'x@x.com', password: 'xxxx' }, F);
  check('non-admin create user forbidden', r.s === 403);

  r = await post('/api/login', { email: 'test.user@doordie.app', password: 'test123' });
  check('created user can login', r.s === 200);
  const T = r.d.token;

  // ---- state ----
  const now = new Date();
  const ds = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const st = { tasks: [
    { id: 'tk1', name: 'Revise DSA', timeLabel: '2 hours', importance: 'HIGH', createdDate: ds },
    { id: 'tk2', name: 'Morning Run', timeLabel: '30 mins', importance: 'LOW', createdDate: ds }
  ], dailyProgress: { [ds]: { statuses: { tk1: true } } } };
  r = await post('/api/state', { user: 'test.user@doordie.app', state: st }, A);
  check('admin saves ledger for other user', r.s === 200, JSON.stringify(r.d));

  r = await j('/api/state?user=test.user@doordie.app', { headers: { Authorization: 'Bearer ' + A } });
  check('admin reads ledger back', r.s === 200 && r.d.state.tasks.length === 2 && r.d.state.tasks[0].timeLabel === '2 hours' && r.d.state.dailyProgress[ds].statuses.tk1 === true, JSON.stringify(r.d));

  r = await j('/api/state', { headers: { Authorization: 'Bearer ' + T } });
  check('user reads own ledger', r.s === 200 && r.d.state.tasks.length === 2);

  r = await j('/api/state?user=test.user@doordie.app', { headers: { Authorization: 'Bearer ' + F } });
  check('cross-user read forbidden', r.s === 403);

  r = await post('/api/state', { user: 'test.user@doordie.app', state: { tasks: [], dailyProgress: {} } }, F);
  check('cross-user write forbidden', r.s === 403);

  r = await post('/api/state', { state: { tasks: 'junk' } }, A);
  check('invalid state rejected', r.s === 400);

  r = await j('/api/state?user=test.user@doordie.app', { headers: { Authorization: 'Bearer ' + A } });
  const t2 = r.d.state.tasks.find(t => t.id === 'tk2');
  check('round-trip field mapping ok', t2 && t2.name === 'Morning Run' && t2.importance === 'LOW');

  // ---- settings ----
  r = await j('/api/settings', { headers: { Authorization: 'Bearer ' + A } });
  check('get settings', r.s === 200 && 'morning_hour' in r.d, JSON.stringify(r.d));
  r = await post('/api/settings', { morning_hour: 7, evening_hour: 21 }, A);
  check('save settings', r.s === 200);
  r = await j('/api/settings', { headers: { Authorization: 'Bearer ' + A } });
  check('settings persisted', r.d.morning_hour === 7 && r.d.evening_hour === 21);
  r = await post('/api/settings', { morning_hour: 25, evening_hour: 21 }, A);
  check('invalid hour rejected', r.s === 400);
  r = await j('/api/settings', { headers: { Authorization: 'Bearer ' + F } });
  check('non-admin settings forbidden', r.s === 403);
  await post('/api/settings', { morning_hour: 9, evening_hour: 20 }, A);

  console.log('---');
  console.log('PASS:' + pass + ' FAIL:' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });