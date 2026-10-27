'use strict';
/* VERTFORM 2.8 — first-run setup. A brand-new account starts empty: you say when your fixed weekly trainings are, name them,
   say how many gym sessions you want a week and name those too. Existing accounts are never asked (they are marked set up on load). */

const OB_STARTS = [['lower', 'Lower body & jump', 'A'], ['upper', 'Upper body (pull)', 'B'], ['power', 'Power primer', 'C'], ['back', 'Back & arms', 'D'], ['blank', 'Blank (add my own)', null]];
const OB_DEFAULTS = [['Lower body', 'lower'], ['Upper body', 'upper'], ['Power', 'power'], ['Back & arms', 'back'], ['Session 5', 'blank'], ['Session 6', 'blank']];
let ob = null;
/* One card per fixed training day: name, intensity, length. Used by the first-run setup and by the Fixed trainings editor. */
function teamCard(i, t) {
  return `<section class="obcard"><div class="eyebrow">${esc(DOW_LONG[i]).toUpperCase()}</div>
    <div class="field"><label for="tcn${i}">Name</label><input id="tcn${i}" data-in="tcname" data-i="${i}" maxlength="30" autocomplete="off" placeholder="Team training" value="${esc(t.name)}"></div>
    <div class="field"><label>Intensity</label><div class="intens">${Object.entries(INTENSITY).map(([k, v]) => `<button type="button" class="${t.intensity === k ? 'on' : ''}" aria-pressed="${t.intensity === k}" data-act="tc.int" data-id="${i}" data-arg="${k}"><b>${v.label}</b><small>${v.hint}</small></button>`).join('')}</div></div>
    <div class="field"><label>Length</label><div class="chip-row">${[60, 75, 90, 120].map(m => `<button type="button" class="chip ${t.min === m ? 'on' : ''}" aria-pressed="${t.min === m}" data-act="tc.min" data-id="${i}" data-arg="${m}">${m} min</button>`).join('')}</div></div></section>`;
}
const tcMap = () => ob ? ob.team : rv.info;
const tcRepaint = () => { if (ob) { paintOb.keep = true; paintOb(); } else refreshSheet(); };
INPUTS.tcname = el => { const t = tcMap()[Number(el.dataset.i)]; if (t) t.name = el.value; };
ACTIONS['tc.int'] = el => { tcMap()[Number(el.dataset.id)].intensity = el.dataset.arg; tcRepaint(); };
ACTIONS['tc.min'] = el => { tcMap()[Number(el.dataset.id)].min = Number(el.dataset.arg); tcRepaint(); };

function startOnboarding() {
  ob = { step: 0, team: {}, count: 3, sessions: [] };
  paintOb();
}
function obTeamDays() { return Object.keys(ob.team).map(Number).sort((a, b) => a - b); }
function obRecommended() { return clamp(4 - Math.max(0, obTeamDays().length - 1), 2, 4); }
function obSyncSessions() {
  const n = ob.count; while (ob.sessions.length < n) { const d = OB_DEFAULTS[ob.sessions.length]; ob.sessions.push({ name: d[0], start: d[1] }); } ob.sessions.length = n;
}
/* One question per screen. The list of screens depends on how many team days were picked. */
function obSteps() { return [{ id: 'welcome' }, { id: 'days' }, ...obTeamDays().map(i => ({ id: 'team', day: i })), { id: 'count' }, { id: 'names' }, { id: 'notify' }, { id: 'ready' }]; }
const obHead = (kicker, title, sub) => `<p class="obk">${kicker}</p><h1 class="obh">${title}</h1>${sub ? `<p class="obsub">${sub}</p>` : ''}`;
const OB_PIPS = { light: 1, moderate: 2, hard: 3, max: 4 };
function obWeekStrip() {
  return `<div class="obstrip" aria-hidden="true">${DOW.map((n, i) => `<span class="${ob.team[i] ? 'on' : ''}"><i></i><small>${n.slice(0, 1)}</small></span>`).join('')}</div>`;
}
function obBody() {
  const st = obSteps()[ob.step];
  if (st.id === 'welcome') return `<div class="obhero"><span class="obmark">VERT<i>/</i>FORM</span></div>${obHead('WELCOME', 'Let’s build your week', 'Three quick questions. Your team trainings, how many gym sessions you want, and what to call them. Everything can be changed later.')}${typeof acctOn === 'function' && acctOn() ? `<button type="button" class="btn ghost obsignin" data-act="acct.in">Already use VERTFORM? Sign in</button>` : ''}`;
  if (st.id === 'days') {
    const d = obTeamDays();
    return `${obHead('YOUR WEEK', 'Which days do you train with a team?', 'Club or team sessions that are fixed. Tap the days, or skip if you have none.')}
    <div class="obdays" role="group" aria-label="Team training days">${DOW.map((n, i) => `<button type="button" class="obday ${ob.team[i] ? 'on' : ''}" aria-pressed="${!!ob.team[i]}" aria-label="${esc(DOW_LONG[i])}" data-act="ob.day" data-arg="${i}"><span>${n.slice(0, 3)}</span></button>`).join('')}</div>
    <p class="obnote">${d.length ? `${d.map(i => DOW_LONG[i]).join(' and ').replace(/, ([^,]*)$/, ' and $1')}. ${plural(d.length, 'team training')} a week.` : 'No fixed team trainings.'}</p>`;
  }
  if (st.id === 'team') {
    const i = st.day, t = ob.team[i], n = obTeamDays().indexOf(i) + 1, tot = obTeamDays().length;
    return `${obHead(tot > 1 ? `${DOW_LONG[i].toUpperCase()} · ${n} OF ${tot}` : DOW_LONG[i].toUpperCase(), 'Tell me about this training')}
    <div class="field obfield"><label for="tcn${i}">Name</label><input id="tcn${i}" data-in="tcname" data-i="${i}" maxlength="30" autocomplete="off" placeholder="Team training" value="${esc(t.name)}"></div>
    <div class="eyebrow obl">HOW HARD IS IT?</div>
    <div class="obint" role="radiogroup" aria-label="Intensity">${Object.entries(INTENSITY).map(([k, v]) => `<button type="button" role="radio" aria-checked="${t.intensity === k}" class="${t.intensity === k ? 'on' : ''}" data-act="tc.int" data-id="${i}" data-arg="${k}"><span class="pips" aria-hidden="true">${[1, 2, 3, 4].map(p => `<i class="${p <= OB_PIPS[k] ? 'f' : ''}"></i>`).join('')}</span><b>${v.label}</b><small>${v.hint}</small></button>`).join('')}</div>
    <div class="eyebrow obl">HOW LONG?</div>
    <div class="obmin" role="radiogroup" aria-label="Length">${[60, 75, 90, 120].map(m => `<button type="button" role="radio" aria-checked="${t.min === m}" class="${t.min === m ? 'on' : ''}" data-act="tc.min" data-id="${i}" data-arg="${m}"><b>${m}</b><small>min</small></button>`).join('')}</div>`;
  }
  if (st.id === 'count') {
    const rec = obRecommended(), n = ob.count;
    return `${obHead('GYM', 'How many gym sessions a week?', obTeamDays().length ? `With ${plural(obTeamDays().length, 'team training')}, ${rec} keeps you fresh for it.` : 'Pick what you can keep up. Consistency beats volume.')}
    <div class="obstep" role="group" aria-label="Gym sessions per week"><button type="button" class="obpm" data-act="ob.dec" aria-label="One fewer" ${n <= 1 ? 'disabled' : ''}>−</button>
      <div class="obbig" aria-live="polite"><b>${n}</b><small>${n === 1 ? 'session' : 'sessions'} a week</small></div>
      <button type="button" class="obpm" data-act="ob.inc" aria-label="One more" ${n >= 6 ? 'disabled' : ''}>+</button></div>
    ${obWeekStrip()}
    <p class="obnote">${n === rec ? '★ Suggested for you' : n > rec ? 'More than suggested, so go easy on recovery' : 'Fewer than suggested, an easy start'}</p>`;
  }
  if (st.id === 'names') {
    obSyncSessions();
    return `${obHead('GYM', ob.count === 1 ? 'Name your session' : 'Name your sessions', 'Pick a starting point for each, or start blank and add your own exercises.')}
    <div class="obrows">${ob.sessions.map((s, i) => `<section class="obrow"><span class="obnum">${i + 1}</span><div class="obrowmain"><input id="obs${i}" data-in="obsname" data-i="${i}" maxlength="40" autocomplete="off" aria-label="Session ${i + 1} name" value="${esc(s.name)}">
      <div class="obstarts" role="radiogroup" aria-label="Start from">${OB_STARTS.map(([id, label]) => `<button type="button" role="radio" aria-checked="${s.start === id}" class="${s.start === id ? 'on' : ''}" data-act="ob.start" data-id="${i}" data-arg="${id}">${esc(label.replace(' (pull)', '').replace(' (add my own)', '').replace(' & jump', ''))}</button>`).join('')}</div></div></section>`).join('')}</div>`;
  }
  if (st.id === 'notify') return `${obHead('STAY ON TRACK', 'Want a nudge now and then?', 'Only the useful ones. You can change or turn them off any time in Settings.')}
    <ul class="obnl"><li><span>${icon('train')}</span><div><b>Session days</b><small>A reminder on the days you train.</small></div></li>
    <li><span>${icon('fuel')}</span><div><b>Match-day fuel</b><small>When to eat carbs and a sip of honey before a game.</small></div></li>
    <li><span>${icon('feed')}</span><div><b>Friends</b><small>When a friend posts or tags you.</small></div></li></ul>
    <p class="obnote">${typeof pushIOSWeb === 'function' && pushIOSWeb() ? 'On iPhone, add VERTFORM to your Home Screen first, then notifications can be switched on.' : 'Your phone will ask for permission.'}</p>`;
  const d = obTeamDays();
  return `<div class="obhero sm"><span class="obcrest ok">${icon('check')}</span></div>${obHead('ALL SET', 'Your week is ready')}
    ${obWeekStrip()}
    <div class="obsumlist">${d.map(i => `<div class="obsum"><b>${esc(DOW[i])}</b><span>${esc(ob.team[i].name || 'Team training')}</span><em>${INTENSITY[ob.team[i].intensity].label}</em></div>`).join('')}${ob.sessions.map((s, i) => `<div class="obsum"><b class="g">${i + 1}</b><span>${esc(s.name.trim() || 'Session ' + (i + 1))}</span><em>Gym</em></div>`).join('')}</div>
    <p class="obnote">Open the calendar on the home screen to drag sessions between days.</p>`;
}
function paintOb() {
  let r = $('#onb-root'); if (!r) { r = document.createElement('div'); r.id = 'onb-root'; document.body.appendChild(r); }
  document.body.classList.add('onb-open');
  const steps = obSteps(); ob.step = clamp(ob.step, 0, steps.length - 1);
  const id = steps[ob.step].id, last = id === 'ready', first = id === 'welcome', nSteps = steps.length - 1;
  const notif = id === 'notify', next = last ? 'ob.finish' : notif ? 'ob.notify' : 'ob.next', label = last ? 'Open my week' : first ? 'Get started' : notif ? 'Turn on notifications' : id === 'days' && !obTeamDays().length ? 'No fixed trainings' : 'Next';
  const keep = paintOb.keep;
  r.innerHTML = `<div class="onb" role="dialog" aria-modal="true" aria-label="Set up VERTFORM">
    <header class="onb-top">${first || last ? '<span class="obspacer"></span>' : '<button type="button" class="obback" data-act="ob.back" aria-label="Back">' + icon('back') + '</button>'}
      <div class="obprog" role="progressbar" aria-valuemin="0" aria-valuemax="${nSteps}" aria-valuenow="${ob.step}" aria-label="Setup progress">${Array.from({ length: nSteps }, (_, i) => `<i class="${i < ob.step ? 'f' : ''}"></i>`).join('')}</div><span class="obspacer"></span></header>
    <div class="onb-body ${keep ? 'keep' : ''}">${obBody()}</div>
    <footer class="onb-foot"><button type="button" class="btn primary grow obgo" data-act="${next}">${label}</button>${first ? '<button type="button" class="obskip" data-act="ob.skip">Use the standard plan instead</button>' : ''}${notif ? '<button type="button" class="obskip" data-act="ob.next">Not now</button>' : ''}</footer></div>`;
  const b = $('.onb-body', r); if (b && !keep) b.scrollTop = 0; paintOb.keep = false;
}
ACTIONS['ob.day'] = el => { const i = Number(el.dataset.arg); if (ob.team[i]) delete ob.team[i]; else ob.team[i] = { name: 'Team training', intensity: 'moderate', min: 90 }; paintOb.keep = true; paintOb(); };
INPUTS.obsname = el => { const s = ob.sessions[Number(el.dataset.i)]; if (s) s.name = el.value; };
ACTIONS['ob.count'] = el => { ob.count = clamp(Number(el.dataset.arg), 1, 6); paintOb.keep = true; paintOb(); };
ACTIONS['ob.inc'] = () => { ob.count = Math.min(6, ob.count + 1); paintOb.keep = true; paintOb(); };
ACTIONS['ob.dec'] = () => { ob.count = Math.max(1, ob.count - 1); paintOb.keep = true; paintOb(); };
ACTIONS['ob.start'] = el => { const s = ob.sessions[Number(el.dataset.id)], id = el.dataset.arg, was = OB_DEFAULTS.some(d => d[0] === s.name) || !s.name.trim(); s.start = id; if (was && id !== 'blank') s.name = OB_STARTS.find(x => x[0] === id)[1].replace(' (pull)', '').replace(' & jump', ''); paintOb.keep = true; paintOb(); };
ACTIONS['ob.notify'] = async () => {
  try {
    const p = { ...pushPrefs(), want: true, remind: true, fuel: true, posts: true, mentions: true }; pushSavePrefs(p);
    if (typeof pushSupported === 'function' && pushSupported() && Notification.permission === 'default') await Notification.requestPermission();
    if (typeof pushAuto === 'function') pushAuto();
  } catch (_) { /* fine, they can turn it on in Settings */ }
  ob.step++; paintOb();
};
ACTIONS['ob.next'] = () => { ob.step++; paintOb(); };
ACTIONS['ob.back'] = () => { ob.step = Math.max(0, ob.step - 1); paintOb(); };
function closeOb() { $('#onb-root')?.remove(); document.body.classList.remove('onb-open'); ob = null; }
ACTIONS['ob.skip'] = () => { data.user.onboarded = true; data.user.hideBuiltin = false; save(); closeOb(); render(); setTimeout(maybeAskReadiness, 350); };
ACTIONS['ob.finish'] = () => {
  const days = obTeamDays();
  data.vb.schedule = [{ from: '0000-01-01', days }]; data.vb.trainInfo = {};
  days.forEach(i => { const t = ob.team[i]; data.vb.trainInfo[String(i)] = { name: t.name.trim() || 'Team training', intensity: t.intensity, min: t.min }; });
  data.mySessions = []; const keys = [];
  ob.sessions.forEach((s, i) => {
    const key = 'EFGHIJKLMNOP'[i], src = OB_STARTS.find(x => x[0] === s.start)?.[2];
    data.mySessions.push({ key, title: s.name.trim() || `Session ${i + 1}`, type: '', minutes: 0, heavy: src === 'A', deleted: false, exercises: src ? allExercises(src).map(e => ({ id: e.id, name: e.name, sets: e.sets, reps: e.reps, unit: e.unit, load: e.load, hint: e.hint || '', rest: 0 })) : [] });
    keys.push(key);
  });
  data.mySessions = cleanMySessions(data.mySessions); data.user.hideBuiltin = true; syncCustomSessions(data.mySessions, true);
  data.user.gymSessions = keys.filter(k => SESSION_KEYS.includes(k)); data.user.startDate = todayISO(); data.user.setupDate = todayISO(); data.user.onboarded = true;
  save(); closeOb(); ui.page = 'home'; ui.hub = true; render(); toast('Your week is set up');
};
