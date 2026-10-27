/* Weekly recap + match card: a share image drawn straight on a canvas (reliable on iPhone, no screenshot library).
   Only uses what you log. Jump shows up as a small extra stat in weeks you recorded one. */
const recUi = { mon: null, tab: 'week', theme: 'dark', url: '', busy: false };

/* A week counts toward the streak if you did every planned session, or missed just one (the grace day) when you had 3+ planned. */
const graceOk = (done, target) => done >= target || (target >= 3 && done >= target - 1);

function recapData(mon) {
  const end = addDays(mon, 6), today = todayISO();
  const gym = data.logs.filter(l => l.completed !== false && l.date >= mon && l.date <= end);
  const vb = data.vb.logs.filter(l => l.date >= mon && l.date <= end);
  const matches = vb.filter(l => l.kind === 'match'), trainings = vb.filter(l => l.kind === 'training');
  const ws = weekSummary(mon), planned = Math.max(ws.gymPlanned, gym.length ? 0 : 0) || activeSessions().length;
  const minutes = sum(vb, l => Number(l.durationMin) || 0), load = sum(vb, l => sessionLoad(l) || 0);
  /* protein days */
  let proteinDays = 0, loggedDays = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(mon, i); if (d > today) break; if (!foodsFor(d).length) continue; loggedDays++; if (foodTotals(d).protein >= targetsFor(d).protein * 0.9) proteinDays++; }
  /* PRs: best estimated 1RM per lift this week vs before the week */
  const best = (from, to) => { const m = new Map(); data.logs.filter(l => l.completed !== false && l.date >= from && l.date <= to).forEach(l => (l.exercises || []).forEach(e => { if (!e.load) return; const k = liftKey(e.name); if (!k) return; (e.sets || []).forEach(s => { const w = parseFloat(s.load), r = parseFloat(s.reps); if (!s.done || s.wu || !(w > 0 && w <= 600) || !(r >= 1 && r <= 12)) return; const est = r === 1 ? w : w * (1 + r / 30); const o = m.get(k); if (!o || est > o.est) m.set(k, { name: String(e.name).trim(), est, w, r: Math.round(r) }); }); })); return m; };
  const before = best('0000-01-01', addDays(mon, -1)), now = best(mon, end), prs = [];
  now.forEach((v, k) => { const b = before.get(k); if (b && v.est > b.est + 0.5) prs.push(v); });
  prs.sort((a, b) => b.est - a.est);
  /* streak in weeks, with grace */
  const target = activeSessions().length, gymWeek = m => data.logs.filter(l => l.completed !== false && l.date >= m && l.date < addDays(m, 7)).length;
  let streak = 0; const first = addDays(monday(data.user.startDate || today), -7 * 52);
  for (let i = graceOk(gymWeek(mon), target) ? 0 : 1; i < 520; i++) { const m = addDays(mon, -7 * i); if (m < first) break; if (graceOk(gymWeek(m), target)) streak++; else break; }
  const graceUsed = gym.length === target - 1 && target >= 3 && end < today;
  /* days */
  const plan = weekPlan(mon).days;
  const days = plan.map((d, i) => {
    const g = gym.some(l => l.date === d.date), v = vb.some(l => l.date === d.date);
    const missed = !g && !v && d.date < today && d.items.some(it => it.kind === 'gym' && !it.logged && !it.unplanned);
    return { i, g, v, missed };
  });
  let graceIdx = -1; if (graceUsed) graceIdx = days.findIndex(d => d.missed);
  const cmj = entriesOf('cmj').filter(e => e.date >= mon && e.date <= end).map(e => Number(e.value)).filter(Number.isFinite);
  const jump = cmj.length ? Math.max(...cmj) : null;
  return { mon, end, gymDone: gym.length, planned, matches, trainings, vbN: vb.length, minutes, load, proteinDays, loggedDays, prs, streak, graceUsed, graceIdx, days, jump, gym, vb };
}
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}` : `${m}m`;
const winOf = r => { const t = String(r || '').toLowerCase(); return /\b(w|won|win)\b/.test(t) || /^(\d+)\s*[-–:]\s*(\d+)/.test(t) && (() => { const m = t.match(/^(\d+)\s*[-–:]\s*(\d+)/); return +m[1] > +m[2]; })(); };

/* Picks the one number the week is about. */
function recapHero(r) {
  if (r.matches.length) { const w = r.matches.filter(m => winOf(m.result)).length, rs = r.matches.filter(m => m.result).length; return { tag: 'MATCH WEEK', head: r.matches.length === 1 ? ['One match,', 'all in.'] : [`${r.matches.length} matches,`, 'all in.'], big: String(r.matches.length), unit: r.matches.length === 1 ? 'match' : 'matches', label: rs ? `${w} win${w === 1 ? '' : 's'} from ${rs} with a result` : 'played this week' }; }
  if (r.prs.length) { const p = r.prs[0]; return { tag: 'NEW PR', head: ['A new best', `on ${p.name.length > 18 ? 'the bar' : p.name.toLowerCase()}.`], big: String(Math.round(p.w * 2) / 2), unit: 'kg', label: `${p.name} × ${p.r}` + (r.prs.length > 1 ? ` · +${r.prs.length - 1} more PR${r.prs.length > 2 ? 's' : ''}` : '') }; }
  if (r.planned && r.gymDone >= r.planned) return { tag: 'FULL HOUSE', head: ['Every session', 'ticked off.'], big: `${r.gymDone}/${r.planned}`, unit: '', label: 'gym sessions this week' };
  if (r.minutes >= 240) return { tag: 'ENGINE ROOM', head: ['Hours on', 'court.'], big: fmtMin(r.minutes), unit: '', label: 'volleyball this week' };
  if (r.loggedDays >= 4 && r.proteinDays >= 5) return { tag: 'FUELLED', head: ['Protein', 'on point.'], big: `${r.proteinDays}/${r.loggedDays}`, unit: '', label: 'days at your protein target' };
  if (r.streak > 0) return { tag: 'STILL SHOWING UP', head: ['Consistency', 'is the plan.'], big: String(r.streak), unit: r.streak === 1 ? 'week' : 'weeks', label: 'in a row' };
  return { tag: 'FRESH START', head: ['Every week', 'starts here.'], big: String(r.gymDone + r.vbN), unit: '', label: 'sessions this week' };
}

/* ---------- canvas drawing ---------- */
const RC = { dark: { bg: '#000', fg: '#fff', mute: '#8e8e93', acc: '#e5383b', chip: '#1c1c1e', court: 'rgba(255,255,255,.12)' }, red: { bg: '#e5383b', fg: '#fff', mute: '#ffd2d3', acc: '#000', chip: 'rgba(0,0,0,.25)', court: 'rgba(0,0,0,.14)' } };
const RF = 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', EF = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
function rcText(c, t, x, y, size, o = {}) { c.font = `${o.w || 800} ${size}px ${RF}`; c.fillStyle = o.col; c.textAlign = o.al || 'left'; c.textBaseline = 'alphabetic'; if (o.sp) { try { c.letterSpacing = o.sp + 'px'; } catch (e) { /* older browsers */ } } c.fillText(t, x, y); try { c.letterSpacing = '0px'; } catch (e) { /* */ } }
function rcRound(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function rcFrame(c, T, title, tag) {
  c.fillStyle = T.bg; c.fillRect(0, 0, 1080, 1920);
  c.strokeStyle = T.court; c.lineWidth = 8; c.strokeRect(150, 1100, 780, 640); c.beginPath(); c.moveTo(150, 1420); c.lineTo(930, 1420); c.moveTo(150, 1260); c.lineTo(930, 1260); c.moveTo(150, 1580); c.lineTo(930, 1580); c.stroke();
  rcText(c, 'VERT', 90, 150, 38, { col: T.fg, sp: 6, w: 900 }); const wv = c.measureText('VERT').width + 6 * 4; rcText(c, '/', 90 + wv, 150, 38, { col: T.acc === '#000' ? '#000' : T.acc, w: 900 }); rcText(c, 'FORM', 90 + wv + 26, 150, 38, { col: T.fg, sp: 6, w: 900 });
  rcText(c, title, 990, 150, 30, { col: T.mute, al: 'right', sp: 4, w: 700 });
  rcText(c, tag, 90, 290, 36, { col: T.acc, sp: 7, w: 900 });
}
function rcFooter(c, T, left, sub, right) {
  rcText(c, left, 90, 1790, 46, { col: T.fg, w: 900 }); if (sub) rcText(c, sub, 90, 1836, 30, { col: T.mute, w: 600 });
  if (right) { c.font = `800 30px ${RF}`; const w = c.measureText(right).width + 52; rcRound(c, 990 - w, 1752, w, 72, 36); c.fillStyle = T.chip; c.fill(); rcText(c, right, 990 - w / 2, 1799, 30, { col: T.fg, al: 'center', w: 800 }); }
}
function rcStats(c, T, items, y) {
  const w = 900 / items.length; items.forEach(([v, l], i) => { rcText(c, v, 90 + w * i, y, 64, { col: T.fg, w: 900 }); rcText(c, l, 90 + w * i, y + 46, 24, { col: T.mute, sp: 3, w: 700 }); });
}
function drawWeekCard(c, T, r) {
  const h = recapHero(r), fmt = d => parseDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  rcFrame(c, T, `${fmt(r.mon)} – ${fmt(r.end)}`, h.tag);
  h.head.forEach((t, i) => rcText(c, t, 90, 420 + i * 122, 112, { col: T.fg, w: 900, sp: -3 }));
  const bigSize = h.big.length > 4 ? 250 : 340; rcText(c, h.big, 82, 900 + (bigSize === 250 ? 50 : 0), bigSize, { col: T.fg, w: 900, sp: -12 });
  if (h.unit) { c.font = `900 ${bigSize}px ${RF}`; const bw = c.measureText(h.big).width - h.big.length * 12; rcText(c, h.unit, 100 + bw, 900 + (bigSize === 250 ? 50 : 0), 80, { col: T.mute, w: 800 }); }
  rcText(c, h.label, 90, 990 + (bigSize === 250 ? 50 : 0), 38, { col: T.mute, w: 600 });
  const stats = [[String(r.matches.length), 'MATCHES'], [String(r.trainings.length), 'TRAININGS'], [`${r.gymDone}/${r.planned}`, 'GYM'], [r.minutes ? fmtMin(r.minutes) : '–', 'ON COURT']];
  rcStats(c, T, stats, 1130);
  /* week circles */
  const names = 'MTWTFSS';
  r.days.forEach((d, i) => {
    const cx = 90 + 62 + i * 126, cy = 1350;
    c.beginPath(); c.arc(cx, cy, 48, 0, 7);
    if (d.g && d.v) { c.save(); c.clip(); c.fillStyle = T.fg === '#fff' && T.bg === '#000' ? '#fff' : '#000'; c.fillRect(cx - 48, cy - 48, 96, 96); c.fillStyle = T.bg === '#000' ? T.acc : '#fff'; c.beginPath(); c.moveTo(cx + 48, cy - 48); c.lineTo(cx + 48, cy + 48); c.lineTo(cx - 48, cy + 48); c.closePath(); c.fill(); c.restore(); }
    else if (d.g) { c.fillStyle = T.bg === '#000' ? '#fff' : '#000'; c.fill(); }
    else if (d.v) { c.fillStyle = T.bg === '#000' ? T.acc : '#fff'; c.fill(); }
    else if (i === r.graceIdx) { c.setLineDash([12, 10]); c.lineWidth = 5; c.strokeStyle = T.mute; c.stroke(); c.setLineDash([]); }
    else { c.fillStyle = T.chip; c.fill(); }
    c.font = `44px ${EF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
    if (d.g && d.v) c.fillText('🏋️', cx - 4, cy + 3); else if (d.g) c.fillText('🏋️', cx, cy + 3); else if (d.v) c.fillText('🏐', cx, cy + 3);
    else if (i === r.graceIdx) { c.font = `800 22px ${RF}`; c.fillStyle = T.mute; c.fillText('grace', cx, cy + 1); }
    rcText(c, names[i], cx, cy + 96, 26, { col: T.mute, al: 'center', w: 700 });
  });
  /* daily effort line */
  const eff = r.days.map((d, i) => { const dt = addDays(r.mon, i); return (d.g ? 45 : 0) + sum(r.vb.filter(l => l.date === dt), l => Number(l.durationMin) || 0); }), mx = Math.max(60, ...eff);
  c.beginPath(); eff.forEach((v, i) => { const x = 152 + i * 126, y = 1700 - (v / mx) * 140; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.lineWidth = 8; c.lineJoin = 'round'; c.strokeStyle = T.acc === '#000' ? '#000' : T.acc; c.stroke();
  const xtra = r.jump ? `Best jump ${Math.round(r.jump * 10) / 10} cm` : r.load ? `Load ${r.load.toLocaleString('en-GB')}` : '';
  rcFooter(c, T, r.streak ? `🔥 ${r.streak} week${r.streak === 1 ? '' : 's'}` : 'This week', r.graceUsed ? '1 grace day used' : r.streak ? 'streak' : '', xtra);
}
function lastMatchOf(r) { return [...r.matches].sort((a, b) => b.date.localeCompare(a.date))[0] || null; }
function drawMatchCard(c, T, r) {
  const m = lastMatchOf(r); if (!m) return false;
  const fmt = parseDate(m.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  rcFrame(c, T, fmt, 'MATCH DAY');
  const opp = m.opponent ? `vs ${m.opponent}` : 'Match day'; const parts = opp.length > 16 ? [opp.slice(0, 16), opp.slice(16, 34)] : [opp];
  parts.forEach((t, i) => rcText(c, t, 90, 420 + i * 118, 108, { col: T.fg, w: 900, sp: -3 }));
  const res = (m.result || '').trim(), rs = res.length > 8 ? 120 : 220, ry = 420 + parts.length * 118 + 40 + rs * 0.8;
  rcText(c, res || 'Played', 82, ry, rs, { col: T.fg, w: 900, sp: -6 });
  const lbl = [m.durationMin ? `${m.durationMin} min` : '', m.rpe ? `RPE ${m.rpe}` : '', sessionLoad(m) ? `load ${sessionLoad(m)}` : ''].filter(Boolean).join(' · ');
  rcText(c, lbl, 90, ry + 70, 38, { col: T.mute, w: 600 });
  const dayBefore = addDays(m.date, -1), kc = foodsFor(dayBefore).length ? foodTotals(dayBefore).kcal : null;
  const fuelOk = kc !== null && kc >= targetsFor(dayBefore).cal * 0.9;
  const heavy = data.logs.filter(l => l.completed !== false && l.date < m.date && isHeavy(l.session)).map(l => l.date).sort().pop();
  const since = heavy ? daysBetween(heavy, m.date) : null;
  const last5 = data.vb.logs.filter(l => l.kind === 'match' && l.date <= m.date).sort((a, b) => a.date.localeCompare(b.date)).slice(-5);
  rcStats(c, T, [[m.rpe ? String(m.rpe) : '–', 'RPE'], [fuelOk ? 'Yes' : kc === null ? '–' : 'Low', 'FUELLED'], [since === null ? '–' : `${since} d`, 'SINCE LEGS']], 1060);
  rcStats(c, T, [[m.durationMin ? String(m.durationMin) : '–', 'MINUTES'], [sessionLoad(m) ? String(sessionLoad(m)) : '–', 'LOAD'], [`${r.gymDone}/${r.planned}`, 'GYM WEEK']], 1290);
  if (last5.length > 1) {
    rcText(c, 'LAST MATCHES · RPE', 90, 1440, 26, { col: T.mute, sp: 4, w: 700 });
    last5.forEach((l, i) => { const h2 = Math.max(24, (Number(l.rpe) || 5) * 22), w = 120, x = 90 + i * 150; rcRound(c, x, 1700 - h2, w, h2, 14); c.fillStyle = l.id === m.id ? (T.bg === '#000' ? '#fff' : '#000') : (T.bg === '#000' ? T.acc : '#fff'); c.fill(); });
  }
  const mc = data.vb.logs.filter(l => l.kind === 'match').length;
  rcFooter(c, T, `🏐 ${mc} match${mc === 1 ? '' : 'es'} logged`, '', '');
  return true;
}
function recapRender() {
  const r = recapData(recUi.mon), cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
  const c = cv.getContext('2d'), T = RC[recUi.theme];
  if (recUi.tab === 'match') { if (!drawMatchCard(c, T, r)) { recUi.tab = 'week'; drawWeekCard(c, T, r); } } else drawWeekCard(c, T, r);
  try { recUi.url = cv.toDataURL('image/png'); } catch (e) { recUi.url = ''; } recUi.canvas = cv; recUi.r = r;
}
function recapSheetBody() {
  recapRender(); const r = recUi.r, hasM = r.matches.length > 0, cur = monday(todayISO());
  const rng = `${parseDate(r.mon).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${parseDate(r.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const empty = !r.gymDone && !r.vbN;
  return { body: `<div class="rcbar"><button type="button" class="iconbtn" data-act="rcp.week" data-arg="-1" aria-label="Previous week">‹</button><b>${r.mon === cur ? 'This week' : rng}</b><button type="button" class="iconbtn" data-act="rcp.week" data-arg="1" aria-label="Next week" ${r.mon >= cur ? 'disabled' : ''}>›</button></div>
    <div class="rcseg" role="group" aria-label="Card"><button type="button" class="${recUi.tab === 'week' ? 'on' : ''}" data-act="rcp.tab" data-arg="week">Week</button><button type="button" class="${recUi.tab === 'match' ? 'on' : ''}" data-act="rcp.tab" data-arg="match" ${hasM ? '' : 'disabled'}>Match</button><span class="rcgap"></span><button type="button" class="${recUi.theme === 'dark' ? 'on' : ''}" data-act="rcp.theme" data-arg="dark">Black</button><button type="button" class="${recUi.theme === 'red' ? 'on' : ''}" data-act="rcp.theme" data-arg="red">Red</button></div>
    ${empty ? '<p class="tiny rcnote">Nothing logged this week yet, so this card is mostly empty.</p>' : ''}
    ${recUi.url ? `<img class="rcimg" src="${recUi.url}" alt="Your weekly recap card">` : '<p class="status warn">Could not draw the card on this browser.</p>'}`,
    footer: `<button type="button" class="btn ghost" data-act="rcp.share" ${recUi.url ? '' : 'disabled'}>Share image</button><button type="button" class="btn primary" data-act="rcp.post" ${recUi.url && !recUi.busy ? '' : 'disabled'}>${recUi.busy ? 'Posting…' : 'Post to feed'}</button>` };
}
ACTIONS['recap.open'] = () => {
  const t = todayISO(), dow = (parseDate(t).getDay() + 6) % 7;
  recUi.mon = dow <= 1 ? addDays(monday(t), -7) : monday(t); recUi.tab = 'week';
  try { data.meta.recapSeen = monday(t); save(); } catch (e) { /* */ }
  openSheet({ title: 'Weekly recap', eyebrow: 'SHARE YOUR WEEK', size: 'tall', render: recapSheetBody });
};
ACTIONS['rcp.week'] = el => { const n = addDays(recUi.mon, 7 * Number(el.dataset.arg)); if (n > monday(todayISO())) return; recUi.mon = n; refreshSheet(); };
ACTIONS['rcp.tab'] = el => { recUi.tab = el.dataset.arg; refreshSheet(); };
ACTIONS['rcp.theme'] = el => { recUi.theme = el.dataset.arg; refreshSheet(); };
ACTIONS['rcp.share'] = () => {
  const cv = recUi.canvas; if (!cv) return;
  cv.toBlob(async blob => {
    if (!blob) { toast('Could not make the image'); return; }
    const file = new File([blob], `vertform-${recUi.mon}.png`, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My VERTFORM week' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Image saved');
  }, 'image/png');
};

/* Post the card to the friends feed as a photo post (same path as a normal photo post). */
ACTIONS['rcp.post'] = async () => {
  const c = typeof lbCfg === 'function' && lbCfg(); if (!c) { toast('Join your friends first (You → Friends)'); return; }
  if (!recUi.canvas || recUi.busy) return;
  recUi.busy = true; refreshSheet();
  try {
    const sm = document.createElement('canvas'); sm.width = 540; sm.height = 960; sm.getContext('2d').drawImage(recUi.canvas, 0, 0, 540, 960);
    let photo = ''; for (const q of [0.82, 0.7, 0.58, 0.46]) { photo = sm.toDataURL('image/jpeg', q); if (photo.length <= 330000) break; }
    if (photo.length > 330000) throw new Error('bad_photo');
    const h = recapHero(recUi.r), cap = `${h.tag[0] + h.tag.slice(1).toLowerCase()}: ${h.big}${h.unit ? ' ' + h.unit : ''}`.slice(0, P_MAX);
    const r = await lbCall('vf_post_create', { p_id: c.id, p_secret: c.secret, p_body: cap, p_kind: 'note', p_meta: {}, p_photo: photo, p_video: null, p_day: todayISO() });
    if (r?.id) pPhotos[r.id] = photo;
    recUi.busy = false; closeAllSheets(); pUi.loading = false; pUi.at = 0; go('post'); toast('Posted to your feed'); postLoad();
  } catch (e) { recUi.busy = false; refreshSheet(); toast(typeof pErr === 'function' ? pErr(e.message) : 'Could not post'); }
};
