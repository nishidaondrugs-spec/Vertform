'use strict';
/* VERTFORM 2.0 — saved meals and recipes.
   A saved meal/recipe holds its own ingredient nutrition. Logging a serving copies a *snapshot* into the diary entry,
   so editing or deleting a recipe later can never change history. */

const recipes = () => data.nutrition.recipes;
const recipeById = id => recipes().find(r => r.id === id);
const ZERO = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

/* One ingredient's nutrition, from the quantity it stores */
function ingNutr(ing) {
  const c = Number(ing.count) || 0;
  if (ing.per100) { const grams = c * (Number(ing.unitGrams) || 0), k = grams / 100; return { grams, kcal: (ing.per100.kcal || 0) * k, protein: (ing.per100.protein || 0) * k, carbs: (ing.per100.carbs || 0) * k, fat: (ing.per100.fat || 0) * k }; }
  if (ing.each) return { grams: null, kcal: (ing.each.kcal || 0) * c, protein: (ing.each.protein || 0) * c, carbs: (ing.each.carbs || 0) * c, fat: (ing.each.fat || 0) * c };
  return { grams: null, ...ZERO() };
}
function ingLabel(ing) {
  const c = Number(ing.count) || 0;
  if (ing.per100) { const u = ing.unit || 'g', n = ingNutr(ing); return u === 'g' ? `${fmt(c, 1)} g` : `${fmt(c, 2)} ${SHORT_UNIT[u] || u} (${fmt(n.grams, 0)} g)`; }
  return c === 1 ? (ing.labelText || 'as logged') : `${fmt(c, 2)} × ${ing.labelText || 'portion'}`;
}
function recipeTotals(r) { return r.ingredients.reduce((a, i) => { const n = ingNutr(i); a.kcal += n.kcal; a.protein += n.protein; a.carbs += n.carbs; a.fat += n.fat; return a; }, ZERO()); }
function recipePerServing(r) { const t = recipeTotals(r), s = Number(r.servings) || 1; return { kcal: t.kcal / s, protein: t.protein / s, carbs: t.carbs / s, fat: t.fat / s }; }
const recipesByRecency = () => [...recipes()].sort((a, b) => (b.lastUsedAt || '').localeCompare(a.lastUsedAt || '') || a.name.localeCompare(b.name));
const recipeMatches = q => { q = (q || '').trim().toLowerCase(); return recipesByRecency().filter(r => !q || r.name.toLowerCase().includes(q)).slice(0, q ? 8 : 3); };
const servingWord = (r, n) => r.type === 'meal' ? (n === 1 ? 'portion' : 'portions') : (n === 1 ? 'serving' : 'servings');

/* ---------- log servings ---------- */
let lg = null;
function openLogRecipe(id, opts = {}) {
  const r = recipeById(id); if (!r) { toast('That recipe no longer exists'); return; }
  lg = { id, servings: opts.servings ?? r.lastServings ?? 1, meal: opts.meal || (sheetOpen() && searchState?.meal) || ui.fuelMeal || guessMeal(), date: opts.date || ui.fuelDate };
  const spec = { title: r.name, eyebrow: r.type === 'meal' ? 'SAVED MEAL' : 'RECIPE', size: 'tall', render: renderLogRecipe, onMount: refreshLogRecipe };
  openSheet(spec);
}
function renderLogRecipe() {
  const r = recipeById(lg.id), ps1 = recipePerServing(r);
  return { body: `<p class="lead first">${r.type === 'meal' ? 'Saved meal' : `Recipe · makes ${fmt(r.servings, 2)} ${servingWord(r, r.servings)}`} · ${Math.round(ps1.kcal)} kcal per ${servingWord(r, 1)}</p>
    <div class="field"><label for="lgs">${r.type === 'meal' ? 'Portions' : 'Servings'} eaten</label>
      <div class="stepper"><button type="button" class="iconbtn" data-act="log.step" data-arg="-0.5" aria-label="Half a ${servingWord(r, 1)} fewer">${icon('minus')}</button>
      <input id="lgs" data-in="logsv" type="number" inputmode="decimal" min="0.05" max="50" step="any" value="${esc(lg.servings)}">
      <button type="button" class="iconbtn" data-act="log.step" data-arg="0.5" aria-label="Half a ${servingWord(r, 1)} more">${icon('plus')}</button></div>
      <div class="chip-row mt-s">${[0.5, 1, 1.5, 2, 3].map(n => `<button type="button" class="chip" data-act="log.set" data-arg="${n}">${n}</button>`).join('')}</div></div>
    <div class="form-row"><div class="field"><label for="lgm">Meal</label><select id="lgm" data-in="logmeta">${mealOptions(lg.meal)}</select></div>
    <div class="field"><label for="lgd">Date</label><input id="lgd" data-in="logmeta" type="date" value="${esc(lg.date)}"></div></div>
    <div id="lgmacros" class="macros" aria-live="polite"></div><div id="lgtotal" class="tiny"></div>
    <details class="mt"><summary>Ingredients (${r.ingredients.length})</summary><ul class="plain">${r.ingredients.map(i => `<li><span>${esc(i.name)}</span><span class="dim">${esc(ingLabel(i))}</span></li>`).join('')}</ul></details>
    <p class="note">Logging copies today's nutrition values into your diary. Editing or deleting this recipe later will not change entries you have already logged.</p>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="recipe.logadd">Add to diary</button>` };
}
function readLog() { const n = Number($('#lgs')?.value); return Number.isFinite(n) && n > 0 && n <= 50 ? n : null; }
function refreshLogRecipe() {
  const r = recipeById(lg.id); if (!r) return; const n = readLog(), box = $('#lgmacros'), tot = $('#lgtotal'); if (!box) return;
  if (!n) { box.innerHTML = '<p class="tiny">Enter a number of servings above 0.</p>'; if (tot) tot.textContent = ''; return; }
  const p = recipePerServing(r), v = { kcal: p.kcal * n, protein: p.protein * n, carbs: p.carbs * n, fat: p.fat * n };
  box.innerHTML = macroCells(v); if (tot) tot.textContent = `${fmt(n, 2)} ${servingWord(r, n)} of ${fmt(r.servings, 2)} · ${fmt(n / r.servings * 100, 0)}% of the whole ${r.type === 'meal' ? 'meal' : 'recipe'}`;
}
INPUTS.logsv = () => refreshLogRecipe();
INPUTS.logmeta = el => { if (el.id === 'lgm') lg.meal = el.value; else lg.date = el.value; };
ACTIONS['log.step'] = el => { const n = Number($('#lgs').value) || 0; $('#lgs').value = Math.max(0.25, +(n + Number(el.dataset.arg)).toFixed(2)); refreshLogRecipe(); };
ACTIONS['log.set'] = el => { $('#lgs').value = el.dataset.arg; refreshLogRecipe(); };
ACTIONS['recipe.log'] = el => openLogRecipe(el.dataset.id);
function entryFromRecipe(r, n, date, meal) {
  const p = recipePerServing(r);
  return { id: uid(), date, name: `${r.name}${n === 1 ? '' : ' × ' + fmt(n, 2)}`.slice(0, 85), meal, protein: Number(fmt(p.protein * n, 1)), carbs: Number(fmt(p.carbs * n, 1)), fat: Number(fmt(p.fat * n, 1)),
    labelKcal: Math.round(p.kcal * n), kcal: Math.round(p.kcal * n), source: r.type === 'meal' ? 'Saved meal' : 'Saved recipe', recipeId: r.id, servings: n,
    recipeSnapshot: { name: r.name, type: r.type, yield: r.servings, recipeUpdatedAt: r.updatedAt || r.createdAt, perServing: { kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat },
      ingredients: r.ingredients.map(i => { const x = ingNutr(i); return { name: i.name, label: ingLabel(i), kcal: x.kcal, protein: x.protein, carbs: x.carbs, fat: x.fat }; }) },
    createdAt: new Date().toISOString() };
}
ACTIONS['recipe.logadd'] = () => {
  const r = recipeById(lg.id), n = readLog(), date = $('#lgd').value, meal = $('#lgm').value;
  if (!r || !n) { toast('Enter a valid number of servings'); return; } if (!isISO(date)) { toast('Choose a valid date'); return; }
  const e = entryFromRecipe(r, n, date, meal); data.nutrition.entries.push(e); r.lastServings = n; r.lastUsedAt = new Date().toISOString();
  ui.fuelDate = date; save(); closeAllSheets(); render();
  toast(`${r.name} · ${fmt(n, 2)} ${servingWord(r, n)} logged`, { action: { label: 'Undo', fn: () => { data.nutrition.entries = data.nutrition.entries.filter(x => x.id !== e.id); save(); render(); } } });
};

/* ---------- adjust a logged recipe entry (uses the entry's own snapshot, never the live recipe) ---------- */
let adj = null;
function openAdjustRecipeEntry(id) {
  const e = data.nutrition.entries.find(x => x.id === id); if (!e?.recipeSnapshot) return; adj = { id };
  openSheet({ title: e.recipeSnapshot.name, eyebrow: 'LOGGED ' + (e.recipeSnapshot.type === 'meal' ? 'MEAL' : 'RECIPE'), size: 'tall', onMount: refreshAdjust, render: () => {
    const s = e.recipeSnapshot;
    return { body: `<p class="lead first">Saved at the time you logged it${s.recipeUpdatedAt ? ' (' + prettyY(s.recipeUpdatedAt.slice(0, 10)) + ')' : ''}. Changing the number of servings re-scales these saved values, not the current recipe.</p>
      <div class="field"><label for="ads">Servings eaten</label><input id="ads" data-in="adjref" type="number" inputmode="decimal" min="0.05" max="50" step="any" value="${esc(e.servings)}"></div>
      <div class="form-row"><div class="field"><label for="adm">Meal</label><select id="adm">${mealOptions(e.meal)}</select></div><div class="field"><label for="add">Date</label><input id="add" type="date" value="${esc(e.date)}"></div></div>
      <div id="admacros" class="macros"></div>
      <details class="mt"><summary>Ingredients at the time (${s.ingredients.length})</summary><ul class="plain">${s.ingredients.map(i => `<li><span>${esc(i.name)}</span><span class="dim">${esc(i.label)}</span></li>`).join('')}</ul></details>`,
      footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="adj.save">Update entry</button>` };
  } });
}
function refreshAdjust() { const e = data.nutrition.entries.find(x => x.id === adj?.id); if (!e) return; const n = Number($('#ads')?.value), box = $('#admacros'); if (!box) return; if (!(n > 0 && n <= 50)) { box.innerHTML = '<p class="tiny">Enter a valid number of servings.</p>'; return; } const p = e.recipeSnapshot.perServing; box.innerHTML = macroCells({ kcal: p.kcal * n, protein: p.protein * n, carbs: p.carbs * n, fat: p.fat * n }); }
INPUTS.adjref = () => refreshAdjust();
ACTIONS['adj.save'] = () => {
  const e = data.nutrition.entries.find(x => x.id === adj?.id), n = Number($('#ads').value), date = $('#add').value; if (!e) return;
  if (!(n > 0 && n <= 50) || !isISO(date)) { toast('Check the servings and date'); return; }
  const p = e.recipeSnapshot.perServing; Object.assign(e, { servings: n, date, meal: $('#adm').value, name: `${e.recipeSnapshot.name}${n === 1 ? '' : ' × ' + fmt(n, 2)}`.slice(0, 85), protein: Number(fmt(p.protein * n, 1)), carbs: Number(fmt(p.carbs * n, 1)), fat: Number(fmt(p.fat * n, 1)), kcal: Math.round(p.kcal * n), labelKcal: Math.round(p.kcal * n) });
  save(); closeAllSheets(); render(); toast('Entry updated');
};

/* ---------- recipe editor ---------- */
let rd = null; // working copy
function openRecipeEditor(id, preset) {
  const r = id ? recipeById(id) : null;
  rd = r ? deepCopy(r) : (preset || { id: null, type: 'recipe', name: '', servings: 4, notes: '', ingredients: [] });
  if (sheetOpen()) closeAllSheets();
  openSheet({ title: r ? 'Edit ' + (r.type === 'meal' ? 'saved meal' : 'recipe') : (rd.type === 'meal' ? 'New saved meal' : 'New recipe'), eyebrow: 'MEALS & RECIPES', size: 'tall', autofocus: rd.name ? null : '#rdname', render: renderRecipeEditor });
}
function renderRecipeEditor() {
  const t = recipeTotals(rd), s = Number(rd.servings) || 1, per = { kcal: t.kcal / s, protein: t.protein / s, carbs: t.carbs / s, fat: t.fat / s }, isMeal = rd.type === 'meal';
  return {
    body: `<div class="seg" role="radiogroup" aria-label="Type"><button type="button" role="radio" aria-checked="${!isMeal}" class="${!isMeal ? 'on' : ''}" data-act="rd.type" data-arg="recipe">Recipe<small>makes several servings</small></button><button type="button" role="radio" aria-checked="${isMeal}" class="${isMeal ? 'on' : ''}" data-act="rd.type" data-arg="meal">Saved meal<small>logged as one portion</small></button></div>
      <div class="field"><label for="rdname">Name</label><input id="rdname" data-in="rd" maxlength="60" placeholder="${isMeal ? 'e.g. Post-training rice bowl' : 'e.g. Turkey chilli'}" value="${esc(rd.name)}"></div>
      ${isMeal ? '' : `<div class="field"><label for="rdservings">Recipe yield — makes how many servings?</label><input id="rdservings" data-in="rd" type="number" inputmode="decimal" min="0.25" max="200" step="any" value="${esc(rd.servings)}"><div class="hint">Calories and macros are divided by this number to give values per serving.</div></div>`}
      <div class="between mt"><div class="eyebrow">INGREDIENTS · ${rd.ingredients.length}</div></div>
      <ul class="ing-list">${rd.ingredients.length ? rd.ingredients.map((i, ix) => { const n = ingNutr(i); return `<li><div class="grow min0"><strong>${esc(i.name)}</strong><small>${esc(ingLabel(i))} · ${Math.round(n.kcal)} kcal</small></div><button type="button" class="iconbtn" data-act="rd.editing" data-id="${ix}" aria-label="Edit quantity of ${esc(i.name)}">${icon('edit')}</button><button type="button" class="iconbtn" data-act="rd.deling" data-id="${ix}" aria-label="Remove ${esc(i.name)}">${icon('close')}</button></li>`; }).join('') : `<li class="empty-li">No ingredients yet. Add foods with quantities such as 2 tbsp, 1 whole or 250 g.</li>`}</ul>
      <button type="button" class="btn ghost full" data-act="rd.adding">${icon('plus')}Add ingredient</button>
      <div class="sumbox" id="rdsum" aria-live="polite">${recipeSummary(t, per, s, isMeal)}</div>
      <div class="field"><label for="rdnotes">Notes (optional)</label><textarea id="rdnotes" data-in="rd" rows="2" maxlength="400" placeholder="Method, tips…">${esc(rd.notes || '')}</textarea></div>`,
    footer: `${rd.id ? `<button type="button" class="btn critical" data-act="rd.delete" aria-label="Delete this ${isMeal ? 'meal' : 'recipe'}">${icon('trash')}</button>` : ''}<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="rd.save">Save ${isMeal ? 'meal' : 'recipe'}</button>`
  };
}
function recipeSummary(t, per, s, isMeal) {
  return `<div class="eyebrow">${isMeal ? 'WHOLE MEAL' : 'PER SERVING'}</div>${macroLine(isMeal ? t : per)}${isMeal ? '' : `<div class="tiny mt-s">Whole recipe: ${Math.round(t.kcal)} kcal · ${fmt(t.protein, 0)}g P · ${fmt(t.carbs, 0)}g C · ${fmt(t.fat, 0)}g F · ${fmt(s, 2)} servings</div>`}`;
}
const macroLine = v => `<div class="macroline"><b>${Math.round(v.kcal)}<small> kcal</small></b><span>${fmt(v.protein, 1)}g <small>protein</small></span><span>${fmt(v.carbs, 1)}g <small>carbs</small></span><span>${fmt(v.fat, 1)}g <small>fat</small></span></div>`;
INPUTS.rd = el => {
  if (el.id === 'rdname') rd.name = el.value; else if (el.id === 'rdnotes') rd.notes = el.value; else if (el.id === 'rdservings') rd.servings = el.value === '' ? '' : Number(el.value);
  const t = recipeTotals(rd), s = Number(rd.servings) > 0 ? Number(rd.servings) : 1; const box = $('#rdsum'); if (box) box.innerHTML = recipeSummary(t, { kcal: t.kcal / s, protein: t.protein / s, carbs: t.carbs / s, fat: t.fat / s }, s, rd.type === 'meal');
};
ACTIONS['rd.type'] = el => { rd.type = el.dataset.arg; if (rd.type === 'meal') rd.servings = 1; else if (!(rd.servings > 1)) rd.servings = 4; refreshSheet(); };
ACTIONS['rd.deling'] = el => { rd.ingredients.splice(Number(el.dataset.id), 1); refreshSheet(); };
ACTIONS['rd.save'] = () => {
  const name = (rd.name || '').trim(), servings = rd.type === 'meal' ? 1 : Number(rd.servings);
  if (!name) { toast('Give it a name'); return; } if (!rd.ingredients.length) { toast('Add at least one ingredient'); return; }
  if (!(servings >= 0.25 && servings <= 200)) { toast('Servings must be between 0.25 and 200'); return; }
  if (recipes().some(r => r.id !== rd.id && r.name.toLowerCase() === name.toLowerCase())) { toast('You already have one with that name. Choose another name.'); return; }
  const now = new Date().toISOString();
  if (rd.id) { const r = recipeById(rd.id); Object.assign(r, { name, type: rd.type, servings, notes: rd.notes || '', ingredients: deepCopy(rd.ingredients), updatedAt: now }); }
  else recipes().push({ id: uid(), name, type: rd.type, servings, notes: rd.notes || '', ingredients: deepCopy(rd.ingredients), createdAt: now, updatedAt: now });
  save(); closeAllSheets(); render(); toast(`${name} saved`);
};
ACTIONS['rd.delete'] = async () => {
  const r = recipeById(rd.id); if (!r) return;
  if (!await askConfirm({ title: `Delete “${r.name}”?`, message: '<p>Entries already in your food diary keep their saved nutrition and are not changed.</p>', confirmLabel: 'Delete', danger: true })) return;
  data.nutrition.recipes = recipes().filter(x => x.id !== r.id); save(); closeAllSheets(); render(); toast(`${r.name} deleted`);
};
ACTIONS['recipe.new'] = el => openRecipeEditor(null, { id: null, type: el?.dataset?.arg === 'meal' ? 'meal' : 'recipe', name: '', servings: el?.dataset?.arg === 'meal' ? 1 : 4, notes: '', ingredients: [] });
ACTIONS['recipe.edit'] = el => openRecipeEditor(el.dataset.id);
ACTIONS['recipe.dup'] = el => {
  const r = recipeById(el.dataset.id); if (!r) return; const now = new Date().toISOString(); let name = `Copy of ${r.name}`.slice(0, 60), n = 2; while (recipes().some(x => x.name.toLowerCase() === name.toLowerCase())) name = `Copy ${n++} of ${r.name}`.slice(0, 60);
  const copy = { ...deepCopy(r), id: uid(), name, createdAt: now, updatedAt: now, lastUsedAt: null, lastServings: null }; recipes().push(copy); save(); render(); toast(`Duplicated as “${name}”`); openRecipeEditor(copy.id);
};

/* ---------- ingredient picker ---------- */
let pick = { q: '' };
ACTIONS['rd.adding'] = () => { pick = { q: '' }; openSheet({ title: 'Add ingredient', eyebrow: 'CHOOSE A FOOD', size: 'tall', autofocus: '#iq', render: renderPicker }); };
function pickerResults(q) {
  q = q.trim().toLowerCase(); const out = [];
  const foods = foodMatches(q).map(f => `<button type="button" class="result" data-act="pick.food" data-id="${esc(f.id)}"><div class="grow"><strong>${esc(f.name)}</strong><small>${Math.round(f.kcal)} kcal per 100 g</small></div>${icon('chev')}</button>`);
  const prods = Object.values(data.nutrition.productCache || {}).filter(p => productHasMacros(p) && (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q))).slice(0, q ? 8 : 4).map(p => `<button type="button" class="result" data-act="pick.product" data-id="${esc(p.barcode)}"><div class="grow"><strong>${esc(p.name)}</strong> ${tag('Scanned', 'slate')}<small>${esc(p.brand || 'Packaged food')}</small></div>${icon('chev')}</button>`);
  const seen = new Set(); const logged = [...data.nutrition.entries].reverse().filter(e => !e.recipeId && !e.foodId && !e.barcode && (!q || e.name.toLowerCase().includes(q))).filter(e => { const k = e.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, q ? 8 : 3)
    .map(e => `<button type="button" class="result" data-act="pick.logged" data-id="${esc(e.id)}"><div class="grow"><strong>${esc(e.name)}</strong> ${tag('Logged before')}<small>${Math.round(e.kcal)} kcal as logged</small></div>${icon('chev')}</button>`);
  out.push(...prods, ...logged, ...foods);
  return out.length ? out.join('') : emptyBox('Nothing found. Try another name or add the ingredient manually.');
}
function renderPicker() {
  return { body: `<div class="field first"><label for="iq">Search ingredients</label><input id="iq" data-in="pickq" type="search" autocomplete="off" autocapitalize="none" placeholder="e.g. chicken breast, oats, olive oil" value="${esc(pick.q)}"></div>
    <div id="iresults" class="results mt">${pickerResults(pick.q)}</div><p class="note">Everyday foods support household measures (tablespoon, teaspoon, whole item…). Packaged foods you have scanned before appear here too.</p>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Back</button><button type="button" class="btn primary grow" data-act="pick.manual">Add manually</button>` };
}
INPUTS.pickq = el => { pick.q = el.value; const b = $('#iresults'); if (b) b.innerHTML = pickerResults(el.value); };
function addIngredientFromPortion(food, v, editIndex) {
  const ing = { id: uid(), name: food.name, source: food.kind, foodId: food.kind === 'everyday' ? food.id : undefined, barcode: food.barcode, per100: { ...food.per100 }, unit: v.unit, unitGrams: v.unit === 'g' ? 1 : Number(food.units[v.unit]), count: v.q };
  if (editIndex !== undefined && editIndex !== null) rd.ingredients[editIndex] = { ...rd.ingredients[editIndex], ...ing, id: rd.ingredients[editIndex].id }; else rd.ingredients.push(ing);
}
function portionForIngredient(food, existing, ix) {
  openPortion({ mode: 'ingredient', food, unit: existing?.unit || food.defaultUnit, qty: existing?.count ?? (food.defaultUnit === 'g' ? 100 : 1), editing: !!existing,
    onAdd: v => { addIngredientFromPortion(food, v, ix); closeSheet(); if (!existing) closeSheet(); refreshSheet(); } });
}
ACTIONS['pick.food'] = el => { const f = everydayById(el.dataset.id); if (f) portionForIngredient(foodLikeFromEveryday(f)); };
ACTIONS['pick.product'] = el => { const p = data.nutrition.productCache[el.dataset.id]; if (p) portionForIngredient(foodLikeFromProduct(p)); };
ACTIONS['pick.logged'] = el => {
  const e = data.nutrition.entries.find(x => x.id === el.dataset.id); if (!e) return;
  rd.ingredients.push({ id: uid(), name: e.name, source: 'logged', each: { kcal: Number(e.kcal) || 0, protein: Number(e.protein) || 0, carbs: Number(e.carbs) || 0, fat: Number(e.fat) || 0 }, unit: 'item', count: 1, labelText: 'as logged' });
  closeSheet(); refreshSheet();
};
ACTIONS['pick.manual'] = () => openIngredientManual();
function openIngredientManual(ix) {
  const cur = ix !== undefined ? rd.ingredients[ix] : null;
  openSheet({ title: cur ? 'Edit ingredient' : 'Manual ingredient', eyebrow: 'MEALS & RECIPES', size: 'tall', render: () => ({
    body: `<div class="field first"><label for="mi-name">Ingredient</label><input id="mi-name" maxlength="60" placeholder="e.g. Tinned chopped tomatoes" value="${esc(cur?.name || '')}"></div>
      <div class="field"><label for="mi-qty">Quantity (optional label)</label><input id="mi-qty" maxlength="30" placeholder="e.g. 1 tin, 2 slices" value="${esc(cur?.labelText && cur.labelText !== 'as logged' ? cur.labelText : '')}"></div>
      <p class="note">Enter nutrition for the <b>whole quantity</b> you use in the recipe.</p>
      <div class="form-row"><div class="field"><label for="mi-kcal">Calories (kcal)</label><input id="mi-kcal" type="number" inputmode="decimal" min="0" max="10000" step="any" value="${esc(cur?.each?.kcal ?? '')}"></div>
      <div class="field"><label for="mi-p">Protein (g)</label><input id="mi-p" type="number" inputmode="decimal" min="0" max="1000" step="any" value="${esc(cur?.each?.protein ?? '')}"></div>
      <div class="field"><label for="mi-c">Carbs (g)</label><input id="mi-c" type="number" inputmode="decimal" min="0" max="2000" step="any" value="${esc(cur?.each?.carbs ?? '')}"></div>
      <div class="field"><label for="mi-f">Fat (g)</label><input id="mi-f" type="number" inputmode="decimal" min="0" max="1000" step="any" value="${esc(cur?.each?.fat ?? '')}"></div></div>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="mi.save" data-arg="${ix ?? ''}">${cur ? 'Update' : 'Add ingredient'}</button>` }) });
}
ACTIONS['mi.save'] = el => {
  const name = $('#mi-name').value.trim(), v = ['kcal', 'p', 'c', 'f'].map(k => $('#mi-' + k).value === '' ? null : Number($('#mi-' + k).value));
  const macros = [v[1] || 0, v[2] || 0, v[3] || 0]; const kcal = v[0] !== null ? v[0] : macros[0] * 4 + macros[1] * 4 + macros[2] * 9;
  if (!name || v.some(x => x !== null && (!Number.isFinite(x) || x < 0)) || (kcal <= 0 && macros.every(x => x === 0))) { toast('Enter a name and some nutrition values'); return; }
  const ing = { id: uid(), name: name.slice(0, 60), source: 'manual', each: { kcal, protein: macros[0], carbs: macros[1], fat: macros[2] }, unit: 'item', count: 1, labelText: $('#mi-qty').value.trim().slice(0, 30) || 'as entered' };
  const ix = el.dataset.arg; if (ix !== '') rd.ingredients[Number(ix)] = { ...ing, id: rd.ingredients[Number(ix)].id }; else rd.ingredients.push(ing);
  closeSheet(); if (ix === '') closeSheet(); refreshSheet();
};
ACTIONS['rd.editing'] = el => {
  const ix = Number(el.dataset.id), i = rd.ingredients[ix]; if (!i) return;
  if (i.per100) {
    const food = i.source === 'product' || i.barcode ? { ...foodLikeFromProduct(data.nutrition.productCache[i.barcode] || { barcode: i.barcode, name: i.name, brand: '', per100: i.per100, serving: {}, servingQuantity: null }) } : (everydayById(i.foodId) ? foodLikeFromEveryday(everydayById(i.foodId)) : null);
    const f = food ? { ...food, per100: { ...i.per100 }, name: i.name } : { kind: 'everyday', id: i.foodId, name: i.name, per100: { ...i.per100 }, units: { g: 1, ...(i.unit !== 'g' ? { [i.unit]: i.unitGrams } : {}) }, defaultUnit: i.unit, note: 'Saved ingredient' };
    if (!f.units[i.unit] && i.unit !== 'g') f.units[i.unit] = i.unitGrams;
    portionForIngredient(f, i, ix);
  } else if (i.source === 'manual') openIngredientManual(ix);
  else openSheet({ title: i.name, eyebrow: 'EDIT QUANTITY', render: () => ({ body: `<div class="field first"><label for="iq-mult">Number of portions as logged</label><input id="iq-mult" type="number" inputmode="decimal" min="0.05" max="100" step="any" value="${esc(i.count)}"><div class="hint">1 portion = ${Math.round(i.each.kcal)} kcal · ${fmt(i.each.protein, 1)}g P · ${fmt(i.each.carbs, 1)}g C · ${fmt(i.each.fat, 1)}g F</div></div>`, footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="iq.save" data-arg="${ix}">Update</button>` }) });
};
ACTIONS['iq.save'] = el => { const n = Number($('#iq-mult').value); if (!(n > 0 && n <= 100)) { toast('Enter a valid quantity'); return; } rd.ingredients[Number(el.dataset.arg)].count = n; closeSheet(); refreshSheet(); };

/* ---------- save diary foods as a meal ---------- */
let sm = null;
ACTIONS['meal.fromdiary'] = el => {
  const date = ui.fuelDate, meal = el?.dataset?.arg || ''; const entries = foodsFor(date).filter(e => !e.recipeId);
  if (!entries.length) { toast('Nothing in the diary to save yet'); return; }
  sm = { date, checked: new Set(entries.filter(e => !meal || e.meal === meal).map(e => e.id)), name: meal ? `${meal} · ${pretty(date)}` : `Meal · ${pretty(date)}` };
  openSheet({ title: 'Save foods as a meal', eyebrow: pretty(date).toUpperCase(), size: 'tall', render: () => ({
    body: `<p class="lead first">Tick the foods that belong together. They are saved with their current quantities, ready to log again in one go.</p>
      <div class="field"><label for="smname">Meal name</label><input id="smname" data-in="smname" maxlength="60" value="${esc(sm.name)}"></div>
      <div class="checks">${entries.map(e => `<label class="check"><input type="checkbox" data-in="smcheck" data-id="${esc(e.id)}" ${sm.checked.has(e.id) ? 'checked' : ''}><span class="grow min0"><strong>${esc(e.name)}</strong><small>${esc(e.meal)} · ${Math.round(e.kcal)} kcal</small></span></label>`).join('')}</div>`,
    footer: `<button type="button" class="btn ghost" data-act="sheet.close">Cancel</button><button type="button" class="btn primary grow" data-act="meal.savefromdiary">Save meal</button>` }) });
};
INPUTS.smname = el => { sm.name = el.value; };
INPUTS.smcheck = el => { el.checked ? sm.checked.add(el.dataset.id) : sm.checked.delete(el.dataset.id); };
ACTIONS['meal.savefromdiary'] = () => {
  const name = (sm.name || '').trim(); const chosen = foodsFor(sm.date).filter(e => sm.checked.has(e.id));
  if (!name || !chosen.length) { toast('Choose a name and at least one food'); return; }
  if (recipes().some(r => r.name.toLowerCase() === name.toLowerCase())) { toast('You already have one with that name'); return; }
  const ings = chosen.map(e => {
    const food = e.foodId && everydayById(e.foodId);
    if (food && e.portionUnit && e.portionCount) { const fl = foodLikeFromEveryday(food); if (e.portionUnit === 'g' || fl.units[e.portionUnit]) return { id: uid(), name: e.name, source: 'everyday', foodId: food.id, per100: { ...fl.per100 }, unit: e.portionUnit, unitGrams: e.portionUnit === 'g' ? 1 : fl.units[e.portionUnit], count: e.portionCount }; }
    return { id: uid(), name: e.name, source: 'logged', each: { kcal: Number(e.kcal) || 0, protein: Number(e.protein) || 0, carbs: Number(e.carbs) || 0, fat: Number(e.fat) || 0 }, unit: 'item', count: 1, labelText: e.portionCount && e.portionUnit ? `${fmt(e.portionCount, 2)} ${SHORT_UNIT[e.portionUnit] || e.portionUnit}` : 'as logged' };
  });
  const now = new Date().toISOString(); recipes().push({ id: uid(), name: name.slice(0, 60), type: 'meal', servings: 1, notes: '', ingredients: ings, createdAt: now, updatedAt: now });
  save(); closeAllSheets(); render(); toast(`Saved “${name}”`);
};
