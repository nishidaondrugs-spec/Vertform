'use strict';
/* VERTFORM 2.0 — volleyball logs, matches, extra sessions, recurring training days and moving gym sessions */

/* =============== volleyball log =============== */
let vl = null;
function openVbLog(opts = {}) {
  const ex0 = opts.id ? data.vb.logs.find(l => l.id === opts.id) : null;
  vl = ex0 ? { ...ex0, durationMin: ex0.durationMin ?? '', rpe: ex0.rpe ?? '', jumps: ex0.jumps ?? '', jumpsEstimate: ex0.jumpsEstimate !== false, opponent: ex0.opponent || '', result: ex0.result || '', notes: ex0.notes || '' }
    : { id: null, kind: opts.kind || 'training', date: opts.date || todayISO(), durationMin: opts.kind === 'match' ? 90 : '', rpe: '', jumps: '', jumpsEstimate: true, opponent: data.matchInfo[opts.date]?.opponent || '', result: '', notes: '' };
  if (!ex0 && vl.kind === 'training') planDefaults();
  if (sheetOpen()) closeAllSheets();
  openSheet({ title: ex0 ? 'Edit volleyball session' : 'Log volleyball', eyebrow: vl.date === todayISO() ? 'Today' : `${weekdayShort(vl.date)} ${pretty(vl.date)}`, size: 'tall', render: renderVbLog, onMount: refreshVbLoad });
}
/* A planned team training pre-fills its usual length and intensity; anything else starts blank. */
function planDefaults() {
  if (vl.id || vl.kind !== 'training' || !isISO(vl.date) || !vbDaysFor(vl.date).includes(dayIndex(vl.date))) return;
  const t = trainInfoFor(vl.date); if (vl.durationMin === '') vl.durationMin = t.min; if (vl.rpe === '') vl.rpe = INTENSITY[t.intensity].rpe;
}
function renderVbLog() {
  const isM = vl.kind === 'match', moreOpen = vl.moreOpen || !!(vl.id && (vl.jumps !== '' || vl.notes)) || vl.date !== todayISO();
  return { body: `<div class="seg" role="radiogroup" aria-label="Session type"><button type="button" role="radio" aria-checked="${!isM}" class="${!isM ? 'on' : ''}" data-act="vl.kind" data-arg="training">Club training</button><button type="button" role="radio" aria-checked="${isM}" class="${isM ? 'on' : ''}" data-act="vl.kind" data-arg="match">Match</button></div>
    <div class="field"><label id="vldurl">How long?</label><div class="chip-row vldur" role="group" aria-labelledby="vldurl">${[60, 90, 120].map(n => `<button type="button" class="chip ${Number(vl.durationMin) === n ? 'on' : ''}" data-act="vl.dur" data-arg="${n}">${n} min</button>`).join('')}<input id="vldur" class="durin" data-in="vl" type="number" inputmode="numeric" min="1" max="600" step="5" placeholder="Other" aria-label="Duration in minutes" value="${[60, 90, 120].includes(Number(vl.durationMin)) ? '' : esc(vl.durationMin)}"></div></div>
    <div class="field"><label id="vlint">How hard was it?</label><div class="intens" role="radiogroup" aria-labelledby="vlint">${Object.entries(INTENSITY).map(([k, v]) => `<button type="button" role="radio" aria-checked="${intensityOfRpe(vl.rpe) === k}" class="${intensityOfRpe(vl.rpe) === k ? 'on' : ''}" data-act="vl.int" data-arg="${k}"><b>${v.label}</b></button>`).join('')}</div></div>
    ${isM ? `<div class="form-row"><div class="field"><label for="vlopp">Opponent</label><input id="vlopp" data-in="vl" maxlength="60" value="${esc(vl.opponent)}"></div><div class="field"><label for="vlres">Result</label><input id="vlres" data-in="vl" maxlength="40" placeholder="e.g. Won 3–1" value="${esc(vl.result)}"></div></div>` : ''}
    <div class="load-box" id="vlload" aria-live="polite"></div>
    <details class="more" ${moreOpen ? 'open' : ''} data-more="vl"><summary>More details</summary>
      <div class="field"><label for="vld">Date</label><input id="vld" data-in="vl" type="date" value="${esc(vl.date)}"></div>
      <div class="field"><label>Exact effort (RPE 1–10)</label><div class="rpe-grid" role="radiogroup" aria-label="RPE">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button type="button" role="radio" aria-checked="${Number(vl.rpe) === n}" class="rpe ${Number(vl.rpe) === n ? 'on' : ''}" data-act="vl.rpe" data-arg="${n}">${n}</button>`).join('')}</div></div>
      <div class="field"><label for="vljumps">Jumps</label><div class="inline"><input id="vljumps" data-in="vl" type="number" inputmode="numeric" min="0" max="2000" step="1" placeholder="e.g. 120" value="${esc(vl.jumps)}">
        <select id="vljt" data-in="vl" aria-label="Jump count type"><option value="est" ${vl.jumpsEstimate ? 'selected' : ''}>Estimate</option><option value="counted" ${!vl.jumpsEstimate ? 'selected' : ''}>Counted</option></select></div></div>
      <div class="field"><label for="vlnotes">Notes</label><textarea id="vlnotes" data-in="vl" rows="3" maxlength="600" placeholder="How it went, anything to remember">${esc(vl.notes)}</textarea></div>
    </details>`,
    footer: `${vl.id ? `<button type="button" class="btn critical" data-act="vl.delete" aria-label="Delete this session">${icon('trash')}</button>` : ''}<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="vl.save">Save ${isM ? 'match' : 'session'}</button>` };
}
document.addEventListener('toggle', e => { if (e.target.matches?.('details[data-more="vl"]') && typeof vl === 'object' && vl) vl.moreOpen = e.target.open; }, true);
function refreshVbLoad() {
  const box = $('#vlload'); if (!box) return; const l = sessionLoad(vl);
  box.innerHTML = l ? `<span class="tiny">Session load <b>${l}</b> (${fmt(Number(vl.durationMin), 1)} min × RPE ${fmt(Number(vl.rpe), 1)})</span>` : '';
}
INPUTS.vl = el => {
  const m = { vld: 'date', vldur: 'durationMin', vlopp: 'opponent', vlres: 'result', vljumps: 'jumps', vlnotes: 'notes' };
  if (el.id === 'vldur') { if (el.value === '') return; $$('.vldur .chip').forEach(c => c.classList.remove('on')); }
  if (el.id === 'vljt') vl.jumpsEstimate = el.value === 'est'; else if (m[el.id]) vl[m[el.id]] = el.value;
  refreshVbLoad();
};
ACTIONS['vl.kind'] = el => { vl.kind = el.dataset.arg; if (vl.kind === 'match' && vl.durationMin === '') vl.durationMin = 90; if (vl.kind === 'training') planDefaults(); syncVbFields(); refreshSheet(); };
function syncVbFields() { ['vld', 'vldur', 'vlopp', 'vlres', 'vljumps', 'vlnotes'].forEach(id => { const el = $('#' + id); if (el) INPUTS.vl(el); }); }
ACTIONS['vl.dur'] = el => { vl.durationMin = Number(el.dataset.arg); $('#vldur').value = ''; $$('.vldur .chip').forEach(c => c.classList.toggle('on', c === el)); refreshVbLoad(); };
ACTIONS['vl.int'] = el => { syncVbFields(); const r = INTENSITY[el.dataset.arg].rpe; vl.rpe = intensityOfRpe(vl.rpe) === el.dataset.arg ? '' : r; refreshSheet(); };
ACTIONS['vl.rpe'] = el => { syncVbFields(); vl.rpe = Number(vl.rpe) === Number(el.dataset.arg) ? '' : Number(el.dataset.arg); refreshSheet(); };
ACTIONS['vl.save'] = () => {
  syncVbFields();
  const d = Number(vl.durationMin), r = vl.rpe === '' ? null : Number(vl.rpe), j = vl.jumps === '' ? null : Number(vl.jumps);
  if (!isISO(vl.date)) { toast('Choose a valid date'); return; }
  if (!(d >= 1 && d <= 600)) { toast('Enter the duration in minutes (1–600)'); return; }
  if (r !== null && !(r >= 1 && r <= 10)) { toast('RPE must be between 1 and 10'); return; }
  if (j !== null && !(Number.isInteger(j) && j >= 0 && j <= 2000)) { toast('Jumps must be a whole number from 0 to 2000'); return; }
  const rec = { kind: vl.kind, date: vl.date, durationMin: d, rpe: r, jumps: j, jumpsEstimate: j === null ? null : !!vl.jumpsEstimate, opponent: vl.kind === 'match' ? vl.opponent.trim().slice(0, 60) : '', result: vl.kind === 'match' ? vl.result.trim().slice(0, 40) : '', notes: vl.notes.trim().slice(0, 600) };
  if (vl.id) { const old = data.vb.logs.find(l => l.id === vl.id); delete old.blocks; Object.assign(old, rec); } else data.vb.logs.push({ id: uid(), ...rec, createdAt: new Date().toISOString() });
  save(); closeAllSheets(); render(); toast(`${vl.kind === 'match' ? 'Match' : 'Training'} saved`);
};
ACTIONS['vl.delete'] = async () => {
  if (!await askConfirm({ title: 'Delete this session?', message: '<p>It will be removed from your volleyball history and weekly summaries.</p>', confirmLabel: 'Delete', danger: true })) return;
  data.vb.logs = data.vb.logs.filter(l => l.id !== vl.id); save(); closeAllSheets(); render(); toast('Session deleted');
};
ACTIONS['vb.log'] = el => openVbLog({ kind: el?.dataset?.arg || 'training', date: el?.dataset?.id && isISO(el.dataset.id) ? el.dataset.id : todayISO() });
ACTIONS['vb.edit'] = el => openVbLog({ id: el.dataset.id });
const jumpsText = l => l.jumps === null || l.jumps === undefined || l.jumps === '' ? '' : (l.jumpsEstimate ? `≈${l.jumps} jumps (est.)` : `${l.jumps} jumps`);

/* =============== matches and extra sessions =============== */
let mt = null;
function openMatchSheet(date, from) {
  const d = date && isISO(date) ? date : todayISO();
  mt = { date: d, orig: data.matches.includes(d) ? d : null, ...(data.matchInfo[d] || {}) };
  if (sheetOpen() && !from) closeAllSheets();
  openSheet({ title: mt.orig ? 'Edit match' : 'Add a match', eyebrow: 'FIXTURES', size: 'tall', render: renderMatchSheet });
}
function renderMatchSheet() {
  const others = data.matches.filter(d => d >= todayISO()).sort();
  return { body: `<div class="field first"><label for="mtd">Match date</label><input id="mtd" data-in="mt" type="date" value="${esc(mt.date)}"></div>
    <div class="form-row"><div class="field"><label for="mto">Opponent (optional)</label><input id="mto" data-in="mt" maxlength="60" value="${esc(mt.opponent || '')}"></div><div class="field"><label for="mtt">Time (optional)</label><input id="mtt" data-in="mt" type="time" value="${esc(mt.time || '')}"></div></div>
    <div class="field"><label for="mtv">Venue (optional)</label><input id="mtv" data-in="mt" maxlength="60" value="${esc(mt.venue || '')}"></div>
    <div class="field"><label for="mtn">Notes (optional)</label><textarea id="mtn" data-in="mt" rows="2" maxlength="300">${esc(mt.notes || '')}</textarea></div>
    <p class="note">Adding a match re-plans the gym sessions around it so you arrive fresh. Sessions you have moved yourself stay where you put them and are flagged if they clash.</p>
    ${others.length ? `<div class="eyebrow mt">UPCOMING FIXTURES</div><ul class="plain">${others.map(d => `<li><button type="button" class="linkbtn" data-act="match.open" data-id="${d}">${esc(weekdayShort(d))} ${esc(pretty(d))}${data.matchInfo[d]?.opponent ? ' · ' + esc(data.matchInfo[d].opponent) : ''}</button></li>`).join('')}</ul>` : ''}`,
    footer: `${mt.orig ? `<button type="button" class="btn critical" data-act="match.remove" aria-label="Remove this match">${icon('trash')}</button>` : ''}<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="match.save">Save match</button>` };
}
INPUTS.mt = el => { const m = { mtd: 'date', mto: 'opponent', mtt: 'time', mtv: 'venue', mtn: 'notes' }; if (m[el.id]) mt[m[el.id]] = el.value; };
ACTIONS['match.open'] = el => { closeSheet(); openMatchSheet(el.dataset.id, true); };
ACTIONS['match.add'] = el => openMatchSheet(el?.dataset?.id);
ACTIONS['match.save'] = () => {
  if (!isISO(mt.date)) { toast('Choose a valid date'); return; }
  if (mt.orig && mt.orig !== mt.date) { data.matches = data.matches.filter(d => d !== mt.orig); delete data.matchInfo[mt.orig]; }
  data.matches = [...new Set([...data.matches, mt.date])].sort();
  data.matchInfo[mt.date] = { opponent: (mt.opponent || '').trim(), venue: (mt.venue || '').trim(), time: mt.time || '', notes: (mt.notes || '').trim() };
  save(); closeAllSheets(); render(); toast(`Match saved · ${pretty(mt.date)}`);
};
ACTIONS['match.remove'] = async el => {
  const date = el?.dataset?.id || mt?.orig; if (!date) return;
  if (!await askConfirm({ title: 'Remove this match?', message: `<p>${esc(longDate(date))} will no longer be a match day. Any volleyball log you saved for it is kept.</p>`, confirmLabel: 'Remove match', danger: true })) return;
  data.matches = data.matches.filter(d => d !== date); delete data.matchInfo[date]; save(); closeAllSheets(); render(); toast('Match removed');
};

let xs = null;
function openExtraSheet(id, date) {
  const x = id ? data.vb.extras.find(e => e.id === id) : null;
  xs = x ? { ...x } : { id: null, date: date && isISO(date) ? date : todayISO(), title: '', time: '', notes: '' };
  if (sheetOpen()) closeAllSheets();
  openSheet({ title: x ? 'Edit volleyball session' : 'Add a volleyball session', eyebrow: 'EXTRA SESSION', render: () => ({
    body: `<p class="lead first">For a one-off training, open gym, tournament day or beach session on top of your regular club nights.</p>
      <div class="field"><label for="xsd">Date</label><input id="xsd" data-in="xs" type="date" value="${esc(xs.date)}"></div>
      <div class="form-row"><div class="field"><label for="xst">Name (optional)</label><input id="xst" data-in="xs" maxlength="50" placeholder="e.g. Open gym" value="${esc(xs.title)}"></div><div class="field"><label for="xsw">Time (optional)</label><input id="xsw" data-in="xs" type="time" value="${esc(xs.time)}"></div></div>
      <div class="field"><label for="xsn">Notes (optional)</label><textarea id="xsn" data-in="xs" rows="2" maxlength="300">${esc(xs.notes)}</textarea></div>`,
    footer: `${xs.id ? `<button type="button" class="btn critical" data-act="extra.remove" data-id="${esc(xs.id)}" aria-label="Remove this session">${icon('trash')}</button>` : ''}<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="extra.save">Save session</button>` }) });
}
INPUTS.xs = el => { const m = { xsd: 'date', xst: 'title', xsw: 'time', xsn: 'notes' }; if (m[el.id]) xs[m[el.id]] = el.value; };
ACTIONS['extra.add'] = el => openExtraSheet(null, el?.dataset?.id);
ACTIONS['extra.edit'] = el => openExtraSheet(el.dataset.id);
ACTIONS['extra.save'] = () => {
  if (!isISO(xs.date)) { toast('Choose a valid date'); return; }
  const rec = { date: xs.date, title: xs.title.trim().slice(0, 50), time: xs.time || '', notes: xs.notes.trim().slice(0, 300) };
  if (xs.id) Object.assign(data.vb.extras.find(e => e.id === xs.id), rec); else data.vb.extras.push({ id: uid(), ...rec });
  save(); closeAllSheets(); render(); toast('Volleyball session saved');
};
ACTIONS['extra.remove'] = async el => {
  if (!await askConfirm({ title: 'Remove this session?', message: '<p>It will be taken off your plan. Any log you saved for it is kept.</p>', confirmLabel: 'Remove', danger: true })) return;
  data.vb.extras = data.vb.extras.filter(e => e.id !== el.dataset.id); save(); closeAllSheets(); render(); toast('Session removed');
};
ACTIONS['train.skip'] = el => {
  const d = el.dataset.id; if (!data.vb.skips.includes(d)) data.vb.skips.push(d); save(); closeAllSheets(); render();
  toast(`Training on ${pretty(d)} cancelled`, { action: { label: 'Undo', fn: () => { data.vb.skips = data.vb.skips.filter(x => x !== d); save(); render(); } } });
};
ACTIONS['train.unskip'] = el => { data.vb.skips = data.vb.skips.filter(x => x !== el.dataset.id); save(); closeAllSheets(); render(); toast('Training restored'); };

/* =============== recurring volleyball days =============== */
let rv = null;
ACTIONS['days.open'] = () => {
  const cur = vbDaysFor(todayISO()); rv = { days: new Set(cur), info: {} };
  cur.forEach(i => { const t = data.vb.trainInfo?.[String(i)]; rv.info[i] = { name: t?.name || 'Team training', intensity: t?.intensity || 'moderate', min: t?.min || 90 }; });
  openSheet({ title: 'Fixed trainings', eyebrow: 'WEEKLY SCHEDULE', size: 'tall', render: () => ({
    body: `<p class="note first">Your regular weekly trainings. Gym sessions are planned around them and around matches. Changes apply from today; past weeks keep what they had.</p>
      <div class="daypick" role="group" aria-label="Training days">${DOW.map((n, i) => `<button type="button" class="dp ${rv.days.has(i) ? 'on' : ''}" aria-pressed="${rv.days.has(i)}" data-act="days.toggle" data-arg="${i}"><b>${n}</b><span>${rv.days.has(i) ? '✓' : '·'}</span></button>`).join('')}</div>
      ${[...rv.days].sort().map(i => teamCard(i, rv.info[i])).join('')}
      ${rv.days.size === 0 ? '<div class="status warn">No fixed trainings. Only matches and extra sessions will appear.</div>' : ''}`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="days.save">Save</button>` }) });
};
ACTIONS['days.toggle'] = el => { const i = Number(el.dataset.arg); if (rv.days.has(i)) rv.days.delete(i); else { rv.days.add(i); rv.info[i] = rv.info[i] || { name: 'Team training', intensity: 'moderate', min: 90 }; } refreshSheet(); };
ACTIONS['days.save'] = () => {
  const days = [...rv.days].sort(), today = todayISO(); const sch = data.vb.schedule;
  const same = sch.findIndex(s => s.from === today);
  if (same >= 0) sch[same].days = days; else sch.push({ from: today, days }); sch.sort((a, b) => a.from.localeCompare(b.from));
  data.vb.trainInfo = {}; days.forEach(i => { const t = rv.info[i]; data.vb.trainInfo[String(i)] = { name: (t.name || '').trim() || 'Team training', intensity: t.intensity, min: t.min }; });
  save(); closeAllSheets(); render(); toast('Fixed trainings updated');
};

/* =============== day sheet: everything about one date =============== */
function openDaySheet(date) {
  ui.selectedDay = date;
  openSheet({ title: date === todayISO() ? 'Today' : longDate(date), size: 'tall', render: () => renderDaySheet(date) });
}
const STATUS_LABEL = { planned: 'Planned', done: 'Completed', missed: 'Missed', cancelled: 'Cancelled', rest: 'Rest day' };
const statusTag = s => tag(STATUS_LABEL[s] || s, s === 'done' ? 'sage' : s === 'missed' ? 'rose' : s === 'planned' ? 'clay' : '');
function renderDaySheet(date) {
  const day = dayPlan(date), d = date, past = d < todayISO(); const parts = [];
  for (const it of day.items) {
    if (it.kind === 'gym') {
      const t = templates[it.session], draftHere = data.draft && data.draft.session === it.session && data.draft.date === d;
      parts.push(`<section class="dayitem"><div class="dayhd"><span class="dcode">${sBadge(it.session)}</span><div class="min0"><h3>${esc(t.title)}</h3><p class="dim">${esc(t.duration)} · ${esc(t.subtitle)}${it.pinned ? ' · Moved by you' : ''}</p></div>${statusTag(it.status)}</div>
        ${it.log ? `<p class="tiny">Logged ${it.log.date === d ? 'on this day' : 'on ' + esc(pretty(it.log.date))}.</p>` : ''}
        <div class="actions">${it.log ? `<button type="button" class="btn ghost" data-act="log.view" data-id="${esc(it.log.id)}">View workout</button>` : `<button type="button" class="btn primary" data-act="wk.start" data-id="${it.session}" data-arg="${d}">${icon('play')}${draftHere ? 'Resume' : 'Start'} ${sName(it.session)}</button>`}
        ${it.log ? '' : `<button type="button" class="btn ghost" data-act="move.open" data-id="${it.session}" data-arg="${it.weekMon}">${icon('move')}Move</button>`}${it.pinned ? `<button type="button" class="btn ghost" data-act="move.reset" data-id="${it.session}" data-arg="${it.weekMon}">Reset to recommended</button>` : ''}</div></section>`);
    } else if (it.kind === 'match') {
      const inf = it.info || {};
      parts.push(`<section class="dayitem"><div class="between"><div class="eyebrow">VOLLEYBALL · MATCH</div>${statusTag(it.status)}</div><h3>${esc(inf.opponent ? 'vs ' + inf.opponent : 'Match day')}</h3><p class="dim">${[inf.time, inf.venue].filter(Boolean).map(esc).join(' · ') || 'No gym today'}</p>${inf.notes ? `<p class="tiny">${esc(inf.notes)}</p>` : ''}
        <div class="actions">${it.log ? `<button type="button" class="btn ghost" data-act="vb.edit" data-id="${esc(it.log.id)}">View / edit log</button>` : `<button type="button" class="btn primary" data-act="vb.log" data-arg="match" data-id="${d}">${icon('ball')}Log match</button>`}<button type="button" class="btn ghost" data-act="match.add" data-id="${d}">${icon('edit')}Edit match</button></div></section>`);
    } else if (it.kind === 'training' && it.cancelled) {
      parts.push(`<section class="dayitem"><div class="between"><div class="eyebrow">VOLLEYBALL · TRAINING</div>${statusTag('cancelled')}</div><h3>Regular training cancelled</h3><div class="actions"><button type="button" class="btn ghost" data-act="train.unskip" data-id="${d}">Restore it</button></div></section>`);
    } else if (it.kind === 'training') {
      const x = it.extra;
      parts.push(`<section class="dayitem"><div class="between"><div class="eyebrow">VOLLEYBALL · ${x ? 'EXTRA SESSION' : 'TRAINING'}</div>${statusTag(it.status)}</div><h3>${esc(x?.title || (x ? 'Extra volleyball session' : 'Club training'))}</h3><p class="dim">${x?.time ? esc(x.time) : 'Regular training day'}</p>
        <div class="actions">${it.log ? `<button type="button" class="btn ghost" data-act="vb.edit" data-id="${esc(it.log.id)}">View / edit log</button>` : `<button type="button" class="btn primary" data-act="vb.log" data-arg="training" data-id="${d}">${icon('ball')}Log session</button>`}
        ${x ? `<button type="button" class="btn ghost" data-act="extra.edit" data-id="${esc(x.id)}">${icon('edit')}Edit</button>` : `<button type="button" class="btn ghost" data-act="train.skip" data-id="${d}">Cancel this one</button>`}</div></section>`);
    }
  }
  if (!day.items.length) parts.push(`<section class="dayitem"><div class="between"><div class="eyebrow">REST</div>${tag(past ? 'No plan' : 'Rest day')}</div><h3>Nothing planned</h3><p class="dim">Rest or light mobility. An unscheduled day is not missed progress.</p></section>`);
  const hasGym = day.items.some(i => i.kind === 'gym');
  return { body: `${day.conflicts.length ? `<div class="flags">${day.conflicts.map(c => `<div class="flag ${c.level}">${icon('warn')}<span>${esc(c.text)}</span></div>`).join('')}<p class="tiny">Flagged, not changed: your plan stays exactly as you set it.</p></div>` : ''}${parts.join('')}
    <ul class="prow dayadd"><li><button type="button" data-act="vb.log" data-arg="training" data-id="${d}">${icon('ball')}<span>Log volleyball</span></button></li><li><button type="button" data-act="match.add" data-id="${d}">${icon('plus')}<span>Add a match</span></button></li><li><button type="button" data-act="extra.add" data-id="${d}">${icon('plus')}<span>Extra session</span></button></li></ul>
    ${hasGym ? '' : `<div class="eyebrow mt">Log a gym session on this day</div><div class="chip-row">${SESSION_KEYS.map(k => `<button type="button" class="chip" data-act="wk.start" data-id="${k}" data-arg="${d}">${esc(sChip(k))}</button>`).join('')}</div>`}`,
    footer: '' };
}
ACTIONS['day.open'] = el => openDaySheet(el.dataset.id);

/* =============== moving a gym session =============== */
let mv = null;
ACTIONS['move.open'] = el => {
  const session = el.dataset.id, week = el.dataset.arg; const plan = weekPlan(week); const cur = plan.days.flatMap(d => d.items.map(i => ({ ...i, date: d.date }))).find(i => i.kind === 'gym' && i.session === session);
  const from = cur?.date || todayISO(); let first = addDays(from, 1); if (first < todayISO()) first = todayISO();
  mv = { session, week, from, target: first };
  openSheet({ title: `Move ${sName(session)}`, eyebrow: `FROM ${pretty(from).toUpperCase()}`, size: 'tall', render: renderMove });
};
function describeDay(date) {
  const day = dayPlan(date); const parts = day.items.map(i => i.kind === 'gym' ? `${sName(i.session)}` : i.kind === 'match' ? 'Match' : 'Volleyball');
  return parts;
}
function renderMove() {
  const today = todayISO(); const chips = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const tgt = mv.target; const valid = isISO(tgt) && tgt >= today; const there = valid ? describeDay(tgt).filter(x => !(tgt === mv.from && x === `${sName(mv.session)}`)) : [];
  return { body: `<p class="lead first">Pick the day you want to do ${esc(sName(mv.session))} instead. The rest of the week re-plans around it.</p>
    <div class="field"><label for="mvd">New date</label><input id="mvd" data-in="mv" type="date" min="${today}" value="${esc(mv.target)}"></div>
    <div class="movegrid" role="group" aria-label="Quick dates">${chips.map(d => { const what = describeDay(d); return `<button type="button" class="mv ${d === mv.target ? 'on' : ''} ${what.length ? 'busy' : ''}" data-act="move.pick" data-arg="${d}" aria-pressed="${d === mv.target}"><b>${esc(weekdayShort(d))} ${parseDate(d).getDate()}</b><span>${what.length ? esc(what.join(' + ')) : 'Free'}</span></button>`; }).join('')}</div>
    ${!valid ? `<div class="status warn">Choose today or a later date.</div>` : there.length ? `<div class="status warn">${icon('warn')} ${esc(pretty(tgt))} already has: <b>${esc(there.join(' + '))}</b>. You can still move here. The clash will be flagged on your plan; nothing is overwritten.</div>` : `<div class="status">${esc(longDate(tgt))} is free.</div>`}`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="move.save" ${valid ? '' : 'disabled'}>${there.length ? 'Move anyway' : 'Move session'}</button>` };
}
INPUTS.mv = el => { mv.target = el.value; refreshSheet(); const i = $('#mvd'); if (i) { i.focus(); } };
ACTIONS['move.pick'] = el => { mv.target = el.dataset.arg; refreshSheet(); };
ACTIONS['move.save'] = () => {
  if (!isISO(mv.target) || mv.target < todayISO()) { toast('Choose today or a later date'); return; }
  data.pins = data.pins.filter(p => !(p.session === mv.session && p.week === mv.week));
  data.pins.push({ id: uid(), session: mv.session, week: mv.week, date: mv.target, createdAt: new Date().toISOString() });
  save(); closeAllSheets(); render(); toast(`${sName(mv.session)} moved to ${pretty(mv.target)}`);
};
ACTIONS['move.reset'] = el => {
  data.pins = data.pins.filter(p => !(p.session === el.dataset.id && p.week === el.dataset.arg)); save(); closeAllSheets(); render(); toast(`${sName(el.dataset.id)} back to its recommended day`);
};
