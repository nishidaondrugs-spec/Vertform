'use strict';
/* VERTFORM 2.62 — motion and touch feel. Soft page change, calorie count-up, reaction pop, light haptics.
   Everything here is cosmetic and switches itself off when the phone asks for reduced motion. */
(function () {
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 1. page change: a short fade-and-rise on the new screen */
  const _go = go;
  go = function (page, scrollTop) {
    const was = ui.page; _go.apply(this, arguments);
    if (!calm() && was !== ui.page) { const v = $('#view'); if (v) { v.classList.remove('pgin'); void v.offsetWidth; v.classList.add('pgin'); setTimeout(() => v.classList.remove('pgin'), 400); } }
  };
  /* 2. calorie number counts up to the new value */
  let lastKcal = null;
  const _render = render;
  render = function () {
    _render.apply(this, arguments);
    try {
      const b = document.querySelector('#view .ro-num b'); if (!b) { lastKcal = null; return; }
      const to = parseInt(b.textContent.replace(/[^0-9]/g, ''), 10); if (!Number.isFinite(to)) return;
      const from = lastKcal; lastKcal = to;
      if (calm() || from === null || from === to) return;
      const t0 = performance.now(), dur = 600;
      const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(from + (to - from) * e).toLocaleString('en-GB'); if (k < 1 && b.isConnected) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    } catch (_) { /* cosmetic only */ }
  };
  /* 3. reaction bubbles pop in the first time a post shows them */
  const popped = new Set();
  if (typeof rxPaint === 'function') {
    const _rx = rxPaint;
    rxPaint = function () {
      _rx.apply(this, arguments);
      if (calm()) return;
      document.querySelectorAll('.rxbubbles[data-id]').forEach(el => { const id = el.dataset.id; if (el.firstElementChild && !popped.has(id)) { popped.add(id); el.classList.add('rxpop'); } });
    };
  }
  /* 4. light haptics on the moments that matter (Android; iPhone ignores it) */
  const tick = (ms = 12) => { try { if (!calm() && navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* no haptics */ } };
  ['cr.toggle', 'wk.save', 'post.send', 'rcam.send', 'rcam.shot', 'scan.add', 'food.repeat', 'recipe.log', 'ys.save', 'wk.start'].forEach(k => {
    const f = ACTIONS[k]; if (typeof f !== 'function') return;
    ACTIONS[k] = function () { tick(k === 'wk.save' ? 25 : 12); return f.apply(this, arguments); };
  });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.tabbar button, .postfab')) tick(8); }, true);
})();
