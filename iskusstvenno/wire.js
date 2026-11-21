/* Кабели принадлежат hero: верхние концы уходят вверх вместе со страницей, так что дальше по странице их нет.
   gorecz — искусственно: пучок кабелей, как на обложке. Верёвочная физика (verlet) с жёсткостью на изгиб, поэтому кабели провисают плавно, без рывков.
   На басе и ударе волны их раскачивает вбок, мышкой можно оттолкнуть или схватить; на ударе у разъёмов вспыхивают светодиоды, а у оборванного конца летят искры. */
(() => {
  const tt = document.getElementById('tt'), vid = document.getElementById('bgv');
  if (!tt) return;
  const cv = document.createElement('canvas'); cv.id = 'wire';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;opacity:0;transition:opacity 2s ease';
  window.__wireCanvas = cv; document.body.appendChild(cv); setTimeout(() => { cv.style.opacity = '1'; }, 1400);
  const ctx = cv.getContext('2d'), N = 40, sparks = [];
  let wasOff = false, SY = 0, W = 0, H = 0, dpr = 1, grab = null, mx = -1e4, my = -1e4, pvx = 0, pvy = 0, last = performance.now(), acc = 0;
  const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  // a: where the cable leaves the ceiling; b: its socket on the deck's left edge (null = a loose, frayed end); w: thickness; far: thin and pale, farther from us
  const CFG = [
    { a: (W, H) => ({ x: W * .46, y: -H * .05 - SY }), b: (r) => ({ x: r.left + r.width * .038, y: r.top + r.height * .40 }), slack: 1.05, w: 1.5, far: 1 },
    { a: (W, H) => ({ x: W * .18, y: -H * .05 - SY }), b: (r) => ({ x: r.left + r.width * .038, y: r.top + r.height * .64 }), slack: 1.07, w: 2.6 },
    { a: (W, H) => ({ x: W * .30, y: -H * .05 - SY }), b: (r) => ({ x: r.left + r.width * .038, y: r.top + r.height * .58 }), slack: 1.17, w: 3.4 },
    { a: (W, H) => ({ x: W * .385, y: -H * .05 - SY }), b: null, len: .40, w: 2.2 }
  ];
  const ropes = CFG.map((c, k) => ({ c, ph: k * 1.7, P: [], rest: 1 })); window.__ropes = ropes;
  let RT = null;                                              // the deck's rectangle, read once per frame
  const ends = (c) => { const r = RT || (RT = tt.getBoundingClientRect()); return [c.a(W, H), c.b ? c.b(r) : null]; };
  function layout() {
    RT = null;
    dpr = Math.min(devicePixelRatio || 1, 1) * 0.8; W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
    for (const R of ropes) {
      const [a, b] = ends(R.c); R.P = []; const d = b ? Math.hypot(b.x - a.x, b.y - a.y) : H * R.c.len; R.rest = (b ? d * R.c.slack : d) / (N - 1);
      for (let i = 0; i < N; i++) { const u = i / (N - 1), x = b ? a.x + (b.x - a.x) * u : a.x, y = b ? a.y + (b.y - a.y) * u + Math.sin(Math.PI * u) * d * 0.17 : a.y + d * u; R.P.push({ x, y, ox: x, oy: y }); }
    }
  }
  addEventListener('resize', layout); layout();
  addEventListener('pointermove', (e) => { pvx = e.clientX - mx; pvy = e.clientY - my; mx = e.clientX; my = e.clientY; if (grab) { grab.x = mx; grab.y = my; } }, { passive: true });
  addEventListener('pointerdown', (e) => { let bd = 28; grab = null; for (const R of ropes) R.P.forEach((p, i) => { const d = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (i > 0 && !(R.c.b && i === N - 1) && d < bd) { bd = d; grab = p; } }); }, { passive: true });
  addEventListener('pointerup', () => { grab = null; }, { passive: true });

  function step(R, t, bass, wave) {
    const P = R.P, c = R.c, [a, b] = ends(c), g = 0.42 * H / 800, free = !c.b;
    for (let i = 1; i < N; i++) {
      if (!free && i === N - 1) continue; const p = P[i], u = i / (N - 1), env = free ? u : Math.sin(Math.PI * u);
      const vx = (p.x - p.ox) * 0.972, vy = (p.y - p.oy) * 0.972; p.ox = p.x; p.oy = p.y;
      p.x += vx + Math.sin(t * 0.5 + i * 0.16 + R.ph) * 0.03 * (c.far ? 1.7 : 1) + (bass * 0.26 + wave * 0.6) * env * (c.far ? 0.6 : 1);   // a thump swings the cable sideways, it never lifts it
      p.y += vy + g;
      const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
      if (d < 80 && d > 0.1 && !grab) { const f = (1 - d / 80) * Math.min(30, Math.hypot(pvx, pvy)) * 0.05; p.x += dx / d * f; p.y += dy / d * f; }
    }
    P[0].x = a.x; P[0].y = a.y; if (b) { P[N - 1].x = b.x; P[N - 1].y = b.y; }
    const fixed = (i) => i === 0 || (!free && i === N - 1);
    const pull = (p, q, i, j, len, k) => { const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, f = (d - len) / d * k, wp = fixed(i) ? 0 : 1, wq = fixed(j) ? 0 : 1, s = wp + wq; if (!s) return;
      p.x += dx * f * wp / s; p.y += dy * f * wp / s; q.x -= dx * f * wq / s; q.y -= dy * f * wq / s; };
    for (let k = 0; k < 14; k++) {
      for (let i = 0; i < N - 1; i++) pull(P[i], P[i + 1], i, i + 1, R.rest, 1);
      for (let i = 0; i < N - 2; i++) pull(P[i], P[i + 2], i, i + 2, R.rest * 1.94, 0.12);          // bending stiffness: no sharp kinks
      if (grab) { const gp = P.find((q) => q === grab); if (gp) { gp.x = mx; gp.y = my; } }
    }
  }
  function draw(R, bass, wave) {
    const P = R.P, c = R.c, far = !!c.far, free = !c.b;
    const path = () => { ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); for (let i = 1; i < N - 1; i++) ctx.quadraticCurveTo(P[i].x, P[i].y, (P[i].x + P[i + 1].x) / 2, (P[i].y + P[i + 1].y) / 2); ctx.lineTo(P[N - 1].x, P[N - 1].y); };
    ctx.save(); ctx.translate(0, far ? 3 : 7); ctx.strokeStyle = far ? 'rgba(1,5,10,.10)' : 'rgba(1,5,10,.2)'; ctx.lineWidth = c.w + 2.4; path(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = far ? 'rgba(6,16,27,.62)' : '#010509'; ctx.lineWidth = c.w; path(); ctx.stroke();
    ctx.save(); ctx.translate(0, -c.w * .3); ctx.strokeStyle = far ? 'rgba(150,200,232,.16)' : 'rgba(150,200,232,.30)'; ctx.lineWidth = Math.max(.7, c.w * .3); ctx.setLineDash([3, 5]); path(); ctx.stroke(); ctx.restore();
    const e = P[N - 1], q = P[N - 3], ang = Math.atan2(e.y - q.y, e.x - q.x), glow = (0.22 + bass * 0.5 + wave * 0.75) * (far ? 0.6 : 1);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(ang);
    if (free) {                                                                 // frayed copper strands at the loose end
      ctx.strokeStyle = `rgba(150,225,250,${.35 + wave * .5})`; ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7 + Math.abs(k) * 1.5, k * 2.4); ctx.stroke(); }
    } else {
      const h = Math.max(6, c.w * 2.6); ctx.fillStyle = '#03090f'; ctx.strokeStyle = 'rgba(140,210,240,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-h * 1.4, -h / 2, h * 1.4, h, 2.5); ctx.fill(); ctx.stroke();
      const gr = ctx.createRadialGradient(-5, 0, 0, -5, 0, 20); gr.addColorStop(0, `rgba(130,225,255,${Math.min(.9, glow)})`); gr.addColorStop(1, 'rgba(130,225,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(-5, 0, 20, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }
  function frame(now) {
    SY = window.scrollY || 0; RT = null; requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    { const vt0 = vid ? vid.currentTime : 0; window.WAVE = sm(2.9, 3.5, vt0) * (1 - sm(4.0, 6.2, vt0)); }          // the wave signal keeps running even when the cables are asleep
    if (SY > H * 1.4) { if (!wasOff) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); wasOff = true; } acc = 0; return; }       // the cables are off screen: no physics, no drawing
    wasOff = false; acc += dt;
    const S = window.GS || {}, bass = S.bass || 0, vt = vid ? vid.currentTime : 0, wave = sm(2.9, 3.5, vt) * (1 - sm(4.0, 6.2, vt));
    window.WAVE = wave;                                      // the deck's shader reads this to flash with the wave
    const tip = ropes[3].P[N - 1], mid = ropes[2].P[(N * .55) | 0];
    if (wave > 0.25 && Math.random() < 0.3) for (let k = 0; k < 3; k++) { const o = Math.random() < .6 ? tip : mid; sparks.push({ x: o.x, y: o.y, vx: (Math.random() - .5) * 3, vy: -Math.random() * 2.2, l: 1 }); }
    if (bass > 0.7 && Math.random() < 0.06) sparks.push({ x: tip.x, y: tip.y, vx: (Math.random() - .5) * 2, vy: -Math.random() * 1.5, l: .8 });
    while (acc >= 1 / 60) { for (const R of ropes) step(R, now / 1000, bass, wave); acc -= 1 / 60; }
    pvx *= 0.8; pvy *= 0.8;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const R of [ropes[0], ropes[3], ropes[1], ropes[2]]) draw(R, bass, wave);
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.12; s.l -= 0.06; if (s.l <= 0) { sparks.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(160,235,255,${s.l})`; ctx.shadowColor = '#7ce0ff'; ctx.shadowBlur = 8; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 2.2, s.y - s.vy * 2.2); ctx.stroke(); ctx.shadowBlur = 0; }
  }
  requestAnimationFrame(frame);
})();
