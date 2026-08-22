/* =========================================================
   UI HELPERS - shared rendering utilities
========================================================= */
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function segHtml(id, current){
  return `<div class="seg" id="${id}">
    ${['LOW','MEDIUM','HIGH'].map(v =>
      `<button type="button" class="seg-btn${v === current ? ' active' : ''}" data-val="${v}">${v.charAt(0) + v.slice(1).toLowerCase()}</button>`
    ).join('')}
  </div>`;
}

function bindSeg(root, sel){
  const seg = root.querySelector(sel);
  if(!seg) return;
  seg.querySelectorAll('.seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      seg.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  });
}

function segValue(root, sel){
  return root.querySelector(sel + ' .seg-btn.active').getAttribute('data-val');
}

function importanceBadge(importance){
  const cls = importance === 'HIGH' ? 'badge-high' : importance === 'MEDIUM' ? 'badge-medium' : 'badge-low';
  return `<span class="badge ${cls}">${importance}</span>`;
}
