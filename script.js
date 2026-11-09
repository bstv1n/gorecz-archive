/* gorecz — archive · the "code" side. Plain JS, no libraries.
   Add a release = one entry in RELEASES. Locked entries carry NO names on purpose:
   this file is public, so unreleased titles must not be written here. */
(() => {
  'use strict';
  const root = document.documentElement, $ = (s) => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const damp = (c, t, r, dt) => c + (t - c) * (1 - Math.exp(-r * dt));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const RELEASES = [
    { n: '001', title: 'infinity.dark', meta: ['cold ambient / lovemusic', 'released oct 2026'], cover: 'assets/cover-001.webp', href: 'infinity-dark/index.html' },
    { n: '002' }, { n: '003' }, { n: '004' }
  ];

  /* index: every release is a channel with a signal line */
  const idx = $('#idx');
  idx.innerHTML = RELEASES.map((r, i) => r.href
    ? `<li data-i="${i}"><a class="row" href="${r.href}"><span class="n">${r.n}</span><span><span class="t">${r.title}</span><span class="m">${r.meta.join('<br>')}</span></span><canvas class="sig"></canvas></a></li>`
    : `<li class="lock" data-i="${i}"><div class="row" aria-label="unreleased"><span class="n">${r.n}</span><span><span class="t off">no signal</span><span class="m">unreleased</span></span><canvas class="sig"></canvas></div></li>`
  ).join('');
  $('#count').textContent = RELEASES.filter((r) => r.href).length + ' / ' + RELEASES.length;
  const lis = Array.from(idx.children), veil = $('#veil'), hero = $('#hero'), poem = $('.txt p');

  const sigs = lis.map((li, i) => { const c = li.querySelector('canvas'); return { c, g: c.getContext('2d'), w: 0, h: 0, live: !!RELEASES[i].href, seed: i * 2.9 + 1.3, amp: .28 }; });
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); sigs.forEach((s) => { s.w = s.c.clientWidth; s.h = s.c.clientHeight; s.c.width = Math.round(s.w * d); s.c.height = Math.round(s.h * d); s.g.setTransform(d, 0, 0, d, 0, 0); }); };
  size(); addEventListener('resize', size);

  let active = -1, leaving = 0, px = innerWidth * .68, py = innerHeight * .45, spx = px, spy = py, r = 0, o = 0, hv = false, dv = 50, kb = -1, kbMode = false, lastSec = -1, cx = px, cyy = py, mx = px, my = py, curTxt = '';

  const drawSig = (s, i, t, dt) => {
    const g = s.g, w = s.w, h = s.h, on = i === active;
    s.amp = damp(s.amp, on ? 1 : .28, 5, dt); s.jolt = Math.max(0, (s.jolt || 0) - dt * 1.6);
    g.clearRect(0, 0, w, h);
    g.lineWidth = 1.25;
    g.strokeStyle = !s.live ? (s.jolt > .05 ? '#b3324f' : 'rgba(217,217,212,.35)') : on ? '#b3324f' : 'rgba(217,217,212,.75)';
    g.setLineDash(s.live || s.jolt > .05 ? [] : [2, 6]);
    g.beginPath();
    const N = Math.max(60, Math.round(w / 4));
    for (let k = 0; k <= N; k++) {
      const u = k / N; let y = h / 2;
      if (s.live) {
        const env = .25 + .75 * Math.abs(Math.sin(u * 7 + s.seed) * Math.cos(u * 2.1 + s.seed * .6));
        y += Math.sin(k * 1.7 + t * 2.2) * Math.sin(k * .43 - t * .9 + s.seed) * env * h * .42 * s.amp;
      } else {
        y += Math.exp(-Math.pow((u - ((t * .07 + s.seed) % 1)) * 40, 2)) * h * .18 * Math.sin(k * 2) + (Math.random() - .5) * h * .9 * s.jolt * Math.sin(u * Math.PI);
      }
      k ? g.lineTo(u * w, y) : g.moveTo(0, y);
    }
    g.stroke(); g.setLineDash([]);
    if (on && fine) { const x = px - s.c.getBoundingClientRect().left; if (x >= 0 && x <= w) { g.strokeStyle = 'rgba(217,217,212,.55)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } }
  };

  /* hero cut (code | sound) and the about line that lights up word by word */
  if (fine) { hero.addEventListener('pointerenter', () => { hv = true; }); hero.addEventListener('pointerleave', () => { hv = false; }); }
  poem.innerHTML = poem.textContent.trim().split(/\s+/).map((w) => '<span>' + w + '</span>').join(' ');
  const W = Array.from(poem.children);

  /* hero, sound side: stacked signal ridges drawn by code */
  const ridge = $('#ridge'), rg = ridge.getContext('2d'), roll = $('.roll');
  let cf = 0, wt = 0, ws = 1, ppx = 0, ppy = 0; // code wave: cursor focus, wave time, wave speed, last pointer
  const LN = roll.textContent.replace(/\n$/, '').split('\n').map((t) => { const d = document.createElement('div'); d.className = 'ln'; d.textContent = t || ' '; return d; });
  roll.textContent = ''; LN.forEach((d) => roll.appendChild(d));
  let rw = 0, rh = 0;
  const rsize = () => { const d = Math.min(devicePixelRatio || 1, 2); rw = ridge.clientWidth; rh = ridge.clientHeight; ridge.width = Math.round(rw * d); ridge.height = Math.round(rh * d); rg.setTransform(d, 0, 0, d, 0, 0); };
  rsize(); addEventListener('resize', rsize);
  const drawRidge = (t, ip, sp) => {
    const rows = 30, g0 = rh * .72 / rows, top = rh * (.2 + .3 * sp), gap = g0 * (1 - sp * .97), cx = rw * .62, sg = rw * .26, amp = (1 - sp) * (1 - sp), front = ip * 1.5 * rw;
    rg.clearRect(0, 0, rw, rh); rg.lineWidth = 1; rg.strokeStyle = 'rgba(217,217,212,' + (.55 * (.4 + .6 * ip)).toFixed(2) + ')'; rg.fillStyle = 'rgba(23,24,26,.9)';
    for (let i = 0; i < rows; i++) {
      const y0 = top + i * gap, ys = [];
      for (let x = 0; x <= rw; x += 6) {
        const env = Math.exp(-Math.pow((x - cx) / sg, 2)) * clamp((front - x) / (rw * .25)); // the wave bursts out of a flat line, left to right
        ys.push(y0 - env * amp * Math.abs(Math.sin(x * .017 + i * 1.3 + t * .5) * Math.sin(x * .043 - i * .7 + t * .35)) * g0 * 5.5);
      }
      rg.beginPath(); ys.forEach((y, k) => (k ? rg.lineTo(k * 6, y) : rg.moveTo(0, y))); rg.lineTo(rw, rh); rg.lineTo(0, rh); rg.closePath(); rg.fill();
      rg.beginPath(); ys.forEach((y, k) => (k ? rg.lineTo(k * 6, y) : rg.moveTo(0, y))); rg.stroke();
    }
  };

  /* hero opening: the wordmark decodes out of noise, the flat signal bursts into waves, the cut draws itself.
     Scrolling then folds it all away: waves flatten into one line, the title shrinks, and the releases rise in */
  const scene = $('#scene'), htext = $('#htext'), cutEl = $('.cut'), wm = $('.wordmark'), GL = '01{}<>/_=;#+*';
  let t0 = 0, decoded = false;
  const wch = [], dot = wm.querySelector('.dot');
  Array.from(wm.childNodes).forEach((n) => { if (n !== dot) n.remove(); });
  Array.from('gorecz archive').forEach((c) => {
    if (c === ' ') { wm.insertBefore(document.createTextNode(' '), dot); return; }
    const s = document.createElement('span'); s.className = 'wc'; s.textContent = c; wm.insertBefore(s, dot); wch.push({ s, c });
  });
  const decode = (now) => {
    if (decoded) return;
    const el = t0 ? (now - t0) / 1000 : 0;
    wch.forEach((o, k) => {
      const done = el > .5 + k * .09, txt = done ? o.c : GL[(Math.floor(now / 70) * 7 + k * 5) % GL.length];
      if (o.s.textContent !== txt) o.s.textContent = txt;
      o.s.style.opacity = done ? '' : '.45';
    });
    if (el > 2) decoded = true;
  };
  const rowEls = Array.from(document.querySelectorAll('.row'));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setTimeout(() => e.target.classList.add('in'), rowEls.indexOf(e.target) * 110); io.unobserve(e.target); } }), { threshold: .2 });
  rowEls.forEach((r) => io.observe(r));

  /* about: the same data, two views — as syntax (fig. 1) and as level meters (fig. 2) */
  $('#data').innerHTML = '<span class="off">// gorecz archive</span>\narchive = [\n' + RELEASES.map((r, i) =>
    "  { n: '" + r.n + "', status: <span class=\"" + (r.href ? 'on' : 'off') + "\">'" + (r.href ? 'released' : 'locked') + "'</span> }" + (i < RELEASES.length - 1 ? ',' : '')).join('\n') + '\n]';
  const mc = $('#meters'), mg = mc.getContext('2d');
  let mw = 0, mh = 0;
  const msize = () => { const d = Math.min(devicePixelRatio || 1, 2); mw = mc.clientWidth; mh = mc.clientHeight; mc.width = Math.round(mw * d); mc.height = Math.round(mh * d); mg.setTransform(d, 0, 0, d, 0, 0); };
  msize(); addEventListener('resize', msize);
  const drawMeters = (t) => {
    const n = RELEASES.length, cells = 22, gx = mw / n, cw = Math.min(gx * .5, 46), ch = (mh - 26) / cells;
    mg.clearRect(0, 0, mw, mh); mg.textAlign = 'center'; mg.font = '12px "Space Mono", monospace';
    RELEASES.forEach((r, i) => {
      const lvl = r.href ? clamp(.62 + .22 * Math.sin(t * 1.7 + i) + .12 * Math.sin(t * 4.1 + i * 2.3)) : .04, lit = Math.round(lvl * cells), x = gx * i + (gx - cw) / 2;
      for (let k = 0; k < cells; k++) {
        mg.fillStyle = k < lit ? (k >= cells - 4 ? '#b3324f' : 'rgba(217,217,212,.8)') : 'rgba(217,217,212,.1)';
        mg.fillRect(x, mh - 22 - (k + 1) * ch + 2, cw, ch - 3);
      }
      mg.fillStyle = '#7c7d77'; mg.fillText(r.n, x + cw / 2, mh - 4);
    });
  };

  /* torch: under the cursor a released cover appears */
  const setActive = (i) => {
    if (leaving || i === active) return;
    active = i;
    lis.forEach((li, k) => li.classList.toggle('on', k === i));
    idx.classList.toggle('dim', i >= 0 && fine);
    const c = i >= 0 && RELEASES[i].cover;
    if (c) veil.style.backgroundImage = 'url(' + c + ')';
  };
  if (fine) {
    lis.forEach((li, i) => { li.addEventListener('pointerenter', () => { kb = i; setActive(i); }); li.addEventListener('pointerleave', () => setActive(-1)); });
    addEventListener('pointermove', (e) => { px = mx = e.clientX; py = my = e.clientY; kbMode = false; }, { passive: true });
  }
  if (!fine) { // touch: dragging a finger across the hero moves the cut and stirs the code wave; let go and it drifts again
    const drag = (e) => { hv = true; px = mx = e.clientX; py = my = e.clientY; };
    hero.addEventListener('pointerdown', drag);
    hero.addEventListener('pointermove', (e) => { if (hv) drag(e); });
    ['pointerup', 'pointercancel'].forEach((t) => hero.addEventListener(t, () => { hv = false; }));
  }
  const pick = () => { // touch: the channel nearest the middle of the screen is lit
    let b = -1, bd = 1e9, cy = 0;
    lis.forEach((li, i) => { const q = li.getBoundingClientRect(), d = Math.abs(q.top + q.height / 2 - innerHeight / 2); if (d < bd) { bd = d; b = i; cy = q.top + q.height / 2; } });
    if (bd < innerHeight * .25) { px = innerWidth * .55; py = cy; return b; }
    return -1;
  };

  const goto = (v) => { const el = v === 'gate' ? null : $('#' + v); scrollTo({ top: el ? el.getBoundingClientRect().top + scrollY : 0, behavior: 'smooth' }); };

  /* live details: clock, tab title, instrument cursor, closed channels that jolt, keyboard, terminal */
  const clock = $('#clock'), cur = $('#cur'), xy = $('.xy'), ring = $('.ring'), termEl = $('#term'), tout = $('#tout'), tcmd = $('#tcmd'), T0 = document.title;
  document.addEventListener('visibilitychange', () => { document.title = document.hidden ? 'signal lost' : T0; });
  if (fine) {
    addEventListener('pointermove', () => { cur.classList.add('on'); root.classList.add('has-cur'); }, { once: true });
    document.addEventListener('mouseleave', () => cur.classList.remove('on'));
    document.addEventListener('mouseenter', () => cur.classList.add('on'));
  }
  const jolt = (i) => {
    sigs[i].jolt = 1; if (navigator.vibrate) navigator.vibrate(18);
    const m = lis[i].querySelector('.m');
    if (!m.dataset.t) { m.dataset.t = m.innerHTML; m.textContent = 'not released yet'; setTimeout(() => { m.innerHTML = m.dataset.t; delete m.dataset.t; }, 1600); }
  };
  idx.addEventListener('click', (e) => { const l = e.target.closest('li.lock'); if (l) jolt(+l.dataset.i); });
  const openRelease = (i) => { const a = lis[i] && lis[i].querySelector('a'); if (a) a.click(); return !!a; };

  const say = (t, c) => { const d = document.createElement('div'); if (c) d.className = c; d.textContent = t; tout.appendChild(d); tout.scrollTop = tout.scrollHeight; };
  const termOpen = (v) => { termEl.hidden = !v; root.classList.toggle('native', v); if (v) { if (!tout.children.length) say("gorecz archive — type 'help'"); tcmd.focus(); } else tcmd.blur(); };
  const CMDS = {
    help: () => ['help        this list', 'ls          list releases', 'open <n>    open a release, e.g. open 001', 'releases    go to releases', 'about       go to about', 'home        back to the gate', 'clear       clear the screen', 'exit        close (or press Esc)'],
    ls: () => RELEASES.map((q) => q.n + '  ' + (q.href ? q.title.padEnd(16) + 'released' : 'no signal'.padEnd(16) + 'locked')),
    about: () => { termOpen(false); goto('about'); return []; },
    releases: () => { termOpen(false); goto('releases'); return []; },
    home: () => { termOpen(false); goto('gate'); return []; },
    clear: () => { tout.textContent = ''; return []; },
    exit: () => { termOpen(false); return []; },
    open: (a) => {
      const i = RELEASES.findIndex((q) => q.n === a);
      if (i < 0) return ['open: no such release ' + (a || '')];
      if (!RELEASES[i].href) { jolt(i); return [a + ': no signal (unreleased)']; }
      termOpen(false); openRelease(i); return ['opening ' + a + ' …'];
    }
  };
  tcmd.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const raw = tcmd.value.trim(); tcmd.value = ''; if (!raw) return;
    say('$ ' + raw, 'c');
    const [c, ...rest] = raw.split(/\s+/), f = CMDS[c.toLowerCase()];
    (f ? f(rest[0]) : ['command not found: ' + c + " — type 'help'"]).forEach((l) => say(l));
  });
  $('#endbtn').addEventListener('click', () => termOpen(termEl.hidden));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!termEl.hidden) termOpen(false); return; }
    if (e.target === tcmd || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '~' || e.key === '`') { e.preventDefault(); termOpen(termEl.hidden); return; }
    const free = document.activeElement === document.body || document.activeElement === document.documentElement;
    if (!termEl.hidden || leaving || !fine || !free) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const q = idx.getBoundingClientRect(); if (q.bottom < 0 || q.top > innerHeight) return;
      e.preventDefault();
      kb = kb < 0 ? 0 : clamp(kb + (e.key === 'ArrowDown' ? 1 : -1), 0, lis.length - 1);
      kbMode = true; setActive(kb);
      const b = lis[kb].getBoundingClientRect(); if (b.top < 80 || b.bottom > innerHeight - 80) lis[kb].scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (e.key === 'Enter' && kb >= 0 && active === kb) { e.preventDefault(); if (!openRelease(kb)) jolt(kb); }
  });

  /* leaving: the light widens until the cover fills the screen, then night, then the track page */
  idx.addEventListener('click', (e) => {
    const a = e.target.closest('a.row');
    if (!a || reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    setActive(+a.parentNode.dataset.i);
    leaving = performance.now();
    setTimeout(() => root.classList.add('leaving'), 650);
    setTimeout(() => { location.href = a.href; }, 1250);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { leaving = 0; root.classList.remove('leaving'); setActive(-1); } });

  const go = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    root.classList.add('is-ready');
    wch.forEach((o) => { o.s.style.width = ''; o.s.textContent = o.c; o.s.style.width = o.s.getBoundingClientRect().width + 'px'; });
    t0 = reduce ? -1e9 : performance.now();
  }));
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise((res) => setTimeout(res, 1500))]).then(go, go); else go();

  /* arriving from the track page (it links to index.html#from-001): lift the night, land on 001, light it for a moment */
  if (root.classList.contains('arriving')) {
    history.replaceState(null, '', location.pathname + location.search + '#releases');
    setTimeout(() => {
      const q = lis[0].getBoundingClientRect(), y = q.top + scrollY + q.height / 2 - innerHeight / 2;
      root.style.scrollBehavior = 'auto'; scrollTo(0, Math.max(0, y)); root.style.scrollBehavior = '';
      root.classList.remove('arriving');
      if (fine) { kb = 0; kbMode = true; setActive(0); }
      setTimeout(() => { kbMode = false; if (fine && !lis[0].matches(':hover')) setActive(-1); }, 2400);
    }, 450);
  }

  let prev = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - prev) / 1000, .001, .05); prev = now;
    if (!fine) setActive(pick());
    spx = damp(spx, px, 5, dt); spy = damp(spy, py, 5, dt);
    const on = active >= 0 && !!RELEASES[active].cover, base = clamp(Math.min(innerWidth, innerHeight) * .34, 150, 330);
    r = damp(r, on ? base : 0, 6, dt); o = damp(o, on ? 1 : 0, 5, dt);
    const lp = leaving ? ease(clamp((now - leaving) / 650)) : 0, big = Math.hypot(innerWidth, innerHeight) * 1.6;
    veil.style.setProperty('--x', spx.toFixed(1) + 'px');
    veil.style.setProperty('--y', spy.toFixed(1) + 'px');
    veil.style.setProperty('--r', (r + (big - r) * lp).toFixed(0) + 'px');
    veil.style.opacity = Math.max(o, lp).toFixed(3);
    const now2 = new Date(), sec = now2.getSeconds();
    if (sec !== lastSec) { lastSec = sec; clock.textContent = now2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    if (fine) {
      // the dot IS the cursor (exact, no lag); only the ring trails behind it
      cx = damp(cx, mx, 14, dt); cyy = damp(cyy, my, 14, dt);
      cur.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      ring.style.transform = 'translate(' + (cx - mx).toFixed(1) + 'px,' + (cyy - my).toFixed(1) + 'px)';
      const rel = active >= 0 && !leaving ? RELEASES[active] : null;
      cur.classList.toggle('open', !!(rel && rel.href)); cur.classList.toggle('lock', !!(rel && !rel.href));
      const txt = rel ? (rel.href ? 'open ' + rel.n : 'no signal') : 'x ' + (mx | 0) + '  y ' + (my | 0);
      if (txt !== curTxt) { curTxt = txt; xy.textContent = txt; }
      if (kbMode && kb >= 0) { const b = lis[kb].getBoundingClientRect(); px = innerWidth * .55; py = b.top + b.height / 2; }
      if (kbMode && active >= 0) { const iq = idx.getBoundingClientRect(); if (iq.bottom < 0 || iq.top > innerHeight) { kbMode = false; setActive(-1); } }
    }

    const q = idx.getBoundingClientRect();
    if (q.bottom > 0 && q.top < innerHeight) sigs.forEach((s, i) => drawSig(s, i, reduce ? 0 : now / 1000, dt));
    const fq = mc.getBoundingClientRect();
    if (fq.bottom > 0 && fq.top < innerHeight) drawMeters(reduce ? 0 : now / 1000);
    const sc = scene.getBoundingClientRect(), sp = clamp(-sc.top / (sc.height - innerHeight)), ipl = t0 ? clamp((now - t0) / 2600) : 0, ip = ease(ipl);
    if (scrollY < innerHeight * 1.9) {
      drawRidge(reduce ? 0 : now / 1000, ipl, sp);
      htext.style.transform = 'translateY(' + (-sp * 16).toFixed(2) + 'vh) scale(' + (1 - sp * .28).toFixed(3) + ')';
      htext.style.opacity = clamp(1 - sp * 1.15).toFixed(3);
      cutEl.style.transform = 'scaleY(' + clamp(ip * 2.2).toFixed(3) + ')'; cutEl.style.opacity = (1 - sp).toFixed(3);
      decode(now);
      if (!reduce) {
        // the code is a wave, like the ridges: it undulates in place and a crest runs up through the lines;
        // where it passes, lines swell, brighten and sway. The cursor pulls the swell towards it,
        // and the faster the mouse moves, the faster the wave runs
        cf = damp(cf, hv ? 1 : 0, 3, dt);
        ws = damp(ws, .9 + clamp(Math.hypot(px - ppx, py - ppy) / dt / 900, 0, 2.2), 3, dt); ppx = px; ppy = py;
        wt += ws * dt;
        const lh = LN[0].offsetHeight || 21, y0 = roll.offsetTop, ly = spy - hero.getBoundingClientRect().top;
        LN.forEach((el, i) => {
          const env = .3 + .7 * cf * Math.exp(-Math.pow((y0 + (i + .5) * lh - ly) / (rh * .3), 2));
          const a = Math.pow(Math.abs(Math.sin(i * .33 + wt * .9) * Math.sin(i * .11 - wt * .5)), .6) * env;
          el.style.transform = 'translateX(' + (-a * 40).toFixed(1) + 'px) scale(' + (1 + a * .35).toFixed(3) + ')';
          el.style.opacity = ((.22 + .7 * a) * clamp(ip * 1.6 - i / 38) * clamp(1 - sp * 1.3)).toFixed(2);
        });
      }
      const tg = reduce ? 50 : hv ? clamp(spx / innerWidth * 100, 8, 92) : fine ? 50 + 4 * Math.sin(now / 3200) : 50 + 18 * Math.sin(now / 2800);
      dv = damp(dv, tg, 4, dt); hero.style.setProperty('--d', dv.toFixed(2) + '%');
    }
    if (!reduce) {
      const b = poem.getBoundingClientRect();
      if (b.top < innerHeight && b.bottom > 0) {
        // finishes before the poem reaches mid-screen, and always by the end of the page
        const se = document.scrollingElement, left = se.scrollHeight - innerHeight - scrollY;
        const k = Math.max(clamp((innerHeight * .9 - b.top) / (b.height * .85 + innerHeight * .08)), clamp(1 - left / (innerHeight * .2))) * W.length;
        W.forEach((el, i) => { el.style.opacity = (.18 + .82 * clamp(k - i)).toFixed(2); });
      }
    }
  }
  requestAnimationFrame(frame);
})();
