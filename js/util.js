'use strict';
/* VERTFORM 2.0 — shared helpers (classic script; globals are shared across files) */

const APP_NAME = 'VERTFORM';
const APP_VERSION = '2.59.2';
const APP_RELEASE = 'Courtside Notebook';
const SCHEMA_VERSION = 2;     // record layout inside the stored data
const BACKUP_FORMAT = 2;      // layout of exported backup files
const KEY = 'vertform.v1';    // unchanged storage key: existing records are preserved
const KEY_PREMIGRATE = 'vertform.v1.premigrate';     // untouched copy of the records found at first upgrade
const KEY_BEFOREIMPORT = 'vertform.v1.beforeimport'; // copy of the records replaced by the last import
const KEY_TIMER = 'vertform.timer.v1';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const pad2 = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const parseDate = s => new Date(s + 'T12:00:00');
const isISO = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime()) && isoOf(parseDate(s)) === s;
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoOf(d); };
const monday = s => addDays(s, -((parseDate(s).getDay() + 6) % 7));
const dayIndex = s => (parseDate(s).getDay() + 6) % 7; // Monday = 0
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const pretty = s => parseDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const prettyY = s => parseDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const longDate = s => parseDate(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const weekdayShort = s => parseDate(s).toLocaleDateString('en-GB', { weekday: 'short' });
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const isNum = v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
const fmt = (n, d = 1) => Number(n).toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const deepCopy = o => JSON.parse(JSON.stringify(o));
const fmtMins = m => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? pad2(m % 60) + ' min' : ''}`.trim() : `${m} min`; };
const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; };
const fmtBytes = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const timeAgo = iso => {
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return '';
  const days = Math.floor((Date.now() - t) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

/* Inline icon set. Stroke icons only, so they inherit the current text colour. */
const ICONS = {
  home: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  today: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 14h3v3H8z"/>',
  train: '<path d="M2 9v6M5 6v12M19 6v12M22 9v6M5 12h14"/>',
  fuel: '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v6M11 3v8a3 3 0 0 1-3 3"/><path d="M17 3c-2 1.5-3 4-3 7 0 1.7 1 2.7 3 3v8"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  progress: '<path d="M3 20h18M6 16V10M11 16V5M16 16v-4M21 16V8"/>',
  post: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skip: '<path d="M5 5v14l10-7zM19 5v14"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 3c-1.5 3.5-1.5 7.500 0 9s5.500 2.500 9 .5M12 21c1.500-3.500 1.500-7.500 0-9s-5.500-2.500-9-.5M5 5.500c3 .5 5.500 3 7 6.500M19 18.500c-3-.5-5.500-3-7-6.500"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4.500M12 17.500v.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.500 6.500 4 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.700L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  move: '<path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3M2 12h20M12 2v20"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  more: '<circle cx="5" cy="12" r="1.500"/><circle cx="12" cy="12" r="1.500"/><circle cx="19" cy="12" r="1.500"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.500 6h.01M3.500 12h.01M3.500 18h.01"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.01"/>',
  repeat: '<path d="M17 2l3 3-3 3M20 5H8a4 4 0 0 0-4 4v1M7 22l-3-3 3-3M4 19h12a4 4 0 0 0 4-4v-1"/>',
  bell: '<path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4zM10 21h4"/>'
};
function icon(id, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[id] || ICONS.bolt}</svg>`;
}

/* Tiny debounce helper for storage writes */
function debounce(fn, ms) { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = (...a) => { clearTimeout(t); fn(...a); }; return f; }

function cleanWith(a) {
  const seen = new Set(), out = [];
  for (const x of Array.isArray(a) ? a : []) { const n = String(x || '').trim().slice(0, 20); const k = n.toLowerCase(); if (n && !seen.has(k)) { seen.add(k); out.push(n); } if (out.length >= 8) break; }
  return out;
}
