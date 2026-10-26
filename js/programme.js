'use strict';
/* VERTFORM 2.0 — training programme (unchanged prescriptions) and flexible weekly scheduling */

const ex = (id, name, sets, reps, unit = 'reps', load = false, hint = '', optional = false) => ({ id, name, sets, reps, unit, load, hint, optional });

const templates = {
  A: { title: 'Strength + vertical', subtitle: 'Force production & maximum jump', type: 'POWER / LOWER', duration: '75–85 min', colour: 'orange', exercises: [
    ex('approach', 'Full approach jumps', 3, '2', 'reps', false, 'Maximum-quality outside-hitter approach. Rest 60–120 sec.'),
    ex('trap', 'Trap-bar deadlift', 3, '3', 'reps', true, 'Main strength lift. RPE ≤8, rest 3 min.'),
    ex('cmj', 'Countermovement jump', 3, '2', 'reps', false, 'Maximum height. Pair with trap bar only if jump quality holds.'),
    ex('split', 'Bulgarian split squat', 2, '6 / leg', 'reps', true, 'RPE 7, controlled descent.'),
    ex('rdl', 'Romanian deadlift', 2, '6', 'reps', true, 'RPE 7; omit if already fatigued.'),
    ex('calf', 'Standing calf raise', 2, '8–12', 'reps', true, 'RIR 2.'),
    ex('copenh', 'Copenhagen plank', 2, '20 / side', 'seconds', false, 'Quality adductor control.')] },
  B: { title: 'Lat width + biceps', subtitle: 'V-taper hypertrophy', type: 'UPPER / PULL', duration: '65–75 min', colour: 'blue', exercises: [
    ex('pullup', 'Weighted pull-up', 3, '6–8', 'reps', true, 'Record added load in kg; use 0 for bodyweight.'),
    ex('chestrow', 'Chest-supported row', 3, '8–12', 'reps', true, 'Controlled full range.'),
    ex('singlelat', 'Single-arm cable lat pulldown', 2, '10–15', 'reps', true, 'Each side.'),
    ex('inclcurl', 'Incline dumbbell curl', 3, '8–12', 'reps', true, 'Controlled lowering.'),
    ex('lateral', 'Cable lateral raise', 2, '12–20', 'reps', true, 'Keep shoulders comfortable.'),
    ex('inclpress', 'Incline dumbbell press', 2, '8–12', 'reps', true, 'RIR 2–3.'),
    ex('rot', 'Cable external rotation', 2, '12–15', 'reps', true, 'Light and controlled.')] },
  C: { title: 'Reactive power + jump', subtitle: 'Low fatigue, high-speed movement', type: 'POWER / PRIMER', duration: '25–50 min', colour: 'orange', exercises: [
    ex('pogo', 'Low pogos', 2, '6', 'reps', false, 'Quick, controlled contacts.'),
    ex('lateralbound', 'Lateral bounds', 2, '2 / side', 'reps', false, 'Stick the landing; avoid heavy fatigue.'),
    ex('jumpsquat', 'Light jump squat', 3, '3', 'reps', true, 'Bodyweight or very light loading. Move fast.'),
    ex('shuffle', 'Shuffle / acceleration', 3, '5', 'metres', false, 'Optional if space and recovery allow.', true),
    ex('calfiso', 'Calf isometric hold', 2, '20', 'seconds', false, 'Moderate effort.')] },
  D: { title: 'Back thickness + arms', subtitle: 'Back, rear delts & biceps', type: 'UPPER / HYPERTROPHY', duration: '45–70 min', colour: 'blue', exercises: [
    ex('pulldown', 'Neutral-grip lat pulldown', 3, '8–12', 'reps', true, 'RIR 2.'),
    ex('cablerow', 'Seated cable row', 2, '10–12', 'reps', true, 'Scapular control.'),
    ex('reverse', 'Reverse pec deck', 2, '12–20', 'reps', true, 'Controlled rear delt movement.'),
    ex('preacher', 'Preacher curl', 2, '8–12', 'reps', true, 'RIR 1–2.'),
    ex('hammer', 'Dumbbell hammer curl', 2, '10–15', 'reps', true, 'RIR 1–2.'),
    ex('laterald', 'Lateral raise', 2, '12–20', 'reps', true, 'RIR 1–2.'),
    ex('pressd', 'Flat dumbbell press', 2, '8–12', 'reps', true, 'RIR 2–3.'),
    ex('rotd', 'Cable external rotation', 2, '12–15', 'reps', true, 'Light and controlled.')] }
};
const SESSION_KEYS = ['A', 'B', 'C', 'D'];
const BUILTIN_KEYS = ['A', 'B', 'C', 'D'];
/* Heavy lower-body days are kept away from matches. Session A always is; your own sessions can opt in. */
const sName = k => templates[k]?.custom ? templates[k].title : 'Session ' + k;
const sBadge = k => templates[k]?.custom ? ((templates[k].title.trim()[0] || '•').toUpperCase()) : k;
const sChip = k => templates[k]?.custom ? templates[k].title : `${k} · ${templates[k].title}`;
/* Team trainings are described by intensity, not by drills. Each level maps to a session RPE. */
const INTENSITY = { light: { label: 'Light', rpe: 3, hint: 'Easy, could chat' }, moderate: { label: 'Moderate', rpe: 5, hint: 'Steady, working' }, hard: { label: 'Hard', rpe: 7, hint: 'Tough, few words' }, max: { label: 'Max', rpe: 9, hint: 'All out' } };
const intensityOfRpe = r => { r = Number(r); return !r ? '' : r <= 3 ? 'light' : r <= 5 ? 'moderate' : r <= 7 ? 'hard' : 'max'; };
const trainInfoFor = date => { const t = data.vb.trainInfo?.[String(dayIndex(date))]; return { name: t?.name || 'Team training', intensity: t?.intensity || 'moderate', min: t?.min || 90 }; };
const isHeavy = k => k === 'A' || !!templates[k]?.heavy;
/* Your own sessions live in data.mySessions. This adds them to templates/SESSION_KEYS (deleted ones keep a template so old logs still show their name). */
function syncCustomSessions(list, hide) {
  for (const k of Object.keys(templates)) if (templates[k].custom) delete templates[k];
  SESSION_KEYS.length = 0; if (!hide) SESSION_KEYS.push(...BUILTIN_KEYS);
  for (const s of (Array.isArray(list) ? list : [])) {
    const sets = s.exercises.reduce((n, e) => n + e.sets, 0), est = Math.max(10, Math.round((sets * 2.5 + 5) / 5) * 5);
    templates[s.key] = { custom: true, deleted: !!s.deleted, heavy: !!s.heavy, title: s.title, subtitle: 'Your session', type: (s.type || 'CUSTOM').toUpperCase(), duration: s.minutes ? `~${s.minutes} min` : `~${est} min`, colour: 'blue', exercises: s.exercises.map(e => ({ ...e })) };
    if (!s.deleted) SESSION_KEYS.push(s.key);
  }
}

const progression = [
  { sets: '3 × 3', pct: '78–80%', lo: 78, hi: 80, upper: '80% volume', power: 'Half' },
  { sets: '3 × 3', pct: '80–82%', lo: 80, hi: 82, upper: 'Full', power: 'Full' },
  { sets: '3 × 3', pct: '82–85%', lo: 82, hi: 85, upper: 'Progress reps', power: 'Full' },
  { sets: '2 × 3', pct: '75–80%', lo: 75, hi: 80, upper: 'Half / deload', power: 'Half' },
  { sets: '3 × 3', pct: '82–85%', lo: 82, hi: 85, upper: 'Full', power: 'Full' },
  { sets: '3 × 3', pct: '84–86%', lo: 84, hi: 86, upper: 'Add load if ready', power: 'Full' },
  { sets: '3 × 2', pct: '86–88%', lo: 86, hi: 88, upper: 'Full', power: 'Full' },
  { sets: '2 × 3', pct: '75–80%', lo: 75, hi: 80, upper: 'Half / deload', power: 'Half' },
  { sets: '4 × 2', pct: '85–87%', lo: 85, hi: 87, upper: 'Full', power: 'Full' },
  { sets: '4 × 2', pct: '86–88%', lo: 86, hi: 88, upper: 'Progress reps/load', power: 'Full' },
  { sets: '3 × 2', pct: '87–89%', lo: 87, hi: 89, upper: 'No failure', power: 'Full' },
  { sets: '2 × 2', pct: '75–80%', lo: 75, hi: 80, upper: 'Half / test', power: 'Test' }
];

/* Rest defaults (seconds) taken from each exercise's existing guidance, e.g. "rest 3 min" for the trap-bar lift
   and "rest 60–120 sec" for approach jumps (midpoint). Everything is user-editable. */
const REST_DEFAULTS = {
  approach: 90, trap: 180, cmj: 90, split: 120, rdl: 120, calf: 60, copenh: 45,
  pullup: 150, chestrow: 120, singlelat: 75, inclcurl: 75, lateral: 60, inclpress: 90, rot: 45,
  pogo: 45, lateralbound: 60, jumpsquat: 90, shuffle: 60, calfiso: 45,
  pulldown: 90, cablerow: 90, reverse: 60, preacher: 75, hammer: 60, laterald: 60, pressd: 90, rotd: 45
};
function defaultRestFor(e) {
  if (isNum(e.rest) && Number(e.rest) > 0) return Number(e.rest);
  if (REST_DEFAULTS[e.id]) return REST_DEFAULTS[e.id];
  if (e.unit === 'seconds') return 45;
  return e.load ? 90 : 60;
}
function restFor(e) {
  const custom = data.settings.rest.perExercise?.[e.id];
  return isNum(custom) && Number(custom) > 0 ? Number(custom) : defaultRestFor(e);
}

/* ---------- week/phase helpers ---------- */
const weekFor = s => clamp(Math.floor(daysBetween(data.user.startDate, s) / 7) + 1, 1, 12);
const getWeek = () => weekFor(todayISO());
const isDeload = w => [4, 8, 12].includes(w);
const allExercises = k => [...templates[k].exercises, ...(data.custom[k] || [])].filter(e => !(data.hiddenEx?.[k] || []).includes(e.id));

/* ---------- volleyball calendar ---------- */
/* Recurring training days are stored as a short history so that changing them today never rewrites past weeks. */
function vbDaysFor(date) {
  let days = [3];
  for (const s of data.vb.schedule) if (s.from <= date) days = s.days;
  return days;
}
function isRecurringTraining(date) {
  return vbDaysFor(date).includes(dayIndex(date)) && !data.vb.skips.includes(date);
}
const extrasOn = date => data.vb.extras.filter(x => x.date === date);
const isMatch = date => data.matches.includes(date);

/* Raw recommendation for one week (the "match-aware" logic carried over from v1.x, now generalised for any
   recurring volleyball days). `blocked` holds dates the user has already used for pinned gym sessions. */
function recommendWeek(mon, pinnedSessions, blockedDates) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const matches = days.filter(isMatch);
  const teamDates = new Set(days.filter(d => isRecurringTraining(d) && !isMatch(d)));
  days.forEach(d => { if (extrasOn(d).length) teamDates.add(d); });
  const taken = d => teamDates.has(d) || isMatch(d) || blockedDates.has(d);
  const out = {}; const notPlaced = [];
  const active = typeof activeSessions === 'function' ? activeSessions() : ['A', 'B', 'C', 'D'];
  const toPlace = active.filter(k => !pinnedSessions.has(k));

  let legacy = null;
  if (matches.length === 0 || (matches.length === 1 && matches[0] === days[5])) legacy = { A: 0, B: 1, C: 2, D: 4 };
  else if (matches.length === 1 && matches[0] === days[6]) legacy = { B: 0, A: 1, D: 2, C: 4 };
  const stock = active.join() === 'A,B,C,D';
  if (stock && legacy && toPlace.every(k => !taken(days[legacy[k]]))) {
    for (const k of toPlace) out[days[legacy[k]]] = k;
    return { out, notPlaced };
  }

  // Generalised scoring path (also the original path for congested match weeks)
  const frees = days.map((d, i) => ({ d, i })).filter(({ d }) => !taken(d));
  const placeOrder = [...['A', 'B', 'D', 'C'], ...toPlace.filter(k => !BUILTIN_KEYS.includes(k))].filter(k => toPlace.includes(k));
  const used = new Set();
  for (const k of placeOrder) {
    const opts = frees.filter(({ d }) => !used.has(d));
    if (!opts.length) { notPlaced.push({ session: k, reason: 'no free day left this week' }); continue; }
    const score = ({ d, i }) => {
      const near = data.matches.reduce((min, m) => Math.min(min, Math.abs(daysBetween(d, m))), 999);
      if (isHeavy(k) && near < 3) return -1000;
      if (k === 'C' && near < 2) return -1000;
      const SPREAD = { 1: [1], 2: [0, 3], 3: [0, 2, 4] };
      const pref = stock ? (k === 'A' ? 0 : k === 'B' ? 1 : k === 'D' ? 4 : 2) : (SPREAD[active.length] || [0, 1, 2, 3, 4, 5, 6].filter((_, n, a) => n % Math.ceil(a.length / active.length) === 0))[active.indexOf(k)] ?? 3;
      return -Math.abs(i - pref) * 5 + (near >= 3 ? 10 : 0) - ((isHeavy(k) && i >= 4) ? 12 : 0);
    };
    opts.sort((a, b) => score(b) - score(a));
    if (score(opts[0]) < -500) { notPlaced.push({ session: k, reason: isHeavy(k) ? 'too close to a match for a heavy lower-body day' : 'too close to a match' }); continue; }
    out[opts[0].d] = k; used.add(opts[0].d);
  }
  return { out, notPlaced };
}

/* Plan status of a gym item: done / missed / planned */
function gymLogFor(session, date, weekMon) {
  const start = weekMon, end = addDays(weekMon, 6);
  return data.logs.find(l => l.completed && l.session === session && (l.date === date)) ||
    data.logs.find(l => l.completed && l.session === session && l.date >= start && l.date <= end) || null;
}
const vbLogsOn = (date, kind) => data.vb.logs.filter(l => l.date === date && (!kind || l.kind === kind));

/* Full plan for a week: items per day, status, and flagged conflicts. Never mutates records. */
function weekPlan(mon) {
  const today = todayISO();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const act = typeof activeSessions === 'function' ? activeSessions() : SESSION_KEYS;
  const pinsThisWeek = data.pins.filter(p => p.week === mon && act.includes(p.session));
  const pinnedSessions = new Set(pinsThisWeek.map(p => p.session));
  const blocked = new Set(pinsThisWeek.map(p => p.date));
  if (data.user.setupDate) dates.filter(d => d < data.user.setupDate).forEach(d => blocked.add(d));
  const pinsFromElsewhere = data.pins.filter(p => p.week !== mon && dates.includes(p.date) && act.includes(p.session));
  pinsFromElsewhere.forEach(p => blocked.add(p.date));
  const rec = recommendWeek(mon, pinnedSessions, blocked);

  const days = dates.map((date, i) => ({ date, idx: i, items: [], conflicts: [], isToday: date === today, isPast: date < today }));
  const byDate = Object.fromEntries(days.map(d => [d.date, d]));

  // volleyball
  const preSetup = date => !!data.user.setupDate && date < data.user.setupDate; // a new account has no history before the day it was set up
  for (const d of days) {
    if (preSetup(d.date)) continue;
    if (isMatch(d.date)) {
      const logs = vbLogsOn(d.date, 'match');
      d.items.push({ kind: 'match', info: data.matchInfo[d.date] || {}, log: logs[0] || null, status: logs.length ? 'done' : (d.date < today ? 'missed' : 'planned') });
    } else if (isRecurringTraining(d.date)) {
      const logs = vbLogsOn(d.date, 'training');
      d.items.push({ kind: 'training', source: 'recurring', info: trainInfoFor(d.date), log: logs[0] || null, status: logs.length ? 'done' : (d.date < today ? 'missed' : 'planned') });
    } else if (data.vb.skips.includes(d.date) && vbDaysFor(d.date).includes(d.idx)) {
      d.items.push({ kind: 'training', source: 'recurring', cancelled: true, status: 'cancelled' });
    }
    for (const x of extrasOn(d.date)) {
      const logs = vbLogsOn(d.date, 'training');
      d.items.push({ kind: 'training', source: 'extra', extra: x, log: logs[0] || null, status: logs.length ? 'done' : (d.date < today ? 'missed' : 'planned') });
    }
  }
  // gym (recommended + pinned)
  const addGym = (session, date, pinned, from) => {
    const day = byDate[date]; if (!day) return;
    const log = gymLogFor(session, date, mon);
    day.items.push({ kind: 'gym', session, pinned, movedFrom: from || null, log, status: log ? 'done' : (date < today ? 'missed' : 'planned'), weekMon: mon });
  };
  for (const [date, session] of Object.entries(rec.out)) addGym(session, date, false);
  for (const p of pinsThisWeek) addGym(p.session, p.date, true, null);   // pinned inside this week
  // pins from another week landing here
  for (const p of pinsFromElsewhere) {
    const day = byDate[p.date];
    const log = gymLogFor(p.session, p.date, p.week);
    day.items.push({ kind: 'gym', session: p.session, pinned: true, fromWeek: p.week, log, status: log ? 'done' : (p.date < today ? 'missed' : 'planned'), weekMon: p.week });
  }
  // pins from this week that live in a different week are reported by that week; keep a marker here
  const movedAway = pinsThisWeek.filter(p => !dates.includes(p.date)).map(p => ({ session: p.session, to: p.date }));

  // conflicts (flagged, never silently resolved)
  const nearestMatchGap = date => data.matches.reduce((min, m) => Math.min(min, Math.abs(daysBetween(date, m))), 999);
  for (const d of days) {
    const gyms = d.items.filter(x => x.kind === 'gym');
    const vb = d.items.filter(x => x.kind === 'match' || x.kind === 'training');
    const hasMatch = d.items.some(x => x.kind === 'match');
    if (gyms.length > 1) d.conflicts.push({ level: 'warn', text: `${gyms.map(g => 'Session ' + g.session).join(' and ')} are both on ${pretty(d.date)}` });
    for (const g of gyms) {
      if (hasMatch) d.conflicts.push({ level: 'warn', text: `${sName(g.session)} is planned on a match day` });
      else if (vb.some(x => x.kind === 'training') && g.pinned) d.conflicts.push({ level: 'info', text: `${sName(g.session)} shares ${pretty(d.date)} with volleyball training` });
      if (g.pinned && !hasMatch) {
        const gap = nearestMatchGap(d.date);
        if (isHeavy(g.session) && gap < 3 && gap > 0) d.conflicts.push({ level: 'warn', text: `Heavy leg day (${sName(g.session)}) is ${plural(gap, 'day')} from a match` });
        if (g.session === 'C' && gap < 2 && gap > 0) d.conflicts.push({ level: 'info', text: `Session C is the day next to a match` });
      }
    }
    if (hasMatch && d.items.filter(x => x.kind === 'training').length) d.conflicts.push({ level: 'info', text: `Extra volleyball session on a match day (${pretty(d.date)})` });
  }
  // duplicate session letters in a week
  const letters = {};
  days.forEach(d => d.items.filter(x => x.kind === 'gym').forEach(g => { (letters[g.session] ||= []).push(d.date); }));
  for (const [k, ds] of Object.entries(letters)) if (ds.length > 1) days.find(d => d.date === ds[1]).conflicts.push({ level: 'warn', text: `${sName(k)} appears twice this week (${ds.map(pretty).join(', ')})` });

  return { mon, days, notPlaced: rec.notPlaced.filter(n => !pinnedSessions.has(n.session)), movedAway, conflicts: days.flatMap(d => d.conflicts.map(c => ({ ...c, date: d.date }))) };
}
const dayPlan = date => weekPlan(monday(date)).days.find(d => d.date === date);

/* Legacy shape used by the nutrition targets: the heaviest workload on the date. */
function plannedFor(date) {
  const d = dayPlan(date);
  if (d.items.some(x => x.kind === 'match')) return 'MATCH';
  if (d.items.some(x => x.kind === 'training')) return 'TEAM';
  const g = d.items.find(x => x.kind === 'gym');
  return g ? g.session : 'RECOVERY';
}
const nearestMatch = date => data.matches.filter(x => x >= date).sort()[0] || null;

/* Upcoming planned (not yet satisfied) conflicts across the next weeks, for the Today/Plan banners */
function upcomingConflicts(weeks = 3) {
  const out = []; const m0 = monday(todayISO());
  for (let w = 0; w < weeks; w++) {
    const plan = weekPlan(addDays(m0, w * 7));
    plan.conflicts.filter(c => c.level === 'warn' && c.date >= todayISO()).forEach(c => out.push(c));
  }
  return out;
}

/* Weekly summaries — gym and volleyball are always counted separately */
function weekSummary(mon) {
  const end = addDays(mon, 6);
  const gym = data.logs.filter(l => l.completed && l.date >= mon && l.date <= end);
  const vb = data.vb.logs.filter(l => l.date >= mon && l.date <= end);
  const training = vb.filter(l => l.kind === 'training'), matches = vb.filter(l => l.kind === 'match');
  const load = sum(vb, l => sessionLoad(l) || 0);
  const planned = weekPlan(mon).days.flatMap(d => d.items).filter(i => i.kind === 'gym').length;
  return { mon, gymDone: gym.length, gymPlanned: planned, trainingN: training.length, matchN: matches.length, vbN: vb.length, minutes: sum(vb, l => l.durationMin), load, loggedLoadN: vb.filter(l => sessionLoad(l)).length };
}
/* Session load = duration (minutes) × session RPE. A simple, comparable record of how big a session felt.
   It is not an injury prediction and not a medical score. */
function sessionLoad(l) {
  const d = Number(l.durationMin), r = Number(l.rpe);
  return Number.isFinite(d) && Number.isFinite(r) && d > 0 && r > 0 ? Math.round(d * r) : null;
}
