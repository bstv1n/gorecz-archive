/* gorecz — искусственно: запотевшее стекло, ближе к настоящему конденсату.
   Туман рассеивает свет: пока стекло запотело, текст за ним размытый, а там, где стёрто, чёткий. Капли разных размеров с бликом и тёмным ободком,
   у стёртой полосы остаются бусины воды, сползающие капли тянут за собой чистую дорожку. Если мышь не двигается, стекло понемногу расчищается само. */
(() => {
  const host = document.querySelector('.about-body'); if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  host.style.position = 'relative';
  const mk = () => document.createElement('canvas'), cv = mk(), maskC = mk(), fogC = mk(), diffC = mk(), sharpC = mk(), beadC = mk(), tmpC = mk();
  cv.id = 'fogGlass'; host.appendChild(cv);
  const hint = document.createElement('p'); hint.className = 'fog-hint'; hint.textContent = 'стекло запотело · проведи курсором, чтобы стереть'; host.appendChild(hint);
  const ctx = cv.getContext('2d'), mx = maskC.getContext('2d'), bx = beadC.getContext('2d'), tx = tmpC.getContext('2d'), hover = matchMedia('(hover: hover)').matches, K = 0.75;
  let W = 0, H = 0, visible = false, idle = 0, regrow = 0, px = null, py = null, ax = null, ay = null, wiped = false, last = performance.now(), T = 0; const drips = [];
  window.__fog = { maskC };
  if (!hover) hint.remove();

  function drop(c, x, y, r, a = 1) {                                                           // one water drop: clear body, dark lower rim, bright specular, light bent through it
    c.save(); c.globalAlpha = a;
    c.fillStyle = 'rgba(8,22,36,.22)'; c.beginPath(); c.ellipse(x, y + r * 0.15, r * 1.05, r * (r > 3 ? 1.25 : 1.05), 0, 0, 6.3); c.fill();
    c.strokeStyle = 'rgba(4,14,24,.55)'; c.lineWidth = Math.max(0.6, r * 0.28); c.beginPath(); c.arc(x, y + r * 0.15, r * 0.95, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(235,247,255,.9)'; c.beginPath(); c.arc(x - r * 0.32, y - r * 0.36, Math.max(0.45, r * 0.24), 0, 6.3); c.fill();
    c.fillStyle = 'rgba(190,225,245,.35)'; c.beginPath(); c.arc(x + r * 0.35, y + r * 0.4, r * 0.22, 0, 6.3); c.fill(); c.restore();
  }
  function words() {                                                                           // the real text, word by word, with its exact position and style
    host.classList.remove('fogged'); const r = cv.getBoundingClientRect(), out = [];
    const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest('.fog-hint') ? 1 : 2) });
    for (let n; (n = w.nextNode());) { const cs = getComputedStyle(n.parentElement), re = /\S+/g; let m;
      while ((m = re.exec(n.nodeValue))) { const g = document.createRange(); g.setStart(n, m.index); g.setEnd(n, m.index + m[0].length); const b = g.getBoundingClientRect();
        if (b.width) out.push({ t: m[0], x: b.left - r.left, y: b.top - r.top, h: b.height, f: cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily, c: cs.color, ls: cs.letterSpacing }); } }
    host.classList.add('fogged'); return out;
  }
  function paint(c, list, blur) {
    c.clearRect(0, 0, W, H); c.setTransform(K, 0, 0, K, 0, 0); c.textBaseline = 'alphabetic';
    for (const o of list) { c.font = o.f; if ('letterSpacing' in c) c.letterSpacing = o.ls === 'normal' ? '0px' : o.ls; const asc = c.measureText(o.t).fontBoundingBoxAscent ?? o.h * 0.8; c.fillStyle = o.c;
      if (blur) { c.shadowColor = o.c; c.shadowBlur = 9; c.shadowOffsetX = 4000; c.fillText(o.t, o.x - 4000 / K, o.y + asc); c.shadowColor = 'transparent'; } else c.fillText(o.t, o.x, o.y + asc); }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  function build() {
    const cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return; W = Math.round(cw * K); H = Math.round(ch * K);
    [cv, maskC, fogC, diffC, sharpC, beadC, tmpC].forEach((c) => { c.width = W; c.height = H; });
    const list = words(); paint(sharpC.getContext('2d'), list, false); paint(diffC.getContext('2d'), list, true);
    const p = fogC.getContext('2d'), g = p.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(88,118,144,.66)'); g.addColorStop(1, 'rgba(70,100,128,.74)'); p.fillStyle = g; p.fillRect(0, 0, W, H);
    for (let i = 0; i < 16; i++) { const x = Math.random() * W, y = Math.random() * H, r = 60 + Math.random() * 140, b = p.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, 'rgba(170,200,222,.10)'); b.addColorStop(1, 'rgba(170,200,222,0)'); p.fillStyle = b; p.fillRect(x - r, y - r, 2 * r, 2 * r); }
    for (let i = 0, n = W * H / 90; i < n; i++) { p.fillStyle = 'rgba(205,228,244,' + (0.05 + Math.random() * 0.13) + ')'; p.fillRect(Math.random() * W, Math.random() * H, 1, 1); }        // micro-droplets: the frosty grain
    for (let i = 0, n = W * H / 900; i < n; i++) drop(p, Math.random() * W, Math.random() * H, 1 + Math.random() * Math.random() * 1.8, 0.9);
    for (let i = 0, n = W * H / 9000; i < n; i++) drop(p, Math.random() * W, Math.random() * H, 2.6 + Math.random() * Math.random() * 3.8, 1);
    mx.globalCompositeOperation = 'source-over'; mx.fillStyle = '#fff'; mx.fillRect(0, 0, W, H); bx.clearRect(0, 0, W, H);
  }
  const stamp = (x0, y0, x1, y1, r, a, beads) => {                                              // soft brush; the water pushed aside stays as beads along the edges
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(d / (r * 0.25))); mx.globalCompositeOperation = 'destination-out';
    for (let i = 1; i <= n; i++) { const x = x0 + dx * i / n, y = y0 + dy * i / n, g = mx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(0.55, 'rgba(0,0,0,' + a * 0.8 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); mx.fillStyle = g; mx.beginPath(); mx.arc(x, y, r, 0, 6.3); mx.fill();
      if (beads && d > 0.5 && Math.random() < 0.55) { const s = Math.random() < 0.5 ? -1 : 1, o = r * (0.85 + Math.random() * 0.25); drop(bx, x - dy / d * o * s, y + dx / d * o * s, 1.1 + Math.random() * Math.random() * 3.8, 1); } }
  };
  new ResizeObserver(build).observe(host); document.fonts && document.fonts.ready.then(build); build();
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) idle = 0; }, { threshold: 0.2 }).observe(host);
  addEventListener('pointermove', (e) => {
    if (!visible || e.pointerType === 'touch') return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    if (x < 0 || y < 0 || x > W || y > H) { px = null; return; }
    stamp(px ?? x, py ?? y, x, y, 52 * K, 0.35, true); px = x; py = y; idle = 0; ax = null; if (!wiped) { wiped = true; hint.classList.add('gone'); }
  }, { passive: true });
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last) / 1000); last = now; if (!visible || !W) return; T += dt; idle += dt;
    if (idle > (hover ? 6 : 1.5)) { const x = W * (0.5 + 0.46 * Math.sin(T * 0.31)), y = H * (0.5 + 0.38 * Math.sin(T * 0.19 + 1.2)); if (ax != null) stamp(ax, ay, x, y, 38 * K, 0.3, true); ax = x; ay = y; }   // nobody is wiping: the glass clears itself
    if ((regrow += dt) > 0.7) { regrow = 0; mx.globalCompositeOperation = 'source-over'; mx.fillStyle = 'rgba(255,255,255,.05)'; mx.fillRect(0, 0, W, H); bx.globalCompositeOperation = 'destination-out'; bx.fillStyle = 'rgba(0,0,0,.06)'; bx.fillRect(0, 0, W, H); bx.globalCompositeOperation = 'source-over'; }
    if (Math.random() < dt * 0.3) drips.push({ x: Math.random() * W, y: Math.random() * H * 0.55, v: 0.5, life: 50 + Math.random() * 110 });
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H); ctx.drawImage(fogC, 0, 0); ctx.drawImage(diffC, 0, 0); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(maskC, 0, 0);   // fog + blurred text, where it is fogged
    ctx.globalCompositeOperation = 'source-over';
    tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, W, H); tx.drawImage(sharpC, 0, 0); tx.globalCompositeOperation = 'destination-out'; tx.drawImage(maskC, 0, 0); ctx.drawImage(tmpC, 0, 0);   // sharp text, where it is wiped
    ctx.drawImage(beadC, 0, 0);
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i], y0 = d.y; d.v = Math.random() < 0.04 ? d.v * 0.15 : Math.min(2.4, d.v + 0.06); d.y += d.v; d.life--;       // stop-and-go, like a real drop
      stamp(d.x, y0, d.x, d.y, 1.1 * K + 0.5, 0.5, false); if (Math.random() < 0.1) drop(bx, d.x + (Math.random() < 0.5 ? -2.6 : 2.6), d.y - 3, 0.7 + Math.random() * 0.8, 0.9);
      drop(ctx, d.x, d.y, 3.4 * K + 1.6); if (d.life <= 0 || d.y > H) drips.splice(i, 1);
    }
  }
  requestAnimationFrame(frame);
})();
