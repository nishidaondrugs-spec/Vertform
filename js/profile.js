'use strict';
/* VERTFORM 2.3 — personal profile and calorie maths, and the Vertical plan.
   Everything here is an estimate built from the person's own numbers; none of it is medical advice. */

const nset = () => data.nutrition.settings;
const round50 = x => Math.round(x / 50) * 50;
const round10 = x => Math.round(x / 10) * 10;

/* =============== profile and calories =============== */
const DAILY_LIFE = { seated: [1.3, 'Mostly seated (desk, study)'], mixed: [1.4, 'Mixed — some walking'], feet: [1.55, 'On my feet most of the day'], physical: [1.7, 'Physical job'] };

/* Latest logged bodyweight wins over the profile figure, so targets follow you as you change. */
function currentWeight() {
  const m = entriesOf('weight').at(-1);
  return m ? Number(m.value) : (Number(data.user.bodyweight) || 0);
}
function profileFromStore() {
  const s = nset();
  return { age: Number(s.age), sex: s.sex, height: Number(data.user.height), weight: currentWeight(), bodyFat: isNum(s.bodyFat) ? Number(s.bodyFat) : null,
    daily: s.daily || 'mixed', gymMin: Number(s.gymMin) || 60, custom: Number(s.customCalories) || 0 };
}
/* A typical week of training from what is actually planned, not a fixed assumption. */
function trainingWeek() {
  let gymN = 0;
  try { gymN = weekPlan(monday(todayISO())).days.flatMap(d => d.items).filter(i => i.kind === 'gym' && !i.unplanned).length; } catch (e) { gymN = 0; }
  const vbN = vbDaysFor(todayISO()).length, vbMin = (() => { const m = Object.values(data.vb.trainInfo || {}).map(t => t.min).filter(Boolean); return m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length) : 90; })();
  return { gymN: gymN || 4, vbN, vbMin };
}
function profileOk(p) {
  return Number.isFinite(p.age) && p.age >= 16 && p.age <= 90 && (p.sex === 'male' || p.sex === 'female') && p.height >= 100 && p.height <= 250 && p.weight >= 30 && p.weight <= 250;
}
/* Resting energy from the person's own numbers, daily-life factor, plus the energy of the sessions they actually do.
   Training energy uses approximate net MET values (gym 3.5, volleyball practice 3.0) — a rough guide, not a measurement. */
function estimateFrom(p) {
  const tw = trainingWeek(), w = p.weight || 0;
  const training = Math.round((tw.gymN * 3.5 * w * (p.gymMin / 60) + tw.vbN * 3.0 * w * (tw.vbMin / 60)) / 7);
  if (p.custom > 0) return { cal: round50(p.custom), method: 'Your own maintenance figure', ok: true, custom: true, bmr: null, training };
  if (!profileOk(p)) return { cal: round50((w || 75) * 34), method: 'Provisional — add your age, sex, height and weight', ok: false, bmr: null, training };
  const bf = p.bodyFat, useBf = bf !== null && bf >= 5 && bf <= 50;
  const bmr = useBf ? 370 + 21.6 * w * (1 - bf / 100) : 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const dailyKcal = bmr * (DAILY_LIFE[p.daily]?.[0] || 1.4);
  return { cal: round50(dailyKcal + training), method: (useBf ? 'Katch–McArdle (from body fat)' : 'Mifflin–St Jeor') + ' + your training', ok: true, bmr: Math.round(bmr), dailyKcal: Math.round(dailyKcal), training, ffm: useBf ? w * (1 - bf / 100) : null };
}
const maintenanceEstimate = () => estimateFrom(profileFromStore());

function targetsFor(date) {
  const s = nset(), estimate = maintenanceEstimate(), type = plannedFor(date), w = currentWeight() || 75;
  const delta = s.dayAdjust !== false ? (type === 'MATCH' ? 250 : type === 'TEAM' ? 100 : type === 'RECOVERY' ? -150 : 0) : 0;
  const goalDelta = s.goal === 'gain' ? round10(estimate.cal * 0.05) : s.goal === 'cut' ? -round10(estimate.cal * 0.10) : 0;
  const floor = estimate.bmr ? Math.max(1200, Math.round(estimate.bmr * 1.1)) : 1200;
  const cal = clamp(estimate.cal + delta + goalDelta, floor, 6500);
  const p = clamp(Math.round(Number(data.user.proteinTarget) || Math.round(w * 1.8)), 40, 350);
  const f = clamp(Math.round(w * clamp(Number(s.fatPerKg) || 0.9, 0.5, 1.5)), 35, 160);
  const c = Math.max(0, Math.round((cal - p * 4 - f * 9) / 4));
  return { cal, protein: p, carbs: c, fat: f, type, estimate, dayDelta: delta, goalDelta };
}

function profileBanner() {
  const e = maintenanceEstimate();
  if (e.ok) return '';
  return `<button type="button" class="tgtnudge" data-act="calc.open"><span><b>Personalise your targets</b><small>Add age, height and weight</small></span>${icon('chev')}</button>`;
}

function calRead() {
  const v = id => $('#' + id)?.value ?? '';
  return { age: v('calage') === '' ? NaN : Number(v('calage')), sex: v('calsex'), height: Number(v('calht')), weight: Number(v('calwt')), bodyFat: v('calbf') === '' ? null : Number(v('calbf')),
    daily: v('caldaily') || 'mixed', gymMin: Number(v('calgym')) || 60, custom: Number(v('calmanual')) || 0, goal: v('calgoal') || 'maintain' };
}
function calPreview() {
  const box = $('#calprev'); if (!box) return;
  const p = calRead(), e = estimateFrom(p), tw = trainingWeek();
  if (!e.ok) { box.innerHTML = `<b>${e.cal} kcal</b> provisional average day. Fill in age, sex, height and weight and this becomes a calculated figure.`; return; }
  const goal = p.goal === 'gain' ? round10(e.cal * 0.05) : p.goal === 'cut' ? -round10(e.cal * 0.10) : 0;
  let html = `<b>${e.cal + goal} kcal</b> average day${goal ? ` (${goal > 0 ? '+' : ''}${goal} for your goal)` : ''}.<br><span class="tiny">${e.custom ? esc(e.method) : `Resting ${e.bmr} · daily life ${e.dailyKcal - e.bmr} · training ${e.training}/day (${tw.gymN} gym + ${tw.vbN} volleyball a week)`}</span>`;
  if (e.ffm && e.training) { const ea = Math.round((e.cal + goal - e.training) / e.ffm); html += `<br><span class="tiny ${ea < 30 ? 'warnText' : ''}">Energy available for recovery ≈ ${ea} kcal per kg lean mass${ea < 30 ? ' — below ~30 is a low-energy-availability zone for athletes. Eat more, not less.' : '.'}</span>`; }
  box.innerHTML = html;
}
INPUTS.cal = () => calPreview();

function openCalculator() {
  openSheet({ title: 'Your profile & calories', size: 'tall', onMount: calPreview, render: () => {
    const s = nset(), p = profileFromStore(), lw = entriesOf('weight').at(-1);
    const o = (val, cur, label) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;
    return { body: `<p class="note first">Sets your daily calories and macros. Stays on this device.</p>
      <div class="form-row"><div class="field"><label for="calage">Age</label><input id="calage" data-in="cal" type="number" inputmode="numeric" min="16" max="90" placeholder="e.g. 24" value="${esc(s.age)}"></div>
      <div class="field"><label for="calsex">Sex (for the equation)</label><select id="calsex" data-in="cal">${o('', s.sex || '', 'Choose…')}${o('male', s.sex, 'Male')}${o('female', s.sex, 'Female')}</select></div></div>
      <div class="form-row"><div class="field"><label for="calht">Height (cm)</label><input id="calht" data-in="cal" type="number" inputmode="decimal" min="100" max="250" value="${esc(data.user.profileSet ? data.user.height : '')}" placeholder="e.g. 180"></div>
      <div class="field"><label for="calwt">Bodyweight (kg)</label><input id="calwt" data-in="cal" type="number" inputmode="decimal" min="30" max="250" step="0.1" value="${esc(data.user.profileSet || lw ? fmt(p.weight, 1) : '')}" placeholder="e.g. 75"></div></div>
      ${lw ? `<div class="hint">Your latest logged bodyweight is ${fmt(lw.value, 1)} kg (${esc(pretty(lw.date))}). Changing it here logs a new reading.</div>` : ''}
      <div class="field"><label for="calbf">Body fat % (optional)</label><input id="calbf" data-in="cal" type="number" inputmode="decimal" min="5" max="50" step="0.1" placeholder="Only if you have a reliable reading" value="${esc(s.bodyFat ?? '')}"></div>
      <div class="field"><label for="caldaily">Daily life outside training</label><select id="caldaily" data-in="cal">${Object.entries(DAILY_LIFE).map(([k, [, n]]) => o(k, p.daily, n)).join('')}</select></div>
      <div class="field"><label for="calgym">Typical gym session length (minutes)</label><input id="calgym" data-in="cal" type="number" inputmode="numeric" min="20" max="180" step="5" value="${esc(p.gymMin)}"></div>
      <div class="field"><label for="calgoal">Goal</label><select id="calgoal" data-in="cal">${o('maintain', s.goal, 'Maintain / body recomposition')}${o('gain', s.goal, 'Small surplus (about +5%)')}${o('cut', s.goal, 'Gentle deficit (about −10%)')}</select></div>
      <div class="field"><label for="calprotein">Protein (g per day)</label><input id="calprotein" data-in="cal" type="number" inputmode="numeric" min="40" max="350" step="1" value="${esc(data.user.proteinTarget)}">
        <div class="chip-row">${[1.6, 1.8, 2.0, 2.2].map(k => `<button type="button" class="chip" data-act="cal.pk" data-arg="${k}">${k} g/kg</button>`).join('')}</div></div>
      <div class="form-row"><div class="field"><label for="calfat">Fat (g/kg)</label><input id="calfat" data-in="cal" type="number" inputmode="decimal" min="0.5" max="1.5" step="0.05" value="${esc(s.fatPerKg)}"></div>
      <div class="field"><label for="calmanual">Own maintenance kcal (optional)</label><input id="calmanual" data-in="cal" type="number" inputmode="numeric" min="1200" max="6500" step="10" placeholder="From real weight tracking" value="${esc(s.customCalories)}"></div></div>
      <label class="switch mt"><span>Shift calories for match / training / rest days</span><input id="caladjust" type="checkbox" ${s.dayAdjust !== false ? 'checked' : ''}></label>
      <div class="tip" id="calprev" aria-live="polite"></div>
      <details class="more"><summary>How targets are worked out</summary><ul class="howlist"><li>Resting energy comes from your age, sex, height and weight (Mifflin–St Jeor). With a body-fat figure the Katch–McArdle equation is used instead, which suits muscular athletes better.</li><li>Training is added from the gym sessions in your programme and the volleyball nights and lengths in your training days.</li><li>Around 1.4–2.0 g/kg of protein a day is the usual range for people who train hard; the higher end is common when cutting.</li><li>These are starting estimates. Weigh yourself regularly and nudge the goal if your weight drifts the wrong way over 2–3 weeks. Avoid aggressive deficits in-season: jumping needs fuel.</li></ul></details>`,
      footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="calc.save">Save profile</button>` };
  } });
}
ACTIONS['calc.open'] = () => openCalculator();
ACTIONS['cal.pk'] = el => { const w = Number($('#calwt')?.value) || currentWeight(); if (w) { $('#calprotein').value = Math.round(w * Number(el.dataset.arg)); calPreview(); } };
ACTIONS['calc.save'] = () => {
  const p = calRead(), s = nset();
  const bad = (p.age === p.age && !(Number.isInteger(p.age) && p.age >= 16 && p.age <= 90)) || !(p.height >= 100 && p.height <= 250) || !(p.weight >= 30 && p.weight <= 250)
    || (p.bodyFat !== null && !(p.bodyFat >= 5 && p.bodyFat <= 50)) || !(Number($('#calprotein').value) >= 40 && Number($('#calprotein').value) <= 350)
    || !(Number($('#calfat').value) >= 0.5 && Number($('#calfat').value) <= 1.5) || (p.custom && !(p.custom >= 1200 && p.custom <= 6500));
  if (bad) { toast('Check your profile values (height and weight are needed)'); return; }
  s.age = Number.isNaN(p.age) ? '' : p.age; s.sex = p.sex; s.bodyFat = p.bodyFat === null ? '' : p.bodyFat; s.daily = p.daily; s.gymMin = p.gymMin; s.goal = p.goal;
  s.fatPerKg = Number($('#calfat').value); s.customCalories = p.custom || ''; s.dayAdjust = $('#caladjust').checked;
  data.user.height = p.height; data.user.proteinTarget = Number($('#calprotein').value);
  if (Math.abs(p.weight - currentWeight()) > 0.001) data.metrics.push({ id: uid(), date: todayISO(), key: 'weight', value: p.weight });
  data.user.bodyweight = p.weight; data.user.profileSet = true;
  save(); closeAllSheets(); render(); toast('Profile saved — targets updated');
};

/* =============== vertical plan =============== */
const CMJ_BANDS = { male: [46, 51, 57, 60], female: [35, 41, 46, 49] }; // Average / Good / Advanced / Elite starts (cm), adult team-sport norms
const LEVELS = ['Developing', 'Average', 'Good', 'Advanced', 'Elite'];
const phaseNow = () => data.user.phase || (data.matches.some(m => { const d = daysBetween(todayISO(), m); return d >= -7 && d <= 28; }) ? 'in' : 'off');

function verticalModel() {
  const cmj = latestMetric('cmj'), aj = latestMetric('approachJump'), rsi = latestMetric('rsi'), w = currentWeight(), trap = Number(data.user.trap1rm) || 0;
  const sex = nset().sex === 'female' ? 'female' : 'male', sexKnown = nset().sex === 'male' || nset().sex === 'female';
  let level = null;
  if (cmj) { const b = CMJ_BANDS[sex]; let i = 0; b.forEach((t, j) => { if (Number(cmj.value) >= t) i = j + 1; }); level = { i, name: LEVELS[i], next: b[i] ?? null }; }
  const rel = trap && w ? trap / w : null;
  const str = rel === null ? null : rel < 1.5 ? 'low' : rel < 2 ? 'mid' : 'high';
  const el = rsi ? (Number(rsi.value) < 1.5 ? 'low' : Number(rsi.value) < 2 ? 'mid' : 'high') : null;
  let focus = 'test';
  if (level) {
    if (str === 'low' || (str === null && level.i <= 1)) focus = 'strength';
    else if (el === 'low' || (str === 'high' && el !== 'high')) focus = 'reactive';
    else if (level.i >= 4 && str === 'high' && el !== 'low') focus = 'refine';
    else focus = 'balanced';
  }
  const tw = trainingWeek(), vbJumps = tw.vbN * typicalJumps();
  return { cmj, aj, rsi, rel, str, el, level, sex, sexKnown, focus, phase: phaseNow(), vbJumps, vbN: tw.vbN, w };
}
const FOCUS = {
  test: ['Test first', 'Log a standing CMJ (and ideally your trap-bar 1RM) so the plan can be built around your numbers rather than a template.'],
  strength: ['Strength is your biggest lever', 'Your lifting numbers (or jump level) say force production is the limiter. Stronger athletes also respond faster to jump training later, so build the base and keep jumps low-key.'],
  reactive: ['Springiness is your biggest lever', 'You are strong enough that fast, short ground contacts are the next gain: reactive work such as drop jumps, hops and bounds.'],
  balanced: ['Balanced — keep both qualities moving', 'Neither strength nor elasticity stands out as a hole. Alternate heavy and fast work and let retests tell you which responds.'],
  refine: ['Refine and protect', 'At this level gains are small and the stimulus needs variety. Lower volume, higher quality, and manage tendon load.']
};
const PLAN = {
  strength: { off: ['2 heavy lower-body days: trap bar or squat 3–5 sets of 3–6 at RPE 8 or lower, plus single-leg work and calf/Achilles strength.', '2 × 20–30 easy contacts (pogos, box jumps with soft landings). Skill, not fatigue.'],
    pre: ['2 days: keep the heavy lift, trim accessories. Add a fast jump after your top set.', '2 × 20–40 contacts: CMJs, box jumps, approach jumps at about 80%.'],
    in: ['1 heavy day, 3 × 3–5 at RPE 7–8. Protect what you built; do not chase personal bests.', 'No extra gym jumping beyond volleyball, or one short set of 3 × 3 CMJs when fresh.'] },
  balanced: { off: ['2 days: main lift 3 × 4–6, a hinge and single-leg work.', '2 × 30–50 contacts: 3–5 sets of 3–5 intense jumps (depth, box, bounds) with full rest between sets.'],
    pre: ['1–2 days: main lift 3 × 3–5, moved fast.', '2 × 30–40 contacts; add approach jumps and one-leg take-offs.'],
    in: ['1 maintenance day, 2–3 × 3–5.', '1 session of 20 contacts or fewer, early in the week and at least 48 hours before a match.'] },
  reactive: { off: ['1–2 days of strength maintenance, 3 × 3–5.', '2 × 30–50 contacts: drop jumps from a height where ground contact stays under about 0.25 s (start 20–40 cm), hurdle hops, pogos, bounds.'],
    pre: ['1 day of strength, 3 × 3–5.', '2 × 30–40: drop jumps plus approach jumps. End a set when contact time lengthens or height drops.'],
    in: ['1 light-to-moderate day.', '1 × 20 contacts or fewer of drop-jump or pogo quality work.'] },
  refine: { off: ['2 days: heavy main lift 3 × 3–5, plus one light, fast speed-strength lift.', '2 × 20–40 high-quality contacts. Vary the stimulus: a stalled response is normal here.'],
    pre: ['1–2 days, heavy lift kept, volume trimmed.', '1–2 × 20–30 contacts, quality only.'],
    in: ['1 maintenance day.', '1 × 15–20 contacts or none; volleyball already supplies volume.'] }
};
const SOURCES = [
  ['Meta-analysis of plyometric training in volleyball (Ramirez-Campillo et al., 2021)', 'https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2021.636140/full'],
  ['Plyometric vs Air Alert training in collegiate volleyball (8 weeks, 3 sessions a week)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12756430/'],
  ['Reactive strength index: benchmarks and drop-jump prescription', 'https://sportscienceinsider.com/reactive-strength-index-chart/'],
  ['Improving RSI: eccentric deceleration and contact time', 'https://coachmeplus.com/improve-rsi/'],
  ['CMJ norms by sex and level', 'https://ovrperformance.com/blogs/news/cmj-norms-by-age-sport-level'],
  ['Maximal strength and jump performance: literature review (Univ. of Stirling)', 'https://www.storre.stir.ac.uk/bitstream/1893/28082/1/Thesis%20Amendments.pdf'],
  ['Stronger athletes respond faster to power training (summary of Cormie et al., 2010)', 'https://doclachjames.substack.com/p/the-strength-advantage-in-power-training'],
  ['Jump height and game efficiency in elite volleyball (Scientific Reports, 2023)', 'https://www.nature.com/articles/s41598-023-35729-w'],
  ['Training volume and patellar tendinopathy in junior volleyball players', 'https://lermagazine.com/?p=7113']
];
const chipLine = (label, val, tone) => `<div class="vp-stat ${tone || ''}"><span>${label}</span><b>${val}</b></div>`;

function verticalBody() {
  const m = verticalModel(), f = FOCUS[m.focus], ph = m.phase;
  const lvlTxt = m.level ? `${m.level.name}${m.level.next ? ` · next band at ${m.level.next} cm` : ''}` : 'No CMJ logged';
  const stats = [
    chipLine('Standing CMJ', m.cmj ? `${fmt(m.cmj.value, 1)} cm` : '—', ''), chipLine('Level', lvlTxt, ''),
    chipLine('Approach jump', m.aj ? `${fmt(m.aj.value, 1)} cm` : '—', ''),
    chipLine('Relative strength', m.rel ? `${fmt(m.rel, 2)}× bodyweight` : 'add 1RM in Settings', ''),
    chipLine('Drop-jump RSI', m.rsi ? `${fmt(m.rsi.value, 2)} m/s` : 'optional test', '')].join('');
  const plan = PLAN[m.focus];
  let planHtml = '';
  if (plan) {
    const [lift, jumps] = plan[ph];
    const heavyVb = m.vbJumps >= 250 ? `Volleyball already gives you roughly ${m.vbJumps} jumps a week (${m.vbN} sessions × your typical jumps). Treat that as most of your jump volume and keep gym jumps to quality only.` : m.vbN ? `Volleyball gives you roughly ${m.vbJumps} jumps a week from the sessions you log, so there is room for a little extra, but it all counts toward tendon load.` : 'Add your training days so the plan can count volleyball jumps.';
    planHtml = `<div class="chip-row" role="group" aria-label="Phase">${[['off', 'Off-season'], ['pre', 'Pre-season'], ['in', 'In-season']].map(([k, n]) => `<button type="button" class="chip ${ph === k ? 'on' : ''}" aria-pressed="${ph === k}" data-act="vert.phase" data-arg="${k}">${n}</button>`).join('')}</div>
      <div class="vp-plan"><div><span class="eyebrow">LIFTING</span><p>${esc(lift)}</p></div><div><span class="eyebrow">JUMPING</span><p>${esc(jumps)}</p></div><div><span class="eyebrow">VOLLEYBALL LOAD</span><p>${esc(heavyVb)}</p></div></div>
      <p class="tiny">These are starting ranges anchored to published protocols (for example 3–5 sets of 3–5 intensive jumps, and 3 sets of 4–8 reps for strength), then shaped by your level and phase. Adjust by how your legs feel: stop a jump session if height or landing quality drops.</p>`;
  } else planHtml = '<p class="note">Add a standing CMJ below to unlock a plan.</p>';
  const notes = [];
  if (!m.sexKnown) notes.push('Set your sex in the profile for the right jump bands. Male bands are used for now.');
  if (m.str === null && m.cmj) notes.push('Add your trap-bar 1RM in Settings to tell strength-limited from springiness-limited.');
  if (m.cmj && m.aj && Number(m.aj.value) < Number(m.cmj.value)) notes.push('Your approach jump is below your standing jump, which usually means the approach (not the legs) is leaking height: film it and work on the last two steps and the plant.');
  return `<p class="lead first">${esc(f[0])}</p><p class="note">${esc(f[1])}</p>
    <div class="vp-stats">${stats}</div>
    ${notes.length ? `<ul class="plain bullets">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    <div class="quick"><button type="button" class="btn primary" data-act="ms.add" data-arg="cmj">${icon('plus')}Log standing CMJ</button><button type="button" class="btn ghost" data-act="ms.add" data-arg="rsi">${icon('plus')}Log RSI</button><button type="button" class="btn ghost" data-act="calc.open">${icon('edit')}Profile</button></div>
    ${sectionHead('YOUR WEEK', 'What to do')}${planHtml}
    ${sectionHead('EXPECTATIONS', 'Progress, retests and limits')}
    <ul class="plain bullets">
      <li><b>Retest every 6–8 weeks</b> under the same conditions. Changes under about 2–3 cm can be test noise.</li>
      <li><b>Typical response:</b> volleyball plyometric programmes of 4–16 weeks raised jump height with a moderate-to-large pooled effect, and players aged 16+ gained more than younger ones. One 8-week collegiate study saw roughly +4 to +10 cm, but with only six athletes per group and below-elite starting levels, so expect less the higher you start.</li>
      <li><b>Strength helps jumps:</b> relative squat strength tracks CMJ height in the literature, and stronger athletes tend to respond faster to power work, though they can plateau sooner and need more variety.</li>
      <li><b>Height is not everything:</b> in elite volleyball, attack and block jump height did not map simply onto how effective the attack or block was. Timing, approach and technique count too.</li>
      <li><b>Protect your knees:</b> in a study of 140 junior volleyball players, those who developed patellar tendinopathy logged more weekly volleyball hours. Add jump volume gradually and drop it when sore.</li>
    </ul>
    <details class="explain"><summary>RSI test, if you want it</summary><p class="note">Step off a 30 cm box, land and jump straight back up as high and fast as you can. RSI = jump height (m) ÷ ground contact time (s); a phone app or contact mat gives both. A score of about 2 or more is a good general benchmark, and many youth or low-demand athletes sit nearer 1.5. If contact time passes about 0.25 s, the drop height is too high for you right now.</p></details>
    <details class="explain"><summary>Where this comes from</summary><ul class="plain bullets">${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
      <p class="note">Strength ratios (1.5× and 2× bodyweight for the trap bar) and contact counts are coaching rules of thumb, not trial results. CMJ bands are adult team-sport norms measured with hands on hips on a force plate; a jump mat or phone app may read a few cm differently. This is not medical advice.</p></details>`;
}
function openVertical() {
  if (sheetOpen()) closeAllSheets();
  openSheet({ title: 'Vertical plan', eyebrow: 'BUILT FROM YOUR NUMBERS', size: 'tall', render: () => ({ body: verticalBody(), footer: `<button type="button" class="btn primary grow" data-act="sheet.close">Done</button>` }) });
}
ACTIONS['vert.open'] = () => openVertical();
ACTIONS['vert.phase'] = el => { data.user.phase = el.dataset.arg; save(); refreshSheet(); };
