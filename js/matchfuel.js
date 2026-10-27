'use strict';
/* VERTFORM 2.64 — match-day fuel plan.
   Given a kick-off time, shows when to eat carbs and when to take quick sugar (honey) before the game, what to sip during, and the recovery meal.
   The same steps can be sent as notifications through the existing push setup. General sports-nutrition guidance, not medical advice. */
const mfMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const mfClock = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
/* offset = minutes from kick-off; push = also sent as a notification */
const MF_STEPS = [
  [-240, 'Main carb meal', 'Rice, pasta or oats with lean protein. Keep fat and fibre low.', true],
  [-150, 'Top up carbs', 'Toast with jam, banana or a rice cake. Sip water.', true],
  [-60, 'Easy carbs', 'Banana, dates or toast with honey. Keep sipping water.', true],
  [-20, 'Honey shot', '1–2 tbsp honey (or a gel) for quick energy.', true],
  [0, 'Between sets', 'Sip water or a carb drink. Banana at long breaks.', false],
  [100, 'Recovery meal', 'Within an hour: 25–30 g protein plus carbs. Rehydrate.', true]
];
function matchFuelSteps(date) {
  const inf = data.matchInfo[date]; if (!isMatch(date) || !inf || !/^\d\d:\d\d$/.test(inf.time || '')) return null;
  const k = mfMin(inf.time);
  return MF_STEPS.map(([o, title, body, push]) => ({ at: k + o, time: mfClock(k + o), title, body, push }));
}
function matchFuelCard(date) {
  if (!isMatch(date)) {
    const tmr = addDays(date, 1);
    return date === todayISO() && isMatch(tmr) ? `<section class="mfcard mfsoft"><b>Match tomorrow</b><p>Have extra carbs at dinner tonight (rice, pasta, potato). Keep it low in fat and drink water through the evening.</p></section>` : '';
  }
  const steps = matchFuelSteps(date), inf = data.matchInfo[date] || {};
  if (!steps) return `<section class="mfcard"><b>Match day fuel</b><p>Add your kick-off time and VERTFORM tells you when to eat carbs and take honey.</p><button type="button" class="pill on" data-act="match.open" data-id="${esc(date)}">Add kick-off time</button></section>`;
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes(), live = date === todayISO();
  const next = live ? steps.findIndex(s => s.at >= nowM) : -1;
  return `<section class="mfcard"><div class="mf-h"><div><b>Match day fuel</b><small>Kick-off ${esc(inf.time)}${inf.opponent ? ' · vs ' + esc(inf.opponent) : ''}</small></div><button type="button" class="linkbtn" data-act="match.open" data-id="${esc(date)}">Edit</button></div>
    <ol class="mf-list">${steps.map((s, i) => `<li class="${live && s.at < nowM ? 'done' : ''} ${i === next ? 'next' : ''}"><span class="mf-t mono">${s.time}</span><div><b>${esc(s.title)}</b><p>${esc(s.body)}</p></div></li>`).join('')}</ol></section>`;
}
/* steps for the push plan: next few matches, compact */
function matchFuelPlan() {
  const out = [], t = todayISO();
  for (let i = 0; i < 8; i++) { const d = addDays(t, i), s = matchFuelSteps(d); if (s) s.filter(x => x.push).forEach(x => out.push([d, x.time, x.title, x.body.slice(0, 70)])); }
  return out;
}
