/* gorecz — искусственно (archive 002)
   Frosted glass-ice plinth with a vinyl record: refracts the #bgv video, bevelled edges, hairline fractures that glow on bass */
(() => {
  if (!window.THREE) return;

  const container = document.getElementById('tt');
  const fogCanvas = document.getElementById('bgv');
  if (!container || !fogCanvas) return;

  const cv = document.createElement('canvas');
  cv.className = 'tt-ice-canvas';
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  container.prepend(cv);

  const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
  camera.position.z = 1;

  // Захватываем живой WebGL-канвас фона (#fog), чтобы лед РЕАЛЬНО преломлял воду и провода позади себя!
  const bgTexture = new THREE.VideoTexture(fogCanvas);
  bgTexture.minFilter = THREE.LinearFilter;
  bgTexture.magFilter = THREE.LinearFilter;

  const VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Фрагментный шейдер монолитной ледяной плиты с внутренними трещинами Вороного, инеем и оптической рефракцией
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
    float voro(vec2 x){ vec2 n=floor(x),f=fract(x); float d1=8.,d2=8.;
      for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 r=g+hash2(n+g)-f; float d=dot(r,r);
        if(d<d1){ d2=d1; d1=d; } else if(d<d2){ d2=d; } }
      return sqrt(d2)-sqrt(d1); }
    const vec2 B=vec2(.478,.372);
    float sdSlab(vec2 p){ vec2 d=abs(p)-B+.045; return min(max(d.x,d.y),0.)+length(max(d,0.))-.045; }

    void main(){
      vec2 p=(vUv-.5)*vec2(1.,.78);
      float d=sdSlab(p);
      float alpha=smoothstep(.0025,-.0025,d); if(alpha<.001) discard;
      float t=clamp(-d/.055,0.,1.), bev=1.-t;                 // bev: 1 on the cut edge, 0 on the flat top
      vec2 e=vec2(.0015,0.);
      vec2 gd=normalize(vec2(sdSlab(p+e.xy)-sdSlab(p-e.xy), sdSlab(p+e.yx)-sdSlab(p-e.yx))+1e-5);

      vec2 dp=p-vec2(-.108,0.); float r=length(dp), an=atan(dp.y,dp.x);
      float well=smoothstep(.334,.327,r);
      vec2 n2=gd*bev*bev*1.3;                                  // the polished bevel tilts the surface
      n2+=-normalize(dp+1e-5)*smoothstep(.007,0.,abs(r-.331))*.9;   // wall of the platter well
      n2+=vec2(fbm(p*38.+3.)-.5,fbm(p*38.)-.5)*.10*(1.-well);   // frosted micro relief

      // refraction of the footage behind: slightly blurred (frost), chromatic split, stronger toward the edge
      vec2 suv=vec2((uScreenRect.x+vUv.x*uScreenRect.z)/uWinRes.x, 1.-((uScreenRect.y+(1.-vUv.y)*uScreenRect.w)/uWinRes.y));
      suv=(suv-.5)*uVid+.5;
      vec2 off=n2*.034, bl=vec2(.0035)*(1.+3.*bev); vec3 bg=vec3(0.);
      for(int i=0;i<4;i++){ float a=float(i)*1.5708+.6; vec2 o=vec2(cos(a),sin(a))*bl;
        bg.r+=texture2D(uBg,clamp(suv+off*1.07+o,.001,.999)).r;
        bg.g+=texture2D(uBg,clamp(suv+off+o,.001,.999)).g;
        bg.b+=texture2D(uBg,clamp(suv+off*.93+o,.001,.999)).b; }
      bg*=.25;

      // thick glacial ice: absorbs red first, edges are thicker than the middle
      float thick=.18+.40*bev+.12*fbm(p*3.);
      vec3 col=mix(bg*vec3(.80,.95,1.08),vec3(.05,.16,.27),thick);
      col+=vec3(.10,.16,.22)*smoothstep(.2,-.4,dot(p,normalize(vec2(1.,-.8))))*(1.-bev)*.5;
      // a few hairline fractures deep inside, not a shattered pane
      float bub=smoothstep(.55,.9,hash(floor(p*46.)))*smoothstep(.16,0.,length(fract(p*46.)-.5))*smoothstep(.62,.80,fbm(p*3.+5.))*(1.-well);
      col+=vec3(.70,.88,1.)*bub*.22;
      col=mix(col,vec3(.75,.90,1.),fbm(p*26.)*smoothstep(.55,0.,t)*.18);   // frost haze near the cut edges

      // dark graphite platter and black vinyl: fixed anisotropic highlights (they stay still while the record spins)
      float lobe=pow(max(0.,cos(2.*(an+.8))),18.)*.6+pow(max(0.,cos(2.*(an-1.9))),30.)*.35;
      float gr=.35+.65*noise(vec2(r*420.,0.));
      float gapR=smoothstep(.007,0.,abs(r-.196))+smoothstep(.007,0.,abs(r-.246));
      vec3 vinyl=vec3(.010,.020,.034)+vec3(.30,.40,.52)*lobe*gr*(1.-.55*gapR)*(1.+uBass*.4+uWave*.7);
      float ca=cos(uDiscAngle), sa=sin(uDiscAngle);
      vinyl+=smoothstep(.86,.95,noise(mat2(ca,-sa,sa,ca)*dp*190.))*.035;     // dust, so the turning is visible
      vinyl+=vec3(.70,.85,1.)*smoothstep(.003,0.,abs(r-.301))*.35;
      vec3 metal=vec3(.035,.050,.065)+vec3(.13,.17,.21)*lobe*.8;
      vec3 deck=mix(metal,vinyl,smoothstep(.304,.300,r));
      deck*=1.-.45*smoothstep(.02,0.,.331-r);                                // shadow under the well wall
      col=mix(col,deck,well);

      // glass edge: specular on the bevel, Fresnel rim, bright cut line
      vec3 N=normalize(vec3(n2,1.)), L=normalize(vec3(-.55,.65,.7));
      col+=vec3(.90,.97,1.)*pow(max(dot(N,L),0.),38.)*(.5+.5*bev)*(1.-well*.7);
      col+=vec3(.60,.85,1.)*pow(bev,3.)*(.20+uBass*.3+uWave*.6);
      col+=vec3(.85,.96,1.)*smoothstep(.005,0.,abs(d+.003))*.30;
      col+=vec3(.05,.09,.13)*uWave*(1.-well);
      gl_FragColor=vec4(col,alpha*.97);
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
    const r = container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    uniforms.uScreenRect.value.set(r.left, r.top, r.width, r.height);
    uniforms.uWinRes.value.set(window.innerWidth, window.innerHeight);
  }
  new ResizeObserver(resize).observe(container);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', () => {
    const r = container.getBoundingClientRect();
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

    // Обновляем текстуру с нижнего канваса #fog каждый кадр для честного преломления
    { const wa = innerWidth / innerHeight, va = (fogCanvas.videoWidth || 1280) / (fogCanvas.videoHeight || 720); uniforms.uVid.value.set(Math.min(1, wa / va), Math.min(1, va / wa)); }
    const r = container.getBoundingClientRect();
    uniforms.uScreenRect.value.set(r.left, r.top, r.width, r.height);
    uniforms.uTime.value = now / 1000;
    uniforms.uBass.value = S.bass || 0;
    uniforms.uDiscAngle.value = angle;

    uniforms.uWave.value = window.WAVE || 0;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
})();