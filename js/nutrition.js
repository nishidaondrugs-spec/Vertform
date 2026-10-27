'use strict';
/* VERTFORM 2.0 — nutrition: targets, diary maths, everyday-food search, scanner, manual entry, calculator.
   Search, barcode lookup, measures (tbsp/tsp/whole items) and macro maths are carried over from v1.6. */

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const nutritionSetting = () => data.nutrition.settings;

const foodsFor = date => data.nutrition.entries.filter(x => x.date === date).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
function foodTotals(date) {
  return foodsFor(date).reduce((a, f) => { a.kcal += Number(f.kcal) || 0; a.protein += Number(f.protein) || 0; a.carbs += Number(f.carbs) || 0; a.fat += Number(f.fat) || 0; return a; }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}
const dayTypeLabel = t => t === 'MATCH' ? 'Match day' : t === 'TEAM' ? 'Volleyball day' : t === 'RECOVERY' ? 'Rest day' : 'Gym day';

/* ---------- unit helpers ---------- */
const SHORT_UNIT = { g: 'g', tbsp: 'tbsp', tsp: 'tsp', cup: 'cup', whole: 'whole', half: 'half', small: 'small', medium: 'medium', large: 'large', slice: 'slice', tin: 'tin', handful: 'handful', scoop: 'scoop', serving: 'serving', cup: 'cup' };
const everydayById = id => EVERYDAY_FOODS.find(f => f.id === id);
function foodLikeFromEveryday(f) {
  const u = f.units || {};
  return { kind: 'everyday', id: f.id, name: f.name, per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }, units: { g: 1, ...u },
    defaultUnit: u.serving ? 'serving' : u.whole ? 'whole' : u.tbsp ? 'tbsp' : u.slice ? 'slice' : u.scoop ? 'scoop' : 'g', note: 'General food composition average' };
}
function foodLikeFromProduct(p) {
  const per = {};
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) {
    const v = safeN(p.per100?.[k]); const s = safeN(p.serving?.[k]);
    per[k] = v !== null ? v : (s !== null && p.servingQuantity ? s / p.servingQuantity * 100 : 0);
  }
  const units = { g: 1, ...guessedUnitsFromProduct(p) }; if (p.servingQuantity) units.serving = Number(p.servingQuantity);
  return { kind: 'product', id: p.barcode, name: [p.brand, p.name].filter(Boolean).join(' · ').slice(0, 85), per100: per, units, defaultUnit: p.servingQuantity ? 'serving' : 'g', note: 'Packaged product from Open Food Facts', barcode: p.barcode };
}
function portionNutr(food, unit, qty) {
  const gramsPer = unit === 'g' ? 1 : Number(food.units[unit]) || 0;
  const grams = gramsPer * qty, k = grams / 100;
  return { grams, kcal: food.per100.kcal * k, protein: food.per100.protein * k, carbs: food.per100.carbs * k, fat: food.per100.fat * k };
}

/* ---------- search ---------- */
function foodMatches(query) {
  const q = query.trim().toLowerCase().replace(/[’']/g, ''), toks = q.split(/\s+/).filter(Boolean);
  const hay = f => `${f.name} ${f.alias}`.toLowerCase().replace(/[’']/g, '');
  const sc = f => { const n = f.name.toLowerCase().replace(/[’']/g, ''); return n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2; };
  let a = EVERYDAY_FOODS.filter(f => { const h = hay(f); return toks.every(t => h.includes(t) || (t.length > 3 && t.endsWith('s') && h.includes(t.slice(0, -1)))); });
  if (q) a.sort((x, y) => sc(x) - sc(y));
  return a.slice(0, q ? 40 : 14);
}
const recentFoods = (n = 6) => [...data.nutrition.entries].reverse().filter(e => !e.recipeId).filter((e, i, a) => a.findIndex(y => y.name.toLowerCase() === e.name.toLowerCase()) === i).slice(0, n);
function foodSearchResults(q) {
  const recipes = typeof recipeMatches === 'function' ? recipeMatches(q) : [];
  const foods = foodMatches(q);
  const rec = recipes.map(r => { const ps = recipePerServing(r); return `<button type="button" class="result" data-act="recipe.log" data-id="${esc(r.id)}"><div class="grow"><strong>${esc(r.name)}</strong> ${tag(r.type === 'meal' ? 'Saved meal' : 'Recipe', 'sage')}<small>${Math.round(ps.kcal)} kcal · ${fmt(ps.protein, 0)}g P per ${r.type === 'meal' ? 'portion' : 'serving'}</small></div>${icon('chev')}</button>`; });
  const fl = foods.map(f => `<button type="button" class="result" data-act="food.pick" data-id="${esc(f.id)}"><div class="grow"><strong>${esc(f.name)}</strong><small>${f.units && f.units.serving ? `${Math.round(f.kcal * f.units.serving / 100)} kcal per serving · ${fmt(f.protein * f.units.serving / 100, 0)}g protein` : `${Math.round(f.kcal)} kcal per 100 g · ${fmt(f.protein, 1)}g protein`}</small></div>${icon('chev')}</button>`);
  const all = [...rec, ...fl];
  const ai = `<button type="button" class="result airow" data-act="ai.open"><div class="grow"><strong>Ask AI about "${esc(q.trim().length > 30 ? q.trim().slice(0, 29) + '…' : q.trim())}"</strong><small>Chat it through, then save the macros</small></div>${icon('plus')}</button>`;
  return ai + (all.length ? all.join('') : emptyBox('No matching everyday food. Try another name, search UK packaged products online, or use manual entry.'));
}

let searchState = { q: '', meal: null };
function openFoodSearch(meal) {
  searchState = { q: '', meal: meal || ui.fuelMeal || guessMeal() };
  if (sheetOpen()) closeAllSheets();
  openSheet({ title: 'Add food', eyebrow: pretty(ui.fuelDate).toUpperCase(), size: 'tall', autofocus: '#fq', render: renderFoodSearch, onClose: stopScanner });
}
function renderFoodSearch() {
  const rec = typeof recipesByRecency === 'function' ? recipesByRecency().slice(0, 4) : [];
  const recents = recentFoods(5);
  const row = (act, ic, t, sub) => `<button type="button" class="fdrow" data-act="${act}">${icon(ic)}<span><b>${t}</b><small>${sub}</small></span>${icon('chev')}</button>`;
  return {
    body: `<div class="fsearch"><input id="fq" class="fdq" data-in="foodq" type="search" autocomplete="off" autocapitalize="none" enterkeyhint="search" aria-label="Search foods and saved meals" placeholder="Search foods or saved meals" value="${esc(searchState.q)}">
        <div id="fresults" class="results fdrop" role="listbox" aria-label="Matches" ${searchState.q.trim() ? '' : 'hidden'}>${searchState.q.trim() ? foodSearchResults(searchState.q) : ''}</div></div>
      <div class="fdmeals" role="group" aria-label="Add to">${MEALS.map(m => `<button type="button" class="${searchState.meal === m ? 'on' : ''}" data-act="food.meal" data-arg="${m}" aria-pressed="${searchState.meal === m}">${m}</button>`).join('')}</div>
      <div class="fdlist">${row('food.scan', 'scan', 'Scan a barcode', 'Packaged food in seconds')}${row('food.online', 'search', 'Search UK products', 'Supermarket brands, needs internet')}${row('ai.open', 'info', 'Describe a meal', 'Chat it through, AI estimates the macros')}${row('food.manual', 'plus', 'Enter macros yourself', 'Name, calories, protein, carbs, fat')}</div>
      ${recents.length ? `<div class="fdlab">Recent</div><div class="chip-row">${recents.map(x => `<button type="button" class="chip" data-act="food.repeat" data-id="${esc(x.id)}" aria-label="Add ${esc(x.name)} again">${icon('plus')}${esc(x.name.length > 26 ? x.name.slice(0, 25) + '…' : x.name)}</button>`).join('')}</div>` : ''}
      ${rec.length ? `<div class="fdlab">Saved meals</div><div class="chip-row">${rec.map(r => `<button type="button" class="chip" data-act="recipe.log" data-id="${esc(r.id)}">${icon('bookmark')}${esc(r.name)}</button>`).join('')}</div>` : ''}
      ${myFoodsChips().replace('<div class="eyebrow mt">MY FOODS</div>', '<div class="fdlab">My foods</div>')}`,
    footer: ''
  };
}
ACTIONS['food.meal'] = el => { searchState.meal = el.dataset.arg; ui.fuelMeal = searchState.meal; document.querySelectorAll('.fdmeals button').forEach(b => { const on = b.dataset.arg === searchState.meal; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); };
INPUTS.foodq = el => { searchState.q = el.value; const box = $('#fresults'); if (box) { box.hidden = !el.value.trim(); box.innerHTML = el.value.trim() ? foodSearchResults(el.value) : ''; } };
INPUTS.foodmeal = el => { searchState.meal = el.value; ui.fuelMeal = el.value; };

/* ---------- generic portion sheet (diary + recipe ingredients) ---------- */
let ps = null;
function openPortion(st) {
  ps = st;
  const food = st.food;
  openSheet({ title: st.mode === 'ingredient' ? (st.editing ? 'Edit ingredient' : 'Add ingredient') : (st.editId ? 'Edit portion' : 'Add to diary'),
    eyebrow: food.kind === 'product' ? 'PACKAGED PRODUCT' : 'EVERYDAY FOOD · NO BARCODE', size: 'tall', render: renderPortion, onMount: refreshPortion });
}
function renderPortion() {
  const f = ps.food, unitOpts = Object.entries(f.units).map(([k, v]) => `<option value="${esc(k)}" ${k === ps.unit ? 'selected' : ''}>${esc(FOOD_UNIT_NAMES[k] || k)}${k === 'g' ? '' : ` (~${fmt(v, 1)} g each)`}</option>`).join('');
  return {
    body: `<div class="picked"><div class="eyebrow">${esc(f.kind === 'product' ? 'PACKAGED PRODUCT' : 'EVERYDAY FOOD')}</div><h3>${esc(f.name)}</h3><p>${Math.round(f.per100.kcal)} kcal per 100 g · ${esc(f.note || '')}</p></div>
      <div class="form-row"><div class="field first"><label for="psq">How much?</label><input id="psq" data-in="ps" type="number" inputmode="decimal" min="0.05" max="5000" step="any" value="${esc(ps.qty)}"></div>
      <div class="field first"><label for="psu">Measure</label><select id="psu" data-in="ps">${unitOpts}</select></div></div>
      ${ps.mode === 'diary' ? `<div class="field"><label for="psm">Meal</label><select id="psm">${mealOptions(ps.meal)}</select></div>` : ''}
      <div class="status" id="psequiv" aria-live="polite"></div><div id="psmacros" class="macros" aria-live="polite"></div>
      <p class="note">Approximate generic data per 100 g; teaspoon and tablespoon conversions are ingredient-specific (UK tablespoon = 15 ml). Fruit weights refer to the <b>edible part</b>. Check packaging or weigh for greater accuracy.</p>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">${icon('back')}Back</button><button type="button" class="btn primary grow" data-act="portion.add">${ps.mode === 'ingredient' ? (ps.editing ? 'Update ingredient' : 'Add ingredient') : ps.editId ? 'Update portion' : 'Add to diary'}</button>`
  };
}
function readPortion() {
  const q = Number($('#psq')?.value), unit = $('#psu')?.value, f = ps.food;
  if (!Number.isFinite(q) || q <= 0 || q > 5000 || !(unit === 'g' || Object.prototype.hasOwnProperty.call(f.units, unit))) return null;
  const n = portionNutr(f, unit, q);
  return Number.isFinite(n.grams) && n.grams > 0 && n.grams <= 5000 ? { q, unit, ...n } : null;
}
const macroCells = v => `<div><b>${Math.round(v.kcal)}</b><small>KCAL</small></div><div><b>${fmt(v.protein, 1)}g</b><small>PROTEIN</small></div><div><b>${fmt(v.carbs, 1)}g</b><small>CARBS</small></div><div><b>${fmt(v.fat, 1)}g</b><small>FAT</small></div>`;
function refreshPortion() {
  const v = readPortion(), box = $('#psmacros'), eq = $('#psequiv'); if (!box) return;
  if (!v) { box.innerHTML = '<p class="tiny">Enter a valid positive quantity.</p>'; if (eq) eq.textContent = 'Invalid portion size'; return; }
  eq.textContent = `Approx. ${fmt(v.grams, 1)} g · ${fmt(v.q, 2)} ${FOOD_UNIT_NAMES[v.unit] || v.unit}`;
  box.innerHTML = macroCells(v);
}
INPUTS.ps = () => refreshPortion();
ACTIONS['portion.add'] = () => {
  const v = readPortion(); if (!v) { toast('Check the quantity and measure'); return; }
  ps.onAdd(v, $('#psm')?.value);
};
ACTIONS['food.pick'] = el => {
  const f = everydayById(el.dataset.id); if (!f) return;
  const fl = foodLikeFromEveryday(f);
  openPortion({ mode: 'diary', food: fl, unit: fl.defaultUnit, qty: fl.defaultUnit === 'g' ? 100 : 1, meal: searchState.meal || guessMeal(), onAdd: addEverydayToDiary });
};
function addEverydayToDiary(v, meal, editId = ps.editId) {
  const food = ps.food; const existing = data.nutrition.entries.find(f => f.id === editId);
  const item = { id: existing?.id || uid(), date: existing?.date || ui.fuelDate, name: food.name, meal: meal || 'Lunch', protein: Number(fmt(v.protein, 1)), carbs: Number(fmt(v.carbs, 1)), fat: Number(fmt(v.fat, 1)),
    labelKcal: Math.round(v.kcal), kcal: Math.round(v.kcal), source: 'Everyday food estimate', foodId: food.id, portion: Number(fmt(v.grams, 1)), portionUnit: v.unit, portionCount: v.q, createdAt: existing?.createdAt || new Date().toISOString() };
  if (existing) Object.assign(existing, item); else data.nutrition.entries.push(item);
  save(); closeAllSheets(); render(); toast(`${food.name} ${existing ? 'updated' : 'added'}`);
}

/* ---------- repeat / delete ---------- */
ACTIONS['food.repeat'] = el => {
  const old = data.nutrition.entries.find(f => f.id === el.dataset.id); if (!old) return;
  const copy = { ...deepCopy(old), id: uid(), date: ui.fuelDate, meal: searchState.meal && sheetOpen() ? searchState.meal : old.meal, createdAt: new Date().toISOString() };
  data.nutrition.entries.push(copy); save(); closeAllSheets(); render();
  toast(`${old.name} added to ${pretty(copy.date)}`, { action: { label: 'Undo', fn: () => { data.nutrition.entries = data.nutrition.entries.filter(x => x.id !== copy.id); save(); render(); } } });
};
ACTIONS['food.del'] = async el => {
  const f = data.nutrition.entries.find(x => x.id === el.dataset.id); if (!f) return;
  data.nutrition.entries = data.nutrition.entries.filter(x => x.id !== f.id); save(); render();
  toast(`${f.name} removed`, { action: { label: 'Undo', fn: () => { data.nutrition.entries.push(f); save(); render(); } } });
};
ACTIONS['food.edit'] = el => {
  const logged = data.nutrition.entries.find(x => x.id === el.dataset.id); if (!logged) return;
  if (logged.recipeId || logged.recipeSnapshot) { openAdjustRecipeEntry(logged.id); return; }
  const genericId = logged.foodId || (logged.source === 'Everyday food estimate' ? EVERYDAY_FOODS.find(x => x.name === logged.name)?.id : '');
  const food = genericId && everydayById(genericId);
  if (food) {
    const fl = foodLikeFromEveryday(food); const unit = logged.portionUnit && (logged.portionUnit === 'g' || fl.units[logged.portionUnit]) ? logged.portionUnit : fl.defaultUnit;
    openPortion({ mode: 'diary', food: fl, unit, qty: logged.portionCount || (unit === 'g' ? 100 : 1), meal: logged.meal, editId: logged.id, onAdd: (v, meal) => addEverydayToDiary(v, meal, logged.id) });
  } else openManualFood(logged.id);
};

/* ---------- manual entry ---------- */
let manualEditId = '';
function openManualFood(editId = '') {
  manualEditId = editId; if (sheetOpen() && !editId) { /* keep search beneath so Back works */ }
  openSheet({ title: editId ? 'Edit logged food' : 'Log food & macros', eyebrow: 'MANUAL ENTRY', size: 'tall', render: renderManual });
}
function renderManual() {
  const existing = data.nutrition.entries.find(x => x.id === manualEditId);
  const f = existing || { date: ui.fuelDate, meal: searchState.meal || ui.fuelMeal || guessMeal(), name: '', protein: '', carbs: '', fat: '', kcal: '' };
  return {
    body: `<div class="field first"><label for="fdate">Day</label><input id="fdate" type="date" value="${esc(f.date)}"></div>
      <div class="field"><label for="fname">Food / meal name</label><input id="fname" maxlength="85" placeholder="e.g. Chicken and rice bowl" value="${esc(f.name)}"></div>
      <div class="field"><label for="fmealm">Meal</label><select id="fmealm">${mealOptions(f.meal)}</select></div>
      <div class="form-row"><div class="field"><label for="fprotein">Protein (g)</label><input id="fprotein" data-in="manualmacro" type="number" inputmode="decimal" min="0" max="500" step="0.1" placeholder="0" value="${esc(f.protein)}"></div>
      <div class="field"><label for="fcarbs">Carbs (g)</label><input id="fcarbs" data-in="manualmacro" type="number" inputmode="decimal" min="0" max="800" step="0.1" placeholder="0" value="${esc(f.carbs)}"></div>
      <div class="field"><label for="ffat">Fat (g)</label><input id="ffat" data-in="manualmacro" type="number" inputmode="decimal" min="0" max="300" step="0.1" placeholder="0" value="${esc(f.fat)}"></div>
      <div class="field"><label for="fkcal">Label kcal (optional)</label><input id="fkcal" data-in="manualmacro" type="number" inputmode="decimal" min="0" max="5000" step="1" placeholder="Auto from macros" value="${esc(f.labelKcal ?? '')}"></div></div>
      <div id="fpreview" class="tip">${existing ? 'Editing your saved food.' : 'Without label kcal, calories are estimated from protein/carbs (4 kcal/g) and fat (9 kcal/g).'}</div>
      <p class="note" hidden>Enter values for the portion you ate. Packaged food is quicker with the scanner; manual entry remains useful for meals and products missing from the database.</p>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="food.save">${existing ? 'Update food' : 'Save food'}</button>`
  };
}
INPUTS.manualmacro = () => {
  const p = Number($('#fprotein')?.value) || 0, c = Number($('#fcarbs')?.value) || 0, f = Number($('#ffat')?.value) || 0, k = $('#fkcal')?.value;
  const box = $('#fpreview'); if (box) box.textContent = `Estimated ${k !== '' ? Math.round(Number(k)) : Math.round(p * 4 + c * 4 + f * 9)} kcal · ${p}g protein · ${c}g carbs · ${f}g fat`;
};
ACTIONS['food.manual'] = () => openManualFood('');
async function aiEstimate(q) {
  let r;
  try { r = await fetch(`${LB_URL}/functions/v1/dynamic-worker`, { method: 'POST', headers: { apikey: LB_KEY, Authorization: `Bearer ${LB_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) }); }
  catch (_) { throw new Error('offline'); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.error) throw new Error(j?.error || 'failed');
  return j;
}
ACTIONS['food.ai'] = async () => {
  const q = ($('#fq')?.value || searchState.q || '').trim();
  if (q.length < 2) { toast('Type what you ate first'); return; }
  toast('Estimating…');
  let e;
  try { e = await aiEstimate(q); }
  catch (err) { toast(err.message === 'offline' ? 'You seem to be offline' : 'The AI estimate is not available right now. Try again or use Manual.'); return; }
  openManualFood('');
  setTimeout(() => {
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    set('#fname', e.name); set('#fprotein', e.protein); set('#fcarbs', e.carbs); set('#ffat', e.fat); set('#fkcal', e.kcal);
    toast(`About ${e.grams} g. ${e.note} Check before saving.`);
  }, 0);
};
/* ---------- AI food chat: describe a meal, talk it through, then save the macros ---------- */
let aiChat = { msgs: [], est: null, busy: false };
const aiHistory = () => aiChat.msgs.filter(m => !m.err).slice(-12).map(m => ({ role: m.r === 'ai' ? 'assistant' : 'user', text: m.t.slice(0, 500) }));
async function aiAsk(messages) {
  let r;
  try { r = await fetch(`${LB_URL}/functions/v1/dynamic-worker`, { method: 'POST', headers: { apikey: LB_KEY, Authorization: `Bearer ${LB_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) }); }
  catch (_) { throw new Error('offline'); }
  const j = await r.json().catch(() => null);
  if (r.ok && j && !j.error) return j;
  if (j && j.error === 'bad_query') {   // older function version without chat: fall back to a one-shot estimate
    const e = await aiEstimate(messages.filter(m => m.role === 'user').map(m => m.text).join('. ').slice(0, 200));
    return { reply: `${e.note} About ${e.grams} g.`.trim(), estimate: e };
  }
  throw new Error(j?.error || 'failed');
}
const aiMsgsHtml = () => (aiChat.msgs.length ? '' : `<div class="aimsg ai"><p>Tell me what you ate, like "beef brisket noodles from Lanzhou La Main". I will estimate the macros. Then tell me what to change ("only half the noodles", "no oil") and save it when it looks right.</p></div>`)
  + aiChat.msgs.map(m => `<div class="aimsg ${m.r}${m.err ? ' err' : ''}"><p>${esc(m.t)}</p></div>`).join('')
  + (aiChat.busy ? '<div class="aimsg ai typing" aria-label="Thinking"><span></span><span></span><span></span></div>' : '');
const aiEstHtml = () => { const e = aiChat.est; return e ? `<div class="aiest"><div class="aie-top"><b>${esc(e.name)}</b><small>about ${e.grams} g</small></div><div class="aie-row"><span><b class="mono">${e.kcal}</b>kcal</span><span><b class="mono">${e.protein}g</b>protein</span><span><b class="mono">${e.carbs}g</b>carbs</span><span><b class="mono">${e.fat}g</b>fat</span></div><button type="button" class="btn primary" data-act="ai.use">Use these macros</button></div>` : ''; };
function aiPaint() {
  const box = $('#aichat'); if (!box) return;
  box.innerHTML = aiMsgsHtml(); const est = $('#aiest'); if (est) est.innerHTML = aiEstHtml();
  const send = $('#aisend'); if (send) send.disabled = aiChat.busy;
  const body = $('.sheet-body'); if (body) body.scrollTop = body.scrollHeight;
}
function renderAiChat() {
  return {
    body: `<div id="aichat" class="aichat" aria-live="polite">${aiMsgsHtml()}</div>`,
    footer: `<div class="aifoot"><div id="aiest">${aiEstHtml()}</div><div class="aiin"><input id="aiq" type="text" maxlength="300" autocomplete="off" enterkeyhint="send" placeholder="Describe what you ate…" aria-label="Message to the AI"><button type="button" id="aisend" class="btn primary" data-act="ai.send" aria-label="Send">${icon('chev')}</button></div></div>`
  };
}
ACTIONS['ai.open'] = () => {
  const q = ($('#fq')?.value || searchState.q || '').trim();
  aiChat = { msgs: [], est: null, busy: false };
  openSheet({ title: 'Ask AI', eyebrow: 'MEAL ESTIMATE', size: 'tall', render: renderAiChat, autofocus: '#aiq' });
  if (q.length >= 2) setTimeout(() => { const el = $('#aiq'); if (el) { el.value = q; ACTIONS['ai.send'](); } }, 0);
};
ACTIONS['ai.send'] = async () => {
  const el = $('#aiq'), t = (el?.value || '').trim(); if (!t || aiChat.busy) return;
  el.value = ''; aiChat.msgs.push({ r: 'user', t }); aiChat.busy = true; aiPaint();
  try {
    const j = await aiAsk(aiHistory());
    aiChat.msgs.push({ r: 'ai', t: String(j.reply || '').trim() || 'Here is my estimate.' });
    if (j.estimate && typeof j.estimate === 'object') aiChat.est = j.estimate;
  } catch (err) { aiChat.msgs.push({ r: 'ai', err: true, t: err.message === 'offline' ? 'You seem to be offline. Try again when you are back online.' : 'The AI is not available right now. Try again, or use Manual.' }); }
  aiChat.busy = false; aiPaint(); $('#aiq')?.focus({ preventScroll: true });
};
ACTIONS['ai.use'] = () => {
  const e = aiChat.est; if (!e) return;
  openManualFood('');
  setTimeout(() => {
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    set('#fname', e.name); set('#fprotein', e.protein); set('#fcarbs', e.carbs); set('#ffat', e.fat); set('#fkcal', e.kcal);
    INPUTS.manualmacro(); toast('Check the numbers, then save');
  }, 0);
};
addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'aiq') { e.preventDefault(); ACTIONS['ai.send'](); } });

ACTIONS['food.save'] = () => {
  const existing = data.nutrition.entries.find(f => f.id === manualEditId);
  const date = $('#fdate').value, name = $('#fname').value.trim(), meal = $('#fmealm').value;
  const vs = ['protein', 'carbs', 'fat'].map(k => Number($('#f' + k).value || 0)), labelEl = $('#fkcal'), hasLabel = labelEl.value.trim() !== '';
  if (!isISO(date) || !name || !MEALS.includes(meal) || vs.some((n, i) => !Number.isFinite(n) || n < 0 || n > [500, 800, 300][i]) || (hasLabel && (!labelEl.checkValidity() || Number(labelEl.value) <= 0)) || (vs.every(n => n === 0) && !hasLabel)) { toast('Enter a food and valid macros or label kcal'); return; }
  const f = { id: existing?.id || uid(), date, name: name.slice(0, 85), meal, protein: vs[0], carbs: vs[1], fat: vs[2], labelKcal: hasLabel ? Number(labelEl.value) : '', kcal: Math.round(hasLabel ? Number(labelEl.value) : vs[0] * 4 + vs[1] * 4 + vs[2] * 9), createdAt: existing?.createdAt || new Date().toISOString() };
  if (existing) Object.assign(existing, f); else data.nutrition.entries.push(f);
  ui.fuelDate = date; save(); closeAllSheets(); render(); toast('Food saved');
};


/* ---------- Open Food Facts: online search, barcode lookup, scanner (behaviour unchanged) ---------- */
const OFF_FIELDS = 'code,product_name,generic_name,brands,quantity,serving_size,serving_quantity,nutriments,countries_tags,image_front_small_url';
function safeN(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; }
function productFromOff(code, p) {
  const n = p?.nutriments || {}, pick = (...ks) => { for (const k of ks) { const v = safeN(n[k]); if (v !== null) return v; } return null; }, serv = safeN(p?.serving_quantity);
  return { barcode: String(code), name: String(p?.product_name || p?.generic_name || 'Scanned food').slice(0, 100), brand: String(p?.brands || '').slice(0, 80), quantity: String(p?.quantity || '').slice(0, 60), servingSize: String(p?.serving_size || '').slice(0, 60), servingQuantity: serv, image: String(p?.image_front_small_url || ''), countries: Array.isArray(p?.countries_tags) ? p.countries_tags : [],
    per100: { kcal: pick('energy-kcal_100g'), protein: pick('proteins_100g'), carbs: pick('carbohydrates_100g'), fat: pick('fat_100g') }, serving: { kcal: pick('energy-kcal_serving'), protein: pick('proteins_serving'), carbs: pick('carbohydrates_serving'), fat: pick('fat_serving') }, source: 'Open Food Facts' };
}
const productHasMacros = x => ['kcal', 'protein', 'carbs', 'fat'].some(k => safeN(x?.per100?.[k]) !== null) || ['kcal', 'protein', 'carbs', 'fat'].some(k => safeN(x?.serving?.[k]) !== null);
function guessedUnitsFromProduct(prod) {
  const n = `${prod.name || ''} ${prod.brand || ''}`.toLowerCase();
  if (/chia/.test(n)) return { tbsp: 12, tsp: 4 }; if (/honey/.test(n)) return { tbsp: 21, tsp: 7 };
  if (/peanut butter|nut butter|almond butter/.test(n)) return { tbsp: 16, tsp: 5.3 };
  if (/olive oil|vegetable oil|rapeseed oil|cooking oil/.test(n)) return { tbsp: 13.5, tsp: 4.5 };
  if (/milk|drink|juice/.test(n)) return { tbsp: 15, tsp: 5, cup: 250 }; if (/yoghu?rt/.test(n)) return { tbsp: 15, cup: 245 };
  if (/oats|porridge/.test(n)) return { tbsp: 5, cup: 90 }; if (/jam/.test(n)) return { tbsp: 20, tsp: 7 };
  return {};
}
ACTIONS['food.online'] = async () => {
  const q = $('#fq')?.value?.trim() || ''; if (q.length < 2) { toast('Enter at least two letters for an online product search'); return; }
  const results = $('#fresults'); if (results) results.innerHTML = '<div class="spinner" role="status" aria-label="Searching"></div><p class="tiny center">Searching UK products… (needs internet)</p>';
  try {
    const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '12', fields: OFF_FIELDS, countries_tags_en: 'united-kingdom' });
    const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, { mode: 'cors' });
    if (!response.ok) throw new Error('Search service unavailable');
    const payload = await response.json(), products = (payload.products || []).map(x => productFromOff(x.code, x)).filter(productHasMacros).slice(0, 12);
    if (!products.length) { results && (results.innerHTML = emptyBox('No UK packaged results with usable nutrition were found. Try a different name or use a generic food.')); return; }
    for (const p of products) data.nutrition.productCache[p.barcode] = p; save();
    results && (results.innerHTML = products.map(p => `<button type="button" class="result" data-act="food.cached" data-id="${esc(p.barcode)}"><div class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.brand || 'Packaged food')} · ${p.per100.kcal ?? '?'} kcal / 100 g</small></div>${icon('chev')}</button>`).join('') + '<p class="note">UK-listed packaged foods from Open Food Facts (ODbL). Check label data for errors.</p>');
  } catch (err) {
    const offline = !navigator.onLine;
    results && (results.innerHTML = emptyBox(`${esc(offline ? 'You appear to be offline' : (err?.message || 'Online search unavailable'))}. The everyday food library and your saved meals still work offline.`));
  }
};
ACTIONS['food.cached'] = el => { const p = data.nutrition.productCache[el.dataset.id]; if (p) openProductSheet(p, true); };

let pendingProduct = null;
function portionMacros(prod, amount) {
  const q = Math.max(0, Number(amount) || 0); let out = { kcal: 0, protein: 0, carbs: 0, fat: 0 }, basis = 'per100';
  if (prod.servingQuantity && q === Number(prod.servingQuantity) && productHasMacros({ serving: prod.serving, per100: {} })) { for (const k in out) out[k] = safeN(prod.serving?.[k]) ?? 0; basis = 'serving'; }
  else { for (const k in out) { const per = safeN(prod.per100?.[k]); const serving = safeN(prod.serving?.[k]); out[k] = per !== null ? per * q / 100 : (serving !== null && prod.servingQuantity ? serving * q / prod.servingQuantity : 0); } if (Object.values(prod.per100 || {}).every(v => safeN(v) === null)) basis = 'serving-scaled'; }
  return { ...out, basis };
}
function scannedPortionWeight(prod) {
  const q = Number($('#scanportion')?.value), unit = $('#scanunit')?.value || 'g', units = guessedUnitsFromProduct(prod);
  if (!Number.isFinite(q) || q <= 0 || q > 5000) return NaN;
  const grams = unit === 'g' ? q : unit === 'serving' ? q * (Number(prod.servingQuantity) || 0) : q * Number(units[unit] || 0);
  return grams > 0 && grams <= 5000 ? grams : NaN;
}
function openProductSheet(prod, cached = false, replace = false, preset = null) {
  pendingProduct = prod;
  const uk = prod.countries?.some(x => String(x).toLowerCase().includes('united-kingdom')), defaultAmount = prod.servingQuantity || 100;
  const own = prod.source === 'Added by you', spec = { title: 'Scanned food', eyebrow: own ? 'SAVED BY YOU' : 'OPEN FOOD FACTS', size: 'tall', onMount: () => { if (preset) { const q = $('#scanportion'), u = $('#scanunit'); if (u && [...u.options].some(o => o.value === preset.unit)) u.value = preset.unit; if (q && preset.amount > 0) q.value = preset.amount; } refreshScanned(); refreshFavBtn(); }, render: () => ({
    body: `<div class="product"><div class="pimg">${prod.image ? `<img src="${esc(prod.image)}" alt="" referrerpolicy="no-referrer" width="64" height="64">` : icon('scan')}</div><div class="min0"><span class="tag ${uk ? 'slate' : ''}">${own ? 'YOUR PRODUCT' : uk ? 'UK LISTING' : 'DATABASE LISTING'}</span><h3>${esc(prod.name)}</h3><p>${prod.brand ? esc(prod.brand) + ' · ' : ''}${esc(prod.quantity || prod.servingSize || '')}<br><span class="mono">${esc(prod.barcode)}</span></p></div></div>
      <div class="form-row"><div class="field"><label for="scanportion">How much?</label><input id="scanportion" data-in="scanref" type="number" inputmode="decimal" min="0.05" max="5000" step="any" value="${esc(defaultAmount)}"></div>
      <div class="field"><label for="scanunit">Measure</label><select id="scanunit" data-in="scanref"><option value="g">g / ml as listed</option>${Object.entries(guessedUnitsFromProduct(prod)).map(([unit, g]) => `<option value="${unit}">${unit} (≈${fmt(g, 1)} g)</option>`).join('')}${prod.servingQuantity ? `<option value="serving">label serving (${esc(prod.servingQuantity)} g)</option>` : ''}</select></div></div>
      <div class="field"><label for="scanmeal">Meal</label><select id="scanmeal">${mealOptions(searchState.meal || ui.fuelMeal || guessMeal())}</select></div>
      <div id="scanmeasure" class="tiny mt"></div><div id="scanmacros" class="macros"></div>
      <button type="button" class="chip favbtn" id="favbtn" data-act="fav.toggle" aria-pressed="false"></button>
      <div class="status">${prod.servingQuantity ? `Suggested serving from database: <b>${esc(prod.servingQuantity)} g/ml</b>${prod.servingSize ? ` (${esc(prod.servingSize)})` : ''}. ` : ''}Change the portion to match what you actually ate.</div>
      <p class="note">${own ? 'Values you copied from the pack label. ' : cached ? 'Loaded from your on-device product cache. ' : 'Nutrition supplied by <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener">Open Food Facts</a>, localised for Great Britain. '}Community product data can be incomplete or wrong — compare unusual values with the packet label. Database data is reused under ODbL; product images follow Open Food Facts contributor licensing.</p>`,
    footer: `<button type="button" class="btn ghost" data-act="food.scan">Scan another</button><button type="button" class="btn primary grow" data-act="scan.add">Add to diary</button>` }) };
  replace ? replaceSheet(spec) : openSheet(spec);
}
function refreshScanned() {
  if (!pendingProduct) return; const amount = scannedPortionWeight(pendingProduct), m = portionMacros(pendingProduct, amount), box = $('#scanmacros'), info = $('#scanmeasure');
  if (info) info.textContent = Number.isFinite(amount) ? `≈ ${fmt(amount, 1)} g/ml equivalent` : 'Enter a valid quantity';
  if (box) box.innerHTML = macroCells(m);
}
INPUTS.scanref = () => refreshScanned();
ACTIONS['scan.add'] = () => {
  if (!pendingProduct) return; const amount = scannedPortionWeight(pendingProduct), meal = $('#scanmeal')?.value || 'Lunch', portionUnit = $('#scanunit')?.value || 'g', portionCount = Number($('#scanportion')?.value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) { toast('Enter a valid portion'); return; }
  const m = portionMacros(pendingProduct, amount);
  data.nutrition.entries.push({ id: uid(), date: ui.fuelDate, name: [pendingProduct.brand, pendingProduct.name].filter(Boolean).join(' · ').slice(0, 85), meal, protein: Number(fmt(m.protein, 1)), carbs: Number(fmt(m.carbs, 1)), fat: Number(fmt(m.fat, 1)), labelKcal: Math.round(m.kcal), kcal: Math.round(m.kcal), barcode: pendingProduct.barcode, source: pendingProduct.source, portion: amount, portionUnit, portionCount, createdAt: new Date().toISOString() });
  const fv = favs().find(x => x.key === pendingProduct.barcode); if (fv) { fv.amount = portionCount; fv.unit = portionUnit; }
  save(); pendingProduct = null; closeAllSheets(); render(); toast('Scanned food added');
};
