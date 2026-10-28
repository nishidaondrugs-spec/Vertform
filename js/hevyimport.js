/* Import your workouts from a Hevy export (workout_data.csv). Everything is read on this phone; nothing is uploaded.
   Hevy workout names become your own log-only sessions, every set keeps its weight, reps, warm-up flag, time and distance. */
const hv = { text: '', plan: null, err: '', busy: false, fromOb: false };

/* a small CSV reader that copes with quotes, commas and line breaks inside fields */
function hvCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}
const HV_MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function hvTime(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/)) && HV_MON[m[2].toLowerCase()] !== undefined) return new Date(+m[3], HV_MON[m[2].toLowerCase()], +m[1], +m[4], +m[5]);
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return null;
}
const hvSlug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40);
const hvNum = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

function hvParse(text) {
  const rows = hvCsv(text.replace(/^﻿/, '')); if (rows.length < 2) return { err: 'That file is empty.' };
  const head = rows[0].map(h => h.trim().toLowerCase()), col = n => head.indexOf(n);
  const need = ['title', 'start_time', 'exercise_title']; if (need.some(n => col(n) < 0)) return { err: 'This does not look like a Hevy export. It needs title, start_time and exercise_title columns.' };
  const C = { title: col('title'), st: col('start_time'), en: col('end_time'), desc: col('description'), ex: col('exercise_title'), note: col('exercise_notes'), sup: col('superset_id'), type: col('set_type'), kg: col('weight_kg'), lb: col('weight_lbs'), reps: col('reps'), km: col('distance_km'), mi: col('distance_miles'), sec: col('duration_seconds') };
  const g = (r, i) => i >= 0 ? (r[i] ?? '').trim() : '';
  const byW = new Map(); let bad = 0, sets = 0, supers = 0, dropped = 0;
  for (const r of rows.slice(1)) {
    const s0 = hvTime(g(r, C.st)); if (!s0) { bad++; continue; }
    const key = g(r, C.title) + '|' + g(r, C.st);
    let w = byW.get(key); if (!w) { w = { key, title: g(r, C.title) || 'Workout', start: s0, end: hvTime(g(r, C.en)), desc: '', exs: new Map() }; byW.set(key, w); }
    if (!w.desc) w.desc = g(r, C.desc);
    const name = g(r, C.ex); if (!name) continue;
    let e = w.exs.get(name); if (!e) { e = { name, note: '', sets: [] }; w.exs.set(name, e); }
    if (!e.note) e.note = g(r, C.note);
    if (g(r, C.sup) !== '') supers++;
    let kg = hvNum(g(r, C.kg)); if (kg === null && C.lb >= 0 && hvNum(g(r, C.lb)) !== null) kg = Math.round(hvNum(g(r, C.lb)) * 0.45359237 * 10) / 10;
    let km = hvNum(g(r, C.km)); if (km === null && C.mi >= 0 && hvNum(g(r, C.mi)) !== null) km = hvNum(g(r, C.mi)) * 1.609344;
    const reps = hvNum(g(r, C.reps)), sec = hvNum(g(r, C.sec));
    if (kg === null && reps === null && km === null && sec === null) { dropped++; continue; }
    e.sets.push({ wu: g(r, C.type).toLowerCase() === 'warmup', kg, reps, km, sec }); sets++;
  }
  const dayOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ws = [...byW.values()].filter(w => w.exs.size).map(w => ({ ...w, date: dayOf(w.start), exs: [...w.exs.values()].filter(e => e.sets.length) })).filter(w => w.exs.length).sort((a, b) => a.start - b.start);
  if (!ws.length) return { err: 'No workouts were found in that file.' };
  const have = new Set(data.logs.map(l => l.hevy).filter(Boolean)), fresh = ws.filter(w => !have.has(w.key));
  const titles = new Map(); fresh.forEach(w => titles.set(w.title, (titles.get(w.title) || 0) + 1));
  return { all: ws, fresh, dup: ws.length - fresh.length, titles: [...titles.entries()].sort((a, b) => b[1] - a[1]), bad, sets, supers, dropped,
    first: ws[0].date, last: ws[ws.length - 1].date, exN: new Set(ws.flatMap(w => w.exs.map(e => e.name))).size,
    km: ws.reduce((n, w) => n + w.exs.reduce((m, e) => m + e.sets.filter(s => s.km).length, 0), 0) };
}

/* turn one Hevy exercise into your exercise shape + sets */
function hvExercise(e) {
  const load = e.sets.some(s => s.kg > 0), timed = e.sets.some(s => s.sec > 0) && !e.sets.some(s => s.reps > 0);
  const maxKm = Math.max(0, ...e.sets.map(s => s.km || 0)), dist = maxKm > 0 ? (maxKm < 1 ? 'm' : 'km') : '';
  const sets = e.sets.map(s => ({ load: load && s.kg !== null ? String(s.kg) : '', reps: String(timed ? Math.round(s.sec || 0) : (s.reps ?? '')), done: true, ...(s.wu ? { wu: true } : {}), ...(dist && s.km ? { dist: String(dist === 'm' ? Math.round(s.km * 1000) : Math.round(s.km * 100) / 100) } : {}) }));
  return { id: 'hv-' + hvSlug(e.name), name: e.name, load, unit: timed ? 'seconds' : 'reps', dist, hint: '', rest: 0, optional: false, sets };
}

function hvRun() {
  const p = hv.plan; if (!p || !p.fresh.length) return;
  const free = []; { const used = new Set([...data.mySessions.map(s => s.key)]); for (const c of 'EFGHIJKLMNOP') if (!used.has(c)) free.push(c); }
  const titles = p.titles.map(t => t[0]), mergeLast = titles.length > free.length;
  if (!free.length) { hv.err = 'You already have 12 sessions of your own. Delete one first so the import has somewhere to go.'; refreshSheet(); return; }
  const own = mergeLast ? titles.slice(0, free.length - 1) : titles, keyOf = new Map();
  own.forEach((t, i) => keyOf.set(t, free[i]));
  const otherKey = mergeLast ? free[free.length - 1] : null;
  /* each session takes its exercises from the most recent workout with that name */
  const recent = new Map(); p.fresh.forEach(w => recent.set(keyOf.has(w.title) ? w.title : '__other', w));
  const mk = (key, title, w) => ({ key, title: title.slice(0, 40), emoji: '', type: 'Imported', minutes: 0, heavy: false, deleted: false,
    exercises: w.exs.slice(0, 25).map(e => { const x = hvExercise(e), n = e.sets.filter(s => !s.wu).length || e.sets.length, f = e.sets.find(s => !s.wu) || e.sets[0]; return { id: x.id + '-' + uid().slice(0, 4), name: x.name, sets: clamp(n, 1, 12), reps: String(x.unit === 'seconds' ? Math.round(f.sec || 30) : (f.reps ?? 8)) || '8', unit: x.unit, load: x.load, dist: x.dist, hint: '', rest: 0, optional: false }; }) });
  own.forEach(t => data.mySessions.push(mk(keyOf.get(t), t, recent.get(t))));
  if (otherKey) data.mySessions.push(mk(otherKey, 'Hevy workouts', recent.get('__other') || p.fresh[p.fresh.length - 1]));
  data.mySessions = cleanMySessions(data.mySessions); syncCustomSessions(data.mySessions, data.user.hideBuiltin);
  /* sessions stay out of the weekly plan */
  const act = activeSessions().filter(k => ![...keyOf.values(), otherKey].includes(k)); data.user.gymSessions = SESSION_KEYS.filter(k => act.includes(k)); if (!data.user.gymSessions.length) data.user.gymSessions = SESSION_KEYS.slice();
  let n = 0;
  for (const w of p.fresh) {
    const key = keyOf.get(w.title) || otherKey, mins = w.end ? Math.round((w.end - w.start) / 60000) : 0, notes = [w.desc, ...w.exs.filter(e => e.note).map(e => `${e.name}: ${e.note}`)].filter(Boolean).join('\n').slice(0, 600);
    data.logs.push({ id: uid(), date: w.date, session: key, completed: true, startedAt: w.start.toISOString(), completedAt: (w.end || w.start).toISOString(), rpe: '', notes, hevy: w.key,
      ...(mins > 0 && mins <= 360 ? { durationMin: mins } : {}), exercises: w.exs.map(hvExercise) }); n++;
  }
  data.logs.sort((a, b) => a.date.localeCompare(b.date));
  save(); const fromOb = hv.fromOb; hv.plan = null; hv.text = ''; closeAllSheets(); if (fromOb && typeof paintOb === 'function') { ob.hevy = n; paintOb(); } else render();
  toast(`Imported ${n} workout${n === 1 ? '' : 's'} from Hevy`);
}

const hvFmt = d => parseDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
function hvBody() {
  const p = hv.plan;
  if (!p) return { body: `<p class="tiny">In Hevy: Profile → Settings → Export &amp; Import Data → Export Workouts. It gives you a file called <b>workout_data.csv</b>. Choose it here. It is read on this phone and never uploaded.</p>
    <label class="hvpick btn ghost"><input id="hvfile" type="file" accept=".csv,text/csv,text/plain" data-in="hvfile" hidden>${icon('plus')}<span>${hv.busy ? 'Reading…' : 'Choose workout_data.csv'}</span></label>
    ${hv.err ? `<div class="status warn" role="alert">${esc(hv.err)}</div>` : ''}` };
  const lines = [`<li><b>${p.fresh.length}</b><span>workouts, ${hvFmt(p.first)} to ${hvFmt(p.last)}</span></li>`, `<li><b>${p.sets}</b><span>sets across ${p.exN} exercises</span></li>`];
  if (p.dup) lines.push(`<li><b>${p.dup}</b><span>already imported, skipped</span></li>`);
  return { body: `<ul class="hvsum">${lines.join('')}</ul>
    <div class="sxlab">Your Hevy workouts become sessions</div>
    <ul class="hvt">${p.titles.map(([t, n]) => `<li><span>${esc(t)}</span><small>${n} workout${n === 1 ? '' : 's'}</small></li>`).join('')}</ul>
    <p class="tiny">They are added as log-only sessions, so they won't change your weekly plan. Weights, reps, warm-ups, times and distances all come across, and exercises keep their Hevy names.${p.supers ? ` Hevy's superset pairing (${p.supers} sets) is not kept.` : ''}${p.dropped ? ` ${p.dropped} empty rows are skipped.` : ''}</p>
    ${hv.err ? `<div class="status warn" role="alert">${esc(hv.err)}</div>` : ''}`,
    footer: `<button type="button" class="btn ghost" data-act="hv.back">Back</button><button type="button" class="btn primary" data-act="hv.run" ${p.fresh.length ? '' : 'disabled'}>Import ${p.fresh.length} workout${p.fresh.length === 1 ? '' : 's'}</button>` };
}
INPUTS.hvfile = async el => {
  const f = el.files && el.files[0]; if (!f) return;
  if (f.size > 20 * 1024 * 1024) { hv.err = 'That file is too large for a Hevy export.'; refreshSheet(); return; }
  hv.busy = true; hv.err = ''; refreshSheet();
  try { hv.text = await f.text(); const r = hvParse(hv.text); if (r.err) { hv.err = r.err; hv.plan = null; } else hv.plan = r; } catch (_) { hv.err = 'Could not read that file.'; }
  hv.busy = false; refreshSheet();
};
ACTIONS['hevy.open'] = () => { hv.plan = null; hv.err = ''; hv.fromOb = false; openSheet({ title: 'Import from Hevy', eyebrow: 'YOUR WORKOUT HISTORY', size: 'tall', render: hvBody }); };
ACTIONS['ob.hevy'] = () => { hv.plan = null; hv.err = ''; hv.fromOb = true; openSheet({ title: 'Import from Hevy', eyebrow: 'YOUR WORKOUT HISTORY', size: 'tall', render: hvBody }); };
ACTIONS['hv.back'] = () => { hv.plan = null; hv.err = ''; refreshSheet(); };
ACTIONS['hv.run'] = () => hvRun();
