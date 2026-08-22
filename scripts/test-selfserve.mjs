const base = 'http://localhost:4321';
const j = async (path, opts) => { const r = await fetch(base + path, opts); let d = {}; try { d = await r.json(); } catch {} return { s: r.status, d }; };
const post = (path, body, token) => j(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
let pass = 0, fail = 0;
function check(name, cond, extra){ if(cond){ pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); } }
(async () => {
  const stamp = Date.now();
  const mk = (tag) => 'qa' + stamp + tag + '@doordie.app';

  // --- self signup ---
  let r = await post('/api/register', { email: mk('a'), password: 'test123', name: 'QA A' });
  check('register new user', r.s === 201 && r.d.role === 'USER' && r.d.token, JSON.stringify(r.d));
  const T = r.d.token;
  r = await post('/api/register', { email: mk('a'), password: 'test123' });
  check('duplicate signup rejected', r.s === 409);
  r = await post('/api/register', { email: 'bad', password: 'test123' });
  check('invalid email rejected', r.s === 400);
  r = await post('/api/register', { email: mk('b'), password: 'abc' });
  check('short password rejected', r.s === 400);
  r = await post('/api/login', { email: mk('a'), password: 'test123' });
  check('registered user can login', r.s === 200);

  // --- forgot password request & reset password ---
  r = await post('/api/forgot-password', { email: mk('a') });
  check('forgot password request', r.s === 200 && r.d.ok, JSON.stringify(r.d));
  r = await post('/api/forgot-password', { email: 'notanemail' });
  check('invalid email in forgot-password rejected', r.s === 400);

  r = await post('/api/reset-password', { email: mk('a'), password: 'newpassword456' });
  check('reset password', r.s === 200 && r.d.ok && r.d.token, JSON.stringify(r.d));
  r = await post('/api/login', { email: mk('a'), password: 'newpassword456' });
  check('login with new password', r.s === 200);
  r = await post('/api/login', { email: mk('a'), password: 'test123' });
  check('old password rejected', r.s === 401);
  r = await post('/api/reset-password', { email: 'nonexistent@doordie.app', password: 'newpass123' });
  check('nonexistent email reset rejected', r.s === 404);
  r = await post('/api/reset-password', { email: mk('a'), password: 'ab' });
  check('short new password rejected', r.s === 400);

  // second user for isolation checks
  r = await post('/api/register', { email: mk('b'), password: 'test123', name: 'QA B' });
  const B = r.d.token;
  check('second user registered', r.s === 201);

  // --- per-user settings ---
  r = await j('/api/my-settings', { headers: { Authorization: 'Bearer ' + T } });
  check('my-settings defaults', r.s === 200 && r.d.morning_hour === 9 && r.d.evening_hour === 20, JSON.stringify(r.d));
  r = await post('/api/my-settings', { morning_hour: 6, evening_hour: 22 }, T);
  check('save my-settings', r.s === 200);
  r = await j('/api/my-settings', { headers: { Authorization: 'Bearer ' + T } });
  check('my-settings persisted', r.d.morning_hour === 6 && r.d.evening_hour === 22);
  r = await post('/api/my-settings', { morning_hour: 30, evening_hour: 22 }, T);
  check('invalid hour rejected', r.s === 400);
  r = await j('/api/my-settings', { headers: { Authorization: 'Bearer ' + B } });
  check('other user unaffected', r.s === 200 && r.d.morning_hour === 9, JSON.stringify(r.d));

  // --- self task crud via state ---
  const ds = new Date();
  const dstr = ds.getFullYear()+'-'+String(ds.getMonth()+1).padStart(2,'0')+'-'+String(ds.getDate()).padStart(2,'0');
  const st = { tasks: [{ id:'tkA', name:'Own Task', timeLabel:'1 hour', importance:'HIGH', createdDate:dstr }], dailyProgress:{} };
  r = await post('/api/state', { state: st }, T);
  check('user saves own ledger', r.s === 200, JSON.stringify(r.d));
  r = await j('/api/state', { headers: { Authorization: 'Bearer ' + T } });
  check('user reads own ledger', r.s === 200 && r.d.state.tasks[0].name === 'Own Task');
  // isolation: B cannot touch A's ledger
  r = await j('/api/state?user=' + encodeURIComponent(mk('a')), { headers: { Authorization: 'Bearer ' + B } });
  check('cross-user read forbidden', r.s === 403);
  r = await post('/api/state', { user: mk('a'), state: st }, B);
  check('cross-user write forbidden', r.s === 403);

  console.log('---'); console.log('PASS:' + pass + ' FAIL:' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });