import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { animate } from 'animejs';

const palettes = {
  gold: { leaf: '#3d8c55', light: '#e3b76c', ribbon: '#e3b66c', heart: '#f0b4a1', ornament: '#bc9a51', red: '#872d37' },
  rose: { leaf: '#5c806c', light: '#f3a1a7', ribbon: '#f4b2ba', heart: '#ff94b1', ornament: '#d39492', red: '#b54766' },
  aurora: { leaf: '#4b9294', light: '#a6e7f5', ribbon: '#9dd9ef', heart: '#b9c4ff', ornament: '#95c1ca', red: '#446c9c' },
};
const TAU = Math.PI * 2;
function random(a, b) { return a + Math.random() * (b - a); }

export class ChristmasTree {
  constructor(canvas, { onReady, onError } = {}) {
    this.canvas = canvas;
    this.small = window.innerWidth < 701;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.state = { scatter: 0, heart: 0, intro: 0, burst: 0 };
    this.rotation = 0;
    this.targetRotation = 0;
    this.pointerTilt = 0;
    this.lastTime = 0;
    this.paused = false;
    this.onError = onError;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.small ? 1.5 : 1.7));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(this.small ? 43 : 40, 1, .1, 70);
      this.camera.position.set(0, .55, this.small ? 11.8 : 11.4);
      this.camera.lookAt(0, .18, 0);
      this.root = new THREE.Group();
      this.scene.add(this.root);
      this.treeDetails = new THREE.Group();
      this.root.add(this.treeDetails);
      this.scene.add(new THREE.AmbientLight('#c3ddc5', 2));
      const main = new THREE.DirectionalLight('#ffe8be', 5);
      main.position.set(-4, 6, 6); this.scene.add(main);
      const rim = new THREE.DirectionalLight('#91bca2', 3);
      rim.position.set(5, 2, -3); this.scene.add(rim);
      this.buildParticles();
      this.buildRibbons();
      this.buildOrnaments();
      this.buildStar();
      this.buildGround();
      this.buildGifts();
      this.buildSnow();
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .62, .65, .7);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      // Bloom composites into an opaque black buffer. Recover a soft alpha so the
      // forest background continues behind the scene rather than ending at a box.
      this.composer.addPass(new ShaderPass({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){vec3 c=texture2D(tDiffuse,vUv).rgb; float a=clamp(max(c.r,max(c.g,c.b))*6.,0.,1.); gl_FragColor=vec4(c*a,a);}',
      }));
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas.parentElement);
      this.resize(); this.bindPointer();
      this.setTheme('gold');
      this.visibilityHandler = () => { this.paused = document.hidden; };
      document.addEventListener('visibilitychange', this.visibilityHandler);
      this.contextLost = e => { e.preventDefault(); this.paused = true; this.onError?.(); };
      canvas.addEventListener('webglcontextlost', this.contextLost);
      this.tick = this.tick.bind(this);
      this.renderer.setAnimationLoop(this.tick);
      this.introAnimation = animate(this.state, { intro: 1, duration: this.reduced ? 1 : 2200, ease: 'outExpo', onComplete: () => onReady?.() });
      setTimeout(() => onReady?.(), 450);
    } catch (e) { console.error('Christmas scene:', e); onError?.(); }
  }

  buildParticles() {
    const count = this.small ? 10500 : 18500;
    const base = new Float32Array(count * 3), scatter = new Float32Array(count * 3), heart = new Float32Array(count * 3);
    const sizes = new Float32Array(count), seeds = new Float32Array(count), kinds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const h = Math.pow(Math.random(), .88);
      const tier = .85 + .15 * Math.pow(.5 + .5 * Math.cos(h * 57), 1.7);
      const a = random(0, TAU);
      const radius = Math.pow(1 - h, .84) * 2.32 * tier * Math.sqrt(random(.32, 1));
      base.set([Math.cos(a) * radius, -2.93 + h * 6.35, Math.sin(a) * radius], i * 3);
      const azimuth = random(0, TAU), polar = Math.acos(random(-1, 1));
      const sr = random(2.4, 5.0);
      scatter.set([sr * Math.sin(polar) * Math.cos(azimuth), sr * Math.cos(polar) * .83 + .3, sr * Math.sin(polar) * Math.sin(azimuth) * .7], i * 3);
      const angle = random(0, TAU), hr = i % 4 ? random(.84, 1) : Math.sqrt(Math.random());
      const hx = 16 * Math.pow(Math.sin(angle), 3);
      const hy = 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle);
      heart.set([hx * .195 * hr, hy * .195 * hr + .55, random(-.28, .28) * hr], i * 3);
      const kind = Math.random();
      kinds[i] = kind;
      sizes[i] = kind > .76 ? random(.045, .11) : random(.018, .046);
      if (i % 107 === 0) sizes[i] = .15;
      seeds[i] = random(0, TAU);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
    geo.setAttribute('aHeart', new THREE.BufferAttribute(heart, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uScatter: { value: 0 }, uHeart: { value: 0 }, uIntro: { value: 0 }, uBurst: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() }, uLeaf: { value: new THREE.Color() }, uLight: { value: new THREE.Color() }, uHeartColor: { value: new THREE.Color() },
      },
      vertexShader: `
        attribute vec3 aScatter; attribute vec3 aHeart; attribute float aSize; attribute float aSeed; attribute float aKind;
        uniform float uTime, uScatter, uHeart, uIntro, uBurst, uPixelRatio;
        varying float vTwinkle, vKind, vSeed;
        void main() {
          vec3 p = mix(position, aScatter, uScatter);
          p = mix(p, aHeart, uHeart);
          float drift = .012 + uScatter * .08;
          p += vec3(sin(uTime * .6 + aSeed), cos(uTime * .7 + aSeed * 2.), sin(uTime * .5 + aSeed)) * drift;
          p += normalize(position + vec3(0., .01, 0.)) * uBurst * (.3 + aSeed * .08);
          p = mix(aScatter * 1.15, p, uIntro);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          vTwinkle = .76 + .24 * sin(uTime * (1.1 + aSeed * .18) + aSeed * 7.);
          vKind = aKind; vSeed = aSeed;
          gl_PointSize = clamp(aSize * (1. + uBurst * 1.4) * uPixelRatio * 440. / -mv.z, 1., 40.);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uLeaf, uLight, uHeartColor; uniform float uHeart, uIntro;
        varying float vTwinkle, vKind, vSeed;
        void main() {
          vec2 p = gl_PointCoord - .5; float d = length(p);
          if(d > .5) discard;
          float alpha = exp(-d*d*18.);
          vec3 color = vKind > .76 ? uLight * (1.4 + vKind) : uLeaf * (.6 + vKind);
          color = mix(color, uHeartColor * (1.2 + vKind), uHeart);
          float core = exp(-d*d*90.);
          if(vKind > .98) alpha += pow(max(0., 1. - abs(p.x)*18.), 3.) * .2 + pow(max(0., 1. - abs(p.y)*18.), 3.) * .2;
          gl_FragColor = vec4(color * (vTwinkle + core * .6), alpha * uIntro);
        }`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.particles = new THREE.Points(geo, this.particleMaterial);
    this.particles.frustumCulled = false; this.root.add(this.particles);
  }

  buildRibbons() {
    this.ribbonMaterial = new THREE.MeshBasicMaterial({ color: '#e6bf7d', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let j = 0; j < 2; j++) {
      const points = [];
      for (let i = 0; i <= 600; i++) {
        const t = i / 600, angle = t * TAU * 4.1 + j * .055;
        const r = (1 - t) * 2.2 + .05;
        points.push(new THREE.Vector3(Math.cos(angle) * r, -2.79 + t * 6.13 + Math.sin(angle) * .035, Math.sin(angle) * r));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const ribbon = new THREE.Mesh(new THREE.TubeGeometry(curve, 600, j ? .006 : .012, 4, false), this.ribbonMaterial);
      this.treeDetails.add(ribbon);
    }
    const points = [], sizes = [];
    for (let i = 0; i < 750; i++) {
      const t = i / 750, angle = t * TAU * 4.1, r = (1 - t) * 2.2 + .05;
      points.push(Math.cos(angle) * r + random(-.035,.035), -2.79 + t * 6.13 + random(-.04,.04), Math.sin(angle) * r + random(-.035,.035));
      sizes.push(.04);
    }
    const geo = new THREE.BufferGeometry();geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.ribbonPointsMaterial = new THREE.PointsMaterial({ color: '#ffe0a1', size: .04, map: this.makeGlow(), transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.treeDetails.add(new THREE.Points(geo, this.ribbonPointsMaterial));
  }

  buildOrnaments() {
    this.ornamentMaterials = [
      new THREE.MeshStandardMaterial({ color: '#ba9758', metalness: .8, roughness: .24, transparent: true }),
      new THREE.MeshStandardMaterial({ color: '#852a35', metalness: .4, roughness: .27, transparent: true }),
    ];
    const sphere = new THREE.SphereGeometry(1, 12, 10);
    const dummy = new THREE.Object3D();
    for (let type = 0; type < 2; type++) {
      const count = type ? 48 : 84;
      const instanced = new THREE.InstancedMesh(sphere, this.ornamentMaterials[type], count);
      for (let i = 0; i < count; i++) {
        const h = random(.04,.93), a = random(0,TAU), r = Math.pow(1-h,.84)*2.12;
        dummy.position.set(Math.cos(a)*r,-2.9+h*6.2,Math.sin(a)*r);
        dummy.scale.setScalar(random(.045,.105)*(1-h*.4));dummy.updateMatrix();
        instanced.setMatrixAt(i,dummy.matrix);
      }
      this.treeDetails.add(instanced);
    }
  }

  makeGlow(star = false) {
    const canvas = document.createElement('canvas');canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.08,'rgba(255,255,255,.95)');gradient.addColorStop(.22,'rgba(255,255,255,.3)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    if(star){ctx.strokeStyle='#ffffff99';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(64,4);ctx.lineTo(64,124);ctx.moveTo(4,64);ctx.lineTo(124,64);ctx.stroke();}
    const tex = new THREE.CanvasTexture(canvas); return tex;
  }

  buildStar() {
    this.starGroup = new THREE.Group();this.starGroup.position.y=3.63;
    const shape=new THREE.Shape();
    for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.16:.365;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.015,bevelThickness:.015});
    this.starMaterial = new THREE.MeshStandardMaterial({color:'#f1cb7c',emissive:'#c99c46',emissiveIntensity:1.3,metalness:.6,roughness:.28,transparent:true});
    this.star=new THREE.Mesh(geo,this.starMaterial);this.starGroup.add(this.star);
    this.starGlowMaterial=new THREE.SpriteMaterial({map:this.makeGlow(true),color:'#ffda8c',transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false});
    this.starGlow=new THREE.Sprite(this.starGlowMaterial);this.starGlow.scale.set(1.6,1.6,1);this.starGroup.add(this.starGlow);
    this.root.add(this.starGroup);
  }

  buildGround() {
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(7.8,7.8),new THREE.MeshBasicMaterial({map:this.makeGlow(),color:'#847a43',transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow.rotation.x=-Math.PI/2;glow.position.y=-3.23;this.scene.add(glow);
    const positions=[];
    for(let i=0;i<2200;i++){const a=random(0,TAU),r=i%3===0?random(2.6,2.7):random(.5,3.05);positions.push(Math.cos(a)*r,-3.2+random(0,.025),Math.sin(a)*r);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.groundMaterial = new THREE.PointsMaterial({color:'#c6ac6b',size:.018,map:this.makeGlow(),transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false});
    this.scene.add(new THREE.Points(g,this.groundMaterial));
    for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(2.66+i*.12,.004,3,160),new THREE.MeshBasicMaterial({color:'#bca573',transparent:true,opacity:i?.15:.28}));ring.rotation.x=Math.PI/2;ring.position.y=-3.21;this.scene.add(ring);}
  }

  buildGifts() {
    const makeGift=(x,z,w,h,color,ribbonColor,rotation)=>{
      const group=new THREE.Group();group.position.set(x,-3.1+h/2,z);group.rotation.y=rotation;
      const mat=new THREE.MeshStandardMaterial({color,roughness:.56,metalness:.25});
      const ribbon=new THREE.MeshStandardMaterial({color:ribbonColor,metalness:.55,roughness:.3});
      const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,w*.85),mat);group.add(box);
      const lid=new THREE.Mesh(new THREE.BoxGeometry(w*1.04,h*.12,w*.89),mat);lid.position.y=h*.49;group.add(lid);
      const b1=new THREE.Mesh(new THREE.BoxGeometry(w*.14,h*1.025,w*.86),ribbon),b2=new THREE.Mesh(new THREE.BoxGeometry(w*1.01,h*1.025,w*.12),ribbon);group.add(b1,b2);
      for(let j=-1;j<=1;j+=2){const points=[];for(let k=0;k<=40;k++){const a=k/40*TAU;points.push(new THREE.Vector3(j*(.11+Math.cos(a)*.11)*w,h*.58+Math.sin(a)*w*.1,Math.sin(a)*.035));}const bow=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,w*.02,4,false),ribbon);group.add(bow);}
      this.scene.add(group);return group;
    };
    this.gifts=[makeGift(-1.18,1.05,.65,.57,'#772c34','#d3ae65',-.25),makeGift(-.52,1.6,.54,.39,'#baa875','#59674b',.2),makeGift(1.14,.95,.57,.68,'#283e2b','#cfb77b',.4),makeGift(1.65,.65,.42,.38,'#91674f','#d9c58d',-.1)];
  }

  buildSnow() {
    const count=this.small?250:440,positions=new Float32Array(count*3);
    for(let i=0;i<count;i++)positions.set([random(-8,8),random(-3.5,6),random(-5,4)],i*3);
    this.snowPositions=positions;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.snowMaterial=new THREE.PointsMaterial({color:'#e4e1cc',size:.025,map:this.makeGlow(),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false});
    this.snow=new THREE.Points(geo,this.snowMaterial);this.scene.add(this.snow);
  }

  setTheme(name) {
    if(!this.particleMaterial)return;
    const p=palettes[name]||palettes.gold;
    this.particleMaterial.uniforms.uLeaf.value.set(p.leaf);
    this.particleMaterial.uniforms.uLight.value.set(p.light);
    this.particleMaterial.uniforms.uHeartColor.value.set(p.heart);
    this.ribbonMaterial.color.set(p.ribbon);this.ribbonPointsMaterial.color.set(p.ribbon);
    this.ornamentMaterials[0].color.set(p.ornament);this.ornamentMaterials[1].color.set(p.red);
    this.starMaterial.color.set(p.light);this.starMaterial.emissive.set(p.light);
    this.starGlowMaterial.color.set(p.light);this.groundMaterial.color.set(p.ribbon);
    this.theme=name;
  }

  setMode(mode) {
    this.mode=mode;
    this.morphAnimation?.pause();
    this.morphAnimation=animate(this.state,{scatter:mode==='scatter'?1:0,heart:mode==='heart'?1:0,duration:this.reduced?1:1550,ease:'inOutCubic'});
    if(mode==='heart')this.targetRotation=0;
  }

  burst() {
    this.burstAnimation?.pause();this.state.burst=1;
    this.burstAnimation=animate(this.state,{burst:0,duration:this.reduced?1:1600,ease:'outExpo'});
  }

  bindPointer() {
    const canvas=this.canvas,pointers=new Map();let startX=0,startRotation=0,moved=false,pinchDistance=0,lastTap=0;
    canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);startX=e.clientX;startRotation=this.targetRotation;moved=false;if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
    canvas.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId)){this.pointerTilt=(e.offsetY/canvas.clientHeight-.5)*.06;return;}
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){const p=[...pointers.values()],dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);this.camera.position.z=THREE.MathUtils.clamp(this.camera.position.z-(dist-pinchDistance)*.018,9.6,15);pinchDistance=dist;moved=true;}
      else{this.targetRotation=startRotation+(e.clientX-startX)*.008;if(Math.abs(e.clientX-startX)>5)moved=true;}
    });
    const end=e=>{pointers.delete(e.pointerId);if(!moved&&e.type==='pointerup'){const now=performance.now();if(now-lastTap<350)this.burst();lastTap=now;}};
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.camera.position.z=THREE.MathUtils.clamp(this.camera.position.z+e.deltaY*.004,9.6,15);},{passive:false});
    canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.targetRotation+=(e.key==='ArrowLeft'?-1:1)*.25;}if(e.key==='+'||e.key==='=')this.camera.position.z=Math.max(9.6,this.camera.position.z-.3);if(e.key==='-')this.camera.position.z=Math.min(15,this.camera.position.z+.3);if(e.key==='Enter')this.burst();});
  }

  setHandRotation(value){this.targetRotation=THREE.MathUtils.clamp(value,-1,1)*.85;}

  resize(){const {width,height}=this.canvas.parentElement.getBoundingClientRect();if(!width||!height||!this.renderer)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.composer?.setSize(width,height);}

  tick(ms){
    if(this.paused)return;
    const t=ms*.001,dt=Math.min((ms-this.lastTime)*.001,.05);this.lastTime=ms;
    const u=this.particleMaterial.uniforms;
    u.uTime.value=this.reduced?0:t;u.uScatter.value=this.state.scatter;u.uHeart.value=this.state.heart;u.uIntro.value=this.state.intro;u.uBurst.value=this.state.burst;
    this.rotation+=(this.targetRotation-this.rotation)*Math.min(dt*5,1);
    this.root.rotation.y=(this.rotation+(this.reduced?0:Math.sin(t*.11)*.1))*(1-this.state.heart);
    this.root.rotation.x=this.pointerTilt*(1-this.state.heart);
    const fade=1-Math.max(this.state.scatter,this.state.heart);
    this.treeDetails.visible=fade>.01;this.treeDetails.scale.setScalar(.8+.2*fade);
    this.ribbonMaterial.opacity=fade*.7;this.ribbonPointsMaterial.opacity=fade;
    this.ornamentMaterials.forEach(m=>m.opacity=fade);
    this.starGroup.visible=fade>.01;this.starGroup.scale.setScalar((.96+Math.sin(t*1.1)*.04)*fade);
    this.star.rotation.y=-this.root.rotation.y*.6;
    this.starGlowMaterial.opacity=(.55+Math.sin(t*1.3)*.09)*fade;
    this.gifts.forEach(g=>g.scale.setScalar(.88+.12*fade));
    if(!this.reduced){const p=this.snowPositions;for(let i=0;i<p.length;i+=3){p[i+1]-=dt*(.045+(i%7)*.009);p[i]+=Math.sin(t*.3+i)*dt*.014;if(p[i+1]<-3.3)p[i+1]=5.5;}this.snow.geometry.attributes.position.needsUpdate=true;}
    this.composer.render();
  }

  async snapshot(){if(!this.renderer)return null;this.composer.render();return this.canvas.toDataURL('image/png');}
}
