/* infinity.dark stereo scope: a small glass screen on the turntable's deck (the window is drawn in the plinth svg, this canvas sits over it).
   An oscilloscope in XY mode drawing a lemniscate (an infinity sign) with a phosphor afterglow.
   The beam walks the curve and the track's real left/right samples push it around: mono energy moves it up and down,
   stereo width moves it sideways. The samples are read after the master gain, so echo / space / flange / chorus change the picture
   for real. Like a real scope it triggers on a rising zero crossing, so a steady tone gives a steady picture. Over file:// there is no
   audio graph, so GS (bass / high / level) drives it instead; canvas#scope[data-mode] says which one is running: live / simulated / idle.
   The effect sliders also bend the picture directly: echo = nested ghosts, space = longer afterglow, flange = a travelling ripple,
   chorus = a doubled, breathing copy. The pointer pulls the beam like a magnet. The ember point is the beam's head.
   The afterglow is the last few snapshots of the figure drawn with fading alpha on a freshly cleared canvas every frame, so nothing
   can be left behind (fading a canvas in place leaves permanent smudges: 8-bit alpha stops fading at low values, worse at 144 Hz).
   It powers up when the dot in the title catches (GS.lit), or at once if you press play. */
(() => {
  const cv = document.getElementById('scope');
  if (!cv) return;
  const cx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const N = 300, M = 14, TAU = Math.PI * 2, BEAM = '176,204,250', EMBER = '179,50,79';
  const REACH = 0.7;   // M: snapshots kept for the afterglow; REACH: the pointer's pull reaches this many screen widths
  const X = new Float32Array(N + 1), Y = new Float32Array(N + 1);
  const rm = new Float32Array(N), rs = new Float32Array(N), sm = new Float32Array(N), ss = new Float32Array(N);
  const hist = Array.from({ length: M }, () => ({ X: new Float32Array(N + 1), Y: new Float32Array(N + 1), t: -1e9 }));
  const tail = [];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let W = 0, H = 0, pw = reduce ? 1 : 0, pk = 0.12, ph = 0, last = performance.now(), lastDraw = 0, lastSnap = 0, hi = 0, vis = true, ink = false;
  let mx = -1e4, my = -1e4, mg = 0, mode = '', ls = 1, MR = 100;   // ls: line-weight scale for a small screen; MR: pointer reach in px
  let anL = null, anR = null, bL = null, bR = null, tried = false;

  function listen() {                                    // tap the master output with two analysers (left / right)
    const T = window.GFX && window.GFX.tap;
    if (!T) return;
    tried = true;
    try {
      const ctx = T.ctx, sp = ctx.createChannelSplitter(2), mute = ctx.createGain();
      anL = ctx.createAnalyser(); anR = ctx.createAnalyser(); anL.fftSize = anR.fftSize = 1024;
      T.node.connect(sp); sp.connect(anL, 0); sp.connect(anR, 1);
      mute.gain.value = 0; anL.connect(mute); anR.connect(mute); mute.connect(ctx.destination);   // silent, keeps Safari pulling the analysers
      bL = new Float32Array(anL.fftSize); bR = new Float32Array(anR.fftSize);
    } catch (e) { anL = anR = null; }
  }

  function size() {
    const d = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    ls = clamp(H / 150, 0.55, 1.2); MR = Math.max(70, W * REACH);
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cx.setTransform(d, 0, 0, d, 0, 0);
    if (reduce) still();
  }

  // reduced motion: one calm, static figure, no animation at all
  function still() {
    if (!W) return;
    const rx = W * 0.4, ry = Math.min(rx * 1.3, (H / 2 - Math.max(3, H * 0.12)) / 0.354);
    cx.clearRect(0, 0, W, H);
    cx.beginPath();
    for (let k = 0; k <= N; k++) {
      const t = k / N * TAU, sn = Math.sin(t), cs = Math.cos(t), den = 1 + sn * sn;
      const x = W / 2 + cs / den * rx, y = H / 2 + sn * cs / den * ry;
      if (k) cx.lineTo(x, y); else cx.moveTo(x, y);
    }
    cx.lineJoin = 'round';
    cx.lineWidth = 5 * ls; cx.strokeStyle = 'rgba(' + BEAM + ',.08)'; cx.stroke();
    cx.lineWidth = Math.max(1, 1.25 * ls); cx.strokeStyle = 'rgba(' + BEAM + ',.7)'; cx.stroke();
    cx.fillStyle = 'rgba(' + EMBER + ',.95)'; cx.beginPath(); cx.arc(W / 2 + rx, H / 2, 2.6 * ls, 0, TAU); cx.fill();
  }

  // the signal along the curve: mid (mono, goes up and down) and side (width, goes sideways), triggered, then smoothed
  function signal(now, S, have, g) {
    if (have) {
      let i0 = 0;
      for (let i = 1; i < 420; i++) if (bL[i - 1] + bR[i - 1] < 0 && bL[i] + bR[i] >= 0) { i0 = i; break; }   // trigger: first rising zero crossing
      for (let k = 0; k < N; k++) {
        const i = i0 + ((k * 511 / N) | 0), l = bL[i] * g, r = bR[i] * g;
        rm[k] = (l + r) * 0.7071; rs[k] = (l - r) * 0.7071;
      }
    } else if (S.playing) {
      for (let k = 0; k < N; k++) {
        const a = Math.sin(k * 0.06 + ph * 6), b = Math.sin(k * 0.23 - ph * 11 + 1.7);
        rs[k] = (b * 0.6 + a * 0.4) * (0.25 + (S.high || 0) * 0.9) * 0.6;
        rm[k] = (a * 0.8 + b * 0.2) * (0.25 + (S.bass || 0) * 1.1) * 0.6;
      }
    } else {
      for (let k = 0; k < N; k++) { rm[k] = Math.sin(k * 0.05 + now / 1600) * 0.035; rs[k] = 0; }   // idle: only a faint shimmer
    }
    for (let k = 0; k < N; k++) {                                              // 5-point circular average: keeps the body, drops the hair
      let a = 0, b = 0;
      for (let j = -2; j <= 2; j++) { const q = (k + j + N) % N; a += rm[q]; b += rs[q]; }
      sm[k] = a / 5; ss[k] = b / 5;
    }
  }

  // the figure: a lemniscate, pushed around by the signal. sweep = power-up (0 = a flat line)
  function curve(now, S, fx, lfo, sweep) {
    const rx = W * 0.4, ry = Math.min(rx * 1.3, (H / 2 - Math.max(3, H * 0.12)) / 0.354), A = H * 0.1 * (0.55 + 0.9 * (S.level || 0));
    const hw = W / 2 - 4, hh = H / 2 - 4, breath = 0.93 + 0.07 * Math.sin(now / 2300);
    for (let k = 0; k <= N; k++) {
      const kk = k % N, t = kk / N * TAU, sn = Math.sin(t), cs = Math.cos(t), den = 1 + sn * sn;
      let x = cs / den * rx + ss[kk] * A * sweep, y = sn * cs / den * ry * sweep * breath - sm[kk] * A * sweep;
      if (fx[2] > 0.01) y += Math.sin(t * 5 + lfo[0] * TAU) * A * 0.5 * fx[2] * sweep;   // flange: a ripple travelling round the figure
      if (mg > 0.001) {                                                       // the pointer pulls the beam toward itself
        const dx = mx - (W / 2 + x), dy = my - (H / 2 + y), d2 = dx * dx + dy * dy;
        if (d2 < MR * MR) { const f = 1 - Math.sqrt(d2) / MR; x += dx * f * 0.8 * mg; y += dy * f * 0.8 * mg; }
      }
      X[k] = clamp(x, -hw, hw); Y[k] = clamp(y, -hh, hh);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!vis || !W) { last = now; return; }
    if (now - lastDraw < 12) return;                                          // at most ~80 draws a second, whatever the screen's refresh rate
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const S = window.GS || {}, G = window.GFX || {}, fx = G.fx || [0, 0, 0, 0], lfo = G.lfo || [0, 0];

    const late = S.introAt !== undefined && now - S.introAt > 12000;                // the late fallback (counted from the start of the intro, not from page load): never leave it dead
    const on = !S.dark && (S.lit || S.playing || late);
    pw = clamp(pw + dt / 1.5 * (on ? 1 : -1), 0, 1);
    if (pw <= 0) {
      if (ink) { cx.clearRect(0, 0, W, H); ink = false; for (const h of hist) h.t = -1e9; tail.length = 0; }
      return;
    }

    if (!anL && !tried) listen();
    let have = false;
    if (anL && S.playing) {
      try { anL.getFloatTimeDomainData(bL); anR.getFloatTimeDomainData(bR); have = true; } catch (e) { anL = anR = null; }
    }
    let top = 0;
    if (have) for (let i = 0; i < bL.length; i++) top = Math.max(top, Math.abs(bL[i]), Math.abs(bR[i]));
    pk = Math.max(0.12, top, pk * Math.exp(-dt * 0.5));                      // auto-gain: quiet and loud passages both fill the screen
    const m = !S.playing ? 'idle' : have ? 'live' : 'simulated';
    if (m !== mode) { mode = m; cv.dataset.mode = m; }

    const inside = mx > -MR && mx < W + MR && my > -MR && my < H + MR;
    mg += ((inside ? 1 : 0) - mg) * (1 - Math.exp(-dt * 6));
    const sweep = pw < 1 ? 1 - Math.pow(1 - pw, 3) : 1, pa = Math.min(1, pw * 1.8);
    ph += dt * TAU / 7 * (1 + (S.level || 0) * 0.6);
    signal(now, S, have, 1 / pk);
    curve(now, S, fx, lfo, sweep);

    // afterglow: keep a few snapshots of the figure and draw them fainter the older they are. space = longer afterglow
    const tau = 0.085 + fx[1] * 0.25;
    if (now - lastSnap >= Math.max(16, tau * 300)) { const h = hist[hi]; h.X.set(X); h.Y.set(Y); h.t = now; hi = (hi + 1) % M; lastSnap = now; }

    cx.clearRect(0, 0, W, H);
    const bg = cx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);          // the tube's faint backlight
    bg.addColorStop(0, 'rgba(95,130,200,' + (0.14 * pw).toFixed(3) + ')'); bg.addColorStop(1, 'rgba(95,130,200,0)');
    cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
    cx.save(); cx.translate(W / 2, H / 2);
    cx.globalCompositeOperation = 'lighter'; cx.lineJoin = 'round'; cx.lineCap = 'round'; cx.lineWidth = Math.max(1, 1.25 * ls);
    for (let j = 0; j < M; j++) {
      const h = hist[(hi + j) % M], age = (now - h.t) / 1000;
      if (age > tau * 4.2) continue;
      cx.strokeStyle = 'rgba(' + BEAM + ',' + (0.07 * Math.exp(-age / tau) * pa).toFixed(4) + ')';
      cx.beginPath(); cx.moveTo(h.X[0], h.Y[0]); for (let k = 1; k <= N; k++) cx.lineTo(h.X[k], h.Y[k]); cx.stroke();
    }
    const wob = Math.sin(lfo[1] * TAU), copies = [[1, 0, 0, 1]];
    if (fx[0] > 0.01) copies.push([0.86, 6, 4, 0.55 * fx[0]], [0.72, 12, 8, 0.32 * fx[0]]);   // echo: fainter, smaller repeats
    if (fx[3] > 0.01) copies.push([1.045 + wob * 0.03, 0, 0, 0.6 * fx[3]], [0.955 - wob * 0.03, 0, 0, 0.4 * fx[3]]);   // chorus: a wobbling double
    for (const c of copies) {
      cx.save(); cx.translate(c[1], c[2]); cx.scale(c[0], c[0]);
      cx.beginPath(); cx.moveTo(X[0], Y[0]); for (let k = 1; k <= N; k++) cx.lineTo(X[k], Y[k]);
      cx.lineWidth = (5 + fx[1] * 4) * ls / c[0]; cx.strokeStyle = 'rgba(' + BEAM + ',' + (0.2 * c[3] * pa).toFixed(4) + ')'; cx.stroke();
      cx.lineWidth = Math.max(1, 1.25 * ls) / c[0]; cx.strokeStyle = 'rgba(' + BEAM + ',' + (0.6 * c[3] * pa).toFixed(4) + ')'; cx.stroke();
      cx.restore();
    }

    // the beam's head: the ember point and its comet tail (the last 0.4 s of where it has been)
    const kh = ((ph / TAU) % 1) * N, k0 = kh | 0, f = kh - k0;
    const nx = X[k0] + (X[k0 + 1] - X[k0]) * f, ny = Y[k0] + (Y[k0 + 1] - Y[k0]) * f;
    tail.push({ x: nx, y: ny, t: now });
    while (tail.length > 1 && now - tail[0].t > 420) tail.shift();
    cx.lineWidth = 2.6 * ls;
    for (let i = 1; i < tail.length; i++) {
      const p = tail[i - 1], q = tail[i];
      if (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > 40 * ls) continue;
      cx.strokeStyle = 'rgba(' + EMBER + ',' + (0.9 * Math.exp(-(now - q.t) / 110) * pa).toFixed(3) + ')';
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke();
    }
    const gr = cx.createRadialGradient(nx, ny, 0, nx, ny, 11 * ls);
    gr.addColorStop(0, 'rgba(255,214,220,' + (0.95 * pa).toFixed(3) + ')');
    gr.addColorStop(0.25, 'rgba(' + EMBER + ',' + (0.7 * pa).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(' + EMBER + ',0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(nx, ny, 11 * ls, 0, TAU); cx.fill();
    cx.restore();
    ink = true;
  }

  new ResizeObserver(size).observe(cv);
  new IntersectionObserver((e) => { vis = e[0].isIntersecting; }).observe(cv);
  size();
  if (reduce) return;
  if (fine) {
    addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { mx = my = -1e4; });
  }
  requestAnimationFrame(frame);
})();
