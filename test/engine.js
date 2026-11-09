/* gorecz audio engine: volume + effects. Shared by every track page.
   Chain: <audio> → dry → master → speakers, plus four parallel effect sends.
   Over file:// browsers hand Web Audio silence, so there only volume works (audio.volume). */
(() => {
  const audio = document.getElementById('audio'), $ = (s) => document.querySelector(s);
  const G = window.GFX = { fx: [0, 0, 0, 0], lfo: [0, 0] };      // read by the fog shader
  const LFO = [.25, .8], K = [.7, 1.1, .8, .8];                  // lfo Hz (flanger, chorus), wet level per effect
  let ctx, master, wet = [], t0 = 0;
  const amt = [0, 0, 0, 0], vol = $('#vol'), mix = $('#mix');
  const paint = (el) => el.style.setProperty('--v', (el.value * 100) + '%');

  const setVol = () => {
    const v = vol.value * vol.value;                              // perceptual curve
    if (master) master.gain.setTargetAtTime(v, ctx.currentTime, .03); else audio.volume = v;
    paint(vol); try { localStorage.setItem('gorecz.vol', vol.value); } catch (e) {}
  };

  function build() {
    if (ctx || location.protocol === 'file:') return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); t0 = ctx.currentTime;
    const src = ctx.createMediaElementSource(audio);
    master = ctx.createGain(); src.connect(master); master.connect(ctx.destination);
    G.tap = { ctx, node: master };                                // the stereo scope listens here (what you hear, after the effects)
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const lfo = (hz, depth, target) => { const o = ctx.createOscillator(); o.frequency.value = hz; o.connect(g(depth)).connect(target); o.start(); };
    // 0 echo: a dark, feeding-back delay
    { const d = ctx.createDelay(2), f = ctx.createBiquadFilter(), fb = g(.5); d.delayTime.value = .42; f.type = 'lowpass'; f.frequency.value = 2200;
      src.connect(d); d.connect(f); f.connect(fb); fb.connect(d); wet[0] = g(0); f.connect(wet[0]); }
    // 1 space: a generated reverb tail
    { const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const a = ir.getChannelData(c); for (let i = 0; i < len; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      const cv = ctx.createConvolver(), lp = ctx.createBiquadFilter(); cv.buffer = ir; lp.type = 'lowpass'; lp.frequency.value = 5200;
      src.connect(cv); cv.connect(lp); wet[1] = g(0); lp.connect(wet[1]); }
    // 2 flange: very short delay swept by a slow LFO, with feedback
    { const d = ctx.createDelay(.05), fb = g(.62); d.delayTime.value = .004; lfo(LFO[0], .0028, d.delayTime);
      src.connect(d); d.connect(fb); fb.connect(d); wet[2] = g(0); d.connect(wet[2]); }
    // 3 chorus: a slightly longer, gently wobbling copy
    { const d = ctx.createDelay(.08); d.delayTime.value = .026; lfo(LFO[1], .0042, d.delayTime);
      src.connect(d); wet[3] = g(0); d.connect(wet[3]); }
    wet.forEach((w) => w.connect(master));
    amt.forEach((_, i) => wet[i].gain.value = amt[i] * K[i]);
    setVol();
  }

  vol.value = (() => { try { return localStorage.getItem('gorecz.vol') ?? .8; } catch (e) { return .8; } })();
  vol.addEventListener('input', setVol); setVol();
  vol.addEventListener('wheel', (e) => { e.preventDefault(); vol.value = Math.min(1, Math.max(0, +vol.value - Math.sign(e.deltaY) * .04)); setVol(); }, { passive: false });
  document.querySelectorAll('[data-fx]').forEach((el) => el.addEventListener('input', () => {
    const i = +el.dataset.fx; amt[i] = +el.value; paint(el); el.classList.toggle('on', amt[i] > 0);
    if (wet[i]) wet[i].gain.setTargetAtTime(amt[i] * K[i], ctx.currentTime, .06);
  }));
  audio.addEventListener('play', () => { build(); if (ctx && ctx.state === 'suspended') ctx.resume(); });
  if (location.protocol === 'file:') { mix.classList.add('nofx'); $('#fxNote').textContent = 'эффекты работают на http(s): python3 -m http.server'; }

  (function loop(now) {                                            // smoothed amounts + lfo phases → fog
    requestAnimationFrame(loop);
    const s = (now || 0) / 1000;
    for (let i = 0; i < 4; i++) G.fx[i] += (amt[i] - G.fx[i]) * .08;
    G.lfo[0] = (s * LFO[0]) % 1; G.lfo[1] = (s * LFO[1]) % 1;
  })();
})();
