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
