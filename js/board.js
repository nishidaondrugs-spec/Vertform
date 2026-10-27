'use strict';
/* VERTFORM 2.5 — the week board: every day is a lane, drag a gym session to another lane to move it.
   Weekly session count is the person's own (recommended number shown), and the programme's checks still apply:
   clashes with matches, heavy lower-body days near a match, and doubled days are flagged on every drop (never silently changed). */

const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/></g></svg>';
const PRESETS = { 2: ['A', 'B'], 3: ['A', 'B', 'C'], 4: ['A', 'B', 'C', 'D'] };

/* ---------- how many gym sessions a week ---------- */
const activeSessions = () => { const s = Array.isArray(data.user.gymSessions) ? data.user.gymSessions : []; const out = SESSION_KEYS.filter(k => s.includes(k)); return out.length ? out : SESSION_KEYS.slice(); };
/* The programme was written for 4 gym days beside one volleyball night. Every extra regular volleyball night takes one gym day away. */
function recommendedGymCount() { const vb = vbDaysFor(todayISO()).length; return clamp(4 - Math.max(0, vb - 1), 2, 4); }
function goalCard(mon) {
  const act = activeSessions(), n = act.length, rec = recommendedGymCount(), vb = vbDaysFor(todayISO()).length;
  const preset = Object.keys(PRESETS).find(k => PRESETS[k].join() === act.join());
  const plan = weekPlan(mon), gyms = plan.days.flatMap(d => d.items).filter(i => i.kind === 'gym' && i.weekMon === mon), done = gyms.filter(g => g.status === 'done').length;
  const why = `You have ${vb} volleyball ${vb === 1 ? 'night' : 'nights'} a week, so ${rec} gym ${rec === 1 ? 'session keeps' : 'sessions keep'} you fresh for it.${n > rec ? ' More is fine if you recover well; sessions just sit closer to matches.' : n < rec ? ' You can add another when you feel good.' : ''}`;
  return `<section class="goalcard" aria-label="Gym sessions per week"><div class="between"><div><div class="eyebrow">GYM SESSIONS A WEEK</div><b class="gc-n">${n} ${preset ? '' : '· custom'}</b></div><span class="tag ${n === rec ? 'sage' : 'ochre'}">${n === rec ? 'AS RECOMMENDED' : 'RECOMMENDED ' + rec}</span></div>
    <div class="seg" role="radiogroup" aria-label="Sessions per week">${[2, 3, 4].map(k => `<button type="button" role="radio" aria-checked="${String(k) === preset}" class="${String(k) === preset ? 'on' : ''}" data-act="gw.set" data-arg="${k}">${k}${k === rec ? ' ★' : ''}</button>`).join('')}</div>
    <p class="tiny">${esc(why)}${gyms.length ? ` This week: ${done} of ${gyms.length} done.` : ''}</p>
    <details class="explain"><summary>Choose exactly which sessions</summary><div class="chip-row">${SESSION_KEYS.map(k => `<button type="button" class="chip ${act.includes(k) ? 'on' : ''}" aria-pressed="${act.includes(k)}" data-act="gw.toggle" data-arg="${k}">${esc(sChip(k))}</button>`).join('')}</div><p class="tiny">Missing sessions can still be logged any time from the day sheet.</p></details></section>`;
}
ACTIONS['gw.set'] = el => { data.user.gymSessions = PRESETS[el.dataset.arg].slice(); save(); render(); toast(`${el.dataset.arg} gym sessions a week`); };
ACTIONS['gw.toggle'] = el => {
  const k = el.dataset.arg, cur = activeSessions(), next = cur.includes(k) ? cur.filter(x => x !== k) : SESSION_KEYS.filter(x => cur.includes(x) || x === k);
  if (!next.length) { toast('Keep at least one session'); return; } data.user.gymSessions = next; save(); render();
};

/* ---------- lanes ---------- */
function laneRow(d) {
  const today = todayISO(), week = monday(d.date);
  const tiles = d.items.length ? d.items.map(i => {
    if (i.kind === 'gym') {
      const t = templates[i.session], movable = i.status !== 'done';
      return `<div class="tile gym s-${i.session} st-${i.status}${movable ? ' movable' : ''}" data-session="${i.session}" data-week="${i.weekMon || week}" data-date="${d.date}"><span class="tl-letter">${sBadge(i.session)}</span><button type="button" class="tl-main" data-act="day.open" data-id="${d.date}"><b>${esc(t.title)}</b><small>${esc(t.duration)} ${statusTag(i.status)}${i.pinned ? ' ' + tag('Moved', 'slate') : ''}</small></button>${movable ? `<button type="button" class="grip" data-drag="1" data-session="${i.session}" data-week="${i.weekMon || week}" data-date="${d.date}" data-act="move.open" data-id="${i.session}" data-arg="${i.weekMon || week}" aria-label="Move session ${i.session}. Drag to another day, or press to pick a date.">${GRIP}</button>` : ''}</div>`;
    }
    if (i.kind === 'match') return `<div class="tile fixed match"><span class="tl-letter">${icon('ball')}</span><button type="button" class="tl-main" data-act="day.open" data-id="${d.date}"><b>Match${i.info?.opponent ? ' · vs ' + esc(i.info.opponent) : ''}</b><small>${esc([i.info?.time, i.info?.venue].filter(Boolean).join(' · ') || 'Fixed') } ${statusTag(i.status)}</small></button></div>`;
    if (i.cancelled) return `<div class="tile fixed vb cancelled"><span class="tl-letter">${icon('ball')}</span><button type="button" class="tl-main" data-act="day.open" data-id="${d.date}"><b>${esc(trainInfoFor(d.date).name)}</b><small>${statusTag('cancelled')}</small></button></div>`;
    return `<div class="tile fixed vb"><span class="tl-letter">${icon('ball')}</span><button type="button" class="tl-main" data-act="day.open" data-id="${d.date}"><b>${esc(i.extra?.title || i.info?.name || 'Team training')}</b><small>${esc(INTENSITY[i.info?.intensity]?.label || 'Fixed')} ${statusTag(i.status)}</small></button></div>`;
  }).join('') : `<div class="tile rest"><button type="button" class="tl-main" data-act="day.open" data-id="${d.date}"><b class="dim">Rest day</b></button></div>`;
  const first = d.items.filter(i => i.kind === 'gym').find(g => g.status !== 'done');
  const quick = first && d.date >= today ? `<button type="button" class="btn sm ${d.isToday ? 'primary' : 'ghost'} lane-go" data-act="wk.start" data-id="${first.session}" data-arg="${d.date}" aria-label="Start ${sName(first.session)}">${icon('play')}</button>` : '';
  return `<li class="dayrow lane ${d.isToday ? 'today' : ''} ${d.isPast ? 'past' : ''} ${d.conflicts.length ? 'flag' : ''}" data-date="${d.date}"><button type="button" class="dr-date" data-act="day.open" data-id="${d.date}" aria-label="${esc(longDate(d.date))}: open day"><b>${esc(DOW[d.idx])}</b><span class="mono">${parseDate(d.date).getDate()}</span></button>
    <div class="lane-body">${tiles}${d.conflicts.map(c => `<div class="cf ${c.level}">${icon('warn')}<span>${esc(c.text)}</span></div>`).join('')}</div>${quick}</li>`;
}

/* ---------- would this drop be OK? Same checks as the plan, run on a pretend move ---------- */
function placementCheck(session, week, date) {
  const saved = data.pins;
  try {
    data.pins = saved.filter(p => !(p.session === session && p.week === week)).concat([{ id: 'tmp', session, week, date, createdAt: '' }]);
    const day = weekPlan(week).days.find(x => x.date === date);
    return day ? day.conflicts : [];
  } finally { data.pins = saved; }
}

/* ---------- dragging (pointer events: mouse, pen and touch; only the grip captures touch, so the page still scrolls) ---------- */
let dg = null, suppressClick = false, dgRaf = 0;
function dragTip(html, tone) { let t = $('#dragtip'); if (!t) { t = document.createElement('div'); t.id = 'dragtip'; document.body.appendChild(t); } t.className = 'dragtip ' + (tone || ''); t.innerHTML = html; }
function endDragUi() {
  cancelAnimationFrame(dgRaf); document.body.classList.remove('is-dragging');
  $('#dragghost')?.remove(); $('#dragtip')?.remove(); $$('.dayrow.drop-ok,.dayrow.drop-warn,.dayrow.drop-no,.dayrow.drop-self').forEach(x => x.classList.remove('drop-ok', 'drop-warn', 'drop-no', 'drop-self')); $$('.tile.lifted').forEach(x => x.classList.remove('lifted'));
}
function dragHover() {
  if (!dg?.active) return; const el = document.elementFromPoint(dg.x, dg.y), lane = el?.closest?.('.dayrow[data-date]'), today = todayISO();
  if (lane === dg.lane) return;
  dg.lane?.classList.remove('drop-ok', 'drop-warn', 'drop-no', 'drop-self'); dg.lane = lane; dg.verdict = null;
  if (!lane) { dragTip(`${sName(dg.session)} — drop on a day`, ''); return; }
  const date = lane.dataset.date;
  if (date < today) { lane.classList.add('drop-no'); dragTip('That day has passed', 'no'); return; }
  if (date === dg.from) { lane.classList.add('drop-self'); dragTip('Already here', ''); return; }
  const cf = placementCheck(dg.session, dg.week, date), warn = cf.filter(c => c.level === 'warn'), msg = (warn[0] || cf[0])?.text;
  dg.verdict = { date, cf };
  lane.classList.add(warn.length ? 'drop-warn' : 'drop-ok');
  dragTip(`${esc(longDate(date))}: ${msg ? esc(msg) : 'looks good'}`, warn.length ? 'warn' : 'ok');
}
function dragTick() {
  if (!dg?.active) return;
  const sc = $('.hp-body'), top = sc ? sc.getBoundingClientRect().top : 0, bot = sc ? sc.getBoundingClientRect().bottom : window.innerHeight, by = dg.y < top + 90 ? -14 : dg.y > bot - 90 ? 14 : 0; if (by) (sc || window).scrollBy(0, by);
  const g = $('#dragghost'); if (g) g.style.transform = `translate(${dg.x - 120}px,${dg.y - 28}px)`;
  dragHover(); dgRaf = requestAnimationFrame(dragTick);
}
function startDragUi() {
  if (!dg || dg.active) return; dg.active = true; document.body.classList.add('is-dragging'); dg.src.closest('.tile')?.classList.add('lifted');
  try { navigator.vibrate && navigator.vibrate(12); } catch (_) { /* ignore */ }
  const ghost = document.createElement('div'); ghost.id = 'dragghost'; ghost.className = 'dragghost'; ghost.innerHTML = `<span class="tl-letter">${esc(sBadge(dg.session))}</span><b>${esc(templates[dg.session].title)}</b>`; document.body.appendChild(ghost);
  dragTip(`${esc(sName(dg.session))} — drop on a day`, ''); dgRaf = requestAnimationFrame(dragTick);
}
/* Grab by the handle (instant) or, as a shortcut, by the tile itself: mouse drags straight away, a finger needs a short press so scrolling still works. */
document.addEventListener('pointerdown', e => {
  if (dg || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const grip = e.target.closest?.('.grip[data-drag]'), tile = grip ? grip.closest('.tile') : e.target.closest?.('.tile.gym.movable'); if (!tile) return;
  const src = grip || tile;
  dg = { src, grip: !!grip, touch: e.pointerType !== 'mouse', session: tile.dataset.session, week: tile.dataset.week, from: tile.dataset.date, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, lane: null, verdict: null, timer: 0 };
  try { src.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  if (!grip && dg.touch) dg.timer = setTimeout(() => { if (dg && !dg.active) { startDragUi(); dragHover(); } }, 260);
});
document.addEventListener('pointermove', e => {
  if (!dg || e.pointerId !== dg.id) return; dg.x = e.clientX; dg.y = e.clientY;
  if (!dg.active) {
    const moved = Math.hypot(dg.x - dg.x0, dg.y - dg.y0);
    if (!dg.grip && dg.touch) { if (moved > 10) { clearTimeout(dg.timer); dg = null; } return; } // finger moved before the press registered: it is a scroll
    if (moved < 8) return; startDragUi();
  }
  e.preventDefault();
}, { passive: false });
document.addEventListener('touchmove', e => { if (dg?.active) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (dg && e.target.closest?.('.tile.gym')) e.preventDefault(); });
function endDrag(e, cancelled) {
  if (!dg || (e && e.pointerId !== dg.id)) return; const d = dg; dg = null; clearTimeout(d.timer);
  if (!d.active) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 80);
  const v = d.verdict; endDragUi();
  if (!cancelled && v) applyMove(d.session, d.week, v.date, v.cf);
}
document.addEventListener('pointerup', e => endDrag(e, false));
document.addEventListener('pointercancel', e => endDrag(e, true));
document.addEventListener('click', e => { if (suppressClick && e.target.closest?.('.grip,.tile.gym')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && dg?.active) { const d = dg; dg = null; clearTimeout(d.timer); endDragUi(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 80); } });

function applyMove(session, week, date, cf) {
  const prev = data.pins.find(p => p.session === session && p.week === week);
  data.pins = data.pins.filter(p => !(p.session === session && p.week === week));
  data.pins.push({ id: uid(), session, week, date, createdAt: new Date().toISOString() }); save(); render();
  const warn = (cf || []).find(c => c.level === 'warn');
  toast(`${sName(session)} → ${pretty(date)}${warn ? ' · ' + warn.text : ''}`, { ms: 6500, action: { label: 'Undo', fn: () => { data.pins = data.pins.filter(p => !(p.session === session && p.week === week)); if (prev) data.pins.push(prev); save(); render(); } } });
}

/* ---------- the calendar: one board for the Plan tab and the home Calendar panel ---------- */
function weekNav(mon) {
  const nowMon = monday(todayISO());
  return `<div class="weeknav"><button type="button" class="iconbtn" data-act="plan.shift" data-arg="-7" aria-label="Previous week">${icon('back')}</button><div class="wn-mid"><div class="eyebrow">${mon === nowMon ? 'THIS WEEK' : 'WEEK OF'}</div><b>${esc(pretty(mon))} – ${esc(pretty(addDays(mon, 6)))}</b></div><button type="button" class="iconbtn" data-act="plan.shift" data-arg="7" aria-label="Next week">${icon('chev')}</button>${mon !== nowMon ? `<button type="button" class="btn sm ghost" data-act="plan.now">Today</button>` : ''}</div>`;
}
function calendarBody(mon, mode) {
  const only = mode === 'settings';
  const plan = weekPlan(mon), n = activeSessions().length, sched = vbDaysFor(todayISO());
  const fixtures = data.matches.filter(d => d >= todayISO()).sort(), extras = data.vb.extras.filter(x => x.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date));
  const names = sched.map(i => data.vb.trainInfo?.[String(i)]?.name || DOW[i]).slice(0, 3).join(', ');
  return `${only ? '' : weekNav(mon)}
    ${!only && plan.conflicts.length ? `<div class="flags" role="status">${plan.conflicts.slice(0, 2).map(c => `<div class="flag ${c.level}">${icon('warn')}<span>${esc(c.text)}</span></div>`).join('')}${plan.conflicts.length > 2 ? `<p class="tiny">+${plan.conflicts.length - 2} more. Tap a day to review.</p>` : ''}</div>` : ''}
    ${only ? '' : `<ul class="dayrows lanes">${plan.days.map(laneRow).join('')}</ul>
    <p class="tiny drag-hint">Press and hold a gym session to move it.</p>`}
    ${only ? '' : plan.notPlaced.filter(() => !(data.user.setupDate && data.user.setupDate > mon)).map(x => `<p class="tiny">${esc(sName(x.session))} is left out this week: ${esc(x.reason)}.</p>`).join('')}
    ${only ? '' : `<div class="quick calq"><button type="button" class="btn primary" data-act="vb.log" data-arg="training">${icon('plus')}Log training</button><button type="button" class="btn ghost" data-act="match.add">${icon('plus')}Match</button><button type="button" class="btn ghost" data-act="extra.add">${icon('plus')}Extra</button></div>`}
    <details class="explain mt"><summary><span>Gym sessions a week</span><b class="mono">${n}</b></summary>${goalCard(mon)}</details>
    <details class="explain"><summary><span>Fixed trainings</span><b class="sm">${sched.length ? esc(names) : 'None'}</b></summary><p class="tiny">${sched.length ? sched.map(i => esc(DOW_LONG[i])).join(', ') : 'No fixed weekly training set.'}</p><button type="button" class="btn sm ghost" data-act="days.open">${icon('edit')}Edit fixed trainings</button></details>
    <details class="explain"><summary><span>Matches &amp; extras</span><b class="mono">${fixtures.length + extras.length}</b></summary>
    ${fixtures.length || extras.length ? `<ul class="loglist">${fixtures.map(d => `<li class="log-row"><span class="code ball">${icon('ball')}</span><div class="grow min0"><div class="eyebrow">MATCH</div><strong>${esc(weekdayShort(d))} ${esc(pretty(d))}${data.matchInfo[d]?.opponent ? ' · vs ' + esc(data.matchInfo[d].opponent) : ''}</strong><small>${[data.matchInfo[d]?.time, data.matchInfo[d]?.venue].filter(Boolean).map(esc).join(' · ') || 'Tap edit to add details'}</small></div><button type="button" class="iconbtn" data-act="match.add" data-id="${d}" aria-label="Edit match on ${esc(pretty(d))}">${icon('edit')}</button></li>`).join('')}${extras.map(x => `<li class="log-row"><span class="code ball">${icon('ball')}</span><div class="grow min0"><div class="eyebrow">EXTRA SESSION</div><strong>${esc(weekdayShort(x.date))} ${esc(pretty(x.date))}${x.title ? ' · ' + esc(x.title) : ''}</strong><small>${esc(x.time || 'Time not set')}</small></div><button type="button" class="iconbtn" data-act="extra.edit" data-id="${esc(x.id)}" aria-label="Edit session on ${esc(pretty(x.date))}">${icon('edit')}</button></li>`).join('')}</ul>` : `<p class="note">No upcoming matches or extra sessions. Add a match and the gym week re-plans around it.</p>`}</details>${!data.user.hideBuiltin ? `
<details class="explain mt"><summary>12-week strength progression</summary><p class="note">Main lift load targets are based on your estimated 1RM and capped at RPE 8. Volume reductions in weeks 4, 8 and 12 help manage fatigue. The programme itself has not changed.</p><ul class="prog">${progression.map((q, i) => `<li class="${i + 1 === getWeek() ? 'cur' : ''}"><span class="mono">${pad2(i + 1)}</span><div class="grow"><b>${q.sets} · ${q.pct}</b><small>Upper: ${q.upper} · Jump: ${q.power}</small></div>${[4, 8, 12].includes(i + 1) ? tag('Easy', 'ochre') : ''}</li>`).join('')}</ul></details>` : ''}`;
}
