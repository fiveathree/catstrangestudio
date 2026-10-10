/* 裝修 3D 規劃：平面編輯（SVG）＋ 3D 預覽（three.js）。單位一律係米；平面 y 向下，對應 3D 嘅 z。 */
(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var KEY = 'reno-planner-v1', PING = 3.305785;

/* ---------- 物件目錄 ---------- */
var CAT = {
  socket110: { n: '插座 110V', g: 'util', c: '#E8890C', ab: '110', z: 0.3, wall: 1, line: 'elec' },
  socket220: { n: '插座 220V 專線', g: 'util', c: '#D1432F', ab: '220', z: 0.3, wall: 1, line: 'elec' },
  sw:        { n: '開關', g: 'util', c: '#8A6A00', ab: '開', z: 1.2, wall: 1, line: 'elec' },
  light:     { n: '燈位', g: 'util', c: '#C99A00', ab: '燈', z: 0, ceil: 1 },
  net:       { n: '網路／弱電', g: 'util', c: '#2E8B57', ab: '網', z: 0.3, wall: 1, line: 'elec' },
  water:     { n: '給水（冷）', g: 'util', c: '#1E78D6', ab: '冷', z: 0.5, wall: 1, line: 'pipe' },
  hot:       { n: '給水（熱）', g: 'util', c: '#C2255C', ab: '熱', z: 0.5, wall: 1, line: 'pipe' },
  drain:     { n: '排水', g: 'util', c: '#5B6470', ab: '排', z: 0, floor: 1 },
  gas:       { n: '瓦斯', g: 'util', c: '#B08900', ab: '瓦', z: 0.5, wall: 1, line: 'pipe' },
  vent:      { n: '排氣口', g: 'util', c: '#6B4FBB', ab: '風', z: 2.2, wall: 1 },
  door:      { n: '門', g: 'open', c: '#8A5A2B', w: 0.9, h: 2.1, z: 0, wall: 1 },
  window:    { n: '窗', g: 'open', c: '#58A9E0', w: 1.2, h: 1.2, z: 0.9, wall: 1 },
  ac:        { n: '冷氣室內機', g: 'furn', c: '#E9EEF2', w: 0.85, d: 0.22, h: 0.3, z: 2.2, wall: 1 },
  heater:    { n: '熱水器', g: 'furn', c: '#DADFE4', w: 0.45, d: 0.25, h: 0.7, z: 1.3, wall: 1 },
  fridge:    { n: '冰箱', g: 'furn', c: '#D5DBE0', w: 0.7, d: 0.7, h: 1.8, z: 0 },
  washer:    { n: '洗衣機', g: 'furn', c: '#EEF1F3', w: 0.6, d: 0.6, h: 0.85, z: 0 },
  sinkc:     { n: '水槽櫃', g: 'furn', c: '#B9C2C9', w: 1.2, d: 0.6, h: 0.85, z: 0 },
  stove:     { n: '爐台', g: 'furn', c: '#4A4F55', w: 0.8, d: 0.6, h: 0.85, z: 0 },
  toilet:    { n: '馬桶', g: 'furn', c: '#F2F2EE', w: 0.4, d: 0.7, h: 0.42, z: 0 },
  table:     { n: '桌', g: 'furn', c: '#B98F62', w: 1.4, d: 0.8, h: 0.75, z: 0 },
  cabinet:   { n: '櫃', g: 'furn', c: '#A88762', w: 1.0, d: 0.45, h: 2.0, z: 0 },
  bed:       { n: '床', g: 'furn', c: '#D8D2C6', w: 1.5, d: 1.9, h: 0.45, z: 0 },
  sofa:      { n: '沙發', g: 'furn', c: '#8C97A3', w: 1.8, d: 0.85, h: 0.75, z: 0 },
  box:       { n: '自訂方塊', g: 'furn', c: '#9AA7B4', w: 0.6, d: 0.6, h: 0.9, z: 0 }
};

/* ---------- 質感（用 canvas 畫出來嘅貼圖） ---------- */
function rng(seed) { var a = 0; for (var i = 0; i < seed.length; i++) a = (a * 31 + seed.charCodeAt(i)) | 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function speck(c, r, n, a, col) { for (var i = 0; i < n; i++) { c.fillStyle = 'rgba(' + col + ',' + (r() * a).toFixed(3) + ')'; var s = 1 + r() * 3; c.fillRect(r() * 256, r() * 256, s, s); } }
function planks(c, r, rows, lineCol) {
  var h = 256 / rows;
  for (var i = 0; i < rows; i++) {
    c.fillStyle = 'rgba(0,0,0,' + (r() * 0.10).toFixed(3) + ')'; c.fillRect(0, i * h, 256, h);
    c.fillStyle = lineCol; c.fillRect(0, i * h, 256, 1.2);
    var j = r() * 256; c.fillRect(j, i * h, 1.2, h);
    for (var k = 0; k < 5; k++) { c.fillStyle = 'rgba(0,0,0,0.05)'; c.fillRect(0, i * h + r() * h, 256, 0.7); }
  }
}
function tiles(c, n, col, w) { c.fillStyle = col; for (var i = 0; i < n; i++) { c.fillRect(i * 256 / n, 0, w, 256); c.fillRect(0, i * 256 / n, 256, w); } }
var MAT = {
  floor: [
    { id: 'oak', n: '橡木', col: '#C9A476', size: 1.2, draw: function (c, r) { planks(c, r, 8, 'rgba(70,45,20,.45)'); } },
    { id: 'walnut', n: '胡桃木', col: '#6E4B33', size: 1.2, draw: function (c, r) { planks(c, r, 8, 'rgba(20,10,5,.55)'); } },
    { id: 'concrete', n: '水泥', col: '#A7A9A8', size: 2, draw: function (c, r) { speck(c, r, 2600, 0.10, '0,0,0'); speck(c, r, 1800, 0.10, '255,255,255'); } },
    { id: 'tile', n: '淺色磁磚', col: '#ECEAE4', size: 1.2, draw: function (c, r) { speck(c, r, 500, 0.05, '0,0,0'); tiles(c, 2, '#B9B6AE', 2.5); } },
    { id: 'darktile', n: '深色磁磚', col: '#3B3E43', size: 1.2, draw: function (c, r) { speck(c, r, 700, 0.08, '255,255,255'); tiles(c, 2, '#1F2124', 2.5); } },
    { id: 'terrazzo', n: '磨石子', col: '#E4DFD5', size: 1.5, draw: function (c, r) { var cs = ['120,110,100', '190,120,90', '90,110,120', '60,60,60']; for (var i = 0; i < 420; i++) { c.fillStyle = 'rgba(' + cs[i % 4] + ',.75)'; c.beginPath(); c.ellipse(r() * 256, r() * 256, 1 + r() * 4, 1 + r() * 2.5, r() * 3, 0, 6.3); c.fill(); } } },
    { id: 'epoxy', n: '環氧地坪', col: '#C3C9CD', size: 2, draw: function (c, r) { speck(c, r, 600, 0.05, '0,0,0'); } },
    { id: 'marble', n: '大理石', col: '#EFEEEA', size: 1.6, draw: function (c, r) { for (var i = 0; i < 9; i++) { c.strokeStyle = 'rgba(110,115,125,' + (0.12 + r() * 0.2).toFixed(2) + ')'; c.lineWidth = 0.6 + r() * 1.6; c.beginPath(); var x = r() * 256, y = 0; c.moveTo(x, y); while (y < 256) { x += (r() - 0.5) * 60; y += 20 + r() * 30; c.lineTo(x, y); } c.stroke(); } tiles(c, 1, '#C9C8C2', 2); } }
  ],
  wall: [
    { id: 'white', n: '白色乳膠漆', col: '#F4F3EF', size: 2 },
    { id: 'warm', n: '米白', col: '#EBE1D0', size: 2 },
    { id: 'plaster', n: '灰泥', col: '#CFC8BC', size: 2, draw: function (c, r) { speck(c, r, 3000, 0.07, '0,0,0'); speck(c, r, 2200, 0.09, '255,255,255'); } },
    { id: 'concrete', n: '清水模', col: '#A2A5A4', size: 1.8, draw: function (c, r) { speck(c, r, 2600, 0.09, '0,0,0'); speck(c, r, 1500, 0.08, '255,255,255'); tiles(c, 2, 'rgba(60,62,64,.5)', 1.5); c.fillStyle = 'rgba(50,52,54,.6)'; [32, 96, 160, 224].forEach(function (x) { [40, 168].forEach(function (y) { c.beginPath(); c.arc(x, y, 3, 0, 6.3); c.fill(); }); }); } },
    { id: 'brick', n: '紅磚', col: '#C9C2B6', size: 1, draw: function (c, r) { for (var row = 0; row < 8; row++) for (var k = -1; k < 4; k++) { c.fillStyle = 'rgb(' + (150 + r() * 40 | 0) + ',' + (72 + r() * 24 | 0) + ',' + (52 + r() * 18 | 0) + ')'; c.fillRect(k * 64 + (row % 2 ? 32 : 0) + 2, row * 32 + 2, 60, 28); } } },
    { id: 'wood', n: '木格柵', col: '#B98F62', size: 1, draw: function (c, r) { for (var i = 0; i < 16; i++) { c.fillStyle = 'rgba(0,0,0,' + (r() * 0.10).toFixed(3) + ')'; c.fillRect(i * 16, 0, 16, 256); c.fillStyle = 'rgba(50,30,12,.55)'; c.fillRect(i * 16, 0, 2.5, 256); } } },
    { id: 'subway', n: '白色小磚', col: '#F1F1EE', size: 0.8, draw: function (c) { c.fillStyle = '#B5B8B8'; for (var row = 0; row < 8; row++) { c.fillRect(0, row * 32, 256, 2); for (var k = 0; k < 5; k++) c.fillRect(k * 64 + (row % 2 ? 32 : 0), row * 32, 2, 32); } } },
    { id: 'charcoal', n: '炭黑', col: '#2B2E32', size: 2, draw: function (c, r) { speck(c, r, 900, 0.05, '255,255,255'); } }
  ],
  ceil: [
    { id: 'white', n: '白色', col: '#FAFAF7', size: 2 },
    { id: 'same', n: '同牆身', col: '#CFC8BC', size: 2 },
    { id: 'dark', n: '深色', col: '#2A2C2F', size: 2 },
    { id: 'wood', n: '木天花', col: '#C9A476', size: 1.2, draw: function (c, r) { planks(c, r, 8, 'rgba(70,45,20,.45)'); } }
  ]
};
function canv(def) { if (def._c) return def._c; var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d'); x.fillStyle = def.col; x.fillRect(0, 0, 256, 256); if (def.draw) def.draw(x, rng(def.id + def.n)); def._c = c; return c; }
function matDef(kind, id) { var l = MAT[kind]; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return l[0]; }

/* ---------- 狀態 ---------- */
var S, sel = null, tool = 'select', hist = [], lastSrc = null, uid = 0;
function nid() { return 'i' + Date.now().toString(36) + (uid++); }
function blank() { return { v: 1, room: { w: 6, d: 4, h: 2.8, shell: true }, mats: { floor: 'oak', wall: 'white', ceil: 'white' }, walls: [], items: [], bg: null }; }
function mk(t, x, y, extra) { var c = CAT[t], it = { id: nid(), t: t, x: x, y: y, rot: 0, z: c.z }; if (c.w) { it.w = c.w; it.h = c.h; } if (c.d) it.d = c.d; if (extra) for (var k in extra) it[k] = extra[k]; return it; }
function sample() {
  var s = blank();
  s.items = [
    mk('door', 0, 3.3, { n: [1, 0], rot: 90 }), mk('window', 2.6, 0, { n: [0, 1], rot: 0 }),
    mk('sinkc', 4.3, 0.32), mk('water', 4.1, 0, { n: [0, 1] }), mk('hot', 4.3, 0, { n: [0, 1] }), mk('drain', 4.5, 0.3),
    mk('fridge', 5.6, 0.4), mk('socket110', 5.6, 0, { n: [0, 1] }), mk('socket220', 6, 2.6, { n: [-1, 0], rot: 90 }),
    mk('sw', 0, 2.6, { n: [1, 0], rot: 90 }), mk('light', 1.8, 2), mk('light', 4.3, 2),
    mk('table', 2.2, 2.3), mk('ac', 3, 4, { n: [0, -1], rot: 0 }), mk('cabinet', 1.1, 0.25), mk('net', 1.4, 4, { n: [0, -1] })
  ];
  return s;
}
function snap() { return JSON.stringify(S, function (k, v) { return k === 'src' ? undefined : v; }); }
function push() { hist.push(snap()); if (hist.length > 60) hist.shift(); }
function undo() { if (!hist.length) return; if (S.bg && S.bg.src) lastSrc = S.bg.src; S = JSON.parse(hist.pop()); if (S.bg) S.bg.src = lastSrc; sel = null; syncInputs(); changed(); }
var saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { try { localStorage.setItem(KEY, snap()); } catch (e2) { /* 儲存空間用唔到就算 */ } } }, 400); }
function load() { try { var j = localStorage.getItem(KEY); if (j) { var o = JSON.parse(j); if (o && o.room && o.items) { if (o.bg && !o.bg.src) o.bg = null; return o; } } } catch (e) { /* 忽略 */ } return null; }

/* ---------- 幾何 ---------- */
function g5(v) { return Math.round(v * 20) / 20; }
function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
function segs() { var R = S.room, a = []; if (R.shell) { a.push({ x1: 0, y1: 0, x2: R.w, y2: 0, shell: 1 }, { x1: R.w, y1: 0, x2: R.w, y2: R.d, shell: 1 }, { x1: R.w, y1: R.d, x2: 0, y2: R.d, shell: 1 }, { x1: 0, y1: R.d, x2: 0, y2: 0, shell: 1 }); } S.walls.forEach(function (w) { a.push(w); }); return a; }
function bounds() { var R = S.room; if (R.shell || !S.walls.length) { var b = { x0: 0, y0: 0, x1: R.w, y1: R.d }; if (R.shell) S.walls.forEach(function (w) { b.x0 = Math.min(b.x0, w.x1, w.x2); b.y0 = Math.min(b.y0, w.y1, w.y2); b.x1 = Math.max(b.x1, w.x1, w.x2); b.y1 = Math.max(b.y1, w.y1, w.y2); }); return b; } var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; S.walls.forEach(function (w) { x0 = Math.min(x0, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2); x1 = Math.max(x1, w.x1, w.x2); y1 = Math.max(y1, w.y1, w.y2); }); if (x1 - x0 < 0.5) x1 = x0 + 0.5; if (y1 - y0 < 0.5) y1 = y0 + 0.5; return { x0: x0, y0: y0, x1: x1, y1: y1 }; }
function snapWall(it, px, py, force) {
  var best = null;
  segs().forEach(function (s) { var dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = Math.hypot(dx, dy); if (L < 0.01) return; var t = ((px - s.x1) * dx + (py - s.y1) * dy) / (L * L); t = Math.max(0, Math.min(1, t)); t = Math.round(t * L * 20) / 20 / L; t = Math.max(0, Math.min(1, t)); var qx = s.x1 + dx * t, qy = s.y1 + dy * t, d = Math.hypot(px - qx, py - qy); if (!best || d < best.d) best = { d: d, qx: qx, qy: qy, ux: dx / L, uy: dy / L, s: s }; });
  if (best && (force || best.d < 0.45)) {
    var nx = -best.uy, ny = best.ux, b = bounds(), rx = (b.x0 + b.x1) / 2, ry = (b.y0 + b.y1) / 2, ref;
    if (best.s.shell || best.d < 0.02) ref = (rx - best.qx) * nx + (ry - best.qy) * ny; else ref = (px - best.qx) * nx + (py - best.qy) * ny;
    if (ref < 0) { nx = -nx; ny = -ny; }
    it.x = +best.qx.toFixed(3); it.y = +best.qy.toFixed(3); it.n = [+nx.toFixed(4), +ny.toFixed(4)]; it.rot = Math.round(Math.atan2(best.uy, best.ux) * 180 / Math.PI); it.thk = best.s.shell ? 0 : 0.05;
  } else { it.x = g5(px); it.y = g5(py); it.n = null; it.thk = 0; }
}
function center(it) { var c = CAT[it.t]; if (c.wall && c.g === 'furn' && it.n) { var o = (it.d || 0) / 2 + (it.thk || 0); return { x: it.x + it.n[0] * o, y: it.y + it.n[1] * o }; } return { x: it.x, y: it.y }; }
function doorSide(it) { if (!it.n) return 1; var r = it.rot * Math.PI / 180; return (-Math.sin(r) * it.n[0] + Math.cos(r) * it.n[1]) >= 0 ? 1 : -1; }
function byId(id) { for (var i = 0; i < S.items.length; i++) if (S.items[i].id === id) return S.items[i]; return null; }

/* ---------- 平面（SVG） ---------- */
var svg = $('plan'), V = { x: -1, y: -1, w: 8 }, draft = null, cal = null, hover = null;
function upp() { return V.w / (svg.clientWidth || 600); }
function fit() { var b = bounds(), cw = svg.clientWidth || 600, ch = svg.clientHeight || 400; if (S.bg && S.bg.show) { b = { x0: Math.min(b.x0, S.bg.x), y0: Math.min(b.y0, S.bg.y), x1: Math.max(b.x1, S.bg.x + S.bg.pw * S.bg.scale), y1: Math.max(b.y1, S.bg.y + S.bg.ph * S.bg.scale) }; } var w = b.x1 - b.x0, h = b.y1 - b.y0, m = 1.25; V.w = Math.max(w * m, h * m * cw / ch, 2); var vh = V.w * ch / cw; V.x = b.x0 - (V.w - w) / 2; V.y = b.y0 - (vh - h) / 2; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function draw2d() {
  var u = upp(), cw = svg.clientWidth || 600, ch = svg.clientHeight || 400, vh = V.w * ch / cw, R = S.room, o = [], fs = 11.5 * u;
  svg.setAttribute('viewBox', V.x + ' ' + V.y + ' ' + V.w + ' ' + vh);
  o.push('<defs><pattern id="gr" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="var(--grid)" stroke-width="' + u + '"/></pattern></defs>');
  o.push('<rect x="' + V.x + '" y="' + V.y + '" width="' + V.w + '" height="' + vh + '" fill="url(#gr)"/>');
  if (S.bg && S.bg.show && S.bg.src) o.push('<image href="' + S.bg.src + '" x="' + S.bg.x + '" y="' + S.bg.y + '" width="' + S.bg.pw * S.bg.scale + '" height="' + S.bg.ph * S.bg.scale + '" opacity="' + S.bg.op + '" preserveAspectRatio="none"/>');
  if (R.shell) {
    o.push('<rect x="0" y="0" width="' + R.w + '" height="' + R.d + '" fill="none" stroke="var(--wall)" stroke-width="0.12"/>');
    o.push('<text x="' + R.w / 2 + '" y="' + (-0.12 - 6 * u) + '" font-size="' + fs + '" text-anchor="middle" fill="var(--dim)">長 ' + f2(R.w) + ' m</text>');
    o.push('<text transform="translate(' + (-0.12 - 6 * u) + ',' + R.d / 2 + ') rotate(-90)" font-size="' + fs + '" text-anchor="middle" fill="var(--dim)">闊 ' + f2(R.d) + ' m</text>');
  }
  S.walls.forEach(function (w) {
    var on = sel && sel.wall === w.id, L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
    o.push('<line data-wall="' + w.id + '" x1="' + w.x1 + '" y1="' + w.y1 + '" x2="' + w.x2 + '" y2="' + w.y2 + '" stroke="' + (on ? 'var(--sel)' : 'var(--wall)') + '" stroke-width="0.1" stroke-linecap="square"/>');
    o.push('<line data-wall="' + w.id + '" x1="' + w.x1 + '" y1="' + w.y1 + '" x2="' + w.x2 + '" y2="' + w.y2 + '" stroke="transparent" stroke-width="' + Math.max(0.1, 14 * u) + '"/>');
    var ox = L > 0 ? (w.y2 - w.y1) / L : 0, oy = L > 0 ? -(w.x2 - w.x1) / L : -1; if (oy > 0 || (oy === 0 && ox < 0)) { ox = -ox; oy = -oy; }
    o.push('<text x="' + (mx + ox * (0.1 + 14 * u)) + '" y="' + (my + oy * (0.1 + 8 * u) + fs * 0.35) + '" font-size="' + fs * 0.92 + '" text-anchor="middle" fill="var(--dim)">' + f2(L) + '</text>');
  });
  S.items.forEach(function (it) {
    var c = CAT[it.t], on = sel && sel.id === it.id, st = on ? 'var(--sel)' : 'var(--ink)', sw = (on ? 2.4 : 1) * u, p = center(it), nm = esc(it.label || c.n);
    if (c.g === 'util') {
      var r = Math.max(0.1, 8.5 * u);
      o.push('<g data-id="' + it.id + '"><circle cx="' + it.x + '" cy="' + it.y + '" r="' + Math.max(r, 13 * u) + '" fill="transparent"/><circle cx="' + it.x + '" cy="' + it.y + '" r="' + r + '" fill="' + c.c + '" stroke="' + (on ? 'var(--sel)' : '#fff') + '" stroke-width="' + (on ? 3 : 1.2) * u + '"/><text x="' + it.x + '" y="' + (it.y + r * 0.36) + '" font-size="' + r * 0.95 + '" font-weight="700" text-anchor="middle" fill="#fff">' + c.ab + '</text></g>');
    } else if (c.g === 'open') {
      o.push('<g data-id="' + it.id + '" transform="translate(' + it.x + ',' + it.y + ') rotate(' + it.rot + ')"><rect x="' + -it.w / 2 + '" y="-0.1" width="' + it.w + '" height="0.2" fill="' + (it.t === 'door' ? '#C89B6A' : '#BFE3FA') + '" stroke="' + st + '" stroke-width="' + sw + '"/>' + (it.t === 'door' ? '<path d="M' + -it.w / 2 + ' 0.1 A' + it.w + ' ' + it.w + ' 0 0 0 ' + it.w / 2 + ' ' + (0.1 + it.w) + '" fill="none" stroke="var(--dim)" stroke-dasharray="' + 4 * u + '" stroke-width="' + u + '" transform="scale(1,' + doorSide(it) + ')"/>' : '') + '</g>');
    } else {
      o.push('<g data-id="' + it.id + '" transform="translate(' + p.x + ',' + p.y + ') rotate(' + it.rot + ')"><rect x="' + -it.w / 2 + '" y="' + -it.d / 2 + '" width="' + it.w + '" height="' + it.d + '" fill="' + c.c + '" fill-opacity="0.55" stroke="' + st + '" stroke-width="' + sw + '"/></g>');
      o.push('<text x="' + p.x + '" y="' + (p.y + fs * 0.35) + '" font-size="' + fs + '" text-anchor="middle" fill="var(--ink)">' + nm + '</text>');
    }
  });
  if (draft) { o.push('<circle cx="' + draft.x + '" cy="' + draft.y + '" r="' + 4 * u + '" fill="var(--blue)"/>'); if (hover) { o.push('<line x1="' + draft.x + '" y1="' + draft.y + '" x2="' + hover.x + '" y2="' + hover.y + '" stroke="var(--blue)" stroke-width="0.1" stroke-opacity="0.6"/>'); o.push('<text x="' + (draft.x + hover.x) / 2 + '" y="' + ((draft.y + hover.y) / 2 - 8 * u) + '" font-size="' + fs + '" text-anchor="middle" fill="var(--blue)" font-weight="700">' + f2(Math.hypot(hover.x - draft.x, hover.y - draft.y)) + ' m</text>'); } }
  if (cal) { [cal.a, cal.b].forEach(function (p) { if (p) o.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="' + 5 * u + '" fill="var(--sel)" stroke="#fff" stroke-width="' + u + '"/>'); }); if (cal.a && cal.b) o.push('<line x1="' + cal.a.x + '" y1="' + cal.a.y + '" x2="' + cal.b.x + '" y2="' + cal.b.y + '" stroke="var(--sel)" stroke-width="' + 2 * u + '"/>'); }
  svg.innerHTML = o.join('');
}
function pt(e) { var r = svg.getBoundingClientRect(), u = upp(); return { x: V.x + (e.clientX - r.left) * u, y: V.y + (e.clientY - r.top) * u }; }
function wallPt(p) {
  var q = { x: g5(p.x), y: g5(p.y) }, best = 0.2, pts = [];
  segs().forEach(function (s) { pts.push([s.x1, s.y1], [s.x2, s.y2]); });
  if (draft && $('ortho').checked) { if (Math.abs(p.x - draft.x) >= Math.abs(p.y - draft.y)) q.y = draft.y; else q.x = draft.x; }
  pts.forEach(function (a) { var d = Math.hypot(a[0] - p.x, a[1] - p.y); if (d < best) { best = d; q = { x: a[0], y: a[1] }; } });
  return q;
}
var ptrs = {}, np = 0, down = null, drag = null, pinch = null;
svg.addEventListener('pointerdown', function (e) {
  try { svg.setPointerCapture(e.pointerId); } catch (x) { /* 忽略 */ }
  ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; np = Object.keys(ptrs).length;
  if (np === 2) { var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: V.w, c: pt({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }) }; drag = null; return; }
  var p = pt(e); down = { cx: e.clientX, cy: e.clientY, moved: false };
  drag = { k: 'pan', vx: V.x, vy: V.y };
  if (tool === 'select') {
    var g = e.target.closest && e.target.closest('[data-id]'), w = e.target.closest && e.target.closest('[data-wall]');
    if (g) { var it = byId(g.getAttribute('data-id')); if (it) { sel = { id: it.id }; push(); drag = { k: 'item', it: it, dx: p.x - it.x, dy: p.y - it.y }; syncSel(); $('side').scrollTop = 0; draw2d(); } }
    else if (w) { sel = { wall: w.getAttribute('data-wall') }; down.hit = 1; syncSel(); draw2d(); }
  } else if (tool === 'bg' && S.bg) { push(); drag = { k: 'bg', dx: p.x - S.bg.x, dy: p.y - S.bg.y }; }
});
svg.addEventListener('pointermove', function (e) {
  if (ptrs[e.pointerId]) ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (pinch && np === 2) { var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1; zoomTo(pinch.w * pinch.d / d, pinch.c, (a.x + b.x) / 2, (a.y + b.y) / 2); draw2d(); return; }
  var p = pt(e);
  if (tool === 'wall' && draft) { hover = wallPt(p); if (!drag) draw2d(); }
  if (!drag || !down) return;
  if (Math.hypot(e.clientX - down.cx, e.clientY - down.cy) > 4) down.moved = true;
  if (!down.moved) return;
  if (drag.k === 'pan') { var u = upp(); V.x = drag.vx - (e.clientX - down.cx) * u; V.y = drag.vy - (e.clientY - down.cy) * u; draw2d(); }
  else if (drag.k === 'item') { var it = drag.it, px = p.x - drag.dx, py = p.y - drag.dy; if (CAT[it.t].wall) snapWall(it, px, py); else { it.x = g5(px); it.y = g5(py); } changed(true); }
  else if (drag.k === 'bg') { S.bg.x = p.x - drag.dx; S.bg.y = p.y - drag.dy; changed(true); }
});
function endPtr(e) {
  delete ptrs[e.pointerId]; np = Object.keys(ptrs).length; if (np < 2) pinch = null;
  if (!down) return; var p = pt(e), click = !down.moved;
  if (drag && drag.k === 'item') { if (click) hist.pop(); syncSel(); changed(); }
  if (drag && drag.k === 'bg') changed();
  if (click) {
    if (tool === 'select' && (!drag || drag.k === 'pan') && !down.hit) { sel = null; syncSel(); draw2d(); }
    if (tool === 'wall') { var q = wallPt(p); if (draft && Math.hypot(q.x - draft.x, q.y - draft.y) > 0.04) { push(); S.walls.push({ id: nid(), x1: draft.x, y1: draft.y, x2: q.x, y2: q.y }); } draft = q; hover = null; $('b-wend').hidden = false; changed(); }
    if (tool === 'cal' && S.bg) { if (!cal || (cal.a && cal.b)) cal = { a: p, b: null }; else { cal.b = p; $('calform').hidden = false; $('cal-m').focus(); } draw2d(); }
  }
  down = null; drag = null;
}
svg.addEventListener('pointerup', endPtr); svg.addEventListener('pointercancel', endPtr);
function zoomTo(w, world, cx, cy) { var r = svg.getBoundingClientRect(); V.w = Math.max(1, Math.min(200, w)); var u = upp(); V.x = world.x - (cx - r.left) * u; V.y = world.y - (cy - r.top) * u; }
svg.addEventListener('wheel', function (e) { e.preventDefault(); zoomTo(V.w * (e.deltaY > 0 ? 1.12 : 0.89), pt(e), e.clientX, e.clientY); draw2d(); }, { passive: false });
svg.addEventListener('dblclick', function () { if (tool === 'wall') endWall(); });
function endWall() { draft = null; hover = null; $('b-wend').hidden = true; draw2d(); }
var HINTS = { select: '拖動物件去位置；空白位拖動可以平移，滾輪或雙指縮放。', wall: '逐點㩒出牆身，會自動吸附到牆角。㩒「完成畫牆」或者 Esc 收筆。', cal: '喺底圖上㩒一段已知長度嘅兩端，再輸入實際長度。要先上傳底圖。', bg: '拖動底圖，同平面對齊。' };
function setTool(t) { tool = t; if (t !== 'wall') endWall(); if (t !== 'cal') { cal = null; $('calform').hidden = true; } svg.setAttribute('class', 't-' + t); document.querySelectorAll('[data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tool') === t ? 'true' : 'false'); }); $('hint').textContent = HINTS[t]; draw2d(); }

/* ---------- 3D ---------- */
var gl = $('gl'), wrap = $('glwrap'), labelBox = $('labels'), renderer = null, scene, camera, controls, grp = null, labs = [], bgTex = null, bgTexSrc = null, ok3d = false;
try {
  renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputEncoding = THREE.sRGBEncoding;
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
  controls = new THREE.OrbitControls(camera, gl); controls.enableDamping = true; controls.dampingFactor = 0.1; controls.maxPolarAngle = Math.PI / 2 - 0.02;
  ok3d = true;
} catch (e) { wrap.insertAdjacentHTML('beforeend', '<p style="padding:16px">呢個瀏覽器開唔到 3D 預覽，平面編輯仍然用得。</p>'); }
function tex(def, rx, ry) { var t = new THREE.CanvasTexture(canv(def)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(rx, 0.1), Math.max(ry, 0.1)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
function sm(color, o) { var p = { color: color, roughness: 0.8, metalness: 0 }; if (o) for (var k in o) p[k] = o[k]; return new THREE.MeshStandardMaterial(p); }
function add(mesh, shadow) { if (shadow !== false) { mesh.castShadow = true; mesh.receiveShadow = true; } grp.add(mesh); return mesh; }
function bx(w, h, d, m, x, y, z, ry, shadow) { var me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); if (ry) me.rotation.y = ry; return add(me, shadow); }
function cy(r, h, m, x, y, z) { var me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m); me.position.set(x, y + h / 2, z); return add(me); }
function pl(w, h, m, x, y, z, rx, ry) { var me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.set(rx || 0, ry || 0, 0); me.receiveShadow = true; grp.add(me); return me; }
function lab(text, x, y, z) { var el = document.createElement('div'); el.className = 'lb'; el.textContent = text; labelBox.appendChild(el); labs.push({ el: el, p: new THREE.Vector3(x, y, z) }); }
var b3T = 0;
function build3dSoon() { clearTimeout(b3T); b3T = setTimeout(build3d, 60); }
function build3d() {
  if (!ok3d) return;
  if (grp) { scene.remove(grp); grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map && !o.material.map._keep) o.material.map.dispose(); o.material.dispose(); } }); }
  labelBox.textContent = ''; labs = []; grp = new THREE.Group(); scene.add(grp);
  var R = S.room, H = R.h, b = bounds(), W = b.x1 - b.x0, D = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2;
  scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#E4E9EF');
  var fd = matDef('floor', S.mats.floor), wd = matDef('wall', S.mats.wall), cd = matDef('ceil', S.mats.ceil); if (cd.id === 'same') cd = wd;
  pl(W, D, sm(0xffffff, { map: tex(fd, W / fd.size, D / fd.size), roughness: fd.id === 'epoxy' || fd.id === 'marble' ? 0.35 : 0.85 }), cx, 0, cz, -Math.PI / 2, 0);
  if (S.bg && S.bg.show3d && S.bg.src) { if (bgTexSrc !== S.bg.src) { bgTex = new THREE.TextureLoader().load(S.bg.src); bgTex._keep = true; bgTex.encoding = THREE.sRGBEncoding; bgTexSrc = S.bg.src; } var bw = S.bg.pw * S.bg.scale, bh = S.bg.ph * S.bg.scale; pl(bw, bh, new THREE.MeshBasicMaterial({ map: bgTex, transparent: true, opacity: 0.7 }), S.bg.x + bw / 2, 0.006, S.bg.y + bh / 2, -Math.PI / 2, 0).receiveShadow = false; }
  if ($('o-ceil').checked) pl(W, D, sm(0xffffff, { map: tex(cd, W / cd.size, D / cd.size) }), cx, H, cz, Math.PI / 2, 0);
  function wm(len) { return sm(0xffffff, { map: tex(wd, len / wd.size, H / wd.size), roughness: 0.92 }); }
  if (R.shell) { pl(R.w, H, wm(R.w), R.w / 2, H / 2, 0, 0, 0); pl(R.w, H, wm(R.w), R.w / 2, H / 2, R.d, 0, Math.PI); pl(R.d, H, wm(R.d), 0, H / 2, R.d / 2, 0, Math.PI / 2); pl(R.d, H, wm(R.d), R.w, H / 2, R.d / 2, 0, -Math.PI / 2); }
  S.walls.forEach(function (w) { var L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); bx(L + 0.1, H, 0.1, wm(L), (w.x1 + w.x2) / 2, H / 2, (w.y1 + w.y2) / 2, -Math.atan2(w.y2 - w.y1, w.x2 - w.x1)); });
  var pipes = $('o-pipe').checked, nl = 0;
  S.items.forEach(function (it) {
    var c = CAT[it.t], nm = it.label || c.n, ry = -it.rot * Math.PI / 180, p = center(it), col = new THREE.Color(c.c);
    if (c.g === 'open') {
      var m = it.t === 'door' ? sm(0x8A5A2B, { roughness: 0.6 }) : sm(0xBFE3FA, { emissive: 0x9CCBEA, emissiveIntensity: 0.35, roughness: 0.1, transparent: true, opacity: 0.75 });
      bx(it.w, it.h, 0.17, m, it.x, it.z + it.h / 2, it.y, ry, false);
      if (it.t === 'window') { var fm = sm(0xF4F4F0); bx(it.w + 0.08, 0.05, 0.19, fm, it.x, it.z, it.y, ry, false); bx(it.w + 0.08, 0.05, 0.19, fm, it.x, it.z + it.h, it.y, ry, false); }
      lab(nm, it.x, it.z + it.h + 0.15, it.y);
    } else if (c.g === 'furn') {
      bx(it.w, it.h, it.d, sm(col, { roughness: 0.6 }), p.x, it.z + it.h / 2, p.y, ry);
      if (it.t === 'sinkc') bx(it.w * 0.45, 0.02, it.d * 0.6, sm(0x30353A, { metalness: 0.6, roughness: 0.3 }), p.x, it.z + it.h + 0.01, p.y, ry, false);
      if (it.t === 'stove') { cy(0.1, 0.02, sm(0x15171A), p.x - 0.18 * Math.cos(-ry), it.z + it.h, p.y - 0.18 * Math.sin(-ry)); cy(0.1, 0.02, sm(0x15171A), p.x + 0.18 * Math.cos(-ry), it.z + it.h, p.y + 0.18 * Math.sin(-ry)); }
      lab(nm, p.x, it.z + it.h + 0.15, p.y);
    } else {
      var m2 = sm(col, { emissive: col, emissiveIntensity: 0.35, roughness: 0.5 });
      if (c.ceil) { cy(0.1, 0.03, sm(0xFFF4D6, { emissive: 0xFFE9B0, emissiveIntensity: 1.2 }), it.x, H - 0.03, it.y); if (nl++ < 8) { var L2 = new THREE.PointLight(0xFFF1D6, 0.45, 9, 2); L2.position.set(it.x, H - 0.15, it.y); grp.add(L2); } lab(nm, it.x, H - 0.12, it.y); }
      else if (c.floor) { cy(0.07, 0.012, sm(0x2E3338, { metalness: 0.6 }), it.x, 0, it.y); cy(0.11, 0.006, m2, it.x, 0, it.y); lab(nm, it.x, 0.25, it.y); }
      else {
        var n = it.n || [0, 0], off = (it.thk || 0) + 0.012, x = it.x + n[0] * off, z = it.y + n[1] * off, a = it.n ? Math.atan2(n[0], n[1]) : 0, big = it.t === 'vent';
        bx(big ? 0.25 : 0.09, big ? 0.25 : 0.13, 0.02, m2, x, it.z, z, a, false);
        if (!it.n) cy(0.012, it.z, sm(0x8A939C), x, 0, z);
        if (pipes && c.line === 'elec') bx(0.02, Math.max(0.05, H - it.z), 0.02, sm(col, { transparent: true, opacity: 0.55 }), x, (H + it.z) / 2, z, a, false);
        if (pipes && c.line === 'pipe') cy(0.02, Math.max(0.05, it.z), sm(col, { metalness: 0.4, roughness: 0.4 }), x + n[0] * 0.02, 0, z + n[1] * 0.02);
        lab(nm, x, it.z + 0.2, z);
      }
    }
  });
  grp.add(new THREE.HemisphereLight(0xffffff, 0x8A8F96, 0.78));
  var s = new THREE.DirectionalLight(0xffffff, 0.55), ext = Math.max(W, D) * 0.8 + 2; s.position.set(cx - W * 0.3, Math.max(8, ext * 1.5), cz + D * 0.9 + 3); s.target.position.set(cx, 0, cz); s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.camera.left = -ext; s.shadow.camera.right = ext; s.shadow.camera.top = ext; s.shadow.camera.bottom = -ext; s.shadow.camera.near = 0.5; s.shadow.camera.far = ext * 6 + 20; s.shadow.bias = -0.0006; grp.add(s); grp.add(s.target);
}
function view(name) {
  if (!ok3d) return; var b = bounds(), W = b.x1 - b.x0, D = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2, m = Math.max(W, D), k = Math.max(1, 1.3 / (camera.aspect || 1));
  if (name === 'bird') { controls.target.set(cx, 0.8, cz); camera.position.set(cx + W * 0.06, (m * 0.62 + 1.6) * k, cz + (D / 2 + m * 0.55 + 1.2) * k); }
  else if (name === 'in') { controls.target.set(cx, 1.2, cz); camera.position.set(b.x0 + 0.5, 1.6, b.y1 - 0.5); }
  else { controls.target.set(cx, 0, cz); camera.position.set(cx, (m * 1.25 + 2) * k, cz + 0.02); }
  controls.update();
}
function size3d() { if (!ok3d) return; var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
var v3 = ok3d ? new THREE.Vector3() : null;
function frame() {
  requestAnimationFrame(frame); if (!ok3d) return; controls.update(); renderer.render(scene, camera);
  var w = wrap.clientWidth, h = wrap.clientHeight, show = $('o-lab').checked;
  for (var i = 0; i < labs.length; i++) { var l = labs[i]; v3.copy(l.p).project(camera); var vis = show && v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05; l.el.hidden = !vis; if (vis) { l.el.style.left = ((v3.x * 0.5 + 0.5) * w).toFixed(1) + 'px'; l.el.style.top = ((-v3.y * 0.5 + 0.5) * h).toFixed(1) + 'px'; } }
}

/* ---------- 側欄 ---------- */
function changed(light) { draw2d(); build3dSoon(); if (!light) { sched(); save(); } }
function sched() {
  var tb = $('sched').tBodies[0], rows = S.items.filter(function (i) { return CAT[i.t].g === 'util'; });
  tb.innerHTML = rows.length ? rows.map(function (i) { var c = CAT[i.t]; return '<tr><td>' + esc(i.label || c.n) + '</td><td>' + f2(i.x) + '</td><td>' + f2(i.y) + '</td><td>' + (c.ceil ? '天花' : c.floor ? '地面' : f2(i.z)) + '</td></tr>'; }).join('') : '<tr><td colspan="4" style="text-align:left">未加入水電位</td></tr>';
}
function syncInputs() {
  var R = S.room; $('r-w').value = R.w; $('r-d').value = R.d; $('r-h').value = R.h; $('r-a').value = (R.w * R.d).toFixed(1); $('r-p').value = (R.w * R.d / PING).toFixed(1); $('r-shell').checked = !!R.shell;
  ['floor', 'wall', 'ceil'].forEach(function (k) { document.querySelectorAll('#m-' + k + ' button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-m') === S.mats[k] ? 'true' : 'false'); }); });
  $('bg-op').value = S.bg ? S.bg.op : 0.6; $('bg-show').checked = !!(S.bg && S.bg.show); $('bg-3d').checked = !!(S.bg && S.bg.show3d);
  syncSel();
}
function num(id, min, max, def) { var v = parseFloat($(id).value); if (!isFinite(v)) return def; return Math.max(min, Math.min(max, v)); }
['r-w', 'r-d', 'r-h'].forEach(function (id) { $(id).addEventListener('change', function () { push(); var R = S.room; R.w = num('r-w', 1, 60, R.w); R.d = num('r-d', 1, 60, R.d); R.h = num('r-h', 2, 8, R.h); syncInputs(); fit(); changed(); view('bird'); }); });
function setArea(a) { push(); var R = S.room, k = Math.sqrt(a / (R.w * R.d)); R.w = +(R.w * k).toFixed(2); R.d = +(R.d * k).toFixed(2); syncInputs(); fit(); changed(); view('bird'); }
$('r-a').addEventListener('change', function () { setArea(num('r-a', 1, 3000, S.room.w * S.room.d)); });
$('r-p').addEventListener('change', function () { setArea(num('r-p', 0.3, 900, S.room.w * S.room.d / PING) * PING); });
$('r-shell').addEventListener('change', function () { push(); S.room.shell = this.checked; changed(); });
['floor', 'wall', 'ceil'].forEach(function (k) {
  $('m-' + k).innerHTML = MAT[k].map(function (m) { return '<button data-m="' + m.id + '" aria-pressed="false"><i style="background-image:url(' + canv(m).toDataURL() + ')"></i><span>' + m.n + '</span></button>'; }).join('');
  $('m-' + k).addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; push(); S.mats[k] = b.getAttribute('data-m'); syncInputs(); changed(); });
});
[['util', 'pal-util'], ['open', 'pal-open'], ['furn', 'pal-furn']].forEach(function (pr) {
  var h = ''; for (var t in CAT) if (CAT[t].g === pr[0]) h += '<button data-add="' + t + '"><i class="' + (pr[0] === 'util' ? '' : 'sq') + '" style="background:' + CAT[t].c + '"></i>' + CAT[t].n + '</button>';
  $(pr[1]).innerHTML = h;
  $(pr[1]).addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; push(); var t = b.getAttribute('data-add'), bd = bounds(), it = mk(t, g5((bd.x0 + bd.x1) / 2), g5((bd.y0 + bd.y1) / 2)); if (CAT[t].wall) snapWall(it, it.x, bd.y0, true); S.items.push(it); sel = { id: it.id }; setTool('select'); syncSel(); changed(); });
});
function syncSel() {
  var box = $('sel'), f = $('sel-fields');
  if (!sel) { box.hidden = true; return; }
  box.hidden = false;
  if (sel.wall) { var w = S.walls.filter(function (x) { return x.id === sel.wall; })[0]; if (!w) { sel = null; box.hidden = true; return; } $('sel-title').textContent = '牆身'; f.innerHTML = '<span>長度</span><span>' + f2(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)) + ' m</span>'; $('sel-rot').hidden = $('sel-dup').hidden = true; return; }
  var it = byId(sel.id); if (!it) { sel = null; box.hidden = true; return; }
  var c = CAT[it.t]; $('sel-title').textContent = c.n; $('sel-rot').hidden = !(c.g === 'furn' && !c.wall); $('sel-dup').hidden = false;
  var fl = [['label', '名稱', 'text'], ['x', 'X (m)'], ['y', 'Y (m)']]; if (it.w != null) fl.push(['w', '闊 (m)']); if (it.d != null) fl.push(['d', '深 (m)']); if (it.h != null) fl.push(['h', '高 (m)']); if (!c.ceil && !c.floor) fl.push(['z', '離地 (m)']);
  f.innerHTML = fl.map(function (a) { var v = a[0] === 'label' ? esc(it.label || '') : it[a[0]]; return '<label for="sf-' + a[0] + '">' + a[1] + '</label><input id="sf-' + a[0] + '" data-f="' + a[0] + '" type="' + (a[2] || 'number') + '" step="0.05" value="' + v + '"' + (a[0] === 'label' ? ' placeholder="' + c.n + '"' : '') + '>'; }).join('');
}
$('sel-fields').addEventListener('change', function (e) { var k = e.target.getAttribute('data-f'), it = sel && byId(sel.id); if (!k || !it) return; push(); if (k === 'label') it.label = e.target.value.trim().slice(0, 30); else { var v = parseFloat(e.target.value); if (isFinite(v)) it[k] = (k === 'w' || k === 'd' || k === 'h') ? Math.max(0.05, Math.min(20, v)) : Math.max(-100, Math.min(100, v)); } changed(); });
$('sel-rot').addEventListener('click', function () { var it = sel && byId(sel.id); if (!it) return; push(); it.rot = (it.rot + 90) % 360; changed(); });
$('sel-dup').addEventListener('click', function () { var it = sel && byId(sel.id); if (!it) return; push(); var c = JSON.parse(JSON.stringify(it)); c.id = nid(); c.x = g5(c.x + 0.3); c.y = g5(c.y + 0.3); if (CAT[c.t].wall) snapWall(c, c.x, c.y); S.items.push(c); sel = { id: c.id }; syncSel(); changed(); });
function delSel() { if (!sel) return; push(); if (sel.wall) S.walls = S.walls.filter(function (w) { return w.id !== sel.wall; }); else S.items = S.items.filter(function (i) { return i.id !== sel.id; }); sel = null; syncSel(); changed(); }
$('sel-del').addEventListener('click', delSel);

/* ---------- 底圖 ---------- */
function setBg(src, pw, ph) { push(); var R = S.room; S.bg = { src: src, pw: pw, ph: ph, scale: R.w / pw, x: 0, y: 0, op: 0.6, show: true, show3d: false }; lastSrc = src; syncInputs(); fit(); changed(); setTool('cal'); }
function shrink(img) { var m = 2200, k = Math.min(1, m / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); return c; }
$('f-bg').addEventListener('change', function () {
  var f = this.files[0]; this.value = ''; if (!f) return;
  var fail = function () { $('hint').textContent = '呢個檔案讀唔到，請改用 PNG、JPG 或者 PDF。'; };
  if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
    $('hint').textContent = '讀緊 PDF…';
    f.arrayBuffer().then(function (buf) { return import('./vendor/pdf.min.mjs').then(function (pdfjs) { pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs'; return pdfjs.getDocument({ data: buf }).promise; }); })
      .then(function (doc) { return doc.getPage(1); })
      .then(function (page) { var v0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(3, 2200 / Math.max(v0.width, v0.height)) }), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return page.render({ canvasContext: x, viewport: vp, canvas: c }).promise.then(function () { setBg(c.toDataURL('image/png'), c.width, c.height); }); })
      .catch(fail);
  } else {
    var rd = new FileReader(); rd.onerror = fail; rd.onload = function () { var img = new Image(); img.onerror = fail; img.onload = function () { var c = shrink(img); setBg(c.toDataURL('image/jpeg', 0.88), c.width, c.height); }; img.src = rd.result; }; rd.readAsDataURL(f);
  }
});
$('bg-op').addEventListener('input', function () { if (S.bg) { S.bg.op = +this.value; draw2d(); save(); } });
$('bg-show').addEventListener('change', function () { if (S.bg) { S.bg.show = this.checked; changed(); } });
$('bg-3d').addEventListener('change', function () { if (S.bg) { S.bg.show3d = this.checked; changed(); } });
$('bg-del').addEventListener('click', function () { if (!S.bg) return; push(); S.bg = null; syncInputs(); setTool('select'); changed(); });
$('calform').addEventListener('submit', function (e) { e.preventDefault(); var real = parseFloat($('cal-m').value); if (!S.bg || !cal || !cal.b || !(real > 0)) return; var meas = Math.hypot(cal.b.x - cal.a.x, cal.b.y - cal.a.y); if (meas < 1e-6) return; push(); var k = real / meas; S.bg.scale *= k; S.bg.x = cal.a.x - (cal.a.x - S.bg.x) * k; S.bg.y = cal.a.y - (cal.a.y - S.bg.y) * k; cal = null; this.hidden = true; $('cal-m').value = ''; fit(); changed(); setTool('bg'); });
$('cal-x').addEventListener('click', function () { cal = null; $('calform').hidden = true; draw2d(); });

/* ---------- 頂部按鈕 ---------- */
function dl(name, href) { var a = document.createElement('a'); a.download = name; a.href = href; document.body.appendChild(a); a.click(); a.remove(); }
$('b-undo').addEventListener('click', undo);
$('b-sample').addEventListener('click', function () { push(); var bg = S.bg; S = sample(); S.bg = bg; sel = null; syncInputs(); fit(); changed(); view('bird'); });
$('b-clear').addEventListener('click', function () { push(); var R = S.room, m = S.mats; S = blank(); S.room = R; S.mats = m; sel = null; syncInputs(); changed(); });
$('b-export').addEventListener('click', function () { var u = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); dl('裝修規劃.json', u); setTimeout(function () { URL.revokeObjectURL(u); }, 2000); });
$('b-import').addEventListener('click', function () { $('f-import').click(); });
$('f-import').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (!f) return; f.text().then(function (t) { var o = JSON.parse(t); if (!o || !o.room || !Array.isArray(o.items) || !Array.isArray(o.walls)) throw 0; o.items = o.items.filter(function (i) { return CAT[i.t]; }); if (o.bg && !/^data:image\//.test(o.bg.src || '')) o.bg = null; push(); S = o; sel = null; syncInputs(); fit(); changed(); view('bird'); }).catch(function () { $('hint').textContent = '呢個檔案唔係規劃檔，開唔到。'; }); });
$('b-png').addEventListener('click', function () { if (!ok3d) return; renderer.render(scene, camera); dl('裝修3D.png', gl.toDataURL('image/png')); });
$('b-fit').addEventListener('click', function () { fit(); draw2d(); });
$('b-wend').addEventListener('click', endWall);
document.querySelectorAll('[data-tool]').forEach(function (b) { b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); }); });
document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { view(b.getAttribute('data-view')); }); });
['o-pipe', 'o-ceil'].forEach(function (id) { $(id).addEventListener('change', build3d); });
document.addEventListener('keydown', function (e) { var inField = /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')); if (e.key === 'Escape') endWall(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); undo(); } if ((e.key === 'Delete' || e.key === 'Backspace') && !inField && sel) { e.preventDefault(); delSel(); } });
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', build3d);

/* ---------- 啟動 ---------- */
S = load() || sample(); if (S.bg) lastSrc = S.bg.src;
function relayout() { size3d(); draw2d(); }
if (window.ResizeObserver) { new ResizeObserver(relayout).observe(wrap); new ResizeObserver(relayout).observe(svg); } else window.addEventListener('resize', relayout);
syncInputs(); setTool('select'); size3d(); fit(); changed(); build3d(); view('bird'); requestAnimationFrame(frame);
window.__planner = { state: function () { return S; } };
})();
