import './style.css';
import { animate, stagger } from 'animejs';
import { ChristmasTree } from './tree.js';
import { HandMagic } from './gestures.js';
import { ChristmasMusic } from './music.js';

const $=selector=>document.querySelector(selector);
const icons={
  sparkles:'<path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2Z"/><path d="m21 2 .7 2.3L24 5l-2.3.7L21 8l-.7-2.3L18 5l2.3-.7Z"/>',
  hand:'<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v8c0 4-2 6-6 6h-1c-2 0-3.2-.8-4.5-2.5l-4.8-6.1c-1.3-1.8 1-3.6 2.4-2.2L9 14"/>',
  fist:'<path d="M7 10V7a2 2 0 0 1 4 0v3-5a2 2 0 0 1 4 0v5-4a2 2 0 0 1 4 0v5-2a1.5 1.5 0 0 1 3 0v7c0 4-2 6-6 6h-3c-4 0-6-2-7-5l-1.5-4.2C4 10.8 6.5 9.7 8 11l4 3"/><path d="M11 9v2m4-2v2m4-2v2"/>',
  pinch:'<path d="M8 15 6 11a2 2 0 0 1 3-2l3 3 3-4c1.5-2 4 0 2.5 2L15 14l1.5-1a1.8 1.8 0 0 1 2.7 2c2-1 3.3 1 2 3l-2 3H11l-3-6Z"/><path d="m7 4-.8-2M3 7 1 6m10-2 1-2"/>',
  envelope:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  pen:'<path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-4-4L5 15l-1 5Z"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  'sound-off':'<path d="m10 4-5 4H2v8h3l5 4V4Zm5 5 6 6m0-6-6 6"/>',
  sound:'<path d="m10 4-5 4H2v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
};
function icon(name){return `<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.sparkles}</svg>`;}
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});

const defaults={name:'小雨宝宝',message:'我爱你',signature:'永远爱你的我',letter:'今年的圣诞节，想送你一点不一样的浪漫。\n\n于是，我把想念变成粒子，把喜欢挂满树梢，把每一句「我爱你」都藏进了星光里。\n\n张开手，是我想给你的整个星空；\n轻轻握拳，是想把所有美好都留在你身边；\n指尖相触的那一刻，是我的心在说——\n\n小雨宝宝，我爱你。\n不只在圣诞节，也在每一个平凡的日子。'};
let personal={...defaults};
try{const saved=JSON.parse(localStorage.getItem('starlit-christmas-v1')||'null');if(saved){for(const k of Object.keys(defaults)){if(typeof saved[k]==='string'&&saved[k].trim())personal[k]=saved[k].slice(0,k==='letter'?1200:k==='message'?32:k==='signature'?24:20);}}}catch{}
function renderPersonal(){
  $('#recipient').textContent=personal.name;$('#love-recipient').textContent=personal.name;$('#love-message').textContent=personal.message;$('#letter-recipient').textContent=personal.name;$('#letter-content').textContent=personal.letter;$('#letter-signature').textContent=personal.signature;
  document.title=`星光予你 · 给${personal.name}的圣诞树`;
}
renderPersonal();
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}

let graphicsOkay=true;
const tree=new ChristmasTree($('#tree-canvas'),{onReady:()=>{$('#scene-loading').classList.add('loaded');},onError:()=>{graphicsOkay=false;$('#scene-loading').hidden=true;$('#graphics-fallback').hidden=false;document.querySelectorAll('.gesture-button,#save-card,#camera-toggle,.theme-swatch').forEach(b=>b.disabled=true);}});
const music=new ChristmasMusic();
let mode='tree';
function setMode(next,fromGesture=false){
  if(!graphicsOkay)return;
  mode=next;tree.setMode(next);music.sparkle(next);
  document.querySelectorAll('.gesture-button').forEach(b=>{const active=b.dataset.mode===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('#love-reveal').classList.toggle('visible',next==='heart');
  const captions={tree:'每一颗星光，都在说爱你',scatter:'一抬手，就把整个星空送给你',heart:'我的心意，此刻为你闪耀'};
  $('#scene-caption').textContent=captions[next];
  if(!fromGesture)tree.burst();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{
  tree.setTheme(b.dataset.theme);tree.burst();
  document.querySelectorAll('[data-theme]').forEach(s=>{s.classList.toggle('selected',s===b);s.setAttribute('aria-pressed',String(s===b));});
}));
document.addEventListener('keydown',e=>{
  if(e.altKey||e.metaKey||e.ctrlKey||e.repeat||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(['1','2','3'].includes(e.key)){e.preventDefault();setMode({1:'scatter',2:'tree',3:'heart'}[e.key]);}
  if(e.code==='Space'&&e.target===$('#tree-canvas')){e.preventDefault();setMode(mode==='tree'?'scatter':'tree');}
});

function openDialog(selector){$(selector).showModal();}
['#letter-button','#fallback-letter'].forEach(s=>$(s).addEventListener('click',()=>openDialog('#letter-dialog')));
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
});
$('#customize-button').addEventListener('click',()=>{for(const key of Object.keys(personal))$(`#${key==='name'?'name':key==='message'?'message':key==='letter'?'letter':'signature'}-input`).value=personal[key];openDialog('#customize-dialog');});
$('#customize-form').addEventListener('submit',e=>{
  e.preventDefault();const form=new FormData(e.target);const next={};
  for(const key of Object.keys(defaults)){next[key]=String(form.get(key)||'').trim();if(!next[key]){toast('还差一点点，把这份心意写完整吧');return;}}
  personal=next;renderPersonal();let stored=true;
  try{localStorage.setItem('starlit-christmas-v1',JSON.stringify(personal));}catch{stored=false;}
  $('#customize-dialog').close();setMode('heart');toast(stored?'心意已藏进星光，保存在这台设备上':'心意已更新；当前浏览器无法保存，刷新后会恢复');
});

$('#sound-toggle').addEventListener('click',async()=>{
  const button=$('#sound-toggle');button.disabled=true;
  try{const enabled=await music.toggle();button.innerHTML=icon(enabled?'sound':'sound-off');button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'关闭圣诞音乐':'开启圣诞音乐');button.title=enabled?'关闭圣诞音乐':'开启圣诞音乐';}catch(e){toast(e.message||'音乐暂时无法播放，请再试一次');}finally{button.disabled=false;}
});

let starting=false;
const errorMessage=error=>{
  if(error.name==='NotAllowedError')return '摄像头权限未开启；仍可点击下方按钮体验魔法';
  if(error.name==='NotFoundError')return '没有找到摄像头；试试下方的互动按钮';
  if(error.name==='NotReadableError')return '摄像头正被其他应用使用，请关闭后重试';
  if(error.name==='OverconstrainedError')return '摄像头不支持当前设置，请换个浏览器试试';
  if(error.message?.includes('HTTPS'))return error.message;
  return '手势识别暂时无法开启，请重试或点击下方按钮';
};
const hand=new HandMagic({video:$('#webcam'),overlay:$('#hand-overlay'),onMode:next=>setMode(next,true),onRotation:value=>tree.setHandRotation(value),onStatus:(state,text)=>{
  $('#tracking-label').textContent=text;
  $('#camera-preview').hidden=false;
  $('#camera-status').textContent=state==='loading'?text:'手势魔法已开启 · 移动手掌也能旋转圣诞树';
  $('#camera-status').className='camera-status ready';
},onError:error=>{resetCameraUI();$('#camera-status').textContent=errorMessage(error);$('#camera-status').className='camera-status error';}});
function resetCameraUI(){
  $('#camera-preview').hidden=true;$('#camera-label').textContent='开启手势魔法';$('#camera-toggle').setAttribute('aria-pressed','false');$('#camera-toggle').disabled=false;
  $('#camera-status').textContent='允许使用摄像头，魔法就会发生';$('#camera-status').className='camera-status';starting=false;
}
function stopCamera(){hand.stop();resetCameraUI();}
$('#camera-toggle').setAttribute('aria-pressed','false');
$('#camera-toggle').addEventListener('click',async()=>{
  if(hand.active){stopCamera();return;}
  if(starting)return;starting=true;
  $('#camera-toggle').disabled=true;$('#camera-label').textContent='正在准备魔法';$('#camera-status').textContent='请允许浏览器使用摄像头';$('#camera-status').className='camera-status';
  try{if(await hand.start()){$('#camera-label').textContent='关闭手势魔法';$('#camera-toggle').setAttribute('aria-pressed','true');}}catch(error){resetCameraUI();$('#camera-status').textContent=errorMessage(error);$('#camera-status').className='camera-status error';}finally{starting=false;$('#camera-toggle').disabled=false;}
});
$('#close-camera').addEventListener('click',stopCamera);
window.addEventListener('pagehide',()=>{stopCamera();music.stop();});

function drawFitted(ctx,text,maxWidth,fontSize,fontFamily){let size=fontSize;while(size>18){ctx.font=`${size}px ${fontFamily}`;if(ctx.measureText(text).width<=maxWidth)break;size-=2;}ctx.fillText(text,700,0);}
$('#save-card').addEventListener('click',async()=>{
  const button=$('#save-card');button.disabled=true;
  try{
    await document.fonts.ready;const image=new Image();image.src=await tree.snapshot();await image.decode();
    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1700;const ctx=canvas.getContext('2d');
    const bg=ctx.createRadialGradient(700,750,60,700,750,1100);bg.addColorStop(0,'#193923');bg.addColorStop(1,'#06140d');ctx.fillStyle=bg;ctx.fillRect(0,0,1400,1700);
    const sceneLayer=document.createElement('canvas');sceneLayer.width=image.width;sceneLayer.height=image.height;
    const layer=sceneLayer.getContext('2d');layer.drawImage(image,0,0);layer.globalCompositeOperation='destination-in';
    const fade=layer.createLinearGradient(0,0,0,image.height);fade.addColorStop(0,'transparent');fade.addColorStop(.08,'#000');fade.addColorStop(.92,'#000');fade.addColorStop(1,'transparent');layer.fillStyle=fade;layer.fillRect(0,0,image.width,image.height);
    const scale=Math.min(1400/image.width,1080/image.height),width=image.width*scale,height=image.height*scale;
    ctx.globalCompositeOperation='screen';ctx.drawImage(sceneLayer,(1400-width)/2,295+(1080-height)/2,width,height);ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='#b5a37866';ctx.lineWidth=1;ctx.strokeRect(65,65,1270,1570);ctx.textAlign='center';ctx.fillStyle='#c5b68e';ctx.font='22px Arial';ctx.fillText('A LITTLE CHRISTMAS MAGIC',700,145);
    ctx.save();ctx.translate(0,240);ctx.fillStyle='#e7d3b1';drawFitted(ctx,`To ${personal.name}`,1140,50,'"Songti SC", serif');ctx.restore();
    if(mode==='heart'){ctx.save();ctx.translate(0,840);ctx.fillStyle='#f0d3c4';drawFitted(ctx,personal.message,740,59,'"Songti SC", serif');ctx.restore();}
    ctx.save();ctx.translate(0,1440);ctx.fillStyle='#ead5af';drawFitted(ctx,personal.message,1100,60,'"Songti SC", serif');ctx.restore();
    ctx.font='25px "Songti SC", serif';ctx.fillStyle='#aaba9f';ctx.fillText('愿往后的每个圣诞，都有你在身边。',700,1510);ctx.font='19px Arial';ctx.fillStyle='#aa9d79';ctx.fillText('CHRISTMAS 2026 · WITH ALL MY LOVE',700,1590);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('图片生成失败');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`星光予你-${personal.name.replace(/[\\/:*?"<>|]/g,'')}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('这份星光，已经替你珍藏成图片');
  }catch(e){console.error(e);toast('图片暂时无法保存，请再试一次');}finally{button.disabled=false;}
});

if(!matchMedia('(prefers-reduced-motion: reduce)').matches){animate('.introduction > *',{opacity:[0,1],translateY:[16,0],delay:stagger(95,{start:180}),duration:1100,ease:'outExpo'});}
