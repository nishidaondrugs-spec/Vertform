'use strict';
/* VERTFORM 2.0 — pages: Today, Train, Fuel, Plan, Progress, Settings */

const TABS = [['home', 'Home', 'home'], ['train', 'Train', 'train'], ['fuel', 'Fuel', 'fuel'], ['plan', 'Plan', 'plan'], ['post', 'Post', 'post']];
const PAGES = { home: () => navNew() ? viewYou() : viewHome(), today: viewToday, train: () => navNew() ? viewGym() : viewTrain(), fuel: viewFuel, plan: viewPlan, post: viewPost, friend: () => viewFriend(), settings: viewSettings, board: () => viewBoard() };
let updateReady = false;

const markHTML = '<span class="mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 6h6l5 15 5-15h6L19 27h-6z" fill="currentColor"/></svg></span>';
const wordmark = '<span class="mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 6h6l5 15 5-15h6L19 27h-6z" fill="currentColor"/></svg></span><span class="word">VERT<i>/</i>FORM</span>';

/* the day picker for the food diary lives in the top bar next to Back */
function fuelDateBar(date, today) {
  const d = parseDate(date), label = date === today ? 'Today' : `${weekdayShort(date)} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
  return `<button type="button" class="iconbtn" data-act="fuel.prev" aria-label="Previous day">${icon('back')}</button><label class="tdlabel"><span>${esc(label)}</span><input id="fuelday" type="date" data-in="fuelday" aria-label="Food diary date" value="${esc(date)}"></label><button type="button" class="iconbtn" data-act="fuel.next" aria-label="Next day">${icon('chev')}</button>`;
}
function renderNav() {
  const tb = $('#topback'); if (tb) tb.hidden = isTopPage(ui.page);
  const td = $('#topdate'); if (td) { const on = ui.page === 'fuel'; td.hidden = !on; td.innerHTML = on ? fuelDateBar(ui.fuelDate, todayISO()) : ''; document.body.classList.toggle('page-fuel', on); }
  const tw = $('#top-week'); tw.textContent = `WK ${pad2(getWeek())}/12`; tw.hidden = true;
  const me = $('#topme'); if (me) { const onMe = ui.page === 'friend' && ui.friendId === 'me'; me.hidden = onMe; if (!me.dataset.k) { me.dataset.k = 'logo'; me.innerHTML = markHTML; } }
  document.body.classList.toggle('nav2', navNew()); document.body.classList.toggle('page-sub', !isTopPage(ui.page));
  const tabs = navNew() ? railTabs() : TABS;
  $('#tab-buttons').innerHTML = navNew() ? tabsHTML() : TABS.map(([p, n, i]) => `<button type="button" class="${p === ui.page ? 'active' : ''}" data-act="nav" data-arg="${p}" aria-current="${p === ui.page ? 'page' : 'false'}">${icon(i)}<span>${n}</span></button>`).join('');
  $('#rail').innerHTML = `<div class="brand">${wordmark}</div><nav aria-label="Main">${tabs.map(([p, n, i]) => `<button type="button" class="${p === ui.page ? 'active' : ''}" data-act="nav" data-arg="${p}" aria-current="${p === ui.page ? 'page' : 'false'}">${icon(i)}<span>${n}</span></button>`).join('')}<button type="button" class="${ui.page === 'settings' ? 'active' : ''}" data-act="nav" data-arg="settings" aria-current="${ui.page === 'settings' ? 'page' : 'false'}">${icon('gear')}<span>Settings</span></button></nav>
    <button type="button" class="railme" data-act="me.open">${markHTML}<span>Profile</span></button>
    <div class="rail-foot mono">v${APP_VERSION}<br>Saved on this device only</div>`;
  const g = $('#gear'); if (g) g.setAttribute('aria-current', ui.page === 'settings' ? 'page' : 'false');
}
function render() {
  applyTheme(); renderNav(); const v = $('#view'); v.dataset.view = ui.page; const y = window.scrollY; const hp = $('.hp-body'); const hy = hp ? hp.scrollTop : 0, hadPanel = !!hp;
  if (typeof lbAuto === 'function') lbAuto();
  document.body.classList.toggle('on-home', ui.page === 'home' && !navNew()); document.body.classList.toggle('panel-open', ui.page === 'home' && !navNew() && !!ui.panel);
  /* Re-render of the same screen (e.g. tapping Fresh / Fatigued): skip entrance animations and keep the drifting background, so it doesn't look like a reload. */
  const key = `${ui.page}|${ui.panel || ''}`, same = render.last === key; render.last = key; document.body.classList.toggle('rerender', same);
  const oldBg = same ? $('.vhBg') : null, kept = new Map(same ? $$('#view [data-keep]').map(n => [n.dataset.keep, n]) : []);
  /* Browsers that can move a frame without reloading it (moveBefore) keep the 3D player running through a re-render */
  const canMove = typeof document.body.moveBefore === 'function'; let hold = null;
  if (canMove && kept.size) { hold = document.createElement('div'); hold.hidden = true; document.body.append(hold); kept.forEach(n => { try { hold.moveBefore(n, null); } catch (_) { kept.delete(n.dataset.keep); } }); }
  v.innerHTML = PAGES[ui.page](); if (oldBg) $('.vhBg')?.replaceWith(oldBg);
  $$('#view [data-keep]').forEach(n => { const o = kept.get(n.dataset.keep); if (!o) return; if (canMove) { try { n.parentNode.moveBefore(o, n); n.remove(); return; } catch (_) { /* fall back */ } } n.replaceWith(o); });
  hold?.remove(); applyLogo(); window.scrollTo(0, y); const np = $('.hp-body'); if (np && hadPanel) np.scrollTop = hy; paintPill(); updateScrollLock();
}
/* Pages open full screen with no bottom bar. Back returns to where you came from (home if nowhere). */
const navStack = [];
function go(page, scrollTop = true) {
  if (!PAGES[page]) return;
  if (ui.page !== page) { if (page === 'home' || isTopPage(page)) navStack.length = 0; else { navStack.push(ui.page); try { history.pushState({ vf: 1 }, ''); } catch (_) { /* no history API */ } } }
  ui.page = page; ui.panel = null; closeAllSheets(); render(); if (scrollTop) window.scrollTo(0, 0); $('#view').focus({ preventScroll: true });
}
function navBackNow() {
  const to = navStack.pop() || homePage(); ui.page = to; ui.panel = null; if (to === 'home' && !navNew()) ui.hub = true;
  closeAllSheets(); render(); window.scrollTo(0, 0);
}
/* Swipe in from the left edge to go back (closes the top sheet first). Iframes such as the 3D player keep their own touches. */
(function () {
  let sx = 0, sy = 0, t0 = 0, on = false, ind = null;
  const canGo = () => !$('#wk-root .wk') && !$('#dialog-root .dialog') && (sheetOpen() || !isTopPage(ui.page));
  const hide = () => { if (ind) { ind.classList.remove('on'); ind.style.transform = 'translateX(-46px)'; } };
  addEventListener('touchstart', e => {
    on = false; if (e.touches.length !== 1) return; const t = e.touches[0];
    if (t.clientX > 24 || !canGo()) return; on = true; sx = t.clientX; sy = t.clientY; t0 = Date.now();
    if (!ind) { ind = document.createElement('div'); ind.className = 'swipeback'; ind.setAttribute('aria-hidden', 'true'); ind.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>'; document.body.appendChild(ind); }
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!on) return; const t = e.touches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dy > 40 && dy > dx) { on = false; hide(); return; }
    if (dx > 8 && ind) { ind.classList.add('on'); ind.style.transform = `translateX(${Math.min(dx, 90) - 46}px)`; }
  }, { passive: true });
  addEventListener('touchend', e => {
    if (!on) return; on = false; const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy); hide();
    if (dx > 70 && dy < 60 && Date.now() - t0 < 900) { if (sheetOpen()) closeSheet(); else ACTIONS['page.back'](); }
  }, { passive: true });
  addEventListener('touchcancel', () => { on = false; hide(); }, { passive: true });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(g => addEventListener(g, e => e.preventDefault()));   // iOS pinch zoom
})();
ACTIONS['page.back'] = () => { if (history.state && history.state.vf) history.back(); else navBackNow(); };
window.addEventListener('popstate', () => { if (!isTopPage(ui.page)) navBackNow(); });
ACTIONS.nav = el => go(el.dataset.arg);

/* ---------- shared fragments ---------- */
const softCase = t => (typeof t === 'string' && /[A-Z]/.test(t) && t === t.toUpperCase() && !/[<&]/.test(t)) ? t.charAt(0) + t.slice(1).toLowerCase() : t;
const SLIM_TITLES = ['Friends', 'You', 'Gym', 'Fuel'];
const pageHead = (eyebrow, title, right = '') => (typeof navNew === 'function' && navNew() && typeof isTopPage === 'function' && isTopPage(ui.page) && SLIM_TITLES.includes(title) && !eyebrow) ? (right ? `<header class="pagehead slim">${right}</header>` : '') : `<header class="pagehead"><div class="min0">${eyebrow ? `<div class="eyebrow">${softCase(eyebrow)}</div>` : ''}<h1>${softCase(title)}</h1></div>${right}</header>`;
const sectionHead = (eyebrow, title, right = '') => `<div class="sechead"><div class="min0">${eyebrow ? `<div class="eyebrow">${softCase(eyebrow)}</div>` : ''}<h2>${softCase(title)}</h2></div>${right}</div>`;
function bar(v, max, label) { const pct = clamp(max > 0 ? v / max * 100 : 0, 0, 100); return `<div class="track" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${Math.round(max)}" aria-valuenow="${Math.round(v)}"><span style="width:${pct}%"></span></div>`; }
function macroLane(label, v, max, cls) { return `<div class="lane ${cls}"><div class="between"><b>${label}</b><span class="mono">${Math.round(v)}<small> / ${max} g</small></span></div>${bar(v, max, label)}</div>`; }
function readout(date, compact) {
  const t = targetsFor(date), v = foodTotals(date), left = t.cal - v.kcal;
  return `<section class="readout" aria-label="Calories and macros"><div class="ro-top"><div class="min0"><div class="eyebrow">${esc(dayTypeLabel(t.type))} target</div><div class="ro-num"><b class="mono">${Math.round(v.kcal).toLocaleString('en-GB')}</b><span>kcal logged</span></div></div><div class="ro-left ${left < 0 ? 'over' : ''}"><b class="mono">${Math.abs(Math.round(left)).toLocaleString('en-GB')}</b><span>${left >= 0 ? 'kcal left' : 'kcal over'}</span></div></div>
    ${bar(v.kcal, t.cal, 'Calories')}<div class="macro3">${macroLane('Protein', v.protein, t.protein, 'p')}${macroLane('Carbs', v.carbs, t.carbs, 'c')}${macroLane('Fat', v.fat, t.fat, 'f')}</div></section>`;
}
const backupNudge = () => { const b = backupStatus(); if (typeof signedIn === 'function' && acctOn() && signedIn() && syncState.at) return ''; return b.due ? `<button type="button" class="nudge" data-act="nav" data-arg="settings">${icon('download')}<span>${b.never ? 'Back up your data' : 'Backup overdue'}</span>${icon('chev')}</button>` : ''; };
function banners() {
  const out = [];
  if (storageBlocked) out.push(`<div class="banner err" role="alert">${icon('warn')}<div class="grow"><b>${storageProblem?.type === 'corrupt' ? 'Saved records could not be read' : 'This browser is blocking storage'}</b><p>${esc(storageProblem?.message || '')}</p>${storageProblem?.type === 'corrupt' ? `<div class="actions"><button type="button" class="btn sm" data-act="problem.download">${icon('download')}Download the raw data</button><button type="button" class="btn sm ghost" data-act="data.import">Import a backup</button><button type="button" class="btn sm critical" data-act="problem.fresh">Start fresh</button></div>` : ''}</div></div>`);
  if (saveFailed && !storageBlocked) out.push(`<div class="banner err" role="alert">${icon('warn')}<div class="grow"><b>Latest changes could not be saved</b><p>Storage on this device is full or blocked. Export a backup now so nothing is lost.</p><div class="actions"><button type="button" class="btn sm" data-act="backup.export">${icon('download')}Export backup</button></div></div></div>`);
  if (updateReady) out.push(`<div class="banner">${icon('info')}<div class="grow"><b>VERTFORM was updated</b><p>Reload to use the new version. Your records are not affected.</p><div class="actions"><button type="button" class="btn sm primary" data-act="app.reload">Reload now</button></div></div></div>`);
  if (loadNotes.migrated && !data.meta.upgradeNoticeSeen && (ui.page === 'home' || ui.page === 'settings')) out.push(`<div class="banner ok">${icon('check')}<div class="grow"><b>Upgraded to VERTFORM ${APP_VERSION}</b><p>Your existing records were kept in place. ${loadNotes.premigrateKept ? 'An untouched copy of them from before the upgrade is stored on this device (Settings → Backups).' : 'A pre-upgrade copy could not be stored (device storage is full). Export a backup soon.'}${loadNotes.warnings.length ? ' ' + esc(loadNotes.warnings.join(' ')) : ''}</p><div class="actions"><button type="button" class="btn sm ghost" data-act="notice.seen">Got it</button></div></div></div>`);
  const b = backupStatus();
  if (ui.page === 'fuel' || ui.panel === 'diet') { out.push(profileBanner()); out.push(fuelFlagsHtml()); }
  return out.join('');
}
ACTIONS['notice.seen'] = () => { data.meta.upgradeNoticeSeen = true; save(); render(); };
ACTIONS['backup.snooze'] = () => { data.settings.backup.snoozedUntil = new Date(Date.now() + 86400000).toISOString(); save(); render(); };
ACTIONS['app.reload'] = () => location.reload();

/* =============== TODAY =============== */
function weekStrip(mon, selectable = true) {
  const plan = weekPlan(mon);
  return `<div class="strip" role="list" aria-label="This week">${plan.days.map(d => {
    const gym = d.items.find(i => i.kind === 'gym'), mt = d.items.find(i => i.kind === 'match'), tr = d.items.find(i => i.kind === 'training' && !i.cancelled);
    const main = mt || gym || tr; const st = main ? main.status : 'rest'; const glyph = mt ? 'M' : gym ? gym.session : tr ? 'VB' : '·';
    const extra = d.items.length > 1 ? ' +' : '';
    const label = `${DOW_LONG[d.idx]} ${d.date.slice(8)}: ${d.items.length ? d.items.map(i => (i.kind === 'gym' ? `gym session ${i.session}` : i.kind === 'match' ? 'match' : i.cancelled ? 'cancelled training' : 'volleyball training') + ' ' + (i.status === 'done' ? 'completed' : i.status)).join(', ') : 'rest day'}${d.conflicts.length ? ', has a conflict' : ''}`;
    return `<button type="button" role="listitem" class="lane-day st-${st} ${d.isToday ? 'today' : ''} ${d.conflicts.some(c => c.level === 'warn') ? 'flag' : ''}" data-act="day.open" data-id="${d.date}" aria-label="${esc(label)}"><span class="dw">${DOW[d.idx].slice(0, 3)}</span><span class="dn mono">${parseDate(d.date).getDate()}</span><span class="gl ${mt ? 'm' : gym ? 'g' : tr ? 'v' : ''}">${glyph}${extra}</span><span class="stt" aria-hidden="true">${st === 'done' ? '✓' : st === 'missed' ? '×' : st === 'planned' ? '○' : ''}</span></button>`;
  }).join('')}</div>`;
}
function todayItems() {
  const today = todayISO(), day = dayPlan(today); const rows = [];
  for (const it of day.items) {
    if (it.kind === 'gym') {
      const t = templates[it.session], w = getWeek(), p = progression[w - 1]; const draftHere = data.draft && data.draft.session === it.session && data.draft.date === today;
      rows.push(`<li class="plan-item"><span class="code">${sBadge(it.session)}</span><div class="grow min0"><div class="eyebrow">${it.status === 'done' ? 'Logged' : draftHere ? 'In progress' : 'Planned'}${it.pinned ? ' · moved' : ''}</div><strong>${esc(t.title)}</strong><small>${esc(t.duration)} · ${it.session === 'A' ? `main lift ${p.sets} @ ${p.pct}` : esc(t.subtitle)}</small></div>${it.status === 'done' ? `<button type="button" class="btn ghost" data-act="log.view" data-id="${esc(it.log.id)}">View</button>` : `<button type="button" class="btn primary" data-act="wk.start" data-id="${it.session}" data-arg="${today}">${icon('play')}${draftHere ? 'Resume' : 'Start'}</button>`}</li>`);
    } else if (it.kind === 'match') {
      const inf = it.info || {};
      rows.push(`<li class="plan-item"><span class="code ball">${icon('ball')}</span><div class="grow min0"><div class="eyebrow">MATCH · ${it.status === 'done' ? 'LOGGED' : 'TODAY'}</div><strong>${esc(inf.opponent ? 'vs ' + inf.opponent : 'Match day')}</strong><small>${[inf.time, inf.venue].filter(Boolean).map(esc).join(' · ') || 'No gym today. Fuel and recover.'}</small></div>${it.log ? `<button type="button" class="btn ghost" data-act="vb.edit" data-id="${esc(it.log.id)}">View</button>` : `<button type="button" class="btn primary" data-act="vb.log" data-arg="match" data-id="${today}">Log</button>`}</li>`);
    } else if (it.kind === 'training' && !it.cancelled) {
      rows.push(`<li class="plan-item"><span class="code ball">${icon('ball')}</span><div class="grow min0"><div class="eyebrow">VOLLEYBALL · ${it.status === 'done' ? 'LOGGED' : 'TRAINING'}</div><strong>${esc(it.extra?.title || 'Club training')}</strong><small>${it.extra?.time ? esc(it.extra.time) : 'Count it towards your weekly load'}</small></div>${it.log ? `<button type="button" class="btn ghost" data-act="vb.edit" data-id="${esc(it.log.id)}">View</button>` : `<button type="button" class="btn primary" data-act="vb.log" data-arg="training" data-id="${today}">Log</button>`}</li>`);
    }
  }
  if (!rows.length) rows.push(`<li class="plan-item rest"><span class="code">–</span><div class="grow min0"><div class="eyebrow">REST DAY</div><strong>Recovery / mobility</strong><small>An unscheduled day is not missed progress.</small></div><button type="button" class="btn ghost" data-act="nav" data-arg="train">Train anyway</button></li>`);
  return `<ul class="planlist" aria-label="Today's plan">${rows.join('')}</ul>`;
}
function viewToday() {
  const today = todayISO(), mon = monday(today), w = getWeek(), plan = weekPlan(mon);
  const sum = weekSummary(mon); const conflicts = upcomingConflicts(2); const r = data.readiness[today] || {};
  const draft = data.draft && !(dayPlan(today).items.some(i => i.kind === 'gym' && i.session === data.draft.session && data.draft.date === today));
  const next = nearestMatch(today); const reach = latestMetric('reach'), touch = latestMetric('approach'), jump = latestMetric('approachJump'), cmj = latestMetric('cmj');
  return `${pageHead(`${esc(weekdayShort(today).toUpperCase())} · WEEK ${w} OF 12${isDeload(w) ? ' · EASY WEEK' : ''}`, `${parseDate(today).getDate()} ${parseDate(today).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}`, `<div class="stamp" role="img" aria-label="Next log number ${nextSessionNumber()}"><span>NEXT LOG Nº</span><b class="mono">${nextSessionNumber()}</b></div>`)}
    ${banners()}
    ${draft ? `<div class="banner">${icon('play')}<div class="grow"><b>${esc(sName(data.draft.session))} is still open</b><p>From ${esc(pretty(data.draft.date))} · ${sum_sets(data.draft)} sets ticked.</p><div class="actions"><button type="button" class="btn sm primary" data-act="wk.resume">Resume</button></div></div></div>` : ''}
    ${todayItems()}
    ${conflicts.length ? `<button type="button" class="banner warn linkish" data-act="nav" data-arg="plan">${icon('warn')}<div class="grow"><b>${plural(conflicts.length, 'scheduling clash')} in your plan</b><p>${esc(conflicts[0].text)}. Review in Plan.</p></div>${icon('chev')}</button>` : ''}
    <div class="quick"><button type="button" class="btn primary" data-act="food.open">${icon('plus')}Add food</button><button type="button" class="btn ghost" data-act="vb.log" data-arg="training">${icon('ball')}Log volleyball</button></div>
    ${readout(today, true)}
    <div class="between rowlink"><span class="tiny">${foodsFor(today).length ? plural(foodsFor(today).length, 'entry', 'entries') + ' logged today' : 'Nothing logged yet today'}</span><button type="button" class="linkbtn" data-act="nav" data-arg="fuel">Open food diary ${icon('chev')}</button></div>
    ${sectionHead('THIS WEEK', `${esc(pretty(mon))} – ${esc(pretty(addDays(mon, 6)))}`, `<button type="button" class="linkbtn" data-act="nav" data-arg="plan">Plan ${icon('chev')}</button>`)}
    ${weekStrip(mon)}
    <dl class="tally"><div><dt>Gym</dt><dd class="mono">${sum.gymDone}<small> / ${sum.gymPlanned}</small></dd></div><div><dt>Volleyball</dt><dd class="mono">${sum.vbN}<small> ${sum.vbN === 1 ? 'session' : 'sessions'}</small></dd></div><div><dt>Next match</dt><dd class="mono">${next ? esc(pretty(next)) : '—'}</dd></div></dl>
    ${sectionHead('RECOVERY', 'How\'s your body?', `<span class="tag ${r.level === 'red' ? 'rose' : r.level === 'amber' ? 'ochre' : r.level === 'green' ? 'sage' : ''}">${r.level ? esc(r.level === 'green' ? 'Fresh' : r.level === 'amber' ? 'Moderate' : 'Fatigued') : 'Not checked'}</span>`)}
    <div class="seg3" role="radiogroup" aria-label="Readiness today"><button type="button" role="radio" aria-checked="${r.level === 'green'}" data-act="ready" data-arg="green" class="${r.level === 'green' ? 'on g' : ''}">Fresh</button><button type="button" role="radio" aria-checked="${r.level === 'amber'}" data-act="ready" data-arg="amber" class="${r.level === 'amber' ? 'on a' : ''}">Moderate</button><button type="button" role="radio" aria-checked="${r.level === 'red'}" data-act="ready" data-arg="red" class="${r.level === 'red' ? 'on r' : ''}">Fatigued</button></div>
    <p class="note">${r.level === 'green' ? 'Follow the session prescription.' : r.level === 'amber' ? 'Cut leg sets by around a third and keep jumps light.' : r.level === 'red' ? 'Skip hard lower-body training and prioritise recovery.' : 'Check in before demanding training.'}</p>
    <div class="field inline-field"><label for="sleep">Last night's sleep (hours)</label><input id="sleep" data-in="daily" data-key="sleep" type="number" inputmode="decimal" step="0.5" min="0" max="16" placeholder="e.g. 8" value="${esc(r.sleep ?? '')}"></div>
    ${sectionHead('JUMP', 'Latest readings', `<button type="button" class="linkbtn" data-act="ms.add" data-arg="approach">${icon('plus')}Measure</button>`)}
    ${jumpReadouts(reach, touch, jump, cmj, true)}`;
}
const sum_sets = d => d.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
ACTIONS.ready = el => { const d = todayISO(); data.readiness[d] = { ...(data.readiness[d] || {}), level: el.dataset.arg }; save(); render(); };
INPUTS.daily = el => { const d = todayISO(); data.readiness[d] = { ...(data.readiness[d] || {}), [el.dataset.key]: el.value }; saveSoon(); };
ACTIONS['food.open'] = () => { ui.fuelDate = todayISO(); ui.fuelMeal = null; openFoodSearch(); };

function jumpReadouts(reach, touch, jump, cmj, compact) {
  const row = (label, e, unit, extra, cls) => `<div class="jr ${cls || ''}"><dt>${label}</dt><dd><b class="mono">${e ? esc(fmt(e.value, 1)) : '—'}</b><span class="u">${e ? unit : ''}</span></dd><div class="jmeta">${e ? `${esc(pretty(e.date))}${extra ? ' · ' + extra : ''}` : 'Not measured'}</div></div>`;
  return `<dl class="jumpgrid ${compact ? 'compact' : ''}">${row('Standing reach', reach, 'cm', '', 'reach')}${row('Approach touch', touch, 'cm', touch && touch.reachUsed ? `reach used ${fmt(touch.reachUsed, 1)}` : touch ? 'no reach recorded' : '', 'touch')}${row('Approach jump', jump, 'cm', jump ? `${fmt(jump.value + jump.reachUsed, 1)} − ${fmt(jump.reachUsed, 1)}` : 'needs reach + touch', 'ajump')}${row('Standing CMJ', cmj, 'cm', 'separate test', 'cmj')}</dl>`;
}

/* =============== TRAIN =============== */
function viewTrain() {
  ui.trainDate = ui.trainDate && isISO(ui.trainDate) ? ui.trainDate : todayISO();
  const tabs = [['gym', 'Gym'], ['vb', 'Volleyball'], ['jump', 'Jump'], ['history', 'History']];
  return `${pageHead('', 'TRAINING LOG')}${banners()}
    <div class="seg" role="tablist" aria-label="Training sections">${tabs.map(([k, n]) => `<button type="button" role="tab" aria-selected="${ui.trainTab === k}" class="${ui.trainTab === k ? 'on' : ''}" data-act="train.tab" data-arg="${k}">${n}</button>`).join('')}</div>
    ${ui.trainTab === 'gym' ? trainGym() : ui.trainTab === 'vb' ? trainVb() : ui.trainTab === 'jump' ? trainJump() : trainHistory()}`;
}
ACTIONS['train.tab'] = el => { ui.trainTab = el.dataset.arg; render(); };
INPUTS.traindate = el => { if (isISO(el.value)) { ui.trainDate = el.value; render(); } };
function sessionRow(k) {
  const t = templates[k], logs = data.logs.filter(l => l.completed && l.session === k).sort((a, b) => b.date.localeCompare(a.date)), last = logs[0];
  const draftHere = data.draft && data.draft.session === k && data.draft.date === ui.trainDate;
  const mins = String(t.duration || '').replace(/^~\s*/, '');
  return `<li class="srow ${draftHere ? 'live' : ''}"><button type="button" class="srow-main" data-act="wk.start" data-id="${k}" data-arg="${ui.trainDate}" aria-label="${draftHere ? 'Resume' : 'Start'} ${esc(t.title)}"><span class="code">${sBadge(k)}</span><span class="srow-tx"><b>${esc(t.title)}</b><small>${esc(mins)} · ${allExercises(k).length} exercises${last ? ` · last ${esc(pretty(last.date))}` : ''}</small></span><span class="srow-go">${draftHere ? 'Resume' : icon('play')}</span></button>${t.custom ? `<button type="button" class="srow-edit" data-act="ys.edit" data-id="${k}" aria-label="Edit ${esc(t.title)}">${icon('edit')}</button>` : ''}</li>`;
}
function trainGym() {
  const d = data.draft;
  return `${d ? `<div class="banner">${icon('play')}<div class="grow"><b>${esc(sName(d.session))} in progress</b><p>${esc(templates[d.session]?.title || '')} · ${esc(pretty(d.date))} · ${sum_sets(d)} sets ticked.</p><div class="actions"><button type="button" class="btn sm primary" data-act="wk.resume">Resume</button><button type="button" class="btn sm ghost" data-act="wk.discard">Discard</button></div></div></div>` : ''}
    ${ui.trainDate !== todayISO() || ui.trainDateOpen ? `<div class="datebar"><label for="traindate">Logging for</label><input id="traindate" type="date" data-in="traindate" value="${esc(ui.trainDate)}">${ui.trainDate !== todayISO() ? `<button type="button" class="btn sm ghost" data-act="train.today">Today</button>` : ''}</div>` : `<p class="tiny"><button type="button" class="linkbtn" data-act="train.dateopen">Log for another day</button></p>`}
    <ul class="sessionlist">${SESSION_KEYS.map(sessionRow).join('')}</ul>
    <button type="button" class="btn ghost block mt" data-act="ys.new">${icon('plus')}Create your own session</button>`;
}
ACTIONS['train.today'] = () => { ui.trainDate = todayISO(); render(); };
function vbRow(l) {
  const ld = sessionLoad(l);
  return `<li class="log-row"><span class="code ball">${icon('ball')}</span><div class="grow min0"><div class="eyebrow">${l.kind === 'match' ? 'Match' : 'Club training'}</div><strong>${esc(weekdayShort(l.date))} ${esc(pretty(l.date))}${l.opponent ? ' · vs ' + esc(l.opponent) : ''}</strong><small>${esc(fmtMins(l.durationMin))}${l.rpe ? ` · RPE ${esc(l.rpe)}` : ''}${ld ? ` · load ${ld}` : ''}${jumpsText(l) ? ' · ' + esc(jumpsText(l)) : ''}</small></div><button type="button" class="iconbtn" data-act="vb.edit" data-id="${esc(l.id)}" aria-label="Edit session on ${esc(pretty(l.date))}">${icon('edit')}</button></li>`;
}
function trainVb() {
  const mon = monday(todayISO()), s = weekSummary(mon), logs = [...data.vb.logs].sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''))).slice(0, 15);
  return `<div class="quick"><button type="button" class="btn primary" data-act="vb.log" data-arg="training">${icon('ball')}Log training</button><button type="button" class="btn ghost" data-act="vb.log" data-arg="match">Log match</button></div>
    <dl class="tally"><div><dt>This week</dt><dd class="mono">${s.vbN}<small> ${s.vbN === 1 ? 'session' : 'sessions'}</small></dd></div><div><dt>Time</dt><dd class="mono">${s.minutes ? fmtMins(s.minutes) : '—'}</dd></div><div><dt>Load</dt><dd class="mono">${s.loggedLoadN ? s.load : '—'}<small> AU</small></dd></div></dl>
    <details class="explain"><summary>What is session load?</summary><p class="note">Session load is <b>duration (minutes) × session RPE (1–10)</b>, in arbitrary units (AU). It is a simple way to compare how big sessions and weeks felt. It is not an injury prediction and not a medical score, and it only counts sessions where you entered both a duration and an RPE.</p></details>
    ${sectionHead('LOGBOOK', 'Volleyball sessions', `<span class="tag">${data.vb.logs.length} saved</span>`)}
    ${logs.length ? `<ul class="loglist">${logs.map(vbRow).join('')}</ul>` : emptyBox('No volleyball sessions logged yet. Log a club training or match to see it here, separate from your gym sessions.')}`;
}
function historyItems() {
  const gym = data.logs.filter(l => l.completed).map(l => ({ type: 'gym', date: l.date, k: l.date + (l.completedAt || ''), l })), vb = data.vb.logs.map(l => ({ type: l.kind, date: l.date, k: l.date + (l.createdAt || ''), l }));
  return [...gym, ...vb].sort((a, b) => b.k.localeCompare(a.k));
}
function trainHistory() {
  const f = ui.historyFilter, items = historyItems().filter(x => f === 'all' || (f === 'gym' ? x.type === 'gym' : x.type !== 'gym')).slice(0, 60);
  return `<div class="chip-row filt" role="group" aria-label="Filter history">${[['all', 'All'], ['gym', 'Gym'], ['vb', 'Volleyball']].map(([k, n]) => `<button type="button" class="chip ${f === k ? 'on' : ''}" aria-pressed="${f === k}" data-act="hist.filter" data-arg="${k}">${n}</button>`).join('')}</div>
    ${items.length ? `<ul class="loglist">${items.map(x => x.type === 'gym' ? `<li class="log-row"><span class="code">${esc(x.l.session)}</span><div class="grow min0"><div class="eyebrow">Gym</div><strong>${esc(templates[x.l.session]?.title || 'Training')}</strong><small>${esc(weekdayShort(x.date))} ${esc(pretty(x.date))} · ${sum(x.l.exercises, e => e.sets.filter(s => s.done).length)} sets${x.l.rpe ? ` · RPE ${esc(x.l.rpe)}` : ''}</small></div><button type="button" class="btn sm ghost" data-act="log.view" data-id="${esc(x.l.id)}">View</button></li>` : vbRow(x.l)).join('')}</ul>` : emptyBox('Nothing logged yet. Start a gym session or log volleyball and it will appear here.')}`;
}
ACTIONS['hist.filter'] = el => { ui.historyFilter = el.dataset.arg; render(); };

/* =============== FUEL =============== */
function entryRow(f) {
  const isRec = !!f.recipeSnapshot;
  return `<li class="food"><div class="grow min0"><strong>${esc(f.name)}</strong>${f.barcode ? ' ' + tag('Scan', 'slate') : isRec ? ' ' + tag(f.recipeSnapshot.type === 'meal' ? 'Meal' : 'Recipe', 'sage') : f.source === 'Everyday food estimate' ? ' ' + tag('Generic') : ''}<small class="fm"><i class="p">${fmt(Number(f.protein) || 0, 0)}<u>P</u></i><i class="c">${fmt(Number(f.carbs) || 0, 0)}<u>C</u></i><i class="f">${fmt(Number(f.fat) || 0, 0)}<u>F</u></i></small></div><b class="kc mono">${Math.round(f.kcal)}<small>kcal</small></b><button type="button" class="iconbtn" data-act="food.edit" data-id="${esc(f.id)}" aria-label="Edit ${esc(f.name)}">${icon('edit')}</button><button type="button" class="iconbtn" data-act="food.del" data-id="${esc(f.id)}" aria-label="Delete ${esc(f.name)}">${icon('trash')}</button></li>`;
}
function recipeCard(r) {
  const p = recipePerServing(r);
  return `<li class="recipe"><div class="between"><div class="min0"><strong>${esc(r.name)}</strong>${' ' + tag(r.type === 'meal' ? 'Meal' : `${fmt(r.servings, 2)} servings`)}<small>${Math.round(p.kcal)} kcal · ${fmt(p.protein, 0)}P ${fmt(p.carbs, 0)}C ${fmt(p.fat, 0)}F per ${servingWord(r, 1)} · ${plural(r.ingredients.length, 'ingredient')}</small></div></div>
    <div class="actions"><button type="button" class="btn primary" data-act="recipe.log" data-id="${esc(r.id)}">Log</button><button type="button" class="btn ghost" data-act="recipe.edit" data-id="${esc(r.id)}">${icon('edit')}Edit</button><button type="button" class="iconbtn" data-act="recipe.dup" data-id="${esc(r.id)}" aria-label="Duplicate ${esc(r.name)}">${icon('copy')}</button></div></li>`;
}
/* calorie trend: intake against each day's target, so over and under shows at a glance */
function calTrendHtml(end) {
  const n = 7, today = todayISO(), days = Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
  const rows = days.map(d => { const k = Math.round(foodTotals(d).kcal), g = targetsFor(d).cal; return { d, k, g, logged: k > 0, now: d === today, over: k > g * 1.07 }; });
  const done = rows.filter(r => r.logged && !r.now), avg = done.length ? Math.round(sum(done, r => r.k) / done.length) : 0, avgG = Math.round(sum(rows, r => r.g) / n), delta = avg - avgG;
  const pick = rows.find(r => r.d === ui.trendPick) || null, fmtK = v => Math.round(v).toLocaleString('en-GB');
  const W = 360, H = 120, top = 8, bot = 22, ph = H - top - bot, cw = W / n, bw = 12, max = Math.max(1, ...rows.map(r => Math.max(r.k, r.g))) * 1.08, y = v => top + ph - v / max * ph;
  const bars = rows.map((r, i) => { const x = i * cw + (cw - bw) / 2, h = r.logged ? Math.max(3, top + ph - y(r.k)) : 0, cx = (x + bw / 2).toFixed(1), on = pick ? pick.d === r.d : r.d === end;
    return `<g class="cm-col${r.over ? ' over' : ''}${r.now ? ' now' : ''}${on ? ' sel' : ''}" data-act="fuel.bar" data-id="${r.d}" role="button" aria-label="${esc(longDate(r.d))}: ${r.logged ? r.k + ' kcal' : 'nothing logged'}"><rect x="${(i * cw).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${H}" fill="transparent"/>${r.logged ? `<rect class="cm-bar" x="${x.toFixed(1)}" y="${(top + ph - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="6"/>` : `<circle class="cm-dot" cx="${cx}" cy="${(top + ph - 2).toFixed(1)}" r="2"/>`}${pick && pick.d === r.d && r.logged ? `<text class="cm-val" x="${Math.min(W - 20, Math.max(20, x + bw / 2)).toFixed(1)}" y="${Math.max(9, top + ph - h - 6).toFixed(1)}" text-anchor="middle">${fmtK(r.k)}</text>` : ''}<text class="cm-lab" x="${cx}" y="${H - 6}" text-anchor="middle">${esc(weekdayShort(r.d).slice(0, 1))}</text></g>`; }).join('');
  let head, hcls = delta > 40 ? 'over' : '';
  if (pick) {
    const dd = pick.k - pick.g, nm = pick.now ? 'Today so far' : `${weekdayShort(pick.d)} ${parseDate(pick.d).getDate()} ${parseDate(pick.d).toLocaleDateString('en-GB', { month: 'short' })}`;
    head = !pick.logged ? `${esc(nm)}: nothing logged` : `${esc(nm)}: ${fmtK(pick.k)} kcal`; hcls = pick.logged && pick.over ? 'over' : '';
    var sub = pick.logged ? `<span class="cm-sub">Target ${fmtK(pick.g)} kcal${pick.now ? '' : ` · ${Math.abs(dd) < pick.g * .07 ? 'on target' : `${fmtK(Math.abs(dd))} ${dd > 0 ? 'over' : 'under'}`}`}${pick.d !== end ? ` · <button type="button" class="linkbtn" data-act="fuel.pickday" data-id="${pick.d}">Open day</button>` : ''}</span>` : (pick.d !== end ? `<span class="cm-sub"><button type="button" class="linkbtn" data-act="fuel.pickday" data-id="${pick.d}">Open day</button></span>` : '');
  } else {
    head = !done.length ? 'Log a few full days to see your trend.' : Math.abs(delta) <= 40 ? 'On target this week' : `${fmtK(Math.abs(delta))} kcal ${delta > 0 ? 'over' : 'under'} a day`;
    var sub = done.length ? '<span class="cm-sub">Tap a bar to see that day</span>' : '';
  }
  return `<section class="ctrend min" aria-label="Calorie trend"><div class="eyebrow">CALORIE TREND · 7 DAYS</div><p class="cm-sum ${hcls}">${head}</p>${sub}<svg class="cm-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Calories against target, last 7 days"><line class="cm-tgt" x1="0" x2="${W}" y1="${y(avgG).toFixed(1)}" y2="${y(avgG).toFixed(1)}"/>${bars}</svg></section>`;
}
ACTIONS['fuel.bar'] = el => { ui.trendPick = ui.trendPick === el.dataset.id ? null : el.dataset.id; render(); };
ACTIONS['fuel.pickday'] = el => { if (isISO(el.dataset.id)) { ui.fuelDate = el.dataset.id; ui.trendPick = null; render(); } };
function viewFuel() {
  const date = ui.fuelDate, t = targetsFor(date), fs = foodsFor(date), diff = daysBetween(todayISO(), date), barDays = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  const groups = MEALS.map(m => { const list = fs.filter(f => f.meal === m); const kc = sum(list, f => f.kcal);
    return `<section class="mealgroup ${list.length ? '' : 'empty'}" aria-label="${m}"><div class="mealhead"><div class="mealtitle" data-meal="${m}"><span class="mdot" aria-hidden="true"></span><b class="mname">${m}</b>${list.length ? `<span class="mk mono">${Math.round(kc)} kcal</span>` : ''}</div><div class="mh-act">${list.length ? `<button type="button" class="iconbtn" data-act="meal.fromdiary" data-arg="${m}" aria-label="Save ${m.toLowerCase()} as a meal">${icon('bookmark')}</button>` : ''}<button type="button" class="iconbtn plus" data-act="food.openmeal" data-arg="${m}" aria-label="Add food to ${m.toLowerCase()}">${icon('plus')}</button></div></div>${list.length ? `<ul class="foodlist">${list.map(entryRow).join('')}</ul>` : `<p class="mealempty">Nothing logged</p>`}</section>`; }).join('');
  const recs = recipesByRecency();
  return `${banners()}
    ${typeof fuelSegs === 'function' ? fuelSegs() : ''}
    <div class="datebar nav deskonly"><button type="button" class="iconbtn" data-act="fuel.prev" aria-label="Previous day">${icon('back')}</button><input id="fuelday" type="date" data-in="fuelday" aria-label="Food diary date" value="${esc(date)}"><button type="button" class="iconbtn" data-act="fuel.next" aria-label="Next day">${icon('chev')}</button>${diff !== 0 ? `<button type="button" class="btn sm ghost" data-act="fuel.today">Today</button>` : ''}</div>
    ${diff === 0 ? '' : `<div class="datelabel fuelpast"><span>${esc(longDate(date))}</span><button type="button" class="btn sm ghost" data-act="fuel.today">Back to today</button></div>`}
    ${fuelIs('today') ? readout(date) : ''}
    ${fuelIs('today') ? `<div class="fuelcta"><button type="button" class="btn primary" data-act="food.open2">${icon('plus')}Add food</button><button type="button" class="fscan" data-act="food.scan" aria-label="Scan a barcode">${icon('scan')}</button></div>` : ''}
    ${fuelIs('progress') ? calTrendHtml(date) : ''}
    ${fuelIs('today') && typeof creatineRow === 'function' ? creatineRow(date) : ''}
    ${fuelIs('today') ? `<div class="meals">${groups}</div>` : ''}
    ${fuelIs('progress') ? weightCard() : ''}
    ${fuelIs('meals') ? `<details class="explain mt" ${recs.length || navNew() ? 'open' : ''}><summary><span>Saved meals &amp; recipes</span><b class="mono">${recs.length}</b></summary><div class="quick"><button type="button" class="btn sm ghost" data-act="recipe.new" data-arg="meal">${icon('plus')}Meal</button><button type="button" class="btn sm primary" data-act="recipe.new" data-arg="recipe">${icon('plus')}Recipe</button></div>
    ${recs.length ? `<ul class="recipes">${recs.map(recipeCard).join('')}</ul>` : emptyBox('Save a meal from your diary (the bookmark icon on any meal), or build a recipe from ingredients with a yield, and log servings in one tap.')}</details>` : ''}
    ${fuelIs('progress') ? `<details class="explain" ${navNew() ? 'open' : ''}><summary><span>Targets &amp; last 7 days</span><b class="mono">${t.cal}</b></summary><div class="quick"><button type="button" class="btn sm ghost" data-act="calc.open">Adjust targets</button></div>
    <dl class="tally four"><div><dt>Protein</dt><dd class="mono">${t.protein}<small> g</small></dd></div><div><dt>Carbs</dt><dd class="mono">${t.carbs}<small> g</small></dd></div><div><dt>Fat</dt><dd class="mono">${t.fat}<small> g</small></dd></div><div><dt>Energy</dt><dd class="mono">${t.cal}<small> kcal</small></dd></div></dl>
</details>` : ''}`;
}
ACTIONS['food.open2'] = () => { ui.fuelMeal = null; openFoodSearch(); };
ACTIONS['food.openmeal'] = el => { ui.fuelMeal = el.dataset.arg; openFoodSearch(el.dataset.arg); };
ACTIONS['fuel.prev'] = () => { ui.fuelDate = addDays(ui.fuelDate, -1); render(); };
ACTIONS['fuel.next'] = () => { ui.fuelDate = addDays(ui.fuelDate, 1); render(); };
ACTIONS['fuel.today'] = () => { ui.fuelDate = todayISO(); render(); };
INPUTS.fuelday = el => { if (isISO(el.value)) { ui.fuelDate = el.value; render(); const i = $('#fuelday'); i && i.focus({ preventScroll: true }); } };

/* =============== PLAN =============== */
function viewPlan() {
  const mon = ui.planWeek, w = weekFor(mon);
  return `${pageHead('', 'CALENDAR', isDeload(w) ? `<span class="tag ochre">Easy week</span>` : '')}${banners()}
    ${calendarBody(mon)}`;
}
ACTIONS['train.dateopen'] = () => { ui.trainDateOpen = true; render(); };
ACTIONS['plan.shift'] = el => { ui.planWeek = addDays(ui.planWeek, Number(el.dataset.arg)); render(); };
ACTIONS['plan.now'] = () => { ui.planWeek = monday(todayISO()); render(); };

/* =============== PROGRESS =============== */

/* =============== SETTINGS =============== */
function setGroup(title, sub, inner, open) { return `<details class="setgroup" ${open ? 'open' : ''}><summary><span><b>${title}</b><small>${sub}</small></span>${icon('chev')}</summary><div class="sg-body">${inner}</div></details>`; }
function viewSettings() {
  const b = backupStatus(), r = data.settings.rest, nT = vbDaysFor(todayISO()).length;
  return `${pageHead('', 'SETTINGS')}${banners()}
    ${typeof accountGroup === 'function' ? accountGroup() : ''}
    ${setGroup('You', 'Profile, calories and baseline', `<p class="tiny">Age, sex, height, weight, daily activity and goal shape your calorie and protein targets.</p><button type="button" class="btn ghost" data-act="calc.open">${icon('edit')}Edit my profile</button>
      <div class="form-row"><div class="field"><label for="startdate">Week 1 starts</label><input type="date" id="startdate" data-profile="startDate" value="${esc(data.user.startDate)}"></div><div class="field"><label for="oneRM">Trap-bar estimated 1RM (kg)</label><input type="number" inputmode="decimal" id="oneRM" step="0.5" min="0" data-profile="trap1rm" placeholder="Optional" value="${esc(data.user.trap1rm)}"></div></div>
    <p class="tiny">Main-lift recommendations use the middle of the prescribed % range. An RPE cap of 8 always takes priority. Your 1RM also feeds the Vertical plan.</p><button type="button" class="btn primary" data-act="profile.save">Save profile</button>`)}
    ${setGroup('Training', `${plural(nT, 'fixed training')} · ${plural(activeSessions().length, 'gym session')} a week`, `<div class="eyebrow">FIXED TRAININGS</div><p class="tiny">${vbDaysFor(todayISO()).length ? vbDaysFor(todayISO()).map(i => esc(data.vb.trainInfo?.[String(i)]?.name || DOW_LONG[i]) + ' (' + DOW[i] + ')').join(', ') : 'None set'}.</p><button type="button" class="btn ghost" data-act="days.open">${icon('edit')}Edit fixed trainings</button>
      <div class="eyebrow mt">EXERCISE LIBRARY</div><p class="tiny">Every exercise you have used, plus any you add yourself or take from friends. Pick from it when building a session or adding to a workout.</p><button type="button" class="btn ghost" data-act="lib.open">${icon('list')}Open exercise library</button>
      <div class="eyebrow mt">YOUR OWN SESSIONS</div><p class="tiny">Build gym sessions with your own exercises from Train.</p><button type="button" class="btn ghost" data-act="ys.new">${icon('plus')}Create a session</button>
      <div class="eyebrow mt">REST TIMER</div><div class="switches">${restSwitches()}</div>
    <p class="tiny">Defaults are suggested per exercise from its guidance; set your own from the timer panel inside a workout.</p>
      ${!data.user.hideBuiltin ? `<div class="eyebrow mt">EXTRA EXERCISES FOR A, B, C, D</div><p class="tiny">Add exercises to any session. They appear in future workouts, not in saved ones.</p><button type="button" class="btn ghost" data-act="ex.add">${icon('plus')}Add an exercise</button>
    <ul class="mlist">${BUILTIN_KEYS.map(k => `<li><span class="code sm">${k}</span><div class="grow"><b>${sName(k)}</b><small>${(data.custom[k] || []).length} custom exercises</small></div>${(data.custom[k] || []).length ? `<button type="button" class="btn sm ghost" data-act="ex.manage" data-arg="${k}">Manage</button>` : ''}</li>`).join('')}</ul>` : ''}`)}
    ${setGroup('Appearance', `${data.settings.theme === 'light' ? 'Light' : data.settings.theme === 'auto' ? 'Match phone' : 'Dark'} theme`, appearanceSection())}
    ${typeof pushSettings === 'function' ? setGroup('Notifications', pushSummary(), pushSettings()) : ''}
    ${typeof creatineSettings === 'function' ? setGroup('Creatine', data.settings.creatine?.on ? `Tracking · ${data.settings.creatine.dose} g a day` : 'Optional daily tracker', creatineSettings()) : ''}
    ${setGroup('Backup & data', b.cloud ? 'Backed up to your account · files optional' : b.due ? 'Backup overdue' : b.last ? 'Last backup ' + (b.daysSince === 0 ? 'today' : plural(b.daysSince, 'day') + ' ago') : 'No backup yet', `<div class="backupbox"><div class="bk-row"><span class="eyebrow">LAST BACKUP FILE CREATED</span><b class="mono">${b.last ? esc(b.last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + b.last.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) : 'Never'}</b></div>
      <p class="tiny">${b.last ? `${b.daysSince === 0 ? 'Today' : plural(b.daysSince, 'day') + ' ago'}${b.changed !== null ? ` · ${b.changed > 0 ? plural(b.changed, 'record') + ' added since' : b.changed < 0 ? plural(-b.changed, 'record') + ' removed since' : 'no record count change since'}` : ''}.` : (b.total ? `You have ${plural(b.total, 'record')} that exist only on this device.` : 'Nothing to back up yet.')}</p>
      <div class="status ${b.due ? 'warn' : ''}">${b.due ? 'Backup overdue. ' : ''}VERTFORM can create the file, but cannot see where your browser puts it. Check that it landed in your Downloads or Files app and copy it somewhere safe, such as cloud storage or email to yourself.</div>
      <div class="quick"><button type="button" class="btn primary" data-act="backup.export">${icon('download')}Create backup file</button>${canShareFiles() ? `<button type="button" class="btn ghost" data-act="backup.share">${icon('upload')}Share / save to Files</button>` : ''}</div>
      <div class="quick"><button type="button" class="btn ghost" data-act="data.import">${icon('upload')}Import a backup…</button></div>
      <div class="field"><label for="remind">Remind me to back up</label><select id="remind" data-in="remind">${[[0, 'Never'], [7, 'Every week'], [14, 'Every 2 weeks'], [30, 'Every month'], [60, 'Every 2 months']].map(([d, n]) => `<option value="${d}" ${b.interval === d ? 'selected' : ''}>${n}</option>`).join('')}</select><div class="hint">A reminder appears on your pages once the last backup is older than this.</div></div></div>
    <details class="explain"><summary>Where your data lives</summary><p class="note">Everything is stored in this browser on this device (local storage, about ${esc(storageEstimateText())} used). There is <b>no account and no automatic syncing</b> between phones or browsers, and clearing site data, uninstalling the web app, switching browser or changing web address can erase or hide it. To move data to another device, create a backup file here and import it there.</p><p class="note" id="persistnote">${persistNote()}</p></details>
    ${hasStoredCopy(KEY_PREMIGRATE) || hasStoredCopy(KEY_BEFOREIMPORT) ? `<div class="restore"><div class="eyebrow">RESTORE POINTS ON THIS DEVICE</div>
      ${hasStoredCopy(KEY_PREMIGRATE) ? `<div class="between"><div><b>Before the upgrade</b><div class="tiny">Untouched copy from when VERTFORM 2.0 first opened (${fmtBytes(storedCopySize(KEY_PREMIGRATE))})</div></div><button type="button" class="btn sm ghost" data-act="premigrate.download">${icon('download')}Download</button></div>` : ''}
      ${hasStoredCopy(KEY_BEFOREIMPORT) ? `<div class="between"><div><b>Before the last import</b><div class="tiny">The records that import replaced</div></div><button type="button" class="btn sm ghost" data-act="import.undo">Restore</button></div>` : ''}</div>` : ''}`, b.due)}
    ${setGroup('Help & about', 'Offline, install, privacy', `<ul class="plain bullets"><li><b>Works offline:</b> logging workouts, sets, the rest timer, the plan and calendar, volleyball logs, measurements, the everyday-food library, saved meals and recipes, previously scanned products, and viewing all your records.</li><li><b>Needs internet:</b> first install, the camera barcode scanner library (first use), looking up a new barcode, searching UK packaged products online, and Open Food Facts product images.</li></ul>
    <details class="explain"><summary>Install on your home screen</summary><ol class="instruction"><li><b>iPhone / Safari:</b> open the HTTPS website, tap Share, then <b>Add to Home Screen</b>.</li><li><b>Android / Chrome:</b> open the website, use the menu, then <b>Install app</b> or <b>Add to Home screen</b>.</li></ol><p class="note">Offline use needs the app to have loaded once over HTTPS. A locally opened HTML file is a preview, not an installed app.</p></details>
    <details class="explain"><summary>Food scanner database &amp; privacy</summary><p class="note">When you scan packaged food, VERTFORM reads the barcode on your device and sends only the barcode number to Open Food Facts for a UK-localised lookup. Camera frames are not uploaded. Successful lookups are cached here so repeat scans are quick. Open Food Facts is community-maintained, so check unusual values against the packet. Data is reused under the ODbL; images follow contributor licensing.</p></details>
      <footer class="about mono"><div>VERTFORM v${APP_VERSION} · ${esc(APP_RELEASE)}</div><div>Records layout ${SCHEMA_VERSION} · storage key ${KEY}</div><div>No accounts, analytics or paid food database.</div></footer>`)}
    ${setGroup('Delete everything', 'Danger zone', `<p class="tiny">Removes all VERTFORM records, copies and settings from this device. Export a backup first.</p><button type="button" class="btn critical" data-act="data.reset">${icon('trash')}Delete all local data</button>`)}`;
}
let persistState = null;
function persistNote() { return persistState === true ? 'Your browser has agreed to keep this site\'s storage unless you clear it yourself.' : persistState === false ? 'Your browser has not promised to keep this storage, so it can be cleared if the device runs low on space. Keep regular backups.' : 'Storage persistence is not reported by this browser.'; }
INPUTS.remind = el => { data.settings.backup.reminderDays = Number(el.value); save(); toast(Number(el.value) ? `Reminder every ${Number(el.value)} days` : 'Backup reminders off'); };
ACTIONS['profile.save'] = () => {
  const inputs = $$('[data-profile]');
  for (const inp of inputs) { if (inp.dataset.profile === 'startDate' && !isISO(inp.value)) { toast('Enter a valid start date'); return; } if (inp.type === 'number' && inp.value !== '' && !inp.checkValidity()) { toast(`Check your ${inp.labels?.[0]?.textContent || inp.dataset.profile} input`); return; } }
  inputs.forEach(inp => { data.user[inp.dataset.profile] = inp.value; }); save(); render(); toast('Profile saved');
};
/* custom exercises (behaviour unchanged) */
ACTIONS['ex.add'] = () => openSheet({ title: 'Add custom exercise', eyebrow: 'SETTINGS', render: () => ({ body: `<div class="field first"><label for="cxs">Workout</label><select id="cxs">${BUILTIN_KEYS.map(x => `<option value="${x}" ${x === 'B' ? 'selected' : ''}>${sName(x)} · ${esc(templates[x].title)}</option>`).join('')}</select></div><div class="field"><label for="cxn">Exercise name</label><input id="cxn" placeholder="e.g. Single-leg calf raise" maxlength="80"></div><div class="form-row"><div class="field"><label for="cxsets">Sets</label><input id="cxsets" type="number" inputmode="numeric" min="1" max="12" value="2"></div><div class="field"><label for="cxreps">Reps / time</label><input id="cxreps" value="10–12" maxlength="30"></div></div><div class="field"><label for="cxl">Record load?</label><select id="cxl"><option value="yes">Yes, kilograms</option><option value="no">No, repetitions only</option></select></div>`, footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="ex.save">Add exercise</button>` }) });
ACTIONS['ex.save'] = () => {
  const k = $('#cxs').value, n = $('#cxn').value.trim(), sets = Number($('#cxsets').value), reps = $('#cxreps').value.trim(), load = $('#cxl').value === 'yes';
  if (!n || !reps || !Number.isInteger(sets) || sets < 1 || sets > 12) { toast('Complete all exercise fields'); return; }
  data.custom[k].push(ex('custom-' + uid(), n, sets, reps, 'reps', load, 'Custom exercise')); save(); closeAllSheets(); render(); toast('Exercise added');
};
ACTIONS['ex.manage'] = el => { const k = el.dataset.arg; openSheet({ title: `${sName(k)} · custom exercises`, eyebrow: 'SETTINGS', render: () => ({ body: (data.custom[k] || []).length ? (data.custom[k] || []).map(x => `<div class="between history-entry"><div><strong>${esc(x.name)}</strong><div class="tiny">${x.sets} × ${esc(x.reps)}</div></div><button type="button" class="btn sm critical" data-act="ex.remove" data-id="${esc(x.id)}" data-arg="${k}">Remove</button></div>`).join('') : emptyBox('No custom exercises.'), footer: `<button type="button" class="btn primary grow" data-act="sheet.close">Done</button>` }) }); };
ACTIONS['ex.remove'] = el => { const k = el.dataset.arg; data.custom[k] = data.custom[k].filter(x => x.id !== el.dataset.id); save(); refreshSheet(); render(); toast('Exercise removed (saved workouts keep it)'); };

/* =============== daily check-in pop-up: "How fatigued are you?" =============== */
let rq = { level: '', sleep: '' };
const READY_OPTS = [['green', 'Fresh', 'Legs and energy feel good'], ['amber', 'Moderate', 'A bit tired or sore'], ['red', 'Fatigued', 'Heavy, sore or drained']];
/* 2.15.3: no longer pops up. Readiness is asked on the Gym today panel and at the start of a workout. */
function maybeAskReadiness() {
  return;
  const d = todayISO();
  if (storageBlocked || ui.page !== 'home' || sheetOpen() || $('#wk-root .wk') || $('#dialog-root .dialog')) return;
  if (data.readiness[d]?.level || data.meta.readyAsked === d) return;
  const cur = data.readiness[d] || {}; rq = { level: '', sleep: cur.sleep ?? '' };
  openSheet({ eyebrow: 'DAILY CHECK-IN', title: 'How fatigued are you?', size: 'md', autofocus: '.ready-opt', onClose: () => { if (data.meta.readyAsked !== todayISO() && !data.readiness[todayISO()]?.level) { data.meta.readyAsked = todayISO(); saveSoon(); } },
    render: () => ({
      body: `<p class="tiny">Pick how your body feels right now. It adjusts the advice on today's workout and is kept with today's record.</p>
        <div class="ready-grid" role="radiogroup" aria-label="How fatigued are you">${READY_OPTS.map(([k, n, h]) => `<button type="button" role="radio" aria-checked="${rq.level === k}" class="ready-opt ${k} ${rq.level === k ? 'on' : ''}" data-act="rq.pick" data-arg="${k}"><b>${n}</b><span>${h}</span></button>`).join('')}</div>
        <div class="field"><label for="rqsleep">Last night's sleep in hours (optional)</label><input id="rqsleep" data-in="rqsleep" type="number" inputmode="decimal" step="0.5" min="0" max="16" placeholder="e.g. 8" value="${esc(rq.sleep)}"></div>`,
      footer: `<button type="button" class="btn ghost" data-act="rq.skip">Not now</button><button type="button" class="btn primary" data-act="rq.confirm" ${rq.level ? '' : 'disabled'}>Confirm</button>`
    }) });
}
ACTIONS['rq.pick'] = el => { rq.level = el.dataset.arg; refreshSheet(); };
INPUTS.rqsleep = el => { rq.sleep = el.value; };
ACTIONS['rq.skip'] = () => { data.meta.readyAsked = todayISO(); save(); closeSheet(); };
ACTIONS['rq.confirm'] = () => {
  if (!rq.level) return; const d = todayISO(); rq.sleep = $('#rqsleep')?.value ?? rq.sleep;
  data.readiness[d] = { ...(data.readiness[d] || {}), level: rq.level, ...(rq.sleep !== '' ? { sleep: rq.sleep } : {}) }; data.meta.readyAsked = d; save();
  closeSheet(); render(); toast(`Checked in: ${READY_OPTS.find(o => o[0] === rq.level)[1]}`);
};
