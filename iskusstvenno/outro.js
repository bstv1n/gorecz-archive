/* gorecz — искусственно (archive 002) outro:
   0 s      лампа гаснет, страница уходит в глубину, тихо проступает далёкий шум прибоя
   ~2.2 s   поэтапное появление: сначала туман и горизонт → затем разгорается ядро маяка → мягко раскрывается луч и ссылки
   live     туман дрейфует, луч скользит по горизонту; при наведении на ссылку — плавно наводится и фокусируется на ней
   again    туман рассеивается, страница возвращается, трек запускается сначала. Esc / back — возврат без запуска. */
(() => {
  const S = window.GS;
  const screen = document.getElementById('end-screen'), cv = document.getElementById('outro-cv');
  const again = document.getElementById('end-replay'), back = document.getElementById('end-back');
  if (!S || !screen || !cv || !again || !back) return;
  const page = document.querySelector('.page'), audio = document.getElementById('audio'), body = document.body;
  const links = [...screen.querySelectorAll('.end-link')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cx = cv.getContext('2d');

  if (!document.getElementById('outro-clean-hover')) {
    const st = document.createElement('style');
    st.id = 'outro-clean-hover';
    st.textContent = `
      #end-screen .end-link, #end-screen .end-link::before, #end-screen .end-link::after {
        animation: none !important;
      }
      #end-screen .end-link {
        transition: color .35s ease, text-shadow .35s ease, opacity .5s ease !important;
      }
      #end-screen .end-link:hover, #end-screen .end-link:focus-visible {
        color: #f0f8ff !important;
        text-shadow: 0 0 14px rgba(175, 225, 250, .85), 0 0 32px rgba(130, 200, 240, .45) !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(st);
  }

  const OUT = { powerDown: 1100, collapse: 900, draw: 2800, surf: true };
  const TAU = Math.PI * 2;
  const BEAM = '175,225,250', CORE = '235,248,255', MIST = '26,48,68';
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const seg = (p, a, b) => ease(Math.max(0, Math.min(1, (p - a) / (b - a))));

  let phase = 'off', timers = [], W = 0, H = 0, anchors = [], hold = -1;
  let t0 = 0, rt0 = 0, last = 0, raf = 0, beamAng = -0.35, beamSpread = 0.24;
  let surfSrc = null, surfGain = null, surfCtx = null;

  const clouds = Array.from({ length: 7 }, (_, i) => ({
    x: (i / 7) + Math.random() * 0.15,
    y: 0.25 + (i % 3) * 0.25 + (Math.random() - 0.5) * 0.12,
    rx: 0.34 + Math.random() * 0.26,
    ry: 0.16 + Math.random() * 0.14,
    sp: (0.008 + Math.random() * 0.012) * (i % 2 ? 1 : -1),
    a: 0.17 + Math.random() * 0.13
  }));

  const later = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  links.forEach((a, q) => {
    const href = a.getAttribute('href');
    if (!href || href === '#') {
      a.setAttribute('aria-disabled', 'true'); a.removeAttribute('target'); a.tabIndex = -1;
      a.addEventListener('click', (e) => e.preventDefault());
    }
    const on = () => { if (anchors[q] && (phase === 'live' || phase === 'draw')) hold = q; };
    const off = () => { hold = -1; };
    a.addEventListener('mouseenter', on); a.addEventListener('focus', on);
    a.addEventListener('mouseleave', off); a.addEventListener('blur', off);
  });

  function layout() {
    W = innerWidth; H = innerHeight;
    const d = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cx.setTransform(d, 0, 0, d, 0, 0);

    const mx = W / 2, my = H / 2;
    const dx = Math.min(W * 0.28, 340), dy = Math.min(H * 0.22, 165);
    const pts = [
      { x: mx - dx, y: my - dy, up: true },
      { x: mx - dx * 0.92, y: my + dy, up: false },
      { x: mx + dx, y: my - dy, up: true },
      { x: mx + dx * 0.92, y: my + dy, up: false }
    ];
    anchors = pts.map((p) => ({ ...p, ang: Math.atan2(p.y - my, p.x - mx) }));
    links.slice(0, 4).forEach((a, q) => {
      a.style.top = anchors[q].y + 'px';
      a.classList.toggle('down', !anchors[q].up);
      const w = a.offsetWidth || 0;
      a.style.left = (w ? Math.min(Math.max(anchors[q].x, w / 2 + 16), W - w / 2 - 16) : anchors[q].x) + 'px';
    });
    screen.classList.add('placed');
  }

  function drawScene(t, fogEnv, coreEnv, beamEnv) {
    cx.clearRect(0, 0, W, H);
    if (fogEnv <= 0.001) return;
    const mx = W / 2, my = H / 2;

    // 1. Пелена прибрежного тумана
    const bg = cx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, `rgba(14,28,42,${(0.68 * fogEnv).toFixed(3)})`);
    bg.addColorStop(0.5, `rgba(28,50,70,${(0.58 * fogEnv).toFixed(3)})`);
    bg.addColorStop(1, `rgba(10,20,32,${(0.80 * fogEnv).toFixed(3)})`);
    cx.fillStyle = bg;
    cx.fillRect(0, 0, W, H);

    // 2. Дрейфующие слои тумана
    for (const c of clouds) {
      const px = (((c.x + t * c.sp) % 1.4) + 1.4) % 1.4 - 0.2;
      const x = px * W, y = c.y * H + Math.sin(t * 0.25 + c.x * 10) * 14;
      const r = Math.max(W * c.rx, H * c.ry);
      const gr = cx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${MIST},${(c.a * fogEnv).toFixed(3)})`);
      gr.addColorStop(0.55, `rgba(120,165,198,${(c.a * 0.44 * fogEnv).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(26,48,68,0)');
      cx.fillStyle = gr;
      cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill();
    }

    // 3. Линия горизонта
    const hHalf = (W * 0.47) * fogEnv;
    const hGrad = cx.createLinearGradient(mx - hHalf, my, mx + hHalf, my);
    hGrad.addColorStop(0, 'rgba(' + BEAM + ',0)');
    hGrad.addColorStop(0.5, `rgba(${BEAM},${(0.38 * fogEnv).toFixed(3)})`);
    hGrad.addColorStop(1, 'rgba(' + BEAM + ',0)');
    cx.strokeStyle = hGrad;
    cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(mx - hHalf, my); cx.lineTo(mx + hHalf, my); cx.stroke();

    // Водная рябь под горизонтом
    for (let i = 1; i <= 4; i++) {
      const ry = my + i * 16 + Math.sin(t * 0.8 + i) * 2;
      const rw = hHalf * (0.46 - i * 0.08);
      cx.strokeStyle = `rgba(${BEAM},${((0.16 - i * 0.028) * fogEnv).toFixed(3)})`;
      cx.beginPath(); cx.moveTo(mx - rw, ry); cx.lineTo(mx + rw, ry); cx.stroke();
    }

    // 4. Объёмный луч маяка
    if (beamEnv > 0.001) {
      const reach = Math.hypot(W, H) * (0.18 + 0.38 * beamEnv);
      const spread = beamSpread;
      cx.save();
      cx.translate(mx, my);
      cx.rotate(beamAng);
      const bGrad = cx.createRadialGradient(0, 0, 8, 0, 0, reach);
      bGrad.addColorStop(0, `rgba(${CORE},${(0.32 * beamEnv).toFixed(3)})`);
      bGrad.addColorStop(0.35, `rgba(${BEAM},${(0.13 * beamEnv).toFixed(3)})`);
      bGrad.addColorStop(1, 'rgba(' + BEAM + ',0)');
      cx.fillStyle = bGrad;
      cx.beginPath();
      cx.moveTo(0, 0);
      cx.arc(0, 0, reach, -spread, spread);
      cx.closePath();
      cx.fill();
      cx.restore();

      // Тихие расходящиеся круги-импульсы от маяка
      for (let k = 0; k < 2; k++) {
        const p = (t * 0.22 + k * 0.5) % 1;
        const rr = 22 + p * Math.min(W, H) * 0.28;
        cx.strokeStyle = `rgba(${BEAM},${((1 - p) * 0.19 * beamEnv).toFixed(3)})`;
        cx.lineWidth = 1;
        cx.beginPath(); cx.arc(mx, my, rr, 0, TAU); cx.stroke();
      }
    }

    // 5. Мягкий ореол за ссылками
    if (beamEnv > 0.001) {
      anchors.forEach((a, q) => {
        let diff = a.ang - beamAng;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const sweep = Math.max(0, 1 - Math.abs(diff) / 0.55);
        const active = hold === q ? 1 : 0;
        const k = Math.max(active, sweep * 0.7);
        const rad = 52 + k * 28;

        const hg = cx.createRadialGradient(a.x, a.y, 0, a.x, a.y, rad);
        hg.addColorStop(0, `rgba(${CORE},${((0.12 + k * 0.18) * beamEnv).toFixed(3)})`);
        hg.addColorStop(0.45, `rgba(${BEAM},${((0.05 + k * 0.10) * beamEnv).toFixed(3)})`);
        hg.addColorStop(1, 'rgba(' + BEAM + ',0)');
        cx.fillStyle = hg;
        cx.beginPath(); cx.arc(a.x, a.y, rad, 0, TAU); cx.fill();

        cx.fillStyle = `rgba(${CORE},${((0.32 + k * 0.55) * beamEnv).toFixed(3)})`;
        cx.beginPath(); cx.arc(a.x, a.y, 1.8 + k * 0.9, 0, TAU); cx.fill();
      });
    }

    // 6. Ядро маяка в центре
    if (coreEnv > 0.001) {
      const pulse = 0.88 + Math.sin(t * 1.4) * 0.12;
      const rad = (20 + 30 * coreEnv) * pulse;
      const gr = cx.createRadialGradient(mx, my, 0, mx, my, rad);
      gr.addColorStop(0, `rgba(${CORE},${(0.88 * coreEnv).toFixed(3)})`);
      gr.addColorStop(0.28, `rgba(${BEAM},${(0.36 * coreEnv).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(' + BEAM + ',0)');
      cx.fillStyle = gr;
      cx.beginPath(); cx.arc(mx, my, rad, 0, TAU); cx.fill();
    }
  }

  function still() { beamAng = -0.35; beamSpread = 0.24; drawScene(0, 1, 1, 1); }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    let fogEnv = 1, coreEnv = 1, beamEnv = 1;

    if (phase === 'draw') {
      const p = Math.min(1, (now - t0) / OUT.draw);
      fogEnv = seg(p, 0.0, 0.52);
      coreEnv = seg(p, 0.28, 0.72);
      beamEnv = seg(p, 0.48, 1.0);
      beamAng = (beamAng + dt * 0.22) % TAU;
      links.forEach((l, q) => { if (p > 0.55 + q * 0.09) l.classList.add('lit'); });
      if (p >= 1) phase = 'live';
    } else if (phase === 'live') {
      if (hold >= 0 && anchors[hold]) {
        let diff = anchors[hold].ang - beamAng;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        beamAng += diff * Math.min(1, dt * 4.5);
      } else {
        beamAng = (beamAng + dt * 0.22) % TAU;
      }
    } else if (phase === 'retract') {
      const p = Math.min(1, (now - rt0) / 750);
      fogEnv = coreEnv = beamEnv = 1 - ease(p);
      if (p >= 1) { cancelAnimationFrame(raf); raf = 0; cx.clearRect(0, 0, W, H); return; }
    }

    const targetSpread = (phase === 'live' && hold >= 0) ? 0.16 : 0.24;
    beamSpread += (targetSpread - beamSpread) * Math.min(1, dt * 5);

    drawScene(t, fogEnv, coreEnv, beamEnv);
  }

  function surf(on) {
    const T = window.GFX && window.GFX.tap;
    if (!OUT.surf || !T) return;
    try {
      const ctx = T.ctx;
      if (on) {
        if (surfSrc) return;
        const sr = ctx.sampleRate, len = Math.round(sr * 6), buf = ctx.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) {
          const d = buf.getChannelData(c);
          let b0 = 0, b1 = 0, b2 = 0;
          for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.950 * b2 + w * 0.048;
            const swell = 0.55 + 0.45 * Math.sin((i / len) * TAU);
            d[i] = (b0 + b1 + b2) * 0.35 * swell;
          }
        }
        const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.6;
        src.buffer = buf; src.loop = true; g.gain.value = 0;
        src.connect(lp); lp.connect(g); g.connect(T.node); src.start();
        g.gain.setTargetAtTime(0.055, ctx.currentTime, 1.2);
        surfSrc = src; surfGain = g; surfCtx = ctx;
        later(28000, () => surf(false));
      } else if (surfSrc) {
        const s = surfSrc, g = surfGain, c = surfCtx;
        surfSrc = surfGain = null;
        g.gain.setTargetAtTime(0, c.currentTime, 0.4);
        setTimeout(() => { try { s.stop(); } catch (_) {} }, 1800);
      }
    } catch (_) { surfSrc = null; }
  }

  function open() {
    layout();
    screen.removeAttribute('inert'); screen.setAttribute('aria-hidden', 'false');
    if (page) page.inert = true;
    screen.classList.add('show');
    try { screen.focus({ preventScroll: true }); } catch (_) {}
    if (reduce) { phase = 'live'; links.forEach((l) => l.classList.add('lit')); screen.classList.add('live'); still(); return; }
    phase = 'draw'; hold = -1; beamAng = -0.55; beamSpread = 0.24; t0 = last = performance.now();
    links.forEach((l) => l.classList.remove('lit'));
    raf = requestAnimationFrame(frame);
    later(OUT.draw * 0.72, () => screen.classList.add('live'));
  }

  function start() {
    if (phase !== 'off') return;
    phase = 'down'; body.classList.add('is-ending'); S.dark = true;
    if (S.lamp) S.lamp.kill();
    surf(true);
    if (reduce) { body.classList.add('collapsed'); later(60, open); return; }
    later(OUT.powerDown, () => { phase = 'collapse'; body.classList.add('collapsed'); });
    later(OUT.powerDown + OUT.collapse + 150, open);
  }

  function close(replay) {
    if (phase !== 'live' && phase !== 'draw') return;
    clearTimers(); phase = 'retract'; rt0 = performance.now(); hold = -1;
    screen.classList.remove('live'); links.forEach((l) => l.classList.remove('lit'));
    surf(false);
    if (!raf && !reduce) raf = requestAnimationFrame(frame);
    const a = reduce ? 0 : 750, b = reduce ? 0 : 950;
    later(a, () => {
      screen.classList.remove('show'); screen.setAttribute('aria-hidden', 'true'); screen.setAttribute('inert', '');
      if (page) page.inert = false;
      body.classList.remove('collapsed'); cx.clearRect(0, 0, W, H);
    });
    later(a + b, () => {
      body.classList.remove('is-ending'); S.dark = false; phase = 'off';
      if (S.lamp) S.lamp.relight();
      if (replay) {
        if (!reduce) scrollTo({ top: 0, behavior: 'smooth' });
        const p = window.GDeck ? GDeck.toggle() : audio.play();
        if (p && p.catch) p.catch(() => {});
      } else { const sb = document.getElementById('stageBtn'); if (sb) sb.focus({ preventScroll: true }); }
    });
  }

  again.addEventListener('click', () => close(true));
  back.addEventListener('click', () => close(false));
  screen.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
    if (e.key !== 'Tab') return;
    const f = [...links.filter((l) => l.getAttribute('aria-disabled') !== 'true'), again, back];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  });
  addEventListener('resize', () => { if (phase === 'draw' || phase === 'live') { layout(); if (reduce) still(); } });

  window.GOutro = { start, close, state: () => phase };
})();