/* =========================================================
   APP BOOTSTRAP & AUTH UI
   This is the main orchestrator that wires everything together.
========================================================= */

/* --- Global State --- */
let state = null;        // ledger of the user currently being viewed
let stateOwner = null;   // email of that user
let me = null;           // signed-in user
let showingOwnView = false; // admin toggled to their personal dashboard
let myEmailSettings = { morning_hour: 9, evening_hour: 20 };
let myEditingTaskId = null;
let signupMode = false;

// admin-only globals
let adminUsers = [];       // all accounts (admin only), from GET /api/users
let viewingEmail = null;   // whose ledger the admin is looking at
let editingTaskId = null;  // task currently in inline edit mode
let emailSettings = { morning_hour: 9, evening_hour: 20 }; // email schedule hours

/* --- Enter the App --- */
async function enterApp(user){
  me = user;
  showingOwnView = false;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('header-role').textContent = user.name + ' · ' + user.role;
  document.getElementById('my-day-btn').classList.toggle('hidden', user.role !== 'ADMIN');
  document.getElementById('my-day-btn').textContent = 'My Day';

  document.getElementById('user-view').classList.toggle('hidden', user.role !== 'USER');
  document.getElementById('admin-view').classList.toggle('hidden', user.role !== 'ADMIN');

  if(user.role === 'USER'){
    stateOwner = user.email;
    const sr = await getJson('/api/my-settings');
    if(sr.ok && Number.isInteger(sr.data.morning_hour)) myEmailSettings = sr.data;
    state = await fetchState();
    renderUserDashboard();
  } else {
    const r = await getJson('/api/users');
    adminUsers = r.ok ? r.data.users : [{ email: user.email, name: user.name, role: 'ADMIN' }];
    if(!viewingEmail || !adminUsers.some(u => u.email === viewingEmail)) viewingEmail = adminUsers[0].email;
    const sr = await getJson('/api/settings');
    if(sr.ok && Number.isInteger(sr.data.morning_hour)) emailSettings = sr.data;
    state = await fetchState(viewingEmail);
    stateOwner = viewingEmail;
    renderAdminDashboard();
  }
}

/* --- Show Login Screen --- */
function showLogin(){
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

/* --- Wire Up Auth UI --- */
function initAuthUI(){
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');

  document.getElementById('mode-toggle').addEventListener('click', e => {
    e.preventDefault();
    signupMode = !signupMode;
    document.getElementById('name-field').classList.toggle('hidden', !signupMode);
    btn.textContent = signupMode ? 'Create Account' : 'Sign In';
    document.getElementById('mode-toggle').textContent = signupMode ? 'Have an account? Sign In' : 'New here? Create account';
    errEl.classList.add('hidden');
  });

  btn.addEventListener('click', async () => {
    if(btn.disabled) return;
    btn.disabled = true;
    errEl.classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    runLoader();
    try{
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      let user;
      if(signupMode){
        const name = document.getElementById('login-name').value;
        const r = await postJson('/api/register', { name, email, password });
        if(r.ok){
          localStorage.setItem(SESSION_KEY, r.data.token);
          user = r.data;
        } else {
          errEl.textContent = r.data.error || 'Could not create account.';
          errEl.classList.remove('hidden');
        }
      } else {
        user = await attemptLogin(email, password);
        if(!user){
          errEl.textContent = 'Incorrect email or password.';
          errEl.classList.remove('hidden');
        }
      }
      if(user) await enterApp(user);
    }catch(e){
      errEl.textContent = 'Cannot reach the server. Please try again.';
      errEl.classList.remove('hidden');
    }finally{
      btn.disabled = false;
      hideLoader();
    }
  });

  document.getElementById('login-password').addEventListener('keydown', e => {
    if(e.key === 'Enter') document.getElementById('login-btn').click();
  });
  document.getElementById('login-email').addEventListener('keydown', e => {
    if(e.key === 'Enter') document.getElementById('login-btn').click();
  });

  document.getElementById('my-day-btn').addEventListener('click', async () => {
    const btn = document.getElementById('my-day-btn');
    const uv = document.getElementById('user-view');
    const av = document.getElementById('admin-view');
    btn.disabled = true;
    try{
      if(!showingOwnView){
        state = await fetchState(me.email);
        stateOwner = me.email;
        av.classList.add('hidden');
        uv.classList.remove('hidden');
        renderUserDashboard();
        btn.textContent = 'Admin Panel';
        showingOwnView = true;
      } else {
        state = await fetchState(viewingEmail);
        stateOwner = viewingEmail;
        uv.classList.add('hidden');
        av.classList.remove('hidden');
        renderAdminDashboard();
        btn.textContent = 'My Day';
        showingOwnView = false;
      }
    }catch(e){ console.warn(e); }
    finally{ btn.disabled = false; }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    logout();
    me = null;
    viewingEmail = null;
    editingTaskId = null;
    myEditingTaskId = null;
    signupMode = false;
    document.getElementById('name-field').classList.add('hidden');
    document.getElementById('login-btn').textContent = 'Sign In';
    document.getElementById('mode-toggle').textContent = 'New here? Create account';
    state = null;
    showLogin();
  });
}

/* --- Boot --- */
async function boot(){
  initAuthUI();
  runLoader();
  try{
    const session = await getSession();
    if(session) await enterApp(session);
    else showLogin();
  }catch(e){
    showLogin();
  }
  hideLoader();
}

boot();
