'use strict';
/* VERTFORM 2.4 — fuel flags, weekly jump load, themes, custom logo. */

/* =============== fuel vs training flags =============== */
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function fuelFlags() {
  const today = todayISO(), hr = new Date().getHours(), out = [];
  const t = targetsFor(today), v = foodTotals(today), n = foodsFor(today).length;
  if (t.type !== 'RECOVERY' && n > 0 && hr >= 17 && v.kcal < t.cal * 0.65)
    out.push({ tone: 'warn', key: 'light', title: `Light on fuel for a ${dayTypeLabel(t.type).toLowerCase()}`, text: `${Math.round(v.kcal).toLocaleString('en-GB')} of ${t.cal.toLocaleString('en-GB')} kcal so far. Under-eating around hard training costs power and slows recovery. Add a proper meal.`, act: { label: 'Add food', act: 'food.open2' } });
  const tm = addDays(today, 1);
  if (plannedFor(tm) === 'MATCH') {
    if (n > 0 && hr >= 15 && v.carbs < t.carbs * 0.8) out.push({ key: 'match-carbs', tone: 'warn', title: 'Match tomorrow — carbs are behind', text: `${Math.round(v.carbs)} of ${t.carbs} g carbs today. Rice, pasta, potatoes or oats at dinner will top you up.`, act: { label: 'Add food', act: 'food.open2' } });
    else out.push({ key: 'match', tone: '', title: 'Match tomorrow', text: 'Keep carbs at target today, hydrate, and aim for a full night’s sleep.' });
  }
  const past = []; for (let i = 1; i <= 7; i++) { const d = addDays(today, -i); if (foodsFor(d).length >= 2) past.push(d); }
  if (past.length >= 3) {
    const k = mean(past.map(d => foodTotals(d).kcal)), tk = mean(past.map(d => targetsFor(d).cal)), p = mean(past.map(d => foodTotals(d).protein)), tp = mean(past.map(d => targetsFor(d).protein));
    if (k < tk * 0.85) out.push({ key: 'week-under', hold: 3, tone: 'warn', title: 'Under-eating across the week', text: `Over your last ${past.length} logged days you averaged ${Math.round(k).toLocaleString('en-GB')} kcal against targets averaging ${Math.round(tk).toLocaleString('en-GB')}. If that is not deliberate, jumping and recovery suffer first.` });
    else if (p < tp * 0.8) out.push({ key: 'protein', hold: 3, tone: '', title: 'Protein is running low', text: `About ${Math.round(p)} g a day against a ${Math.round(tp)} g target over your last ${past.length} logged days.` });
  }
  const lw = entriesOf('weight').at(-1), snooze = data.settings.weighSnooze;
  if (false && data.user.profileSet && (!lw || daysBetween(lw.date, today) > 7) && !(snooze && snooze >= today)) /* 2.16: the Bodyweight card on the diary handles this */
    out.push({ tone: '', title: 'Time to weigh in', text: lw ? `Your last bodyweight was ${daysBetween(lw.date, today)} days ago. Calories follow your weight, so keep it current.` : 'Log a bodyweight so calories can follow it.', act: { label: 'Log weight', act: 'ms.add', arg: 'weight' }, act2: { label: 'Not now', act: 'weigh.snooze' } });
  const hide = data.settings.flagHide || {};
  return out.filter(f => !(f.key && hide[f.key] && hide[f.key] >= today)).slice(0, 3);
}
function fuelFlagsHtml() {
  return fuelFlags().map(f => `<div class="banner ${f.tone}">${icon(f.tone === 'warn' ? 'warn' : 'info')}${f.key ? `<button type="button" class="iconbtn bx" data-act="flag.hide" data-arg="${f.key}" data-hold="${f.hold || 0}" aria-label="Dismiss">${icon('close')}</button>` : ''}<div class="grow"><b>${esc(f.title)}</b><p>${esc(f.text)}</p>${f.act ? `<div class="actions"><button type="button" class="btn sm primary" data-act="${f.act.act}"${f.act.arg ? ` data-arg="${f.act.arg}"` : ''}>${esc(f.act.label)}</button>${f.act2 ? `<button type="button" class="btn sm ghost" data-act="${f.act2.act}">${esc(f.act2.label)}</button>` : ''}</div>` : ''}</div></div>`).join('');
}
ACTIONS['flag.hide'] = el => { const h = data.settings.flagHide = data.settings.flagHide || {}; h[el.dataset.arg] = addDays(todayISO(), Number(el.dataset.hold) || 0); save(); render(); };
ACTIONS['weigh.snooze'] = () => { data.settings.weighSnooze = addDays(todayISO(), 3); save(); render(); };
/* one-line nudge on the hub */
function hubNote() {
  const f = fuelFlags()[0]; if (!f) return '';
  return `<button type="button" class="vhNote ${f.tone}" data-act="hub.panel" data-arg="diet" aria-label="${esc(f.title)}"><i></i>${esc(f.title)}</button>`;
}

/* =============== weekly jump load =============== */
/* Planned sessions count at your recent average jumps per training (no jump data yet means no projection). */
function typicalJumps() { const r = data.vb.logs.filter(l => l.kind === 'training' && Number.isFinite(l.jumps) && l.jumps > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(l => l.jumps); return r.length ? Math.round(mean(r)) : 0; }
function weekJumps(mon) {
  const end = addDays(mon, 7), logs = data.vb.logs.filter(l => l.date >= mon && l.date < end), today = todayISO();
  const logged = sum(logs, l => (l.jumps === '' || l.jumps == null ? 0 : l.jumps)), unknown = logs.filter(l => l.jumps === '' || l.jumps == null).length;
  let projected = 0, sessions = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i); if (d < today) continue;
    for (const it of dayPlan(d).items) if (it.kind === 'training' && !it.cancelled && it.status !== 'done') { projected += typicalJumps(); sessions++; }
  }
  return { mon, logged, projected, sessions, unknown, minutes: sum(logs, l => l.durationMin), count: logs.length };
}
function loadModel() {
  const m0 = monday(todayISO()), weeks = Array.from({ length: 8 }, (_, i) => weekJumps(addDays(m0, -7 * (7 - i))));
  const cur = weeks[7], prev = weeks.slice(3, 7).filter(w => w.logged > 0), base = prev.length >= 2 ? mean(prev.map(w => w.logged)) : 0, total = cur.logged + cur.projected;
  const spike = base > 0 && total > base * 1.3 && total - base > 60;
  return { weeks, cur, base, total, spike };
}
function loadCard() {
  const m = loadModel(), max = Math.max(1, ...m.weeks.map(w => w.logged + w.projected));
  const bars = m.weeks.map((w, i) => `<div class="lc ${i === 7 ? 'now' : ''}"><b>${w.logged + w.projected || ''}</b><div class="lcbar"><i class="proj" style="height:${Math.round(w.projected / max * 100)}%"></i><i class="done" style="height:${Math.round(w.logged / max * 100)}%"></i></div><span>${parseDate(w.mon).getDate()}/${parseDate(w.mon).getMonth() + 1}</span></div>`).join('');
  const any = m.weeks.some(w => w.logged + w.projected > 0);
  const msg = !any ? 'Add a jump count when you log a training to see your weekly load here.'
    : m.spike ? `This week is on course for about ${m.total} jumps, roughly ${Math.round((m.total / m.base - 1) * 100)}% above your recent average of ${Math.round(m.base)}. Ease in: keep gym jumps out of it and watch your knees.`
    : m.base ? `This week: ${m.cur.logged} logged${m.cur.projected ? ` + about ${m.cur.projected} still planned` : ''}. Recent average ${Math.round(m.base)} a week.`
    : `This week: ${m.cur.logged} logged${m.cur.projected ? ` + about ${m.cur.projected} planned` : ''}. A few more weeks of logs will show a trend.`;
  return `${sectionHead('LOAD', 'Jumps per week', m.spike ? '<span class="tag rose">SPIKE</span>' : '')}
    <div class="loadchart" role="img" aria-label="Jumps per week for the last 8 weeks. ${esc(msg)}">${bars}</div>
    <div class="legend"><span><i class="k done"></i>Logged</span><span><i class="k planned"></i>Still planned</span></div>
    <p class="tiny ${m.spike ? 'warnText' : ''}">${esc(msg)} Matches count only once logged. A rise of more than about a third on your recent average is a rule of thumb for easing in, not a medical threshold.</p>`;
}

/* =============== themes and custom logo =============== */
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function resolvedTheme() { const t = data?.settings?.theme || 'dark'; return t === 'auto' ? (darkQuery && !darkQuery.matches ? 'light' : 'dark') : t; }
function applyTheme() {
  const r = resolvedTheme(); document.documentElement.dataset.theme = r;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', r === 'light' && !(ui.page === 'home') ? '#edf1f9' : '#060b16');
}
if (darkQuery?.addEventListener) darkQuery.addEventListener('change', () => { if ((data?.settings?.theme) === 'auto') applyTheme(); });
ACTIONS['theme.set'] = el => { data.settings.theme = el.dataset.arg; save(); applyTheme(); render(); };

const logoOk = s => typeof s === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 200000;
function crestInner() { return logoOk(data.settings.logo) ? `<img src="${data.settings.logo}" alt="" class="crestimg">` : crestSvg; }
function applyLogo() { const mk = document.querySelector('.topbar .mark, .rail .mark'); document.querySelectorAll('.mark').forEach(m => { m.innerHTML = logoOk(data.settings.logo) ? `<img src="${data.settings.logo}" alt="" class="crestimg">` : '<svg viewBox="0 0 32 32"><path d="M5 6h6l5 15 5-15h6L19 27h-6z" fill="currentColor"/></svg>'; }); return mk; }
ACTIONS['logo.pick'] = () => $('#logofile')?.click();
ACTIONS['logo.clear'] = () => { data.settings.logo = ''; save(); applyLogo(); render(); toast('Back to the V crest'); };
document.addEventListener('change', async e => {
  if (e.target?.id !== 'logofile') return; const file = e.target.files?.[0]; if (!file) return;
  try {
    if (!/^image\//.test(file.type)) throw new Error('Choose an image file');
    const bmp = await createImageBitmap(file); let size = 256, url = '';
    while (size >= 96) {
      const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), s = Math.min(bmp.width, bmp.height);
      x.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size); url = c.toDataURL('image/png'); if (url.length < 150000) break; size -= 64;
    }
    if (!logoOk(url)) throw new Error('That image is too detailed; try a simpler one');
    data.settings.logo = url; save(); applyLogo(); render(); toast('Logo updated');
  } catch (err) { toast(err.message || 'Could not use that image'); }
  finally { e.target.value = ''; }
});
function appearanceSection() {
  const cur = data.settings.theme || 'dark';
  return `<div class="chip-row" role="group" aria-label="Theme">${[['dark', 'Dark'], ['light', 'Light'], ['auto', 'Match phone']].map(([k, n]) => `<button type="button" class="chip ${cur === k ? 'on' : ''}" aria-pressed="${cur === k}" data-act="theme.set" data-arg="${k}">${n}</button>`).join('')}</div>
    <p class="tiny">The home hub stays a night scene in every theme.</p>
    <div class="eyebrow">HOME LAYOUT</div>${layoutSection()}
    <div class="logoset"><span class="logoprev">${crestInner()}</span><div><b>Your logo</b><p class="tiny">Shown in the hub and top bar. Square images look best. The home-screen icon is set by your browser and does not change.</p></div></div>
    <div class="quick"><button type="button" class="btn ghost" data-act="logo.pick">${icon('upload')}Choose logo</button>${logoOk(data.settings.logo) ? `<button type="button" class="btn ghost" data-act="logo.clear">Remove</button>` : ''}</div>
    <input id="logofile" type="file" accept="image/*" hidden aria-label="Logo image">`;
}
