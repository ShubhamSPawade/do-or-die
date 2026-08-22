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
let authMode = 'signin'; // 'signin' | 'signup' | 'forgot' | 'reset'
let activeResetToken = null;

// admin-only globals
let adminUsers = [];       // all accounts (admin only), from GET /api/users
let viewingEmail = null;   // whose ledger the admin is looking at
let editingTaskId = null;  // task currently in inline edit mode
let emailSettings = { morning_hour: 9, evening_hour: 20 }; // email schedule hours

/* --- Auth Mode Switcher --- */
function setAuthMode(mode, token = null){
  authMode = mode;
  activeResetToken = token;
  const btn = document.getElementById('login-btn');
  const nameField = document.getElementById('name-field');
  const emailField = document.getElementById('email-field') || document.getElementById('login-email').parentElement;
  const pwdField = document.getElementById('password-field');
  const pwdLabel = document.getElementById('password-label');
  const subEl = document.getElementById('login-sub');
  const modeToggle = document.getElementById('mode-toggle');
  const forgotToggle = document.getElementById('forgot-toggle');
  const errEl = document.getElementById('login-error');
  const okEl = document.getElementById('login-success');

  errEl.classList.add('hidden');
  if(okEl) okEl.classList.add('hidden');

  if(mode === 'signup'){
    nameField.classList.remove('hidden');
    emailField.classList.remove('hidden');
    pwdField.classList.remove('hidden');
    pwdLabel.textContent = 'Password';
    btn.textContent = 'Create Account';
    subEl.textContent = 'Create Your Account';
    modeToggle.textContent = 'Have an account? Sign In';
    forgotToggle.classList.add('hidden');
  } else if(mode === 'forgot'){
    nameField.classList.add('hidden');
    emailField.classList.remove('hidden');
    pwdField.classList.add('hidden');
    btn.textContent = 'Send Reset Link';
    subEl.textContent = 'Reset Your Password';
    modeToggle.textContent = 'Back to Sign In';
    forgotToggle.classList.add('hidden');
  } else if(mode === 'reset'){
    nameField.classList.add('hidden');
    emailField.classList.add('hidden');
    pwdField.classList.remove('hidden');
    pwdLabel.textContent = 'New Password';
    btn.textContent = 'Update Password';
    subEl.textContent = 'Choose New Password';
    modeToggle.textContent = 'Cancel';
    forgotToggle.classList.add('hidden');
  } else {
    authMode = 'signin';
    activeResetToken = null;
    nameField.classList.add('hidden');
    emailField.classList.remove('hidden');
    pwdField.classList.remove('hidden');
    pwdLabel.textContent = 'Password';
    btn.textContent = 'Sign In';
    subEl.textContent = 'Accountability Ledger';
    modeToggle.textContent = 'New here? Create account';
    forgotToggle.classList.remove('hidden');
  }
}

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

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if(token){
    setAuthMode('reset', token);
  } else {
    setAuthMode('signin');
  }
}

/* --- Wire Up Auth UI --- */
function initAuthUI(){
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  const okEl = document.getElementById('login-success');

  document.getElementById('mode-toggle').addEventListener('click', e => {
    e.preventDefault();
    if(authMode === 'signin') setAuthMode('signup');
    else setAuthMode('signin');
  });

  document.getElementById('forgot-toggle').addEventListener('click', e => {
    e.preventDefault();
    setAuthMode('forgot');
  });

  btn.addEventListener('click', async () => {
    if(btn.disabled) return;
    btn.disabled = true;
    errEl.classList.add('hidden');
    if(okEl) okEl.classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    runLoader();
    try{
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      let user;

      if(authMode === 'signup'){
        const name = document.getElementById('login-name').value;
        const r = await postJson('/api/register', { name, email, password });
        if(r.ok){
          localStorage.setItem(SESSION_KEY, r.data.token);
          user = r.data;
        } else {
          errEl.textContent = r.data.error || 'Could not create account.';
          errEl.classList.remove('hidden');
        }
      } else if(authMode === 'forgot'){
        const r = await postJson('/api/forgot-password', { email });
        if(r.ok){
          okEl.textContent = r.data.message || 'Password reset link sent to your email.';
          okEl.classList.remove('hidden');
        } else {
          errEl.textContent = r.data.error || 'Could not send reset link.';
          errEl.classList.remove('hidden');
        }
      } else if(authMode === 'reset'){
        const r = await postJson('/api/reset-password', { token: activeResetToken, password });
        if(r.ok){
          // Clean token from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          localStorage.setItem(SESSION_KEY, r.data.token);
          user = r.data;
        } else {
          errEl.textContent = r.data.error || 'Could not reset password.';
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
