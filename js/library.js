'use strict';
/* VERTFORM 2.39 — exercise library, adding and removing exercises during a workout.
   The library is built from everything you have used (built-in sessions, your own sessions, workouts you logged) plus exercises you add by hand
   (data.catalogue) and exercises friends shared in recent gym posts. Names are matched ignoring capitals, spaces and small typos (see nameMatch in workout.js). */

let lib = { mode: 'browse', q: '', scope: 'today', shown: [] };
let lf = null;

const libLine = e => `${e.sets} × ${esc(e.reps)}${e.unit !== 'reps' ? ' ' + esc(e.unit) : ''} · ${e.load ? 'weighted' : 'no weight'}`;
/* which exercises already sit in the place being added to (the session being edited, today's workout, or a saved session) */
const libTargetList = () => lib.mode === 'workout' ? (data.draft?.exercises || []) : lib.mode === 'session' ? (typeof se !== 'undefined' && se ? se.exercises : []) : lib.mode === 'target' ? allExercises(lib.target) : [];
const libHas = name => libTargetList().some(e => nameMatch(e.name, name));
const LIB_SRC = { yours: 'Yours', 'built-in': 'Built-in', session: 'In a session', logged: 'Logged before', friend: 'Friend' };

/* exercises friends shared in the posts already loaded on this phone (names only; their notes and weights are not shared) */
function friendExercises() {
  const out = [], rows = typeof pUi !== 'undefined' && Array.isArray(pUi.rows) ? pUi.rows : [];
  for (const r of rows) {
    if (r.mine || r.kind !== 'gym' || !r.meta || !Array.isArray(r.meta.l)) continue;
    for (const x of r.meta.l) {
      const name = String(x?.[0] || '').trim(); if (!name) continue;
      const top = String(x[1] || ''), m = top.match(/^(\d+) × ([^ ·]+)/);
      out.push({ name, sets: m ? clamp(parseInt(m[1]) || 3, 1, 12) : 3, reps: m ? m[2] : '10', unit: 'reps', load: /kg/.test(top), hint: '', rest: 0 });
    }
  }
  return out;
}
function libraryItems() {
  const items = [];
  const add = (e, src) => {
    const name = String(e.name || '').trim(), unit = e.unit || 'reps'; if (!name) return;
    if (items.some(x => nameMatch(x.name, name))) return;   /* one entry per exercise, whichever way it was saved */
    items.push({ name: name.slice(0, 80), sets: clamp(parseInt(e.sets) || 3, 1, 12), reps: String(e.reps || '10'), unit, load: !!e.load, dist: ['m', 'km'].includes(e.dist) ? e.dist : '', hint: e.hint || '', rest: e.rest || 0, src, id: src === 'yours' ? e.id : null });
  };
  data.catalogue.forEach(e => add(e, 'yours'));
  BUILTIN_KEYS.forEach(k => templates[k].exercises.forEach(e => add(e, 'built-in')));
  BUILTIN_KEYS.forEach(k => (data.custom[k] || []).forEach(e => add(e, 'session')));
  data.mySessions.forEach(s => s.exercises.forEach(e => add(e, 'session')));
  [...data.logs].reverse().forEach(l => (l.exercises || []).forEach(e => add({ name: e.name, sets: (e.sets || []).length || 3, reps: e.sets?.[0]?.reps || e.reps, unit: e.unit, load: e.load, hint: '' }, 'logged')));
  friendExercises().forEach(e => add(e, 'friend'));
  return items.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/* every word you type must match a word of the name, allowing capitals, a trailing "s" and a one-letter typo or swap */
function libMatches(name, q) {
  const toks = q.split(/\s+/).filter(Boolean); if (!toks.length) return true;
  const nl = name.toLowerCase(), words = nl.split(/[^a-z0-9]+/).filter(Boolean);
  return toks.every(t => nl.includes(t) || words.some(w => w.startsWith(t) || nameMatch(w, t)));
}
function libResults() {
  const q = lib.q.trim().toLowerCase(), all = libraryItems();
  lib.shown = all.filter(x => libMatches(x.name, q)).slice(0, 250);
  if (!lib.shown.length) return emptyBox(q ? 'Nothing matches. Use <b>New exercise</b> to add it.' : 'No exercises yet.');
  return lib.shown.map((x, i) => {
    const act = lib.mode === 'browse'
      ? (x.src === 'yours' ? `<button type="button" class="btn sm ghost" data-act="lib.edit" data-id="${i}">Edit</button>` : `<button type="button" class="btn sm ghost" data-act="lib.save" data-id="${i}">${icon('plus')}Save</button>`)
      : libHas(x.name) ? `<button type="button" class="libplus done" data-act="lib.pick" data-id="${i}" aria-label="Add ${esc(x.name)} again">${icon('check')}</button>` : `<button type="button" class="libplus" data-act="lib.pick" data-id="${i}" aria-label="Add ${esc(x.name)}">${icon('plus')}</button>`;
    const added = lib.mode !== 'browse' && libHas(x.name) ? '' : '';
    return `<div class="between history-entry"><div class="min0"><strong>${esc(x.name)}</strong> ${tag(LIB_SRC[x.src], x.src === 'yours' ? 'sage' : '')}${added}<div class="tiny">${libLine(x)}</div></div>${act}</div>`;
  }).join('');
}
const hiddenCount = () => Object.values(data.hiddenEx || {}).reduce((n, a) => n + a.length, 0);
function renderLibrary() {
  const m = lib.mode, k = data.draft?.session;
  const scope = m === 'workout' ? `<div class="field first"><label>Add it</label><div class="seg" role="radiogroup" aria-label="Where to add">
      <button type="button" role="radio" aria-checked="${lib.scope === 'today'}" class="${lib.scope === 'today' ? 'on' : ''}" data-act="lib.scope" data-arg="today">Just today</button>
      <button type="button" role="radio" aria-checked="${lib.scope === 'keep'}" class="${lib.scope === 'keep' ? 'on' : ''}" data-act="lib.scope" data-arg="keep">Keep in ${esc(k ? sName(k) : 'session')}</button></div><div class="hint">${lib.scope === 'keep' ? 'It also appears in your future ' + esc(k ? sName(k) : 'session') + ' workouts.' : 'Only in today’s workout.'}</div></div>` : '';
  const haveFriends = friendExercises().length > 0, canLoad = typeof lbCfg === 'function' && lbCfg() && typeof pUi !== 'undefined' && !haveFriends;
  const intro = m === 'browse' ? `<p class="note ${scope ? '' : 'first'}">Everything you have used, plus exercises you add. <b>Save</b> keeps one in your own list; <b>New exercise</b> adds one from scratch.</p>` : '';
  return { body: `${scope}${intro}<div class="field ${scope || intro ? '' : 'first'}"><label for="libq">Search exercises</label><input id="libq" data-in="libq" type="search" autocomplete="off" placeholder="e.g. bayesian curl" value="${esc(lib.q)}"></div>
    <div id="libres" class="results mt">${libResults()}</div>
    ${canLoad ? `<div class="goalcard"><p class="tiny">Want exercises your friends use? Load their recent gym posts and they appear here with a Friend tag.</p><button type="button" class="btn ghost" data-act="lib.friends">Load friends' exercises</button></div>` : ''}
    ${m === 'browse' && hiddenCount() ? `<div class="goalcard"><p class="tiny">${plural(hiddenCount(), 'built-in exercise')} removed from A–D for good.</p><button type="button" class="btn ghost" data-act="lib.unhide">Restore them</button></div>` : ''}`,
    footer: `<button type="button" class="btn ghost" data-act="lib.new">${icon('plus')}New exercise</button><button type="button" class="btn primary grow" data-act="sheet.close">Done</button>` };
}
function openLibrary(opts = {}) {
  lib = { mode: opts.mode || 'browse', q: '', scope: 'today', shown: [], target: opts.target || null };
  openSheet({ title: lib.mode === 'browse' ? 'Exercise library' : 'Pick an exercise', eyebrow: lib.mode === 'workout' ? 'ADD TO WORKOUT' : lib.mode === 'session' ? 'ADD TO SESSION' : lib.mode === 'target' ? `ADD TO ${esc(sName(lib.target)).toUpperCase()}` : 'YOUR EXERCISES', size: 'tall', autofocus: '#libq', render: renderLibrary });
}
INPUTS.libq = el => { lib.q = el.value; const b = $('#libres'); if (b) b.innerHTML = libResults(); };
ACTIONS['lib.open'] = () => openLibrary({ mode: 'browse' });
ACTIONS['lib.session'] = () => openLibrary({ mode: 'session' });
ACTIONS['lib.scope'] = el => { lib.scope = el.dataset.arg; const q = $('#libq')?.value; refreshSheet(); const i = $('#libq'); if (i && q) i.value = q; };
ACTIONS['lib.friends'] = async () => { if (typeof postLoad !== 'function') return; toast('Loading friends’ posts…'); await postLoad(); refreshSheet(); if (!friendExercises().length) toast('No friends’ gym posts to take exercises from yet'); };
ACTIONS['lib.unhide'] = () => { data.hiddenEx = {}; save(); refreshSheet(); render(); toast('Built-in exercises restored'); };

/* save an entry into your own list (updates the one with the same name instead of duplicating) */
function libSaveEntry(rec) {
  let cur = rec.id ? data.catalogue.find(x => x.id === rec.id) : null;
  if (!cur) cur = data.catalogue.find(x => nameMatch(x.name, rec.name) && !!x.load === !!rec.load && x.unit === rec.unit);
  if (cur) { Object.assign(cur, rec, { id: cur.id }); return cur; }
  if (data.catalogue.length >= 500) { toast('Your library holds up to 500 exercises'); return null; }
  const e = { ...rec, id: 'lib-' + uid() }; data.catalogue.push(e); return e;
}
ACTIONS['lib.save'] = el => {
  const x = lib.shown[Number(el.dataset.id)]; if (!x) return;
  if (!libSaveEntry({ name: x.name, sets: x.sets, reps: x.reps, unit: x.unit, load: x.load, hint: x.hint, rest: x.rest })) return;
  save(); refreshSheet(); toast(`${x.name} saved to your library`);
};
ACTIONS['lib.edit'] = el => { const x = lib.shown[Number(el.dataset.id)]; if (x) openLibForm(x, 'browse'); };
ACTIONS['lib.new'] = () => openLibForm(null, lib.mode);

/* ---------- new / edit form ---------- */
function openLibForm(x, after) {
  lf = { id: x?.id || null, name: x?.name || '', sets: x?.sets ?? 3, reps: x?.reps ?? '8–10', unit: x?.unit || 'reps', load: x ? !!x.load : true, rest: x?.rest || '', hint: x?.hint || '', after, err: '' };
  openSheet({ title: lf.id ? 'Edit exercise' : 'New exercise', eyebrow: 'EXERCISE LIBRARY', size: 'tall', autofocus: lf.name ? null : '#lfn', render: renderLibForm });
}
function renderLibForm() {
  const label = lf.after === 'workout' ? 'Save & add to workout' : lf.after === 'session' || lf.after === 'target' ? 'Save & add to session' : 'Save exercise';
  return { body: `<div class="field first"><label for="lfn">Name</label><input id="lfn" data-in="lf" maxlength="80" autocomplete="off" placeholder="e.g. Bayesian curl" value="${esc(lf.name)}"></div>
    <div class="form-row"><div class="field"><label for="lfs">Sets</label><input id="lfs" data-in="lf" type="number" inputmode="numeric" min="1" max="12" value="${esc(String(lf.sets))}"></div><div class="field"><label for="lfr">Reps or time</label><input id="lfr" data-in="lf" maxlength="30" value="${esc(lf.reps)}"></div></div>
    <div class="form-row"><div class="field"><label for="lfu">Counted in</label><select id="lfu" data-in="lf">${['reps', 'seconds', 'metres'].map(u => `<option value="${u}" ${lf.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div><div class="field"><label for="lfrest">Rest (seconds)</label><input id="lfrest" data-in="lf" type="number" inputmode="numeric" min="0" max="600" placeholder="auto" value="${esc(String(lf.rest))}"></div></div>
    <label class="switch"><span>Track weight for this exercise</span><input id="lfload" type="checkbox" data-in="lf" ${lf.load ? 'checked' : ''}></label>
    <div class="field"><label for="lfh">Note (optional)</label><input id="lfh" data-in="lf" maxlength="140" placeholder="cue, tempo, RIR…" value="${esc(lf.hint)}"></div>
    <p class="tiny">Capitals and small spelling differences do not matter: “Bayesian curls” and “baysian curl” are compared as the same exercise.</p>
    ${lf.err ? `<div class="status warn" role="alert">${esc(lf.err)}</div>` : ''}`,
    footer: `${lf.id ? `<button type="button" class="btn critical" data-act="lf.delete" aria-label="Delete from library">${icon('trash')}</button>` : ''}<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="lf.save">${label}</button>` };
}
INPUTS.lf = el => { const m = { lfn: 'name', lfs: 'sets', lfr: 'reps', lfu: 'unit', lfrest: 'rest', lfh: 'hint' }; if (el.id === 'lfload') lf.load = el.checked; else if (m[el.id]) lf[m[el.id]] = el.value; };
ACTIONS['lf.save'] = () => {
  const name = lf.name.trim(), sets = parseInt(lf.sets), reps = String(lf.reps).trim();
  if (!name || !reps || !(sets >= 1 && sets <= 12)) { lf.err = 'Give it a name, 1 to 12 sets and reps or time.'; refreshSheet(); return; }
  const entry = libSaveEntry({ id: lf.id, name, sets, reps, unit: lf.unit, load: !!lf.load, hint: lf.hint.trim(), rest: clamp(parseInt(lf.rest) || 0, 0, 600) });
  if (!entry) return;
  save(); closeSheet();
  if (lf.after === 'workout' || lf.after === 'session' || lf.after === 'target') libAdd(entry); else toast(`${name} saved`);
};
ACTIONS['lf.delete'] = async () => {
  if (!await askConfirm({ title: 'Delete from library?', message: '<p>It leaves your own list. Sessions and workouts that already use it are not changed.</p>', confirmLabel: 'Delete', danger: true })) return;
  data.catalogue = data.catalogue.filter(x => x.id !== lf.id); save(); closeSheet(); toast('Removed from library');
};

/* ---------- adding to a session being edited, or to the workout in progress ---------- */
ACTIONS['lib.pick'] = el => { const x = lib.shown[Number(el.dataset.id)]; if (x) libAdd(x); };
async function libAdd(x) {
  if (lib.mode !== 'browse' && libHas(x.name)) {
    const where = lib.mode === 'workout' ? 'this workout' : lib.mode === 'target' ? sName(lib.target) : 'this session';
    if (!await askConfirm({ title: `${x.name} is already in ${where}`, message: '<p>Adding it again gives you two of the same exercise. Most people do not need that.</p>', confirmLabel: 'Add it again', cancelLabel: 'Leave it' })) return;
  }
  if (lib.mode === 'session') {
    if (typeof se === 'undefined' || !se) return;
    if (se.exercises.length >= 25) { toast('A session holds up to 25 exercises'); return; }
    se.exercises.push({ id: 'cx-' + uid(), name: x.name, sets: x.sets, reps: x.reps, unit: x.unit, load: x.load, hint: x.hint || '', rest: x.rest || 0, dist: x.dist || '' });
    se.err = ''; refreshSheet(); toast(`${x.name} added · ${plural(se.exercises.length, 'exercise')} so far`); return;
  }
  if (lib.mode === 'target') { if (sessAdd(lib.target, x)) { refreshSheet(); render(); toast(`${x.name} added to ${sName(lib.target)}`); } return; }
  if (lib.mode === 'workout') addToWorkout(x, lib.scope);
}
/* saved sessions: add or take out an exercise for good (used by the Sessions tab) */
function sessAdd(k, x) {
  const my = data.mySessions.find(s => s.key === k && !s.deleted);
  if (allExercises(k).length >= 25) { toast('A session holds up to 25 exercises'); return false; }
  if (BUILTIN_KEYS.includes(k)) (data.custom[k] ||= []).push(ex('custom-' + uid(), x.name, x.sets, x.reps, x.unit, x.load, x.hint || 'Custom exercise'));
  else if (my) { my.exercises.push({ id: 'cx-' + uid(), name: x.name, sets: x.sets, reps: x.reps, unit: x.unit, load: x.load, hint: x.hint || '', optional: false, rest: x.rest || 0, dist: x.dist || '' }); data.mySessions = cleanMySessions(data.mySessions); syncCustomSessions(data.mySessions, data.user.hideBuiltin); }
  else return false;
  save(); return true;
}
function sessRemove(k, id) {
  const my = data.mySessions.find(s => s.key === k && !s.deleted);
  if (allExercises(k).length < 2) { toast('A session needs at least one exercise'); return false; }
  if ((data.custom[k] || []).some(x => x.id === id)) data.custom[k] = data.custom[k].filter(x => x.id !== id);
  else if (my && my.exercises.some(x => x.id === id)) { my.exercises = my.exercises.filter(x => x.id !== id); data.mySessions = cleanMySessions(data.mySessions); syncCustomSessions(data.mySessions, data.user.hideBuiltin); }
  else if (BUILTIN_KEYS.includes(k)) { data.hiddenEx = data.hiddenEx || {}; (data.hiddenEx[k] ||= []).push(id); }
  else return false;
  save(); return true;
}
function addToWorkout(x, scope) {
  const w = data.draft; if (!w) return;
  const k = w.session, my = data.mySessions.find(s => s.key === k && !s.deleted); let id = 'day-' + uid();
  if (scope === 'keep') {
    if (BUILTIN_KEYS.includes(k)) { id = 'custom-' + uid(); (data.custom[k] ||= []).push(ex(id, x.name, x.sets, x.reps, x.unit, x.load, x.hint || 'Custom exercise')); }
    else if (my) {
      if (my.exercises.length >= 25) { toast('A session holds up to 25 exercises'); return; }
      id = 'cx-' + uid(); my.exercises.push({ id, name: x.name, sets: x.sets, reps: x.reps, unit: x.unit, load: x.load, hint: x.hint || '', optional: false, rest: x.rest || 0, dist: x.dist || '' });
      data.mySessions = cleanMySessions(data.mySessions); syncCustomSessions(data.mySessions, data.user.hideBuiltin);
    }
  }
  const e = { id, name: x.name, sets: x.sets, reps: x.reps, unit: x.unit, load: x.load, hint: x.hint || (scope === 'keep' ? 'Added to this session' : 'Added on the day'), optional: false, rest: x.rest || 0 };
  const ld = x.load ? String(latestLoad(e, w.date)) : '';
  w.exercises.push({ ...e, sets: Array.from({ length: x.sets }, () => ({ load: ld, reps: parseReps(x.reps), done: false })) });
  wkIndex = w.exercises.length - 1; save(); closeAllSheets(); paintWorkoutBody(false);
  toast(scope === 'keep' ? `${x.name} added, and kept in ${sName(k)}` : `${x.name} added for today`);
}
ACTIONS['wk.addex'] = () => { if (data.draft) openLibrary({ mode: 'workout' }); };

/* ---------- removing an exercise from the workout in progress ---------- */
ACTIONS['wk.rmex'] = async el => {
  const w = data.draft; if (!w) return;
  const i = Number(el.dataset.arg), e = w.exercises[i]; if (!e) return;
  if (w.exercises.length < 2) { toast('A workout needs at least one exercise'); return; }
  const k = w.session, my = data.mySessions.find(s => s.key === k && !s.deleted);
  const where = (data.custom[k] || []).some(x => x.id === e.id) ? 'custom' : my && my.exercises.some(x => x.id === e.id) ? 'mine' : (BUILTIN_KEYS.includes(k) && templates[k]?.exercises.some(x => x.id === e.id)) ? 'builtin' : 'oneoff';
  const canForever = where === 'custom' || where === 'builtin' || (where === 'mine' && my.exercises.length > 1);
  const ticked = exDone(e);
  const choices = [{ label: 'Cancel', value: null, kind: 'ghost' }, { label: canForever ? 'Just today' : 'Remove', value: 'today', kind: 'primary' }];
  if (canForever) choices.push({ label: `Remove from ${sName(k)} for good`, value: 'always', kind: 'critical' });
  const c = await askChoice({ title: `Remove ${e.name}?`, message: `<p>${ticked ? `Its ${plural(ticked, 'ticked set')} in this workout will be dropped. ` : ''}${canForever ? '“Just today” only changes this workout. “For good” also takes it out of your future ' + esc(sName(k)) + ' workouts. Saved workouts are never changed.' : 'It is only in today’s workout.'}</p>`, choices });
  if (!c || !data.draft || data.draft.id !== w.id) return;
  if (c === 'always') {
    if (where === 'custom') data.custom[k] = data.custom[k].filter(x => x.id !== e.id);
    else if (where === 'mine') { my.exercises = my.exercises.filter(x => x.id !== e.id); data.mySessions = cleanMySessions(data.mySessions); syncCustomSessions(data.mySessions, data.user.hideBuiltin); }
    else if (where === 'builtin') { data.hiddenEx = data.hiddenEx || {}; (data.hiddenEx[k] ||= []).push(e.id); }
  }
  w.exercises.splice(i, 1); if (i < wkIndex) wkIndex--; wkIndex = clamp(wkIndex, 0, w.exercises.length - 1);
  save(); closeAllSheets(); paintWorkoutBody(false);
  toast(c === 'always' ? `${e.name} removed from ${sName(k)}` : `${e.name} removed for today`, c === 'today' ? { action: { label: 'Undo', fn: () => { if (!data.draft || data.draft.id !== w.id) return; w.exercises.splice(i, 0, e); wkIndex = i; save(); paintWorkoutBody(false); } } } : {});
};
