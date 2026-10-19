/* 狸花貓：Studio 頁同規劃工具共用。
   - 積木級模型：身、頭、耳、四肢、七節尾；虎紋用 canvas 即場畫。
   - 搵路：地面切格，障礙物（矩形、牆線）向外加 CR 當行唔到；BFS 搵路再拉直成幾段直線。
   - 三個模式：wander 周圍行、tour 帶參觀（逐個站點講嘢）、zoom 暴衝。
   用法：var cat = TabbyCat.create(THREE, scene, 對話框容器);
         cat.setNav({x0,z0,x1,z1,rects:[[中心x,中心z,半闊,半深,rotation.y]],segs:[[x1,z1,x2,z2]],start:[x,z]});
         每格：cat.update(dt, camera); cat.place(camera, 闊, 高, 固定位?) */
(function () {
'use strict';
var MODES = {
  wander: { sp: 0.36, turn: 2.4, stride: 26, bob: 0.008, legs: [0, Math.PI, Math.PI, 0], pause: [1.5, 5], far: 1.5 },
  tour:   { sp: 0.5, turn: 3.2, stride: 26, bob: 0.008, legs: [0, Math.PI, Math.PI, 0], pause: [1, 2], far: 1.5 },
  zoom:   { sp: 1.9, turn: 9, stride: 12, bob: 0.035, legs: [0, 0.5, Math.PI, Math.PI + 0.5], pause: [0.15, 0.7], far: 1.0 }   // 跑：前腳一齊、後腳一齊
};
var CSS = '.catsay{position:absolute;left:0;top:0;z-index:5;transform:translate(-50%,calc(-100% - 10px));width:max-content;max-width:min(280px,82%);padding:8px 12px;border-radius:12px;background:#FFF8EC;color:#2A1D10;font-size:13px;line-height:1.6;box-shadow:0 4px 16px rgba(0,0,0,.35);pointer-events:none;white-space:normal}' +
  '.catsay::after{content:"";position:absolute;left:calc(50% + var(--tail,0px));bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:#FFF8EC}' +
  '.catsay.fixed{transform:translate(-50%,0)}.catsay.fixed::after{display:none}';
function rand(a) { return a[0] + Math.random() * (a[1] - a[0]); }
function angDiff(a, b) { var d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }

function create(THREE, scene, box) {
  if (box && !document.getElementById('tabbycat-css')) { var stl = document.createElement('style'); stl.id = 'tabbycat-css'; stl.textContent = CSS; document.head.appendChild(stl); }
  var CR = 0.18, G = 0.1, GX = 1, GZ = 1, X0 = 0, Z0 = 0, free = new Uint8Array(1);
  var st = { x: 0, z: 0, h: Math.PI / 2, path: [], wait: 0.5, turn: null, ph: 0, amp: 0, t: 0 };   // h：面向角，前方 = (sin h, cos h)
  var mode = 'wander', M = MODES.wander, stops = [], stopI = -1, onEnd = null, cam = null, sayEl = null, sayHide = 0;
  var v = new THREE.Vector3(), v2 = new THREE.Vector3();
  if (box) { sayEl = document.createElement('div'); sayEl.className = 'catsay'; sayEl.hidden = true; sayEl.setAttribute('aria-live', 'polite'); box.appendChild(sayEl); }

  /* ---------- 格網 ---------- */
  function cellOf(x, z) { return Math.max(0, Math.min(GX - 1, Math.floor((x - X0) / G))) + Math.max(0, Math.min(GZ - 1, Math.floor((z - Z0) / G))) * GX; }
  function cX(c) { return X0 + (c % GX + 0.5) * G; }
  function cZ(c) { return Z0 + (Math.floor(c / GX) + 0.5) * G; }
  function bfs(s, any) {   // any：連行唔到嘅格都行，用嚟搵最近嘅空格
    var N = GX * GZ, dist = new Int32Array(N), prev = new Int32Array(N), q = [s], h = 0;
    for (var a = 0; a < N; a++) dist[a] = -1; dist[s] = 0;
    while (h < q.length) {
      var c = q[h++], x = c % GX, z = (c - x) / GX;
      for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
        var nx = x + dx, nz = z + dz; if ((!dx && !dz) || nx < 0 || nz < 0 || nx >= GX || nz >= GZ) continue;
        var n = nx + nz * GX; if (dist[n] >= 0) continue;
        if (!any && (!free[n] || (dx && dz && (!free[nx + z * GX] || !free[x + nz * GX])))) continue;   // 斜行唔可以切角
        dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
      }
    }
    return { dist: dist, prev: prev, order: q };
  }
  function seeLine(ax, az, bx, bz) { var d = Math.hypot(bx - ax, bz - az), k = Math.ceil(d / (G / 2)); for (var s = 1; s <= k; s++) if (!free[cellOf(ax + (bx - ax) * s / k, az + (bz - az) * s / k)]) return false; return true; }
  function trace(r, s, g) {
    var cells = [], pts = [], ax = st.x, az = st.z, k = 0;
    for (var c = g; c !== s; c = r.prev[c]) cells.unshift(c);
    while (k < cells.length) { var j = cells.length - 1; while (j > k && !seeLine(ax, az, cX(cells[j]), cZ(cells[j]))) j--; ax = cX(cells[j]); az = cZ(cells[j]); pts.push([ax, az]); k = j + 1; }
    return pts;
  }
  function nearestFree(x, z) { var c = cellOf(x, z); if (free[c]) return c; var q = bfs(c, true).order; for (var n = 0; n < q.length; n++) if (free[q[n]]) return q[n]; return -1; }
  function goTo(g) { var s = cellOf(st.x, st.z); if (g < 0 || g === s) return false; var r = bfs(s, false); if (r.dist[g] < 0) return false; st.path = trace(r, s, g); return st.path.length > 0; }
  function randomTrip() {
    var s = cellOf(st.x, st.z), r = bfs(s, false), far = [], need = Math.round(M.far / G);
    for (var n = 0; n < r.order.length; n++) if (r.dist[r.order[n]] >= need) far.push(r.order[n]);
    if (!far.length) return false;
    st.path = trace(r, s, far[Math.floor(Math.random() * far.length)]); return true;
  }
  function setNav(o) {
    var w = Math.max(0.5, o.x1 - o.x0), d = Math.max(0.5, o.z1 - o.z0), rects = o.rects || [], segs = o.segs || [], pad = CR + 0.06;
    G = Math.max(0.1, Math.max(w, d) / 220); X0 = o.x0; Z0 = o.z0; GX = Math.max(1, Math.floor(w / G)); GZ = Math.max(1, Math.floor(d / G)); free = new Uint8Array(GX * GZ);
    for (var c = 0; c < free.length; c++) {
      var x = cX(c), z = cZ(c), ok = x > o.x0 + CR && x < o.x1 - CR && z > o.z0 + CR && z < o.z1 - CR, n;
      for (n = 0; ok && n < rects.length; n++) { var r = rects[n], dx = x - r[0], dz = z - r[1], co = Math.cos(r[4] || 0), si = Math.sin(r[4] || 0); if (Math.abs(dx * co - dz * si) < r[2] + CR && Math.abs(dx * si + dz * co) < r[3] + CR) ok = false; }
      for (n = 0; ok && n < segs.length; n++) { var s = segs[n], ux = s[2] - s[0], uz = s[3] - s[1], L2 = ux * ux + uz * uz, t = L2 ? Math.max(0, Math.min(1, ((x - s[0]) * ux + (z - s[1]) * uz) / L2)) : 0; if (Math.hypot(x - s[0] - ux * t, z - s[1] - uz * t) < pad) ok = false; }
      free[c] = ok ? 1 : 0;
    }
    var inside = st.x >= o.x0 && st.x <= o.x1 && st.z >= o.z0 && st.z <= o.z1;
    if (o.reset || !inside || !free[cellOf(st.x, st.z)]) { var g = nearestFree(o.start ? o.start[0] : (o.x0 + o.x1) / 2, o.start ? o.start[1] : (o.z0 + o.z1) / 2); if (g >= 0) { st.x = cX(g); st.z = cZ(g); } }
    if (st.path.length || o.reset) { st.path = []; st.turn = null; st.wait = 0.2; if (mode === 'tour' && stopI >= 0) stopI--; }   // 行緊路就由呢個站重新行過去
  }

  /* ---------- 模型 ---------- */
  var g3 = new THREE.Group(), head = new THREE.Group(), legs = [], tail = [];
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');   // 虎紋：橫紋貼落身會變成一圈圈
    x.fillStyle = '#9C8466'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#3B2E22';
    for (var y = 6; y < 128; y += 14) { x.beginPath(); var i;
      for (i = 0; i <= 128; i += 8) x.lineTo(i, y + Math.sin(i / 128 * 6 * Math.PI + y) * 2.5);
      for (i = 128; i >= 0; i -= 8) x.lineTo(i, y + 5 + Math.sin(i / 128 * 4 * Math.PI + y * 1.3) * 2); x.fill(); }
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    function mat(col, o) { var p = { color: col, roughness: 0.95 }; if (o) for (var k in o) p[k] = o[k]; return new THREE.MeshStandardMaterial(p); }
    var fur = mat(0xffffff, { map: tex }), base = mat(0x9C8466), dark = mat(0x3B2E22), light = mat(0xDCCBAE);
    function part(geo, m, px, py, pz, parent) { var me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = true; (parent || g3).add(me); return me; }
    var bodyG = new THREE.SphereGeometry(1, 20, 14); bodyG.rotateX(Math.PI / 2);
    part(bodyG, fur, 0, 0.2, 0).scale.set(0.1, 0.085, 0.21);
    part(new THREE.SphereGeometry(1, 14, 10), light, 0, 0.19, 0.13).scale.set(0.07, 0.07, 0.07);   // 心口
    head.position.set(0, 0.25, 0.22); g3.add(head);
    part(new THREE.SphereGeometry(0.072, 18, 14), fur, 0, 0.03, 0.02, head).scale.set(1, 0.9, 0.95);
    part(new THREE.SphereGeometry(0.032, 12, 8), light, 0, 0.005, 0.075, head).scale.set(1.2, 0.8, 0.8);   // 口鼻
    part(new THREE.SphereGeometry(0.008, 8, 6), mat(0xC97B7B), 0, 0.02, 0.1, head);
    [-1, 1].forEach(function (s) {
      part(new THREE.SphereGeometry(0.012, 10, 8), mat(0xC8D44A, { emissive: 0x6A7A10, emissiveIntensity: 0.4, roughness: 0.2 }), s * 0.03, 0.04, 0.08, head);
      part(new THREE.ConeGeometry(0.028, 0.055, 4), base, s * 0.04, 0.1, 0.01, head).rotation.z = -s * 0.3; });
    [[0.05, 0.13], [-0.05, 0.13], [0.05, -0.14], [-0.05, -0.14]].forEach(function (p) {   // 左前、右前、左後、右後
      var hip = new THREE.Group(); hip.position.set(p[0], 0.17, p[1]); g3.add(hip);
      part(new THREE.CylinderGeometry(0.02, 0.018, 0.16, 8), base, 0, -0.08, 0, hip);
      part(new THREE.SphereGeometry(0.024, 8, 6), light, 0, -0.155, 0.01, hip).scale.set(1, 0.6, 1.3);
      legs.push(hip); });
    var p = new THREE.Group(); p.position.set(0, 0.23, -0.2); p.rotation.x = -1.0; g3.add(p);
    for (var n = 0; n < 7; n++) { var seg = new THREE.Group(); seg.position.y = n ? 0.045 : 0; seg.rotation.x = n ? 0.12 : 0; p.add(seg);
      part(new THREE.CylinderGeometry(0.016, 0.018, 0.047, 8), n % 2 ? dark : base, 0, 0.0225, 0, seg); tail.push(seg); p = seg; }
  })();
  scene.add(g3);

  /* ---------- 模式同講嘢 ---------- */
  function say(text, secs) { if (!sayEl) return; sayEl.textContent = text || ''; sayEl.hidden = !text; sayHide = text && secs ? st.t + secs : 0; }
  function faceFreeTurn() { for (var a = 0; a < 6; a++) { var th = st.h + (Math.random() - 0.5) * 3; if (free[cellOf(st.x + Math.sin(th) * 0.3, st.z + Math.cos(th) * 0.3)]) return th; } return null; }   // 個頭要轉到去空位
  function arrive() {
    if (mode === 'tour' && stopI >= 0 && stopI < stops.length) {
      var s = stops[stopI]; say(s.say); st.wait = s.wait || Math.min(10, Math.max(4, s.say.length * 0.12));
      st.turn = cam ? Math.atan2(cam.position.x - st.x, cam.position.z - st.z) : null;   // 好似地產經紀咁轉身望住客
    } else { st.wait = rand(M.pause); st.turn = faceFreeTurn(); }
  }
  function next() {
    if (mode === 'tour') {
      stopI++;
      if (stopI >= stops.length) { var cb = onEnd; onEnd = null; setMode('wander'); if (cb) cb(); return; }
      var s = stops[stopI]; if (goTo(nearestFree(s.x, s.z))) say('請跟我嚟～', 1.8); else arrive();
      return;
    }
    if (!randomTrip()) st.wait = 1;
  }
  function setMode(m) {
    if (!MODES[m]) return; mode = m; M = MODES[m]; st.path = []; st.turn = null; st.wait = 0.05;
    if (m !== 'tour') { stops = []; stopI = -1; onEnd = null; say(''); }
  }
  function startTour(list, cb) { setMode('tour'); stops = list; stopI = -1; onEnd = cb || null; }

  function update(dt, camera) {
    var sp = 0, turn = 0; st.t += dt; cam = camera;
    if (sayHide && st.t > sayHide) say('');
    if (st.path.length) {
      var p = st.path[0], dx = p[0] - st.x, dz = p[1] - st.z, d = Math.hypot(dx, dz);
      if (d < Math.max(0.04, M.sp * dt)) { st.x = p[0]; st.z = p[1]; st.path.shift(); if (!st.path.length) arrive(); }
      else {
        turn = angDiff(Math.atan2(dx, dz), st.h); sp = Math.abs(turn) > 0.9 ? 0 : M.sp * Math.cos(turn);   // 要轉大彎就先原地轉
        var step = Math.min(sp * dt, d), nx = st.x + Math.sin(st.h) * step, nz = st.z + Math.cos(st.h) * step;
        if (!free[cellOf(nx, nz)]) { nx = st.x + dx / d * step; nz = st.z + dz / d * step; }
        if (free[cellOf(nx, nz)]) { st.x = nx; st.z = nz; }
      }
    } else if (st.wait > 0) { st.wait -= dt; if (st.turn !== null) turn = angDiff(st.turn, st.h); if (st.wait <= 0) { st.turn = null; next(); } }
    else next();
    var tr = Math.max(-M.turn * dt, Math.min(M.turn * dt, turn)); st.h += tr;
    var moving = sp > 0.02 || Math.abs(tr) > 0.002;
    st.amp += ((moving ? 1 : 0) - st.amp) * Math.min(1, dt * 6); st.ph += sp * dt * M.stride + Math.abs(tr) * 3;
    g3.position.set(st.x, Math.abs(Math.sin(st.ph)) * M.bob * st.amp, st.z); g3.rotation.y = st.h;
    legs.forEach(function (l, i) { l.rotation.x = Math.sin(st.ph + M.legs[i]) * (mode === 'zoom' ? 0.8 : 0.55) * st.amp; });
    tail.forEach(function (s, n) { s.rotation.z = Math.sin(st.t * (moving ? 3 : 1.4) - n * 0.6) * 0.12; });
    head.rotation.y = Math.sin(st.t * 0.7) * 0.45 * (1 - st.amp) * (mode === 'tour' ? 0.3 : 1);   // 停低嗰陣左望右望
  }

  /* ---------- 鏡頭同對話框 ---------- */
  function eyeCam(camera, controls) {   // 貓咪視角：鏡頭放喺貓眼
    var lh = st.h + head.rotation.y;
    camera.position.set(st.x + Math.sin(st.h) * 0.3, 0.29 + g3.position.y, st.z + Math.cos(st.h) * 0.3);
    controls.target.set(camera.position.x + Math.sin(lh) * 2, 0.4, camera.position.z + Math.cos(lh) * 2);
    camera.lookAt(controls.target);
  }
  function follow(camera, controls, dt, b) {   // 帶參觀：鏡頭跟喺貓後面；停低時唔郁位，只係望住隻貓
    var k = 1 - Math.exp(-dt * 2.2), fx = Math.sin(st.h), fz = Math.cos(st.h);
    if (st.path.length) {
      var A = [0, 0.5, -0.5, 1, -1, 1.5, -1.5], px, pz;   // 正後面貼牆冇位，就揀側後方，免得變咗由頭頂望落去
      for (var i = 0; i < A.length; i++) { px = st.x - Math.sin(st.h + A[i]) * 1.6; pz = st.z - Math.cos(st.h + A[i]) * 1.6; if (px > b.x0 + 0.25 && px < b.x1 - 0.25 && pz > b.z0 + 0.25 && pz < b.z1 - 0.25) break; }
      v.set(Math.max(b.x0 + 0.25, Math.min(b.x1 - 0.25, px)), Math.min(1.25, b.h - 0.2), Math.max(b.z0 + 0.25, Math.min(b.z1 - 0.25, pz)));
      camera.position.lerp(v, k); v2.set(st.x + fx * 0.15, 0.25, st.z + fz * 0.15);   // 貓擺喺畫面正中，唔好畀下面嘅掣遮住
    } else v2.set(st.x, 0.3, st.z);
    controls.target.lerp(v2, k);
  }
  function place(camera, w, h, fixed) {
    if (!sayEl || sayEl.hidden) return;
    var x = w / 2, y = 12;
    if (!fixed) { v.set(st.x, 0.5, st.z).project(camera); if (v.z < 1 && Math.abs(v.x) < 1.1 && v.y < 1.05 && v.y > -1.1) { x = (v.x * 0.5 + 0.5) * w; y = (-v.y * 0.5 + 0.5) * h; } else fixed = true; }
    var m = Math.min(140, w / 2), cx = Math.max(m, Math.min(w - m, x));
    var tm = Math.max(0, sayEl.offsetWidth / 2 - 16); sayEl.style.setProperty('--tail', Math.max(-tm, Math.min(tm, x - cx)).toFixed(1) + 'px'); x = cx;   // 對話框貼邊時，個尖角照樣指住隻貓
    sayEl.classList.toggle('fixed', !!fixed); sayEl.style.left = x.toFixed(1) + 'px'; sayEl.style.top = y.toFixed(1) + 'px';
  }

  return { group: g3, state: st, setNav: setNav, update: update, setMode: setMode, mode: function () { return mode; }, startTour: startTour, eyeCam: eyeCam, follow: follow, place: place, say: say };
}
window.TabbyCat = { create: create };
})();
