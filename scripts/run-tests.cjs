const { spawn, execSync } = require('child_process');
const path = require('path');
const projectDir = path.resolve(__dirname, '..');
const TEST_PORT = '4329';
const TEST_BASE = `http://localhost:${TEST_PORT}`;

const env = { ...process.env, PORT: TEST_PORT, NODE_ENV: 'test', TEST_BASE };
const child = spawn('node', ['src/server.js'], { cwd: projectDir, env, stdio: 'ignore' });

async function waitForServer(timeoutMs){
  const t0 = Date.now();
  while(Date.now() - t0 < timeoutMs){
    try {
      const r = await fetch(TEST_BASE + '/');
      if(r.status === 200) return true;
    } catch {}
    await new Promise(res => setTimeout(res, 500));
  }
  return false;
}

(async () => {
  const up = await waitForServer(20000);
  if(!up){ console.error('server did not start'); child.kill(); process.exit(1); }
  console.log('Test server ready on port ' + TEST_PORT);

  let code = 0;
  for(const script of ['scripts/test-selfserve.mjs', 'scripts/smoke-test.mjs']){
    console.log(`\n--- Running ${script} ---`);
    try {
      const out = execSync(`node ${script}`, { cwd: projectDir, env, encoding: 'utf8' });
      console.log(out);
    } catch(e){
      console.log(e.stdout || e.message);
      code = e.status ?? 1;
    }
  }

  child.kill();
  process.exit(code);
})();