/* gorecz — искусственно (archive 002)
   3D-thick smoked frosted glass plinth: dual-layer bevel (visible slab thickness), recessed internals parallax, fine condensation & soft drop shadow */
(() => {
  if (!window.THREE) return;

  const container = document.getElementById('tt');
  const fogCanvas = document.getElementById('bgv');
  if (!container || !fogCanvas) return;

  const cv = document.createElement('canvas');
  cv.className = 'tt-ice-canvas';
  // Расширяем канвас на 6% наружу, чтобы мягкая тень и толщина торца не обрезались
  cv.style.cssText = 'position:absolute;inset:-6%;width:112%;height:112%;pointer-events:none;z-index:0;';
  container.prepend(cv);

  const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
  camera.position.z = 1;

  const bgTexture = new THREE.VideoTexture(fogCanvas);
  bgTexture.minFilter = THREE.LinearFilter;
  bgTexture.magFilter = THREE.LinearFilter;
  // three r128 re-uploads the video on every render; the clip has 24 fps, so upload only when a new frame arrives
  bgTexture.update = () => {};
  if (fogCanvas.requestVideoFrameCallback) { const up = () => { bgTexture.needsUpdate = true; fogCanvas.requestVideoFrameCallback(up); }; up(); } else bgTexture.update = THREE.VideoTexture.prototype.update;
  let onScreen = true; new IntersectionObserver((e) => { onScreen = e[0].isIntersecting; }, { rootMargin: '120px' }).observe(container);

  const VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uBg;
    uniform vec4 uScreenRect;
    uniform vec2 uWinRes;
    uniform vec2 uVid;
    uniform float uTime;
    uniform float uBass;
    uniform float uDiscAngle;
    uniform float uWave;

    float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    vec2 hash2(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
    float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y); }
    float fbm(vec2 p){ float v=0.,a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }

    const vec2 B=vec2(.478,.372);
    float sdSlab(vec2 p){ vec2 d=abs(p)-B+.026; return min(max(d.x,d.y),0.)+length(max(d,0.))-.026; }
    float sdBox(vec2 p, vec2 b, float r){ vec2 d=abs(p)-b+r; return min(max(d.x,d.y),0.)+length(max(d,0.))-r; }

    vec3 dropLayer(vec2 p, float scale, float density, float seed){
      vec2 gv=p*scale;
      vec2 id=floor(gv), f=fract(gv)-.5;
      vec2 rnd=hash2(id+seed);
      float exists=step(1.-density, hash(id+seed*1.7));
      vec2 center=(rnd-.5)*.58;
      float rad=mix(.08, .22, rnd.x);
      vec2 d=f-center;
      float dist=length(d);
      float m=smoothstep(rad, rad*.65, dist)*exists;
      vec2 n=(d/max(rad,.001))*m;
      return vec3(n, m);
    }

    void main(){
      // Учитываем расширение канваса 1.12x, чтобы координаты деки точно совпали с SVG
      vec2 p=(vUv-.5)*1.12*vec2(1.,.78);

      // Вектор толщины плиты (нижняя грань смещена вниз-вправо)
      vec2 thickOff=vec2(.014, -.018);
      float dTop=sdSlab(p);
      float dBot=sdSlab(p - thickOff);
      float dShadow=sdSlab(p - thickOff*1.7);

      float topMask=smoothstep(.002,-.002,dTop);
      float botMask=smoothstep(.002,-.002,dBot);
      float sideMask=clamp(botMask - topMask, 0., 1.);

      // Мягкая объёмная тень под всей плитой
      float shadowAlpha=smoothstep(.055, -.01, dShadow) * .52 * (1.-max(topMask, sideMask));
      if(topMask<.001 && sideMask<.001){
        if(shadowAlpha<.002) discard;
        gl_FragColor=vec4(vec3(.005,.010,.018), shadowAlpha);
        return;
      }

      // Экранный UV для видео-фона (с учётом расширенного канваса)
      vec2 suv=vec2((uScreenRect.x+vUv.x*uScreenRect.z)/uWinRes.x, 1.-((uScreenRect.y+(1.-vUv.y)*uScreenRect.w)/uWinRes.y));
      suv=(suv-.5)*uVid+.5;

      // ТОРЕЦ ПЛИТЫ (видимая толщина тёмного дымчатого стекла снизу и справа)
      if(sideMask > 0.001 && topMask < 0.5){
        vec3 bgSide=texture2D(uBg, clamp(suv + vec2(.015,-.015), .001, .999)).rgb;
        vec3 sideCol=mix(vec3(.012,.018,.026), bgSide*vec3(.35,.44,.52), .22);
        // Лёгкий внутренний рефлекс по нижней кромке торца
        float botEdge=smoothstep(.006, 0., abs(dBot+.002));
        sideCol+=vec3(.28,.38,.48)*botEdge*.35;
        gl_FragColor=vec4(sideCol, sideMask*.94);
        return;
      }

      // ВЕРХНЯЯ ГРАНЬ ПЛИТЫ
      float t=clamp(-dTop/.030,0.,1.), bev=1.-t;
      vec2 e=vec2(.0015,0.);
      vec2 gd=normalize(vec2(sdSlab(p+e.xy)-sdSlab(p-e.xy), sdSlab(p+e.yx)-sdSlab(p-e.yx))+1e-5);

      vec2 dp=p-vec2(-.108,0.); float r=length(dp), an=atan(dp.y,dp.x);
      float well=smoothstep(.334,.327,r);

      // 1. УТОПЛЕННАЯ НАЧИНКА ПОД СТЕКЛОМ (смещена вглубь на pi = p - thickOff*0.55)
      vec2 pi=p - thickOff*.55;
      float ri=length(pi - vec2(-.108,0.));
      float chassisFrame=smoothstep(.016, .0, abs(sdBox(pi, vec2(.438,.332), .018)));
      float motorHousing=smoothstep(.368, .338, ri);
      float armGimbal=smoothstep(.078, .052, length(pi-vec2(.372, .240)));
      float powerBlock=smoothstep(.018, -.006, sdBox(pi-vec2(.365, -.285), vec2(.078,.046), .012));
      float leftPort1=smoothstep(.014, .003, sdBox(pi-vec2(-.415, .078), vec2(.055,.006), .003));
      float leftPort2=smoothstep(.014, .003, sdBox(pi-vec2(-.415, -.062), vec2(.055,.006), .003));
      float leftPort3=smoothstep(.014, .003, sdBox(pi-vec2(-.415, -.109), vec2(.055,.006), .003));
      float bottomBus=smoothstep(.016, .003, sdBox(pi-vec2(.08, -.285), vec2(.24,.008), .004));
      float rightRib=smoothstep(.016, .003, sdBox(pi-vec2(.372, -.02), vec2(.009,.19), .004));

      float internals=clamp(
        chassisFrame*.42 + motorHousing*.58 + armGimbal*.62 + powerBlock*.65 +
        (leftPort1+leftPort2+leftPort3)*.52 + bottomBus*.45 + rightRib*.40,
        0., 1.
      )*(1.-well);

      // 2. МЕЛКИЙ КОНДЕНСАТ НА ВЕРХНЕЙ ПОВЕРХНОСТИ
      float clusterMask=smoothstep(.36, .72, fbm(p*7.5+4.2)) * (.45 + .55*smoothstep(.22, .02, -dTop));
      vec3 d1=dropLayer(p, 34., .32, 11.3);
      vec3 d2=dropLayer(p+vec2(.37,.19), 58., .42, 27.9);
      float dropMask=clamp(max(d1.z, d2.z*0.85), 0., 1.) * clusterMask * (1.-well) * (1.-bev*.6);
      vec2 dropNorm=(d1.xy + d2.xy*.75) * clusterMask * (1.-well);

      vec2 n2=gd*bev*bev*1.15;
      n2+=-normalize(dp+1e-5)*smoothstep(.008,0.,abs(r-.331))*.9;
      n2+=vec2(fbm(p*48.+3.)-.5,fbm(p*48.)-.5)*.08*(1.-well);
      n2+=dropNorm*.55;

      // Матовый блюр видео-фона
      vec2 off=n2*.024;
      float blurR=.013*(1.+.8*bev)*(1.-dropMask*.55);
      vec3 bg=texture2D(uBg,clamp(suv+off,.001,.999)).rgb * .20;
      for(int i=0;i<8;i++){
        float a=float(i)*.7854 + .3;
        vec2 o=vec2(cos(a),sin(a))*blurR*vec2(.65,1.);
        bg+=texture2D(uBg,clamp(suv+off+o,.001,.999)).rgb * .10;
      }

      float grain=(hash(floor(p*540.))-.5)*.022;
      vec3 smoked=bg*vec3(.56,.64,.72) + vec3(.020,.030,.042) + grain;
      smoked=mix(smoked, vec3(.009,.014,.022), internals*.56);
      smoked+=vec3(.12,.22,.30)*bottomBus*uBass*.18*(1.-well);

      // Внутренняя тень от стенки чаши (усилена снизу-справа для ощущения глубины выреза)
      float wellShadow=smoothstep(.05, 0., r-.330)*(1.-well);
      float wellDir=smoothstep(-.4, .8, dot(normalize(dp+1e-5), normalize(vec2(.6,-.7))));
      smoked*=1. - wellShadow*(.22 + .28*wellDir);

      // Широкий диагональный градиент отражения пасмурного неба по плоской поверхности
      float skySheen=smoothstep(.45, -.45, dot(p, normalize(vec2(.65, -.75))));
      smoked+=vec3(.06,.08,.10)*skySheen*(1.-well);

      // Свет на фаске + чёткий верхний левый блик
      vec3 N=normalize(vec3(n2, 1.));
      vec3 L=normalize(vec3(-.55,.65,.75));
      float ndl=max(dot(N,L),0.);
      float rimDir=smoothstep(-.15, .85, dot(-gd, normalize(vec2(-.55,.65))));

      vec3 col=smoked;
      col+=vec3(.60,.74,.84)*pow(ndl, 26.)*(.12 + .28*bev)*(1.-well);
      col+=vec3(.72,.84,.92)*pow(bev, 2.8)*rimDir*(.32 + uWave*.25 + uBass*.10);
      // Тонкий внутренний кант по грани выреза чаши (подчёркивает толщину стекла вокруг диска)
      float wellRim=smoothstep(.005, 0., abs(r-.331)) * smoothstep(-.2, .8, dot(normalize(dp+1e-5), normalize(vec2(.55,-.65))));
      col+=vec3(.55,.68,.78)*wellRim*.35;

      // Тень и блик от капель конденсата
      float dropLit=max(dot(normalize(vec3(dropNorm*1.8, 1.)), L), 0.);
      col*=1. - dropMask*(1.-dropLit)*.30;
      col+=vec3(.82,.90,.96)*pow(dropLit, 22.)*dropMask*(.58 + uWave*.42);

      // Тонкая тёмная грань на стыке верхней поверхности и торца
      col=mix(col, vec3(.012,.020,.030), smoothstep(.004, 0., abs(dTop+.002))*.60);

      // Чёткий чёрный винил внутри утопленной чаши
      float lobe=pow(max(0.,cos(2.*(an+.8))),18.)*.58+pow(max(0.,cos(2.*(an-1.9))),30.)*.34;
      float gr=.35+.65*noise(vec2(r*420.,0.));
      float gapR=smoothstep(.007,0.,abs(r-.196))+smoothstep(.007,0.,abs(r-.246));
      vec3 vinyl=vec3(.008,.012,.018)+vec3(.26,.33,.42)*lobe*gr*(1.-.55*gapR)*(1.+uBass*.35+uWave*.55);
      float ca=cos(uDiscAngle), sa=sin(uDiscAngle);
      vinyl+=smoothstep(.86,.95,noise(mat2(ca,-sa,sa,ca)*dp*190.))*.030;
      vinyl+=vec3(.48,.58,.68)*smoothstep(.003,0.,abs(r-.301))*.28;
      vec3 metal=vec3(.026,.034,.044)+vec3(.11,.14,.18)*lobe*.75;
      vec3 deck=mix(metal,vinyl,smoothstep(.304,.300,r));
      // Более глубокая внутренняя тень внутри чаши слева-сверху (от нависающего края стекла)
      float innerShade=smoothstep(.032, 0., .331-r)*(.42 + .35*smoothstep(-.3, .8, dot(normalize(dp+1e-5), normalize(vec2(-.55,.65)))));
      deck*=1. - innerShade;
      col=mix(col,deck,well);

      col+=vec3(.05,.08,.11)*uWave*(1.-well);

      float outAlpha=topMask*mix(.88, .99, well);
      gl_FragColor=vec4(col, outAlpha);
    }
  `;

  const uniforms = {
    uBg: { value: bgTexture },
    uScreenRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uWinRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uVid: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uBass: { value: 0 },
    uDiscAngle: { value: 0 },
    uWave: { value: 0 }
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  scene.add(quad);

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    uniforms.uScreenRect.value.set(r.left, r.top, r.width, r.height);
    uniforms.uWinRes.value.set(window.innerWidth, window.innerHeight);
  }
  new ResizeObserver(resize).observe(container);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', () => {
    const r = cv.getBoundingClientRect();
    uniforms.uScreenRect.value.set(r.left, r.top, r.width, r.height);
  }, { passive: true });
  resize();

  let last = performance.now(), angle = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const S = window.GS || {};
    if (S.playing) angle += dt * 1.15;
    if (!onScreen || document.hidden) return;                 // nothing to draw while the deck is scrolled away

    { const wa = innerWidth / innerHeight, va = (fogCanvas.videoWidth || 1280) / (fogCanvas.videoHeight || 720); uniforms.uVid.value.set(Math.min(1, wa / va), Math.min(1, va / wa)); }
    const r = cv.getBoundingClientRect();
    uniforms.uScreenRect.value.set(r.left, r.top, r.width, r.height);
    uniforms.uTime.value = now / 1000;
    uniforms.uBass.value = S.bass || 0;
    uniforms.uDiscAngle.value = angle;
    uniforms.uWave.value = window.WAVE || 0;

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
})();