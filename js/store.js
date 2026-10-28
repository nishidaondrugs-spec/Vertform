'use strict';
/* VERTFORM 2.0 — storage, migration, validation and backups.
   The storage key (vertform.v1) and the top-level `version: 1` marker are deliberately unchanged, so existing
   records load as they are and a rollback to the previous release can still read the data. */

const METRICS = [
  { key: 'reach', label: 'Standing reach', unit: 'cm', note: 'Standing, flat-footed, arm fully extended overhead. Measured once in a while, not every session.' },
  { key: 'approach', label: 'Approach touch height', unit: 'cm', note: 'The highest point you touch after a full approach. This is a touch height, not a jump height.' },
  { key: 'approachJump', label: 'Approach jump height', unit: 'cm', derived: true, note: 'Calculated: approach touch − standing reach used at the time.' },
  { key: 'cmj', label: 'Standing CMJ jump height', unit: 'cm', note: 'Countermovement jump from standing: the rise of your body, not a touch height.' },
  { key: 'pullup', label: 'Weighted pull-up', unit: 'kg', note: 'Added load for the same standardised rep count.' },
  { key: 'arm', label: 'Upper-arm size', unit: 'cm', note: 'Relaxed circumference, measured consistently.' },
  { key: 'weight', label: 'Bodyweight', unit: 'kg', note: 'Ideally morning weight.' },
  { key: 'rsi', label: 'Drop-jump RSI', unit: 'm/s', note: 'Jump height (m) divided by ground contact time (s) from a 30 cm drop jump. Optional.' }
];
const METRIC_KEYS = new Set(METRICS.map(m => m.key).filter(k => k !== 'approachJump'));
const metricDef = k => METRICS.find(m => m.key === k);

function baseData() {
  const now = new Date().toISOString();
  return {
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    user: { startDate: todayISO(), height: 172, bodyweight: 78, trap1rm: '', proteinTarget: 150, profileSet: false, gymSessions: ['A', 'B', 'C', 'D'], onboarded: false, hideBuiltin: false, hiddenKeys: [], setupDate: '' },
    matches: [],
    matchInfo: {},
    logs: [],
    readiness: {},
    metrics: [],
    draft: null,
    custom: { A: [], B: [], C: [], D: [] },
    nutrition: {
      settings: { age: '', sex: '', bodyFat: '', daily: 'mixed', gymMin: 60, goal: 'maintain', fatPerKg: 0.9, customCalories: '', dayAdjust: true },
      entries: [], productCache: {}, favourites: [], recipes: []
    },
    vb: { logs: [], extras: [], skips: [], schedule: [{ from: '0000-01-01', days: [] }], trainInfo: {} },
    pins: [],
    mySessions: [],
    catalogue: [],
    hiddenEx: {},
    creatine: {},
    settings: {
      rest: { auto: true, sound: true, vibrate: true, wakeLock: true, perExercise: {} },
      backup: { lastExportAt: null, lastExportCounts: null, reminderDays: 14, snoozedUntil: null },
      theme: 'dark', nav: 'feed', creatine: { on: false, dose: 5 }, logo: '', weighSnooze: null, lb: null
    },
    meta: { createdAt: now, appVersion: APP_VERSION, migratedAt: null, migratedFrom: null }
  };
}

const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const numOr = (v, d) => (isNum(v) ? Number(v) : d);

/* Validate and normalise an unknown object (stored records or an imported file) into the current layout.
   Throws a readable Error for files that must not be imported; returns warnings for entries that were skipped. */
/* Your own gym sessions (keys E and up): validated field by field, never trusted as-is. */
const withDist = (x, o) => (['m', 'km'].includes(x.dist) ? { ...o, dist: x.dist } : o);
function cleanMySessions(arr) {
  const used = new Set(), out = [];
  for (const s of (Array.isArray(arr) ? arr : []).slice(0, 12)) {
    if (!isObj(s) || !/^[E-P]$/.test(s.key || '') || used.has(s.key) || !String(s.title || '').trim()) continue; used.add(s.key);
    out.push({ key: s.key, title: String(s.title).trim().slice(0, 40), type: String(s.type || '').slice(0, 30), minutes: clamp(parseInt(s.minutes) || 0, 0, 240), heavy: !!s.heavy, deleted: !!s.deleted, emoji: Array.from(String(s.emoji || '').trim())[0] || '',
      exercises: (Array.isArray(s.exercises) ? s.exercises : []).filter(e => isObj(e) && String(e.name || '').trim()).slice(0, 25).map(e => ({ id: typeof e.id === 'string' && e.id ? e.id.slice(0, 60) : 'cx-' + uid(), name: String(e.name).trim().slice(0, 80), sets: clamp(parseInt(e.sets) || 3, 1, 12), reps: String(e.reps || '10').slice(0, 30), unit: ['reps', 'seconds', 'metres'].includes(e.unit) ? e.unit : 'reps', dist: ['m', 'km'].includes(e.dist) ? e.dist : '', load: !!e.load, hint: String(e.hint || '').slice(0, 140), optional: false, rest: clamp(parseInt(e.rest) || 0, 0, 600) })) });
  }
  return out;
}
/* 2.39: your exercise library (any exercise you add by hand) and built-in exercises you removed from a session for good. */
/* optional creatine tracker: { 'YYYY-MM-DD': grams } for the days it was taken */
function cleanCreatine(o) {
  const out = {}; if (!isObj(o)) return out;
  Object.keys(o).filter(isISO).sort().slice(-800).forEach(d => { const g = Number(o[d]); if (g > 0 && g <= 50) out[d] = Math.round(g * 10) / 10; });
  return out;
}
function cleanCatalogue(arr) {
  const out = [];
  for (const e of (Array.isArray(arr) ? arr : []).slice(0, 500)) {
    if (!isObj(e) || !String(e.name || '').trim()) continue;
    out.push({ id: typeof e.id === 'string' && e.id ? e.id.slice(0, 60) : 'lib-' + uid(), name: String(e.name).trim().slice(0, 80), sets: clamp(parseInt(e.sets) || 3, 1, 12), reps: String(e.reps || '10').slice(0, 30), unit: ['reps', 'seconds', 'metres'].includes(e.unit) ? e.unit : 'reps', dist: ['m', 'km'].includes(e.dist) ? e.dist : '', load: !!e.load, hint: String(e.hint || '').slice(0, 140), rest: clamp(parseInt(e.rest) || 0, 0, 600) });
  }
  return out;
}
function cleanHiddenEx(o) {
  const out = {};
  if (isObj(o)) for (const k of ['A', 'B', 'C', 'D']) if (Array.isArray(o[k])) out[k] = o[k].filter(x => typeof x === 'string').slice(0, 60);
  return out;
}
function normaliseData(o) {
  const warnings = []; const b = baseData();
  if (!isObj(o)) throw new Error('This file is not a VERTFORM backup (a JSON object was expected).');
  if (o.version !== 1) throw new Error('This file is not a compatible VERTFORM backup (unrecognised version marker).');
  if (Number(o.schemaVersion) > SCHEMA_VERSION || Number(o.backup?.format) > BACKUP_FORMAT) {
    throw new Error(`This backup was made by a newer version of VERTFORM${o.backup?.appVersion ? ' (' + o.backup.appVersion + ')' : ''}. Update the app first so nothing is lost.`);
  }
  for (const k of ['logs', 'matches', 'metrics']) if (!Array.isArray(o[k])) throw new Error(`The "${k}" section is missing or damaged, so this file cannot be imported.`);
  if (!isObj(o.readiness)) throw new Error('The "readiness" section is missing or damaged, so this file cannot be imported.');
  if (o.logs.length > 5000 || o.metrics.length > 10000 || o.matches.length > 2000 || (o.nutrition?.entries?.length || 0) > 20000) throw new Error('This file is far larger than a normal VERTFORM backup.');
  let skipped = 0; const skip = () => { skipped++; return false; };
  const ids = new Set(); const freshId = id => { let x = typeof id === 'string' && id && !ids.has(id) ? id : uid(); ids.add(x); return x; };

  const out = { ...b, version: 1, schemaVersion: SCHEMA_VERSION };
  out.user = { ...b.user, ...(isObj(o.user) ? o.user : {}) };
  if (!isObj(o.user) || typeof o.user.onboarded !== 'boolean') out.user.onboarded = true; // anything saved before 2.8 already has its own setup
  out.user.hiddenKeys = Array.isArray(out.user.hiddenKeys) ? out.user.hiddenKeys.filter(k => BUILTIN_KEYS.includes(k)) : []; setHiddenBuiltin(out.user.hiddenKeys);
  out.mySessions = cleanMySessions(o.mySessions); syncCustomSessions(out.mySessions, !!(o.user && o.user.hideBuiltin));
  out.catalogue = cleanCatalogue(o.catalogue); out.hiddenEx = cleanHiddenEx(o.hiddenEx); out.creatine = cleanCreatine(o.creatine);
  out.user.gymSessions = Array.isArray(out.user.gymSessions) ? SESSION_KEYS.filter(k => out.user.gymSessions.includes(k)) : SESSION_KEYS.slice();
  if (!out.user.gymSessions.length) out.user.gymSessions = SESSION_KEYS.slice();
  if (!isISO(out.user.startDate)) { out.user.startDate = b.user.startDate; warnings.push('Programme start date was invalid and has been reset to today.'); }

  out.matches = [...new Set(o.matches.filter(d => isISO(d) || skip()))].sort();
  out.matchInfo = {};
  if (isObj(o.matchInfo)) for (const [d, v] of Object.entries(o.matchInfo)) if (isISO(d) && isObj(v)) out.matchInfo[d] = { opponent: String(v.opponent || '').slice(0, 60), venue: String(v.venue || '').slice(0, 60), time: String(v.time || '').slice(0, 10), notes: String(v.notes || '').slice(0, 300) };

  out.logs = o.logs.filter(l => (isObj(l) && isISO(l.date) && typeof l.session === 'string' && Array.isArray(l.exercises)) || skip()).map(l => ({
    ...l, id: freshId(l.id), completed: l.completed !== false, with: cleanWith(l.with),
    exercises: l.exercises.filter(e => isObj(e) && Array.isArray(e.sets)).map(e => ({ ...e, sets: e.sets.filter(isObj).map(s => ({ load: s.load ?? '', reps: s.reps ?? '', done: !!s.done, ...(s.wu ? { wu: true } : {}), ...(s.dist ? { dist: String(s.dist).slice(0, 12) } : {}) })) }))
  }));
  out.metrics = o.metrics.filter(m => (isObj(m) && isISO(m.date) && METRIC_KEYS.has(m.key) && Number.isFinite(Number(m.value)) && (Number(m.value) > 0 || (m.key === 'pullup' && m.value !== '' && Number(m.value) === 0))) || skip()).map(m => {
    const r = { id: freshId(m.id), date: m.date, key: m.key, value: Number(m.value) };
    if (isNum(m.reachUsed) && Number(m.reachUsed) > 0) { r.reachUsed = Number(m.reachUsed); r.jump = isNum(m.jump) ? Number(m.jump) : +(r.value - r.reachUsed).toFixed(1); if (isISO(m.reachDate)) r.reachDate = m.reachDate; }
    return r;
  });
  out.readiness = {}; for (const [d, v] of Object.entries(o.readiness)) if (isISO(d) && isObj(v)) out.readiness[d] = v;

  if (o.draft && isObj(o.draft) && isISO(o.draft.date) && templates[o.draft.session] && Array.isArray(o.draft.exercises)) {
    out.draft = { ...o.draft, with: cleanWith(o.draft.with), exercises: o.draft.exercises.filter(isObj).map(e => ({ ...e, sets: (Array.isArray(e.sets) ? e.sets : []).filter(isObj).map(s => ({ load: s.load ?? '', reps: s.reps ?? '', done: !!s.done, ...(s.wu ? { wu: true } : {}), ...(s.dist ? { dist: String(s.dist).slice(0, 12) } : {}) })) })) };
    ids.add(out.draft.id);
  } else if (o.draft) warnings.push('An unfinished workout draft in this data was damaged and could not be kept.');

  out.custom = { A: [], B: [], C: [], D: [] };
  if (isObj(o.custom)) for (const k of SESSION_KEYS) out.custom[k] = (Array.isArray(o.custom[k]) ? o.custom[k] : []).filter(x => (isObj(x) && x.id && x.name) || skip()).map(x => withDist(x, ex(String(x.id), String(x.name).slice(0, 80), clamp(parseInt(x.sets) || 2, 1, 12), String(x.reps || '10').slice(0, 30), x.unit || 'reps', !!x.load, x.hint || 'Custom exercise', !!x.optional)));

  const n = isObj(o.nutrition) ? o.nutrition : {};
  out.nutrition = {
    settings: { ...b.nutrition.settings, ...(isObj(n.settings) ? n.settings : {}) },
    entries: (Array.isArray(n.entries) ? n.entries : []).filter(f => (isObj(f) && isISO(f.date) && typeof f.name === 'string' && Number.isFinite(Number(f.kcal))) || skip()).map(f => ({ ...f, id: freshId(f.id) })),
    productCache: isObj(n.productCache) ? n.productCache : {},
    favourites: (Array.isArray(n.favourites) ? n.favourites : []).filter(f => isObj(f) && /^\d{8,14}$/.test(String(f.key)) && isObj(n.productCache) && n.productCache[f.key]).slice(0, 60).map(f => ({ key: String(f.key), amount: isNum(f.amount) ? Number(f.amount) : null, unit: typeof f.unit === 'string' ? f.unit.slice(0, 20) : null })),
    recipes: (Array.isArray(n.recipes) ? n.recipes : []).filter(r => (isObj(r) && r.name && Array.isArray(r.ingredients) && Number(r.servings) > 0) || skip()).map(r => ({ ...r, id: freshId(r.id), servings: Number(r.servings), type: r.type === 'meal' ? 'meal' : 'recipe', ingredients: r.ingredients.filter(isObj) }))
  };

  const v = isObj(o.vb) ? o.vb : {};
  out.vb = {
    logs: (Array.isArray(v.logs) ? v.logs : []).filter(l => (isObj(l) && isISO(l.date) && ['training', 'match', 'social'].includes(l.kind)) || skip()).map(l => { const r = { ...l, id: freshId(l.id) }; delete r.blocks; return r; }),
    extras: (Array.isArray(v.extras) ? v.extras : []).filter(x => (isObj(x) && isISO(x.date)) || skip()).map(x => ({ ...x, id: freshId(x.id) })),
    skips: [...new Set((Array.isArray(v.skips) ? v.skips : []).filter(isISO))],
    schedule: (Array.isArray(v.schedule) ? v.schedule : []).filter(s => isObj(s) && typeof s.from === 'string' && Array.isArray(s.days) && s.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6)).sort((a, b) => a.from.localeCompare(b.from))
  };
  out.vb.trainInfo = {};
  if (isObj(v.trainInfo)) for (const [k, t] of Object.entries(v.trainInfo)) if (/^[0-6]$/.test(k) && isObj(t)) out.vb.trainInfo[k] = { name: String(t.name || '').slice(0, 30), intensity: ['light', 'moderate', 'hard', 'max'].includes(t.intensity) ? t.intensity : 'moderate', min: clamp(parseInt(t.min) || 90, 10, 300) };
  if (!out.vb.schedule.length || out.vb.schedule[0].from > '0000-01-01') out.vb.schedule.unshift({ from: '0000-01-01', days: [3] }); // v1.x always trained on Thursday

  out.pins = (Array.isArray(o.pins) ? o.pins : []).filter(p => (isObj(p) && SESSION_KEYS.includes(p.session) && isISO(p.week) && isISO(p.date)) || skip()).map(p => ({ ...p, id: freshId(p.id) }));

  const s = isObj(o.settings) ? o.settings : {};
  out.settings = {
    rest: { ...b.settings.rest, ...(isObj(s.rest) ? s.rest : {}), perExercise: isObj(s.rest?.perExercise) ? s.rest.perExercise : {} },
    backup: { ...b.settings.backup, ...(isObj(s.backup) ? s.backup : {}) }
  };
  out.settings.theme = ['dark', 'light', 'auto'].includes(s.theme) ? s.theme : 'dark';
  out.settings.nav = s.nav === 'hub' ? 'hub' : 'feed';
  out.settings.flagHide = {}; if (isObj(s.flagHide)) for (const [k, v] of Object.entries(s.flagHide)) if (/^[a-z-]{1,20}$/.test(k) && isISO(v)) out.settings.flagHide[k] = v;
  out.settings.creatine = { on: !!(isObj(s.creatine) && s.creatine.on), dose: clamp(Number(isObj(s.creatine) ? s.creatine.dose : 5) || 5, 1, 20) };
  out.settings.photo = typeof s.photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s.photo) && s.photo.length < 80000 ? s.photo : '';
  out.settings.banner = typeof s.banner === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s.banner) && s.banner.length < 400000 ? s.banner : '';
  out.settings.bannerId = ['random', 'spike', 'set', 'captain', 'smile', 'read', 'focus', 'serve'].includes(s.bannerId) ? s.bannerId : 'random';
  out.settings.photoUp = Number.isFinite(s.photoUp) ? s.photoUp : 0;
  out.settings.logo = typeof s.logo === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.logo) && s.logo.length < 200000 ? s.logo : '';
  out.settings.weighSnooze = isISO(s.weighSnooze) ? s.weighSnooze : null;
  /* 2.20: the player look was dropped on every load. Keep only small whole numbers; the editor cleans it fully when used. */
  out.settings.look = isObj(s.look) ? Object.fromEntries(Object.entries(s.look).filter(([k, v]) => /^[a-z]+$/i.test(k) && Number.isInteger(v) && v >= 0 && v <= 99)) : null;
  out.settings.lb = isObj(s.lb) && /^[0-9a-f-]{36}$/.test(s.lb.id || '') && typeof s.lb.secret === 'string' && s.lb.secret.length >= 24 && typeof s.lb.code === 'string' ? { id: s.lb.id, secret: s.lb.secret, nick: String(s.lb.nick || '').slice(0, 20), code: s.lb.code.slice(0, 6), shareJump: s.lb.shareJump !== false } : null;
  out.settings.backup.reminderDays = clamp(parseInt(out.settings.backup.reminderDays) || 0, 0, 365);
  out.meta = { ...b.meta, ...(isObj(o.meta) ? o.meta : {}) };
  if (skipped) warnings.push(`${plural(skipped, 'damaged or unusable entry', 'damaged or unusable entries')} could not be read and ${skipped === 1 ? 'was' : 'were'} skipped.`);
  return { data: out, warnings };
}

function countsOf(d) {
  return {
    workouts: d.logs.length, foodEntries: d.nutrition.entries.length, recipes: d.nutrition.recipes.length,
    measurements: d.metrics.length, volleyballLogs: d.vb.logs.length, fixtures: d.matches.length,
    customExercises: SESSION_KEYS.reduce((n, k) => n + (d.custom[k] || []).length, 0), cachedProducts: Object.keys(d.nutrition.productCache || {}).length, hasDraft: !!d.draft
  };
}
const recordTotal = c => c.workouts + c.foodEntries + c.recipes + c.measurements + c.volleyballLogs;

/* ---------- loading ---------- */
let data = baseData();
let storageBlocked = false;        // true while stored records could not be read: nothing is written until the user decides
let storageProblem = null;
let loadNotes = { migrated: false, warnings: [], premigrateKept: null };

function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) {
    storageBlocked = true; storageProblem = { type: 'unavailable', message: 'This browser is blocking local storage, so VERTFORM cannot save anything here (private browsing or blocked site data can cause this).' };
    return;
  }
  if (raw === null) { data = baseData(); data.settings.backup.firstSeenAt = new Date().toISOString(); return; }
  try {
    const parsed = JSON.parse(raw);
    const { data: d, warnings } = normaliseData(parsed);
    const needsMigration = parsed.schemaVersion !== SCHEMA_VERSION;
    if (needsMigration) {
      let kept = false;
      try { if (localStorage.getItem(KEY_PREMIGRATE) === null) localStorage.setItem(KEY_PREMIGRATE, raw); kept = true; } catch (e) { kept = false; }
      d.meta.migratedAt = new Date().toISOString(); d.meta.migratedFrom = parsed.meta?.appVersion || `schema ${parsed.schemaVersion || 1}`;
      loadNotes = { migrated: true, warnings, premigrateKept: kept };
      if (!d.settings.backup.firstSeenAt) d.settings.backup.firstSeenAt = new Date().toISOString();
    } else loadNotes.warnings = warnings;
    data = d;
  } catch (e) {
    storageBlocked = true;
    storageProblem = { type: 'corrupt', message: e.message || 'The saved records could not be read.', raw };
    data = baseData();
  }
}

/* ---------- saving ---------- */
let dirty = false, saveFailed = false;
function saveNow() {
  dirty = false;
  if (storageBlocked) return false;
  try {
    data.meta.appVersion = APP_VERSION; data.meta.updatedAt = new Date().toISOString(); data.schemaVersion = SCHEMA_VERSION;
    localStorage.setItem(KEY, JSON.stringify(data)); saveFailed = false; if (typeof onSaved === 'function') onSaved(); return true;
  } catch (e) {
    saveFailed = true;
    if (typeof onSaveFailure === 'function') onSaveFailure(e);
    return false;
  }
}
const save = saveNow;
const saveLater = debounce(saveNow, 350);
function saveSoon() { dirty = true; saveLater(); }
function flushSave() { if (dirty) saveLater.flush(); }

/* ---------- backups ---------- */
function buildBackup() {
  const copy = deepCopy(data);
  copy.backup = { format: BACKUP_FORMAT, appName: APP_NAME, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), counts: countsOf(data) };
  return copy;
}
function backupStatus() {
  const b = data.settings.backup, counts = countsOf(data), total = recordTotal(counts);
  const last = b.lastExportAt ? new Date(b.lastExportAt) : null;
  const daysSince = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
  const interval = b.reminderDays;
  const snoozed = b.snoozedUntil && new Date(b.snoozedUntil).getTime() > Date.now();
  const never = !last;
  /* signed in and backed up to the account recently: no need to nag about backup files */
  const cloud = typeof syncState !== 'undefined' && typeof signedIn === 'function' && acctOn() && signedIn() && syncState.at && Date.now() - Date.parse(syncState.at) < 7 * 86400000;
  const overdue = !cloud && interval > 0 && total > 0 && (never || daysSince >= interval);
  const changed = last && b.lastExportCounts ? recordTotal(counts) - recordTotal(b.lastExportCounts) : null;
  return { last, daysSince, never, overdue, due: overdue && !snoozed, interval, total, changed, counts, cloud };
}
function recordExport() {
  data.settings.backup.lastExportAt = new Date().toISOString();
  data.settings.backup.lastExportCounts = countsOf(data);
  data.settings.backup.snoozedUntil = null;
  save();
}

/* Inspect a backup file's text without touching current records */
function inspectBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { throw new Error('This file is not valid JSON, so it is not a VERTFORM backup. It may be incomplete or have been edited.'); }
  const { data: incoming, warnings } = normaliseData(parsed);
  const meta = parsed.backup && isObj(parsed.backup) ? parsed.backup : null;
  return { incoming, warnings, meta, isLegacy: !meta, incomingCounts: countsOf(incoming), currentCounts: countsOf(data) };
}
function applyImport(incoming, meta) {
  // keep a copy of what is being replaced so the import can be undone
  let safety = false;
  try { localStorage.setItem(KEY_BEFOREIMPORT, localStorage.getItem(KEY) || JSON.stringify(data)); safety = true; } catch (e) { safety = false; }
  incoming.settings.backup.lastExportAt = meta?.exportedAt || incoming.settings.backup.lastExportAt || null;
  incoming.settings.backup.lastExportCounts = meta?.counts || incoming.settings.backup.lastExportCounts || null;
  incoming.meta.importedAt = new Date().toISOString();
  data = incoming; storageBlocked = false; storageProblem = null;
  const ok = save();
  return { ok, safety };
}
function hasStoredCopy(key) { try { return localStorage.getItem(key) !== null; } catch (e) { return false; } }
function storedCopySize(key) { try { return (localStorage.getItem(key) || '').length; } catch (e) { return 0; } }
function restoreBeforeImport() {
  const raw = localStorage.getItem(KEY_BEFOREIMPORT); if (!raw) throw new Error('No earlier copy is stored on this device.');
  const { data: d } = normaliseData(JSON.parse(raw));
  const current = localStorage.getItem(KEY);
  data = d; save(); if (current) { try { localStorage.setItem(KEY_BEFOREIMPORT, current); } catch (e) { /* ignore */ } }
}
function storageEstimateText() {
  try { return fmtBytes(new Blob([localStorage.getItem(KEY) || '']).size); } catch (e) { return 'unknown'; }
}
