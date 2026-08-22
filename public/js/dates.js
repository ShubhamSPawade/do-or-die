/* =========================================================
   DATE HELPERS
========================================================= */
function pad(n){ return String(n).padStart(2, '0'); }
function formatYMD(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayStr(){ return formatYMD(new Date()); }
function parseYMD(s){ const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function prettyDateLong(dateStr){
  const d = parseYMD(dateStr);
  const year = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return MONTH_NAMES[d.getMonth()].toUpperCase() + ' ' + d.getDate() + year;
}

function prettyMonthYear(year, month){
  return MONTH_NAMES[month].toUpperCase() + ' ' + year;
}
