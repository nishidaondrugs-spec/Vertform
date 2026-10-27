'use strict';
/* VERTFORM 2.7 — create your own gym sessions.
   Each one has a name, exercises (sets, reps or time, unit, weight or not, rest, notes) and can be placed in your weekly plan and dragged like the built-in four.
   Stored in data.mySessions (keys E and up). Built-in A–D are never changed; start from a copy of one if you want. */

let se = null;
const blankEx = () => ({ name: '', sets: 3, reps: '8', unit: 'reps', load: true, rest: '', hint: '' });
const nextKey = () => { const used = new Set([...data.mySessions.map(s => s.key), ...data.logs.map(l => l.session)]); for (const c of 'EFGHIJKLMNOP') if (!used.has(c)) return c; return null; };

function openSessionEditor(key) {
  const cur = key ? data.mySessions.find(s => s.key === key) : null;
  se = cur ? { key, title: cur.title, type: cur.type, minutes: cur.minutes || '', heavy: cur.heavy, exercises: cur.exercises.map(e => ({ ...e })), inPlan: activeSessions().includes(key), idx: -1, ex: blankEx(), isNew: false, err: '' }
    : { key: null, title: '', type: '', minutes: '', heavy: false, exercises: [], inPlan: true, idx: -1, ex: blankEx(), isNew: true, err: '' };
  openSheet({ title: cur ? 'Edit session' : 'New session', eyebrow: 'YOUR SESSION', size: 'tall', render: renderSessionEditor });
}
ACTIONS['ys.new'] = () => openSessionEditor(null);
ACTIONS['ys.edit'] = el => openSessionEditor(el.dataset.id);

const exLine = e => `${e.sets} × ${esc(e.reps)}${e.unit !== 'reps' ? ' ' + esc(e.unit) : ''} · ${e.load ? 'weighted' : 'no weight'}${e.rest ? ` · rest ${e.rest}s` : ''}`;
function renderSessionEditor() {
  const x = se.ex;
  const rows = se.exercises.map((e, i) => `<li class="history-entry between ${se.idx === i ? 'editing' : ''}"><div class="min0"><strong>${esc(e.name)}</strong><div class="tiny">${exLine(e)}</div></div>
    <div class="quick tight"><button type="button" class="iconbtn" data-act="ys.up" data-id="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="iconbtn" data-act="ys.down" data-id="${i}" aria-label="Move down" ${i === se.exercises.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="iconbtn" data-act="ys.pick" data-id="${i}" aria-label="Edit ${esc(e.name)}">✎</button><button type="button" class="iconbtn" data-act="ys.del" data-id="${i}" aria-label="Remove ${esc(e.name)}">${icon('close')}</button></div></li>`).join('');
  const copy = se.isNew && !se.exercises.length ? `<div class="sxstart"><div class="sxlab">Start from</div><div class="sxscroll"><span class="chip on" aria-hidden="true">Blank</span>${Object.entries(YS_TEMPLATES).map(([id, t]) => `<button type="button" class="chip tpl" data-act="ys.tpl" data-id="${id}">${esc(t.title)}</button>`).join('')}${BUILTIN_KEYS.map(k => `<button type="button" class="chip" data-act="ys.copy" data-id="${k}">Copy of ${k}</button>`).join('')}</div></div>` : '';
  const xo = se.idx >= 0 || x.unit !== 'reps' || x.rest || x.hint || !x.load;
  const lastN = se.exercises.length;
  return { body: `<input id="setitle" class="sename" data-in="setitle" maxlength="40" autocomplete="off" aria-label="Session name" placeholder="Name your session" value="${esc(se.title)}">
    ${copy}
    <div class="sxhead"><b>${lastN ? plural(lastN, 'exercise') : 'Exercises'}</b></div>
    ${rows ? `<ul class="mlist">${rows}</ul>` : `<p class="sxempty">Nothing here yet. Search the library, or type your own below.</p>`}
    <button type="button" class="sxlib" data-act="lib.session">${icon('search')}<span>Search the exercise library</span>${icon('chev')}</button>
    <div class="exform sxform"><div class="sxlab">${se.idx >= 0 ? 'Edit exercise' : 'Or type your own'}</div>
      <input id="exn" data-in="exn" maxlength="80" autocomplete="off" aria-label="Exercise name" placeholder="Exercise name, e.g. Overhead press" value="${esc(x.name)}">
      <div class="sxrow"><div class="sxstep" role="group" aria-label="Sets"><button type="button" data-act="ys.sets" data-arg="-1" aria-label="Fewer sets">−</button><span><b id="exsv">${esc(String(x.sets))}</b><small>sets</small></span><button type="button" data-act="ys.sets" data-arg="1" aria-label="More sets">+</button></div>
        <div class="sxreps"><input id="exr" data-in="exr" maxlength="30" inputmode="text" aria-label="Reps or time" placeholder="8–10" value="${esc(x.reps)}"><small>${esc(x.unit)}</small></div></div>
      <details class="sxmore" ${xo ? 'open' : ''}><summary>More options</summary>
        <div class="form-row"><div class="field"><label for="exu">Counted in</label><select id="exu" data-in="exu">${['reps', 'seconds', 'metres'].map(u => `<option value="${u}" ${x.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div><div class="field"><label for="exrest">Rest (seconds)</label><input id="exrest" data-in="exrest" type="number" inputmode="numeric" min="0" max="600" placeholder="auto" value="${esc(String(x.rest))}"></div></div>
        <label class="switch"><span>Track weight</span><input type="checkbox" data-in="exload" ${x.load ? 'checked' : ''}></label>
        <div class="field"><label for="exh">Note</label><input id="exh" data-in="exh" maxlength="140" placeholder="cue, tempo, RIR…" value="${esc(x.hint)}"></div></details>
      <div class="quick"><button type="button" class="btn ${se.idx >= 0 ? 'primary' : 'ghost'}" data-act="ys.exsave">${se.idx >= 0 ? 'Update exercise' : icon('plus') + 'Add to session'}</button>${se.idx >= 0 ? '<button type="button" class="btn ghost" data-act="ys.excancel">Cancel</button>' : ''}</div></div>
    <details class="sxmore sxopts"><summary>Session options</summary>
      <div class="form-row"><div class="field"><label for="setype">Focus</label><input id="setype" data-in="setype" maxlength="30" placeholder="e.g. Upper / push" value="${esc(se.type)}"></div><div class="field"><label for="semin">Minutes</label><input id="semin" data-in="semin" type="number" inputmode="numeric" min="0" max="240" placeholder="auto" value="${esc(String(se.minutes))}"></div></div>
      <label class="switch"><span>Heavy leg day<small class="tiny block">Keep it 3+ days from a match</small></span><input type="checkbox" data-in="seheavy" ${se.heavy ? 'checked' : ''}></label>
      <label class="switch"><span>Add to my weekly plan<small class="tiny block">Off keeps it as a log-only session</small></span><input type="checkbox" data-in="seplan" ${se.inPlan ? 'checked' : ''}></label></details>
    ${se.err ? `<div class="status warn" role="alert">${esc(se.err)}</div>` : ''}`,
    footer: `${se.isNew ? '' : '<button type="button" class="btn ghost warnText" data-act="ys.delete">Delete</button>'}<button type="button" class="btn primary" data-act="ys.save">Save session</button>` };
}
ACTIONS['ys.sets'] = el => { const v = clamp((parseInt(se.ex.sets) || 3) + Number(el.dataset.arg), 1, 12); se.ex.sets = v; const o = $('#exsv'); if (o) o.textContent = v; };
INPUTS.setitle = el => { se.title = el.value; }; INPUTS.setype = el => { se.type = el.value; }; INPUTS.semin = el => { se.minutes = el.value; };
INPUTS.seheavy = el => { se.heavy = el.checked; }; INPUTS.seplan = el => { se.inPlan = el.checked; };
INPUTS.exn = el => { se.ex.name = el.value; }; INPUTS.exs = el => { se.ex.sets = el.value; }; INPUTS.exr = el => { se.ex.reps = el.value; };
INPUTS.exu = el => { se.ex.unit = el.value; }; INPUTS.exrest = el => { se.ex.rest = el.value; }; INPUTS.exload = el => { se.ex.load = el.checked; }; INPUTS.exh = el => { se.ex.hint = el.value; };
ACTIONS['ys.copy'] = el => { const k = el.dataset.id, t = templates[k]; se.exercises = allExercises(k).map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, unit: e.unit, load: e.load, hint: e.hint || '', rest: 0 })); if (!se.title.trim()) se.title = 'My ' + t.title; if (!se.type) se.type = t.type; se.heavy = k === 'A'; refreshSheet(); };
/* Ready-made volleyball sessions you can start from. Agility + landing comes from your own agility plan. */
const YS_TEMPLATES = {
  agility: { title: 'Agility + landing', type: 'Agility / plyo', minutes: 65, heavy: false, exercises: [
    ['Warm-up circuit', 2, '1 round', 'reps', false, '3 min light jog or bike first. Each round: 10 ankle pogos, 10 bodyweight squats, 8 walking lunges each leg, 10 m side shuffle each way, 10 m backpedal into sprint, 5 easy approach jumps.'],
    ['Snap-down to athletic stance', 3, '5', 'reps', false, 'Landing prep. Quiet feet, knees over toes, stable landing.'],
    ['Small drop landing', 3, '4', 'reps', false, 'Landing prep. Quiet feet, knees over toes, stable landing.'],
    ['Lateral stick landing', 3, '4 / side', 'reps', false, 'Landing prep. Stick it and hold. Quiet feet, knees over toes.'],
    ['Countermovement jumps', 4, '3', 'reps', false, 'Main plyo block. Rest properly, do not rush.'],
    ['Approach jumps', 5, '2', 'reps', false, 'Main plyo block. Full approach, maximum quality. Rest properly.'],
    ['Block jump → shuffle → block jump', 4, '3 sequences', 'reps', false, 'Main plyo block. Rest properly between sequences.'],
    ['Lateral bounds', 3, '4 / side', 'reps', false, 'Main plyo block. Stick each landing.'],
    ['5–10–5 shuttle', 5, '1', 'reps', false, 'Agility block. Rest 60–90 seconds between reps.'],
    ['Defensive reaction drill', 8, '1', 'reps', false, 'Start low. React left, right, short or deep. Touch the floor, recover to base.'],
    ['Transition footwork', 4, '1 round', 'reps', false, 'Defensive base, shuffle, floor touch, recover, approach footwork, controlled jump.'],
    ['Side plank', 2, '30 / side', 'seconds', false, 'Prehab and core.'],
    ['Band external rotations', 2, '15', 'reps', false, 'Prehab. Light band, slow and controlled.'],
    ['Calf eccentrics', 2, '10 / leg', 'reps', false, 'Prehab. Slow lowering.'],
    ['Cool-down stretch', 1, '5 min', 'reps', false, 'Calves, hips, glutes, adductors, ankles.']
  ] }
};
ACTIONS['ys.tpl'] = el => {
  const t = YS_TEMPLATES[el.dataset.id]; if (!t) return;
  se.exercises = t.exercises.map(([name, sets, reps, unit, load, hint]) => ({ id: 'cx-' + uid(), name, sets, reps, unit, load, hint, rest: 0 }));
  if (!se.title.trim()) se.title = t.title; if (!se.type) se.type = t.type; if (!se.minutes) se.minutes = t.minutes; se.heavy = t.heavy; se.inPlan = false; refreshSheet();
};
ACTIONS['ys.exsave'] = () => {
  const x = se.ex, n = x.name.trim(), sets = parseInt(x.sets), reps = String(x.reps).trim();
  if (!n || !reps || !(sets >= 1 && sets <= 12)) { se.err = 'Give the exercise a name, 1 to 12 sets and reps or time.'; refreshSheet(); return; }
  const rec = { id: se.idx >= 0 ? se.exercises[se.idx].id : 'cx-' + uid(), name: n, sets, reps, unit: x.unit, load: !!x.load, hint: x.hint.trim(), rest: clamp(parseInt(x.rest) || 0, 0, 600) };
  if (se.idx >= 0) se.exercises[se.idx] = rec; else se.exercises.push(rec);
  se.idx = -1; se.ex = blankEx(); se.err = ''; refreshSheet();
};
ACTIONS['ys.excancel'] = () => { se.idx = -1; se.ex = blankEx(); refreshSheet(); };
ACTIONS['ys.pick'] = el => { const i = Number(el.dataset.id), e = se.exercises[i]; se.idx = i; se.ex = { name: e.name, sets: e.sets, reps: e.reps, unit: e.unit, load: e.load, rest: e.rest || '', hint: e.hint || '' }; refreshSheet(); };
ACTIONS['ys.del'] = el => { se.exercises.splice(Number(el.dataset.id), 1); se.idx = -1; se.ex = blankEx(); refreshSheet(); };
const msMove = (i, d) => { const j = i + d; if (j < 0 || j >= se.exercises.length) return; [se.exercises[i], se.exercises[j]] = [se.exercises[j], se.exercises[i]]; se.idx = -1; refreshSheet(); };
ACTIONS['ys.up'] = el => msMove(Number(el.dataset.id), -1); ACTIONS['ys.down'] = el => msMove(Number(el.dataset.id), 1);
ACTIONS['ys.save'] = () => {
  const title = se.title.trim();
  if (!title) { se.err = 'Give the session a name.'; refreshSheet(); return; }
  if (!se.exercises.length) { se.err = 'Add at least one exercise.'; refreshSheet(); return; }
  const rec = { title, type: se.type.trim(), minutes: clamp(parseInt(se.minutes) || 0, 0, 240), heavy: se.heavy, deleted: false, exercises: se.exercises.map(e => ({ ...e, optional: false })) };
  let key = se.key;
  if (se.isNew) { key = nextKey(); if (!key) { se.err = 'You have reached the limit of 12 own sessions. Delete one first.'; refreshSheet(); return; } data.mySessions.push({ key, ...rec }); }
  else Object.assign(data.mySessions.find(s => s.key === key), rec);
  data.mySessions = cleanMySessions(data.mySessions); syncCustomSessions(data.mySessions, data.user.hideBuiltin);
  const act = activeSessions().filter(k => k !== key); data.user.gymSessions = SESSION_KEYS.filter(k => act.includes(k) || (k === key && se.inPlan));
  if (!data.user.gymSessions.length) data.user.gymSessions = SESSION_KEYS.slice();
  save(); closeAllSheets(); render(); toast(`“${title}” saved${se.inPlan ? ' and added to your week' : ''}`);
};
ACTIONS['ys.delete'] = async () => {
  const s = data.mySessions.find(x => x.key === se.key); if (!s) return;
  const ok = await askChoice({ title: `Delete “${s.title}”?`, message: '<p>It disappears from Train and your plan. Workouts you already logged with it stay in your history.</p>', choices: [{ label: 'Cancel', value: false }, { label: 'Delete', kind: 'primary', value: true }] }); if (!ok) return;
  s.deleted = true; data.pins = data.pins.filter(p => p.session !== s.key); syncCustomSessions(data.mySessions, data.user.hideBuiltin);
  data.user.gymSessions = data.user.gymSessions.filter(k => k !== s.key); if (!data.user.gymSessions.length) data.user.gymSessions = BUILTIN_KEYS.slice();
  save(); closeAllSheets(); render(); toast('Session deleted');
};
