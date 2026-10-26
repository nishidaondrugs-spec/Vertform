'use strict';
/* VERTFORM 2.0 — measurements, with standing reach / approach touch / calculated approach jump / standing CMJ kept distinct */

const LIMITS = { reach: [120, 260], approach: [150, 450], cmj: [5, 120], pullup: [0, 200], arm: [10, 80], weight: [30, 250], rsi: [0.2, 6] };
const HOWTO = {
  reach: 'Stand flat-footed, side-on to a wall, shoulders relaxed. Reach one arm straight overhead as high as you comfortably can without rising onto your toes, then mark or measure your fingertips. Use the same shoes (or bare feet) every time and take the best of two or three. Re-measure every few weeks, not every session.',
  approach: 'After your usual warm-up, take a full spike approach and touch the highest point you can (a vane or a marked wall). Record the highest of about three attempts. Keep shoes, surface, ball-height cue, warm-up and time of day the same for every test. This is a touch height, measured from the floor.',
  cmj: 'Standing jump with a quick dip, from flat feet, using the same arm rule every test (for example hands on hips). Measure how far your body rises (jump mat or flight-time app), not a touch height. Keep the device and method the same each time.',
  pullup: 'Added load in kilograms for the same standardised rep count. Use 0 for bodyweight.',
  arm: 'Relaxed arm, measured at the same point (for example halfway between shoulder and elbow), same time of day.',
  weight: 'Ideally first thing in the morning after using the toilet, before eating.',
  rsi: 'Step off a 30 cm box, land and jump straight back up as high and fast as you can. RSI = jump height in metres divided by ground contact time in seconds (a phone app or contact mat gives both). Use the same drop height each test.'
};
const metricUnit = k => metricDef(k)?.unit || '';
const entriesOf = k => data.metrics.filter(x => x.key === k).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
/* Series for charts/lists. The calculated jump comes only from approach results that stored the reach they used. */
function metricSeries(k) {
  if (k === 'approachJump') return entriesOf('approach').filter(x => x.reachUsed && Number.isFinite(x.jump)).map(x => ({ ...x, value: x.jump }));
  return entriesOf(k);
}
const latestMetric = k => metricSeries(k).at(-1);
const latestReachOn = date => entriesOf('reach').filter(x => x.date <= date).at(-1) || entriesOf('reach').at(-1) || null;
const legacyApproachCount = () => entriesOf('approach').filter(x => !x.reachUsed).length;

/* ---------- add / edit sheet ---------- */
let ms = null;
function openMeasurement(key, editId) {
  const e = editId ? data.metrics.find(x => x.id === editId) : null;
  const k = e ? e.key : (key && key !== 'approachJump' ? key : 'approach');
  ms = { id: e?.id || null, key: k, date: e?.date || todayISO(), value: e?.value ?? '', reach: e?.reachUsed ?? '', reachTouched: !!e };
  if (!e && k === 'approach') { const r = latestReachOn(ms.date); if (r) ms.reach = r.value; }
  if (sheetOpen()) closeAllSheets();
  openSheet({ title: e ? 'Edit measurement' : 'Add measurement', eyebrow: 'JUMP & BODY', size: 'tall', render: renderMeasurement, onMount: refreshMeasurement });
}
function renderMeasurement() {
  const def = metricDef(ms.key); const keys = METRICS.filter(m => !m.derived);
  return { body: `<div class="field first"><label for="msk">Measurement</label><select id="msk" data-in="mskey" ${ms.id ? 'disabled' : ''}>${keys.map(m => `<option value="${m.key}" ${m.key === ms.key ? 'selected' : ''}>${esc(m.label)} (${m.unit})</option>`).join('')}</select></div>
    <div class="form-row"><div class="field"><label for="msd">Date measured</label><input id="msd" data-in="ms" type="date" value="${esc(ms.date)}"></div>
    <div class="field"><label for="msv">${esc(def.label)} (${def.unit})</label><input id="msv" data-in="ms" type="number" inputmode="decimal" min="0" step="0.1" placeholder="Measured value" value="${esc(ms.value)}"></div></div>
    ${ms.key === 'approach' ? `<div class="field"><label for="msr">Standing reach used (cm)</label><input id="msr" data-in="ms" type="number" inputmode="decimal" min="0" step="0.1" placeholder="Needed to calculate jump height" value="${esc(ms.reach)}"><div class="hint" id="msrhint"></div></div>` : ''}
    <div class="status" id="msprev" aria-live="polite"></div>
    <details class="mt"><summary>How to measure ${esc(def.label.toLowerCase())} consistently</summary><p class="note">${esc(HOWTO[ms.key])}</p></details>
    <div class="tip">${ms.key === 'reach' || ms.key === 'approach' || ms.key === 'cmj' ? '<b>Keep these separate.</b> Standing reach and approach touch are heights from the floor. Approach jump height = approach touch − standing reach. Standing CMJ is a different test and is never combined with them.' : esc(def.note)}</div>`,
    footer: `${ms.id ? `<button type="button" class="btn critical" data-act="ms.delete" aria-label="Delete this measurement">${icon('trash')}</button>` : ''}<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="ms.save">Save</button>` };
}
function validateMeasurement() {
  const v = Number(ms.value), [lo, hi] = LIMITS[ms.key]; const out = { ok: true, errors: [], cautions: [], jump: null, reach: null };
  if (!isISO(ms.date)) { out.ok = false; out.errors.push('Choose a valid date.'); } else if (ms.date > todayISO()) { out.ok = false; out.errors.push('That date is in the future.'); }
  if (ms.value === '' || !Number.isFinite(v)) { out.ok = false; out.errors.push('Enter a value.'); return out; }
  if (v < lo || v > hi || (v === 0 && ms.key !== 'pullup')) { out.ok = false; out.errors.push(`${metricDef(ms.key).label} is expected between ${lo} and ${hi} ${metricUnit(ms.key)}. Check the number and unit.`); return out; }
  if (ms.key === 'approach' && ms.reach !== '') {
    const r = Number(ms.reach); out.reach = r;
    if (!Number.isFinite(r) || r < LIMITS.reach[0] || r > LIMITS.reach[1]) { out.ok = false; out.errors.push(`Standing reach is expected between ${LIMITS.reach[0]} and ${LIMITS.reach[1]} cm.`); return out; }
    if (v <= r) { out.ok = false; out.errors.push('Approach touch must be higher than your standing reach. You cannot touch lower than you can stand and reach, so one of the two numbers is wrong.'); return out; }
    out.jump = +(v - r).toFixed(1);
    if (out.jump > 150) { out.ok = false; out.errors.push(`A ${fmt(out.jump, 1)} cm approach jump is not realistic. Check both numbers.`); }
    else if (out.jump > 110) out.cautions.push(`${fmt(out.jump, 1)} cm would be an exceptional approach jump. Double-check both numbers.`);
    else if (out.jump < 15) out.cautions.push(`${fmt(out.jump, 1)} cm is a very small approach jump. Double-check both numbers.`);
  }
  if (ms.key === 'cmj' && v > 90) out.cautions.push('A standing CMJ over 90 cm is exceptional. Double-check the number and unit.');
  return out;
}
function refreshMeasurement() {
  const box = $('#msprev'), hint = $('#msrhint'); if (!box) return; const val = validateMeasurement();
  if (ms.key === 'approach' && hint) {
    const r = latestReachOn(ms.date); const entered = ms.reach !== '' ? Number(ms.reach) : null;
    hint.innerHTML = r ? (entered !== null && entered !== r.value ? `Your latest saved reach is ${fmt(r.value, 1)} cm (${esc(pretty(r.date))}). This value will also be saved as a new standing-reach measurement dated ${esc(pretty(ms.date))}.` : `Pre-filled from your standing reach measured ${esc(pretty(r.date))}. It is stored with this result, so changing your reach later never rewrites it.`) : 'No standing reach saved yet. Enter it to calculate approach jump height, or leave it blank to save the touch height alone.';
  }
  let html = '';
  if (val.errors.length) html += val.errors.map(e => `<div class="msg err">${icon('warn')}<span>${esc(e)}</span></div>`).join('');
  if (val.cautions.length) html += val.cautions.map(e => `<div class="msg caution">${icon('info')}<span>${esc(e)}</span></div>`).join('');
  if (!val.errors.length && ms.key === 'approach') html += val.jump !== null ? `<div class="calc"><span class="dim">Approach jump height</span><b class="mono">${fmt(val.jump, 1)} cm</b><span class="dim">${fmt(Number(ms.value), 1)} touch − ${fmt(val.reach, 1)} reach</span></div>` : `<div class="msg">${icon('info')}<span>Saved as a touch height only. No jump height is calculated without a standing reach.</span></div>`;
  box.innerHTML = html; box.classList.toggle('hidden', !html);
}
INPUTS.mskey = el => { syncMs(); ms.key = el.value; ms.reach = ''; if (ms.key === 'approach') { const r = latestReachOn(ms.date); if (r) ms.reach = r.value; } refreshSheet(); };
function syncMs() { const m = { msd: 'date', msv: 'value', msr: 'reach' }; for (const [id, k] of Object.entries(m)) { const el = $('#' + id); if (el) ms[k] = el.value; } }
INPUTS.ms = el => { if (el.id === 'msr') ms.reachTouched = true; syncMs(); refreshMeasurement(); };
ACTIONS['ms.add'] = el => openMeasurement(el?.dataset?.arg);
ACTIONS['ms.edit'] = el => openMeasurement(null, el.dataset.id);
ACTIONS['ms.save'] = () => {
  syncMs(); const val = validateMeasurement(); if (!val.ok) { refreshMeasurement(); toast(val.errors[0] || 'Check the measurement'); return; }
  const rec = { date: ms.date, key: ms.key, value: Number(ms.value) };
  if (ms.key === 'approach' && val.jump !== null) {
    rec.reachUsed = val.reach; rec.jump = val.jump; const latest = latestReachOn(ms.date);
    if (latest && latest.value === val.reach) rec.reachDate = latest.date;
    else { // a new reach value entered: record it as a standing-reach measurement too, so the number has a home
      const existing = data.metrics.find(x => x.key === 'reach' && x.date === ms.date && x.value === val.reach);
      if (!existing) data.metrics.push({ id: uid(), date: ms.date, key: 'reach', value: val.reach });
      rec.reachDate = ms.date;
    }
  }
  if (ms.id) { const e = data.metrics.find(x => x.id === ms.id); const keepReach = e.key === 'approach' && !(rec.reachUsed); Object.assign(e, rec); if (e.key === 'approach' && keepReach) { delete e.reachUsed; delete e.jump; delete e.reachDate; } }
  else data.metrics.push({ id: uid(), ...rec });
  ui.metric = ms.key === 'approach' && rec.jump !== undefined ? 'approachJump' : ms.key;
  save(); closeAllSheets(); render(); toast(rec.jump !== undefined ? `Saved · approach jump ${fmt(rec.jump, 1)} cm` : 'Measurement saved');
};
ACTIONS['ms.delete'] = async () => {
  if (!await askConfirm({ title: 'Delete this measurement?', message: '<p>Other measurements are not changed.</p>', confirmLabel: 'Delete', danger: true })) return;
  data.metrics = data.metrics.filter(x => x.id !== ms.id); save(); closeAllSheets(); render(); toast('Measurement deleted');
};
ACTIONS['ms.del'] = async el => {
  const m = data.metrics.find(x => x.id === el.dataset.id); if (!m) return;
  data.metrics = data.metrics.filter(x => x.id !== m.id); save(); render();
  toast('Measurement deleted', { action: { label: 'Undo', fn: () => { data.metrics.push(m); save(); render(); } } });
};

/* ---------- drawings ---------- */
function chartSVG(arr, unit, label) {
  if (!arr.length) return emptyBox('No measurements yet. Tap “Add” to create your first data point.');
  const W = 660, H = 230, pad = { top: 24, bottom: 38, left: 52, right: 16 };
  const ys = arr.map(x => Number(x.value)), ymin = Math.min(...ys), ymax = Math.max(...ys), spread = Math.max(1, ymax - ymin), low = ymin - spread * .28, high = ymax + spread * .28;
  const pts = arr.map((v, i) => ({ x: pad.left + (arr.length === 1 ? .5 : i / (arr.length - 1)) * (W - pad.left - pad.right), y: pad.top + (high - Number(v.value)) / (high - low) * (H - pad.top - pad.bottom), v }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const grid = [0, 1, 2, 3].map(i => { const val = low + (high - low) * (1 - i / 3), y = pad.top + (H - pad.top - pad.bottom) * i / 3; return `<line class="cg" x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}"/><text class="ct" x="${pad.left - 8}" y="${y + 4}" text-anchor="end">${fmt(val, 1)}</text>`; }).join('');
  const summary = `${arr.length} readings from ${pretty(arr[0].date)} to ${pretty(arr.at(-1).date)}; latest ${arr.at(-1).value} ${unit}`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)}: ${esc(summary)}">${grid}${arr.length > 1 ? `<path class="cl" d="${line}"/>` : ''}${pts.map(p => `<circle class="cd" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5"/>`).join('')}<text class="ct" x="${pad.left}" y="${H - 9}">${esc(pretty(arr[0].date))}</text><text class="ct" x="${W - pad.right}" y="${H - 9}" text-anchor="end">${esc(pretty(arr.at(-1).date))}</text></svg>`;
}
/* The "jump ladder": reach, touch and the calculated jump drawn between them. Not to scale. */
function ladderSVG(touch, reach, jump) {
  return `<svg viewBox="0 0 320 190" class="ladder" role="img" aria-label="Standing reach ${fmt(reach, 1)} centimetres, approach touch ${fmt(touch, 1)} centimetres, calculated approach jump ${fmt(jump, 1)} centimetres. Diagram not to scale.">
    <line class="lg" x1="20" y1="168" x2="300" y2="168"/><text class="lt dim" x="20" y="184">FLOOR</text>
    <line class="lr" x1="20" y1="112" x2="300" y2="112"/><text class="lt" x="22" y="130">STANDING REACH</text><text class="lv" x="300" y="130" text-anchor="end">${fmt(reach, 1)} cm</text>
    <line class="lc" x1="20" y1="36" x2="300" y2="36"/><text class="lt clay" x="22" y="26">APPROACH TOUCH</text><text class="lv clay" x="300" y="26" text-anchor="end">${fmt(touch, 1)} cm</text>
    <path class="lb" d="M150 38v72M144 44l6-6 6 6M144 104l6 6 6-6"/><rect class="lbox" x="164" y="60" width="106" height="28" rx="3"/><text class="lj" x="217" y="80" text-anchor="middle">+${fmt(jump, 1)} cm jump</text>
    <path class="lg" d="M60 112v56M60 112l-4 6M60 112l4 6" opacity=".5"/></svg>`;
}

/* =============== 2.16 bodyweight trend card (Food diary) =============== */
/* Averages beat single weigh-ins: day-to-day water swings are 1–2 kg. */
function weightTrend() {
  const all = entriesOf('weight').filter(e => Number(e.value) > 0); if (!all.length) return null;
  const today = todayISO(), avgAround = (end, days) => { const xs = all.filter(e => e.date <= end && e.date > addDays(end, -days)).map(e => Number(e.value)); return xs.length ? mean(xs) : null; };
  const last = all.at(-1), cur = avgAround(today, 7) ?? avgAround(last.date, 7);
  const before = avgAround(addDays(today, -28), 14);
  const weeks = []; for (let i = 7; i >= 0; i--) { const end = addDays(today, -7 * i), v = avgAround(end, 7); if (v !== null) weeks.push({ d: end, v }); }
  return { cur, n7: all.filter(e => e.date > addDays(today, -7)).length, last, diff: before !== null && cur !== null ? cur - before : null, weeks, ago: daysBetween(last.date, today) };
}
function weightAdvice(diff) {
  if (diff === null) return '';
  const goal = nset().goal || 'maintain';
  if (goal === 'maintain' && Math.abs(diff) > 1) return `Drifting ${diff > 0 ? 'up' : 'down'} while your goal is to maintain. If it continues, ${diff > 0 ? 'trim' : 'add'} about 150 kcal a day.`;
  if (goal === 'cut' && diff > -0.3) return 'Not moving down yet. If it holds for another two weeks, trim about 150 kcal a day.';
  if (goal === 'cut' && diff < -2.5) return 'Dropping quickly. Losing more than about half a kilo a week can cost jump power, so eat a little more.';
  if (goal === 'gain' && diff < 0.3) return 'Not moving up yet. If it holds for another two weeks, add about 150 kcal a day.';
  return '';
}
function weightCard() {
  const t = weightTrend();
  if (!t) return `<section class="wcard"><div class="wc-top"><div><span class="tiny">Bodyweight</span><b>Not logged yet</b></div><button type="button" class="btn sm primary" data-act="ms.add" data-arg="weight">Log weight</button></div><p class="tiny">Weigh in 2–3 mornings a week. Your calories follow the average.</p></section>`;
  const W = 120, H = 34, vs = t.weeks.map(w => w.v), lo = Math.min(...vs), hi = Math.max(...vs), r = Math.max(hi - lo, .6);
  const spark = t.weeks.length > 1 ? `<svg class="wc-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${t.weeks.map((w, i) => `${i ? 'L' : 'M'}${(i / (t.weeks.length - 1) * (W - 6) + 3).toFixed(1)},${(H - 4 - (w.v - lo) / r * (H - 8)).toFixed(1)}`).join('')}"/></svg>` : '';
  const adv = weightAdvice(t.diff);
  const sub = t.diff !== null ? `<span class="wc-diff">${t.diff > 0 ? '+' : t.diff < 0 ? '−' : '±'}${fmt(Math.abs(t.diff), 1)} kg in 4 weeks</span>` : `<span class="wc-diff">Trend shows after a few weeks</span>`;
  return `<section class="wcard" aria-label="Bodyweight"><div class="wc-top"><div><span class="tiny">Bodyweight${t.n7 > 1 ? ` · average of ${t.n7}` : ''}</span><b>${fmt(t.cur ?? Number(t.last.value), 1)} kg</b>${sub}</div>${spark}</div>
    ${adv ? `<p class="wc-adv">${esc(adv)}</p>` : ''}
    <div class="wc-foot"><span class="tiny">${t.ago === 0 ? 'Weighed today' : `Last weighed ${t.ago === 1 ? 'yesterday' : `${t.ago} days ago`}`}</span><button type="button" class="btn sm ${t.ago > 7 ? 'primary' : 'ghost'}" data-act="ms.add" data-arg="weight">Log weight</button></div></section>`;
}
