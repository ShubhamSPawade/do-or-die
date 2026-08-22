/* =========================================================
   LOADER - "DO or DIE" decrypt/scramble effect
========================================================= */
const SCRAMBLE_CHARS = '!<>-_\\/[]{}=+*^?#________';

function scrambleWord(el){
  const target = el.getAttribute('data-text');
  const queue = target.split('').map((ch, i) => ({
    ch,
    start: i * 4 + Math.floor(Math.random() * 4),
    end: i * 4 + 9 + Math.floor(Math.random() * 10)
  }));
  let frame = 0;
  return new Promise(resolve => {
    (function tick(){
      let out = '', done = 0;
      for(const q of queue){
        if(frame >= q.end){ out += q.ch; done++; }
        else if(frame >= q.start){ out += '<span class="scramble-char">' + SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)] + '</span>'; }
        else { out += '&nbsp;'; }
      }
      el.innerHTML = out;
      if(done === queue.length) resolve();
      else { frame++; setTimeout(tick, 45); }
    })();
  });
}

let loaderRunning = false;
let loaderShownAt = 0;

async function runLoader(){
  if(loaderRunning) return;
  loaderRunning = true;
  loaderShownAt = Date.now();
  const loaderEl = document.getElementById('loader');
  if(loaderEl) loaderEl.classList.remove('hidden');

  while(loaderRunning){
    await Promise.all(Array.from(document.querySelectorAll('#loader .ld-word')).map(scrambleWord));
    if(!loaderRunning) break;
    await new Promise(r => setTimeout(r, 400));
  }
}

async function hideLoader(immediate = false){
  if(!immediate){
    const wait = Math.max(0, 1200 - (Date.now() - loaderShownAt));
    if(wait) await new Promise(r => setTimeout(r, wait));
  }
  loaderRunning = false;
  const loaderEl = document.getElementById('loader');
  if(loaderEl) loaderEl.classList.add('hidden');
}
