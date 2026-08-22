const base = 'http://localhost:4321';
const j = async (path, opts) => { const r = await fetch(base + path, opts); let d = {}; try { d = await r.json(); } catch {} return { s: r.status, d }; };
const post = (path, body, token) => j(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
let pass = 0, fail = 0;
function check(name, cond, extra){ if(cond){ pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + extra : '')); } }
(async () => {
  // self signup
  let r = await post('/api/register', { email: 'selfsignup@doordie.app', password: 'test123', name: 'Self User' });
  check('register new user', r.s === 201 && r.d.role === 'USER' && r.d.token, JSON.stringify(r.d));
  const T = r.d.token;
  r = await post('/api/register', { email: 'selfsignup@doordie.app', password: 'test123' });
  check('duplicate signup rejected', r.s === 409);
  r = await post('/api/register', { email: 'bad', password: 'test123' });
  check('invalid email rejected', r.s === 400);
  r = await post('/api/login', { email: 'selfsignup@doordie.app', password: 'test123' });
  check('registered user can login', r.s === 200);

  // per-user settings
  r = await j('/api/my-settings', { headers: { Authorization: 'Bearer ' + T } });
  check('my-settings defaults', r.s === 200 && r.d.morning_hour === 9 && r.d.evening_hour === 20, JSON.stringify(r.d));
  r = await post('/api/my-settings', { morning_hour: 6, evening_hour: 22 }, T);
  check('save my-settings', r.s === 200);
  r = await j('/api/my-settings', { headers: { Authorization: 'Bearer ' + T } });
  check('my-settings persisted', r.d.morning_hour === 6 && r.d.evening_hour === 22);
  r = await post('/api/my-settings', { morning_hour: 30, evening_hour: 22 }, T);
  check('invalid hour rejected', r.s === 400);

  // isolation: another user's settings are separate
  r = await post('/api/login', { email: 'friend@doordie.app', password: 'friend123' });
  const F = r.d.token;
  r = await j('/api/my-settings', { headers: { Authorization: 'Bearer ' + F } });
  check('other user unaffected', r.s === 200 && r.d.morning_hour === 9, JSON.stringify(r.d));

  // self task crud via state
  const ds = new Date(); const dstr = ds.getFullYear()+'-'+String(ds.getMonth()+1).padStart(2,'0')+'-'+String(ds.getDate()).padStart(2,'0');
  const st = { tasks: [{ id:'tkA', name:'Own Task', timeLabel:'1 hour', importance:'HIGH', createdDate:dstr }], dailyProgress:{} };
  r = await post('/api/state', { state: st }, T);
  check('user saves own ledger', r.s === 200);
  r = await j('/api/state', { headers: { Authorization: 'Bearer ' + T } });
  check('user reads own ledger', r.s === 200 && r.d.state.tasks[0].name === 'Own Task');

  // global admin settings still work
  r = await post('/api/login', { email: 'admin@doordie.app', password: 'admin123' });
  const A = r.d.token;
  r = await j('/api/settings', { headers: { Authorization: 'Bearer ' + A } });
  check('admin global settings intact', r.s === 200);

  console.log('---'); console.log('PASS:' + pass + ' FAIL:' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });