/* gorecz audio engine: volume + effects + the spatial stage. Shared by every track page.
   Chain: <audio> → dry → master → muffle → pan → speakers, plus four parallel effect sends into master.
   This file is the ONLY owner of the audio graph: an <audio> element can be wired into Web Audio just once, so anything else that wants
   to shape the sound (the boot screen's "3D audio") talks to GFX.spatial instead of opening its own context.
   Over file:// browsers hand Web Audio silence, so there only volume works (audio.volume). */
(() => {
  const audio = document.getElementById('audio'), $ = (s) => document.querySelector(s);
  const G = window.GFX = { fx: [0, 0, 0, 0], lfo: [0, 0], depth: 0 };      // read by the fog shader
  const LFO = [.35, .29], K = [1.7, 0, 1.0, 2.2];                    // lfo Hz (tape wobble of the echo), wet level per effect, measured with noise so that at full slider the echo sits about -5 dB, the crush about -6 dB and the bloom about -5 dB under the dry sound (slot 1 is not a send: it is the water filter)
  let ctx, master, muffle = null, pan = null, uw = null, wet = [], hooks = [], t0 = 0;
  const amt = [0, 0, 0, 0], vol = $('#vol'), mix = $('#mix');
  const paint = (el) => el.style.setProperty('--v', (el.value * 100) + '%');

  const setVol = () => {
    const v = vol.value * vol.value;                              // perceptual curve
    if (master) master.gain.setTargetAtTime(v, ctx.currentTime, .03); else audio.volume = v;
    paint(vol); try { localStorage.setItem('gorecz.vol', vol.value); } catch (e) {}
  };

  // the spatial stage: transparent while it is off (pan centred, filter wide open). On: the sound leans toward the pointer (pan, max 0.35),
  // and goes "next-room" muffled while the tab is hidden. Can be driven before the graph exists; it is applied when the graph is built.
  const sp = { on: false, pan: 0, hidden: false };
  const applySpace = (jump) => {
    if (!ctx || !muffle) return;
    const t = ctx.currentTime;
    if (pan) pan.pan.setTargetAtTime(sp.on ? sp.pan * 0.35 : 0, t, jump ? 0.001 : 0.1);
    muffle.frequency.setTargetAtTime(sp.on && sp.hidden ? 600 : 24000, t, jump ? 0.001 : 0.2);
  };
  G.debug = () => ({ built: !!ctx, uwHz: uw ? Math.round(uw.frequency.value) : null, amt: amt.slice(), depth: G.depth });
  G.spatial = {
    set(on) { sp.on = !!on; applySpace(); },
    pan(x) { sp.pan = Math.max(-1, Math.min(1, +x || 0)); applySpace(); },
    hidden(h) { sp.hidden = !!h; applySpace(); },
    get on() { return sp.on; },
  };


  /* The four effects of the world «искусственно». Each one is a sound AND a place in the picture (grade.js reads GFX.fx):
     0 эхо в тумане    ping-pong delay, every repeat darker and softer, the delay wobbles like tape          → ghost copy of the picture
     1 под водой       not a send but the water filter: the sound sinks (see depth below)                    → the water rises on the glass
     2 обрыв сигнала   radio band + 3-bit crush + random dropouts + wire crackle                              → rows tear sideways, colour splits, black bands
     3 восстановление  a reversed-envelope reverb: the sound blooms after the note, as if being put back together → the picture clears, a cold glow */
  function makeFx(ctx, src, amt) {
    amt = amt || [0, 0, 0, 0];
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; }, f = (type, hz) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = hz; return n; };
    const lfo = (hz, depth, target) => { const o = ctx.createOscillator(); o.frequency.value = hz; o.connect(g(depth)).connect(target); o.start(); };
    const noise = (len, fn) => { const b = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const a = b.getChannelData(c); for (let i = 0; i < len; i++) a[i] = fn(i / len); } return b; };
    const wet = [], hooks = [];
    { const inp = g(1), hp = f('highpass', 220), dL = ctx.createDelay(2), dR = ctx.createDelay(2), fL = f('lowpass', 1900), fR = f('lowpass', 1900), fb = g(.48), m = ctx.createChannelMerger(2);
      fL.Q.value = fR.Q.value = .5; inp.channelCount = 1; inp.channelCountMode = 'explicit'; dL.delayTime.value = dR.delayTime.value = .43;
      src.connect(inp); inp.connect(hp); hp.connect(dL); dL.connect(fL); fL.connect(dR); dR.connect(fR); fR.connect(fb); fb.connect(dL);       // L → R → L …, each pass through a lowpass
      lfo(LFO[0], .0025, dL.delayTime); lfo(LFO[1], .0025, dR.delayTime);
      fL.connect(m, 0, 0); fR.connect(m, 0, 1); wet[0] = g(0); m.connect(wet[0]); }
    wet[1] = g(0);
    { const hp = f('highpass', 380), lp = f('lowpass', 2400), dG = ctx.createDelay(.25), gIn = g(0), gFb = g(0);
      lp.Q.value = .5; dG.delayTime.value = .065;
      src.connect(hp); hp.connect(lp); lp.connect(gIn); gIn.connect(dG); dG.connect(gFb); gFb.connect(dG);
      wet[2] = g(0); dG.connect(wet[2]);
      if (typeof OfflineAudioContext === 'undefined' || !(ctx instanceof OfflineAudioContext)) setInterval(() => {
        if (amt[2] <= .02) return;
        if (Math.random() < amt[2] * .42) {
          const t = ctx.currentTime, slice = .045 + Math.random() * .055, tail = .14 + Math.random() * .18;
          dG.delayTime.setValueAtTime(slice, t);
          gIn.gain.cancelScheduledValues(t); gIn.gain.setValueAtTime(0, t); gIn.gain.linearRampToValueAtTime(1, t + .005); gIn.gain.setValueAtTime(1, t + slice - .005); gIn.gain.linearRampToValueAtTime(0, t + slice);
          gFb.gain.cancelScheduledValues(t); gFb.gain.setValueAtTime(.74, t); gFb.gain.linearRampToValueAtTime(0, t + slice + tail);
          if (dry) {
            const dip = Math.max(.08, 1 - amt[2] * .85);
            dry.gain.cancelScheduledValues(t); dry.gain.setValueAtTime(dry.gain.value, t);
            dry.gain.linearRampToValueAtTime(dip, t + .012);
            dry.gain.setValueAtTime(dip, t + slice);
            dry.gain.linearRampToValueAtTime(1, t + slice + .06);
          }
        }
      }, 240); }
    { const cv = ctx.createConvolver(), hp = f('highpass', 300); cv.buffer = noise(Math.round(ctx.sampleRate * 1.8), (p) => (Math.random() * 2 - 1) * Math.pow(p, 1.5) * (1 - Math.pow(p, 14)));
      src.connect(cv); cv.connect(hp); wet[3] = g(0); hp.connect(wet[3]); }
    return { wet, hooks };
  }
  G.makeFx = makeFx;

  function build() {
    if (ctx || location.protocol === 'file:') return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); t0 = ctx.currentTime;
    const src = ctx.createMediaElementSource(audio);
    master = ctx.createGain();
    const dry = ctx.createGain(); src.connect(dry); dry.connect(master);
    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 24000;
    uw = ctx.createBiquadFilter(); uw.type = 'lowpass'; uw.frequency.value = 24000; uw.Q.value = .8;          // the water: depth and the «под водой» slider close it
    pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;               // (older Safari has none: the stage is then just the filter)
    master.connect(uw); uw.connect(muffle); if (pan) { muffle.connect(pan); pan.connect(ctx.destination); } else muffle.connect(ctx.destination);
    G.tap = { ctx, node: master };                                // the stereo scope listens here (what you hear, after the effects)
    const fx = makeFx(ctx, src, amt, dry); wet = fx.wet; hooks = fx.hooks;
    wet.forEach((w) => w.connect(master));
    amt.forEach((_, i) => wet[i].gain.value = amt[i] * K[i]);
    setVol(); applySpace(true);
  }

  vol.value = (() => { try { return localStorage.getItem('gorecz.vol') ?? .8; } catch (e) { return .8; } })();
  vol.addEventListener('input', setVol); setVol();
  vol.addEventListener('wheel', (e) => { e.preventDefault(); vol.value = Math.min(1, Math.max(0, +vol.value - Math.sign(e.deltaY) * .04)); setVol(); }, { passive: false });
  document.querySelectorAll('[data-fx]').forEach((el) => el.addEventListener('input', () => {
    const i = +el.dataset.fx; amt[i] = +el.value; paint(el); el.classList.toggle('on', amt[i] > 0);
    if (wet[i]) wet[i].gain.setTargetAtTime(amt[i] * K[i], ctx.currentTime, .06);
    if (hooks[i]) hooks[i](amt[i]);
  }));
  audio.addEventListener('play', () => { build(); if (ctx && ctx.state === 'suspended') ctx.resume(); });
  if (location.protocol === 'file:') { mix.classList.add('nofx'); $('#fxNote').textContent = 'эффекты работают на http(s): python3 -m http.server'; }

  (function loop(now) {                                            // smoothed amounts + lfo phases → fog
    requestAnimationFrame(loop);
    const s = (now || 0) / 1000;
    for (let i = 0; i < 4; i++) G.fx[i] += (amt[i] - G.fx[i]) * .08;
    if (uw) { const cut = Math.min(24000 * Math.pow(1800 / 24000, Math.min(1, (G.depth || 0) / 14)), 24000 * Math.pow(450 / 24000, amt[1])); uw.frequency.setTargetAtTime(cut, ctx.currentTime, .15); }   // deeper = duller, down to 1.8 kHz at 14 m; the slider goes down to 450 Hz
    G.lfo[0] = (s * LFO[0]) % 1; G.lfo[1] = (s * LFO[1]) % 1;
  })();
})();
