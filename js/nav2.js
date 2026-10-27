'use strict';
/* VERTFORM 2.40 — new home layout: Feed (friends) first, You second, a centre post button, then Gym and Fuel.
   Switch back to the classic hub any time in Settings → Appearance. */

ICONS.me = '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>';
ICONS.feed = '<path d="M4 5h16v6H4zM4 14h16v5H4z"/>';

const NAV2_TOP = ['post', 'home', 'train', 'fuel'];
const navNew = () => data.settings.nav !== 'hub';
const isTopPage = p => navNew() ? NAV2_TOP.includes(p) : p === 'home';
const homePage = () => navNew() ? 'post' : 'home';

function tabsHTML() {
  const b = (p, n, i) => `<button type="button" class="${p === ui.page ? 'active' : ''}" data-act="nav" data-arg="${p}" aria-current="${p === ui.page ? 'page' : 'false'}">${icon(i)}<span>${n}</span></button>`;
  return `${b('post', 'Feed', 'feed')}${b('home', 'You', 'me')}<div class="tabpost"><button type="button" class="postfab" data-act="nav.snap" aria-label="Post a photo">${icon('camera')}</button></div>${b('train', 'Gym', 'train')}${b('fuel', 'Fuel', 'fuel')}`;
}
function railTabs() { return [['post', 'Feed', 'feed'], ['home', 'You', 'me'], ['train', 'Gym', 'train'], ['fuel', 'Fuel', 'fuel']]; }

ACTIONS['nav.snap'] = () => {
  if (ui.page !== 'post') go('post');
  if (!lbCfg()) return;                       // not on the friends feed yet: the page shows the setup card
  ACTIONS['post.compose']();
  if (!pUi.photo && !pUi.video) $('#pphoto')?.click();   // same tap, so phones allow the camera / photo picker to open
};
ACTIONS['nav.layout'] = el => { data.settings.nav = el.dataset.arg === 'hub' ? 'hub' : 'feed'; save(); ui.page = homePage(); ui.hub = false; navStack.length = 0; render(); window.scrollTo(0, 0); };

function layoutSection() {
  const cur = navNew() ? 'feed' : 'hub';
  return `<div class="chip-row" role="group" aria-label="Home layout">${[['feed', 'Feed and tabs'], ['hub', 'Classic hub']].map(([k, n]) => `<button type="button" class="chip ${cur === k ? 'on' : ''}" aria-pressed="${cur === k}" data-act="nav.layout" data-arg="${k}">${n}</button>`).join('')}</div>
    <p class="tiny">Feed and tabs opens on your friends' posts, with You, a post button, Gym and Fuel along the bottom. The classic hub is the original circle menu. Your records are the same either way.</p>`;
}

/* swipe sideways between Feed and You */
(function () {
  let sx = 0, sy = 0, t0 = 0, on = false, swallowUntil = 0;
  addEventListener('click', e => { if (Date.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  const flipTab = p => { ui.page = p; ui.panel = null; navStack.length = 0; closeAllSheets(); render(); window.scrollTo(0, 0); };
  const blocked = t => t.closest && t.closest('input,textarea,select,iframe,video,.sheet,.dialog,#wk-root,.wk,[data-noswipe],table,.chip-row,.seg,pre');
  addEventListener('touchstart', e => {
    on = false; if (!navNew() || e.touches.length !== 1 || !['post', 'home'].includes(ui.page) || ui.panel || sheetOpen() || blocked(e.target)) return;
    const t = e.touches[0]; if (t.clientX < 30) return;   // the left edge belongs to swipe-back
    on = true; sx = t.clientX; sy = t.clientY; t0 = Date.now();
  }, { passive: true });
  addEventListener('touchend', e => {
    if (!on) return; on = false; const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (Math.abs(dx) < 80 || dy > 50 || dy > Math.abs(dx) / 1.6 || Date.now() - t0 > 700) return;
    swallowUntil = Date.now() + 400;
    if (dx < 0 && ui.page === 'post') flipTab('home'); else if (dx > 0 && ui.page === 'home') flipTab('post');
  }, { passive: true });
})();

/* ---------- You page ---------- */
const pagerDots = i => navNew() ? `<div class="pager" aria-hidden="true"><span class="${i === 0 ? 'on' : ''}"></span><span class="${i === 1 ? 'on' : ''}"></span></div>` : '';
const fireIcon = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#ff8a3d" d="M12 2c1 4-2 5-2 8a3 3 0 0 0 6 0c0-1-.5-2-1-3 3 2 5 5 5 8a8 8 0 0 1-16 0c0-4 3-6 4-9 .5 1 1 1.5 2 1.5 0-2 0-4 2-5.5z"/></svg>';

function youTiles() {
  const f = hubFacts(), left = Math.max(0, Math.round(f.t.cal - f.v.kcal));
  const gymName = f.gym ? (templates[f.gym.session]?.title || sName(f.gym.session)) : 'Rest day';
  let vbBig = '–', vbSub = 'Nothing planned';
  if (f.mt) { vbBig = 'Today'; vbSub = f.mt.status === 'done' ? 'Match logged' : 'Match day'; }
  else if (f.tr) { vbBig = 'Today'; vbSub = f.tr.status === 'done' ? 'Training logged' : 'Club training'; }
  else if (f.next) { vbBig = weekdayShort(f.next); vbSub = 'Next match'; }
  const tile = (act, arg, label, big, sub) => `<button type="button" class="ytile" data-act="${act}" data-arg="${arg}"><span class="yl">${esc(label)}</span><b>${esc(String(big))}</b><span class="ys">${esc(sub)}</span></button>`;
  return `<div class="ysec"><div class="yeye">TODAY</div><div class="ytiles">
    ${tile('nav', 'fuel', 'Calories left', left.toLocaleString('en-GB'), `of ${f.t.cal.toLocaleString('en-GB')} kcal`)}
    ${tile('nav', 'train', 'Gym', f.gym ? sBadge(f.gym.session) : '–', gymName)}
    ${tile('nav', 'plan', 'Volleyball', vbBig, vbSub)}
  </div></div>`;
}
function youBoard() {
  const c = lbCfg();
  if (!c) return `<div class="ysec"><div class="yeye">LEADERBOARD</div><div class="ycard"><p class="tiny">Add friends with their code to see a weekly board here.</p><button type="button" class="btn ghost" data-act="lb.open">Set up friends</button></div></div>`;
  if (lbUi.rows === null && !lbUi.loading) setTimeout(() => { if (typeof lbLoad === 'function') lbLoad(); }, 0);
  const rows = lbRowsFor('week');
  let shown = rows.slice(0, 3); const mi = rows.findIndex(r => r.me);
  if (mi > 2) shown = [rows[0], rows[mi - 1] || rows[1], rows[mi]];
  const body = shown.length ? shown.map(r => { const i = rows.indexOf(r) + 1;
    return `<div class="yrow ${r.me ? 'me' : ''}"><b class="${r.me ? 'acc' : ''}">${i}</b><span class="yn">${esc(r.me ? 'You' : r.nickname)}</span><span class="ys">${r.s} ${r.s === 1 ? 'session' : 'sessions'}</span></div>`; }).join('')
    : `<div class="yrow"><span class="yn ys">${lbUi.rows === null ? 'Loading…' : 'No one on the board yet'}</span></div>`;
  return `<div class="ysec"><div class="yhead"><div class="yeye">LEADERBOARD · THIS WEEK</div><button type="button" class="ylink" data-act="board.open">See all</button></div><div class="yrows">${body}</div></div>`;
}
const YOU_MORE = [['trophy', 'Progress', 'you.prog'], ['camera', 'Jump test', 'jt.open'], ['bolt', 'Vertical plan', 'vert.open'], ['train', 'Lifts', 'you.lifts'], ['history', 'Logbook', 'hub.log'], ['post', 'Friends', 'lb.open']];
ACTIONS['you.prog'] = () => { ui.trainTab = 'jump'; go('train'); };
ACTIONS['you.plan'] = () => go('plan');

function viewYou() {
  const w = lbStats(), look = myLook();
  const crest = look ? `<span class="crest3d" data-keep="crest:${lookKey(look)}"><iframe class="f3d" src="${lookUrl(look, '&bare=1&lite=1')}" tabindex="-1" aria-hidden="true" title=""></iframe></span>` : `<span class="ycrestin">${crestInner()}</span>`;
  return `${pageHead('', 'You')}${pagerDots(1)}${banners()}
  <div class="ywrap">
    <div class="ycard yme"><div class="ycrest">${crest}</div><div class="min0"><div class="yname">You</div>
      <div class="ystreak">${fireIcon}${w.streak > 0 ? `${w.streak} week streak` : 'No streak yet'}</div>
      <button type="button" class="btn ghost" data-act="lk.open">Edit look</button></div></div>
    ${youTiles()}
    ${youBoard()}
    ${partnersCard()}
    <div class="ysec"><div class="yeye">MORE</div><div class="ymore">${YOU_MORE.map(([i, n, a]) => `<button type="button" data-act="${a}">${icon(i)}<span>${n}</span></button>`).join('')}</div></div>
  </div>`;
}

/* ---------- Gym tab: Today / Plan / History ---------- */
ACTIONS['gym.tab'] = el => { ui.trainTab = el.dataset.arg; render(); window.scrollTo(0, 0); };
function gymToday() {
  const today = todayISO(), mon = monday(today), d = data.draft;
  const draft = d && !(dayPlan(today).items.some(i => i.kind === 'gym' && i.session === d.session && d.date === today));
  return `${draft ? `<div class="banner">${icon('play')}<div class="grow"><b>${esc(sName(d.session))} is still open</b><p>From ${esc(pretty(d.date))} · ${sum_sets(d)} sets ticked.</p><div class="actions"><button type="button" class="btn sm primary" data-act="wk.resume">Resume</button><button type="button" class="btn sm ghost" data-act="wk.discard">Discard</button></div></div></div>` : ''}
    ${todayItems()}
    ${gymFocusBanner()}
    ${readinessBlock()}
    ${sectionHead('THIS WEEK', `${esc(pretty(mon))} – ${esc(pretty(addDays(mon, 6)))}`)}
    ${weekStrip(mon)}
    <div class="gymbtns"><button type="button" class="btn ghost" data-act="lib.open">${icon('list')}Exercises</button><button type="button" class="btn ghost" data-act="ys.new">${icon('plus')}New session</button><button type="button" class="btn ghost" data-act="vb.log" data-arg="training">${icon('ball')}Log volleyball</button><button type="button" class="btn ghost" data-act="gym.tab" data-arg="jump">${icon('bolt')}Jump tracker</button></div>`;
}
function monthGrid() {
  const today = todayISO(); ui.planMonth = ui.planMonth || today.slice(0, 7) + '-01';
  const first = ui.planMonth, ym = first.slice(0, 7), lastDay = addDays(addDays(first, 32).slice(0, 7) + '-01', -1);
  const label = parseDate(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const cells = [];
  for (let mon = monday(first); mon <= lastDay; mon = addDays(mon, 7)) {
    weekPlan(mon).days.forEach(d => {
      if (d.date.slice(0, 7) !== ym) { cells.push('<span class="mcell pad"></span>'); return; }
      const gym = d.items.find(i => i.kind === 'gym'), mt = d.items.find(i => i.kind === 'match'), tr = d.items.find(i => i.kind === 'training' && !i.cancelled);
      const main = gym || mt || tr, st = main ? main.status : 'rest', both = (gym && (mt || tr));
      const txt = gym ? sBadge(gym.session) : (mt || tr) ? 'VB' : '·';
      const cls = `${gym ? 'g' : (mt || tr) ? 'vb' : 'r'} st-${st} ${d.isToday ? 'today' : ''} ${(ui.planDay || today) === d.date ? 'sel' : ''}`;
      cells.push(`<button type="button" class="mcell ${cls}" data-act="plan.pick" data-id="${d.date}" aria-pressed="${(ui.planDay || todayISO()) === d.date}" aria-label="${esc(DOW_LONG[d.idx])} ${Number(d.date.slice(8))}${main ? ', ' + (gym ? esc(sName(gym.session)) : 'volleyball') + ', ' + st : ', rest'}"><i>${Number(d.date.slice(8))}</i><b>${txt}</b>${both ? '<u></u>' : ''}</button>`);
    });
  }
  return `<div class="mcard"><div class="mnav"><button type="button" class="iconbtn" data-act="plan.mshift" data-arg="-1" aria-label="Previous month">${icon('back')}</button><b>${esc(label)}</b><button type="button" class="iconbtn" data-act="plan.mshift" data-arg="1" aria-label="Next month"><span style="display:inline-flex;transform:rotate(180deg)">${icon('back')}</span></button></div>
    <div class="mgrid" role="grid">${DOW.map(n => `<span class="mh">${n[0]}</span>`).join('')}${cells.join('')}</div>
    <div class="mkey"><span class="k-done">Done</span><span class="k-plan">Planned</span><span class="k-vb">Volleyball</span><span class="k-missed">Missed</span><span class="k-today">Today</span></div></div>`;
}
ACTIONS['plan.mshift'] = el => { const f = ui.planMonth || todayISO().slice(0, 7) + '-01'; ui.planMonth = addDays(f, Number(el.dataset.arg) > 0 ? 32 : -1).slice(0, 7) + '-01'; render(); };
ACTIONS['plan.pick'] = el => { ui.planDay = el.dataset.id; ui.planWeek = monday(el.dataset.id); render(); };
function planDayPanel() {
  const d = ui.planDay && isISO(ui.planDay) ? ui.planDay : todayISO();
  const long = `${DOW_LONG[(parseDate(d).getDay() + 6) % 7]} ${parseDate(d).getDate()} ${parseDate(d).toLocaleDateString('en-GB', { month: 'long' })}`;
  return `<section class="dayinline" aria-label="Plan for ${esc(long)}"><div class="between"><div><div class="eyebrow">${d === todayISO() ? 'TODAY' : 'SELECTED DAY'}</div><h2 class="dih">${esc(long)}</h2></div></div>${renderDaySheet(d).body}</section>`;
}
function gymPlan() {
  ui.trainDate = todayISO();
  return `${monthGrid()}
    ${planDayPanel()}
    <button type="button" class="gymlink" data-act="gym.tab" data-arg="sessions"><span><b>Training sessions</b><small>See, add and remove the exercises in each session</small></span>${icon('chev')}</button>
    <details class="explain mt"><summary><span>Plan settings &amp; upcoming</span></summary>${calendarBody(ui.planWeek, 'settings')}</details>`;
}
function viewGym() {
  const w = getWeek(), t = ui.trainTab, tab = ['plan', 'sessions', 'history', 'vb', 'jump'].includes(t) ? t : 'today';
  ui.trainDate = ui.trainDate && isISO(ui.trainDate) ? ui.trainDate : todayISO();
  const segs = [['today', 'Today'], ['plan', 'Plan'], ['sessions', 'Sessions'], ['history', 'History']];
  const body = tab === 'plan' ? gymPlan() : tab === 'sessions' ? gymSessions() : tab === 'history' ? trainHistory() : tab === 'vb' ? `<button type="button" class="linkbtn back" data-act="gym.tab" data-arg="today">${icon('back')}Gym</button>${trainVb()}` : tab === 'jump' ? `<button type="button" class="linkbtn back" data-act="gym.tab" data-arg="today">${icon('back')}Gym</button>${trainJump()}` : gymToday();
  return `${pageHead('', 'Gym')}${banners()}
    <div class="seg" role="tablist" aria-label="Gym sections">${segs.map(([k, n]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="gym.tab" data-arg="${k}">${n}</button>`).join('')}</div>
    ${body}`;
}


/* ---------- Sessions tab: every session and its exercises, easy to add to and remove from ---------- */
ACTIONS['ses.open'] = el => { ui.sesOpen = ui.sesOpen === el.dataset.arg ? null : el.dataset.arg; render(); };
ACTIONS['ses.add'] = el => openLibrary({ mode: 'target', target: el.dataset.arg });
ACTIONS['ses.rm'] = async el => {
  const k = el.dataset.arg, id = el.dataset.id, e = allExercises(k).find(x => x.id === id); if (!e) return;
  if (allExercises(k).length < 2) { toast('A session needs at least one exercise'); return; }
  if (!await askConfirm({ title: `Remove ${e.name}?`, message: `<p>It comes out of your future ${esc(sName(k))} workouts. Workouts you already logged are not changed.</p>`, confirmLabel: 'Remove', danger: true })) return;
  if (sessRemove(k, id)) { render(); toast(`${e.name} removed from ${sName(k)}`); }
};
function sesCard(k) {
  const t = templates[k], list = allExercises(k), open = ui.sesOpen === k;
  const rows = list.map(e => `<li class="serow"><div class="min0"><b>${esc(e.name)}</b><small>${libLine(e)}</small></div><button type="button" class="iconbtn" data-act="ses.rm" data-arg="${k}" data-id="${esc(e.id)}" aria-label="Remove ${esc(e.name)}">${icon('trash')}</button></li>`).join('');
  return `<li class="sescard ${open ? 'open' : ''}"><button type="button" class="seshead" data-act="ses.open" data-arg="${k}" aria-expanded="${open}"><span class="code">${sBadge(k)}</span><span class="min0"><b>${esc(t.title)}</b><small>${esc(String(t.duration || '').replace(/^~\s*/, ''))} · ${plural(list.length, 'exercise')}</small></span><span class="chevd">${icon('down')}</span></button>
    ${open ? `<ul class="selist">${rows}</ul><div class="sesbtns"><button type="button" class="btn primary" data-act="ses.add" data-arg="${k}">${icon('plus')}Add exercise</button><button type="button" class="btn ghost" data-act="wk.start" data-id="${k}" data-arg="${todayISO()}">${icon('play')}Start</button></div>` : ''}</li>`;
}
function gymSessions() {
  return `<button type="button" class="libbar" data-act="lib.open">${icon('search')}<span><b>Find exercises</b><small>Search the whole library, save your own, take friends' ones</small></span>${icon('chev')}</button>
    <p class="tiny">Open a session to see its exercises. Add from the library or take one out. An exercise already in a session is marked <b>Already added</b> so you do not get doubles.</p>
    <ul class="seslist">${SESSION_KEYS.map(sesCard).join('')}</ul>
    <div class="gymbtns"><button type="button" class="btn ghost" data-act="ys.new">${icon('plus')}New session</button><button type="button" class="btn ghost" data-act="lib.open">${icon('list')}Exercise library</button></div>`;
}

/* ---------- Fuel tab: Today / Meals / Progress ---------- */
const fuelIs = tab => !navNew() || (ui.fuelTab || 'today') === tab;
function fuelSegs() {
  if (!navNew()) return '';
  const cur = ui.fuelTab || 'today';
  return `<div class="seg" role="tablist" aria-label="Fuel sections">${[['today', 'Today'], ['meals', 'Meals'], ['progress', 'Progress']].map(([k, n]) => `<button type="button" role="tab" aria-selected="${cur === k}" class="${cur === k ? 'on' : ''}" data-act="fuel.tab" data-arg="${k}">${n}</button>`).join('')}</div>`;
}
ACTIONS['fuel.tab'] = el => { ui.fuelTab = el.dataset.arg; render(); window.scrollTo(0, 0); };


/* ---------- optional creatine tracker ---------- */
const creatineOn = () => !!data.settings.creatine?.on;
function creatineRow(date) {
  if (!creatineOn()) return '';
  const dose = data.settings.creatine.dose, taken = !!data.creatine[date];
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6)), n = days.filter(d => data.creatine[d]).length;
  return `<div class="crrow ${taken ? 'on' : ''}"><div class="crtx"><b>Creatine</b><small>${dose} g · ${n} of the last 7 days</small><span class="crdots" aria-hidden="true">${days.map(d => `<i class="${data.creatine[d] ? 'on' : ''}"></i>`).join('')}</span></div><button type="button" class="btn ${taken ? 'primary' : 'ghost'}" data-act="cr.toggle" data-id="${date}" aria-pressed="${taken}">${taken ? icon('check') + 'Taken' : 'Mark taken'}</button></div>`;
}
ACTIONS['cr.toggle'] = el => { const d = el.dataset.id; if (data.creatine[d]) delete data.creatine[d]; else data.creatine[d] = data.settings.creatine.dose; save(); render(); };
ACTIONS['cr.on'] = () => { data.settings.creatine.on = !data.settings.creatine.on; save(); render(); toast(data.settings.creatine.on ? 'Creatine tracker added to Fuel → Today' : 'Creatine tracker hidden. Your history is kept.'); };
INPUTS.crdose = el => { const v = Number(el.value); if (v >= 1 && v <= 20) { data.settings.creatine.dose = Math.round(v * 10) / 10; saveSoon(); } };
function creatineSettings() {
  const c = data.settings.creatine;
  return `<p class="tiny">For people who take creatine. Off by default. When on, a one-tap "Mark taken" row appears in Fuel → Today.</p>
    <label class="switch"><span>Track creatine</span><input type="checkbox" data-act="cr.on" ${c.on ? 'checked' : ''}></label>
    ${c.on ? `<div class="field inline-field"><label for="crdose">Daily dose (grams)</label><input id="crdose" data-in="crdose" type="number" inputmode="decimal" step="0.5" min="1" max="20" value="${esc(c.dose)}"></div>` : ''}`;
}
