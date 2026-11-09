/* infinity.dark deck: the turntable's moving parts, in one place.
   MOTOR   start = the platter winds up and the sound winds up with it (pitch rises from a slow growl); pause = the platter coasts down and the
           sound slows with it, then stops. Speed changes glide the same way. MOTOR.follow = false keeps the visuals but makes the sound start and
           stop at once.
   KNOB    a three-way switch on the deck: slow (0.8x, lower and dragging), 33 (as recorded), 45 (1.35x, true to a record, faster and higher).
           Click its left half to turn it left, its right half to turn it right. Pitch follows speed, as on vinyl.
   STROBE  the ring of ticks on the platter rim is not locked to the record: it stands still when the platter runs at exactly 33,
           and creeps when it is winding up, or at 45, like a real strobe ring under a mains-lit lamp. It also flickers with the bass.
   TONEARM it is the transport: grab it and drag along the record to scrub (the sound is muted while it is lifted); let go over the record
           and the needle drops there and plays; let go off the record, near the rest, and it switches off.
   script.js owns the page; this file owns the deck and is driven from script.js's frame loop (GDeck.step). */
(() => {
  const S = window.GS, G = S && S.deck;
  const audio = document.getElementById('audio'), stageBtn = document.getElementById('stageBtn');
  const disc = document.getElementById('disc'), arm = document.getElementById('arm'), strobe = document.getElementById('strobe');
  const ptr = document.getElementById('knobPtr'), knobHit = document.getElementById('knobHit'), armHit = document.getElementById('armHit');
  const hub = document.getElementById('armHub'), tipM = document.getElementById('armTip');
  const labels = ['lblSlow', 'lbl33', 'lbl45'].map((id) => document.getElementById(id)), status = document.getElementById('status');
  if (!S || !G || !audio || !stageBtn || !disc || !arm) return;           // an older page: leave it alone, script.js falls back to its own deck

  const MOTOR = { up: 2.8, down: 1.8, follow: true, slow: 0.8, fast: 45 / (100 / 3) };   // up / down: how quickly the platter gains / loses speed (per second); slow / fast: the knob's speeds
  const KNOB = { x: 922, y: 690 };                                                 // the knob's centre in the 1000 x 780 drawing (only for turning the pointer)
  const POS = [{ name: 'slow', rate: MOTOR.slow, a: -28 }, { name: '33 rpm', rate: 1, a: 0 }, { name: '45 rpm', rate: MOTOR.fast, a: 28 }];   // the knob's three positions
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const damp = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
  const root = document.documentElement;
  try { audio.preservesPitch = audio.mozPreservesPitch = audio.webkitPreservesPitch = false; } catch (_) {}   // pitch follows speed, like vinyl

  let want = false, pos = 1, side = 1, speed = 1, omega = 0, rate = -1, drag = null, suppress = false;
  let discDeg = 0, strobeDeg = 0, armDeg = G.rest, lastArm = null, lastStrobe = null, lastOp = '', kx = POS[1].a, kv = 0, lastKnob = null;

  const setUi = () => { root.classList.toggle('is-playing', want); S.motor = want; };
  const dur = () => (audio.duration > 0 ? audio.duration : S.duration || 0);

  async function start() {
    want = true; setUi();
    if (audio.paused) {
      rate = -1;
      audio.playbackRate = clamp(MOTOR.follow ? omega / G.spin : speed, 0.0625, 4);   // starts from wherever the platter is
      try { await audio.play(); } catch (e) { want = false; setUi(); throw e; }
    }
  }
  async function toggle() {
    if (drag) return;
    if (want) { want = false; setUi(); if (!MOTOR.follow) audio.pause(); } else await start();
  }
  function turnKnob(dir) {                                                         // -1: left (slower), +1: right (faster); stops at both ends
    pos = clamp(pos + dir, 0, 2); speed = POS[pos].rate; S.pos = pos;
    labels.forEach((l, i) => { if (l) l.setAttribute('fill', i === pos ? '#d4d9e4' : '#6d7484'); });
  }
  const fail = () => { if (status) status.textContent = 'Браузер не дал запустить звук — нажми ещё раз.'; };

  // hit-testing is done by the browser against transparent shapes drawn inside the deck itself (#knobHit, #armHit), so what answers the pointer is
  // exactly what you see, whatever the stage's tilt does. Angles are measured on the screen and calibrated against two markers on the arm.
  const interactive = !!(knobHit && armHit && hub && tipM);
  const hitAt = (e) => {
    const els = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [];
    return els.includes(knobHit) ? 'knob' : els.includes(armHit) ? 'arm' : null;
  };
  const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const norm = (d) => { d %= 360; return d > 180 ? d - 360 : d <= -180 ? d + 360 : d; };

  // frame: called by script.js with the smoothed track progress
  function step(now, dt, progS) {
    omega = damp(omega, want ? G.spin * speed : 0, want ? MOTOR.up : MOTOR.down, dt);
    const ratio = omega / G.spin;

    if (!audio.paused && !drag) {                                                  // the sound follows the platter
      const r = clamp(MOTOR.follow ? ratio : (want ? speed : 0), 0.0625, 4);
      if (Math.abs(r - rate) > 0.004) { audio.playbackRate = r; rate = r; }
      if (!want && (!MOTOR.follow || ratio < 0.07)) audio.pause();
    }

    if (omega > 0.05) {
      discDeg = (discDeg + omega * dt) % 360;
      disc.style.transform = 'rotate(' + discDeg.toFixed(2) + 'deg)';
    }
    if (strobe) {
      const slip = want ? omega - G.spin : 0;                                      // 0 when it runs at 33: the ring stands still
      if (Math.abs(slip) > 0.02) strobeDeg = (strobeDeg + slip * dt) % 360;
      const tf = 'rotate(' + strobeDeg.toFixed(2) + 'deg)';
      if (tf !== lastStrobe) { lastStrobe = tf; strobe.style.transform = tf; }
      const op = (0.78 + 0.22 * (S.playing ? S.bass || 0 : 0)).toFixed(2);
      if (op !== lastOp) { lastOp = op; strobe.style.opacity = op; }
    }

    if (S.hot === 'knob') S.knobTip = POS[clamp(pos + side, 0, 2)].name;            // what a click here would turn it to (the cursor shows it)
    const tgt = drag ? drag.deg : S.playing ? G.start + (G.end - G.start) * progS : G.rest;
    armDeg = damp(armDeg, tgt, drag ? 30 : 2.6, dt);
    if (lastArm === null || Math.abs(armDeg - lastArm) > 0.0005) { lastArm = armDeg; arm.style.transform = 'rotate(' + armDeg.toFixed(3) + 'deg)'; }

    if (ptr) {                                                                      // the knob: a little spring, so it clicks over
      kv += ((POS[pos].a - kx) * 420 - 18 * kv) * dt; kx += kv * dt;
      if (lastKnob === null || Math.abs(kx - lastKnob) > 0.02) { lastKnob = kx; ptr.setAttribute('transform', 'rotate(' + kx.toFixed(2) + ' ' + KNOB.x + ' ' + KNOB.y + ')'); }
    }
  }

  // the tonearm as a transport
  function beginDrag(e) {
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, deg: armDeg, muted: audio.muted, last: 0 };
    try { stageBtn.setPointerCapture(e.pointerId); } catch (_) {}
    S.hot = 'arm';
  }
  function dragMove(e) {
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return;
    if (!drag.moved) { drag.moved = true; audio.muted = true; arm.classList.add('lifted'); stageBtn.style.cursor = 'grabbing'; }   // now it is a drag: lift the arm, mute the scratch
    const hc = centre(hub), tc = centre(tipM), shown = lastArm === null ? armDeg : lastArm;
    const tilt = norm(Math.atan2(tc.y - hc.y, tc.x - hc.x) * 180 / Math.PI - (shown + 180));   // how far the stage is turned on the screen
    const deg = norm(Math.atan2(e.clientY - hc.y, e.clientX - hc.x) * 180 / Math.PI - tilt - 180);   // the arm points at the pointer
    drag.deg = clamp(deg, G.rest, G.end);
    const t = clamp((drag.deg - G.start) / (G.end - G.start), 0, 1) * dur(), now = performance.now();
    if (now - drag.last > 60) { drag.last = now; if (S.seek) S.seek(t); }
  }
  function endDrag(cancel) {
    const d = drag;
    if (!d) return;
    drag = null;
    try { stageBtn.releasePointerCapture(d.id); } catch (_) {}
    if (!d.moved) return;
    arm.classList.remove('lifted'); stageBtn.style.cursor = S.hot === 'arm' ? 'grab' : '';
    audio.muted = d.muted;
    if (cancel) return;
    suppress = true; setTimeout(() => { suppress = false; }, 60);
    const p = (d.deg - G.start) / (G.end - G.start);
    if (p < -0.2) { if (want) { want = false; setUi(); if (!MOTOR.follow) audio.pause(); } return; }   // set down off the record: switch off
    if (S.seek) S.seek(clamp(p, 0, 1) * dur());                                    // the needle drops here
    if (!want || audio.paused) start().catch(fail);
  }

  if (interactive) {
  stageBtn.addEventListener('pointermove', (e) => {
    if (drag) { if (e.pointerId === drag.id) dragMove(e); return; }
    if (e.pointerType === 'touch') return;
    const h = hitAt(e);
    if (h === 'knob') side = e.clientX < centre(knobHit).x ? -1 : 1;
    if (h !== S.hot) { S.hot = h; stageBtn.style.cursor = h === 'arm' ? 'grab' : h === 'knob' ? 'pointer' : ''; }
  });
  stageBtn.addEventListener('pointerleave', () => { if (!drag) { S.hot = null; stageBtn.style.cursor = ''; } });
  stageBtn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    if (hitAt(e) === 'arm') beginDrag(e);
  });
  stageBtn.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) endDrag(false); });
  stageBtn.addEventListener('pointercancel', () => endDrag(true));
  stageBtn.addEventListener('lostpointercapture', () => endDrag(true));
  }

  function click(e) {
    if (suppress) { suppress = false; return; }
    if (interactive && e && e.detail && hitAt(e) === 'knob') { turnKnob(e.clientX < centre(knobHit).x ? -1 : 1); return; }   // detail 0: a keyboard click, no position
    return toggle().catch(fail);
  }

  // keep the deck in step with anything else that starts or stops the audio (media keys, the end of the track)
  audio.addEventListener('play', () => { if (!want) { want = true; setUi(); } rate = -1; });
  audio.addEventListener('pause', () => { if (want) { want = false; setUi(); } });
  audio.addEventListener('ended', () => { want = false; setUi(); });

  window.GDeck = { toggle, click, step };
})();
