/* gorecz brain: a stylised cortex (~4000 neurons) that fires with the music.
   GoreczBrain.mount(canvas, () => ({ bass, high, level, playing })) — each track page passes its own signal.
   Signals are auto-normalised (so quiet and loud tracks both reach full range) and split into "level" and "events"
   (a beat / a change above the recent average). Regions are loosely mapped; artistic, not neuroscience. */
(() => {
  const R = 6, 
    NAMES = ['лобная доля', 'теменная доля', 'височная доля', 'затылочная доля', 'мозжечок', 'ядро'],
    ROLE = ['ожидание', 'внимание', 'слух · тембр', 'внутренние образы', 'ритм · тайминг', 'эмоции · отклик'],
    DESC = [
      ['Анализ структуры, прогнозирование', 'дропа и синкоп.'],
      ['Пространственная ориентация.', 'Фокус на хвостах реверберации', 'и глитчах.'],
      ['Частотный анализ. Прямой отклик', 'на саб-бас и перкуссионные', 'транзиенты.'],
      ['Генерация визуальных паттернов', 'от холодной звуковой палитры.'],
      ['Подсознательная синхронизация', 'с грувом и микроритмикой.'],
      ['Дофаминовый релиз на разрешении', 'аккордов. Физическое погружение.']
    ]
    const RGB = [
      [135, 175, 210], // 0: лобная — льдисто-голубой (ice blue)
      [155, 160, 205], // 1: теменная — пыльный индиго (muted indigo)
      [100, 185, 180], // 2: височная — приглушенный тил (dark teal)
      [185, 195, 200], // 3: затылочная — серебристо-пепельный (silver ash)
      [110, 130, 190], // 4: мозжечок — глубокий синий (deep violet)
      [220, 60, 85]    // 5: ядро — кинематографичный багровый (crimson)
    ];
    
  const rnd = (a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(11);

  function shape() {
    const P = [], add = (x, y, z, r) => P.push({ x, y, z, r, ph: rnd() * 6.283 });
    // Кора мозга
    for (let i = 0; i < 3400; i++) {
      const u = rnd() * 2 - 1, a = rnd() * 6.283, s = Math.sqrt(1 - u * u), dx = s * Math.cos(a), dy = u, dz = s * Math.sin(a);
      const fold = (1 - Math.abs(Math.sin(dx * 8 + Math.sin(dz * 5) * 1.4 + dy * 3))) * .05 + (1 - Math.abs(Math.sin(dz * 14 - dy * 6 + Math.sin(dx * 7) * 1.2))) * .035;
      const tl = Math.exp(-(((dy + .5) / .28) ** 2)) * Math.exp(-(((dz - .1) / .5) ** 2)) * Math.abs(dx);
      let g = 1 + fold + tl * .1; if (dz > .55) g *= .95; if (dz < -.7) g *= .93;
      const d = i % 5 === 0 ? .93 : 1;
      const x = (dx * .68 * g + Math.sign(dx) * .03 * (dy > -.2 ? 1 : .3)) * d, y = (dy * (dy < 0 ? .36 : .5) * g - tl * .12) * d, z = dz * .9 * g * d;
      add(x, y, z, (y < -.08 && Math.abs(x) > .28 && Math.abs(z) < .45) ? 2 : z > .28 ? 0 : (z < -.28 && y > -.32) ? 3 : 1);
    }
    // Мозжечок
    for (let i = 0; i < 420; i++) { const u = rnd() * 2 - 1, a = rnd() * 6.283, s = Math.sqrt(1 - u * u); add(s * Math.cos(a) * .34, -.42 + u * .18 * (1 + .09 * Math.sin(u * 34)), -.68 + s * Math.sin(a) * .25, 4); }
    for (let i = 0; i < 260; i++) { const u = rnd() * 2 - 1, a = rnd() * 6.283, s = Math.sqrt(1 - u * u), k = .12 + rnd() * .22; add(s * Math.cos(a) * k * 1.2, -.05 + u * k * .7, s * Math.sin(a) * k * 1.5, 5); }
    return P;
  }

  // Алгоритм "Gift Wrapping" (Заворачивание подарка) для построения контура вокруг облака точек
  function getConvexHull(pts) {
    if (pts.length < 3) return pts;
    const hull = [];
    let l = 0;
    for (let i = 1; i < pts.length; i++) if (pts[i].x < pts[l].x) l = i;
    let p = l;
    do {
      hull.push(pts[p]);
      let q = (p + 1) % pts.length;
      for (let i = 0; i < pts.length; i++) {
        if (i === p) continue;
        // Векторное произведение для поиска самой крайней правой точки
        const cp = (pts[q].x - pts[p].x) * (pts[i].y - pts[p].y) - (pts[q].y - pts[p].y) * (pts[i].x - pts[p].x);
        if (cp < 0) q = i;
      }
      p = q;
      if (hull.length > pts.length) break; // защита от бесконечного цикла при коллизиях
    } while (p !== l);
    return hull;
  }

  function mount(cv, src) {
    const P = shape(), n = P.length, cx = cv.getContext('2d'), E = [], adj = Array.from({ length: n }, () => []), seen = new Set();
    const ptsByR = Array.from({ length: R }, () => []); // Храним индексы точек по зонам для контура

    for (let i = 0; i < n; i++) {
      ptsByR[P[i].r].push(i);
      const b = [[9, -1], [9, -1], [9, -1]];
      for (let j = 0; j < n; j++) { if (j === i) continue; const d = (P[i].x - P[j].x) ** 2 + (P[i].y - P[j].y) ** 2 + (P[i].z - P[j].z) ** 2;
        if (d < b[2][0]) { b[2] = [d, j]; if (b[2][0] < b[1][0]) { const t = b[1]; b[1] = b[2]; b[2] = t; if (b[1][0] < b[0][0]) { const t2 = b[0]; b[0] = b[1]; b[1] = t2; } } } }
      for (const [, j] of b) { const key = i < j ? i * 8192 + j : j * 8192 + i; if (j >= 0 && !seen.has(key)) { seen.add(key); const e = { a: i, b: j, r: P[i].r }; E.push(e); adj[i].push(e); adj[j].push(e); } }
    }
    const byR = Array.from({ length: R }, (_, r) => E.filter((e) => e.r === r)), C = Array.from({ length: R }, () => ({ x: 0, y: 0, z: 0, c: 0 }));
    P.forEach((p) => { const c = C[p.r]; c.x += p.x; c.y += p.y; c.z += p.z; c.c++; }); C.forEach((c) => { c.x /= c.c; c.y /= c.c; c.z /= c.c; });
    C[0].x = 0; C[1].x = 0; C[3].x = 0;
    
    const act = new Float32Array(R), dispAct = new Float32Array(R), fl = new Float32Array(n), X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), pulses = [];
    
    // Анимация HUD: плавное появление (0..1)
    const hudAct = new Float32Array(R);
    const hudX = new Float32Array(R), hudY = new Float32Array(R);
    const hudL = new Array(R).fill(true);
    
    // Осциллограф: история на 60 кадров
    const HLEN = 60;
    const hist = Array.from({length: R}, () => new Float32Array(HLEN));
    let histIdx = 0;

    const sg = { b: { pk: .05, sl: 0 }, h: { pk: .05, sl: 0 }, l: { pk: .05, sl: 0 } };
    const norm = (o, v, dt) => { o.pk = Math.max(.02, v, o.pk * (1 - dt * .05)); const q = Math.min(1, v / o.pk); o.sl += (q - o.sl) * dt * .6; return [q, Math.max(0, q - o.sl)]; };
    let ang = .6, drag = 0, last = performance.now(), vis = true, W = 0, H = 0, mx = -999, my = -999;
    
    new IntersectionObserver((e) => { vis = e[0].isIntersecting; }).observe(cv);
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); };
    new ResizeObserver(size).observe(cv); size();
    
    cv.addEventListener('pointerdown', (e) => { drag = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; if (drag) { ang += (e.clientX - drag) * .008; drag = e.clientX; } });
    cv.addEventListener('pointerup', () => { drag = 0; }); 
    cv.addEventListener('pointercancel', () => { drag = 0; });
    cv.addEventListener('pointerleave', () => { mx = my = -999; drag = 0; });
    
    const go = (e, from) => { if (pulses.length < 1000) pulses.push({ e, f: from, t: 0 }); };

    (function frame(now) {
      requestAnimationFrame(frame); if (!vis) { last = now; return; }
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      
      const s = src() || {}, on = s.playing, [nb, eb] = norm(sg.b, s.bass || 0, dt), [nh, eh] = norm(sg.h, s.high || 0, dt), [nl, el] = norm(sg.l, s.level || 0, dt), ev = Math.max(eb, eh, el);
      const rest = on ? 0 : .05 + .03 * Math.sin(now / 900);
      const tg = [ev * 1.2 + nl * .25, nh * .7 + eh * .8, nl * .7 + el * .7, nh * .6 + eh, nb * .7 + eb, nb * .5 + ev * 1.1];
      
      histIdx = (histIdx + 1) % HLEN;

      for (let r = 0; r < R; r++) { 
        const t = Math.min(1, tg[r] * 1.25) + rest; 
        act[r] += (t - act[r]) * Math.min(1, dt * (t > act[r] ? 20 : 4)); 
        hist[r][histIdx] = act[r];
      }
      
      for (let r = 0; r < R; r++) { let q = act[r] * dt * 160; while (q > 0) { if (Math.random() < q) go(byR[r][(Math.random() * byR[r].length) | 0], 0); q -= 1; } }
      if (!drag) ang += dt * .12;
      
      const ca = Math.cos(ang), sa = Math.sin(ang), ct = Math.cos(-.28), st = Math.sin(-.28), sc = Math.min(W * .34, H * .62), pr = (x, y, z) => { const x1 = x * ca + z * sa, z0 = -x * sa + z * ca, y1 = y * ct - z0 * st, z1 = y * st + z0 * ct, k = 1.7 / (1.7 - z1); return [W / 2 + x1 * sc * k, H / 2 - y1 * sc * k, z1]; };
      const gb = 1 + nb * .05;
      
      for (let i = 0; i < n; i++) {
        const p = P[i], br = gb + act[p.r] * .045 * Math.sin(now / 260 + p.ph), q = pr(p.x * br, p.y * br, p.z * br); X[i] = q[0]; Y[i] = q[1]; Z[i] = q[2];
        const dx = X[i] - mx, dy = Y[i] - my; if (dx * dx + dy * dy < 2600) { fl[i] = Math.max(fl[i], .9); if (Math.random() < .05 && adj[i].length) go(adj[i][(Math.random() * adj[i].length) | 0], i); }
      }

      // Рассчитываем позиции текстов и определяем Hover до отрисовки
      cx.font = '11px ui-monospace, Menlo, Consolas, monospace'; 
      const L = [], Rt = [];
      for (let r = 0; r < R; r++) { const q = pr(C[r].x, C[r].y, C[r].z); ([0, 2, 4].includes(r) ? L : Rt).push({ r, x: q[0], y: q[1] }); }
      
      let hov = -1;
      for (const side of [L, Rt]) {
        side.sort((a, b) => a.y - b.y); side.forEach((o, i) => { o.ly = Math.min(H - 24, Math.max(24, o.y)); if (i && o.ly < side[i - 1].ly + 36) o.ly = side[i - 1].ly + 36; });
        const left = side === L;
        for (const o of side) {
          dispAct[o.r] += (act[o.r] - dispAct[o.r]) * Math.min(1, dt * 6);
          const pc = Math.round(dispAct[o.r] * 100) + '%', nm = NAMES[o.r];
          const wText = cx.measureText(nm + '  ').width + cx.measureText(pc).width;
          const wRole = cx.measureText(ROLE[o.r]).width;
          const w = Math.max(wText, wRole);
          const tx = left ? 16 : W - 16;
          
          const hitX = left ? tx : tx - w;
          hudX[o.r] = hitX; hudY[o.r] = o.ly; hudL[o.r] = left;
          
          if (mx >= hitX - 10 && mx <= hitX + w + 10 && my >= o.ly - 15 && my <= o.ly + 20) {
            hov = o.r;
          }
        }
      }

      // Плавная анимация появления HUD и контура
      for (let r = 0; r < R; r++) {
        hudAct[r] += ((hov === r ? 1 : 0) - hudAct[r]) * dt * 10;
      }
      
      cx.clearRect(0, 0, W, H); 
      
      // 1. Отрисовка связей
      cx.globalCompositeOperation = 'lighter'; cx.lineWidth = 1;
      for (let r = 0; r < R; r++) { cx.strokeStyle = 'rgba(' + RGB[r] + ',' + (.05 + act[r] * .13).toFixed(3) + ')'; cx.beginPath(); for (const e of byR[r]) { cx.moveTo(X[e.a], Y[e.a]); cx.lineTo(X[e.b], Y[e.b]); } cx.stroke(); }
      
      // 2. Отрисовка нейронов
      for (let i = 0; i < n; i++) {
        const p = P[i], a = act[p.r], f = fl[i], sz = .9 + a * 1.8 + f * 2.4; fl[i] = f * Math.exp(-dt * 5);
        cx.fillStyle = 'rgba(' + RGB[p.r] + ',' + Math.min(1, .16 + a * .55 * (.6 + .4 * Z[i]) + f * .6).toFixed(2) + ')'; cx.fillRect(X[i] - sz / 2, Y[i] - sz / 2, sz, sz);
      }
      
      // 3. Отрисовка пульсов
      for (let i = pulses.length - 1; i >= 0; i--) {
        const q = pulses[i], e = q.e, A = q.f === e.a ? e.a : e.b, B = A === e.a ? e.b : e.a; q.t += dt * 3.4;
        if (q.t >= 1) { fl[B] = 1; pulses.splice(i, 1); if (Math.random() < act[e.r] * .8 && adj[B].length) go(adj[B][(Math.random() * adj[B].length) | 0], B); if (Math.random() < act[e.r] * .3 && adj[B].length) go(adj[B][(Math.random() * adj[B].length) | 0], B); continue; }
        const c = RGB[e.r], x = X[A] + (X[B] - X[A]) * q.t, y = Y[A] + (Y[B] - Y[A]) * q.t, k = 1 - q.t * .7;
        cx.strokeStyle = 'rgba(' + c + ',' + (k * .85).toFixed(2) + ')'; cx.beginPath(); cx.moveTo(X[A], Y[A]); cx.lineTo(x, y); cx.stroke();
        cx.fillStyle = 'rgba(' + c + ',' + k.toFixed(2) + ')'; cx.beginPath(); cx.arc(x, y, 2.2, 0, 6.283); cx.fill();
      }

      // 4. Отрисовка контуров активных зон (Convex Hull)
      cx.lineJoin = 'round';
      cx.lineCap = 'round';
      for (let r = 0; r < R; r++) {
        if (hudAct[r] > 0.005) {
          const pts = [];
          for (const i of ptsByR[r]) pts.push({ x: X[i], y: Y[i] });
          const hull = getConvexHull(pts);
          if (hull.length > 2) {
            cx.beginPath();
            cx.moveTo(hull[0].x, hull[0].y);
            for (let k = 1; k < hull.length; k++) cx.lineTo(hull[k].x, hull[k].y);
            cx.closePath();
            
            // Внешний глоу контура
            cx.lineWidth = 3 + hudAct[r] * 3;
            cx.strokeStyle = 'rgba(' + RGB[r] + ',' + (hudAct[r] * 0.25).toFixed(2) + ')';
            cx.stroke();
            
            // Тонкая линия контура
            cx.lineWidth = 1.5;
            cx.strokeStyle = 'rgba(' + RGB[r] + ',' + (hudAct[r] * 0.8).toFixed(2) + ')';
            cx.stroke();
            
            // Заливка самой зоны
            cx.fillStyle = 'rgba(' + RGB[r] + ',' + (hudAct[r] * 0.08).toFixed(2) + ')';
            cx.fill();
          }
        }
      }
      
      // 5. Отрисовка выносок (текст и линии)
      cx.globalCompositeOperation = 'source-over'; cx.textBaseline = 'middle';
      for (const side of [L, Rt]) {
        const left = side === L;
        for (const o of side) {
          const alpha = hudAct[o.r]; // 0..1 анимация
          const pc = Math.round(dispAct[o.r] * 100) + '%', nm = NAMES[o.r];
          const w1 = cx.measureText(nm + '  ').width;
          const w2 = cx.measureText(pc).width;
          const tx = left ? 16 : W - 16, ex = left ? tx + Math.max(w1 + w2, cx.measureText(ROLE[o.r]).width) + 10 : tx - Math.max(w1 + w2, cx.measureText(ROLE[o.r]).width) - 10, col = RGB[o.r];

          cx.textAlign = left ? 'left' : 'right'; 
          cx.fillStyle = 'rgba(231,233,238,' + (0.6 + 0.4 * alpha).toFixed(2) + ')'; 
          cx.fillText(nm, tx, o.ly - 7);
          
          cx.fillStyle = 'rgba(' + col + ',.95)'; 
          cx.fillText(pc, left ? tx + w1 : tx - w1, o.ly - 7);
          
          cx.fillStyle = 'rgba(231,233,238,' + (0.3 + 0.5 * alpha).toFixed(2) + ')'; 
          cx.fillText(ROLE[o.r], tx, o.ly + 8);
          
          const ang2 = Math.atan2(o.y - o.ly, o.x - ex); 
          cx.strokeStyle = 'rgba(' + col + ',' + (0.25 + act[o.r] * 0.5 + alpha * 0.4).toFixed(2) + ')'; 
          cx.beginPath(); cx.moveTo(ex, o.ly); cx.lineTo(o.x, o.y);
          cx.moveTo(o.x, o.y); cx.lineTo(o.x - 6 * Math.cos(ang2 - .45), o.y - 6 * Math.sin(ang2 - .45)); cx.moveTo(o.x, o.y); cx.lineTo(o.x - 6 * Math.cos(ang2 + .45), o.y - 6 * Math.sin(ang2 + .45)); cx.stroke();
        }
      }

      // 6. Отрисовка HUD карточек
      for (let r = 0; r < R; r++) {
        if (hudAct[r] > 0.005) {
          const alpha = hudAct[r];
          cx.globalAlpha = alpha;
          
          const col = RGB[r];
          const cw = 270, ch = 96 + DESC[r].length * 17;
          
          // Вычисляем базовую позицию и не даем уйти за экран
          let cx0 = hudL[r] ? hudX[r] + 50 : hudX[r] - cw - 20;
          let cyTarget = hudY[r] - 20;
          
          if (cx0 < 10) cx0 = 10;
          if (cx0 + cw > W - 10) cx0 = W - cw - 10;
          if (cyTarget < 10) cyTarget = 10;
          if (cyTarget + ch > H - 10) cyTarget = H - ch - 10;
          
          // Плавный выезд карточки снизу вверх
          const cy0 = cyTarget + (1 - alpha) * 15;
          
          // Фон и бордер
          cx.fillStyle = 'rgba(5, 6, 10, 0.85)';
          cx.fillRect(cx0, cy0, cw, ch);
          cx.fillStyle = 'rgba(' + col + ', 0.9)';
          cx.fillRect(cx0, cy0, 2, ch);
          
          // Заголовок
          cx.textAlign = 'left';
          cx.fillStyle = 'rgba(231,233,238,0.9)';
          cx.fillText(NAMES[r].toUpperCase(), cx0 + 16, cy0 + 20);
          
          // Фон осциллографа
          cx.fillStyle = 'rgba(231,233,238,0.04)';
          cx.fillRect(cx0 + 16, cy0 + 36, cw - 32, 36);
          
          // Базовая линия (тишина)
          cx.strokeStyle = 'rgba(231,233,238,0.1)';
          cx.beginPath(); cx.moveTo(cx0 + 16, cy0 + 68); cx.lineTo(cx0 + cw - 16, cy0 + 68); cx.stroke();
          
          // Живой график активности (EKG)
          cx.strokeStyle = 'rgba(' + col + ', 0.95)';
          cx.lineWidth = 1.5;
          cx.beginPath();
          for (let k = 0; k < HLEN; k++) {
            const val = hist[r][(histIdx + 1 + k) % HLEN];
            const gx = cx0 + 16 + (k / (HLEN - 1)) * (cw - 32);
            const gy = cy0 + 68 - Math.min(1, val * 1.3) * 32;
            if (k === 0) cx.moveTo(gx, gy); else cx.lineTo(gx, gy);
          }
          cx.stroke();
          cx.lineWidth = 1;
          
          // Описание
          cx.fillStyle = 'rgba(231,233,238,0.6)';
          DESC[r].forEach((line, i) => {
            cx.fillText(line, cx0 + 16, cy0 + 94 + i * 17);
          });
          
          cx.globalAlpha = 1;
        }
      }

    })(performance.now());
  }
  window.GoreczBrain = { mount };
})();