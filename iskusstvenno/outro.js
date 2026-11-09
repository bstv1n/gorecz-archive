/* infinity.dark outro: what happens when the track ends.
   0 s      the lamp in the title fails and goes dark, the stereo screen collapses to a line and a point, the lyrics fade, and (with sound on)
            the needle sits in the run-out groove: one soft tick per turn of the record
   1.2 s    the page falls into the ember point at the centre of the screen; the fog stays behind, drained
   ~2.3 s   from that point an infinity sign unfolds: a beam draws it, and each link lights as the beam passes its shoulder
   then     the beam keeps circulating; hover or focus a link and it comes to rest at that shoulder. "again" is the ember point in the crossing.
   again    the sign folds back into the point, the page comes back, the lamp strikes again and the record starts from the beginning
   back     the same, without playing. Esc does it too.
   The links are the four <a class="end-link"> in index.html, in the order: upper left, lower left, upper right, lower right. A link whose href is
   still "#" is shown dim with "soon" and does nothing. With prefers-reduced-motion everything is simply there, still. */
(() => {
  const S = window.GS;
  const screen = document.getElementById('end-screen'), cv = document.getElementById('outro-cv');
  const again = document.getElementById('end-replay'), back = document.getElementById('end-back');
  if (!S || !screen || !cv || !again || !back) return;
  const page = document.querySelector('.page'), audio = document.getElementById('audio'), body = document.body;
  const links = [...screen.querySelectorAll('.end-link')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cx = cv.getContext('2d');
  const OUT = { powerDown: 1200, collapse: 900, draw: 2000, lap: 7, groove: true };   // ms, ms (= the page's transition in style.css), ms, seconds per lap of the beam, the run-out groove ticks
  const N = 480, TAU = Math.PI * 2, BEAM = '176,204,250', EMBER = '179,50,79';
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const X = new Float32Array(N + 1), Y = new Float32Array(N + 1);
  let phase = 'off', timers = [], W = 0, H = 0, anchors = [], head = 0, hold = -1, t0 = 0, rt0 = 0, last = 0, raf = 0;
  let grooveSrc = null, grooveGain = null, grooveCtx = null;

  const later = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // links that do not go anywhere yet are dim and say so
  links.forEach((a, q) => {
    const href = a.getAttribute('href');
    if (!href || href === '#') {
      a.setAttribute('aria-disabled', 'true'); a.removeAttribute('target'); a.tabIndex = -1;
      const s = document.createElement('small'); s.textContent = 'soon'; a.appendChild(s);
      a.addEventListener('click', (e) => e.preventDefault());
    }
    const on = () => { if (anchors[q] && (phase === 'live' || phase === 'draw')) hold = anchors[q].i; }, off = () => { hold = -1; };
    a.addEventListener('mouseenter', on); a.addEventListener('focus', on); a.addEventListener('mouseleave', off); a.addEventListener('blur', off);
  });

  // the figure: a lemniscate that starts in its own crossing (the screen's centre) and goes once round. Shoulders = the four points where each lobe is highest / lowest.
  function layout() {
    W = innerWidth; H = innerHeight;
    const d = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cx.setTransform(d, 0, 0, d, 0, 0);
    const rx = Math.min(W * 0.44, 580, H), ry = Math.min(rx * 1.3, (H / 2 - 120) / 0.3535), mx = W / 2, my = H / 2;
    for (let k = 0; k <= N; k++) {
      const u = Math.PI / 2 + k / N * TAU, s = Math.sin(u), c = Math.cos(u), den = 1 + s * s;
      X[k] = mx + c / den * rx; Y[k] = my - s * c / den * ry;
    }
    const best = [-1, -1, -1, -1], bv = [-1, -1, -1, -1];                       // upper left, lower left, upper right, lower right
    for (let k = 0; k < N; k++) {
      const dx = X[k] - mx, dy = Y[k] - my;
      if (Math.abs(dx) < rx * 0.2) continue;
      const q = (dx < 0 ? 0 : 2) + (dy < 0 ? 0 : 1), v = Math.abs(dy);
      if (v > bv[q]) { bv[q] = v; best[q] = k; }
    }
    anchors = best.map((i, q) => ({ i, x: X[i], y: Y[i], up: q % 2 === 0 }));
    links.slice(0, 4).forEach((a, q) => {
      a.style.top = anchors[q].y + 'px'; a.classList.toggle('down', !anchors[q].up);
      const w = a.offsetWidth || 0;                                              // on a narrow screen a long name must not run off the edge
      a.style.left = (w ? Math.min(Math.max(anchors[q].x, w / 2 + 12), W - w / 2 - 12) : anchors[q].x) + 'px';
    });
    screen.classList.add('placed');
  }

  function path(a, b) { cx.beginPath(); cx.moveTo(X[a], Y[a]); for (let k = a + 1; k <= b; k++) cx.lineTo(X[k], Y[k]); }
  function still() {                                                           // reduced motion: the whole figure, quietly
    cx.clearRect(0, 0, W, H); cx.lineJoin = 'round'; path(0, N);
    cx.lineWidth = 8; cx.strokeStyle = 'rgba(' + BEAM + ',.05)'; cx.stroke();
    cx.lineWidth = 1.3; cx.strokeStyle = 'rgba(' + BEAM + ',.3)'; cx.stroke();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let shown = N;
    if (phase === 'draw') {
      const p = Math.min(1, (now - t0) / OUT.draw);
      head = ease(p) * N; shown = head;
      anchors.forEach((a, q) => { if (head >= a.i && links[q]) links[q].classList.add('lit'); });   // each link lights as the beam passes its shoulder
      if (p >= 1) { phase = 'live'; head = 0; }
    } else if (phase === 'live') {
      if (hold >= 0) {                                                         // come to rest at the shoulder you point at
        let diff = hold - head; if (diff > N / 2) diff -= N; if (diff < -N / 2) diff += N;
        head = (head + Math.sign(diff) * Math.min(Math.abs(diff), N * dt * 0.9) + N) % N;
      } else head = (head + dt * N / OUT.lap) % N;
    } else if (phase === 'retract') {
      const p = Math.min(1, (now - rt0) / 700);
      shown = Math.max(1, N * (1 - ease(p))); head = shown;
      if (p >= 1) { cancelAnimationFrame(raf); raf = 0; cx.clearRect(0, 0, W, H); return; }
    }
    cx.clearRect(0, 0, W, H);
    cx.lineJoin = 'round'; cx.lineCap = 'round';
    const upto = Math.max(1, Math.min(N, Math.floor(shown)));
    path(0, upto);
    cx.lineWidth = 8; cx.strokeStyle = 'rgba(' + BEAM + ',.05)'; cx.stroke();
    cx.lineWidth = 1.3; cx.strokeStyle = 'rgba(' + BEAM + ',.24)'; cx.stroke();

    const L = 90, h0 = Math.floor(head);                                       // the runner: the stretch just behind the beam, brightest at the head
    cx.lineWidth = 2;
    for (let j = 0; j < L; j += 3) {
      let a = h0 - L + j, b = a + 3;
      if (phase !== 'live') { if (a < 0) continue; } else { a = (a + N) % N; b = (b + N) % N; }
      cx.strokeStyle = 'rgba(' + BEAM + ',' + (0.85 * Math.pow(j / L, 1.7)).toFixed(3) + ')';
      cx.beginPath(); cx.moveTo(X[a], Y[a]); cx.lineTo(X[b], Y[b]); cx.stroke();
    }
    if (phase === 'live' && hold >= 0 && anchors[0]) {                         // the shoulder you point at: a ring
      const a = anchors.find((z) => z.i === hold);
      if (a) { cx.strokeStyle = 'rgba(' + BEAM + ',.55)'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(a.x, a.y, 7, 0, TAU); cx.stroke(); }
    }
    const hi = Math.min(N - 1, h0), f = head - hi, hx = X[hi] + (X[hi + 1] - X[hi]) * f, hy = Y[hi] + (Y[hi + 1] - Y[hi]) * f;
    const gr = cx.createRadialGradient(hx, hy, 0, hx, hy, 17);                 // the beam's head: the ember point
    gr.addColorStop(0, 'rgba(255,214,220,.95)'); gr.addColorStop(0.25, 'rgba(' + EMBER + ',.7)'); gr.addColorStop(1, 'rgba(' + EMBER + ',0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(hx, hy, 17, 0, TAU); cx.fill();
  }

  // the needle in the run-out groove: a hiss and one soft tick per turn of the record (33 1/3 rpm = 1.8 s), quietly, through the master volume
  function groove(on) {
    const T = window.GFX && window.GFX.tap;
    if (!OUT.groove || !T) return;
    try {
      const ctx = T.ctx;
      if (on) {
        if (grooveSrc) return;
        const sr = ctx.sampleRate, len = Math.round(sr * 1.8), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.03;
        const n = Math.round(sr * 0.012);
        for (let i = 0; i < n; i++) d[i] += (Math.random() * 2 - 1) * 0.9 * Math.pow(1 - i / n, 2.5);
        for (let k = 0; k < 3; k++) { const at = n + Math.floor(Math.random() * (len - n - 200)), m = Math.round(sr * 0.002); for (let i = 0; i < m; i++) d[at + i] += (Math.random() * 2 - 1) * 0.25 * (1 - i / m); }
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf; src.loop = true; g.gain.value = 0; src.connect(g); g.connect(T.node); src.start();
        g.gain.setTargetAtTime(0.06, ctx.currentTime, 0.6);
        grooveSrc = src; grooveGain = g; grooveCtx = ctx;
        later(24000, () => groove(false));
      } else if (grooveSrc) {
        const s = grooveSrc, g = grooveGain, c = grooveCtx;
        grooveSrc = grooveGain = null;
        g.gain.setTargetAtTime(0, c.currentTime, 0.25);
        setTimeout(() => { try { s.stop(); } catch (_) {} }, 1500);
      }
    } catch (_) { grooveSrc = null; }
  }

  function open() {
    layout();
    screen.removeAttribute('inert'); screen.setAttribute('aria-hidden', 'false');
    if (page) page.inert = true;
    screen.classList.add('show');
    try { screen.focus({ preventScroll: true }); } catch (_) {}
    if (reduce) { phase = 'live'; links.forEach((l) => l.classList.add('lit')); screen.classList.add('live'); still(); return; }
    phase = 'draw'; head = 0; hold = -1; t0 = last = performance.now();
    links.forEach((l) => l.classList.remove('lit'));
    raf = requestAnimationFrame(frame);
    later(OUT.draw * 0.85, () => screen.classList.add('live'));                // "again" arrives as the beam closes the figure
  }

  function start() {
    if (phase !== 'off') return;
    phase = 'down'; body.classList.add('is-ending'); S.dark = true;
    if (S.lamp) S.lamp.kill();
    groove(true);
    if (reduce) { body.classList.add('collapsed'); later(60, open); return; }
    later(OUT.powerDown, () => { phase = 'collapse'; body.classList.add('collapsed'); });
    later(OUT.powerDown + OUT.collapse + 150, open);
  }

  function close(replay) {
    if (phase !== 'live' && phase !== 'draw') return;
    clearTimers(); phase = 'retract'; rt0 = performance.now(); hold = -1;
    screen.classList.remove('live'); links.forEach((l) => l.classList.remove('lit'));
    groove(false);
    if (!raf && !reduce) raf = requestAnimationFrame(frame);
    const a = reduce ? 0 : 700, b = reduce ? 0 : 950;
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
    const f = [...links.filter((l) => l.getAttribute('aria-disabled') !== 'true'), again, back];   // keep Tab inside the end screen
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  });
  addEventListener('resize', () => { if (phase === 'draw' || phase === 'live') { layout(); if (reduce) still(); } });

  window.GOutro = { start, close, state: () => phase };
})();
