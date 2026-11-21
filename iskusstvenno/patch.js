/* gorecz — искусственно: патч-панель вместо четырёх ползунков.
   Четыре гнезда, четыре кабеля. Возьми штекер и воткни его в гнездо: эффект включился. Выдерни: выключился.
   Уровень: колесо над гнездом или тяни гнездо вверх/вниз (клавиатура: стрелки, Enter). Звук и картинка слушают те же <input data-fx>, движок не менялся. */
(() => {
  const mix = document.getElementById('mix'); if (!mix) return;
  const inputs = [...mix.querySelectorAll('[data-fx]')]; if (inputs.length !== 4) return;
  const NAMES = inputs.map((i) => i.getAttribute('aria-label')), COL = ['#7fd4ff', '#62c6dc', '#a6d4ff', '#c8ecff'], N = 16;
  mix.classList.add('has-patch');
  const note = document.getElementById('fxNote'); if (note && !note.textContent.trim()) note.textContent = 'воткни штекер в гнездо · тяни гнездо вверх/вниз или крути колесо — уровень';
  const panel = document.createElement('div'); panel.className = 'patch'; mix.insertBefore(panel, mix.firstChild);
  const jacks = NAMES.map((name, i) => {
    const j = document.createElement('div'); j.className = 'jack'; j.tabIndex = 0; j.setAttribute('role', 'slider'); j.setAttribute('aria-label', name);
    j.setAttribute('aria-valuemin', '0'); j.setAttribute('aria-valuemax', '100'); j.setAttribute('aria-valuenow', '0'); j.style.setProperty('--c', COL[i]); j.dataset.i = i;
    j.innerHTML = '<span class="hole"><i class="led"></i></span><b>' + name + '</b><small>выдернут</small>'; panel.appendChild(j); return j;
  });
  const dock = document.createElement('i'); dock.className = 'dock'; panel.appendChild(dock);
  inputs.forEach((x) => { x.tabIndex = -1; x.setAttribute('aria-hidden', 'true'); });
  const cv = document.createElement('canvas'); cv.id = 'patchCables'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4'; document.body.appendChild(cv);
  const ctx = cv.getContext('2d'); let W = 0, H = 0, dpr = 1, visible = false, last = performance.now(), drag = -1, knob = -1, kY = 0, kLv = 0, moved = 0, downAt = null;
  const lv = [0, 0, 0, 0], lastLv = [.7, .7, .7, .7], plug = inputs.map(() => ({ x: 0, y: 0, mode: 'dock' })), ropes = inputs.map(() => ({ P: [], rest: 1 })), px = { x: -1e4, y: -1e4 };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const geo = (i) => {
    const r = panel.getBoundingClientRect(), h = jacks[i].querySelector('.hole').getBoundingClientRect(), J = { x: h.left + h.width / 2, y: h.top + h.height / 2 };
    return { J, R: h.width / 2, D: { x: J.x, y: J.y + 68 }, A: { x: r.left - 22, y: r.bottom - 14 - i * 6 }, IN: { x: J.x, y: J.y + 26 } };
  };
  // geometry for the per-frame code: the panel rectangle is read once per frame, the sockets' offsets inside it once per layout
  let mf = 0, PR = null; const HOFF = [];
  const measure = () => { const r = panel.getBoundingClientRect(); jacks.forEach((j, i) => { const h = j.querySelector('.hole').getBoundingClientRect(); HOFF[i] = { dx: h.left + h.width / 2 - r.left, dy: h.top + h.height / 2 - r.top, R: h.width / 2 }; }); };
  const geoF = (i) => { const o = HOFF[i]; if (!o) return geo(i); const r = PR || panel.getBoundingClientRect(), J = { x: r.left + o.dx, y: r.top + o.dy }; return { J, R: o.R, D: { x: J.x, y: J.y + 68 }, A: { x: r.left - 22, y: r.bottom - 14 - i * 6 }, IN: { x: J.x, y: J.y + 26 } }; };
  function setLevel(i, v, silent) {
    v = clamp(v, 0, 1); lv[i] = v; if (v > 0) lastLv[i] = v; const j = jacks[i]; j.style.setProperty('--lv', v.toFixed(2)); j.classList.toggle('on', v > 0); j.setAttribute('aria-valuenow', Math.round(v * 100));
    j.querySelector('.hole').style.cursor = v > 0 ? 'ns-resize' : 'pointer';
    j.querySelector('small').textContent = v > 0 ? Math.round(v * 100) + '%' : 'выдернут';
    if (!silent) { inputs[i].value = v.toFixed(2); inputs[i].dispatchEvent(new Event('input', { bubbles: true })); }
    if (v > 0 && plug[i].mode !== 'drag') plug[i].mode = 'in'; if (v === 0 && plug[i].mode === 'in') plug[i].mode = 'back';
  }
  inputs.forEach((x, i) => x.addEventListener('input', () => { if (Math.abs(lv[i] - +x.value) > 0.005) setLevel(i, +x.value, true); }));
  function layout() {
    measure();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ropes.forEach((R, i) => {
      const g = geo(i), d = Math.hypot(g.D.x - g.A.x, g.D.y - g.A.y); R.rest = d * 1.2 / (N - 1); R.P = [];
      for (let k = 0; k < N; k++) { const u = k / (N - 1), x = g.A.x + (g.D.x - g.A.x) * u, y = g.A.y + (g.D.y - g.A.y) * u + Math.sin(Math.PI * u) * d * 0.12; R.P.push({ x, y, ox: x, oy: y }); }
      plug[i].x = g.D.x; plug[i].y = g.D.y;
    });
  }
  addEventListener('resize', layout); layout(); new ResizeObserver(layout).observe(panel);
  new IntersectionObserver((e) => {
    visible = e[0].isIntersecting;
    if (visible) { layout(); }
    else { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); }
  }, { threshold: 0.01 }).observe(panel);

  const dead = () => mix.classList.contains('nofx');
  addEventListener('pointerdown', (e) => {
    if (dead()) return; px.x = e.clientX; px.y = e.clientY; downAt = { x: e.clientX, y: e.clientY }; moved = 0;
    for (let i = 0; i < 4; i++) {
      const g = geo(i), hit = plug[i].mode === 'in' ? Math.hypot(g.J.x - e.clientX, g.J.y + 40 - e.clientY) < 15 : Math.hypot(plug[i].x - e.clientX, plug[i].y - e.clientY) < 26;
      if (hit) { drag = i; if (lv[i] > 0) { lastLv[i] = lv[i]; setLevel(i, 0); } plug[i].mode = 'drag'; e.preventDefault(); return; }
    }
    const j = e.target.closest && e.target.closest('.jack'); if (j && lv[+j.dataset.i] > 0 && e.target.closest('.hole')) { knob = +j.dataset.i; kY = e.clientY; kLv = lv[knob]; e.preventDefault(); }
  });
  addEventListener('pointermove', (e) => {
    px.x = e.clientX; px.y = e.clientY; if (downAt) moved = Math.max(moved, Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y));
    if (drag >= 0) { plug[drag].x = e.clientX; plug[drag].y = e.clientY; }
    if (knob >= 0) setLevel(knob, kLv + (kY - e.clientY) / 140);
  }, { passive: true });
  addEventListener('pointerup', (e) => {
    if (drag >= 0) { const i = drag, g = geo(i); drag = -1; if (Math.hypot(e.clientX - g.J.x, e.clientY - g.J.y) < 48 || (moved < 4 && Math.hypot(e.clientX - g.D.x, e.clientY - g.D.y) < 26)) { plug[i].mode = 'in'; setLevel(i, lastLv[i] || .7); } else plug[i].mode = 'back'; }
    else if (knob < 0 && downAt && moved < 4) { const j = e.target.closest && e.target.closest('.jack'); if (j && e.target.closest('.hole') && lv[+j.dataset.i] === 0) setLevel(+j.dataset.i, lastLv[+j.dataset.i] || .7); }
    knob = -1; downAt = null;
  });
  panel.addEventListener('wheel', (e) => { const j = e.target.closest('.jack'); if (!j || dead()) return; const i = +j.dataset.i; if (lv[i] > 0) { e.preventDefault(); setLevel(i, lv[i] - e.deltaY * 0.0008); } }, { passive: false });
  jacks.forEach((j, i) => j.addEventListener('keydown', (e) => {
    const up = e.key === 'ArrowUp' || e.key === 'ArrowRight', dn = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (up) setLevel(i, lv[i] ? lv[i] + .1 : .5); else if (dn) setLevel(i, lv[i] - .1); else if (e.key === 'Enter' || e.key === ' ') setLevel(i, lv[i] ? 0 : (lastLv[i] || .7)); else return; e.preventDefault();
  }));

  function step(i, t) {
    const R = ropes[i], P = R.P, g = geoF(i), p = plug[i], target = p.mode === 'in' ? g.IN : p.mode === 'drag' ? { x: p.x, y: p.y } : g.D;
    if (p.mode === 'back') { p.x += (g.D.x - p.x) * .18; p.y += (g.D.y - p.y) * .18; if (Math.hypot(p.x - g.D.x, p.y - g.D.y) < 1.5) p.mode = 'dock'; target.x = p.x; target.y = p.y; }
    else if (p.mode !== 'drag') { p.x += (target.x - p.x) * .35; p.y += (target.y - p.y) * .35; target.x = p.x; target.y = p.y; }
    const reach = R.rest * (N - 1) * .985, dx0 = target.x - g.A.x, dy0 = target.y - g.A.y, d0 = Math.hypot(dx0, dy0); if (d0 > reach) { target.x = g.A.x + dx0 / d0 * reach; target.y = g.A.y + dy0 / d0 * reach; if (p.mode === 'drag') { p.x = target.x; p.y = target.y; } }
    for (let k = 1; k < N - 1; k++) { const n = P[k], vx = (n.x - n.ox) * .97, vy = (n.y - n.oy) * .97; n.ox = n.x; n.oy = n.y; n.x += vx + Math.sin(t * .6 + k * .3 + i) * .02; n.y += vy + .45; }
    P[0].x = g.A.x; P[0].y = g.A.y; P[N - 1].x = target.x; P[N - 1].y = target.y;
    for (let it = 0; it < 10; it++) {
      for (let k = 0; k < N - 1; k++) {
        const a = P[k], b = P[k + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - R.rest) / d * .5, wa = k === 0 ? 0 : 1, wb = k + 1 === N - 1 ? 0 : 1, s = wa + wb || 1;
        a.x += dx * f * 2 * wa / s; a.y += dy * f * 2 * wa / s; b.x -= dx * f * 2 * wb / s; b.y -= dy * f * 2 * wb / s;
      }
      for (let k = 0; k < N - 2; k++) {
        const a = P[k], b = P[k + 2], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - R.rest * 1.94) / d * .06, wa = k === 0 ? 0 : 1, wb = k + 2 === N - 1 ? 0 : 1, s = wa + wb || 1;
        a.x += dx * f * 2 * wa / s; a.y += dy * f * 2 * wa / s; b.x -= dx * f * 2 * wb / s; b.y -= dy * f * 2 * wb / s;
      }
    }
  }

  // Кольцевой индикатор уровня вокруг гнезда (0%..100% по часовой стрелке на 270°)
  function drawRing(i) {
    const g = geoF(i), c = ctx, r = Math.max(18, g.R + 5), a0 = Math.PI * 0.75, span = Math.PI * 1.5;
    const active = knob === i, v = lv[i];

    c.save();
    // Фоновая дуга шкалы
    c.beginPath(); c.arc(g.J.x, g.J.y, r, a0, a0 + span);
    c.strokeStyle = v > 0 ? 'rgba(180,220,245,.22)' : 'rgba(180,220,245,.08)';
    c.lineWidth = 2; c.stroke();

    // Активная заполненная дуга + светящийся маркер
    if (v > 0) {
      const a1 = a0 + span * v;
      c.beginPath(); c.arc(g.J.x, g.J.y, r, a0, a1);
      c.strokeStyle = COL[i];
      c.lineWidth = active ? 2.8 : 2.2;
      c.shadowColor = COL[i];
      c.shadowBlur = active ? 12 : 6;
      c.stroke();

      // Яркая точка на текущем значении
      const tx = g.J.x + Math.cos(a1) * r, ty = g.J.y + Math.sin(a1) * r;
      c.beginPath(); c.arc(tx, ty, active ? 3.2 : 2.4, 0, Math.PI * 2);
      c.fillStyle = '#ffffff'; c.fill();
    }
    c.restore();
  }

  function draw(i, t) {
    const P = ropes[i].P, p = plug[i], c = ctx, path = () => { c.beginPath(); c.moveTo(P[0].x, P[0].y); for (let k = 1; k < N - 1; k++) c.quadraticCurveTo(P[k].x, P[k].y, (P[k].x + P[k + 1].x) / 2, (P[k].y + P[k + 1].y) / 2); c.lineTo(P[N - 1].x, P[N - 1].y); };
    c.save(); c.translate(0, 6); c.strokeStyle = 'rgba(1,5,10,.22)'; c.lineWidth = 5; path(); c.stroke(); c.restore();
    c.strokeStyle = '#010509'; c.lineWidth = 3; path(); c.stroke(); c.save(); c.translate(0, -.9); c.strokeStyle = 'rgba(150,200,232,.3)'; c.lineWidth = .9; c.setLineDash([3, 5]); path(); c.stroke(); c.restore();
    const e = P[N - 1], q = P[N - 3]; let ang = (p.mode === 'drag' || p.mode === 'back') ? Math.atan2(e.x - q.x, -(e.y - q.y)) : 0; const glow = lv[i] > 0 ? .35 + lv[i] * .6 + (i === 2 ? (Math.sin(t * 40) > .3 ? .2 : -.2) : 0) : .12;
    c.save(); c.translate(e.x, e.y); c.rotate(ang); c.fillStyle = '#050d14'; c.strokeStyle = 'rgba(160,215,240,.5)'; c.lineWidth = 1; c.beginPath(); c.roundRect(-5.5, -4, 11, 22, 3); c.fill(); c.stroke();
    c.fillStyle = '#9dbfd0'; c.fillRect(-2, -17, 4, 14); c.fillStyle = '#d6edf7'; c.fillRect(-1, -17, 1.4, 14);
    const gr = c.createRadialGradient(0, 9, 0, 0, 9, 15); gr.addColorStop(0, COL[i].replace('#', '#') + Math.round(clamp(glow, 0, 1) * 255).toString(16).padStart(2, '0')); gr.addColorStop(1, COL[i] + '00'); c.fillStyle = gr; c.beginPath(); c.arc(0, 9, 15, 0, 6.3); c.fill(); c.restore();
  }
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now; if (!visible) return; const t = now / 1000; PR = panel.getBoundingClientRect(); if ((mf++ % 45) === 0) measure();       // sockets can move inside the panel (fonts, reveal animation): re-measure now and then
    for (let i = 0; i < 4; i++) { step(i, t); step(i, t); }
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); ctx.clearRect(0, 0, W, H); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 4; i++) drawRing(i);
    for (let i = 0; i < 4; i++) draw(i, t);
  }
  document.fonts && document.fonts.ready.then(measure);
  window.__patch = { geoCheck: () => [0, 1, 2, 3].map((i) => { const a = geo(i), b = geoF(i); return +Math.hypot(a.J.x - b.J.x, a.J.y - b.J.y).toFixed(2); }), plug: (i) => ({ x: plug[i].x, y: plug[i].y, mode: plug[i].mode }), jack: (i) => geo(i).J, level: (i) => lv[i] };
  requestAnimationFrame(frame);
})();