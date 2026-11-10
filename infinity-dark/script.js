/* gorecz — infinity.dark
   No libraries: plain JS and one fragment shader.

   1  setup            5  waveform scrubber
   2  audio analysis   6  player
   3  fog (WebGL)      7  poem reveal, links, keys
   4  turntable        8  main loop
*/
(() => {
  'use strict';
  // Easter Egg in Console
  console.log(
    "%c gorecz \n%c infinity.dark // terminal initialized \n [ status: online ] \n [ dsp environment: ambient_trap ]",
    "color: #d64866; font-size: 28px; font-weight: 800; letter-spacing: -2px; font-family: monospace;",
    "color: #87afd2; font-family: monospace; font-size: 11px; line-height: 1.5;"
  );

  /* ───────────────────────── 1 · setup ───────────────────────── */

  const root = document.documentElement;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp  = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp   = (a, b, t) => a + (b - a) * t;
  const damp   = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
  const follow = (cur, to, up, down, dt) => damp(cur, to, to > cur ? up : down, dt);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease   = (t) => 1 - Math.pow(1 - t, 3);
  const fmt = (s) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  };

  const titleDot = document.querySelector('.title .dot');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const TITLE = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? 'signal lost' : (S.playing ? '▶ ' + TITLE : TITLE);
  });

  // things you may want to tweak
  const SPIN = 66;                                   // record speed, degrees per second
  const DISC = { cx: 392, cy: 390 };                 // record centre inside the 1000×780 drawing
  const ARM  = { px: 872, py: 150, len: 478, startR: 284, endR: 122, lift: 16 };

  const audio     = $('#audio');
  const playBtn   = $('#playBtn');
  const miniBtn   = $('#miniBtn');
  const stageBtn  = $('#stageBtn');
  const timeEl    = $('#time');
  const miniTime  = $('#miniTime');
  const ringEl    = $('#ring');
  const statusEl  = $('#status');
  const lengthEl  = $('#length');
  const tt        = $('#tt');
  const discEl    = $('#disc');
  const armEl     = $('#arm');
  const ledEl     = $('#led');
  const dotEl     = $('#dot');
  const poem      = $('#poem');

  const S = window.GS = { playing: false, duration: 0, env: null, peaks: null, synthetic: false, prog: 0, bass: 0, high: 0, level: 0 };
  const E = { bass: 0, high: 0, level: 0 };          // energy of the music at the playhead
  const dur = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : S.duration) || 0;

  // ── Lyrics Data ──
    const trackLyrics = [
    { t: 0, text: "" }, // Интро

    // Припев
    { t: 13.7, text: "я на верном двигаюсь" },
    { t: 15.36, text: "я предугадаю каждый твой следующий шаг" },
    { t: 19.26, text: "(твой следующий шаг)" },
    { t: 20.59, text: "я на верном двигаюсь" },
    { t: 22.26, text: "приведи меня они поднимут белый флаг" },

    // Пост-припев
    { t: 27.41, text: "каждую ночь мое зеркало преобразуется в новый портал" },
    { t: 30.85, text: "и я не понимаю, каким образом, но я попадаю в ад" },
    { t: 34.26, text: "ниче не вижу, а только лишь чувствую, видимо там вечный мрак" },
    { t: 38.09, text: "" }, // Пауза

    // Куплет
    { t: 41.11, text: "switch up, я поник, что происходит?" },
    { t: 44.53, text: "стучусь в закрытые двери, кричу 'помоги'" },
    { t: 47.96, text: "не знаю, что мне поделать в этом гнусном мире" },
    { t: 51.42, text: "бежать, бежать, бежать" },
    { t: 56.14, text: "сколько нужно дорог, чтоб вернуться домой?" },
    { t: 60.36, text: "и не уходить оттуда" },
    { t: 62.96, text: "как не чувствовать боль, если ток меня бьет?" },

    // Бридж
    { t: 68.56, text: "я на верном двигаюсь" },
    { t: 70.31, text: "я предугадаю каждый твой следующий шаг" },
    { t: 74.05, text: "(твой следующий шаг)" },
    { t: 75.43, text: "я на верном двигаюсь" },
    { t: 76.92, text: "приведи меня они поднимут белый флаг" },
    { t: 80.76, text: "" }, // Инструментал

    // Припев
    { t: 82.12, text: "я на верном двигаюсь" },
    { t: 83.91, text: "я предугадаю каждый твой следующий шаг" },
    { t: 87.62, text: "(твой следующий шаг)" },
    { t: 89.13, text: "я на верном двигаюсь" },
    { t: 90.83, text: "приведи меня они поднимут белый флаг" },
    { t: 94.43, text: "" } // Аутро
  ];
  /* lyrics:start */
  let currentLyricIndex = -2, lyricShown = false;
  const lyricsHud = document.getElementById('hud-lyrics');
  const lyPrev = lyricsHud && lyricsHud.querySelector('.ly-prev'), lyCur = lyricsHud && lyricsHud.querySelector('.ly-cur');
  const LYRIC_HOLD = 6.5;                                               // seconds a line stays when the next one is far away (an instrumental bar)
  function setLyric(text) {                                             // the old line drops to the small one above, the new one arrives word by word
    if (!lyCur) return;
    if (lyPrev) lyPrev.textContent = lyCur.textContent;
    lyCur.classList.remove('in');
    lyCur.textContent = '';
    text.split(' ').forEach((w, k) => { const sp = document.createElement('span'); sp.style.setProperty('--i', k); sp.textContent = w; lyCur.appendChild(sp); });
    void lyCur.offsetWidth;
    requestAnimationFrame(() => lyCur.classList.add('in'));
  }
  function lyricsTick(t) {
    if (!lyricsHud) return;
    let idx = -1;
    for (let i = 0; i < trackLyrics.length; i++) { if (t >= trackLyrics[i].t) idx = i; else break; }
    const line = trackLyrics[idx], next = trackLyrics[idx + 1];
    if (idx !== currentLyricIndex) { currentLyricIndex = idx; if (line && line.text) setLyric(line.text); }
    const far = !next || next.t - line.t > 8;
    const visible = !!line && !!line.text && (!far || t - line.t < LYRIC_HOLD) && document.documentElement.classList.contains('has-played');
    if (visible !== lyricShown) { lyricShown = visible; lyricsHud.classList.toggle('on', visible); }
  }
  /* lyrics:end */

  // wordmark: split into letters so they can arrive one by one
  (function splitWordmark() {
    if (reduceMotion) return;
    let i = 0;
    $$('.wordmark .w, .wordmark .dot').forEach((el) => {
      if (el.classList.contains('dot')) { el.style.setProperty('--i', i++); return; }
      const text = el.textContent;
      el.textContent = '';
      for (const ch of text) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        s.style.setProperty('--i', i++);
        el.appendChild(s);
      }
    });
  })();

  /* boot:start */
  /* ── Boot Screen, Spatial Audio & Cypher ──
     The audio graph belongs to engine.js (an <audio> element can be wired into Web Audio only once), so the 3D option only drives its spatial stage. */
  const bootScreen = document.getElementById('boot-screen');
  const btnSpatialOn = document.getElementById('boot-spatial-on');
  const btnSpatialOff = document.getElementById('boot-spatial-off');
  const cyphers = document.querySelectorAll('.cypher');
  const chars = '01!<>-_\\/[]{}—=+*^?#_';

  let spatialEnabled = false, bootOpen = !!bootScreen;
  let bootResolve; const bootDone = new Promise((r) => { bootResolve = r; });   // resolved when the boot screen is dismissed (at once if there is none)
  if (!bootScreen) bootResolve();

  // Функция закрытия прелоадера и запуска сайта
  function dismissBoot(enableSpatial) {
    if (!bootOpen) return;
    bootOpen = false;
    if (enableSpatial) { spatialEnabled = true; if (window.GFX && GFX.spatial) GFX.spatial.set(true); }   // engine.js owns the audio graph; this only switches its spatial stage on

    // Растворяем экран
    if (bootScreen) bootScreen.classList.add('hidden');
    bootResolve();                                                      // the intro (title, lamp) starts now, not behind this screen

    // Через полсекунды красиво расшифровываем заголовок
    setTimeout(() => {
      cyphers.forEach(el => {
        const finalStr = el.getAttribute('data-text');
        let iterations = 0;
        const interval = setInterval(() => {
          el.innerText = finalStr.split('').map((letter, index) => {
            if (index < iterations) return letter;
            return chars[Math.floor(Math.random() * chars.length)];
          }).join('');
          if (iterations >= finalStr.length) clearInterval(interval);
          iterations += 1 / 4;
        }, 40);
      });
    }, 500);
  }

  // Слушатели кнопок на стартовом экране
  if (btnSpatialOn) btnSpatialOn.addEventListener('click', () => dismissBoot(true));
  if (btnSpatialOff) btnSpatialOff.addEventListener('click', () => dismissBoot(false));

  // Физика 3D-звука от мыши: звук слегка тянется к курсору
  window.addEventListener('mousemove', (e) => {
    if (!spatialEnabled || !window.GFX || !GFX.spatial) return;
    GFX.spatial.pan((e.clientX / window.innerWidth) * 2 - 1);
  });

  // Физика эффекта "соседней комнаты" при скрытии вкладки
  document.addEventListener('visibilitychange', () => {
    if (!spatialEnabled || !window.GFX || !GFX.spatial) return;
    GFX.spatial.hidden(document.hidden);
  });
  /* boot:end */

  // the period is a dying lamp: it sputters before it finally catches, then browns out now and then while the track plays.
  // The model only produces two numbers (--f core, --g halo); style.css decides how they look.
  const LAMP = {
    startDelay: 350,   // ms of stillness after the title has fully decoded, before the first spark
    introMs: 2400,     // how long it sputters before it holds
    playRate: 0.15,    // brown-outs per second while playing
    playBass: 0.45,    // extra brown-outs per second at full bass
  };
  const lamp = (() => {
    const R = Math.random;
    let state = 0, t0 = 0, q = null, qi = 0, rem = 0, f = 0.03, g = 0, boost = 0, cool = 0, lastF = '', lastG = '';
    const run = (segs) => { q = segs; qi = 0; rem = segs[0][0]; };

    // [ms, level, flag?] segments: dead → failed strikes that get longer and rarer → almost holds → one last drop → catches
    const introSegs = (total = LAMP.introMs) => {
      const s = []; let sum = 0;
      const add = (ms, lv) => { s.push([ms, lv]); sum += ms; };
      add(220 + R() * 160, 0.03);
      let gap = 330 + R() * 120;
      while (sum < total - 600) {
        const p = sum / total;
        if (R() < 0.25) add(70 + R() * 110, 0.16 + R() * 0.18);                               // half-struck: dim glow
        add(35 + R() * 60 + p * 160, 0.55 + R() * 0.45);                                      // strike (longer as it warms up)
        if (gap > 300 && R() < 0.4) { add(20 + R() * 30, 0.04); add(18 + R() * 40, 0.45 + R() * 0.4); }    // stutter
        add(Math.max(160, gap * (0.6 + R() * 0.6)), 0.02 + R() * 0.05);                       // dark again (never too quick: keeps it under ~5 flashes/s)
        gap *= 0.74 + R() * 0.12;
      }
      add(260 + R() * 120, 0.75 + R() * 0.2);                                                 // almost holds…
      add(70 + R() * 50, 0.04);                                                               // …one last drop
      s.push([200, 1, 1]);                                                                    // catches: the halo blooms
      return s;
    };
    const eventSegs = () => {                                                                 // while playing: blink / double blink / slow brown-out
      const r = R(), d = 0.45 + R() * 0.55;
      if (r < 0.45) return [[40 + R() * 100, 1 - d]];
      if (r < 0.80) return [[30 + R() * 50, 1 - d], [25 + R() * 45, 1], [30 + R() * 50, 1 - d * 0.6]];
      return [[200 + R() * 220, 0.3 + R() * 0.3], [50, 0.8], [70, 0.4]];
    };

    if (!reduceMotion) { dotEl.style.setProperty('--f', '0.03'); dotEl.style.setProperty('--g', '0'); }   // start dead, never a flash of "on"

    return {
      begin(now) { if (state === 0) { state = 1; t0 = now + LAMP.startDelay; } },   // called when the wordmark has finished decoding
      kill() { state = 2; S.lit = false; run([[180, 1], [60, 0.12], [140, 0.9], [90, 0.05], [220, 0.55], [70, 0.04], [380, 0.18], [Infinity, 0.03]]); },   // the end of the track: it fails and stays dark
      relight() { state = 2; run(introSegs(1300)); },                                  // another play: it strikes again, quicker than the first time
      step(now, dt, playing, bass) {
        if (reduceMotion) return;                                                             // reduced motion: the dot just stays lit
        if (state === 1 && now >= t0) { state = 2; run(introSegs()); }
        if (q) {
          rem -= dt * 1000;
          while (q && rem <= 0) {
            qi++;
            if (qi >= q.length) { q = null; cool = 0.8; break; }
            rem += q[qi][0];
            if (q[qi][2]) { boost = 0.3; S.lit = true; }                                  // the lamp caught: the instruments may power up
          }
        } else if (state === 2) {
          cool -= dt;
          if (playing && cool <= 0 && R() < (LAMP.playRate + (bass || 0) * LAMP.playBass) * dt) run(eventSegs());
        }
        const lv = state < 2 ? 0.03 : (q ? q[qi][1] : 1);
        const flutter = playing && !q ? 1 - 0.05 * (0.5 + 0.5 * Math.sin(now * 0.021 + Math.sin(now * 0.0063) * 4)) : 1;   // a faint unsteadiness
        const tgt = lv * flutter;
        f += (tgt - f) * (1 - Math.exp(-dt / (tgt > f ? 0.012 : 0.05)));                     // core: snaps on, drops a little slower
        g += (lv - g) * (1 - Math.exp(-dt / (lv > g ? 0.07 : 0.18)));                        // halo: lags, like an afterglow
        boost *= Math.exp(-dt / 0.4);
        const sf = f.toFixed(3), sg = (g + boost).toFixed(3);
        if (sf !== lastF) { lastF = sf; dotEl.style.setProperty('--f', sf); }
        if (sg !== lastG) { lastG = sg; dotEl.style.setProperty('--g', sg); }
      },
    };
  })();

  // the wordmark decodes out of noise: each letter shows random marks while it fades in, then locks into place.
  // The real letter keeps its space (transparent) and the noise is an overlay, so nothing shifts. The dot sparks after the last letter.
  const titleDecode = (() => {
    const GLYPHS = '~~|¦·°¬±=-:^_|', R = Math.random, pick = () => GLYPHS[(R() * GLYPHS.length) | 0];   // the "sound" side's noise (the archive uses code marks)
    let L = [];
    const loop = (now) => {
      let open = 0;
      for (const o of L) {
        if (o.done) continue;
        if (now >= o.lock) { o.el.classList.remove('scr'); o.el.removeAttribute('data-g'); o.done = true; continue; }
        open++;
        if (now >= o.start && now >= o.next) {
          const near = (now - o.start) / (o.lock - o.start) > 0.7 && R() < 0.35;               // close to locking, the true letter flickers through
          o.el.setAttribute('data-g', near ? o.c : pick());
          o.next = now + 55 + R() * 55;
        }
      }
      if (open) requestAnimationFrame(loop); else lamp.begin(now);
    };
    return {
      run(t) {                                                                                // t = the moment .is-ready was set
        S.introAt = t;                                                                        // scope.js's late fallback counts from here, not from page load
        setTimeout(() => lamp.begin(performance.now()), 9000);                                // safety: never leave the dot dead
        if (reduceMotion) return;
        L = $$('.wordmark .ch').map((el) => {
          const start = t + 500 + (parseFloat(el.style.getPropertyValue('--i')) || 0) * 70;   // same stagger as the CSS fade
          el.classList.add('scr'); el.setAttribute('data-g', pick());
          return { el, c: el.textContent, start, lock: start + 700 + R() * 300, next: start, done: false };
        });
        if (L.length) requestAnimationFrame(loop);
      },
    };
  })();

  S.lamp = lamp;                                                        // outro.js puts the lamp out at the end of the track and relights it

  // start the intro once the fonts are in (or after a moment, whichever comes first) AND the boot screen is dismissed, so it plays where you can see it
  /* intro:start */
  (function intro() {
    const go = () => requestAnimationFrame(() => requestAnimationFrame(() => { root.classList.add('is-ready'); titleDecode.run(performance.now()); }));
    const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    Promise.all([fonts, bootDone]).then(go, go);
  })();
  /* intro:end */

  /* ───────────────────── 2 · audio analysis ─────────────────────
     The track is decoded once, quietly, to get its real waveform and a
     30 fps envelope (bass / highs / level). The picture then follows the
     audio element's clock, so nothing depends on live audio taps. */

  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  async function readBytes() {
    const src = audio.getAttribute('src') || '';
    if (src.startsWith('data:')) {
      const bin = atob(src.slice(src.indexOf(',') + 1));
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return { bytes: u8, src, inline: true };
    }
    const res = await fetch(src);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return { bytes: new Uint8Array(await res.arrayBuffer()), src, inline: false };
  }

  const decode = (ctx, buffer) => new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(buffer, resolve, reject);   // callback form for old Safari
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });

  function analyse(buf) {
    const sr = buf.sampleRate;
    const ch0 = buf.getChannelData(0);
    const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
    const N = ch0.length;

    const fps = 30, hop = Math.max(1, Math.floor(sr / fps)), frames = Math.floor(N / hop);
    const bass = new Float32Array(frames), high = new Float32Array(frames), level = new Float32Array(frames);
    const aLow = 1 - Math.exp(-2 * Math.PI * 180 / sr);       // ≈ below 180 Hz
    const aHigh = 1 - Math.exp(-2 * Math.PI * 3000 / sr);     // ≈ above 3 kHz
    let lpLow = 0, lpHigh = 0;
    for (let f = 0; f < frames; f++) {
      let sb = 0, sh = 0, sl = 0;
      for (let i = f * hop, e = i + hop; i < e; i++) {
        const x = (ch0[i] + ch1[i]) * 0.5;
        lpLow += aLow * (x - lpLow);
        lpHigh += aHigh * (x - lpHigh);
        const hi = x - lpHigh;
        sb += lpLow * lpLow; sh += hi * hi; sl += x * x;
      }
      bass[f] = Math.sqrt(sb / hop); high[f] = Math.sqrt(sh / hop); level[f] = Math.sqrt(sl / hop);
    }

    const normalise = (a, gamma, q = 0.95) => {
      const sorted = Float32Array.from(a).sort();
      const ref = sorted[Math.floor(sorted.length * q)] || 1e-6;
      for (let i = 0; i < a.length; i++) a[i] = Math.pow(Math.min(1, a[i] / ref), gamma);
    };
    normalise(bass, 1.4); normalise(high, 1.2); normalise(level, 1.1);

    // loudness per slice (RMS): a mastered track is dense, so a steeper curve keeps the shape readable
    const P = 1440, peaks = new Float32Array(P), seg = Math.max(1, Math.floor(N / P));
    for (let p = 0; p < P; p++) {
      const start = p * seg, end = Math.min(N, start + seg);
      let s = 0, c = 0;
      for (let i = start; i < end; i += 2) { const v = (ch0[i] + ch1[i]) * 0.5; s += v * v; c++; }
      peaks[p] = Math.sqrt(s / Math.max(1, c));
    }
    normalise(peaks, 1.8, 0.98);

    return { fps, bass, high, level, peaks, duration: buf.duration };
  }

  // used only when the file cannot be analysed (e.g. index.html opened straight from disk)
  function synthPeaks(n = 1440) {
    const rnd = mulberry32(7), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const shape = 0.32 + 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.08)), 0.7);
      out[i] = clamp(shape * (0.55 + 0.45 * rnd()));
    }
    return out;
  }
  function synthEnergy(t) {
    E.bass = Math.pow(0.5 + 0.5 * Math.sin(t * 2.1), 2) * 0.75;
    E.high = 0.35 + 0.25 * Math.sin(t * 3.3 + 1);
    E.level = 0.45 + 0.25 * Math.sin(t * 0.9);
  }
  function sampleEnergy(t) {
    const a = S.env;
    if (!a) { synthEnergy(t); return; }
    const f = Math.max(0, t) * a.fps, i = Math.floor(f), k = f - i, last = a.bass.length - 1;
    const i0 = Math.min(i, last), i1 = Math.min(i + 1, last);
    E.bass = lerp(a.bass[i0], a.bass[i1], k);
    E.high = lerp(a.high[i0], a.high[i1], k);
    E.level = lerp(a.level[i0], a.level[i1], k);
  }

  // a Blob URL seeks more reliably than a giant data: URI; fall back if it is blocked
  let blobTrial = false;
  function upgradeToBlob(bytes, dataUri) {
    try {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      const back = () => { blobTrial = false; audio.src = dataUri; };
      blobTrial = true;
      audio.addEventListener('error', back, { once: true });
      audio.addEventListener('loadedmetadata', () => { blobTrial = false; audio.removeEventListener('error', back); }, { once: true });
      audio.src = url;
    } catch (_) { blobTrial = false; }
  }

  async function loadAnalysis() {
    try {
      const { bytes, src, inline } = await readBytes();
      if (inline && audio.paused && audio.currentTime === 0) upgradeToBlob(bytes, src);
      const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const buf = await decode(new Ctx(2, 1, 22050), bytes.buffer.slice(0));
      const a = analyse(buf);
      S.env = a; S.peaks = a.peaks; S.duration = a.duration;
    } catch (err) {
      S.synthetic = true;
      S.peaks = synthPeaks();
      console.info('gorecz: could not analyse the audio (' + (err && err.message ? err.message : err) + '). ' +
        'The waveform is decorative until the page is served over http(s).');
    }
    wfBars();
    wf.reveal = 0;
    wf.dirty = true;
  }

  /* ───────────────────────── 3 · fog (WebGL) ─────────────────────────
     Slow domain-warped noise. The horizon glow climbs and turns from
     night-blue to pale platinum as the track plays: night → morning. */

  const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
  const FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uBass;
  uniform float uHigh;
  uniform float uLevel;
  uniform float uProg;
  uniform float uScroll;
  uniform float uDim;
  uniform vec4  uFx;    // x: echo, y: space, z: flange, w: chorus
  uniform vec2  uLfo;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float asp = uRes.x / uRes.y;
    vec2 p = (uv - 0.5) * vec2(asp, 1.0);
    
    // CHORUS (Heavy Ink): Замедляем время и закручиваем координаты в водовороты
    float t = uTime * mix(0.028, 0.004, uFx.w);
    vec2 swirl = vec2(noise(p * 2.0 + vec2(t, 0.0)), noise(p * 2.0 - vec2(0.0, t))) - 0.5;
    p += swirl * uFx.w * 0.35;

    // ECHO (Air Refraction): Физические звуковые волны от винила, искажающие координаты
    float distVinyl = length(p - vec2(0.24, 0.06));
    float ripple = sin(distVinyl * 40.0 - uTime * 6.0);
    p += normalize(p - vec2(0.24, 0.06)) * ripple * exp(-distVinyl * 3.0) * uFx.x * 0.035;

    // Базовая деформация пространства
    vec2 q = vec2(fbm(p * 1.5 + vec2(0.0, t)),
                  fbm(p * 1.5 + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm(p * 1.9 + 2.3 * q + vec2(1.7, 9.2) + 0.7 * t),
                  fbm(p * 1.9 + 2.3 * q + vec2(8.3, 2.8) - 0.6 * t));
                  
    // Основной туман
    float f_raw = fbm(p * 1.25 + 2.1 * r + vec2(uScroll * 0.22, 0.0));

    // SPACE (Defocus): Гасим мелкие детали тумана, убирая резкость
    float detail = (fbm(p * 7.0 - r * 2.0 + t) - 0.5) * 0.16 * (0.4 + uHigh);
    f_raw += detail * (1.0 - uFx.y);

    // Динамический контраст
    float edgeLo = 0.26;
    float edgeHi = 0.74;

    // SPACE: Делаем границы очень мягкими (боке/расфокус)
    edgeLo = mix(edgeLo, 0.02, uFx.y);
    edgeHi = mix(edgeHi, 0.98, uFx.y);

    // FLANGE: Делаем границы экстремально жесткими (жидкий хром)
    edgeLo = mix(edgeLo, 0.46, uFx.z);
    edgeHi = mix(edgeHi, 0.54, uFx.z);

    float f = smoothstep(edgeLo, edgeHi, f_raw);

    // Горизонт и базовые цвета
    float hy   = mix(0.30, 0.54, uProg);
    float dy   = uv.y - hy;
    float band = exp(-dy * dy * mix(16.0, 8.0, uProg));
    float dawn = mix(0.12, 1.0, smoothstep(0.0, 1.0, uProg));

    vec3 night = vec3(0.012, 0.016, 0.028);
    vec3 lo    = vec3(0.045, 0.062, 0.100);
    vec3 hi    = mix(vec3(0.26, 0.33, 0.46), vec3(0.56, 0.61, 0.70), uProg);

    // SPACE добавляет объемное фоновое свечение воздуха
    float lit = 0.30 + 0.60 * band * dawn + (uFx.y * 0.25);

    vec3 col = night + mix(lo, hi, f) * f * lit * (0.5 + 0.3 * uLevel);
    
    // Бас вспучивает горизонт
    col += hi * f * band * uBass * 0.10;

    // FLANGE (Liquid Chrome): Высчитываем жесткий глянцевый блик на краях тумана
    float metallic = smoothstep(0.42, 0.5, f_raw) * smoothstep(0.58, 0.5, f_raw);
    col += hi * metallic * uFx.z * 1.5 * (0.4 + uLevel);

    // Холодный ореол за винилом
    float halo = exp(-distVinyl * 2.4);
    col += vec3(0.16, 0.22, 0.34) * f * halo * 0.32 * (1.0 - 0.5 * uProg);

    // Фонарик под курсором
    vec2 m = (uMouse - 0.5) * vec2(asp, 1.0);
    float md = length(p - m);
    col += hi * f * exp(-md * md * 10.0) * 0.14;

    // Тепло в конце трека (закат)
    col += vec3(0.60, 0.16, 0.24) * band * pow(uProg, 3.0) * (0.35 + f) * 0.06;

    // Виньетка и пленочный шум (dither)
    col *= 1.0 - smoothstep(0.3, 1.6, length(p * vec2(0.8, 1.05)));
    col *= uDim;
    col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * (1.5 / 255.0);

    gl_FragColor = vec4(col, 1.0);
  }`;

  const fog = (() => {
    const canvas = $('#fog');
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) ||
           canvas.getContext('experimental-webgl');
    } catch (_) { /* no WebGL */ }
    if (!gl) { canvas.style.display = 'none'; return null; }

    // Проверяем, не встроенная ли графика на ноутбуке
    let isIntegrated = false;
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL).toLowerCase();
        isIntegrated = /intel|iris|uhd|hd graphics|vega|radeon\(tm\) graphics|swiftshader/.test(gpu);
      }
    } catch (_) {}

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(sh)); return null; }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { canvas.style.display = 'none'; return null; }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return null; }
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    ['uRes', 'uTime', 'uMouse', 'uBass', 'uHigh', 'uLevel', 'uProg', 'uScroll', 'uDim', 'uFx', 'uLfo']
      .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    // На встройках сразу берем scale = 0.35 и dpr = 1.0, чтобы ноутбук не задыхался
    let scale = isIntegrated ? 0.35 : 0.5;
    const maxDpr = isIntegrated ? 1.0 : (window.innerWidth < 768 ? 1.25 : 1.5);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const w = Math.max(2, Math.round(innerWidth * dpr * scale));
      const h = Math.max(2, Math.round(innerHeight * dpr * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    }
    function draw(v) {
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, v.time);
      gl.uniform2f(U.uMouse, v.mx, v.my);
      gl.uniform1f(U.uBass, v.bass);
      gl.uniform1f(U.uHigh, v.high);
      gl.uniform1f(U.uLevel, v.level);
      gl.uniform1f(U.uProg, v.prog);
      gl.uniform1f(U.uScroll, v.scroll);
      gl.uniform1f(U.uDim, v.dim);
      const X = window.GFX || { fx: [0, 0, 0, 0], lfo: [0, 0] };
      gl.uniform4f(U.uFx, X.fx[0], X.fx[1], X.fx[2], X.fx[3]);
      gl.uniform2f(U.uLfo, X.lfo[0], X.lfo[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function lighter() {
      if (scale <= 0.22) return false;
      scale *= 0.75;
      resize();
      return true;
    }
    resize();
    return { resize, draw, lighter };
  })();

  /* ───────────────────────── 4 · turntable ───────────────────────── */

  (function buildDisc() {
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    };
    const { cx, cy } = DISC;

    // grooves, with two smoother track gaps
    const grooves = document.createDocumentFragment();
    for (let r = 106, n = 0; r <= 292; r += 2.1, n++) {
      const gap = Math.abs(r - 196) < 3.4 || Math.abs(r - 246) < 3.4;
      grooves.appendChild(mk('circle', {
        cx, cy, r: r.toFixed(1), fill: 'none', stroke: '#fff',
        'stroke-opacity': gap ? 0.065 : (n % 2 ? 0.05 : 0.022),
        'stroke-width': gap ? 3 : 0.8
      }));
    }
    $('#grooves').appendChild(grooves);

    // ticks around the platter rim
    const ticks = document.createDocumentFragment();
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2, big = i % 10 === 0, r1 = 309, r2 = big ? 322 : 316;
      ticks.appendChild(mk('line', {
        x1: (cx + Math.cos(a) * r1).toFixed(1), y1: (cy + Math.sin(a) * r1).toFixed(1),
        x2: (cx + Math.cos(a) * r2).toFixed(1), y2: (cy + Math.sin(a) * r2).toFixed(1),
        stroke: '#fff', 'stroke-opacity': big ? 0.3 : 0.11, 'stroke-width': big ? 1.6 : 1
      }));
    }
    $('#ticks').appendChild(ticks);

    // a few specks and one scratch, so the turning is visible
    const rnd = mulberry32(11), specks = document.createDocumentFragment();
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2, r = 125 + rnd() * 165;
      specks.appendChild(mk('circle', {
        cx: (cx + Math.cos(a) * r).toFixed(1), cy: (cy + Math.sin(a) * r).toFixed(1),
        r: (0.7 + rnd() * 1.1).toFixed(1), fill: '#fff', 'fill-opacity': (0.18 + rnd() * 0.3).toFixed(2)
      }));
    }
    const a1 = 0.6, a2 = 1.15, rs = 262;
    specks.appendChild(mk('path', {
      d: 'M' + (cx + Math.cos(a1) * rs).toFixed(1) + ' ' + (cy + Math.sin(a1) * rs).toFixed(1) +
         ' A' + rs + ' ' + rs + ' 0 0 1 ' + (cx + Math.cos(a2) * rs).toFixed(1) + ' ' + (cy + Math.sin(a2) * rs).toFixed(1),
      fill: 'none', stroke: '#fff', 'stroke-opacity': 0.16, 'stroke-width': 0.8
    }));
    $('#specks').appendChild(specks);
  })();

  // where the tonearm must point so the needle sits on a groove of radius R
  function armAngleFor(R) {
    const dx = DISC.cx - ARM.px, dy = DISC.cy - ARM.py, d = Math.hypot(dx, dy);
    const a = (ARM.len * ARM.len - R * R + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, ARM.len * ARM.len - a * a));
    const ux = dx / d, uy = dy / d, bx = ARM.px + a * ux, by = ARM.py + a * uy;
    const n1 = [bx - h * uy, by + h * ux], n2 = [bx + h * uy, by - h * ux];
    const n = n1[1] > n2[1] ? n1 : n2;                                  // the arm comes in from the lower right
    return (Math.atan2(n[1] - ARM.py, n[0] - ARM.px) * 180) / Math.PI - 180;
  }
  const armStart = armAngleFor(ARM.startR);
  const armEnd   = armAngleFor(ARM.endR);
  const armRest  = armStart - ARM.lift;
  S.deck = { arm: ARM, disc: DISC, start: armStart, end: armEnd, rest: armRest, spin: SPIN };   // read by deck.js


  /* ───────────────────── 5 · waveform scrubber ───────────────────── */

  const BAR = 2;
  const wf = { c: $('#wave'), ctx: null, w: 0, h: 0, dpr: 1, n: 0, bars: new Float32Array(0), hover: null, dragging: false, dirty: true, reveal: 0 };
  wf.ctx = wf.c.getContext('2d');
  const tip = $('#waveTip');

  function wfBars() {
    const n = Math.max(8, Math.floor((wf.w + 3) / (BAR + 3)));
    wf.n = n;
    wf.bars = new Float32Array(n);
    if (!S.peaks) return;
    const P = S.peaks.length;
    for (let i = 0; i < n; i++) {
      const a = Math.floor((i / n) * P), b = Math.max(a + 1, Math.floor(((i + 1) / n) * P));
      let s = 0, m = 0;
      for (let j = a; j < b; j++) { s += S.peaks[j]; if (S.peaks[j] > m) m = S.peaks[j]; }
      wf.bars[i] = 0.6 * (s / (b - a)) + 0.4 * m;
    }
  }
  function wfResize() {
    const r = wf.c.getBoundingClientRect();
    wf.dpr = Math.min(window.devicePixelRatio || 1, 2);
    wf.w = r.width; wf.h = r.height;
    wf.c.width = Math.round(r.width * wf.dpr);
    wf.c.height = Math.round(r.height * wf.dpr);
    wf.ctx.setTransform(wf.dpr, 0, 0, wf.dpr, 0, 0);
    wfBars();
    wf.dirty = true;
  }

  function wfDraw(now) {
    const { ctx, w, h, n } = wf;
    ctx.clearRect(0, 0, w, h);
    if (!n) return;
    const mid = h / 2, px = S.prog * w, ready = !!S.peaks, span = n > 1 ? (w - BAR) / (n - 1) : 0;

    for (let i = 0; i < n; i++) {
      const x = i * span;
      let amp;
      if (ready) amp = (0.05 + 0.95 * wf.bars[i]) * ease(clamp(wf.reveal * 1.6 - (i / n) * 0.6));
      else amp = 0.1 + 0.05 * Math.sin(i * 0.32 + now / 500);            // waiting for the analysis
      if (S.playing) { const dx = x - px; amp *= 1 + Math.exp(-(dx * dx) / 3200) * S.level * 0.35; }
      const hh = Math.max(1, amp * h * 0.44);
      ctx.fillStyle = x + BAR <= px ? 'rgba(231,233,238,.92)'
                    : (wf.hover !== null && x <= wf.hover ? 'rgba(231,233,238,.42)' : 'rgba(231,233,238,.2)');
      ctx.fillRect(x, mid - hh, BAR, hh * 2);
    }

    if (dur() && (S.playing || S.prog > 0)) {                             // the playhead: ember
      ctx.shadowColor = 'rgba(179,50,79,.9)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#c8425f';
      ctx.fillRect(px - 0.75, 0, 1.5, h);
      ctx.shadowBlur = 0;
    }
  }

  function seekTo(sec) {
    const d = dur();
    if (!d) return;
    audio.currentTime = clamp(sec, 0, Math.max(0, d - 0.05));
    wf.dirty = true;
  }
  S.seek = seekTo;                                                      // used by deck.js (the tonearm scrubs with it)
  function seekFromEvent(e) {
    const r = wf.c.getBoundingClientRect();
    seekTo(clamp((e.clientX - r.left) / r.width) * dur());
  }
  function showTip(x) {
    const d = dur();
    tip.textContent = fmt(clamp(x / wf.w) * d);
    tip.style.left = clamp(x, 22, wf.w - 22) + 'px';
    tip.classList.add('on');
  }

  wf.c.addEventListener('pointerdown', (e) => {
    wf.dragging = true;
    try { wf.c.setPointerCapture(e.pointerId); } catch (_) {}
    seekFromEvent(e);
    showTip(e.clientX - wf.c.getBoundingClientRect().left);
  });
  wf.c.addEventListener('pointermove', (e) => {
    const x = e.clientX - wf.c.getBoundingClientRect().left;
    wf.hover = x; wf.dirty = true;
    showTip(x);
    if (wf.dragging) seekFromEvent(e);
  });
  const endDrag = (e) => {
    wf.dragging = false;
    if (e.pointerType && e.pointerType !== 'mouse') { wf.hover = null; tip.classList.remove('on'); wf.dirty = true; }
  };
  wf.c.addEventListener('pointerup', endDrag);
  wf.c.addEventListener('pointercancel', endDrag);
  wf.c.addEventListener('pointerleave', () => {
    if (wf.dragging) return;
    wf.hover = null; tip.classList.remove('on'); wf.dirty = true;
  });
  wf.c.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 15 : 5, d = dur();
    let handled = true;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') seekTo(audio.currentTime + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') seekTo(audio.currentTime - step);
    else if (e.key === 'Home') seekTo(0);
    else if (e.key === 'End') seekTo(d);
    else handled = false;
    if (handled) e.preventDefault();
  });

  /* ───────────────────────── 6 · player ───────────────────────── */

  async function toggle() {
    if (window.GDeck) {                                                 // deck.js: the motor, with inertia
      try { await GDeck.toggle(); }
      catch (_) { statusEl.textContent = 'Браузер не дал запустить звук — нажми ещё раз.'; }
      return;
    }
    if (audio.paused) {
      try { await audio.play(); }
      catch (_) { statusEl.textContent = 'Браузер не дал запустить звук — нажми ещё раз.'; }
    } else audio.pause();
  }
  [playBtn, miniBtn].forEach((b) => b.addEventListener('click', toggle));
  stageBtn.addEventListener('click', (e) => (window.GDeck ? GDeck.click(e) : toggle()));   // the stage also hosts the knob and the tonearm

  function setPlaying(v) {
    S.playing = v;
    root.classList.toggle('is-playing', v);
    if (v) { root.classList.add('has-played'); statusEl.textContent = ''; }
    const label = v ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-label', label);
    miniBtn.setAttribute('aria-label', label);
    stageBtn.setAttribute('aria-label', (v ? 'Pause ' : 'Play ') + 'infinity.dark');
    document.title = v ? '▶ ' + TITLE : TITLE;
  }
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  // ── Гравитационный коллапс и End Screen ──
  const endScreen = document.getElementById('end-screen');

  audio.addEventListener('ended', () => {
    setPlaying(false);
    audio.currentTime = 0;
    if (window.GOutro) GOutro.start();                                  // outro.js: instruments power down, the page falls into the ember point, an infinity sign unfolds
    else {                                                              // (the plain collapse, if outro.js is missing)
      document.body.classList.add('collapsed');
      if (endScreen) endScreen.classList.add('show');
    }
  });
  audio.addEventListener('error', () => {
    if (blobTrial) return;                                              // the blob attempt falls back by itself
    statusEl.textContent = 'Не нашёл audio/infinitydark.mp3 — положи трек в папку audio.';
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'infinity.dark', artist: 'gorecz', album: 'archive 001' });
      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('seekto', (d) => seekTo(d.seekTime));
    } catch (_) { /* not supported */ }
  }

  /* ─────────────── 7 · poem reveal, links, keyboard ─────────────── */

  const words = [];
  (function splitPoem() {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span');
            s.className = 'wd';
            s.textContent = part;
            frag.appendChild(s);
            words.push(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(poem);
  })();

  function updateReveal() {
    if (reduceMotion) return;
    const r = poem.getBoundingClientRect(), vh = innerHeight;
    const p = clamp((vh * 0.9 - r.top) / (vh * 0.55 + r.height * 0.5));
    const n = words.length;
    for (let i = 0; i < n; i++) {
      const o = clamp(p * (n + 3) - i, 0, 3) / 3;
      words[i].style.opacity = (0.16 + 0.84 * o).toFixed(3);
    }
  }

  $$('.row').forEach((a) => a.addEventListener('click', (e) => { if (a.getAttribute('href') === '#') e.preventDefault(); }));

  addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(tag)) return;          // those handle Space themselves
    if (document.body.classList.contains('is-ending')) return;           // the end screen has its own controls
    if (bootScreen && !bootScreen.classList.contains('hidden')) return;  // nothing plays from behind the boot screen
    e.preventDefault();
    toggle();
  });

  /* ───────────────────────── 8 · main loop ───────────────────────── */

  const mouse = { x: 0.68, y: 0.55, sx: 0.68, sy: 0.55 };
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer) {
    addEventListener('pointermove', (e) => {
      mouse.x = e.clientX / innerWidth;
      mouse.y = 1 - e.clientY / innerHeight;
      tilt.ty = (e.clientX / innerWidth - 0.5) * 2;
      tilt.tx = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  let scrollY = window.scrollY, scrollDirty = true, resizeQueued = false;
  addEventListener('scroll', () => {
    scrollY = window.scrollY;
    scrollDirty = true;
    root.classList.toggle('is-scrolled', scrollY > 40);
  }, { passive: true });
  addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; wfResize(); if (fog) fog.resize(); scrollDirty = true; });
  });

  let prev = performance.now();
  let discDeg = 0, omega = 0, armDeg = armRest, lastArm = null, progS = 0, dim = 1;
  let lastSec = -1, lastDur = -1, lastTilt = '';
  let perfFrames = 0, perfSum = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - prev) / 1000, 0.001, 0.05);
    prev = now;

    const d = dur(), t = audio.currentTime || 0;
    lyricsTick(t);
    S.prog = d ? clamp(t / d) : 0;
    progS = damp(progS, S.prog, 3.5, dt);

    // the music at the playhead → smoothed energies
    if (S.playing) sampleEnergy(t + 0.03); else { E.bass = 0; E.high = 0; E.level = 0; }
    S.bass  = follow(S.bass,  E.bass,  24, 5, dt);
    S.high  = follow(S.high,  E.high,  14, 4, dt);
    S.level = follow(S.level, E.level, 10, 3, dt);

    // time, ring, aria
    const sec = Math.floor(t);
    if (sec !== lastSec || d !== lastDur) {
      lastSec = sec; lastDur = d;
      timeEl.textContent = fmt(t) + ' / ' + fmt(d);
      miniTime.textContent = fmt(t);
      wf.c.setAttribute('aria-valuenow', String(Math.round(S.prog * 100)));
      wf.c.setAttribute('aria-valuetext', fmt(t) + ' of ' + fmt(d));
      if (d) lengthEl.textContent = fmt(d);
    }
    ringEl.style.strokeDashoffset = (188.5 * (1 - S.prog)).toFixed(2);

    // record: spins up and coasts down; the arm follows the track position
    if (window.GDeck) GDeck.step(now, dt, progS);                       // deck.js: motor, strobe ring, knob, tonearm
    else {                                                              // (the old behaviour, if deck.js is missing)
      omega = damp(omega, S.playing ? SPIN : 0, S.playing ? 1.1 : 0.8, dt);
      if (omega > 0.05) {
        discDeg = (discDeg + omega * dt) % 360;
        discEl.style.transform = 'rotate(' + discDeg.toFixed(2) + 'deg)';
      }
      armDeg = damp(armDeg, S.playing ? lerp(armStart, armEnd, progS) : armRest, 2.6, dt);
      if (lastArm === null || Math.abs(armDeg - lastArm) > 0.0005) {
        lastArm = armDeg;
        armEl.style.transform = 'rotate(' + armDeg.toFixed(3) + 'deg)';
      }
    }

    // the two ember points breathe with the bass (or slowly, when idle)
    const idle = 0.5 + 0.5 * Math.sin(now / 1100);
    ledEl.style.opacity = (S.playing ? 0.55 + S.bass * 0.45 : 0.22 + 0.16 * idle).toFixed(3);
    dotEl.style.setProperty('--p', (S.playing ? clamp(0.2 + S.bass * 0.9) : 0.1 + 0.07 * idle).toFixed(3));
    lamp.step(now, dt, S.playing, S.bass);

    if (titleDot) {
      if (S.playing) {
        titleDot.classList.add('active');
        titleDot.style.setProperty('--bass', S.bass || 0); 
      } else {

        titleDot.classList.remove('active');
      }
    }

    // gentle 3D tilt toward the pointer
    if (finePointer && !reduceMotion) {
      tilt.x = damp(tilt.x, tilt.tx, 4, dt);
      tilt.y = damp(tilt.y, tilt.ty, 4, dt);
      const tf = 'rotateX(' + (-tilt.x * 3).toFixed(2) + 'deg) rotateY(' + (tilt.y * 4).toFixed(2) + 'deg) rotate(-1.5deg)';
      if (tf !== lastTilt) { lastTilt = tf; tt.style.transform = tf; }
    }

    

    // waveform
    if (S.peaks && wf.reveal < 1) wf.reveal = Math.min(1, wf.reveal + dt / 1.4);
    if (S.playing || wf.dirty || !S.peaks || wf.reveal < 1) { wfDraw(now); wf.dirty = false; }

    // scroll-linked bits
    if (scrollDirty) { scrollDirty = false; updateReveal(); }
    dim = 1 - 0.5 * smooth(0.15, 0.95, scrollY / innerHeight);

    // fog (and a quiet check that the GPU keeps up: after ~2 s of frames, lower the resolution if not)
    if (fog) {
      if (now > 2500 && perfFrames < 90) {
        perfFrames++; perfSum += dt;
        if (perfFrames === 90 && perfSum / 90 > 0.034 && fog.lighter()) { perfFrames = 0; perfSum = 0; }
      }
      if (!finePointer) { mouse.x = 0.62 + 0.18 * Math.sin(now / 9000); mouse.y = 0.55 + 0.12 * Math.cos(now / 7000); }
      mouse.sx = damp(mouse.sx, mouse.x, 3, dt);
      mouse.sy = damp(mouse.sy, mouse.y, 3, dt);
      fog.draw({
        time: (now / 1000) * (reduceMotion ? 0.25 : 1),
        mx: mouse.sx, my: mouse.sy,
        bass: S.bass, high: S.high, level: S.level,
        prog: progS, scroll: scrollY / innerHeight, dim
      });
    }
  }

  /* ── Glitch Hover (Мягкое кибер-наведение) ── */
  const glitchTargets = document.querySelectorAll('.top-right a, .boot-btn, .link-list .row-name, .end-link span');
  const glitchSymbols = '01!<>-_\\/[]{}—=+*^?#_';

  glitchTargets.forEach(el => {
    el.setAttribute('data-original', el.textContent.trim());

    el.addEventListener('mouseenter', () => {
      const originalText = el.getAttribute('data-original');
      let iterations = 0;
      const maxIterations = 4; // Чуть меньше кадров для мягкости (было 5)

      if (el.dataset.isGlitching === 'true') return;
      el.dataset.isGlitching = 'true';

      const interval = setInterval(() => {
        el.textContent = originalText.split('').map(char => {
          if (char === ' ') return ' '; 
          // МЯГКОСТЬ: с вероятностью 60% оставляем родную букву
          if (Math.random() > 0.4) return char; 
          // И только 40% заменяем на глитч
          return glitchSymbols[Math.floor(Math.random() * glitchSymbols.length)];
        }).join('');

        iterations++;
        if (iterations >= maxIterations) {
          clearInterval(interval);
          el.textContent = originalText;
          el.dataset.isGlitching = 'false';
        }
      }, 45); // Чуть-чуть медленнее, чтобы это выглядело как искра (было 30)
    });
  });

  /* ── Deep Dive Mode ── */
  let idleTimer;
  
  const resetIdleTimer = () => {
    document.body.classList.remove('deep-dive');
    clearTimeout(idleTimer);
    
    // Прячем интерфейс только если трек играет (используем твой объект S)
    if (S && S.playing) {
      idleTimer = setTimeout(() => {
        document.body.classList.add('deep-dive');
      }, 3000); // 3 секунды простоя
    }
  };

  // Пробуждаем интерфейс при любой активности
  ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'].forEach(evt => {
    window.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  // Привязываемся к твоему плееру: ставим на паузу — UI возвращается навсегда
  audio.addEventListener('play', resetIdleTimer);
  audio.addEventListener('pause', () => {
    clearTimeout(idleTimer);
    document.body.classList.remove('deep-dive');
  });

  wfResize();
  loadAnalysis();
  requestAnimationFrame(frame);
})();
