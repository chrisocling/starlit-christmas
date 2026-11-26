// Ratios and joint angles make these gestures independent of hand size and screen direction.
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
function jointAngle(a,b,c){const ab=[a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)],cb=[c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)];const norm=Math.hypot(...ab)*Math.hypot(...cb);return norm?Math.acos(Math.max(-1,Math.min(1,ab.reduce((s,v,i)=>s+v*cb[i],0)/norm))):0;}

export function classifyGesture(landmarks){
  if(!Array.isArray(landmarks)||landmarks.length!==21)return null;
  if(!landmarks.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.z===undefined||Number.isFinite(p.z))))return null;
  if(distance(landmarks[5],landmarks[17])<.00001)return null;
  const palm=Math.max(distance(landmarks[5],landmarks[17]),.0001);
  let extended=0;
  for(const mcp of [5,9,13,17]){
    const pip=mcp+1,tip=mcp+3;
    if(distance(landmarks[tip],landmarks[0])>distance(landmarks[pip],landmarks[0])*1.08&&jointAngle(landmarks[mcp],landmarks[pip],landmarks[tip])>2.3)extended++;
  }
  const reach=distance(landmarks[8],landmarks[0])/Math.max(distance(landmarks[6],landmarks[0]),.0001);
  const pinch=distance(landmarks[4],landmarks[8])/palm;
  if(pinch<.5&&(extended>0||reach>1.05))return 'heart';
  if(extended>=3)return 'scatter';
  if(extended===0||extended<=1&&reach<.95)return 'tree';
  return null;
}

export class GestureStabilizer {
  constructor({hold=280,cooldown=1200,release=450}={}){this.hold=hold;this.cooldown=cooldown;this.release=release;this.candidate=null;this.since=0;this.last=null;this.changed=-Infinity;this.absentSince=null;}
  update(gesture,time){
    if(!gesture){this.candidate=null;if(this.absentSince===null)this.absentSince=time;if(time-this.absentSince>=this.release)this.last=null;return null;}
    if(this.absentSince!==null&&time-this.absentSince>=this.release)this.last=null;
    this.absentSince=null;
    if(this.candidate!==gesture){this.candidate=gesture;this.since=time;return null;}
    if(time-this.since>=this.hold&&time-this.changed>=this.cooldown&&gesture!==this.last){this.last=gesture;this.changed=time;return gesture;}
    return null;
  }
  reset(){this.candidate=null;this.last=null;this.changed=-Infinity;this.absentSince=null;}
}

export class HandMagic {
  constructor({video,overlay,onMode,onRotation,onStatus,onError}){
    Object.assign(this,{video,overlay,onMode,onRotation,onStatus,onError});
    this.stabilizer=new GestureStabilizer({hold:200,cooldown:1000});this.active=false;this.generation=0;
  }
  async start(){
    const run=++this.generation;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){throw new Error('请通过 HTTPS 或 localhost 打开，才能开启摄像头');}
    try{
      this.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:480},height:{ideal:360},frameRate:{ideal:20,max:24}}});
      if(run!==this.generation){this.stream.getTracks().forEach(t=>t.stop());return false;}
      this.video.srcObject=this.stream;await this.video.play();
      const base=new URL(import.meta.env.BASE_URL,document.baseURI);
      const modelUrl=new URL('models/hand_landmarker.task',base).href;
      this.onStatus('loading','正在下载手势模型…');
      let model;
      try{
        const res=await fetch(modelUrl);
        if(!res.ok)throw new Error('模型下载失败');
        const total=Number(res.headers.get('content-length'))||0,reader=res.body.getReader(),chunks=[];let got=0;
        for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);got+=value.length;if(total)this.onStatus('loading','正在下载手势模型… '+Math.min(99,Math.round(got/total*100))+'%');}
        model=new Uint8Array(got);let off=0;for(const c of chunks){model.set(c,off);off+=c.length;}
      }catch(error){this.stop();throw new Error('手势模型下载失败，请检查网络后重试');}
      if(run!==this.generation)return false;
      this.onStatus('loading','正在准备手势识别…');
      const withTimeout=(promise,ms,message)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))]);
      const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision');
      const fileset=await withTimeout(FilesetResolver.forVisionTasks(new URL('vendor/wasm',base).href),25000,'手势识别加载超时，请重试');
      const options={baseOptions:{modelAssetBuffer:model,delegate:'GPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6};
      let detector;
      try{detector=await withTimeout(HandLandmarker.createFromOptions(fileset,options),30000,'手势识别启动超时，请重试');}catch{options.baseOptions.delegate='CPU';detector=await withTimeout(HandLandmarker.createFromOptions(fileset,options),30000,'手势识别启动超时，请重试');}
      if(run!==this.generation){detector.close();return false;}
      this.detector=detector;this.active=true;this.lastTime=-1;this.lastDetection=0;this.noHandSince=0;
      this.connections=HandLandmarker.HAND_CONNECTIONS;
      this.stream.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(this.active){this.stop();this.onError(new Error('摄像头已断开，可以重新开启'));}}));
      this.onStatus('ready','将手掌完整放进镜头');
      this.loop=this.loop.bind(this);this.frame=requestAnimationFrame(this.loop);
      return true;
    }catch(error){this.stop();throw error;}
  }
  loop(time){
    if(!this.active)return;
    this.frame=requestAnimationFrame(this.loop);
    if(document.hidden||this.paused||time-this.lastDetection<80||this.video.readyState<2||this.video.currentTime===this.lastTime)return;
    this.lastDetection=time;this.lastTime=this.video.currentTime;
    try{
      const result=this.detector.detectForVideo(this.video,time);
      const landmarks=result.landmarks[0];this.draw(landmarks);
      if(!landmarks){this.stabilizer.update(null,time);if(!this.noHandSince)this.noHandSince=time;if(time-this.noHandSince>900)this.onStatus('ready','将手掌完整放进镜头');return;}
      this.noHandSince=0;
      const recognized=classifyGesture(result.worldLandmarks?.[0]||landmarks);
      const mode=this.stabilizer.update(recognized,time);
      if(mode)this.onMode(mode);
      const names={scatter:'张开手 · 打开一张照片',tree:'握拳 · 打开一张照片',heart:'捏合 · 打开一张照片'};
      this.onStatus('tracking',names[recognized]||'已找到你的手 · 试试张开手掌');
      const cx=(landmarks[0].x+landmarks[5].x+landmarks[17].x)/3;
      this.onRotation((.5-cx)*2);
    }catch(error){this.stop();this.onError(error);}
  }
  draw(landmarks){
    const w=this.video.videoWidth||480,h=this.video.videoHeight||360;
    if(this.overlay.width!==w||this.overlay.height!==h){this.overlay.width=w;this.overlay.height=h;}
    const ctx=this.overlay.getContext('2d');ctx.clearRect(0,0,w,h);if(!landmarks)return;
    ctx.strokeStyle='#edcf8fc0';ctx.lineWidth=2;
    for(const {start,end} of this.connections){ctx.beginPath();ctx.moveTo(landmarks[start].x*w,landmarks[start].y*h);ctx.lineTo(landmarks[end].x*w,landmarks[end].y*h);ctx.stroke();}
    ctx.fillStyle='#fff0b9';for(const l of landmarks){ctx.beginPath();ctx.arc(l.x*w,l.y*h,3,0,Math.PI*2);ctx.fill();}
  }
  stop(){
    this.generation++;this.active=false;cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
    this.video.pause();this.video.srcObject=null;
    this.detector?.close();this.detector=null;this.stabilizer.reset();
    this.overlay.getContext('2d').clearRect(0,0,this.overlay.width,this.overlay.height);
  }
}
