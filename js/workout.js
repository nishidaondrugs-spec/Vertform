'use strict';
/* VERTFORM 2.0 — workout screen, previous-session comparison, personal bests and the rest timer.
   Workout drafts live in data.draft (same structure as before) and survive navigation, reloads and app restarts. */

/* =============== comparison & personal bests (completed sets only) =============== */
const num1 = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
/* 2.39: the same exercise is recognised by its name, ignoring capitals, spaces, punctuation, a trailing "s" and a one-letter typo or swap
   ("Bayesian curl", "bayesian curls", "Baysian Curl" all count as one), so history, last-time and PBs line up whatever you typed. */
const exKey = n => String(n || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '').replace(/s$/, '');
function editDist(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
function nameMatch(a, b) {
  const x = exKey(a), y = exKey(b); if (!x || !y) return false; if (x === y) return true;
  const m = Math.max(x.length, y.length); if (m < 5 || Math.abs(x.length - y.length) > 2) return false;
  return editDist(x, y) <= (m >= 12 ? 2 : 1);
}
const sameExercise = (a, b) => (a.id === b.id || nameMatch(a.name, b.name)) && !!a.load === !!b.load && (a.unit || 'reps') === (b.unit || 'reps');

/* Every completed earlier performance of the same exercise, newest first. Un-ticked sets never count. */
function exerciseHistory(cur, { before, excludeId } = {}) {
  const out = [];
  for (const l of data.logs) {
    if (!l.completed || l.id === excludeId) continue; if (before && l.date > before) continue;
    const e = l.exercises.find(x => sameExercise(x, cur)); if (!e) continue;
    const sets = e.sets.filter(s => s.done && !s.wu && num1(s.reps) !== null);
    if (sets.length) out.push({ log: l, date: l.date, completedAt: l.completedAt || '', sets, ex: e });
  }
  return out.sort((a, b) => (b.date + b.completedAt).localeCompare(a.date + a.completedAt));
}
const loadText = v => (num1(v) === 0 ? 'BW' : `${fmt(num1(v) ?? 0, 2)} kg`);
const unitSuffix = u => u === 'seconds' ? ' s' : u === 'metres' ? ' m' : '';
/* "60 kg × 8, 8, 7" — consecutive sets at the same load are grouped */
function formatSets(cur, sets) {
  if (cur.dist && !cur.load) return sets.map(s => `${s.dist ? s.dist + cur.dist + ' in ' : ''}${s.reps}${cur.unit === 'seconds' ? ' s' : cur.unit === 'metres' ? ' m' : ' reps'}`).join(', ');
  if (!cur.load) return sets.map(s => s.reps).join(', ') + (cur.unit === 'seconds' ? ' s' : cur.unit === 'metres' ? ' m' : ' reps');
  const groups = [];
  for (const s of sets) { const k = String(num1(s.load) ?? ''); const g = groups[groups.length - 1]; if (g && g.k === k) g.reps.push(s.reps); else groups.push({ k, load: s.load, reps: [s.reps] }); }
  return groups.map(g => `${g.k === '' ? '—' : loadText(g.load)} × ${g.reps.join(', ')}`).join(' · ');
}
function bestsOf(cur, hist) {
  const b = { maxLoad: null, repsAtLoad: {}, maxReps: null, hasHistory: hist.length > 0 };
  for (const h of hist) for (const s of h.sets) {
    const r = num1(s.reps); if (r === null) continue;
    if (cur.load) { const l = num1(s.load); if (l === null) continue; if (b.maxLoad === null || l > b.maxLoad) b.maxLoad = l; const k = String(l); if (!(k in b.repsAtLoad) || r > b.repsAtLoad[k]) b.repsAtLoad[k] = r; }
    else if (b.maxReps === null || r > b.maxReps) b.maxReps = r;
  }
  return b;
}
/* A personal best only exists where a like-for-like earlier record does: same exercise, same unit, same load type */
function setPB(cur, s, b) {
  if (!s.done || s.wu || !b.hasHistory) return null; const r = num1(s.reps); if (r === null) return null;
  if (cur.load) { const l = num1(s.load); if (l === null || b.maxLoad === null) return null; if (l > b.maxLoad) return { kind: 'load', text: `Heaviest load yet: ${loadText(l)}` }; if (l === b.maxLoad && r > (b.repsAtLoad[String(l)] ?? Infinity)) return { kind: 'reps', text: `Most reps at ${loadText(l)}` }; return null; }
  return b.maxReps !== null && r > b.maxReps ? { kind: 'reps', text: `Most ${cur.unit === 'seconds' ? 'seconds' : cur.unit === 'metres' ? 'metres' : 'reps'} in a set yet` } : null;
}

/* =============== rest timer (timestamp based) =============== */
const timer = { state: 'idle', endsAt: 0, total: 0, remaining: 0, label: '', exId: '', finishedAt: 0, lateMs: 0 };
let tickHandle = null, audioCtx = null, wakeLock = null;
function loadTimer() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY_TIMER) || 'null');
    if (t && ['running', 'paused', 'done'].includes(t.state) && Number.isFinite(t.endsAt)) Object.assign(timer, t);
  } catch (_) { /* ignore */ }
  if (timer.state === 'running' && Date.now() >= timer.endsAt) { timer.state = 'done'; timer.finishedAt = timer.endsAt; timer.lateMs = Date.now() - timer.endsAt; persistTimer(); }
  if (timer.state === 'running') startTicker();
}
function persistTimer() { try { if (timer.state === 'idle') localStorage.removeItem(KEY_TIMER); else localStorage.setItem(KEY_TIMER, JSON.stringify(timer)); } catch (_) { /* ignore */ } }
const timerRemaining = () => timer.state === 'running' ? Math.max(0, timer.endsAt - Date.now()) : timer.state === 'paused' ? timer.remaining : 0;
function unlockAudio() { try { if (!audioCtx) { const C = window.AudioContext || window.webkitAudioContext; if (C) audioCtx = new C(); } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (_) { /* ignore */ } }
function beep() {
  if (!data.settings.rest.sound || !audioCtx) return;
  try { const t0 = audioCtx.currentTime; [0, 0.22, 0.44].forEach((d, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'sine'; o.frequency.value = i === 2 ? 1040 : 784; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18); o.connect(g); g.connect(audioCtx.destination); o.start(t0 + d); o.stop(t0 + d + 0.2); }); } catch (_) { /* ignore */ }
}
const canVibrate = () => typeof navigator.vibrate === 'function';
function buzz() { if (data.settings.rest.vibrate && canVibrate()) try { navigator.vibrate([220, 90, 220]); } catch (_) { /* ignore */ } }
function startTicker() { if (!tickHandle) tickHandle = setInterval(timerTick, 250); }
function stopTicker() { clearInterval(tickHandle); tickHandle = null; }
function timerStart(sec, label, exId) {
  unlockAudio(); timer.state = 'running'; timer.total = sec * 1000; timer.endsAt = Date.now() + sec * 1000; timer.label = label || 'Rest'; timer.exId = exId || ''; timer.lateMs = 0; persistTimer(); startTicker(); paintTimer();
}
function timerPause() { if (timer.state !== 'running') return; timer.remaining = Math.max(0, timer.endsAt - Date.now()); timer.state = 'paused'; persistTimer(); stopTicker(); paintTimer(); }
function timerResume() { if (timer.state !== 'paused') return; unlockAudio(); timer.endsAt = Date.now() + timer.remaining; timer.state = 'running'; persistTimer(); startTicker(); paintTimer(); }
function timerAdd(sec) {
  if (timer.state === 'running') { timer.endsAt += sec * 1000; timer.total = Math.max(timer.total, timer.endsAt - Date.now()); if (timer.endsAt <= Date.now()) return timerFinish(); }
  else if (timer.state === 'paused') { timer.remaining = Math.max(0, timer.remaining + sec * 1000); timer.total = Math.max(timer.total, timer.remaining); if (timer.remaining === 0) { timerClear(); return; } }
  else if (timer.state === 'done' && sec > 0) return timerStart(sec, timer.label, timer.exId);
  persistTimer(); paintTimer();
}
function timerClear() { timer.state = 'idle'; stopTicker(); persistTimer(); paintTimer(); }
function timerFinish() {
  timer.state = 'done'; timer.finishedAt = Date.now(); timer.lateMs = 0; stopTicker(); persistTimer(); beep(); buzz(); paintTimer();
}
function timerTick() {
  if (timer.state !== 'running') return stopTicker();
  if (Date.now() >= timer.endsAt) { if (document.visibilityState === 'visible' && Date.now() - timer.endsAt < 5000) timerFinish(); else { timer.state = 'done'; timer.finishedAt = timer.endsAt; timer.lateMs = Date.now() - timer.endsAt; stopTicker(); persistTimer(); paintTimer(); } return; }
  paintTimerText();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { timerTick(); paintTimer(); if ($('#wk-root .wk')) requestWakeLock(); } else releaseWakeLock(); });
window.addEventListener('pageshow', () => { timerTick(); paintTimer(); });
async function requestWakeLock() { try { if (data.settings.rest.wakeLock !== false && 'wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (_) { wakeLock = null; } }
function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch (_) { /* ignore */ } wakeLock = null; }

/* Timer markup (used in the workout dock and as a floating pill elsewhere) */
function timerBarHTML() {
  if (timer.state === 'idle') return '';
  const rem = timerRemaining();
  if (timer.state === 'done') return `<div class="restcard done"><button type="button" class="rc-time" data-act="timer.open"><span class="rc-l">Rest over</span><b class="rc-c" data-tbtext>Go</b></button><div class="rc-ctrl"><button type="button" class="rc-pill" data-act="timer.add" data-arg="30">+30s</button><button type="button" class="rc-pill" data-act="timer.skip">Dismiss</button></div></div>`;
  return `<div class="restcard ${timer.state}"><button type="button" class="rc-time" data-act="timer.toggle" aria-label="Rest ${fmtClock(rem)}. Tap to ${timer.state === 'paused' ? 'resume' : 'pause'}"><span class="rc-l">${timer.state === 'paused' ? 'Paused' : 'Rest'}</span><b class="rc-c" data-tbtext>${fmtClock(rem)}</b></button><div class="rc-ctrl"><button type="button" class="rc-pill" data-act="timer.add" data-arg="15">+15s</button><button type="button" class="rc-pill" data-act="timer.skip">Skip</button></div></div>`;
}
function paintTimerText() {
  const rem = timerRemaining();
  $$('[data-tbtext]').forEach(n => { if (timer.state === 'running' || timer.state === 'paused') n.textContent = fmtClock(rem); });
  const pct = timer.total ? clamp(100 - rem / timer.total * 100, 0, 100) : 0; $$('[data-tbbar]').forEach(n => { n.style.width = pct + '%'; });
  const pill = $('#timer-pill [data-tbtext]'); if (pill) pill.textContent = fmtClock(rem);
}
function paintTimer() {
  const slot = $('#wk-timer'); if (slot) slot.innerHTML = timerBarHTML();
  paintPill();
}
function paintPill() {
  const el = $('#timer-pill'); if (!el) return; const inWk = !!$('#wk-root .wk');
  const hasTimer = timer.state !== 'idle', hasDraft = !!data.draft;
  if (inWk || (!hasTimer && !hasDraft) || ui.page === 'settings' && false) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  const draftTxt = hasDraft ? `${sName(data.draft.session)} in progress` : '';
  const timerTxt = hasTimer ? (timer.state === 'done' ? 'Rest over' : fmtClock(timerRemaining())) : '';
  el.innerHTML = `<button type="button" class="pill-btn ${timer.state}" data-act="${hasDraft ? 'wk.resume' : 'timer.open'}" aria-label="${hasDraft ? 'Resume workout' : 'Rest timer'}${hasTimer ? ', rest ' + timerTxt : ''}">${hasTimer ? `<span class="mono" data-tbtext>${timerTxt}</span>` : icon('play')}<span>${hasDraft ? draftTxt : esc(timer.label)}</span>${icon('chev')}</button>${hasTimer && hasDraft && timer.state !== 'done' ? '' : ''}`;
}
ACTIONS['timer.startdefault'] = () => { const e = currentExercise(); timerStart(e ? restFor(e) : 90, `Rest · ${e ? e.name : ''}`, e?.id); };
ACTIONS['timer.toggle'] = () => timer.state === 'paused' ? timerResume() : timerPause();
ACTIONS['timer.add'] = el => timerAdd(Number(el.dataset.arg));
ACTIONS['timer.skip'] = () => timerClear();
ACTIONS['timer.open'] = () => openTimerSheet();

function openTimerSheet() {
  const e = currentExercise();
  openSheet({ title: 'Rest timer', eyebrow: 'WORKOUT', render: () => {
    const r = data.settings.rest, rest = e ? restFor(e) : 90, custom = e && r.perExercise?.[e.id];
    return { body: `${e ? `<div class="field first"><label for="rtdef">Rest after each set of ${esc(e.name)} (seconds)</label><div class="inline"><input id="rtdef" type="number" inputmode="numeric" min="10" max="900" step="5" value="${rest}"><button type="button" class="btn ghost" data-act="timer.savedef">Save</button></div><div class="hint">${custom ? `Your setting. Suggested: ${defaultRestFor(e)} s. <button type="button" class="linkbtn" data-act="timer.resetdef">Use suggestion</button>` : `Suggested from this exercise's guidance. Change it and tap Save to keep your own.`}</div></div>` : ''}
      <div class="eyebrow mt">START A TIMER NOW</div><div class="chip-row">${[30, 45, 60, 90, 120, 180, 240].map(s => `<button type="button" class="chip" data-act="timer.preset" data-arg="${s}">${fmtClock(s * 1000)}</button>`).join('')}</div>
      <div class="divider"></div>${restSwitches()}
      <p class="note" hidden>The timer stores its end time, so it shows the correct remaining time when you switch apps, lock the phone and come back. Sound and vibration only play while VERTFORM is open on screen; this app cannot send alerts in the background. ${canVibrate() ? '' : 'Vibration is not supported by this browser (iPhone Safari does not support it).'} Sound may be silenced by your phone's silent mode.</p>`,
      footer: `<button type="button" class="btn primary grow" data-act="sheet.close">Done</button>` };
  } });
}
function restSwitches() {
  const r = data.settings.rest;
  return `<label class="switch"><span>Start automatically when I tick a set</span><input type="checkbox" data-in="restopt" data-key="auto" ${r.auto ? 'checked' : ''}></label>
    <label class="switch"><span>Play a sound when rest ends</span><input type="checkbox" data-in="restopt" data-key="sound" ${r.sound ? 'checked' : ''}></label>
    <label class="switch ${canVibrate() ? '' : 'disabled'}"><span>Vibrate when rest ends${canVibrate() ? '' : ' (not supported here)'}</span><input type="checkbox" data-in="restopt" data-key="vibrate" ${r.vibrate ? 'checked' : ''} ${canVibrate() ? '' : 'disabled'}></label>
    <label class="switch"><span>Keep the screen awake during a workout</span><input type="checkbox" data-in="restopt" data-key="wakeLock" ${r.wakeLock !== false ? 'checked' : ''}></label>`;
}
INPUTS.restopt = el => { data.settings.rest[el.dataset.key] = el.checked; save(); if (el.dataset.key === 'wakeLock') { el.checked ? requestWakeLock() : releaseWakeLock(); } if (el.dataset.key === 'sound' && el.checked) { unlockAudio(); beep(); } };
ACTIONS['timer.preset'] = el => { const e = currentExercise(); timerStart(Number(el.dataset.arg), `Rest${e ? ' · ' + e.name : ''}`, e?.id); closeSheet(); };
ACTIONS['timer.savedef'] = () => { const e = currentExercise(), v = Number($('#rtdef').value); if (!e || !(v >= 10 && v <= 900)) { toast('Enter 10 to 900 seconds'); return; } data.settings.rest.perExercise[e.id] = Math.round(v); save(); refreshSheet(); paintTimer(); toast(`Rest for ${e.name}: ${fmtClock(v * 1000)}`); };
ACTIONS['timer.resetdef'] = () => { const e = currentExercise(); if (!e) return; delete data.settings.rest.perExercise[e.id]; save(); refreshSheet(); paintTimer(); };

/* =============== workout draft =============== */
let wkIndex = 0;
const currentExercise = () => data.draft?.exercises?.[wkIndex] || null;
function parseReps(r) { const n = String(r).match(/^\d+/); return n ? n[0] : ''; }
function latestLoad(e0, before) {
  const id = e0.id, done = exerciseHistory({ id, name: e0.name, load: true, unit: 'reps' }, { before }).find(h => h.sets.some(s => s.load !== '' && s.load != null));
  if (done) return done.sets.find(s => s.load !== '' && s.load != null).load;
  for (const l of [...data.logs].reverse()) { const x = l.exercises?.find(x => x.id === id || nameMatch(x.name, e0.name)); if (x) { const s = x.sets.find(s => s.load !== '' && s.load !== undefined && s.load !== null); if (s) return s.load; } }
  return '';
}
function makeWorkout(k, date) {
  const w = weekFor(date), p = progression[w - 1], deload = isDeload(w);
  return { id: uid(), date, session: k, completed: false, startedAt: new Date().toISOString(), rpe: '', notes: '', exercises: allExercises(k).map(e => {
    let n = e.sets, reps = parseReps(e.reps);
    if (e.id === 'trap') { n = Number(p.sets.split(' ')[0]); reps = String(p.sets.split('× ')[1]); }
    else if (BUILTIN_KEYS.includes(k) && (deload || w === 1 && k !== 'A')) n = Math.max(1, Math.ceil(n * (w === 1 ? .8 : .5)));
    else if (k === 'C' && w === 1) n = Math.max(1, Math.ceil(n * .5));
    const defaultLoad = e.id === 'trap' && Number(data.user.trap1rm) > 0 ? fmt(Number(data.user.trap1rm) * (p.lo + p.hi) / 200 / 2.5, 0) * 2.5 : latestLoad(e, date);
    return { ...e, sets: Array.from({ length: n }, () => ({ load: e.load ? String(defaultLoad) : '', reps, done: false, ...(e.dist ? { dist: '' } : {}) })) };
  }) };
}
/* Start (or resume) a session on a specific date. The date always comes from the caller: today, or the day picked in the plan. */
async function startWorkout(k, date) {
  if (!allExercises(k).length) { openSessionEditor(k); toast('Add your exercises first'); return; }
  date = isISO(date) ? date : (ui.trainDate && isISO(ui.trainDate) ? ui.trainDate : todayISO());
  const d = data.draft;
  if (d) {
    if (d.session === k && d.date === date) { showWorkout(); return; }
    const c = await askChoice({ title: 'You have an unfinished workout', message: `<p>${esc(sName(d.session))} from <b>${esc(pretty(d.date))}</b> is still open (${d.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0)} sets ticked).</p><p>Starting ${esc(sName(k))} on ${esc(pretty(date))} will discard that draft.</p>`,
      choices: [{ label: `Resume ${sName(d.session)}`, value: 'resume', kind: 'primary' }, { label: `Discard it and start ${sName(k)}`, value: 'new', kind: 'critical' }, { label: 'Cancel', value: null, kind: 'ghost' }] });
    if (c === 'resume') { showWorkout(); return; } if (c !== 'new') return;
  }
  data.draft = makeWorkout(k, date); wkIndex = 0; save(); showWorkout();
}
function showWorkout() {
  if (!data.draft) return; closeAllSheets(); wkIndex = clamp(wkIndex, 0, data.draft.exercises.length - 1); paintWorkout(); requestWakeLock(); paintPill();
}
function closeWorkout(msg) {
  $('#wk-root').innerHTML = ''; releaseWakeLock(); updateScrollLock(); paintPill(); render(); if (msg) toast(msg);
}
ACTIONS['wk.resume'] = () => showWorkout();
ACTIONS['wk.start'] = el => startWorkout(el.dataset.id, el.dataset.arg || undefined);
ACTIONS['wk.close'] = () => { flushSave(); closeWorkout('Draft kept. Resume it from Today or Train.'); };

function exDone(e) { return e.sets.filter(s => s.done).length; }
function paintWorkout() {
  const w = data.draft; if (!w) { closeWorkout(); return; }
  const t = templates[w.session], wkNo = weekFor(w.date);
  const root = $('#wk-root'); const prevScroll = $('.wk-body', root)?.scrollTop || 0;
  root.innerHTML = `<div class="overlay wk-layer"><section class="wk" role="dialog" aria-modal="true" aria-label="Workout: ${esc(sName(w.session))}">
    <header class="wk-head"><button type="button" class="wk-ic" data-act="wk.close" aria-label="Close workout and keep draft">${icon('back')}</button>
      <div class="wk-mid"><small>${esc(weekdayShort(w.date))} ${esc(pretty(w.date))}</small><strong>${esc(t.title)}</strong></div>
      <button type="button" class="wk-ic" data-act="wk.menu" aria-label="Workout options">${icon('more')}</button></header>
    <div class="wk-progress" id="wk-progress" role="progressbar" aria-label="Workout progress">${progressSegs()}</div>
    <nav class="wk-tabs" id="wk-tabs" aria-label="Exercises">${wkTabs()}</nav>
    <main class="wk-body" id="wk-body" tabindex="-1">${exercisePanel()}</main>
    <footer class="wk-dock"><div id="wk-timer">${timerBarHTML()}</div><div class="wk-nav">${navButtons()}</div></footer></section></div>`;
  $('#wk-body').scrollTop = prevScroll; updateScrollLock(); paintPill(); wkTabsScroll();
}
function paintWorkoutBody(keepScroll = true) {
  const b = $('#wk-body'); if (!b) return paintWorkout(); const s = b.scrollTop;
  b.innerHTML = exercisePanel(); if (keepScroll) b.scrollTop = s; else b.scrollTop = 0;
  $('#wk-progress').innerHTML = progressSegs(); $('.wk-nav').innerHTML = navButtons(); paintTimer();
  const tb = $('#wk-tabs'); if (tb) { tb.innerHTML = wkTabs(); wkTabsScroll(); }
}
/* One tab per exercise: tap to go straight to it. Ticks once every set is done. */
function wkTabs() {
  return data.draft.exercises.map((e, i) => { const done = e.sets.length > 0 && exDone(e) === e.sets.length; return `<button type="button" class="wk-tab ${i === wkIndex ? 'cur' : ''} ${done ? 'done' : ''}" data-act="wk.goto" data-arg="${i}" aria-label="${esc(e.name)}${done ? ', done' : ''}" ${i === wkIndex ? 'aria-current="step"' : ''}><b>${done ? icon('check') : i + 1}</b></button>`; }).join('');
}
function wkTabsScroll() { const c = $('#wk-tabs .cur'); if (c && c.scrollIntoView) { try { c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' }); } catch (_) { /* ignore */ } } }
function progressSegs() {
  const all = data.draft.exercises.flatMap(e => e.sets), d = all.filter(x => x.done).length;
  return `<i style="width:${all.length ? Math.round(d / all.length * 100) : 0}%"></i>`;
}
function navButtons() {
  const last = wkIndex >= data.draft.exercises.length - 1, first = wkIndex === 0;
  return `${first ? '' : `<button type="button" class="wk-prevbtn" data-act="wk.prev" aria-label="Previous exercise">${icon('back')}</button>`}
    ${last ? `<button type="button" class="wk-cta" data-act="wk.finish">Finish workout</button>` : `<button type="button" class="wk-cta" data-act="wk.next">Next exercise</button>`}`;
}
function lastTimeBlock(e) {
  const hist = exerciseHistory(e, { before: data.draft.date, excludeId: data.draft.id }), last = hist[0];
  const plates = e.load ? `<button type="button" class="linkbtn" data-act="plates.open">Plates</button>` : '';
  if (!last) return `<div class="lastmini"><span>First time logging this</span><span class="lm-acts">${plates}</span></div>`;
  return `<div class="lastmini"><span>Last time ${esc(weekdayShort(last.date))} ${esc(pretty(last.date))}</span><span class="lm-acts"><button type="button" class="linkbtn" data-act="wk.uselast">Fill all</button><button type="button" class="linkbtn" data-act="wk.history">Progress</button>${plates}</span></div>`;
}
const distBit = (e, p) => e.dist && p && p.dist !== undefined && p.dist !== '' ? `${p.dist}${e.dist} · ` : '';
const prevText = (e, p) => !p ? '—' : e.dist && !e.load ? `${distBit(e, p)}${p.reps}${unitSuffix(e.unit)}` : e.load ? `${num1(p.load) === 0 ? 'BW' : fmt(num1(p.load) ?? 0, 2)} × ${p.reps}` : `${p.reps}${unitSuffix(e.unit)}`;
/* working sets of this exercise numbered 1..n; warm-ups show W and line up with nothing from last time */
function rowPrev(e, last) { let k = 0; return e.sets.map(s => s.wu ? null : (last?.sets[k++] || null)); }
function exercisePanel() {
  const w = data.draft, e = w.exercises[wkIndex], n = w.exercises.length;
  const hist = exerciseHistory(e, { before: w.date, excludeId: w.id }), best = bestsOf(e, hist);
  const unitName = e.unit === 'seconds' ? 'sec' : e.unit === 'metres' ? 'm' : 'reps';
  const prevs = rowPrev(e, hist[0]); let wn = 0;
  const rows = e.sets.map((s, j) => { const pb = setPB(e, s, best), p = prevs[j]; if (!s.wu) wn++;
    return `<div class="set-row ${s.done ? 'done' : ''} ${s.wu ? 'wu' : ''}" data-row="${j}"><span class="set-n"><button type="button" class="set-k" data-act="set.wu" data-i="${wkIndex}" data-j="${j}" aria-label="Set ${j + 1}${s.wu ? ', warm-up' : ''}. Tap to ${s.wu ? 'make it a working set' : 'mark as warm-up'}">${s.wu ? 'W' : wn}</button>${pb ? `<i class="pb" title="${esc(pb.text)}">PB<span class="vh"> — ${esc(pb.text)}</span></i>` : ''}</span>
      <button type="button" class="set-prev" data-act="set.prev" data-i="${wkIndex}" data-j="${j}" ${p && !s.done ? '' : 'disabled'} aria-label="${p ? `Last time ${esc(prevText(e, p))}. Tap to copy` : 'No previous set'}">${esc(s.wu ? 'warm-up' : prevText(e, p))}</button>
      ${e.dist ? `<label class="cell"><span class="vh">Distance in ${e.dist === 'km' ? 'kilometres' : 'metres'}, set ${j + 1}</span><input class="num" type="text" inputmode="decimal" enterkeyhint="next" data-in="setdist" data-i="${wkIndex}" data-j="${j}" value="${esc(s.dist ?? '')}"><span class="u" aria-hidden="true">${e.dist}</span></label>` : ''}
      ${e.load ? `<label class="cell"><span class="vh">Load in kilograms, set ${j + 1}</span><input class="num" type="number" inputmode="decimal" enterkeyhint="next" min="0" step="0.5" data-in="setload" data-i="${wkIndex}" data-j="${j}" value="${esc(s.load)}"><span class="u" aria-hidden="true">kg</span></label>` : e.dist ? '' : `<span class="cell na" aria-hidden="true">—</span>`}
      <label class="cell"><span class="vh">${unitName} for set ${j + 1}</span><input class="num" type="text" inputmode="decimal" enterkeyhint="done" data-in="setreps" data-i="${wkIndex}" data-j="${j}" value="${esc(s.reps)}"><span class="u" aria-hidden="true">${unitName === 'reps' ? '' : unitName}</span></label>
      <button type="button" class="set-done ${s.done ? 'done' : ''}" data-act="set.done" data-i="${wkIndex}" data-j="${j}" aria-pressed="${!!s.done}" aria-label="${s.done ? 'Undo' : 'Complete'} set ${j + 1}">${icon('check')}</button>
      </div>`; }).join('');
  const firstUndone = e.sets.findIndex(x => !x.done);
  const metaLoad = e.load ? ' · load in kg' : '';
  return `<div class="ex-head"><div class="eyebrow">Exercise ${wkIndex + 1} of ${n}${e.optional ? ' · optional' : ''}</div><h2>${esc(e.name)}</h2>
    <p class="wk-meta"><b>${e.sets.length} × ${esc(e.reps)}</b> ${esc(e.unit === 'reps' ? 'reps' : e.unit)}${metaLoad}</p></div>
    ${muscleBlock(e.name)}
    <div class="sets ${e.load ? '' : e.dist ? '' : 'noload'} ${e.load && e.dist ? 'threeinp' : ''}" data-cur="${firstUndone}" role="group" aria-label="Sets"><div class="set-head" aria-hidden="true"><span></span><span>Last time</span>${e.dist ? `<span>${e.dist === 'km' ? 'km' : 'm'}</span>` : ''}${e.load ? '<span>kg</span>' : (e.dist ? '' : '<span></span>')}<span>${unitName === 'reps' ? 'Reps' : unitName}</span><span></span></div>${rows.replace(new RegExp(`(<div class="set-row )([^"]*" data-row="${firstUndone}")`), '$1cur $2')}
    <button type="button" class="wk-addset" data-act="set.add" data-i="${wkIndex}">${icon('plus')}<span>Add set</span></button></div>
    <div class="pbline" id="pbline" aria-live="polite">${pbSummary(e, best)}</div>`;
}
function pbSummary(e, best) {
  const hits = e.sets.map(s => setPB(e, s, best)).filter(Boolean); if (!hits.length) return '';
  const seen = new Set(); return `<ul class="pbs">${hits.filter(h => !seen.has(h.text) && seen.add(h.text)).map(h => `<li>${tag('PB', 'clay')} ${esc(h.text)}</li>`).join('')}</ul>`;
}
/* the focus cue you wrote after the last completed session of this kind */
function lastFocus(session) {
  const l = data.logs.filter(x => x.completed !== false && x.session === session && x.focus).sort((a, b) => (b.completedAt || b.date).localeCompare(a.completedAt || a.date))[0];
  return l ? { text: l.focus, date: l.date } : null;
}
const focusNote = w => { const f = lastFocus(w.session); return f ? `<div class="focusnote"><span>FOCUS</span><b>${esc(f.text)}</b><small>from ${esc(pretty(f.date))}</small></div>` : ''; };
function readinessNote(w) {
  const p = progression[weekFor(w.date) - 1], ready = data.readiness[w.date]?.level || 'unset';
  const suggest = ready === 'red' ? 'High fatigue recorded for this day. Consider recovery instead of a hard session.' : ready === 'amber' ? 'Moderate readiness recorded: reduce hard sets and avoid high fatigue.' : 'Keep 1–3 reps in reserve for hypertrophy; never grind jumps.';
  return `${suggest} ${w.session === 'A' ? `Main lift: ${p.sets} @ ${p.pct} (RPE ≤8).` : ''}`;
}
ACTIONS['wk.ready'] = el => { const d = data.draft.date; data.readiness[d] = { ...(data.readiness[d] || {}), level: el.dataset.arg }; save(); paintWorkoutBody(); };
ACTIONS['wk.goto'] = el => { wkIndex = Number(el.dataset.arg); paintWorkoutBody(false); };
ACTIONS['wk.next'] = () => { wkIndex = Math.min(wkIndex + 1, data.draft.exercises.length - 1); paintWorkoutBody(false); };
ACTIONS['wk.prev'] = () => { wkIndex = Math.max(wkIndex - 1, 0); paintWorkoutBody(false); };
ACTIONS['wk.list'] = () => openSheet({ title: 'Exercises', eyebrow: `${sName(data.draft.session).toUpperCase()}`, render: () => ({ body: `<ul class="ex-list">${data.draft.exercises.map((e, i) => `<li style="display:flex;gap:6px;align-items:center"><button type="button" class="result ${i === wkIndex ? 'cur' : ''}" style="flex:1" data-act="wk.jump" data-arg="${i}"><span class="mono num-n">${pad2(i + 1)}</span><div class="grow"><strong>${esc(e.name)}</strong><small>${exDone(e)} of ${e.sets.length} sets done${e.optional ? ' · optional' : ''}</small></div>${icon('chev')}</button><button type="button" class="iconbtn" data-act="wk.rmex" data-arg="${i}" aria-label="Remove ${esc(e.name)}">${icon('trash')}</button></li>`).join('')}</ul>`, footer: `<button type="button" class="btn ghost" data-act="wk.addex">${icon('plus')}Add exercise</button><button type="button" class="btn primary grow" data-act="sheet.close">Close</button>` }) });
ACTIONS['wk.jump'] = el => { wkIndex = Number(el.dataset.arg); closeSheet(); paintWorkoutBody(false); };

INPUTS.setload = INPUTS.setreps = INPUTS.setdist = el => {
  const s = data.draft?.exercises[el.dataset.i]?.sets[el.dataset.j]; if (!s) return;
  s[el.dataset.in === 'setload' ? 'load' : el.dataset.in === 'setdist' ? 'dist' : 'reps'] = el.value; saveSoon(); updatePBs();
};
function updatePBs() {
  const e = currentExercise(); if (!e) return; const best = bestsOf(e, exerciseHistory(e, { before: data.draft.date, excludeId: data.draft.id }));
  $$('#wk-body .set-row').forEach((row, j) => { const n = row.querySelector('.set-n'), s = e.sets[j]; if (!s) return; const pb = setPB(e, s, best); const cur = n.querySelector('.pb'); if (pb && !cur) n.insertAdjacentHTML('beforeend', `<i class="pb">PB<span class="vh"> — ${esc(pb.text)}</span></i>`); else if (!pb && cur) cur.remove(); });
  const box = $('#pbline'); if (box) box.innerHTML = pbSummary(e, best);
}
ACTIONS['set.done'] = el => {
  unlockAudio(); const e = data.draft.exercises[el.dataset.i], s = e.sets[el.dataset.j]; if (!s) return;
  s.done = !s.done; saveSoon();
  const row = el.closest('.set-row'); row.classList.toggle('done', s.done); el.classList.toggle('done', s.done); el.setAttribute('aria-pressed', String(s.done)); el.setAttribute('aria-label', `${s.done ? 'Undo' : 'Complete'} set ${Number(el.dataset.j) + 1}`);
  $('#wk-progress').innerHTML = progressSegs(); updatePBs();
  if (s.done && data.settings.rest.auto) {
    const lastSet = data.draft.exercises.every(x => x.sets.every(q => q.done));
    if (!lastSet) timerStart(restFor(e), `Rest · ${e.name}`, e.id);
  }
  paintWorkoutBody();
};
ACTIONS['wk.delset'] = () => { const x = currentExercise(); if (x && x.sets.length > 1) { x.sets.pop(); save(); closeSheet(); paintWorkoutBody(); } else toast('An exercise needs at least one set'); };
ACTIONS['set.wu'] = el => { const s = data.draft.exercises[el.dataset.i]?.sets[el.dataset.j]; if (!s) return; s.wu = !s.wu; save(); paintWorkoutBody(); };
ACTIONS['set.prev'] = el => {
  const e = data.draft.exercises[el.dataset.i], j = Number(el.dataset.j), s = e?.sets[j]; if (!s || s.done) return;
  const p = rowPrev(e, exerciseHistory(e, { before: data.draft.date, excludeId: data.draft.id })[0])[j]; if (!p) return;
  s.reps = String(p.reps); if (e.load) s.load = String(p.load ?? ''); if (e.dist) s.dist = String(p.dist ?? ''); save(); paintWorkoutBody();
};
ACTIONS['set.add'] = el => { const x = data.draft.exercises[el.dataset.i], prev = x.sets.at(-1); x.sets.push({ load: prev?.load || '', reps: prev?.reps || parseReps(x.reps), done: false, wu: false, ...(x.dist ? { dist: prev?.dist || '' } : {}) }); save(); paintWorkoutBody(); };
ACTIONS['set.del'] = el => { const x = data.draft.exercises[el.dataset.i]; if (x.sets.length > 1) { x.sets.splice(el.dataset.j, 1); save(); paintWorkoutBody(); } };
ACTIONS['wk.uselast'] = () => {
  const w = data.draft, e = currentExercise(), last = exerciseHistory(e, { before: w.date, excludeId: w.id })[0]; if (!last) return;
  let changed = 0;
  let k = 0; e.sets.forEach(s => { if (s.wu) return; const src = last.sets[Math.min(k++, last.sets.length - 1)]; if (s.done) return; s.reps = String(src.reps); if (e.load) s.load = String(src.load ?? ''); if (e.dist) s.dist = String(src.dist ?? ''); changed++; });
  save(); paintWorkoutBody(); toast(changed ? `Filled ${plural(changed, 'set')} from ${pretty(last.date)}. Nothing is ticked until you tick it.` : 'All sets are already ticked.');
};
ACTIONS['wk.history'] = () => openExerciseHistory(currentExercise());
/* Estimated one-rep max (Epley) for a set; only 1–12 rep sets give a sensible estimate */
const e1rm = (load, reps) => { const w = num1(load), r = num1(reps); if (!(w > 0) || !(r >= 1)) return null; return r === 1 ? w : r <= 12 ? w * (1 + r / 30) : null; };
function progressChart(e, chron) {
  const pts = chron.map(h => ({ d: h.date, v: e.load ? Math.max(0, ...h.sets.map(s => e1rm(s.load, s.reps) || 0)) : Math.max(0, ...h.sets.map(s => num1(s.reps) || 0)) })).filter(p => p.v > 0);
  const what = e.load ? 'Estimated 1RM' : `Best set${unitSuffix(e.unit) ? ` (${unitSuffix(e.unit).trim()})` : ''}`;
  if (pts.length < 2) return `<div class="pchart one"><b>${what}</b><p class="tiny">${pts.length ? `${fmt(pts[0].v, 1)}${e.load ? ' kg' : ''} so far. The chart appears after your next session.` : 'Log a set with weight and 1–12 reps to see your estimate.'}</p></div>`;
  const W = 320, H = 150, L = 34, R = 10, T = 14, B = 24, vs = pts.map(p => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs); const span = Math.max(hi - lo, hi * .05, 2), step = [1, 2, 2.5, 5, 10, 20, 25, 50].find(t => t * 2 >= span / 1.4) || 50; lo = Math.max(0, Math.floor(lo / step) * step); hi = Math.ceil(hi / step) * step; if (hi === lo) hi = lo + step;
  const x = i => L + (W - L - R) * (pts.length === 1 ? .5 : i / (pts.length - 1)), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const first = pts[0].v, lastV = pts.at(-1).v, diff = lastV - first, unit = e.load ? ' kg' : '';
  let trend = ''; if (pts.length >= 3) { const n = pts.length, mx = (n - 1) / 2, my = vs.reduce((a, b) => a + b, 0) / n; let nu = 0, de = 0; vs.forEach((v, i) => { nu += (i - mx) * (v - my); de += (i - mx) ** 2; }); const sl = de ? nu / de : 0, y0 = my + sl * (0 - mx), y1 = my + sl * (n - 1 - mx); trend = `<path class="pc-trend" d="M${x(0).toFixed(1)},${y(Math.min(hi, Math.max(lo, y0))).toFixed(1)}L${x(n - 1).toFixed(1)},${y(Math.min(hi, Math.max(lo, y1))).toFixed(1)}"/>`; }
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 3}"><title>${esc(pretty(p.d))}: ${fmt(p.v, 1)}${unit}</title></circle>`).join('');
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += (hi - lo) / 2) ticks.push(v); const grid = ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v, 1)}</text>`).join('');
  return `<figure class="pchart" aria-label="${what} over ${pts.length} sessions, from ${fmt(first, 1)} to ${fmt(lastV, 1)}${unit}">
    <div class="pc-top"><div><span class="tiny">${what}</span><b>${fmt(lastV, 1)}${unit}</b></div><span class="pc-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '+' : ''}${fmt(diff, 1)}${unit} since ${esc(pretty(pts[0].d))}</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true"><g class="pc-grid">${grid}</g><path class="pc-line" d="${line}"/>${trend}<g class="pc-dots">${dots}</g>
    <text class="pc-x" x="${L}" y="${H - 6}">${esc(pretty(pts[0].d))}</text><text class="pc-x" x="${W - R}" y="${H - 6}" text-anchor="end">${esc(pretty(pts.at(-1).d))}</text></svg></figure>`;
}
function openExerciseHistory(e) {
  const hist = exerciseHistory(e, { before: data.draft?.date, excludeId: data.draft?.id }); const best = bestsOf(e, hist);
  // flag sessions that were a personal best when they happened (chronological pass)
  const chron = [...hist].reverse(); const running = []; const pbAt = new Map();
  chron.forEach(h => { const b = bestsOf(e, running); const hits = h.sets.map(s => setPB(e, { ...s, done: true }, b)).filter(Boolean); if (hits.length && running.length) pbAt.set(h.log.id, hits[0].text); running.push(h); });
  const mixed = new Set(hist.map(h => h.log.session)).size > 1, yr = todayISO().slice(0, 4), dl = d => d.slice(0, 4) === yr ? pretty(d) : prettyY(d);
  openSheet({ title: e.name, size: 'tall', render: () => ({ body: hist.length ? `${progressChart(e, chron)}
    <ul class="hist2">${hist.slice(0, 40).map(h => `<li><span class="h-d">${esc(dl(h.date))}${mixed ? ` <small>${esc(sName(h.log.session))}</small>` : ''}</span><span class="h-s">${esc(formatSets(e, h.sets))}${pbAt.has(h.log.id) ? ` <i class="pbt" title="${esc(pbAt.get(h.log.id))}">PB</i>` : ''}</span></li>`).join('')}</ul>${hist.length > 40 ? `<p class="note">Showing the latest 40 of ${hist.length}.</p>` : ''}` : emptyBox('No completed sets for this exercise yet. Tick sets as you complete them and they will appear here.'), footer: `<button type="button" class="btn primary grow" data-act="sheet.close">Close</button>` }) });
}

/* workout options */
ACTIONS['wk.menu'] = () => openSheet({ title: 'Workout options', eyebrow: `${sName(data.draft.session).toUpperCase()}`, render: () => {
  const w = data.draft; return { body: `<div class="field first"><label for="wkdate">Session date</label><input id="wkdate" type="date" data-in="wkdate" value="${esc(w.date)}"><div class="hint">Last-time comparisons use sessions on or before this date.</div></div>
    <div class="list-actions">${data.draft.exercises[wkIndex]?.load ? `<button type="button" class="btn ghost full" data-act="plates.open">${icon('plus')}Plate calculator</button>` : ''}<button type="button" class="btn ghost full" data-act="wk.uselast">${icon('check')}Fill sets from last time</button><button type="button" class="btn ghost full" data-act="wk.history">${icon('list')}This exercise's progress</button><button type="button" class="btn ghost full" data-act="wk.delset">${icon('trash')}Remove last set</button><button type="button" class="btn ghost full" data-act="timer.open">${icon('timer')}Rest timer settings</button><button type="button" class="btn ghost full" data-act="wk.list">${icon('list')}Jump to an exercise</button><button type="button" class="btn ghost full" data-act="wk.addex">${icon('plus')}Add an exercise</button><button type="button" class="btn ghost full" data-act="wk.rmex" data-arg="${wkIndex}">${icon('trash')}Remove this exercise</button><button type="button" class="btn critical full" data-act="wk.discard">${icon('trash')}Discard this draft</button></div>
    ${data.readiness[w.date]?.level ? '' : `<div class="field"><label>How do you feel today?</label><div class="wkready" role="group">${READY_OPTS.map(([k, n]) => `<button type="button" data-act="wk.ready" data-arg="${k}">${n}</button>`).join('')}</div></div>`}
    ${withRow(w)}<p class="note">Your draft saves automatically and stays here if you leave, switch apps or close VERTFORM.</p>`, footer: `<button type="button" class="btn primary grow" data-act="wk.menuok">Done</button>` };
} });
/* adding and removing exercises mid-workout lives in library.js */
INPUTS.wkdate = el => { if (isISO(el.value) && data.draft) { data.draft.date = el.value; save(); } };
ACTIONS['wk.menuok'] = () => { closeSheet(); paintWorkout(); };
ACTIONS['wk.discard'] = async () => {
  if (!await askConfirm({ title: 'Discard this draft?', message: `<p>The unfinished ${esc(sName(data.draft.session))} and its ticked sets will be deleted. Saved workouts are not affected.</p>`, confirmLabel: 'Discard draft', danger: true })) return;
  data.draft = null; timerClear(); save(); closeAllSheets(); closeWorkout('Draft discarded');
};

/* finishing */
let finishRPE = '';
let finishPhoto = '', finishBusy = false;
INPUTS.wkphoto = async el => {
  const f = el.files && el.files[0]; if (!f || !/^image\//.test(f.type)) return;
  finishBusy = true; refreshSheet();
  try { finishPhoto = await pShrink(f); } catch (_) { toast('Could not read that photo'); }
  finishBusy = false; refreshSheet();
};
ACTIONS['wk.photo'] = () => $('#wkphotofile')?.click();
ACTIONS['wk.photo.clear'] = () => { finishPhoto = ''; refreshSheet(); };
ACTIONS['wk.finish'] = () => {
  const w = data.draft; finishRPE = w.rpe || '';
  openSheet({ title: 'Finish workout', eyebrow: `${sName(w.session).toUpperCase()} · ${pretty(w.date).toUpperCase()}`, render: () => {
    const total = sum(w.exercises, e => e.sets.length), done = sum(w.exercises, e => exDone(e));
    const photoRow = typeof lbCfg === 'function' && lbCfg() ? `<div class="finishphoto"><input type="file" id="wkphotofile" data-in="wkphoto" accept="image/*" capture="user" hidden>${finishPhoto ? `<div class="fp-pic"><img src="${finishPhoto}" alt="Your photo"><button type="button" class="pthumbx" data-act="wk.photo.clear" aria-label="Remove photo">${icon('close')}</button></div>` : `<button type="button" class="fp-add" data-act="wk.photo" ${finishBusy ? 'disabled' : ''}>${icon('camera')}<span>${finishBusy ? 'Preparing…' : 'Add a photo to your post'}</span></button>`}</div>` : '';
    return { body: `${photoRow}<div class="fin-sum"><b>${done}<small> / ${total}</small></b><span>sets ticked${done < total ? ` · ${total - done} not counted` : ' · all done'}</span></div>
      <div class="fin-rpe"><div class="fin-l"><span>How hard was it?</span><em>${Number(finishRPE) ? `${finishRPE} · ${['', 'Very easy', 'Easy', 'Easy', 'Steady', 'Steady', 'Hard', 'Hard', 'Very hard', 'Max effort', 'Max effort'][Number(finishRPE)]}` : 'Optional'}</em></div><div class="rpe-grid" role="radiogroup" aria-label="Session RPE">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button type="button" role="radio" aria-checked="${Number(finishRPE) === n}" class="rpe ${Number(finishRPE) === n ? 'on' : ''}" data-act="wk.rpe" data-arg="${n}">${n}</button>`).join('')}</div></div>
      <div class="field"><label for="wknotes">Notes</label><textarea id="wknotes" data-in="wknotes" rows="2" placeholder="Jump quality, energy, technique, recovery…">${esc(w.notes)}</textarea></div>
      <details class="fin-more"><summary>More details</summary>${withRow(w)}<div class="field"><label for="wkfocus">Focus for next time</label><input id="wkfocus" data-in="wkfocus" maxlength="100" autocomplete="off" placeholder="One cue for your next ${esc(sName(w.session))}" value="${esc(w.focus || '')}"></div></details>`,
      footer: `${typeof lbCfg === 'function' && lbCfg() ? `<label class="sharetog"><input type="checkbox" id="wkshare" ${data.settings.shareWk === false ? '' : 'checked'}><span>Share to friends</span></label>` : ''}<button type="button" class="btn ghost" data-act="sheet.close">Back</button><button type="button" class="btn primary grow" data-act="wk.save">${icon('check')}Save workout</button>` };
  } });
};
ACTIONS['wk.rpe'] = el => { finishRPE = String(Number(finishRPE) === Number(el.dataset.arg) ? '' : el.dataset.arg); data.draft.rpe = finishRPE; saveSoon(); const n = $('#wknotes')?.value; refreshSheet(); if (n !== undefined && $('#wknotes')) $('#wknotes').value = n; };
INPUTS.wkfocus = el => { if (data.draft) { data.draft.focus = el.value.slice(0, 100); saveSoon(); } };
INPUTS.wknotes = el => { if (data.draft) { data.draft.notes = el.value; saveSoon(); } };
ACTIONS['wk.save'] = () => {
  const w = data.draft; if (!w) return; const shareBox = $('#wkshare'), share = !!shareBox?.checked; if (shareBox) data.settings.shareWk = share; w.rpe = finishRPE || ''; w.notes = $('#wknotes')?.value ?? w.notes; w.focus = String($('#wkfocus')?.value ?? w.focus ?? '').trim().slice(0, 100); w.completed = true; w.completedAt = new Date().toISOString();
  const prior = data.logs.findIndex(x => x.id === w.id); if (prior >= 0) data.logs[prior] = w; else data.logs.push(w);
  const summary = share ? wkSummary(w) : null;
  data.draft = null; timerClear(); save(); closeAllSheets();
  const fph = finishPhoto; finishPhoto = '';
  if (summary) shareWorkout(summary, fph);
  const id = w.id; closeWorkout(); toast(`${sName(w.session)} saved`, { action: { label: 'View', fn: () => openLogView(id) } });
};

/* =============== saved workout records =============== */
function openLogView(id) {
  const l = data.logs.find(x => x.id === id); if (!l) return;
  openSheet({ title: templates[l.session]?.title || sName(l.session), eyebrow: `${weekdayShort(l.date)} ${pretty(l.date)}${l.rpe ? ` · RPE ${l.rpe}` : ''}`, size: 'tall', render: () => ({
    body: `<ul class="hist2 logex2">
      ${l.exercises.map((e, i) => { const done = e.sets.filter(s => s.done); return `<li><button type="button" class="exlink" data-act="ex.progress" data-id="${esc(l.id)}" data-arg="${i}">${esc(e.name)}</button><span class="h-s">${done.length ? esc(formatSets(e, done.filter(s => !s.wu).length ? done.filter(s => !s.wu) : done)) : '<span class="tiny">skipped</span>'}</span></li>`; }).join('')}</ul>
      ${cleanWith(l.with).length ? `<p class="tiny">Trained with ${esc(cleanWith(l.with).join(', '))}</p>` : ''}${l.notes ? `<p class="lognote">${esc(l.notes)}</p>` : ''}${l.focus ? `<p class="tiny">Focus next time: ${esc(l.focus)}</p>` : ''}`,
    footer: `<button type="button" class="btn critical" data-act="log.remove" data-id="${esc(l.id)}" aria-label="Delete this workout">${icon('trash')}</button><button type="button" class="btn ghost grow" data-act="log.edit" data-id="${esc(l.id)}">${icon('edit')}Edit</button><button type="button" class="btn primary" data-act="sheet.close">Done</button>` }) });
}
ACTIONS['log.view'] = el => openLogView(el.dataset.id);
ACTIONS['ex.progress'] = el => { const e = data.logs.find(x => x.id === el.dataset.id)?.exercises[el.dataset.arg]; if (e) openExerciseHistory(e); };
ACTIONS['log.edit'] = async el => {
  const log = data.logs.find(x => x.id === el.dataset.id); if (!log) return;
  if (data.draft && !(data.draft.id === log.id) && !await askConfirm({ title: 'Replace your unfinished draft?', message: `<p>${esc(sName(data.draft.session))} from ${esc(pretty(data.draft.date))} is still open. Opening this record for editing will discard that draft.</p>`, confirmLabel: 'Replace draft', danger: true })) return;
  data.draft = deepCopy({ ...log, completed: false }); wkIndex = 0; save(); closeAllSheets(); showWorkout();
};
ACTIONS['log.remove'] = async el => {
  const l = data.logs.find(x => x.id === el.dataset.id); if (!l) return;
  if (!await askConfirm({ title: 'Delete this workout?', message: `<p>${esc(sName(l.session))} on ${esc(prettyY(l.date))} will be removed from your history. This cannot be undone, but you can restore everything from a backup.</p>`, confirmLabel: 'Delete workout', danger: true })) return;
  data.logs = data.logs.filter(x => x.id !== l.id); save(); closeAllSheets(); render(); toast('Workout removed');
};

/* chronological running number across all sessions (gym + volleyball) — the "session numbers" of the notebook */
function sessionNumber(id) {
  const all = [...data.logs.filter(l => l.completed).map(l => ({ id: l.id, k: l.date + (l.completedAt || '')})), ...data.vb.logs.map(l => ({ id: l.id, k: l.date + (l.createdAt || '') }))].sort((a, b) => a.k.localeCompare(b.k));
  const i = all.findIndex(x => x.id === id); return pad2(i + 1).padStart(3, '0');
}
const nextSessionNumber = () => String(data.logs.filter(l => l.completed).length + data.vb.logs.length + 1).padStart(3, '0');

/* =============== workout summary (feed card) =============== */
const wkVolume = w => Math.round(sum(w.exercises, e => e.load ? sum(e.sets.filter(s => s.done && !s.wu), s => (num1(s.load) || 0) * (num1(s.reps) || 0)) : 0));
function wkTopLine(e, sets) {
  const reps = [...new Set(sets.map(s => String(s.reps)))], u = unitSuffix(e.unit);
  if (!e.load) return reps.length === 1 ? `${sets.length} × ${reps[0]}${u}` : `${sets.length} sets · best ${Math.max(...sets.map(s => num1(s.reps) || 0))}${u}`;
  const top = [...sets].sort((a, b) => (num1(b.load) || 0) - (num1(a.load) || 0) || (num1(b.reps) || 0) - (num1(a.reps) || 0))[0], tl = num1(top.load) === 0 ? 'BW' : `${fmt(num1(top.load) || 0, 2)} kg`;
  return reps.length === 1 ? `${sets.length} × ${reps[0]} · ${tl}` : `${sets.length} sets · top ${tl} × ${top.reps}`;
}
/* Compact enough for the server's 600-character meta limit: drops exercises from the end until it fits */
function wkSummary(w) {
  const tot = sum(w.exercises, e => e.sets.filter(s => !s.wu).length), done = sum(w.exercises, e => e.sets.filter(s => s.done && !s.wu).length);
  const mins = w.startedAt && w.completedAt ? Math.round((Date.parse(w.completedAt) - Date.parse(w.startedAt)) / 60000) : null;
  const rows = []; let pbs = 0;
  w.exercises.forEach(e => {
    const sets = e.sets.filter(s => s.done && !s.wu && num1(s.reps) !== null); if (!sets.length) return;
    const best = bestsOf(e, exerciseHistory(e, { before: w.date, excludeId: w.id })), pb = sets.some(s => setPB(e, s, best)); if (pb) pbs++;
    rows.push([String(e.name).trim().slice(0, 28), wkTopLine(e, sets).slice(0, 30), pb ? 1 : 0]);
  });
  const m = { t: String(templates[w.session]?.title || sName(w.session)).slice(0, 40), d: w.date, ex: w.exercises.length, s: done, of: tot, rpe: Number(w.rpe) || null, min: mins > 0 && mins <= 300 ? mins : null, vol: wkVolume(w) || null, pb: pbs, l: rows.slice(0, 6) };
  while (JSON.stringify(m).length > 580 && m.l.length) m.l.pop();
  return m;
}
async function shareWorkout(meta, photo) {
  const c = typeof lbCfg === 'function' && lbCfg(); if (!c) return;
  try {
    const r = await lbCall('vf_post_create', { p_id: c.id, p_secret: c.secret, p_body: '', p_kind: 'gym', p_meta: meta, p_photo: photo || null, p_video: null, p_day: todayISO() });
    (r?.purged || []).forEach(f => fetch(`${LB_URL}/storage/v1/object/vf-media/${f}`, { method: 'DELETE', headers: { apikey: LB_KEY } }).catch(() => {}));
    if (photo && r?.id && typeof pPhotos !== 'undefined') pPhotos[r.id] = photo;
    if (typeof pUi !== 'undefined') pUi.at = 0;
  } catch (e) { toast(`Saved, but not shared: ${typeof pErr === 'function' ? pErr(e.message) : e.message}`); }
}

/* =============== plate calculator =============== */
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const plateUi = { w: '' };
function platesFor(total, bar) {
  let side = (total - bar) / 2; const out = [];
  if (!(side > 0)) return { out, rest: side < 0 ? side * 2 : 0 };
  for (const p of PLATES) while (side >= p - 1e-9) { out.push(p); side = Math.round((side - p) * 1000) / 1000; }
  return { out, rest: Math.round(side * 2 * 100) / 100 };
}
function plateResult() {
  const w = num1(plateUi.w), bar = Number(data.settings.bar ?? 20);
  if (w === null || w <= 0) return `<p class="tiny">Type the total weight on the bar.</p>`;
  if (w < bar) return `<p class="tiny">That is lighter than the ${bar} kg bar.</p>`;
  const { out, rest } = platesFor(w, bar), made = w - rest;
  const vis = out.map(p => `<i class="plate p${String(p).replace('.', '_')}" style="--h:${Math.round(36 + p * 2.6)}px">${fmt(p, 2)}</i>`).join('');
  return `<div class="platebar" aria-hidden="true"><span class="sleeve"></span>${vis}<span class="collar"></span></div>
    <p class="plateline">${out.length ? `Each side: <b>${out.map(p => fmt(p, 2)).join(' + ')}</b>` : 'Just the bar.'}</p>
    ${rest > 0 ? `<p class="tiny">Can't make exactly ${fmt(w, 2)} kg with standard plates. Closest: ${fmt(made, 2)} kg.</p>` : ''}`;
}
ACTIONS['plates.open'] = () => {
  const e = currentExercise(), s = e?.sets.find(x => !x.done && num1(x.load) > 0) || e?.sets.find(x => num1(x.load) > 0); plateUi.w = s ? String(s.load) : '';
  openSheet({ title: 'Plates', eyebrow: e ? e.name : '', render: () => ({ body: `<div class="field first"><label for="plw">Total weight (kg)</label><input id="plw" type="number" inputmode="decimal" step="0.5" min="0" data-in="plw" value="${esc(plateUi.w)}"></div>
    <div class="field"><label>Bar</label><div class="seg" role="radiogroup" aria-label="Bar weight">${[20, 15, 10].map(b => `<button type="button" role="radio" aria-checked="${Number(data.settings.bar ?? 20) === b}" class="${Number(data.settings.bar ?? 20) === b ? 'on' : ''}" data-act="plates.bar" data-arg="${b}">${b} kg</button>`).join('')}</div></div>
    <div id="plres">${plateResult()}</div>`, footer: `<button type="button" class="btn primary grow" data-act="sheet.close">Done</button>` }) });
};
INPUTS.plw = el => { plateUi.w = el.value; const r = $('#plres'); if (r) r.innerHTML = plateResult(); };
ACTIONS['plates.bar'] = el => { data.settings.bar = Number(el.dataset.arg); save(); plateUi.w = $('#plw')?.value ?? plateUi.w; refreshSheet(); };
