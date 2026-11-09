/* infinity.dark cursor: a cold white point + a ring that breathes with the bass and names what it is over.
   (The archive's cursor is a red point with coordinates; this one is the "sound" sibling.) */
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const mk = (c, p) => { const e = document.createElement('div'); e.className = c; (p || document.body).appendChild(e); return e; };
  const dot = mk('cur-dot'), ring = mk('cur-ring'), lab = mk('cur-lab', ring);
  document.documentElement.classList.add('has-cur');
  let x = -99, y = -99, rx = x, ry = y, k = 1, ks = 1, tip = '';
  const on = () => { const S = window.GS || {}; return S.motor !== undefined ? S.motor : !document.getElementById('audio').paused; };   // "playing" as the deck sees it
  const TIPS = [
    ['#stageBtn', () => { const S = window.GS || {}; return S.hot === 'arm' ? 'drag' : S.hot === 'knob' ? (S.knobTip || 'speed') : on() ? 'pause' : 'play'; }],
    ['#playBtn', () => (on() ? 'pause' : 'play')], ['#end-replay', () => 'again'], ['#end-back', () => 'back'], ['#wave', () => 'seek'], ['#brain', () => 'probe'], ['input[type=range]', () => 'adjust'], ['a, button', () => 'open'],
  ];
  let tgt = null;
  const tipFor = (t) => { if (t && t.closest) for (const [s, f] of TIPS) if (t.closest(s)) return f(); return ''; };
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; tgt = e.target; });
  document.addEventListener('pointerleave', () => { x = y = -99; tgt = null; });
  (function loop() {
    requestAnimationFrame(loop);
    const S = window.GS, b = S && S.playing ? S.bass : 0;
    const t = tipFor(tgt);                                              // re-read every frame, so the label follows play / pause and the arm
    if (t !== tip) { tip = t; lab.textContent = t; ring.classList.toggle('lab', !!t); k = t ? 1.7 : 1; }
    rx += (x - rx) * .2; ry += (y - ry) * .2; ks += (k - ks) * .15;
    dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) scale(' + (ks * (1 + b * .45)).toFixed(3) + ')';
    lab.style.transform = 'translateY(-50%) scale(' + (1 / (ks * (1 + b * .45))).toFixed(3) + ')';
  })();
})();
