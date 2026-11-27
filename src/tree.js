import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { animate } from 'animejs';
import { createGiftLayout } from './gift-layout.js';

const TAU = Math.PI * 2;
let seed = 76391;
const rand = (lo = 0, hi = 1) => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return lo + (seed >>> 0) / 4294967296 * (hi - lo); };
// A soft canopy envelope; individual branches are clouds, never surfaces.
function radiusAt(y) { return Math.max(.035, 2.6 * Math.pow(THREE.MathUtils.clamp(1 - (y - .35) / 8.45, 0, 1), 1.02)); }
function strip(curve, width, segments = 44) {
  const positions = [], uv = [], indices = [];
  for (let i = 0; i <= segments; i++) { const t = i / segments, p = curve.getPoint(t), tangent = curve.getTangent(t); const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(width / 2); for (const sign of [-1, 1]) { positions.push(p.x + side.x * sign, p.y + side.y * sign, p.z + side.z * sign); uv.push((sign + 1) / 2, t); } if (i < segments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#fff'); g.addColorStop(.08, '#fffffff0'); g.addColorStop(.24, '#ffffff50'); g.addColorStop(1, '#ffffff00'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class ChristmasTree {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas; this.callbacks = callbacks; this.mobile = innerWidth < 700; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.state = { intro: 0, burst: 0, focus: 0 }; this.lastTime = 0; this.albumGeneration = 0; this.photoGeneration = 0;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.35 : 1.6));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .9;
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene(); this.scene.name = 'Christmas scene'; this.scene.background = new THREE.Color('#0d0a1c'); this.scene.fog = new THREE.FogExp2('#0d0a1c', .022); this.photoScene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, 1, .1, 180); this.camera.position.set(0, 5.1, 15.7);
      this.controls = new OrbitControls(this.camera, canvas); this.controls.target.set(0, 4.05, 0); this.controls.enablePan = false; this.controls.enableDamping = true; this.controls.dampingFactor = .055; this.controls.rotateSpeed = .38; this.controls.zoomSpeed = .65; this.controls.minPolarAngle = .7; this.controls.maxPolarAngle = Math.PI * .48; this.controls.autoRotateSpeed = -.5;
      this.controls.addEventListener('start', () => { this.userRotating = true; this.controls.autoRotate = false; clearTimeout(this.idleTimer); });
      this.controls.addEventListener('end', () => { clearTimeout(this.idleTimer); this.idleTimer = setTimeout(() => { this.userRotating = false; }, 7000); });
      const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(this.renderer); this.environment = pmrem.fromScene(room, .04); this.scene.environment = this.environment.texture; this.scene.environmentIntensity = .26; room.dispose(); pmrem.dispose();
      this.scene.add(new THREE.HemisphereLight('#d1e2ff', '#b4c4df', .65));
      const key = new THREE.DirectionalLight('#fff2dd', 1.65); key.position.set(-6, 11, 7); key.target.position.set(0, 3.2, 0); key.castShadow = true; key.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 11, bottom: -6, near: .1, far: 35 }); key.shadow.bias = -.0004; key.shadow.normalBias = .025; key.shadow.radius = 3; this.scene.add(key, key.target);
      const rim = new THREE.DirectionalLight('#8cadf3', .75); rim.position.set(5, 7, -5); this.scene.add(rim);
      const warm = new THREE.PointLight('#ffb955', 6, 12, 2); warm.position.set(0, 3.5, 3); this.scene.add(warm);
      this.root = new THREE.Group(); this.scene.add(this.root); this.treeParticles = new THREE.Group(); this.treeParticles.name = 'ChristmasTreeParticles'; this.root.add(this.treeParticles); this.photoOrnaments = new THREE.Group(); this.root.add(this.photoOrnaments);
      this.buildSkyStars(); this.buildSnowfield(); this.buildParticles(); this.buildGroundGlow(); this.buildGarlands(); this.buildStar(); this.buildHalo(); this.buildFireworks(); this.buildLightTrails(); this.buildGifts(); this.buildWeather(); this.buildSpaceDecorations();
      this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera)); this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .42, .45, 2.8); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
      this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement); this.resize();
      // Keynote-style entrance: a slow arc around the tree while the camera pushes in.
      this.homePos = this.camera.position.clone();
      if (!this.reduced) {
        const sph = new THREE.Spherical().setFromVector3(this.homePos.clone().sub(this.controls.target));
        this.introCam = { r0: sph.radius * 1.55, r1: sph.radius, phi0: Math.max(.4, sph.phi - .1), phi1: sph.phi, th0: sph.theta - .52, th1: sph.theta };
        this.savedMaxDistance = this.controls.maxDistance;
        this.controls.maxDistance = Math.max(this.controls.maxDistance, this.introCam.r0 * 1.02);
        this.camera.position.setFromSpherical(new THREE.Spherical(this.introCam.r0, this.introCam.phi0, this.introCam.th0)).add(this.controls.target);
        this.controls.enabled = false;
      }
      this.bindInput(); this.visibilityHandler = () => { this.lastTime = 0; }; document.addEventListener('visibilitychange', this.visibilityHandler);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; callbacks.onError?.(); });
      this.renderer.setAnimationLoop(t => this.tick(t));
      // Wait for the loading veil to lift before igniting the first light.
      this.introTimeout = setTimeout(() => { this.intro = animate(this.state, { intro: 1, duration: this.reduced ? 1 : 5600, ease: 'linear' }); }, this.reduced ? 0 : 750);
      setTimeout(() => callbacks.onReady?.(), 350);
    } catch (e) { console.error('Snow tree:', e); callbacks.onError?.(e); }
  }

  buildSkyStars() {
    const count = this.mobile ? 900 : 1800, pos = [], seeds = [], sizes = [];
    for (let i = 0; i < count; i++) {
      const u = rand(-1, 1), a = rand(0, TAU), r = 70 + rand(0, 25), s = Math.sqrt(1 - u * u);
      pos.push(Math.cos(a) * s * r, Math.abs(u) * r * .85 + 2, Math.sin(a) * s * r); seeds.push(rand(0, TAU)); sizes.push(rand(.06, .22));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1)); geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      vertexShader: `attribute float aSeed,aSize;uniform float uTime,uHeight,uPixel;varying float vTw;void main(){vTw=.55+.45*sin(uTime*(.6+fract(aSeed)*1.2)+aSeed*7.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*uPixel*uHeight/-mv.z,1.,5.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uIntro;varying float vTw;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;vec3 c=mix(vec3(.75,.8,1.),vec3(1.,.85,.9),fract(gl_FragCoord.x*.01))*.9;gl_FragColor=vec4(c*(.8+vTw*.8),exp(-d*d*12.)*(.28+vTw*.3)*(.12+.88*uIntro));}`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sky = new THREE.Points(geo, this.skyMaterial); sky.name = 'Night sky stars'; sky.frustumCulled = false; this.scene.add(sky);
  }

  buildGroundGlow() {
    const count = this.mobile ? 900 : 1600, pos = [], seeds = [], sizes = [];
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), r = Math.sqrt(rand()) * 6.2;
      pos.push(Math.cos(a) * r, .04 + rand(0, .18), Math.sin(a) * r); seeds.push(rand(0, TAU)); sizes.push(rand(.25, .8));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1)); geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    this.glowMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      vertexShader: `attribute float aSeed,aSize;uniform float uTime,uHeight,uPixel;varying float vA;void main(){float r=length(position.xz);vA=smoothstep(6.2,1.2,r)*(.5+.5*sin(uTime*.7+aSeed));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*uPixel*uHeight*1.2/-mv.z,2.,90.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uIntro;varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(.45,.22,.75)*1.4,exp(-d*d*7.)*vA*.05*uIntro);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Points(geo, this.glowMaterial); glow.name = 'Ground glow'; glow.frustumCulled = false; this.scene.add(glow);
  }

  buildSnowfield() {
    const noise = document.createElement('canvas'); noise.width = noise.height = 256; const c = noise.getContext('2d'), pixels = c.createImageData(256, 256);
    for (let i = 0; i < pixels.data.length; i += 4) { const v = rand(110, 235); pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v; pixels.data[i + 3] = 255; } c.putImageData(pixels, 0, 0);
    const bump = new THREE.CanvasTexture(noise); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(80, 80);
    const geo = new THREE.PlaneGeometry(180, 180, 110, 110); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), dist = Math.hypot(x, z); const hills = Math.sin(x * .15 + z * .11) * .28 + Math.cos(z * .21 - x * .1) * .24; pos.setY(i, -.05 + hills * THREE.MathUtils.smoothstep(dist, 5, 14)); } geo.computeVertexNormals();
    const snow = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#4e4768', roughness: .95, bumpMap: bump, bumpScale: .035, metalness: 0 })); snow.receiveShadow = true; this.scene.add(snow);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(14, 11), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#1c1233', transparent: true, opacity: .34, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .003; this.scene.add(shadow);
    const p = []; for (let i = 0; i < 2500; i++) { const a = rand(0, TAU), r = rand(.8, 11); p.push(Math.cos(a) * r, .008, Math.sin(a) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: .018, color: '#d3e5ff', transparent: true, opacity: .65, map: glowTexture(), depthWrite: false })));
  }

  buildParticles() {
    const count = this.mobile ? 420000 : 760000;
    const pos = new Float32Array(count * 3), sizes = new Float32Array(count), kinds = new Float32Array(count), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const kind = rand(); let x, y, z;
      if (i % 9 === 0) {
        y = rand(.22, 8.65); const angle = rand(0, TAU), r = radiusAt(y) * Math.pow(rand(), .7);
        x = Math.cos(angle) * r; z = Math.sin(angle) * r;
      } else {
        // Dense cone but with a rippling, irregular silhouette: the radius swells
        // and narrows with angle and height, and particles haze around the surface.
        y = .3 + Math.pow(rand(), .9) * 8.45;
        const angle = rand(0, TAU);
        const ripple = 1 + .13 * Math.sin(angle * 3 + y * 1.4) + .09 * Math.sin(angle * 7 - y * 2.2) + .07 * Math.sin(y * 4.6 + 1.3);
        const shell = Math.max(.05, radiusAt(y) * ripple);
        const gauss = (rand() + rand() + rand() + rand() - 2) / 2;
        const r = Math.max(.02, shell * (1 + gauss * .3));
        x = Math.cos(angle) * r + rand(-.05, .05); z = Math.sin(angle) * r + rand(-.05, .05);
        y += rand(-.1, .1);
        if (kind >= .70 && kind < .86) y += .065;
      }
      pos.set([x, y, z], i * 3);
      sizes[i] = kind >= .86 ? rand(.012, .030) : rand(.007, .016);
      kinds[i] = kind; seeds[i] = rand(0, TAU);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); geo.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uBurst: { value: 0 }, uFocus: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      // The canopy is present from the first frame: a dim, dense column of dust.
      // The entrance only brightens it with a light wave climbing bottom-up —
      // positions never move, so the tree never pops or shuffles.
      vertexShader: `attribute float aSize,aKind,aSeed; uniform float uTime,uIntro,uBurst,uPixel,uHeight; varying float vKind,vTwinkle,vFlow,vVis,vIgn;
        void main(){vec3 center=vec3(0.,4.2,0.); vec3 outDir=normalize(position-center+vec3(.01));
        float dly=fract(aSeed*7.31)*.26+(1.-clamp((position.y-.3)/8.4,0.,1.))*.30;
        float x=clamp((uIntro-.03-dly)/.36,0.,1.); float e=x*x*(3.-2.*x); float wave=sin(x*3.14159);
        vVis=.6+.4*e; vIgn=e;
        vec3 p=position;
        p+=outDir*uBurst*(.7+aSeed*.29); p+=vec3(sin(uTime*.7+aSeed),cos(uTime*.8+aSeed),sin(uTime*.5+aSeed*2.))*.04;
        p.x+=sin(p.y*.7+uTime*.55)*.05;p.z+=cos(p.y*.6+uTime*.4)*.04;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vKind=aKind;vFlow=pow(.5+.5*sin(p.y*1.55-uTime*1.6+aSeed*.25),6.);vTwinkle=.72+.28*sin(uTime*(1.3+aSeed*.5)+aSeed*9.);gl_PointSize=clamp(aSize*uPixel*uHeight*1.6/-mv.z*(1.+uBurst*.8+vFlow*.3+wave*.85)*(.9+.1*e),1.,18.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uIntro,uFocus;varying float vKind,vTwinkle,vFlow,vVis,vIgn;
        void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;
        float wave=sin(vIgn*3.14159);float core=exp(-d*d*42.),halo=exp(-d*d*12.);
        float alpha=(core*.88+halo*.12)*(vKind<.70?.44:.27)*vVis*(1.+wave*.5);vec3 c;
        float t=vKind/.70;
        if(vKind<.70)c=mix(vec3(.17,.03,.25),vec3(.40,.075,.27),t)*(.9+t*.4);else if(vKind<.86)c=vec3(.42,.30,.66)*.36;else if(vKind<.985)c=vec3(1.,.42,.80)*(1.5+vTwinkle);else c=vec3(1.,.86,.94)*2.;
        if(vKind>.99){float cross=pow(max(0.,1.-abs(p.x)*24.),5.)+pow(max(0.,1.-abs(p.y)*24.),5.);alpha+=cross*.22;}
        gl_FragColor=vec4(c*vTwinkle*(1.+vFlow*.5)*(1.-uFocus*.3),alpha*(.9+.1*uIntro));}`,
      // Alpha blending keeps the colored light points visible over the white snow.
      transparent: true, blending: THREE.NormalBlending, depthWrite: false,
    });
    this.particles = new THREE.Points(geo, this.particleMaterial); this.particles.name = 'Canopy light particles'; this.particles.frustumCulled = false; this.treeParticles.add(this.particles); this.particleCount = count;
  }

  buildGarlands() {
    // Widely spaced spiral rings of bright beads — reads as stacked layers.
    const count = this.mobile ? 9000 : 15000, positions = [], along = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count, y = .6 + t * 8.0, a = t * TAU * 5.5, r = radiusAt(y) * 1.06 + .035;
      positions.push(Math.cos(a) * r + rand(-.014, .014), y + rand(-.014, .014), Math.sin(a) * r + rand(-.014, .014)); along.push(t);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    this.garlandMaterial = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uHeight: { value: innerHeight }, uPixel: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float aAlong;uniform float uTime,uHeight,uPixel;varying float vLight,vAlong;void main(){vLight=pow(max(0.,sin(aAlong*74.-uTime*2.2)),12.);vAlong=aAlong;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp((.022+vLight*.03)*uPixel*uHeight/-p.z,.8,12.);gl_Position=projectionMatrix*p;}`,
      fragmentShader: `uniform float uIntro;varying float vLight,vAlong;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;vec3 c=mix(vec3(1.,.6,.88),vec3(1.,.9,.75),vLight)*(2.4+vLight*2.);float on=smoothstep(vAlong*.82,vAlong*.82+.16,uIntro);gl_FragColor=vec4(c,exp(-d*d*22.)*(.75+vLight*.25)*on);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const garland = new THREE.Points(geo, this.garlandMaterial); garland.name = 'Garland light particles'; this.treeParticles.add(garland);
  }

  buildStar() {
    this.starGroup = new THREE.Group(); this.starGroup.name = 'Particle star'; this.starGroup.position.y = 8.98;
    const vertices = Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .20 : .45; return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r); });
    const count = this.mobile ? 760 : 1400, positions = [], seeds = [], sizes = [];
    for (let i = 0; i < count; i++) {
      const edge = Math.floor(rand(0, 10)), a = vertices[edge], b = vertices[(edge + 1) % 10], along = rand(), radius = i % 4 === 0 ? 1 : Math.sqrt(rand());
      positions.push((a.x * (1 - along) + b.x * along) * radius + rand(-.003, .003), (a.y * (1 - along) + b.y * along) * radius + rand(-.003, .003), rand(-.035, .035)); seeds.push(rand(0, TAU)); sizes.push(rand(.010, .026));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1)); geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      vertexShader: `attribute float aSeed,aSize;uniform float uTime,uHeight,uPixel;varying float vTwinkle,vFlash;void main(){vec3 p=position;p.xy+=vec2(sin(uTime+aSeed),cos(uTime*.8+aSeed))*.003;vTwinkle=.65+.35*sin(uTime*1.6+aSeed*3.);vFlash=pow(max(0.,sin(uTime*.85)),20.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(aSize*uPixel*uHeight*1.4/-mv.z,1.,8.)*(1.+vFlash*.7);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uIntro;varying float vTwinkle,vFlash;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(1.,.78,.92)*(3.5+vTwinkle*1.8+vFlash*4.),exp(-d*d*25.)*smoothstep(.8,1.,uIntro));}`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.starGroup.add(new THREE.Points(geo, this.starMaterial)); this.treeParticles.add(this.starGroup);
  }

  buildHalo() {
    const count = this.mobile ? 2400 : 4400, pos = [], seeds = [], sizes = [];
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), rr = 3.1 + (rand() + rand() + rand() - 1.5) * .5, y = 4.3 + (rand() + rand() - 1) * 2.0;
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); seeds.push(rand(0, TAU)); sizes.push(rand(.02, .06));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1)); geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    this.haloMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      vertexShader: `attribute float aSeed,aSize;uniform float uTime,uHeight,uPixel;varying float vTwinkle,vMix;
        void main(){float a=uTime*.14+aSeed*.02;mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));vec3 p=position;p.xz=rot*p.xz;p.y+=sin(uTime*.5+aSeed)*.14;
        vTwinkle=.5+.5*sin(uTime*(.9+fract(aSeed)*.8)+aSeed*5.);vMix=fract(aSeed*.617);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(aSize*uPixel*uHeight*1.3/-mv.z,1.,10.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uIntro;varying float vTwinkle,vMix;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;
        vec3 c=mix(vec3(.72,.42,1.),vec3(1.,.45,.8),vMix)*(2.2+vTwinkle*1.6);
        gl_FragColor=vec4(c,exp(-d*d*10.)*(.05+vTwinkle*.08)*uIntro);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Points(geo, this.haloMaterial); halo.name = 'Tree halo particles'; halo.frustumCulled = false; this.treeParticles.add(halo);
  }

  buildFireworks() {
    const shells = this.mobile ? 4 : 7, per = this.mobile ? 170 : 250, total = shells * per;
    const pos = new Float32Array(total * 3), shell = new Float32Array(total), dir = new Float32Array(total * 3), speed = new Float32Array(total), seeds = new Float32Array(total), sizes = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      const s = Math.floor(i / per); shell[i] = s;
      const a = rand(0, TAU), b = Math.acos(rand(-1, 1));
      dir.set([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)], i * 3);
      speed[i] = rand(2.6, 5.2); seeds[i] = rand(0, TAU); sizes[i] = rand(.03, .075);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aShell', new THREE.BufferAttribute(shell, 1)); geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3)); geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1)); geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.fireworkMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGo: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      vertexShader: `attribute float aShell,aSpeed,aSeed,aSize;attribute vec3 aDir;uniform float uTime,uHeight,uPixel;varying float vFade,vHue,vTwinkle;
        void main(){float h1=fract(aShell*.618034+.13),h2=fract(aShell*.754877+.41),h3=fract(aShell*.911+.37);
        vec3 center=vec3((h1-.5)*36.,10.5+h2*8.,-9.-h3*13.);
        float cycle=3.6+h1*2.2;float t=mod(uTime+h2*cycle*7.,cycle);float ph=t/cycle;
        float ex=smoothstep(0.,.1,ph);float R=aSpeed*sqrt(ex)*(1.-ph*.3);
        vec3 p=center+aDir*R;p.y-=9.*ph*ph;
        vFade=pow(1.-ph,1.6)*step(.004,ph);vHue=h3;vTwinkle=.6+.4*sin(uTime*7.+aSeed*9.);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(aSize*uPixel*uHeight*2.1/-mv.z,1.,16.)*(.35+.65*vFade);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uGo;varying float vFade,vHue,vTwinkle;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;
        vec3 c=vec3(1.,.86,.5);
        c=mix(c,vec3(1.,.55,.85),step(.17,vHue));
        c=mix(c,vec3(.72,.55,1.),step(.34,vHue));
        c=mix(c,vec3(.55,.9,1.),step(.5,vHue));
        c=mix(c,vec3(.6,1.,.72),step(.66,vHue));
        c=mix(c,vec3(1.,.5,.4),step(.83,vHue));
        float a=exp(-d*d*9.)*vFade*(.65+vTwinkle*.35)*uGo;if(a<.004)discard;
        gl_FragColor=vec4(c*(3.2+vTwinkle*2.),a);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const fireworks = new THREE.Points(geo, this.fireworkMaterial); fireworks.name = 'Distant fireworks'; fireworks.frustumCulled = false; this.scene.add(fireworks);
  }

  buildLightTrails() {
    const positions = [], orbits = [], tails = [];
    for (let i = 0; i < (this.mobile ? 7 : 12); i++) for (let j = 0; j < 160; j++) { positions.push(0, 0, 0); orbits.push(i); tails.push(j / 159); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('aOrbit', new THREE.Float32BufferAttribute(orbits, 1)); geo.setAttribute('aTail', new THREE.Float32BufferAttribute(tails, 1));
    this.trailMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uBurst: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      vertexShader: `attribute float aOrbit,aTail;uniform float uTime,uHeight,uPixel,uBurst;varying float vGlow,vHue;
        void main(){float phase=uTime*(.20+aOrbit*.007)+aOrbit*2.39996-aTail*.62;float y=.7+fract(aOrbit*.618)*7.9+sin(phase*.65+aOrbit)*.23;float r=3.15*pow(max(.03,1.-y/9.3),.9)+.75+sin(aOrbit)*.16+uBurst*.6;
        vec3 p=vec3(cos(phase)*r,y,sin(phase)*r);vec4 mv=modelViewMatrix*vec4(p,1.);vGlow=pow(1.-aTail,1.8);vHue=fract(aOrbit*.39);gl_PointSize=clamp((.018+pow(vGlow,5.)*.075)*uPixel*uHeight/-mv.z,1.,16.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uIntro;varying float vGlow,vHue;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;vec3 c=mix(vec3(1.,.5,.85),vec3(.62,.45,1.),step(.6,vHue)*.6);gl_FragColor=vec4(c*(3.+vGlow*3.),exp(-d*d*12.)*(.08+vGlow*.9)*uIntro);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const trails = new THREE.Points(geo, this.trailMaterial); trails.name = 'Orbiting light trails'; trails.frustumCulled = false; this.treeParticles.add(trails);
  }

  buildSpaceDecorations() {
    const pos = [], centers = [], scales = [], phases = [], kinds = [], sizes = [];
    const count = this.mobile ? 28 : 44;
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), r = this.mobile ? rand(3.25, 4.35) : rand(6.2, 8.6);
      const center = [Math.cos(a) * r, 1.5 + rand(0, 9.3), Math.sin(a) * r];
      const scale = this.mobile ? rand(.17, .30) : rand(.20, .42) * (r / 8.6) * 1.15, phase = rand(0, TAU), type = i % 3;
      const dot = (x, y, kind = type) => { pos.push(x, y, rand(-.008, .008)); centers.push(...center); scales.push(scale); phases.push(phase); kinds.push(kind); sizes.push(rand(.014, .028)); };
      const line = (x1, y1, x2, y2, n = 20, kind = type) => { for (let j = 0; j <= n; j++) { const t = j / n; dot(x1 * (1 - t) + x2 * t, y1 * (1 - t) + y2 * t, kind); } };
      if (type === 0) {
        for (let arm = 0; arm < 6; arm++) {
          const a = arm / 6 * TAU; line(0, 0, Math.cos(a), Math.sin(a), 25);
          for (const r of [.42, .70]) for (const sign of [-1, 1]) { const b = a + sign * Math.PI / 3, x = Math.cos(a) * r, y = Math.sin(a) * r; line(x, y, x - Math.cos(b) * .27, y - Math.sin(b) * .27, 9); }
        }
      } else if (type === 1) {
        const vertices = Array.from({ length: 10 }, (_, k) => { const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? .43 : 1; return [Math.cos(a) * r, Math.sin(a) * r]; });
        for (let k = 0; k < 10; k++) line(...vertices[k], ...vertices[(k + 1) % 10], 22);
        for (let k = 0; k < 30; k++) { const a = rand(0, TAU), r = rand(0, .4); dot(Math.cos(a) * r, Math.sin(a) * r); }
      } else {
        for (let k = 0; k < 180; k++) { const a = k / 180 * TAU; dot(Math.cos(a) * .72, Math.sin(a) * .72); }
        line(-.17, .70, .17, .70, 10, 1); line(-.17, .70, -.13, .91, 10, 1); line(.17, .70, .13, .91, 10, 1); line(-.13, .91, .13, .91, 10, 1);
        for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; dot(Math.cos(a) * .1, .99 + Math.sin(a) * .1, 1); }
        for (let k = 0; k < 30; k++) { const a = rand(0, TAU), r = rand(0, .62); dot(Math.cos(a) * r, Math.sin(a) * r); }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(centers, 3)); geo.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1)); geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1)); geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1)); geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    this.decorMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      vertexShader: `attribute vec3 aCenter;attribute float aScale,aPhase,aKind,aSize;uniform float uTime,uHeight,uPixel;varying float vLight,vKind;
        void main(){vec3 center=aCenter;center.y+=sin(uTime*.32+aPhase)*.18;center.x+=cos(uTime*.2+aPhase)*.10;float a=sin(uTime*.13+aPhase)*.17+aPhase*.12;mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));vec2 local=rot*position.xy*aScale;
        vec4 mv=modelViewMatrix*vec4(center,1.);mv.xy+=local;mv.z+=position.z;vLight=.72+.28*sin(uTime*.9+aPhase+position.x*.5);vKind=aKind;gl_PointSize=clamp(aSize*uPixel*uHeight/-mv.z,1.,5.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uIntro;varying float vLight,vKind;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;vec3 c=vKind<.5?vec3(.13,.42,.78)*2.:vKind<1.5?vec3(1.,.61,.17)*3.5:vec3(.85,.025,.10)*2.5;gl_FragColor=vec4(c*vLight,exp(-d*d*12.)*.88*uIntro);}`,
      transparent: true, blending: THREE.NormalBlending, depthWrite: false,
    });
    const decorations = new THREE.Points(geo, this.decorMaterial); decorations.name = 'Space particle decorations'; decorations.frustumCulled = false; this.scene.add(decorations);
  }

  buildGifts() {
    const palette = ['#941d36', '#143e35', '#e5d9c3', '#273854', '#b56655', '#799f91'];
    const paper = palette.map((base, variant) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512; const ctx = canvas.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = variant === 2 ? '#8c735866' : '#eddbab85'; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.3;
      for (let y = 32; y < 512; y += 64) for (let x = 32; x < 512; x += 64) {
        const xx = x + (Math.floor(y / 64) % 2) * 20;
        if (variant % 3 === 0) { ctx.save(); ctx.translate(xx, y); ctx.rotate(.2); ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 3 : 7; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
        else if (variant % 3 === 1) { ctx.beginPath(); ctx.arc(xx, y, 2.5, 0, TAU); ctx.fill(); }
        else { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(xx - Math.cos(a) * 8, y - Math.sin(a) * 8); ctx.lineTo(xx + Math.cos(a) * 8, y + Math.sin(a) * 8); } ctx.stroke(); }
      }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      return new THREE.MeshStandardMaterial({ map: texture, roughness: .52, metalness: .08 });
    });
    const ribbons = ['#d9b86d', '#ece5d4', '#aa193a'].map((color, i) => new THREE.MeshStandardMaterial({ color, metalness: i === 1 ? .15 : .58, roughness: .3, side: THREE.DoubleSide }));
    this.giftMaterials = [...paper, ...ribbons];
    for (const m of this.giftMaterials) { m.transparent = true; m.opacity = 0; }
    const gifts = new THREE.Group(); gifts.name = 'Gifts around the tree'; this.scene.add(gifts); this.giftGroup = gifts; const layout = createGiftLayout({ mobile: this.mobile }); gifts.userData.layout = layout; this.giftCount = layout.length; this.sceneWidth = this.mobile ? 9.6 : 10.2;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const place = ({ x, z, w, h, d, rotation, paper: paperIndex, ribbon: ribbonIndex, round }) => {
      const g = new THREE.Group(); g.position.set(x, h / 2 - .025, z); g.rotation.y = rotation; gifts.add(g);
      const mat = paper[paperIndex], ribbon = ribbons[ribbonIndex];
      const box = new THREE.Mesh(round ? new THREE.CylinderGeometry(w * .5, w * .5, h, 40) : new RoundedBoxGeometry(w, h, d, 2, .035), mat); g.add(box);
      const lid = new THREE.Mesh(round ? new THREE.CylinderGeometry(w * .525, w * .525, .12, 40) : new RoundedBoxGeometry(w + .05, .12, d + .05, 2, .022), mat); lid.position.y = h / 2 + .025; g.add(lid);
      const band1 = new THREE.Mesh(new THREE.BoxGeometry(w * .14, h + .18, round ? w + .017 : d + .018), ribbon); g.add(band1);
      if (!round) g.add(new THREE.Mesh(new THREE.BoxGeometry(w + .021, h + .181, d * .14), ribbon));
      const top = h / 2 + .115;
      for (const sign of [-1, 1]) {
        const loop = new THREE.CubicBezierCurve3(V(0, top, .02), V(sign * w * .7, top + w * .45, -.02), V(sign * w * .72, top + w * .19, -.14), V(0, top + .005, -.06)); g.add(new THREE.Mesh(strip(loop, w * .13), ribbon));
        const tail = new THREE.CubicBezierCurve3(V(0, top + .01, .025), V(sign * w * .21, top + w * .14, d * .16), V(sign * w * .3, top - .03, d * .53), V(sign * w * .32, top - h * .32, d * .56)); g.add(new THREE.Mesh(strip(tail, w * .13), ribbon));
      }
      const knot = new THREE.Mesh(new RoundedBoxGeometry(w * .2, w * .12, w * .16, 2, .035), ribbon); knot.position.set(0, top + w * .045, -.015); knot.rotation.z = .15; g.add(knot);
      return g;
    };
    layout.forEach(place);
    // Merge the stationary paper and ribbons by material, keeping dozens of gifts inexpensive.
    gifts.updateMatrixWorld(true); const buckets = new Map(), originalGeos = new Set();
    gifts.traverse(o => { if (!o.isMesh) return; let geo = o.geometry.clone(); if (geo.index) { const nonIndexed = geo.toNonIndexed(); geo.dispose(); geo = nonIndexed; } geo.applyMatrix4(o.matrixWorld); originalGeos.add(o.geometry); const key = o.material.uuid; if (!buckets.has(key)) buckets.set(key, { material: o.material, geometries: [] }); buckets.get(key).geometries.push(geo); });
    gifts.clear(); for (const { material, geometries } of buckets.values()) { const merged = mergeGeometries(geometries); const mesh = new THREE.Mesh(merged, material); mesh.castShadow = false; mesh.receiveShadow = true; gifts.add(mesh); geometries.forEach(g => g.dispose()); } originalGeos.forEach(g => g.dispose());
  }

  buildWeather() {
    const count = this.mobile ? 2400 : 5600, positions = new Float32Array(count * 3), sizes = new Float32Array(count), speeds = new Float32Array(count), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) { positions.set([rand(-20, 20), rand(0, 18), rand(-14, 9)], i * 3); sizes[i] = i % 27 === 0 ? rand(.09, .16) : rand(.018, .06); speeds[i] = rand(.16, .54); seeds[i] = rand(0, TAU); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); g.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.snowMaterial = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } }, vertexShader: `attribute float aSize,aSpeed,aSeed;uniform float uTime,uPixel,uHeight;varying float vFade;void main(){vec3 p=position;p.y=mod(p.y-uTime*aSpeed+36.,18.)-.2;p.x+=sin(uTime*.2+aSeed)*.7+uTime*.025;vec4 mv=modelViewMatrix*vec4(p,1.);vFade=smoothstep(0.,.25,p.y)*(1.-smoothstep(10.,55.,-mv.z))*.8;gl_PointSize=clamp(aSize*uPixel*uHeight/-mv.z,1.,15.);gl_Position=projectionMatrix*mv;}`, fragmentShader: `varying float vFade;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(.85,.92,1.),exp(-d*d*15.)*vFade);}`, transparent: true, depthWrite: false });
    const snow = new THREE.Points(g, this.snowMaterial); snow.frustumCulled = false; this.scene.add(snow);
    const p = [], phases = [];
    for (let i = 0; i < (this.mobile ? 900 : 2200); i++) { const a = rand(0, TAU), r = rand(2.9, 5.8); p.push(Math.cos(a) * r, rand(.3, 10), Math.sin(a) * r); phases.push(rand(0, TAU)); }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); ag.setAttribute('aSeed', new THREE.Float32BufferAttribute(phases, 1));
    this.airMaterial = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uBurst: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } }, vertexShader: `attribute float aSeed;uniform float uTime,uBurst,uHeight,uPixel;varying float vLight;void main(){vec3 p=position;float a=uTime*.035;mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));p.xz=r*p.xz;p.y+=sin(uTime*.4+aSeed)*.22;p.xz*=1.+uBurst*.35;vec4 mv=modelViewMatrix*vec4(p,1.);vLight=pow(.5+.5*sin(aSeed*3.+uTime),4.);gl_PointSize=clamp((.018+vLight*.025)*uPixel*uHeight/-mv.z,1.,18.);gl_Position=projectionMatrix*mv;}`, fragmentShader: `varying float vLight;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;gl_FragColor=vec4(vec3(1.,.68,.25)*(1.8+vLight*2.),exp(-d*d*30.)*(.12+vLight*.45));}`, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); this.scene.add(new THREE.Points(ag, this.airMaterial));
    const stars = []; for (let i = 0; i < 180; i++) stars.push(rand(-35, 35), rand(8, 26), rand(-45, -20)); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3)); this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#d5e4ff', size: .07, map: glowTexture(), transparent: true, opacity: .65, depthWrite: false })));
  }

  async loadTexture(url) { const texture = await new THREE.TextureLoader().loadAsync(url); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy()); return texture; }

  async setPhotos(photos, getURL) {
    const generation = ++this.albumGeneration; this.closePhoto(true); this.photoGeneration++;
    this.photoOrnaments.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } }); this.photoOrnaments.clear();
    const visible = photos.slice(0, this.mobile ? 16 : 28);
    for (let i = 0; i < visible.length; i++) {
      try {
        const texture = await this.loadTexture(getURL(visible[i], true));
        if (generation !== this.albumGeneration) { texture.dispose(); return; }
        const h = .85 + (i % 7) / 6 * 5.95, a = i * 2.3999 + .28, r = radiusAt(h) * 1.08 + .09;
        const group = new THREE.Group(); group.position.set(Math.cos(a) * r, h, Math.sin(a) * r); group.rotation.set(0, Math.PI / 2 - a, rand(-.1, .1));
        const frame = new THREE.Mesh(new RoundedBoxGeometry(.43, .57, .028, 1, .012), new THREE.MeshStandardMaterial({ color: '#f6eee2', roughness: .62 })); group.add(frame);
        const image = new THREE.Mesh(new THREE.PlaneGeometry(.37, .46), new THREE.MeshBasicMaterial({ map: texture })); image.position.set(0, .026, .018); group.add(image);
        this.photoOrnaments.add(group);
      } catch { /* A single unreadable image must not prevent the rest of the album. */ }
    }
  }

  async showPhoto(photo, url) {
    const generation = ++this.photoGeneration;
    const texture = await this.loadTexture(url);
    if (generation !== this.photoGeneration) { texture.dispose(); return; }
    this.closePhoto(true, false);
    const ratio = texture.image.width / texture.image.height;
    let w = 3.5, h = w / ratio; if (h > 4.35) { h = 4.35; w = h * ratio; }
    const group = new THREE.Group(), material = new THREE.MeshBasicMaterial({ color: '#fffaf1' });
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w + .25, h + .51, .055, 2, .045), material); group.add(frame);
    const image = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture })); image.position.set(0, .1, .035); group.add(image);
    const label = document.createElement('canvas'); label.width = 1024; label.height = 128; const ctx = label.getContext('2d'); ctx.fillStyle = '#fffaf1'; ctx.fillRect(0, 0, 1024, 128); ctx.fillStyle = '#8f8879'; ctx.font = '30px "Songti SC", serif'; ctx.textAlign = 'center'; ctx.fillText('小雨宝宝  ·  我爱你', 512, 81); const labelTexture = new THREE.CanvasTexture(label); labelTexture.colorSpace = THREE.SRGBColorSpace;
    const caption = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, 2.8), .3), new THREE.MeshBasicMaterial({ map: labelTexture })); caption.position.set(0, -h / 2 - .1, .036); group.add(caption);
    this.photoScene.add(group); this.activePhoto = group; this.controls.enabled = false;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const distance = Math.max(6.8, (w + .6) / (2 * Math.tan(THREE.MathUtils.degToRad(21)) * this.camera.aspect));
    const target = this.camera.position.clone().addScaledVector(direction, distance);
    const origin = new THREE.Vector3(rand(-1, 1), rand(2.8, 5.5), 1.6).applyMatrix4(this.root.matrixWorld);
    group.position.copy(origin); group.quaternion.copy(this.camera.quaternion); group.scale.setScalar(.04); group.rotateZ(-.22);
    this.photoTweens = [animate(group.position, { x: target.x, y: target.y, z: target.z, duration: this.reduced ? 1 : 1350, ease: 'outExpo' }), animate(group.scale, { x: 1, y: 1, z: 1, duration: this.reduced ? 1 : 1400, ease: 'outBack(1.15)' }), animate(group.rotation, { z: group.rotation.z + .24, duration: this.reduced ? 1 : 1500, ease: 'outExpo' }), animate(this.state, { focus: 1, duration: 900, ease: 'outCubic' })];
    this.photoOrigin = origin; this.burst(); this.canvas.dataset.photo = photo.id;
    clearTimeout(this.photoTimer); this.photoTimer = setTimeout(() => this.closePhoto(), 12000);
  }

  disposePhoto(group) { if (!group) return; this.photoScene.remove(group); group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } }); }
  closePhoto(immediate = false, cancelLoad = true) {
    if (cancelLoad) this.photoGeneration++;
    clearTimeout(this.photoTimer); this.photoTweens?.forEach(t => t.pause());
    const group = this.activePhoto; this.activePhoto = null; if (this.controls) this.controls.enabled = true; delete this.canvas.dataset.photo;
    if (!group) return;
    if (immediate) { this.disposePhoto(group); this.state.focus = 0; return; }
    animate(this.state, { focus: 0, duration: 1000, ease: 'outCubic' });
    animate(group.scale, { x: .01, y: .01, z: .01, duration: this.reduced ? 1 : 700, ease: 'inCubic', onComplete: () => this.disposePhoto(group) });
    animate(group.position, { x: this.photoOrigin.x, y: this.photoOrigin.y, z: this.photoOrigin.z, duration: this.reduced ? 1 : 750, ease: 'inOutCubic' });
  }
  burst() { this.burstTween?.pause(); this.state.burst = 1; this.burstTween = animate(this.state, { burst: 0, duration: this.reduced ? 1 : 2000, ease: 'outExpo' }); }
  setHandRotation(value) { this.handTarget = THREE.MathUtils.clamp(value, -1, 1) * .7; }
  setImporting(value) { this.pausedForImport = value; this.lastTime = 0; }

  bindInput() {
    let startX = 0, startY = 0, down = false, moved = false, lastTap = 0, longPress;
    this.canvas.addEventListener('pointerdown', e => { startX = e.clientX; startY = e.clientY; down = true; moved = false; clearTimeout(longPress); if (e.pointerType === 'touch') longPress = setTimeout(() => { if (!moved && down) { this.callbacks.onSettings?.(); moved = true; } }, 750); });
    this.canvas.addEventListener('pointermove', e => { if (down && Math.hypot(e.clientX - startX, e.clientY - startY) > 6) { moved = true; clearTimeout(longPress); } });
    this.canvas.addEventListener('pointerup', () => { clearTimeout(longPress); down = false; if (moved) return; if (this.activePhoto) { this.closePhoto(); return; } const now = performance.now(); if (now - lastTap < 340) { this.callbacks.onNext?.(); lastTap = 0; } else lastTap = now; });
    this.canvas.addEventListener('pointercancel', () => { clearTimeout(longPress); down = false; });
    this.canvas.addEventListener('contextmenu', e => { e.preventDefault(); this.callbacks.onSettings?.(); });
  }

  resize() {
    if (!this.renderer) return;
    const width = this.canvas.parentElement.clientWidth, height = this.canvas.parentElement.clientHeight, aspect = width / height;
    if (Math.abs((this.lastAspect || 0) - aspect) > .05) { const distance = Math.max(16.65, (this.sceneWidth || 7.8) / (2 * Math.tan(THREE.MathUtils.degToRad(21)) * aspect)); const direction = this.camera.position.clone().sub(this.controls.target).normalize(); this.camera.position.copy(this.controls.target).addScaledVector(direction, distance); this.controls.minDistance = distance * .7; this.controls.maxDistance = distance * 1.45; this.lastAspect = aspect; }
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); this.composer?.setSize(width, height);
    for (const m of [this.particleMaterial, this.garlandMaterial, this.starMaterial, this.snowMaterial, this.airMaterial, this.trailMaterial, this.decorMaterial, this.skyMaterial, this.glowMaterial]) if (m?.uniforms.uHeight) m.uniforms.uHeight.value = height;
    this.closePhoto(true);
    if (this.state?.intro >= 1) this.homePos = this.camera.position.clone();
  }

  tick(ms) {
    if (document.hidden || this.pausedForImport || this.lost || !this.composer) return;
    const t = this.reduced ? 0 : ms * .001, dt = this.lastTime ? Math.min((ms - this.lastTime) / 1000, .05) : .016; this.lastTime = ms;
    const intro = this.state.intro;
    if (!this.reduced && intro < 1 && this.introCam) {
      const k = Math.min(1, intro / .92), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, c = this.introCam;
      this._sph = this._sph || new THREE.Spherical();
      this._sph.set(c.r0 + (c.r1 - c.r0) * e, c.phi0 + (c.phi1 - c.phi0) * e, c.th0 + (c.th1 - c.th0) * k);
      this.camera.position.setFromSpherical(this._sph).add(this.controls.target);
    }
    this.controls.update();
    if (intro >= 1 && !this.controls.enabled) { this.controls.enabled = true; if (this.savedMaxDistance !== undefined) this.controls.maxDistance = this.savedMaxDistance; }
    if (intro >= 1 && !this.reduced && !this.userRotating && this.controls.autoRotate !== true) this.controls.autoRotate = true; this.handRotation = (this.handRotation || 0) + ((this.handTarget || 0) - (this.handRotation || 0)) * Math.min(1, dt * 3); this.root.rotation.y = this.handRotation + Math.sin(t * .12) * .045;
      const u = this.particleMaterial.uniforms; u.uTime.value = t; u.uIntro.value = intro; u.uBurst.value = this.state.burst; u.uFocus.value = this.state.focus;
      const stage = Math.max(0, (intro - .38) / .62);
      this.garlandMaterial.uniforms.uTime.value = t; this.garlandMaterial.uniforms.uIntro.value = stage; this.starMaterial.uniforms.uTime.value = t; this.starMaterial.uniforms.uIntro.value = stage; this.haloMaterial.uniforms.uTime.value = t; this.haloMaterial.uniforms.uIntro.value = stage; this.snowMaterial.uniforms.uTime.value = t; this.airMaterial.uniforms.uTime.value = t; this.airMaterial.uniforms.uBurst.value = this.state.burst;
      const giftFade = THREE.MathUtils.smoothstep(intro, .34, .88);
      // Fade gifts in without their shadow map leaking in early (a shadow with
      // no visible gift reads as a hole in the ground).
      this.giftGroup.visible = intro > .28;
      const giftShadows = giftFade > .5;
      if (giftShadows !== this.giftShadows) { this.giftShadows = giftShadows; for (const mesh of this.giftGroup.children) mesh.castShadow = giftShadows; }
      for (const m of this.giftMaterials) m.opacity = giftFade;
    this.trailMaterial.uniforms.uTime.value = t; this.trailMaterial.uniforms.uIntro.value = intro; this.trailMaterial.uniforms.uBurst.value = this.state.burst; this.decorMaterial.uniforms.uTime.value = t; this.decorMaterial.uniforms.uIntro.value = intro; this.fireworkMaterial.uniforms.uTime.value = t; this.fireworkMaterial.uniforms.uGo.value = Math.max(0, (intro - .92) / .08);
    this.skyMaterial.uniforms.uTime.value = t; this.skyMaterial.uniforms.uIntro.value = intro; this.glowMaterial.uniforms.uTime.value = t; this.glowMaterial.uniforms.uIntro.value = Math.max(0, (intro - .5) / .5);
    if (intro >= 1 && !this.merryShown) { this.merryShown = true; document.getElementById('merry')?.classList.add('show'); }
    this.starGroup.quaternion.copy(this.root.quaternion).invert().multiply(this.camera.quaternion);
    const star = this.starGroup.getWorldPosition(new THREE.Vector3()).project(this.camera); this.callbacks.onStarPosition?.((star.x + 1) * .5 * this.canvas.clientWidth, (1 - star.y) * .5 * this.canvas.clientHeight, star.z < 1);
    this.composer.render();
    if (this.photoScene.children.length) { const auto = this.renderer.autoClear, tone = this.renderer.toneMapping; this.renderer.autoClear = false; this.renderer.toneMapping = THREE.NoToneMapping; this.renderer.clearDepth(); this.renderer.render(this.photoScene, this.camera); this.renderer.autoClear = auto; this.renderer.toneMapping = tone; }
  }
}
