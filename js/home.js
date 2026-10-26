'use strict';
/* VERTFORM 2.1 — Career-style home hub: a crest in the middle; tap it and Diet / Gym today / Volleyball orbs open around it. */

const HUB_ORBS = [
  { id: 'gym', cls: 'o-gym', ico: 'train', label: 'GYM TODAY' },
  { id: 'diet', cls: 'o-diet', ico: 'fuel', label: 'DIET' },
  { id: 'cal', cls: 'o-vb', ico: 'today', label: 'CALENDAR' },
  { id: 'friends', cls: 'o-fr sm', ico: 'post', label: 'FRIENDS', act: 'nav', arg: 'post', aria: 'Friends feed' },
  { id: 'log', cls: 'o-log sm', ico: 'history', label: 'LOGBOOK', act: 'hub.log', aria: 'Logbook' },
  { id: 'lb', cls: 'o-lb sm', ico: 'trophy', label: 'LEADERBOARD', act: 'board.open', aria: 'Leaderboard' }
];
const crestSvg = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h6l5 15 5-15h6L19 27h-6z" fill="currentColor"/></svg>';

function hubFacts() {
  const today = todayISO(), mon = monday(today), day = dayPlan(today), sum = weekSummary(mon), t = targetsFor(today), v = foodTotals(today);
  const gym = day.items.find(i => i.kind === 'gym'), mt = day.items.find(i => i.kind === 'match'), tr = day.items.find(i => i.kind === 'training' && !i.cancelled);
  const next = nearestMatch(today);
  const gymSub = gym ? sChip(gym.session) : 'REST DAY';
  const vbSub = mt ? (mt.status === 'done' ? 'MATCH LOGGED' : 'MATCH TODAY') : tr ? (tr.status === 'done' ? 'TRAINING LOGGED' : 'TRAINING TODAY') : next ? `NEXT MATCH ${pretty(next).toUpperCase()}` : `${sum.gymDone}/${sum.gymPlanned} GYM THIS WEEK`;
  return { today, mon, day, sum, gym, mt, tr, next, t, v, sub: { gym: gymSub, diet: `${Math.round(v.kcal).toLocaleString('en-GB')} / ${t.cal.toLocaleString('en-GB')} KCAL`, cal: vbSub }, glyph: { gym: gym ? sBadge(gym.session) : '–' } };
}

function hubWeekBar(mon) {
  const plan = weekPlan(mon);
  return `<div class="vhWeek" role="list" aria-label="This week">${plan.days.map(d => {
    const gym = d.items.find(i => i.kind === 'gym'), mt = d.items.find(i => i.kind === 'match'), tr = d.items.find(i => i.kind === 'training' && !i.cancelled);
    const main = mt || gym || tr, st = main ? main.status : 'rest';
    return `<button type="button" role="listitem" class="st-${st} ${d.isToday ? 'today' : ''}" data-act="day.open" data-id="${d.date}" aria-label="${esc(DOW_LONG[d.idx])} ${d.date.slice(8)}"><i></i><span>${DOW[d.idx].toUpperCase()}</span></button>`;
  }).join('')}</div>`;
}

function viewHome() {
  const f = hubFacts(), w = getWeek(), open = !!ui.hub;
  const draftHere = data.draft && f.gym && data.draft.session === f.gym.session && data.draft.date === f.today;
  let cta;
  if (data.draft && !f.gym) cta = `<button type="button" class="vhGo" data-act="wk.resume">${icon('play')}<b>Resume ${esc(sName(data.draft.session))}</b><small>${sum_sets(data.draft)} sets ticked</small></button>`;
  else if (f.gym && f.gym.status !== 'done') cta = `<button type="button" class="vhGo" data-act="wk.start" data-id="${f.gym.session}" data-arg="${f.today}">${icon('play')}<b>${draftHere ? 'Resume' : 'Start'} ${sName(f.gym.session)}</b><small>${esc(templates[f.gym.session].title)}</small></button>`;
  else cta = `<button type="button" class="vhGo alt" data-act="food.open">${icon('plus')}<b>Add food</b><small>${esc(f.sub.diet)}</small></button>`;
  const orbs = HUB_ORBS.map(o => `<button type="button" class="vhOrb ${o.cls}" data-act="${o.act || 'hub.panel'}" data-arg="${o.arg || o.id}" tabindex="${open ? 0 : -1}" aria-label="${o.aria || o.label + ': ' + esc(f.sub[o.id])}"><span class="vhOrbIc">${o.id === 'gym' && f.gym ? `<em>${f.glyph.gym}</em>` : icon(o.ico)}</span><span class="vhOrbTx"><b>${o.label}</b>${f.sub[o.id] ? `<small>${esc(f.sub[o.id])}</small>` : ''}</span></button>`).join('');
  return `${banners()}
  <section class="vhHome ${open ? 'is-open' : ''}" aria-label="Home">
    <div class="vhBg" aria-hidden="true"><i></i><i></i><i></i><b></b></div>
    <div class="vhStage">
      <div class="vhHub">
        <i class="vhRing r1"></i><i class="vhRing r2"></i>
        ${orbs}
        <button type="button" class="vhCrest" data-act="hub.toggle" aria-expanded="${open}" aria-label="${open ? 'Close menu' : 'Open menu: diet, gym today, calendar'}">${myLook() ? `<span class="crest3d" data-keep="crest:${lookKey(myLook())}"><iframe class="f3d" src="${lookUrl(myLook(), '&bare=1&lite=1')}" tabindex="-1" aria-hidden="true" title=""></iframe></span>` : `<span class="vhCrestIn">${crestInner()}</span>`}<span class="vhHint">${open ? 'TAP TO CLOSE' : 'TAP TO OPEN'}</span></button>
      </div>
      ${hubNote()}
      <p class="vhSub">${isDeload(w) ? 'Easy week' : `${esc(weekdayShort(f.today))} ${parseDate(f.today).getDate()} ${parseDate(f.today).toLocaleDateString('en-GB', { month: 'short' })}`}</p>
    </div>
    <div class="vhDock">
      ${backupNudge()}
      ${hubWeekBar(f.mon)}
      ${cta}
    </div>
  </section>${hubPanel()}`;
}

/* ---------- panels: open over the blurred home ---------- */
function readinessBlock() {
  const today = todayISO(), r = data.readiness[today] || {};
  return `${sectionHead('', 'How do you feel today?')}
    <div class="seg3" role="radiogroup" aria-label="Readiness today"><button type="button" role="radio" aria-checked="${r.level === 'green'}" data-act="ready" data-arg="green" class="${r.level === 'green' ? 'on g' : ''}">Fresh</button><button type="button" role="radio" aria-checked="${r.level === 'amber'}" data-act="ready" data-arg="amber" class="${r.level === 'amber' ? 'on a' : ''}">Moderate</button><button type="button" role="radio" aria-checked="${r.level === 'red'}" data-act="ready" data-arg="red" class="${r.level === 'red' ? 'on r' : ''}">Fatigued</button></div>
    <p class="note">${r.level === 'green' ? 'Follow the session prescription.' : r.level === 'amber' ? 'Cut leg sets by around a third and keep jumps light.' : r.level === 'red' ? 'Skip hard lower-body training and prioritise recovery.' : ''}</p>
    <div class="field inline-field"><label for="sleep">Last night's sleep (hours)</label><input id="sleep" data-in="daily" data-key="sleep" type="number" inputmode="decimal" step="0.5" min="0" max="16" placeholder="e.g. 8" value="${esc(r.sleep ?? '')}"></div>`;
}
function gymFocusBanner() {
  const it = dayPlan(todayISO()).items.find(i => i.kind === 'gym' && i.status !== 'done'), f = it && lastFocus(it.session);
  return f ? `<div class="focusnote"><span>FOCUS FOR ${esc(sName(it.session).toUpperCase())}</span><b>${esc(f.text)}</b><small>from ${esc(pretty(f.date))}</small></div>` : '';
}
function panelGym() {
  const today = todayISO(), mon = monday(today), sum = weekSummary(mon);
  const draft = data.draft && !(dayPlan(today).items.some(i => i.kind === 'gym' && i.session === data.draft.session && data.draft.date === today));
  return `${pageHead('', 'Gym today', `<span class="tag clay">${sum.gymDone} / ${sum.gymPlanned} THIS WEEK</span>`)}
    ${draft ? `<div class="banner">${icon('play')}<div class="grow"><b>${esc(sName(data.draft.session))} is still open</b><p>From ${esc(pretty(data.draft.date))} · ${sum_sets(data.draft)} sets ticked.</p><div class="actions"><button type="button" class="btn sm primary" data-act="wk.resume">Resume</button></div></div></div>` : ''}
    ${todayItems()}
    ${gymFocusBanner()}
    ${readinessBlock()}
    <button type="button" class="linkbtn" data-act="nav" data-arg="train">All gym sessions ${icon('chev')}</button>`;
}
function panelDiet() { ui.fuelDate = ui.fuelDate || todayISO(); return viewFuel(); }
function panelCal() { ui.planWeek = ui.planWeek || monday(todayISO()); return calendarBody(ui.planWeek); }
const PANELS = { gym: ['Gym today', panelGym], diet: ['Diet', panelDiet], cal: ['Calendar', panelCal] };

function hubPanel() {
  const p = PANELS[ui.panel]; if (!p) return '';
  return `<div class="vhPanel p-${ui.panel}" role="dialog" aria-modal="true" aria-label="${esc(p[0])}"><div class="vhPanelBar"><button type="button" class="vhBack" data-act="hub.close">${icon('back')}<span>Home</span></button></div><div class="hp-body" tabindex="-1">${p[1]()}</div></div>`;
}

/* Opening/closing the hub and its panels changes the page in place instead of rebuilding it,
   so the 3D player in the centre keeps running (rebuilding would reload it). */
ACTIONS['hub.toggle'] = () => {
  ui.hub = !ui.hub; const h = $('.vhHome'), c = $('.vhCrest'); if (!h || !c) { render(); return; }
  h.classList.toggle('is-open', ui.hub); c.setAttribute('aria-expanded', String(ui.hub)); c.setAttribute('aria-label', ui.hub ? 'Close menu' : 'Open menu: diet, gym today, calendar');
  $$('.vhOrb').forEach(o => { o.tabIndex = ui.hub ? 0 : -1; });
};
function hubPanelSwap() {
  if (ui.page !== 'home' || !$('.vhHome')) { render(); return; }
  $('.vhPanel')?.remove(); if (ui.panel) $('#view').insertAdjacentHTML('beforeend', hubPanel());
  document.body.classList.toggle('panel-open', !!ui.panel); render.last = `${ui.page}|${ui.panel || ''}`; updateScrollLock();
}
ACTIONS['hub.log'] = () => { ui.trainTab = 'history'; go('train'); };
ACTIONS['hub.panel'] = el => { ui.panel = el.dataset.arg; hubPanelSwap(); const b = $('.hp-body'); if (b) b.scrollTop = 0; };
ACTIONS['hub.close'] = () => { ui.panel = null; hubPanelSwap(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.panel && !sheetOpen() && !$('#wk-root .wk') && !$('#dialog-root .dialog')) { ui.panel = null; hubPanelSwap(); } });
