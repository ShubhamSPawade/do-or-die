/* =========================================================
   CONTRIBUTION CHART & DAY MODAL
========================================================= */
function bucketClass(pct){
  if(pct === null) return 'cell-empty';
  if(pct === 0) return 'cell-0';
  if(pct <= 25) return 'cell-1';
  if(pct <= 50) return 'cell-2';
  if(pct <= 75) return 'cell-3';
  if(pct < 100) return 'cell-4';
  return 'cell-5';
}

function renderContributionChart(year, month){
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = prettyMonthYear(year, month);
  let cells = '';
  for(let day = 1; day <= daysInMonth; day++){
    const ds = year + '-' + pad(month + 1) + '-' + pad(day);
    const isFuture = ds > todayStr();
    if(isFuture){
      cells += `<div class="cell cell-future" title="Not yet"></div>`;
      continue;
    }
    const s = dayStats(ds);
    const cls = bucketClass(s.pct);
    if(s.total === 0){
      cells += `<div class="cell cell-empty" title="No tasks assigned"></div>`;
    } else {
      cells += `<div class="cell ${cls}" data-date="${ds}" role="button" tabindex="0" aria-label="${prettyDateLong(ds)}: ${s.pct}% complete"></div>`;
    }
  }
  return `
    <div class="chart-head">
      <div>
        <div class="section-title">Contribution Chart</div>
        <div class="section-sub">${monthLabel}</div>
      </div>
    </div>
    <div class="chart-grid">${cells}</div>
    <div class="chart-legend">
      <span>LOW</span>
      <span class="legend-sq" style="background:var(--gray-1)"></span>
      <span class="legend-sq" style="background:#d6d6d2"></span>
      <span class="legend-sq" style="background:#b3b3ad"></span>
      <span class="legend-sq" style="background:#87877f"></span>
      <span class="legend-sq" style="background:#54544d"></span>
      <span class="legend-sq" style="background:var(--ink)"></span>
      <span>HIGH</span>
    </div>
  `;
}

function bindChartClicks(root){
  root.querySelectorAll('.cell[data-date]').forEach(cell => {
    const open = () => showDayModal(cell.getAttribute('data-date'));
    cell.addEventListener('click', open);
    cell.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); } });
  });
}

function showDayModal(dateStr){
  const s = dayStats(dateStr);
  const locked = !isEditableDate(dateStr);
  const modalRoot = document.getElementById('modal-root');
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="modal-overlay" tabindex="-1">
      <div class="case-box modal-box">
        ${locked ? '<div class="modal-stamp">LOCKED</div>' : ''}
        <div class="modal-date">${prettyDateLong(dateStr)}</div>
        <div class="modal-row"><span>Completion</span><strong>${s.pct}%</strong></div>
        <div class="modal-row"><span>Completed</span><strong>${s.completed} / ${s.total} tasks</strong></div>
        <button class="btn btn-block modal-close" id="modal-close-btn">Close</button>
      </div>
    </div>
  `;
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close-btn');
  overlay.focus();
  function onKey(e){ if(e.key === 'Escape') close(); }
  function close(){ document.removeEventListener('keydown', onKey); modalRoot.innerHTML = ''; }
  overlay.addEventListener('click', e => { if(e.target.id === 'modal-overlay') close(); });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}
