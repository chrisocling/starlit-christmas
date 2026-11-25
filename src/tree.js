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

const TAU = Math.PI * 2;
let seed = 76391;
const rand = (lo = 0, hi = 1) => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return lo + (seed >>> 0) / 4294967296 * (hi - lo); };
const tierRadius = i => 3.05 * Math.pow(1 - i / 10.3, 1.12);
const tierBase = i => .42 + i * .74;
function radiusAt(y) { let r = .04; for (let i = 0; i < 10; i++) { const u = (y - tierBase(i)) / 1.64; if (u >= 0 && u <= 1) r = Math.max(r, tierRadius(i) * Math.pow(1 - u, .86)); } return r; }
function strip(curve, width, segments = 44) {
  const positions = [], uv = [], indices = [];
  for (let i = 0; i <= segments; i++) { const t = i / segments, p = curve.getPoint(t), tangent = curve.getTangent(t); const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize().multiplyScalar(width / 2); for (const sign of [-1, 1]) { positions.push(p.x + side.x * sign, p.y + side.y * sign, p.z + side.z * sign); uv.push((sign + 1) / 2, t); } if (i < segments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
function glowTexture(cross = false) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#fff'); g.addColorStop(.08, '#fffffff0'); g.addColorStop(.24, '#ffffff50'); g.addColorStop(1, '#ffffff00'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  if (cross) { x.strokeStyle = '#fff9'; x.lineWidth = 1; x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke(); }
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
      this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#0b1320'); this.scene.fog = new THREE.FogExp2('#0b1320', .025); this.photoScene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, 1, .1, 180); this.camera.position.set(0, 5.1, 15.7);
      this.controls = new OrbitControls(this.camera, canvas); this.controls.target.set(0, 4.05, 0); this.controls.enablePan = false; this.controls.enableDamping = true; this.controls.dampingFactor = .055; this.controls.rotateSpeed = .38; this.controls.zoomSpeed = .65; this.controls.minPolarAngle = .7; this.controls.maxPolarAngle = Math.PI * .48;
      const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(this.renderer); this.environment = pmrem.fromScene(room, .04); this.scene.environment = this.environment.texture; this.scene.environmentIntensity = .26; room.dispose(); pmrem.dispose();
      this.scene.add(new THREE.HemisphereLight('#d1e2ff', '#b4c4df', .65));
      const key = new THREE.DirectionalLight('#fff2dd', 1.65); key.position.set(-6, 11, 7); key.target.position.set(0, 3.2, 0); key.castShadow = true; key.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 11, bottom: -6, near: .1, far: 35 }); key.shadow.bias = -.0004; key.shadow.normalBias = .025; key.shadow.radius = 3; this.scene.add(key, key.target);
      const rim = new THREE.DirectionalLight('#8cadf3', .75); rim.position.set(5, 7, -5); this.scene.add(rim);
      const warm = new THREE.PointLight('#ffb955', 6, 12, 2); warm.position.set(0, 3.5, 3); this.scene.add(warm);
      this.root = new THREE.Group(); this.scene.add(this.root); this.photoOrnaments = new THREE.Group(); this.root.add(this.photoOrnaments);
      this.buildSnowfield(); this.buildTreeBody(); this.buildParticles(); this.buildGarlands(); this.buildOrnaments(); this.buildStar(); this.buildGifts(); this.buildWeather();
      this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera)); this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.03, .55, 1.65); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
      this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement); this.resize();
      this.bindInput(); this.visibilityHandler = () => { this.lastTime = 0; }; document.addEventListener('visibilitychange', this.visibilityHandler);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; callbacks.onError?.(); });
      this.renderer.setAnimationLoop(t => this.tick(t));
      this.intro = animate(this.state, { intro: 1, duration: this.reduced ? 1 : 2600, ease: 'outExpo' });
      setTimeout(() => callbacks.onReady?.(), 350);
    } catch (e) { console.error('Snow tree:', e); callbacks.onError?.(e); }
  }

  buildSnowfield() {
    const noise = document.createElement('canvas'); noise.width = noise.height = 256; const c = noise.getContext('2d'), pixels = c.createImageData(256, 256);
    for (let i = 0; i < pixels.data.length; i += 4) { const v = rand(110, 235); pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v; pixels.data[i + 3] = 255; } c.putImageData(pixels, 0, 0);
    const bump = new THREE.CanvasTexture(noise); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(80, 80);
    const geo = new THREE.PlaneGeometry(180, 180, 110, 110); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), dist = Math.hypot(x, z); const hills = Math.sin(x * .15 + z * .11) * .28 + Math.cos(z * .21 - x * .1) * .24; pos.setY(i, -.05 + hills * THREE.MathUtils.smoothstep(dist, 5, 14)); } geo.computeVertexNormals();
    const snow = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#eef4fc', roughness: .9, bumpMap: bump, bumpScale: .035, metalness: 0 })); snow.receiveShadow = true; this.scene.add(snow);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#1b2e48', transparent: true, opacity: .26, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .003; this.scene.add(shadow);
    const p = []; for (let i = 0; i < 2500; i++) { const a = rand(0, TAU), r = rand(.8, 11); p.push(Math.cos(a) * r, .008, Math.sin(a) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: .018, color: '#d3e5ff', transparent: true, opacity: .65, map: glowTexture(), depthWrite: false })));
  }

  buildTreeBody() {
    const material = new THREE.MeshStandardMaterial({ color: '#154837', roughness: .87, metalness: .05 });
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vBranchPosition; varying vec3 vBranchNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBranchPosition = position; vBranchNormal = normal;');
      shader.fragmentShader = 'varying vec3 vBranchPosition; varying vec3 vBranchNormal;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float n=sin(vBranchPosition.x*17.+sin(vBranchPosition.z*11.))*sin(vBranchPosition.z*19.+vBranchPosition.y*13.);
        float needles=.82+.18*sin(vBranchPosition.y*150.+vBranchPosition.x*91.+vBranchPosition.z*63.);
        float snow=smoothstep(.38,.78,vBranchNormal.y) * smoothstep(-.18,.38,n+sin(vBranchPosition.y*7.)*.35);
        diffuseColor.rgb = mix(diffuseColor.rgb*needles,vec3(.5,.65,.72),snow*.18);
      `);
    };
    for (let tier = 0; tier < 10; tier++) {
      const radius = tierRadius(tier), positions = [], uvs = [], indices = [], rings = 13, segments = 100;
      for (let i = 0; i <= rings; i++) { const u = i / rings; for (let j = 0; j <= segments; j++) { const a = j / segments * TAU, wav = .93 + .075 * Math.cos(a * 13 + tier * .63) + .018 * Math.sin(a * 29); const r = radius * Math.pow(1 - u, .86) * wav; positions.push(Math.cos(a) * r, tierBase(tier) + u * 1.64 - Math.pow(1 - u, 3) * (.09 + .08 * Math.sin(a * 13 + tier)), Math.sin(a) * r); uvs.push(j / segments, u); if (i < rings && j < segments) { const k = i * (segments + 1) + j; indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2); } } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, material); mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.14, .25, 1.5, 12), new THREE.MeshStandardMaterial({ color: '#43332b', roughness: 1 })); trunk.position.y = .65; this.root.add(trunk);
    const count = this.mobile ? 240 : 450, clumps = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#e5edf5', roughness: .98 }), count), dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) { const tier = Math.floor(rand(0, 9)), a = rand(0, TAU), u = rand(.035, .45), r = tierRadius(tier) * Math.pow(1 - u, .86) * (.93 + .075 * Math.cos(a * 13 + tier * .63)); dummy.position.set(Math.cos(a) * r, tierBase(tier) + u * 1.64 + .015, Math.sin(a) * r); dummy.rotation.set(0, -a, -.1); dummy.scale.set(rand(.06, .13) * (1 - tier * .05), rand(.018, .043), rand(.10, .20) * (1 - tier * .05)); dummy.updateMatrix(); clumps.setMatrixAt(i, dummy.matrix); }
    clumps.receiveShadow = true; this.root.add(clumps);
  }

  buildParticles() {
    const count = this.mobile ? 46000 : 98000, pos = new Float32Array(count * 3), sizes = new Float32Array(count), kinds = new Float32Array(count), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) { const tier = Math.min(9, Math.floor((1 - Math.sqrt(rand())) * 10)), kind = rand(), a = rand(0, TAU), u = kind > .72 && kind < .90 ? rand(.02, .52) : rand(0, .96); const r = tierRadius(tier) * Math.pow(1 - u, .86) * (.93 + .075 * Math.cos(a * 13 + tier * .63)) * (kind > .9 ? rand(1.02, 1.085) : rand(.985, 1.075)); pos.set([Math.cos(a) * r, tierBase(tier) + u * 1.64 - .05 + (kind > .72 && kind < .90 ? .06 : 0), Math.sin(a) * r], i * 3); sizes[i] = kind > .9 ? rand(.018, .052) : rand(.014, .036); kinds[i] = kind; seeds[i] = rand(0, TAU); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); geo.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1)); geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uBurst: { value: 0 }, uFocus: { value: 0 }, uPixel: { value: this.renderer.getPixelRatio() }, uHeight: { value: innerHeight } },
      vertexShader: `attribute float aSize,aKind,aSeed; uniform float uTime,uIntro,uBurst,uPixel,uHeight; varying float vKind,vTwinkle,vSeed;
        void main(){vec3 p=position; vec3 center=vec3(0.,4.2,0.); vec3 outDir=normalize(p-center+vec3(.01));
        p+=outDir*uBurst*(.5+aSeed*.23); p+=vec3(sin(uTime*.7+aSeed),cos(uTime*.8+aSeed),sin(uTime*.5+aSeed*2.))*.016;
        vec3 initial=outDir*(5.+aSeed*.5)+center; p=mix(initial,p,uIntro);vec4 mv=modelViewMatrix*vec4(p,1.);
        vKind=aKind;vSeed=aSeed;vTwinkle=.68+.32*sin(uTime*(1.3+aSeed*.5)+aSeed*9.);gl_PointSize=clamp(aSize*uPixel*uHeight*1.2/-mv.z*(1.+uBurst),1.,35.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uIntro,uFocus;varying float vKind,vTwinkle,vSeed;
        void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;float alpha=exp(-d*d*22.);vec3 c;
        if(vKind<.72)c=vec3(.025,.17,.075)*(1.+vKind);else if(vKind<.90)c=vec3(.48,.62,.7)*.6;else if(vKind<.994)c=vec3(1.,.56,.14)*(2.8+vTwinkle*1.6);else c=vec3(1.,.035,.06)*2.;
        if(vKind>.99){float cross=pow(max(0.,1.-abs(p.x)*24.),5.)+pow(max(0.,1.-abs(p.y)*24.),5.);alpha+=cross*.23;}
        gl_FragColor=vec4(c*vTwinkle*(1.-uFocus*.35),alpha*uIntro);}`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.particles = new THREE.Points(geo, this.particleMaterial); this.particles.frustumCulled = false; this.root.add(this.particles); this.particleCount = count;
  }

  buildGarlands() {
    const positions = [], along = [], points = [];
    for (let i = 0; i <= 1200; i++) { const t = i / 1200, y = .65 + t * 7.8, a = t * TAU * 4.7, r = radiusAt(y) * 1.07 + .07; points.push(new THREE.Vector3(Math.cos(a) * r, y + Math.sin(a * 2) * .045, Math.sin(a) * r)); for (let j = 0; j < 4; j++) { positions.push(Math.cos(a) * r + rand(-.045, .045), y + rand(-.06, .06), Math.sin(a) * r + rand(-.045, .045)); along.push(t); } }
    const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd893').multiplyScalar(1.9), transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false });
    this.root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 1200, .012, 5, false), gold));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    this.garlandMaterial = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uHeight: { value: innerHeight }, uPixel: { value: this.renderer.getPixelRatio() } }, vertexShader: `attribute float aAlong;uniform float uTime,uHeight,uPixel;varying float vLight;void main(){vLight=pow(max(0.,sin(aAlong*62.-uTime*2.2)),12.);vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp((.022+vLight*.038)*uPixel*uHeight/-p.z,1.,25.);gl_Position=projectionMatrix*p;}`, fragmentShader: `varying float vLight;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(1.,.48,.12)*(2.3+vLight*1.6),exp(-d*d*22.)*(.65+vLight*.35));}`, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.root.add(new THREE.Points(geo, this.garlandMaterial));
  }

  buildOrnaments() {
    const sphere = new THREE.SphereGeometry(1, 18, 12), dummy = new THREE.Object3D();
    const materials = ['#bd1938', '#ddb96d', '#d5e0e6'].map((color, i) => new THREE.MeshStandardMaterial({ color, metalness: i === 0 ? .32 : .8, roughness: i === 0 ? .2 : .23 }));
    materials.forEach((material, j) => { const count = j === 2 ? 35 : 95, mesh = new THREE.InstancedMesh(sphere, material, count); for (let i = 0; i < count; i++) { const y = rand(.8, 8.1), a = rand(0, TAU), r = radiusAt(y) * 1.03; dummy.position.set(Math.cos(a) * r, y - .07, Math.sin(a) * r); dummy.scale.setScalar(rand(.055, .135)); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); } mesh.castShadow = true; this.root.add(mesh); });
  }

  buildStar() {
    this.starGroup = new THREE.Group(); this.starGroup.position.y = 8.98;
    const shape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .2 : .45; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); } shape.closePath();
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .11, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, steps: 1 }), new THREE.MeshStandardMaterial({ color: '#ffe2a0', emissive: '#ffd078', emissiveIntensity: 2, metalness: .7, roughness: .22 }));
    this.starGroup.add(star); this.starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(true), color: new THREE.Color('#ffe3a5').multiplyScalar(1.3), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); this.starGlow.scale.set(2.4, 2.4, 1); this.starGroup.add(this.starGlow); this.root.add(this.starGroup);
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
    const gifts = new THREE.Group(); this.scene.add(gifts); this.giftCount = this.mobile ? 30 : 42;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const place = (x, z, w, h, d, index, elevation = 0) => {
      const g = new THREE.Group(); g.position.set(x, h / 2 - .025 + elevation, z); g.rotation.y = rand(-.6, .6); gifts.add(g);
      const mat = paper[index % paper.length], ribbon = ribbons[index % ribbons.length], round = index % 9 === 0;
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
    const baseCount = this.giftCount - 10, bases = [];
    for (let i = 0; i < baseCount; i++) {
      const a = i < 20 ? -1.45 + i / 19 * 2.9 : rand(0, TAU), r = i < 20 ? rand(this.mobile ? 2.6 : 2.95, this.mobile ? 3.2 : 4.2) : rand(2.8, 3.7), w = rand(.58, this.mobile ? .85 : 1.05), h = rand(.42, .94), d = w * rand(.75, 1.1);
      const g = place(Math.sin(a) * r, Math.cos(a) * r, w, h, d, i); bases.push({ g, w, h, d });
    }
    for (let i = 0; i < 10; i++) { const base = bases[(i * 3 + 1) % bases.length], w = base.w * .7; place(base.g.position.x + rand(-.12, .12), base.g.position.z + rand(-.09, .09), w, rand(.32, .56), base.d * .78, baseCount + i, base.h + .16); }
    // Merge the stationary paper and ribbons by material, keeping dozens of gifts inexpensive.
    gifts.updateMatrixWorld(true); const buckets = new Map(), originalGeos = new Set();
    gifts.traverse(o => { if (!o.isMesh) return; let geo = o.geometry.clone(); if (geo.index) { const nonIndexed = geo.toNonIndexed(); geo.dispose(); geo = nonIndexed; } geo.applyMatrix4(o.matrixWorld); originalGeos.add(o.geometry); const key = o.material.uuid; if (!buckets.has(key)) buckets.set(key, { material: o.material, geometries: [] }); buckets.get(key).geometries.push(geo); });
    gifts.clear(); for (const { material, geometries } of buckets.values()) { const merged = mergeGeometries(geometries); const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; gifts.add(mesh); geometries.forEach(g => g.dispose()); } originalGeos.forEach(g => g.dispose());
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
    if (Math.abs((this.lastAspect || 0) - aspect) > .05) { const distance = Math.max(16.65, 6.35 / (2 * Math.tan(THREE.MathUtils.degToRad(21)) * aspect)); const direction = this.camera.position.clone().sub(this.controls.target).normalize(); this.camera.position.copy(this.controls.target).addScaledVector(direction, distance); this.controls.minDistance = distance * .7; this.controls.maxDistance = distance * 1.45; this.lastAspect = aspect; }
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); this.composer?.setSize(width, height);
    for (const m of [this.particleMaterial, this.garlandMaterial, this.snowMaterial, this.airMaterial]) if (m?.uniforms.uHeight) m.uniforms.uHeight.value = height;
    this.closePhoto(true);
  }

  tick(ms) {
    if (document.hidden || this.pausedForImport || this.lost || !this.composer) return;
    const t = this.reduced ? 0 : ms * .001, dt = this.lastTime ? Math.min((ms - this.lastTime) / 1000, .05) : .016; this.lastTime = ms;
    this.controls.update(); this.handRotation = (this.handRotation || 0) + ((this.handTarget || 0) - (this.handRotation || 0)) * Math.min(1, dt * 3); this.root.rotation.y = this.handRotation + Math.sin(t * .12) * .045;
    const u = this.particleMaterial.uniforms; u.uTime.value = t; u.uIntro.value = this.state.intro; u.uBurst.value = this.state.burst; u.uFocus.value = this.state.focus;
    this.garlandMaterial.uniforms.uTime.value = t; this.snowMaterial.uniforms.uTime.value = t; this.airMaterial.uniforms.uTime.value = t; this.airMaterial.uniforms.uBurst.value = this.state.burst;
    this.starGlow.material.opacity = .48 + Math.sin(t * 1.1) * .07;
    const star = this.starGroup.getWorldPosition(new THREE.Vector3()).project(this.camera); this.callbacks.onStarPosition?.((star.x + 1) * .5 * this.canvas.clientWidth, (1 - star.y) * .5 * this.canvas.clientHeight, star.z < 1);
    this.composer.render();
    if (this.photoScene.children.length) { const auto = this.renderer.autoClear, tone = this.renderer.toneMapping; this.renderer.autoClear = false; this.renderer.toneMapping = THREE.NoToneMapping; this.renderer.clearDepth(); this.renderer.render(this.photoScene, this.camera); this.renderer.autoClear = auto; this.renderer.toneMapping = tone; }
  }
}
