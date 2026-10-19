/* 狸花貓：Studio 頁同規劃工具共用。
   - 積木級模型：身、頭、耳、四肢、七節尾；虎紋用 canvas 即場畫。身體掛喺後腳髖位做支點，所以坐、伏、伸懶腰都係轉個支點。
   - 搵路：地面切格，障礙物（矩形、牆線）向外加 CR 當行唔到；BFS 搵路再拉直成幾段直線。行路時位置一定沿住路線，所以唔會卡入傢俬。
   - 三個模式：wander 周圍行（會坐、伏、瞓、伸懶腰、理毛、打喊露、跳上傢俬）、tour 帶參觀（逐個站點講嘢）、zoom 暴衝（會原地跳、飛上飛落）。
   用法：var cat = TabbyCat.create(THREE, scene, 對話框容器);
         cat.setNav({x0,z0,x1,z1,rects:[[中心x,中心z,半闊,半深,rotation.y]],segs:[[x1,z1,x2,z2]],perches:[[中心x,中心z,半闊,半深,rotation.y,面高]],start:[x,z]});
         每格：cat.update(dt, camera); cat.place(camera, 闊, 高, 固定位?)；帶參觀時 cat.follow(...)；貓咪視角用 cat.eyeCam(...) */
(function () {
'use strict';
var PI = Math.PI;
var MODES = {
  wander: { sp: 0.36, turn: 2.4, stride: 26, bob: 0.008, legs: [0, PI, PI, 0], far: 1.5 },
  tour:   { sp: 0.5, turn: 3.2, stride: 26, bob: 0.008, legs: [0, PI, PI, 0], far: 1.5 },
  zoom:   { sp: 1.9, turn: 9, stride: 12, bob: 0.035, legs: [0, 0.5, PI, PI + 0.5], far: 1.0 }   // 跑：前腳一齊、後腳一齊
};
/* 姿勢：drop 身體落低、pitch 身向上(負)／向下(正)、roll 側身、legF／legH 前後腳角度、paw 舉起左前腳、headP 頭向下(正)、headY 頭轉、tailUp 條尾角度、curl 尾捲、eyes 眼開、mouth 口開 */
var BASE = { drop: 0, pitch: 0, roll: 0, legF: 0, legH: 0, paw: 0, headP: 0, headY: 0, tailUp: -1.0, curl: 0, eyes: 1, mouth: 0 };
var SIT = { drop: -0.11, pitch: -0.55, legF: 0.55, legH: -0.95, headP: 0.45, tailUp: -1.02, curl: 0.5 };
function pose(o) { var p = {}, k; for (k in BASE) p[k] = BASE[k]; for (k in o) p[k] = o[k]; return p; }
function ext(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
var POSE = {
  stand:   pose({}),
  sit:     pose(SIT),
  loaf:    pose({ drop: -0.1, legF: 1.4, legH: -1.4, headP: 0.1, tailUp: -1.5, curl: 0.6, eyes: 0.45 }),   // 揣手
  sleep:   pose({ drop: -0.1, roll: 0.3, legF: -1.3, legH: -1.3, headP: 0.7, headY: 0.45, tailUp: -1.5, curl: 1, eyes: 0 }),   // 個頭擱喺前腳
  stretch: pose({ drop: -0.02, pitch: 0.38, legF: -1.3, legH: -0.38, headP: -0.3, tailUp: -1.9, eyes: 0.6 }),   // 伸懶腰：前低後高
  groom:   pose(ext(SIT, { paw: 1, headP: 0.95, headY: 0.35, eyes: 0.3 })),   // 舔前腳
  lick:    pose(ext(SIT, { headP: 0.75, headY: 1.5, eyes: 0.3 })),             // 舔身
  yawn:    pose(ext(SIT, { headP: 0.15, eyes: 0.15, mouth: 1 })),
  crouch:  pose({ drop: -0.05, pitch: 0.12, legF: 0.35, legH: -0.55, headP: -0.12 }),
  air:     pose({ pitch: -0.15, legF: -0.9, legH: 0.9, tailUp: -0.6 })
};
/* 停低之後做咩：[動作, 比重, 最短秒, 最長秒]；perch = 搵件傢俬跳上去，hop = 原地跳 */
var IDLE = {
  wander: [['look', 4, 2, 5], ['sit', 3, 4, 9], ['groom', 3, 5, 9], ['loaf', 2, 6, 12], ['sleep', 1.5, 10, 18], ['stretch', 1.2, 2.6, 2.6], ['yawn', 1, 2.2, 2.2], ['perch', 3]],
  zoom:   [['look', 5, 0.15, 0.6], ['hop', 3], ['perch', 2]]
};
var ONPERCH = [['look', 3, 2, 5], ['sit', 3, 4, 9], ['groom', 3, 5, 9], ['loaf', 2, 6, 12], ['sleep', 2, 10, 18]];
var CSS = '.catsay{position:absolute;left:0;top:0;z-index:5;transform:translate(-50%,calc(-100% - 10px));width:max-content;max-width:min(280px,82%);padding:8px 12px;border-radius:12px;background:#FFF8EC;color:#2A1D10;font-size:13px;line-height:1.6;box-shadow:0 4px 16px rgba(0,0,0,.35);pointer-events:none;white-space:normal}' +
  '.catsay::after{content:"";position:absolute;left:calc(50% + var(--tail,0px));bottom:-7px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top-color:#FFF8EC}' +
  '.catsay.fixed{transform:translate(-50%,0)}.catsay.fixed::after{display:none}';
function rand(a, b) { return a + Math.random() * (b - a); }
function angDiff(a, b) { var d = (a - b) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; return d; }
function pick(list) { var tot = 0, i; for (i = 0; i < list.length; i++) tot += list[i][1]; var r = Math.random() * tot; for (i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i]; } return list[0]; }

function create(THREE, scene, box) {
  if (box && !document.getElementById('tabbycat-css')) { var stl = document.createElement('style'); stl.id = 'tabbycat-css'; stl.textContent = CSS; document.head.appendChild(stl); }
  var CR = 0.18, G = 0.1, GX = 1, GZ = 1, X0 = 0, Z0 = 0, free = new Uint8Array(1), perches = [];
  /* h：面向角，前方 = (sin h, cos h)；y：企喺幾高（地面 0，跳咗上傢俬就係面高）；fy：跳緊時嘅高度 */
  var st = { x: 0, z: 0, h: PI / 2, y: 0, fy: null, path: [], act: null, turn: null, plan: null, perch: null, launch: null, perchLeft: 0, ph: 0, amp: 0, t: 0, stuck: 0 };
  var mode = 'wander', M = MODES.wander, stops = [], stopI = -1, onEnd = null, cam = null, sayEl = null, sayHide = 0;
  var P = pose({}), v = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
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
  function goTo(g) { var s = cellOf(st.x, st.z); if (g < 0 || g === s) return false; var r = bfs(s, false); if (r.dist[g] < 0) return false; st.path = trace(r, s, g); st.stuck = 0; return st.path.length > 0; }
  function randomTrip() {
    var s = cellOf(st.x, st.z), r = bfs(s, false), far = [], need = Math.round(M.far / G);
    for (var n = 0; n < r.order.length; n++) if (r.dist[r.order[n]] >= need) far.push(r.order[n]);
    if (!far.length) return false;
    st.path = trace(r, s, far[Math.floor(Math.random() * far.length)]); st.stuck = 0; return st.path.length > 0;
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
    perches = (o.perches || []).filter(function (p) { return p[5] > 0.2 && p[5] <= 1.2; }).map(function (p) { return { p: p, launch: nearestFree(p[0], p[1]) }; });   // 太矮唔使跳，太高跳唔上
    var up = st.y > 0.01 || (st.act && st.act.k === 'jump');
    if (up) { st.act = null; st.perch = null; st.y = 0; st.fy = null; }   // 喺傢俬上面時改咗佈局：即刻落返地
    var inside = st.placed && st.x >= o.x0 && st.x <= o.x1 && st.z >= o.z0 && st.z <= o.z1, sx = (o.x0 + o.x1) / 2, sz = (o.z0 + o.z1) / 2, g = -2;
    if (o.start) { sx = o.start[0]; sz = o.start[1]; }
    if (o.reset || !inside) g = nearestFree(sx, sz);   // 第一次或者走咗出範圍：由起點開始
    else if (!free[cellOf(st.x, st.z)]) g = nearestFree(st.x, st.z);   // 原位變咗障礙：移去最近嘅空位
    if (g >= 0) { st.x = cX(g); st.z = cZ(g); } st.placed = true;
    if (st.path.length || st.plan || o.reset || up) { st.path = []; st.plan = null; if (!st.act) startAct('look', 0.2); if (mode === 'tour' && stopI >= 0 && !(st.act && st.act.speak)) stopI--; }   // 行緊路就由呢個站重新行過去
  }

  /* ---------- 模型 ---------- */
  var g3 = new THREE.Group(), lift = new THREE.Group(), torso = new THREE.Group(), tb = new THREE.Group(), head = new THREE.Group(), tailRoot = new THREE.Group();
  var legs = [], tail = [], eyes = [], body, mouth, tongue;
  g3.add(lift); lift.add(torso); torso.add(tb);
  torso.position.set(0, 0.17, -0.14); tb.position.set(0, -0.17, 0.14);   // 支點喺後腳髖位
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');   // 虎紋：橫紋貼落身會變成一圈圈
    x.fillStyle = '#9C8466'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#3B2E22';
    for (var y = 6; y < 128; y += 14) { x.beginPath(); var i;
      for (i = 0; i <= 128; i += 8) x.lineTo(i, y + Math.sin(i / 128 * 6 * PI + y) * 2.5);
      for (i = 128; i >= 0; i -= 8) x.lineTo(i, y + 5 + Math.sin(i / 128 * 4 * PI + y * 1.3) * 2); x.fill(); }
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    function mat(col, o) { var p = { color: col, roughness: 0.95 }; if (o) for (var k in o) p[k] = o[k]; return new THREE.MeshStandardMaterial(p); }
    var fur = mat(0xffffff, { map: tex }), base = mat(0x9C8466), dark = mat(0x3B2E22), light = mat(0xDCCBAE);
    function part(geo, m, px, py, pz, parent) { var me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = true; (parent || tb).add(me); return me; }
    var bodyG = new THREE.SphereGeometry(1, 20, 14); bodyG.rotateX(PI / 2);
    body = part(bodyG, fur, 0, 0.2, 0); body.scale.set(0.1, 0.085, 0.21);
    part(new THREE.SphereGeometry(1, 14, 10), light, 0, 0.19, 0.13).scale.set(0.07, 0.07, 0.07);   // 心口
    head.position.set(0, 0.25, 0.22); tb.add(head);
    part(new THREE.SphereGeometry(0.072, 18, 14), fur, 0, 0.03, 0.02, head).scale.set(1, 0.9, 0.95);
    part(new THREE.SphereGeometry(0.032, 12, 8), light, 0, 0.005, 0.075, head).scale.set(1.2, 0.8, 0.8);   // 口鼻
    part(new THREE.SphereGeometry(0.008, 8, 6), mat(0xC97B7B), 0, 0.02, 0.1, head);
    mouth = part(new THREE.SphereGeometry(0.018, 10, 8), mat(0x3A1A1A), 0, -0.016, 0.088, head);
    tongue = part(new THREE.BoxGeometry(0.018, 0.005, 0.032), mat(0xE07A86, { roughness: 0.5 }), 0, -0.018, 0.1, head);
    [-1, 1].forEach(function (s) {
      eyes.push(part(new THREE.SphereGeometry(0.012, 10, 8), mat(0xC8D44A, { emissive: 0x6A7A10, emissiveIntensity: 0.4, roughness: 0.2 }), s * 0.03, 0.04, 0.08, head));
      part(new THREE.ConeGeometry(0.028, 0.055, 4), base, s * 0.04, 0.1, 0.01, head).rotation.z = -s * 0.3; });
    [[0.05, 0.13], [-0.05, 0.13], [0.05, -0.14], [-0.05, -0.14]].forEach(function (p) {   // 左前、右前、左後、右後
      var hip = new THREE.Group(); hip.position.set(p[0], 0.17, p[1]); tb.add(hip);
      part(new THREE.CylinderGeometry(0.02, 0.018, 0.16, 8), base, 0, -0.08, 0, hip);
      part(new THREE.SphereGeometry(0.024, 8, 6), light, 0, -0.155, 0.01, hip).scale.set(1, 0.6, 1.3);
      legs.push(hip); });
    tailRoot.position.set(0, 0.23, -0.2); tb.add(tailRoot);
    for (var n = 0, p = tailRoot; n < 7; n++) { var seg = new THREE.Group(); seg.position.y = n ? 0.045 : 0; seg.rotation.x = n ? 0.12 : 0; p.add(seg);
      part(new THREE.CylinderGeometry(0.016, 0.018, 0.047, 8), n % 2 ? dark : base, 0, 0.0225, 0, seg); tail.push(seg); p = seg; }
  })();
  scene.add(g3);

  /* ---------- 講嘢 ---------- */
  function say(text, secs) { if (!sayEl) return; sayEl.textContent = text || ''; sayEl.hidden = !text; sayHide = text && secs ? st.t + secs : 0; }

  /* ---------- 動作 ---------- */
  function startAct(k, dur, o) { st.act = { k: k, t: 0, dur: dur }; if (o) for (var q in o) st.act[q] = o[q]; if (k === 'sleep' && mode === 'wander') say('Zzz…'); }
  function faceFreeTurn() { for (var a = 0; a < 6; a++) { var th = st.h + (Math.random() - 0.5) * 3; if (free[cellOf(st.x + Math.sin(th) * 0.3, st.z + Math.cos(th) * 0.3)]) return th; } return null; }   // 個頭要轉到去空位
  function perchSpot(pc) {   // 傢俬面上最近起跳位嘅一點（向入縮少少，唔好企喺邊）
    var p = pc.p, co = Math.cos(p[4] || 0), si = Math.sin(p[4] || 0), dx = st.x - p[0], dz = st.z - p[1];
    var inX = Math.min(0.18, p[2] * 0.6), inZ = Math.min(0.18, p[3] * 0.6);
    var lx = Math.max(-p[2] + inX, Math.min(p[2] - inX, dx * co - dz * si)), lz = Math.max(-p[3] + inZ, Math.min(p[3] - inZ, dx * si + dz * co));
    return [p[0] + lx * co + lz * si, p[5], p[1] - lx * si + lz * co];
  }
  function jump(to, o) {
    var dist = Math.hypot(to[0] - st.x, to[2] - st.z), T = 0.38 + dist * 0.25 + Math.abs(to[1] - st.y) * 0.15;
    var a = { from: [st.x, st.y, st.z], to: to, hgt: 0.16 + Math.max(0, to[1] - st.y) * 0.25 + (dist < 0.05 ? 0.08 : 0), c: 0.28, T: T, l: 0.2 };
    if (dist > 0.05) st.turn = Math.atan2(to[0] - st.x, to[2] - st.z);
    for (var q in o) a[q] = o[q];
    startAct('jump', a.c + a.T + a.l, a);
  }
  function jumpUp(pc) { st.launch = [st.x, st.z]; jump(perchSpot(pc), { up: true, perch: pc }); }
  function jumpDown() {
    var l = st.launch, g = l ? nearestFree(l[0], l[1]) : nearestFree(st.x, st.z);
    jump(g >= 0 ? [cX(g), 0, cZ(g)] : [st.x, 0, st.z], { up: false });
  }
  function findPerch() {   // 行得到、又唔太遠嘅傢俬
    var s = cellOf(st.x, st.z), r = bfs(s, false), ok = perches.filter(function (pc) { return pc.launch >= 0 && r.dist[pc.launch] >= 0 && r.dist[pc.launch] * G <= 4; });
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
  }
  function idle(list) {
    var a = pick(list), k = a[0];
    if (k === 'perch') {
      var pc = findPerch();
      if (pc) { if (cellOf(st.x, st.z) === pc.launch) { jumpUp(pc); return; } if (goTo(pc.launch)) { st.plan = pc; return; } }
      k = 'look'; a = ['look', 1, 1, 3];
    }
    if (k === 'hop') { jump([st.x, 0, st.z], { up: false, hop: true }); return; }
    if (k === 'look') st.turn = faceFreeTurn();
    startAct(k, rand(a[2], a[3]), k === 'sleep' ? { chain: Math.random() < 0.7 ? ['stretch', 'yawn'] : ['stretch'] } : null);   // 瞓醒伸個懶腰
  }
  function arrive() {
    if (st.plan) { var pc = st.plan; st.plan = null; jumpUp(pc); return; }
    if (mode === 'tour' && stopI >= 0 && stopI < stops.length) {
      var s = stops[stopI]; say(s.say);
      st.turn = cam ? Math.atan2(cam.position.x - st.x, cam.position.z - st.z) : null;   // 好似地產經紀咁坐低、望住客講
      startAct('sit', s.wait || Math.min(10, Math.max(4, s.say.length * 0.12)), { speak: true });
      return;
    }
    idle(IDLE[mode] || IDLE.wander);
  }
  function next() {
    if (mode === 'tour') {
      stopI++;
      if (stopI >= stops.length) { var cb = onEnd; onEnd = null; setMode('wander'); if (cb) cb(); return; }
      var s = stops[stopI]; if (goTo(nearestFree(s.x, s.z))) say('請跟我嚟～', 1.8); else arrive();
      return;
    }
    if (!randomTrip()) startAct('look', 1);
  }
  function endAct() {
    var a = st.act; st.act = null; st.turn = null;
    if (a.k === 'sleep') say('');
    if (a.chain && a.chain.length) { var n = a.chain.shift(); startAct(n, n === 'stretch' ? 2.6 : 2.2, { chain: a.chain }); return; }
    if (a.k === 'jump') {
      st.fy = null; st.x = a.to[0]; st.z = a.to[2]; st.y = a.to[1];
      if (a.up) { st.perch = a.perch; st.perchLeft = mode === 'zoom' ? 1 : 1 + (Math.random() < 0.5 ? 1 : 0); }
      else { st.perch = null; st.y = 0; next(); return; }
    }
    if (st.perch) {
      if (mode !== 'tour' && st.perchLeft-- > 0) { if (mode === 'zoom') startAct('look', 0.3); else idle(ONPERCH); }
      else jumpDown();
      return;
    }
    next();
  }
  function setMode(m) {
    if (!MODES[m]) return; mode = m; M = MODES[m]; st.path = []; st.plan = null; st.turn = null;
    if (st.act && st.act.k === 'sleep') say('');
    if (m !== 'tour') { stops = []; stopI = -1; onEnd = null; say(''); }
    if (st.act && st.act.k === 'jump') return;   // 跳緊就等佢落地先，落地之後會照新模式做
    st.act = null;
    if (st.y > 0.01) { st.perchLeft = 0; jumpDown(); } else startAct('look', 0.05);
  }
  function startTour(list, cb) { setMode('tour'); stops = list; stopI = -1; onEnd = cb || null; }

  /* ---------- 每格更新 ---------- */
  function update(dt, camera) {
    var sp = 0, turn = 0, a = st.act, tgt = POSE.stand, sweep = 0, tongueOn = false, rate = 5;
    st.t += dt; cam = camera;
    if (sayHide && st.t > sayHide) say('');
    if (a) {
      a.t += dt;
      if (st.turn !== null) turn = angDiff(st.turn, st.h);
      if (a.k === 'jump') {
        rate = 14;
        if (a.t < a.c) tgt = POSE.crouch;
        else if (a.t < a.c + a.T) { var s = (a.t - a.c) / a.T; tgt = POSE.air; st.x = a.from[0] + (a.to[0] - a.from[0]) * s; st.z = a.from[2] + (a.to[2] - a.from[2]) * s; st.fy = a.from[1] + (a.to[1] - a.from[1]) * s + a.hgt * 4 * s * (1 - s); }
        else { tgt = POSE.crouch; st.fy = null; st.x = a.to[0]; st.z = a.to[2]; st.y = a.to[1]; }
      } else if (a.k === 'groom') { tgt = Math.floor(a.t / 2.4) % 2 ? POSE.lick : POSE.groom; tongueOn = Math.sin(st.t * 16) > 0.2 && a.t > 0.6; }
      else if (a.k === 'yawn') { tgt = POSE.yawn; tongueOn = a.t > 0.5 && a.t < a.dur - 0.4; }
      else if (a.k === 'look') { tgt = POSE.stand; sweep = 1; }
      else tgt = POSE[a.k] || POSE.stand;
      if (a.t >= a.dur) endAct();
    } else if (st.path.length) {
      var p = st.path[0], dx = p[0] - st.x, dz = p[1] - st.z, d = Math.hypot(dx, dz);
      if (d < Math.max(0.04, M.sp * dt)) { st.x = p[0]; st.z = p[1]; st.path.shift(); st.stuck = 0; if (!st.path.length) arrive(); }
      else {
        turn = angDiff(Math.atan2(dx, dz), st.h); var cs = Math.cos(turn);
        sp = Math.abs(turn) > 0.7 ? 0 : M.sp * cs * cs;   // 要轉大彎就先原地轉
        var step = Math.min(sp * dt, d);
        if (step > 0) { var nx = st.x + dx / d * step, nz = st.z + dz / d * step; if (free[cellOf(nx, nz)] || !free[cellOf(st.x, st.z)]) { st.x = nx; st.z = nz; st.stuck = 0; } else st.stuck += dt; }   // 一定沿住路線行；本身企咗喺障礙邊就准行出嚟
        else if (Math.abs(turn) < 0.05) st.stuck += dt;
        if (st.stuck > 0.6) { st.path = []; st.plan = null; st.stuck = 0; var g0 = nearestFree(st.x, st.z); if (g0 >= 0) { st.x = cX(g0); st.z = cZ(g0); } if (mode === 'tour' && stopI >= 0) stopI--; next(); }   // 卡住就重新搵路
      }
    } else next();
    var tr = Math.max(-(a && a.k === 'jump' ? 9 : M.turn) * dt, Math.min((a && a.k === 'jump' ? 9 : M.turn) * dt, turn)); st.h += tr;
    var moving = sp > 0.02 || (Math.abs(tr) > 0.002 && !(a && a.k !== 'look'));
    st.amp += ((moving ? 1 : 0) - st.amp) * Math.min(1, dt * 6); st.ph += sp * dt * M.stride + Math.abs(tr) * 3;
    var k = 1 - Math.exp(-dt * rate); for (var q in BASE) P[q] += (tgt[q] - P[q]) * k;

    g3.position.set(st.x, 0, st.z); g3.rotation.y = st.h;
    lift.position.y = (st.fy !== null ? st.fy : st.y) + Math.abs(Math.sin(st.ph)) * M.bob * st.amp;
    torso.position.y = 0.17 + P.drop; torso.rotation.set(P.pitch, 0, P.roll);
    var sw = mode === 'zoom' ? 0.8 : 0.55;
    legs.forEach(function (l, i) { l.rotation.x = (i < 2 ? P.legF : P.legH) - (i === 0 ? 1.9 * P.paw : 0) + Math.sin(st.ph + M.legs[i]) * sw * st.amp; });
    var asleep = a && a.k === 'sleep';
    tailRoot.rotation.x = P.tailUp;
    tail.forEach(function (s, n) { s.rotation.z = Math.sin(st.t * (moving ? 3 : asleep ? 0.6 : 1.4) - n * 0.6) * (asleep ? 0.03 : 0.12) + P.curl * 0.32; });
    head.rotation.set(P.headP, P.headY + Math.sin(st.t * 0.7) * 0.45 * sweep * (1 - st.amp) * (mode === 'tour' ? 0.3 : 1), 0);   // 企定定嗰陣左望右望
    eyes.forEach(function (e) { e.scale.y = Math.max(0.12, P.eyes); });
    mouth.visible = P.mouth > 0.05; mouth.scale.set(1.1, Math.max(0.05, P.mouth), 0.6);
    tongue.visible = tongueOn; tongue.position.z = a && a.k === 'yawn' ? 0.092 : 0.104;
    body.scale.y = 0.085 * (1 + (asleep || (a && a.k === 'loaf') ? 0.05 * Math.sin(st.t * 2.2) : 0));   // 瞓覺時抖氣
  }

  /* ---------- 鏡頭同對話框 ---------- */
  function eyeCam(camera, controls) {   // 貓咪視角：鏡頭放喺貓眼，跟住個頭望
    g3.updateMatrixWorld(true); head.getWorldPosition(v);
    var yaw = st.h + head.rotation.y, pit = P.pitch + P.headP, cp = Math.cos(pit);
    camera.position.set(v.x + Math.sin(yaw) * 0.08, v.y + 0.03, v.z + Math.cos(yaw) * 0.08);
    controls.target.set(camera.position.x + Math.sin(yaw) * cp * 2, camera.position.y - Math.sin(pit) * 2 + 0.1, camera.position.z + Math.cos(yaw) * cp * 2);
    camera.lookAt(controls.target);
  }
  /* 帶參觀：鏡頭一直跟住隻貓。hold = 用戶啱啱自己轉過鏡頭，咁就只係跟住移位、保留佢揀嘅角度 */
  function follow(camera, controls, dt, b, hold) {
    v2.set(st.x, lift.position.y + 0.22, st.z);
    v3.copy(controls.target); controls.target.lerp(v2, 1 - Math.exp(-dt * 8)); v3.subVectors(controls.target, v3); camera.position.add(v3);   // 鏡頭同目標一齊移
    var walking = st.path.length > 0 && !st.act, far = camera.position.distanceTo(controls.target) > 2.6;
    if (hold || !(walking || far)) return;
    var px, pz, py = Math.min(lift.position.y + 1.0, b.h - 0.2), lim = function (x, lo, hi) { return Math.max(lo + 0.25, Math.min(hi - 0.25, x)); };
    if (walking) {
      var A = [0, 0.5, -0.5, 1, -1, 1.5, -1.5];   // 正後面貼牆冇位，就揀側後方，免得變咗由頭頂望落去
      for (var i = 0; i < A.length; i++) { px = st.x - Math.sin(st.h + A[i]) * 1.6; pz = st.z - Math.cos(st.h + A[i]) * 1.6; if (px > b.x0 + 0.25 && px < b.x1 - 0.25 && pz > b.z0 + 0.25 && pz < b.z1 - 0.25) break; }
    } else { v.subVectors(camera.position, controls.target).setY(0); if (v.lengthSq() < 1e-4) v.set(0, 0, 1); v.setLength(1.8); px = st.x + v.x; pz = st.z + v.z; }   // 停低：由而家個方向拉近
    v.set(lim(px, b.x0, b.x1), py, lim(pz, b.z0, b.z1)); camera.position.lerp(v, 1 - Math.exp(-dt * (far ? 3 : 1.8)));
  }
  function place(camera, w, h, fixed) {
    if (!sayEl || sayEl.hidden) return;
    var x = w / 2, y = 12;
    if (!fixed) { v.set(st.x, lift.position.y + 0.5, st.z).project(camera); if (v.z < 1 && Math.abs(v.x) < 1.1 && v.y < 1.05 && v.y > -1.1) { x = (v.x * 0.5 + 0.5) * w; y = (-v.y * 0.5 + 0.5) * h; } else fixed = true; }
    var m = Math.min(140, w / 2), cx = Math.max(m, Math.min(w - m, x));
    var tm = Math.max(0, sayEl.offsetWidth / 2 - 16); sayEl.style.setProperty('--tail', Math.max(-tm, Math.min(tm, x - cx)).toFixed(1) + 'px'); x = cx;   // 對話框貼邊時，個尖角照樣指住隻貓
    sayEl.classList.toggle('fixed', !!fixed); sayEl.style.left = x.toFixed(1) + 'px'; sayEl.style.top = y.toFixed(1) + 'px';
  }

  return { group: g3, state: st, setNav: setNav, update: update, setMode: setMode, mode: function () { return mode; }, startTour: startTour, eyeCam: eyeCam, follow: follow, place: place, say: say };
}
window.TabbyCat = { create: create };
})();
