/* gorecz — искусственно: общий грейд «как на обложке» и спуск: по мере прокрутки вода поднимается по стеклу, дальше мы под водой. Видео и кабели сводятся в один WebGL-проход:
   горизонтальная смазка, как при протяжке плёнки через щель (сильнее на басе и ударе волны), сдвиг каналов, строки, которые срываются вбок, зерно.
   Кабели лежат под декой и стали частью картинки: мягкие, в дымке, смазываются вместе с морем. */
(() => {
  const vid = document.getElementById('bgv'); if (!vid) return;
  // status panel: appears by itself when something goes wrong, and always with ?debug in the address
  const st = window.__grade = { state: 'starting', reason: '', scale: 1, fps: 0, screens: 0, vt: 0, gpu: '' }, dbg = /[?&]debug/.test(location.search); let hud = null;
  const report = () => {
    if (!dbg && st.state === 'on') return;
    if (!hud) { hud = document.createElement('div'); hud.id = 'gradeHud'; hud.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99999;font:11px/1.5 monospace;color:#bfe3f5;background:rgba(2,8,14,.78);padding:6px 10px;border:1px solid rgba(140,210,240,.3);pointer-events:none;white-space:pre;max-width:60vw;overflow:hidden'; document.body.appendChild(hud); }
    hud.textContent = 'grade: ' + st.state + (st.reason ? ' — ' + st.reason : '') + '\nfps ' + st.fps + ' · scale ' + st.scale.toFixed(2) + ' · depth ' + st.screens.toFixed(2) + ' screens · video ' + st.vt.toFixed(1) + ' s\n' + st.gpu;
  };
  const fail = (state, why) => { st.state = state; st.reason = String(why || '').slice(0, 240); console.warn('grade:', state, '—', st.reason); report(); };
  const cv = document.createElement('canvas'); cv.id = 'grade';
  const gl = cv.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true }); if (!gl) return fail('no-webgl', 'WebGL is not available in this browser');
  const FRAG = `precision highp float;
    uniform sampler2D uV, uW; uniform vec2 uRes, uCover, uMouse; uniform float uT, uBass, uWave, uS, uWireOn; uniform vec4 uFx; float S;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y); }
    // marine snow: soft round particles; they sink slowly and, when you scroll down, stream upwards past you (nearer layers faster)
    float snow(vec2 uv,float asp,float G,float speed,float par,float seed,float r0,float soft,float dens){
      vec2 p=uv*vec2(asp,1.)*G; p.y+=uT*speed-S*par; vec2 id=floor(p), f=fract(p); float hh=h(id+seed);
      if(hh<dens) return 0.;
      vec2 c=.3+.4*vec2(h(id+seed+3.1),h(id+seed+7.7)); c.x+=.1*sin(uT*.4+hh*40.);
      float r=r0*(.5+.9*h(id+seed+11.)); return smoothstep(r,r*soft,length(f-c))*(.35+.65*h(id+seed+5.));
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/uRes; float asp=uRes.x/uRes.y, x=uv.x*asp; S=uS+uFx.y*1.8;                                  // the «под водой» slider floods the room
      // the water level climbs the glass with the scroll; the surface is irregular, never a clean sine
      float wl=mix(-.12,1.18,smoothstep(.15,1.6,S));
      wl+=.014*sin(x*3.+uT*.5)+.010*sin(x*11.+uT*1.)+.006*sin(x*23.-uT*1.5+1.7)+.004*sin(x*47.+uT*2.3)+.012*uBass*sin(x*22.+uT*5.)+.006*(vn(vec2(x*9.,uT*.6))-.5);
      float d=uv.y-wl, under=smoothstep(.006,-.006,d), zb=max(0.,-d);
      float z=under*(zb*6.+max(0.,S-1.2)*2.7);                                         // depth in "metres": below the surface plus how far we have scrolled
      vec2 base=mix(uv,(uv-.5)*.92+.5+vec2(0.,.012),under);                              // through water the world looks larger and displaced
      vec2 wob=vec2(sin(uv.y*38.+uT*1.3),cos(uv.x*30.+uT*1.1))*.0035*(1.+z*.12)*under;
      wob+=vec2(sin(uv.y*90.+uT*2.),0.)*.004*exp(-zb*40.)*under;                         // strong ripple right under the surface
      float md=length((uv-uMouse)*vec2(asp,1.));
      wob+=normalize(uv-uMouse+1e-4)*.0045*exp(-md*7.)*sin(md*42.-uT*6.)*under;           // the cursor disturbs the water
      float row=floor(uv.y*110.), tk=floor(uT*12.), e=(uBass*.9+uWave*1.6+under*.15)*(1.-.8*uFx.w)+uFx.z*1.4;
      float sx=(h(vec2(row,tk+9.))-.5)*.03*step(.975-.12*uFx.z,h(vec2(row,tk)))*(.25+e);
      float len=(.0025+.03*e*(.4+h(vec2(row,3.))))*(1.+z*.08), ca=.0012*(1.+uWave*3.+under*2.+uFx.z*6.);
      vec3 v=vec3(0.), w=vec3(0.); float wa=0.;
      int TAPS=len<.004?3:7; float tf=float(TAPS);                                   // calm picture: 3 jittered taps are enough, smear and depth need 7
      for(int i=0;i<7;i++){
        if(i>=TAPS) break;
        vec2 u2=vec2(base.x+sx-.005*under+(float(i)/(tf-1.)-.5+(h(gl_FragCoord.xy+float(i))-.5)/(tf-1.))*len,base.y)+wob, vu=(u2-.5)*uCover+.5;
        v.r+=texture2D(uV,vu+vec2(ca,0.)).r; v.g+=texture2D(uV,vu).g; v.b+=texture2D(uV,vu-vec2(ca,0.)).b;
        vec4 s=uWireOn>.5?texture2D(uW,u2):vec4(0.); w+=s.rgb; wa+=s.a;
      }
      v/=tf; w/=tf; wa/=tf;
      vec3 gh=texture2D(uV,((base+vec2(-.02,.004)+wob)-.5)*uCover+.5).rgb; v=mix(v,max(v,gh*vec3(.8,.95,1.1)),uFx.x*.55);   // эхо: a ghost copy of the picture
      vec3 col=v*(1.-wa*.9)+mix(w,vec3(.30,.40,.50)*wa,.22);
      // light dies with depth, red first, then green; the water gets murky and the light behind it dims
      vec3 att=exp(-z*vec3(.17,.065,.04));
      float turb=1.-exp(-z*.11);
      col=mix(col,col*att*vec3(.9,1.,1.05),under);
      col=mix(col,vec3(.035,.12,.18)*exp(-z*.09),turb*under*.85);
      vec2 q=uv*vec2(asp,1.)*6.; float cs=0.;
      for(int i=0;i<3;i++){ q+=vec2(sin(q.y*1.2+uT*.45+float(i)),cos(q.x*1.1-uT*.35)); cs+=exp(-abs(sin(q.x)+sin(q.y))*3.); }
      col+=vec3(.20,.45,.55)*(cs/3.)*.20*under*(1.-smoothstep(0.,6.,z));                  // caustics only live near the surface
      float dens=.88-.07*clamp(z/14.,0.,1.);
      float sn=snow(uv,asp,26.,.22,6.,0.,.14,0.,dens)*.30+snow(uv,asp,48.,.34,4.,9.,.12,.2,dens)*.24+snow(uv,asp,90.,.5,2.,21.,.11,.45,dens)*.20;
      col+=vec3(.55,.75,.85)*sn*under*(.35+.65*exp(-z*.08));
      float ray=0.; for(int i=0;i<2;i++){ float k=float(i); ray+=pow(max(0.,sin((x*(2.2+k*1.7)+uv.y*(1.1+k*.5)+uT*(.03+.015*k)+k*1.3)*6.2832)),7.); }
      col+=vec3(.20,.42,.52)*ray*.07*under*exp(-z*.14)*(.35+.65*uv.y);                    // faint shafts of light, gone in the depths
      // the surface: seen from below a bright reflective band, a ragged foam line, above it a dark wet meniscus (no neon line)
      col+=vec3(.40,.66,.74)*exp(-zb/.02)*under*(.20+.14*sin(x*60.+uT*2.1)+.18*uBass);
      vec2 fp=vec2(x*48.,d*150.)+vec2(uT*.4,0.); float fn=.6*vn(fp)+.4*vn(mat2(.8,-.6,.6,.8)*fp*2.1+3.);       // foam streaks stretched along the surface, not blocks
      col+=vec3(.85,.93,.97)*smoothstep(.56,.80,fn)*exp(-abs(d+.006)/.011)*.5;
      col*=1.-.30*smoothstep(.010,0.,abs(d-.006))*(1.-under);
      col=col*vec3(.94,1.,1.08)*.97+.012;
      col*=.88+.12*smoothstep(1.25,.25,length((uv-.5)*vec2(asp,1.)));
      col*=1.-step(.94,h(vec2(floor(uv.y*14.),floor(uT*6.))))*uFx.z*.85;                    // обрыв сигнала: black bands
      col+=vec3(.06,.11,.15)*uFx.w*smoothstep(.1,.9,1.-length(uv-.5));                          // восстановление: a cold glow
      col+=(h(gl_FragCoord.xy+fract(uT)*91.)-.5)*(.035+.03*uBass);
      gl_FragColor=vec4(col,1.);
    }`;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { st.reason = gl.getShaderInfoLog(x); console.error('grade shader:', st.reason); return null; } return x; };
  const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'), fs = sh(gl.FRAGMENT_SHADER, window.__gradeTestBadShader ? FRAG + '\n#error test' : FRAG); if (!vs || !fs) return fail('shader-error', st.reason);
  const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return fail('link-error', gl.getProgramInfoLog(p)); gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(p, n), tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v)); return t; };
  gl.activeTexture(gl.TEXTURE0); const tv = tex(); gl.activeTexture(gl.TEXTURE1); const tw = tex(); gl.uniform1i(U('uV'), 0); gl.uniform1i(U('uW'), 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  const place = document.getElementById('mist') || document.getElementById('veil'); document.body.insertBefore(cv, place);
  const resize = () => { cv.width = Math.max(320, Math.round(Math.min(2560, innerWidth * (devicePixelRatio || 1)) * st.scale)); cv.height = Math.round(cv.width * innerHeight / innerWidth); gl.viewport(0, 0, cv.width, cv.height); };
  addEventListener('resize', resize); resize(); document.body.classList.add('grade-on');
  const gauge = document.createElement('div'); gauge.id = 'depthGauge'; document.body.appendChild(gauge);
  const ss = (v) => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); }; st.state = 'on'; { const x = gl.getExtension('WEBGL_debug_renderer_info'); st.gpu = 'GPU: ' + (x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'n/a'); } report();
  let newFrame = true, lastT = -1, wireUp = false, fAcc = 0, fN = 0, alive = true, n = 0, sS = 0, tPrev = 0, mu = [0.5, 0.5];
  addEventListener('pointermove', (e) => { mu = [e.clientX / innerWidth, 1 - e.clientY / innerHeight]; }, { passive: true });
  const fallback = (why) => { alive = false; cv.remove(); const g = document.getElementById('depthGauge'); if (g) g.remove(); document.body.classList.remove('grade-on'); fail('fallback', why); };
  if (vid.requestVideoFrameCallback) { const arm = () => vid.requestVideoFrameCallback(() => { newFrame = true; arm(); }); arm(); }
  function frame(now) {
    if (!alive) return; requestAnimationFrame(frame); if (vid.paused) vid.play().catch(() => {}); const S = window.GS || {}, va = (vid.videoWidth || 2560) / (vid.videoHeight || 1440), wa = cv.width / cv.height;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const fresh = vid.requestVideoFrameCallback ? newFrame : vid.currentTime !== lastT;                   // the video has 24 fps, the page 60: upload only new frames
    if (fresh && vid.readyState >= 2 && !window.__gradeTestBlack) { newFrame = false; lastT = vid.currentTime; try { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tv); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid); } catch (e) { return fallback('cannot read the video (' + e.message + '). Open the page through a local server, not file://'); } }
    const wc = window.__wireCanvas; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tw);
    const wireOn = (window.scrollY || 0) < innerHeight * 1.4;                              // the cables only exist near the top of the page
    if (wireOn && wc && wc.width) { gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wc); wireUp = true; }
    else if (!wireOn && wireUp) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); wireUp = false; }
    gl.uniform1f(U('uWireOn'), wireOn ? 1 : 0);
    const dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now;
    fAcc += dt; fN++; st.screens = sS; st.vt = vid.currentTime;
    if (fN === 45) { const avg = fAcc / fN; st.fps = Math.round(1 / avg); fAcc = 0; fN = 0;               // too slow? render the picture at lower resolution
      if (avg > 0.028 && st.scale > 0.5) { st.scale = Math.max(0.5, st.scale * 0.8); resize(); } if (dbg) report(); }                           // scroll depth in screens, smoothed
    const target = window.__gradeScreens != null ? window.__gradeScreens : (window.scrollY || 0) / innerHeight; sS += (target - sS) * (1 - Math.exp(-dt * 5));
    { const se = sS + (window.GFX ? GFX.fx[1] : 0) * 1.8, wlc = -0.12 + 1.3 * ss((se - 0.15) / 1.45), m = wlc > 0.5 ? (wlc - 0.5) * 6 + Math.max(0, se - 1.2) * 2.7 : 0; if (window.GFX) GFX.depth = m;       // the same depth the shader uses at the middle of the screen
      gauge.textContent = 'depth ' + m.toFixed(1).padStart(4, '0') + ' m'; gauge.classList.toggle('show', m > 0.05); }
    { const X = window.GFX && GFX.fx ? GFX.fx : [0, 0, 0, 0]; gl.uniform4f(U('uFx'), X[0], X[1], X[2], X[3]); }
    gl.uniform1f(U('uS'), sS); gl.uniform2f(U('uMouse'), mu[0], mu[1]);
    gl.uniform2f(U('uRes'), cv.width, cv.height); gl.uniform2f(U('uCover'), Math.min(1, wa / va), Math.min(1, va / wa));
    gl.uniform1f(U('uT'), now / 1000); gl.uniform1f(U('uBass'), S.bass || 0); gl.uniform1f(U('uWave'), window.WAVE || 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (++n === 60 && vid.currentTime > 0.2) {                       // sanity check: a playing video must not render as a black frame
      const px = new Uint8Array(4); let sum = 0; for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) { gl.readPixels(Math.floor(cv.width * i / 6), Math.floor(cv.height * j / 6), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sum += px[0] + px[1] + px[2]; }
      if (sum / 75 < 8) fallback('the picture came out black (video texture is empty)');
    }
  }
  requestAnimationFrame(frame);
})();
