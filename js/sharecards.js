'use strict';
/* VERTFORM 2.84 — share cards: your finished workout, or a session you send a friend, as a picture for Instagram, WhatsApp and the rest.
   Drawn on a canvas (1080 × 1350) and handed to the phone's share sheet; falls back to saving the image. Uses the text helpers from recap.js. */
const SC = { bg: '#0b0b0c', fg: '#ffffff', mute: '#8e8e93', acc: '#e5383b', line: 'rgba(255,255,255,.12)', gold: '#f2b84b' };
let scUi = { canvas: null, url: '', name: '', title: '', text: '', code: '' };

function scWrap(c, text, maxW, font) { c.font = font; const out = []; let cur = ''; for (const w of String(text).split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }
function scFrame(c, tag, right) {
  c.fillStyle = SC.bg; c.fillRect(0, 0, 1080, 1350);
  const g = c.createRadialGradient(1000, 40, 20, 1000, 40, 760); g.addColorStop(0, 'rgba(229,56,59,.30)'); g.addColorStop(1, 'rgba(229,56,59,0)'); c.fillStyle = g; c.fillRect(0, 0, 1080, 1350);
  rcText(c, 'VERT', 90, 140, 38, { col: SC.fg, sp: 6, w: 900 }); const wv = c.measureText('VERT').width + 24; rcText(c, '/', 90 + wv, 140, 38, { col: SC.acc, w: 900 }); rcText(c, 'FORM', 90 + wv + 26, 140, 38, { col: SC.fg, sp: 6, w: 900 });
  if (right) rcText(c, right, 990, 140, 30, { col: SC.mute, al: 'right', sp: 4, w: 700 });
  rcText(c, tag, 90, 262, 34, { col: SC.acc, sp: 7, w: 900 });
}
function scTitle(c, title, emoji, y) {
  const font = `900 104px ${RF}`; let lines = scWrap(c, title, 900 - (emoji ? 130 : 0), font), size = 104;
  if (lines.length > 2) { size = 80; lines = scWrap(c, title, 900, `900 80px ${RF}`); }
  lines = lines.slice(0, 2); let x = 90;
  if (emoji) { c.font = `92px ${EF}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = '#fff'; c.fillText(emoji, 90, y); x = 90 + 124; }
  lines.forEach((t, i) => rcText(c, t, i === 0 ? x : 90, y + i * (size + 12), size, { col: SC.fg, w: 900, sp: -3 }));
  return y + (lines.length - 1) * (size + 12);
}
function scRows(c, rows, y0, maxRows, tail) {
  const shown = rows.slice(0, maxRows), pitch = Math.min(78, Math.floor((1210 - y0) / Math.max(1, shown.length)));
  shown.forEach((r, i) => {
    const y = y0 + i * pitch; if (i) { c.fillStyle = SC.line; c.fillRect(90, y - pitch + 26, 900, 2); }
    let name = String(r[0]); c.font = `700 40px ${RF}`; while (c.measureText(name).width > 560 && name.length > 4) name = name.slice(0, -2);
    if (name !== String(r[0])) name = name.trimEnd() + '…';
    rcText(c, name, 90, y + 12, 40, { col: SC.fg, w: 700 });
    let right = String(r[1] || ''); c.font = `600 36px ${RF}`; const rx = r[2] ? 900 : 990;
    rcText(c, right, rx, y + 12, 36, { col: SC.mute, al: 'right', w: 600 });
    if (r[2]) { c.font = `900 24px ${RF}`; const w = 58; rcRound(c, 990 - w + 2, y - 22, w, 40, 20); c.fillStyle = SC.gold; c.fill(); rcText(c, 'PB', 990 - w / 2 + 2, y + 6, 24, { col: '#000', al: 'center', w: 900 }); }
  });
  if (rows.length > shown.length) rcText(c, `+ ${rows.length - shown.length} more`, 90, y0 + shown.length * pitch + 12, 32, { col: SC.mute, w: 600 });
}
function drawWorkoutCard(c, m, label) {
  scFrame(c, 'WORKOUT', label);
  const yEnd = scTitle(c, m.t, '', 392);
  const n = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
  const stats = [n(m.min) && [String(n(m.min)), 'MIN'], n(m.vol) && [Math.round(n(m.vol)).toLocaleString('en-GB'), 'KG'], [String(Number(m.s) || 0), 'SETS'], n(m.pb) && [String(n(m.pb)), n(m.pb) === 1 ? 'PB' : 'PBS']].filter(Boolean);
  const sy = yEnd + 130; stats.forEach(([v, l], i) => { const w = 900 / stats.length; rcText(c, v, 90 + w * i, sy, 84, { col: l.startsWith('PB') ? SC.gold : SC.fg, w: 900, sp: -2 }); rcText(c, l, 90 + w * i, sy + 44, 24, { col: SC.mute, sp: 3, w: 700 }); });
  c.fillStyle = SC.line; c.fillRect(90, sy + 90, 900, 2);
  const rows = Array.isArray(m.l) ? m.l : [];
  scRows(c, rows, sy + 170, 9);
  rcText(c, 'Tracked in VERTFORM', 90, 1288, 30, { col: SC.mute, w: 700 });
}
function drawSessionCard(c, p) {
  scFrame(c, 'SESSION', 'SHARED WITH YOU');
  const yEnd = scTitle(c, p.t, p.e || '', 392);
  const meta = `${p.x.length} ${p.x.length === 1 ? 'exercise' : 'exercises'}${p.m ? ` · about ${p.m} min` : ''}`;
  rcText(c, meta, 90, yEnd + 64, 38, { col: SC.mute, w: 600 });
  c.fillStyle = SC.line; c.fillRect(90, yEnd + 110, 900, 2);
  const rows = p.x.map(r => [r[0], `${r[1]} × ${r[2]}${r[3] && r[3] !== 'reps' && /^[\d–-]+$/.test(String(r[2])) ? ' ' + (r[3] === 'seconds' ? 'sec' : r[3]) : ''}`, 0]);
  scRows(c, rows, yEnd + 190, 9);
  rcText(c, 'Open it in VERTFORM', 90, 1288, 30, { col: SC.mute, w: 700 });
}

function scOpen({ title, eyebrow, draw, name, text, code, shareTitle }) {
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350; draw(cv.getContext('2d'));
  scUi = { canvas: cv, url: cv.toDataURL('image/png'), name, title: shareTitle || title, text: text || '', code: code || '' };
  openSheet({ title, eyebrow, size: 'tall', render: () => ({ body: `<img class="scprev" src="${scUi.url}" alt="Preview of the card you are about to share">`,
    footer: `${scUi.code ? `<button type="button" class="btn ghost" data-act="sc.copy">Copy code</button>` : ''}<button type="button" class="btn primary grow" data-act="sc.share">${icon('upload')}Share</button>` }) });
}
ACTIONS['sc.copy'] = async () => { try { await navigator.clipboard.writeText(scUi.code); toast('Code copied'); } catch (_) { prompt('Copy this code', scUi.code); } };
ACTIONS['sc.share'] = () => {
  const cv = scUi.canvas; if (!cv) return;
  cv.toBlob(async blob => {
    if (!blob) { toast('Could not make the image'); return; }
    const file = new File([blob], scUi.name, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: scUi.title, text: scUi.text || undefined }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { if (navigator.share && scUi.text) { await navigator.share({ title: scUi.title, text: scUi.text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Image saved');
  }, 'image/png');
};

/* your workout, from History or a day on the plan */
ACTIONS['log.share'] = el => {
  const l = data.logs.find(x => x.id === el.dataset.id); if (!l) return;
  const m = wkSummary(l), d = parseDate(l.date), lab = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase().replace(',', '');
  scOpen({ title: 'Share workout', eyebrow: lab, name: `vertform-${l.date}.png`, shareTitle: m.t, draw: c => drawWorkoutCard(c, m, lab) });
};
