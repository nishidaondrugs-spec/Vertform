/* Lifts: every weighted exercise you have logged, sortable, with a progress trend (estimated 1RM per session) */
let liftSort = 'best';
const LIFT_SORTS = [['best', 'Heaviest'], ['gain', 'Biggest gain'], ['trained', 'Most trained'], ['recent', 'Recent'], ['az', 'A–Z']];
function liftSeries() {
  const m = new Map();
  [...data.logs].filter(l => l.completed !== false).sort((a, b) => a.date.localeCompare(b.date)).forEach(l => (l.exercises || []).forEach(e => {
    if (!e.load) return; const k = liftKey(e.name); if (!k) return;
    let v = 0; (e.sets || []).forEach(s => { if (!s.done || s.wu) return; const q = e1rm(s.load, s.reps); if (q && q > v) v = q; });
    if (!(v > 0)) return;
    const o = m.get(k) || { k, name: String(e.name).trim(), pts: [], e }; o.pts.push({ d: l.date, v }); o.e = e; o.name = String(e.name).trim(); m.set(k, o);
  }));
  return [...m.values()].map(o => { const vs = o.pts.map(p => p.v); return { ...o, best: Math.max(...vs), now: vs.at(-1), gain: vs.at(-1) - vs[0], last: o.pts.at(-1).d, n: o.pts.length }; });
}
function liftSorted() {
  const a = liftSeries();
  const f = { best: (x, y) => y.best - x.best, gain: (x, y) => y.gain - x.gain, trained: (x, y) => y.n - x.n || y.best - x.best, recent: (x, y) => y.last.localeCompare(x.last), az: (x, y) => x.name.localeCompare(y.name) }[liftSort] || (() => 0);
  return a.sort(f);
}
function liftSpark(pts) {
  if (pts.length < 2) return `<svg class="lspark" viewBox="0 0 64 26" aria-hidden="true"><circle cx="32" cy="13" r="3" fill="#6ea8ff"/></svg>`;
  const vs = pts.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs), sp = hi - lo || 1, n = pts.length;
  const X = i => 3 + 58 * i / (n - 1), Y = v => 23 - 20 * (v - lo) / sp;
  const mx = (n - 1) / 2, my = vs.reduce((a, b) => a + b, 0) / n; let nu = 0, de = 0; vs.forEach((v, i) => { nu += (i - mx) * (v - my); de += (i - mx) ** 2; }); const sl = de ? nu / de : 0;
  const cl = v => Math.max(lo, Math.min(hi, v));
  return `<svg class="lspark" viewBox="0 0 64 26" aria-hidden="true"><path class="ln" d="${vs.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}"/>${n >= 3 ? `<path class="tr" d="M${X(0)},${Y(cl(my - sl * mx)).toFixed(1)}L${X(n - 1)},${Y(cl(my + sl * (n - 1 - mx))).toFixed(1)}"/>` : ''}</svg>`;
}
ACTIONS['you.lifts'] = () => openSheet({ title: 'Lifts', eyebrow: 'ESTIMATED 1 REP MAX', size: 'tall', render: () => {
  const rows = liftSorted();
  return { body: `<div class="liftsort" role="group" aria-label="Sort lifts">${LIFT_SORTS.map(([k, n]) => `<button type="button" class="chip ${liftSort === k ? 'on' : ''}" aria-pressed="${liftSort === k}" data-act="lift.sort" data-arg="${k}">${n}</button>`).join('')}</div>
    ${rows.length ? rows.map(o => `<button type="button" class="liftrow" data-act="lift.open" data-arg="${esc(o.k)}">${'' }<span class="lr-n"><b>${esc(o.name)}</b><small>${plural(o.n, 'session')} · last ${esc(pretty(o.last))}</small></span>${liftSpark(o.pts)}<span class="lr-v"><b>${fmt(o.best, 1)} kg</b>${o.n > 1 ? `<small class="${o.gain > 0 ? 'up' : o.gain < 0 ? 'down' : ''}">${o.gain > 0 ? '+' : ''}${fmt(o.gain, 1)}</small>` : '<small>first log</small>'}</span></button>`).join('') : '<p class="note">Log a weighted set of 1–12 reps and your lifts appear here with a trend line.</p>'}
    <p class="tiny">Best estimated one rep max per session (Epley). The dashed line is your overall trend.</p>`,
    footer: `<button type="button" class="btn primary grow" data-act="sheet.close">Done</button>` };
} });
ACTIONS['lift.sort'] = el => { liftSort = el.dataset.arg; refreshSheet(); };
ACTIONS['lift.open'] = el => { const o = liftSeries().find(x => x.k === el.dataset.arg); if (o) openExerciseHistory(o.e); };

/* ---------- You page: the lift you have improved most, with its graph. Tap the graph for that lift, "See all" for every lift. ---------- */
function liftTop() {
  const a = liftSeries(); if (!a.length) return null;
  const rise = a.filter(o => o.n >= 2 && new Set(o.pts.map(p => p.d)).size >= 2).map(o => ({ o, g: (o.best - o.pts[0].v) / o.pts[0].v })).filter(x => x.g > 0).sort((x, y) => y.g - x.g);
  return rise.length ? { o: rise[0].o, improved: true } : { o: a.sort((x, y) => y.n - x.n || y.best - x.best)[0], improved: false };
}
function liftChart(pts) {
  const W = 340, H = 132, L = 6, R = 6, T = 14, B = 24, n = pts.length, vs = pts.map(p => p.v), lo0 = Math.min(...vs), hi0 = Math.max(...vs), pad = (hi0 - lo0 || hi0 * .1 || 1) * .18, lo = lo0 - pad, hi = hi0 + pad;
  const t0 = Date.parse(pts[0].d), t1 = Date.parse(pts[n - 1].d), span = t1 - t0;
  const X = (p, i) => L + (W - L - R) * (span > 0 ? (Date.parse(p.d) - t0) / span : n === 1 ? .5 : i / (n - 1)), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const xy = pts.map((p, i) => [X(p, i), Y(p.v)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${line}L${xy[n - 1][0].toFixed(1)},${H - B}L${xy[0][0].toFixed(1)},${H - B}Z`;
  const bi = vs.indexOf(hi0), [lx, ly] = xy[n - 1], [bx, by] = xy[bi];
  return `<svg class="lh-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated one rep max over time, from ${fmt(vs[0], 1)} to ${fmt(vs[n - 1], 1)} kilograms"><defs><linearGradient id="lhg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#lhg)"/><path d="${line}" class="lh-line"/>${xy.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" class="lh-dot"/>`).join('')}
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5.5" class="lh-end"/>
    <text x="${Math.min(Math.max(bx, 24), W - 24).toFixed(1)}" y="${Math.max(by - 9, 10).toFixed(1)}" text-anchor="middle" class="lh-t">${fmt(hi0, 1)}</text>
    <text x="${L}" y="${H - 6}" class="lh-d">${esc(pretty(pts[0].d))}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" class="lh-d">${esc(pretty(pts[n - 1].d))}</text></svg>`;
}
function liftHero() {
  const top = liftTop();
  const head = `<div class="yhead"><div class="yeye">LIFTS${top && top.improved ? ' · MOST IMPROVED' : ''}</div>${top ? '<button type="button" class="ylink" data-act="you.lifts">See all</button>' : ''}</div>`;
  if (!top) return `<div class="ysec lhero">${head}<p class="lh-empty">Log a lift with weight and your progress shows up here.</p></div>`;
  const o = top.o, first = o.pts[0].v, d = o.best - first, pc = first ? d / first * 100 : 0;
  return `<div class="ysec lhero">${head}
    <button type="button" class="lh-main" data-act="lift.open" data-arg="${esc(o.k)}" aria-label="${esc(o.name)} history"><span class="lh-name">${esc(o.name)}</span>
      <span class="lh-row"><b class="lh-big">${fmt(o.best, 1)}<small> kg</small></b>${top.improved ? `<span class="lh-gain">+${fmt(d, 1)} kg<i>${pc >= 1 ? ` · +${Math.round(pc)}%` : ''}</i></span>` : `<span class="lh-gain mut">${plural(o.n, 'session')}</span>`}</span>
      <span class="lh-sub">Estimated 1 rep max${top.improved ? ` · since ${esc(pretty(o.pts[0].d))}` : ''}</span>${o.pts.length > 1 ? liftChart(o.pts) : ''}</button></div>`;
}
