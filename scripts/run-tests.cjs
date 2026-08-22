const { spawn } = require('child_process');
const child = spawn('node', ['src/server.js'], { cwd: 'C:\\Users\\Shubham\\Desktop\\doordie', stdio: 'ignore', detached: true });

async function waitForServer(timeoutMs){
  const t0 = Date.now();
  while(Date.now() - t0 < timeoutMs){
    try {
      const r = await fetch('http://localhost:4321/');
      if(r.status === 200) return true;
    } catch {}
    await new Promise(res => setTimeout(res, 500));
  }
  return false;
}

(async () => {
  const up = await waitForServer(20000);
  if(!up){ console.error('server did not start'); child.kill(); process.exit(1); }
  console.log('server ready');
  const { execSync } = require('child_process');
  let code = 1;
  try {
    const out = execSync('node scripts/test-selfserve.mjs', { cwd: 'C:\\Users\\Shubham\\Desktop\\doordie', encoding: 'utf8' });
    console.log(out);
    code = 0;
  } catch(e){
    console.log(e.stdout || e.message);
    code = e.status ?? 1;
  }
  try { process.kill(-child.pid); } catch {}
  child.kill();
  process.exit(code);
})();