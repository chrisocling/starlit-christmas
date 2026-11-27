import './style.css';
import { ChristmasTree } from './tree.js';
import { PhotoAlbum } from './album.js';
import { HandMagic } from './gestures.js';
import { ChristmasMusic } from './music.js';

const $ = selector => document.querySelector(selector);
let tree, hand, graphicsOkay = true, toastTimer, cameraAction = 0, starting = false, cameraAutoTried = false, lastPhoto = -Infinity, monitorFrame;
const music = new ChristmasMusic();
function toast(message, duration = 3800) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), duration); }
function showSettings() { if (!$('#settings').open) $('#settings').showModal(); }
function hideSettings() { $('#settings').close(); }

const album = new PhotoAlbum(photos => {
  $('#photo-count').textContent = photos.length ? `${photos.length} 张回忆` : '还没有放入照片';
  $('#empty-album').hidden = photos.length > 0; $('#try-photo').disabled = !photos.length || !graphicsOkay; $('#clear-photos').disabled = !album.local.length;
  const grid = $('#photo-grid'); grid.replaceChildren();
  photos.forEach((photo, i) => { const img = document.createElement('img'); img.src = album.getURL(photo, true); img.alt = `我们的第 ${i + 1} 张回忆`; img.loading = 'lazy'; grid.append(img); });
  if (graphicsOkay) tree?.setPhotos(photos, (photo, thumb) => album.getURL(photo, thumb));
});

tree = new ChristmasTree($('#tree-canvas'), {
  onReady() {
    $('#loading').classList.add('ready');
    // Gesture assets are ~10MB; warm the cache while the intro plays.
    setTimeout(() => { if (graphicsOkay) hand.prefetch(); }, 1200);
    // Gestures are the main interaction: request the camera once the intro has settled.
    setTimeout(() => { if (!cameraAutoTried && graphicsOkay && !hand.active && !starting) { cameraAutoTried = true; toggleCamera(); } }, 7600);
  },
  onError() { graphicsOkay = false; $('#loading').hidden = true; $('#graphics-fallback').hidden = false; $('#camera-toggle').disabled = true; $('#try-photo').disabled = true; hand?.stop(); },
  onStarPosition(x, y, visible) { const star = $('#star-control'); star.style.left = `${x}px`; star.style.top = `${y}px`; star.hidden = !visible; },
  onSettings: showSettings,
  onNext: () => nextPhoto(),
});
if (import.meta.env.DEV) window.tree = tree;

async function nextPhoto(previous = false) {
  if (!graphicsOkay || album.importing || performance.now() - lastPhoto < 550) return;
  lastPhoto = performance.now(); tree.burst();
  const photo = previous ? album.deck.previous() : album.deck.next();
  if (!photo) { toast('照片还没放进来，点树顶星星添加'); return; }
  hideSettings();
  try { await tree.showPhoto(photo, album.getURL(photo)); music.sparkle('heart'); }
  catch { toast('这张照片暂时打不开，换一张试试'); }
}

$('#star-control').addEventListener('click', showSettings);
$('#close-settings').addEventListener('click', hideSettings);
$('#settings').addEventListener('click', e => { if (e.target !== $('#settings')) return; const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) hideSettings(); });
$('#settings').addEventListener('close', () => { cancelAnimationFrame(monitorFrame); monitorFrame = null; });
$('#try-photo').addEventListener('click', () => nextPhoto());
$('#import-photos').addEventListener('click', () => $('#photo-input').click());

async function importPhotos(files) {
  if (!files.length) return;
  showSettings(); $('#import-photos').disabled = true; $('#clear-photos').disabled = true;
  tree.setImporting(true); hand.paused = true;
  try {
    const result = await album.import(files, (done, total) => { $('#album-status').textContent = `正在把回忆挂上树 · ${done} / ${total}`; });
    let message = result.added ? `${result.added} 张照片已经挂上树` : '没有新增照片';
    if (result.duplicate) message += `，跳过 ${result.duplicate} 张重复照片`;
    if (result.failed) message += `，${result.failed} 张格式暂不支持`;
    if (result.limited) message += '（最多可放入 300 张）';
    $('#album-status').textContent = result.persisted ? '照片已保存在当前浏览器；发链接不会自动分享本机照片。' : '当前浏览器无法保存照片，刷新后需要重新放入。';
    toast(message, 5000);
  } catch (error) { toast(error.message || '这次没放好照片，请再试一次'); $('#album-status').textContent = '自己导入的照片保存在当前浏览器，不会上传。'; }
  finally { tree.setImporting(false); hand.paused = false; $('#import-photos').disabled = false; $('#clear-photos').disabled = !album.local.length; $('#photo-input').value = ''; }
}
$('#photo-input').addEventListener('change', e => importPhotos([...e.target.files]));
window.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
window.addEventListener('drop', e => { if (e.dataTransfer?.files.length) { e.preventDefault(); importPhotos([...e.dataTransfer.files]); } });
$('#clear-photos').addEventListener('click', async () => {
  try { tree.closePhoto(true); await album.clearImported(); $('#album-status').textContent = '本机导入的照片已移除，原始照片不会受影响。'; toast('本机照片已从树上取下'); } catch (error) { toast(error.message || '暂时无法移除，请稍后重试'); }
});

const errorMessage = error => {
  if (error.name === 'NotAllowedError') return '摄像头权限未开启，也可以双击或按空格放出照片';
  if (error.name === 'NotFoundError') return '没有找到摄像头，也可以双击或按空格放出照片';
  if (error.name === 'NotReadableError') return '摄像头正被其他应用使用，请关闭后重试';
  if (error.message?.includes('HTTPS')) return error.message;
  return '手势识别暂时无法开启，请重试或使用空格键';
};
function cameraUI(active, status) { $('#camera-toggle').setAttribute('aria-checked', String(active)); $('#camera-toggle').setAttribute('aria-label', active ? '关闭摄像头手势' : '开启摄像头手势'); $('#camera-status').textContent = status || (active ? '已开启 · 做个手势，照片就会飞出来' : '张开手、握拳、捏合，都能放出照片'); }
function stopCamera() { cameraAction++; hand?.stop(); starting = false; $('#camera-toggle').disabled = !graphicsOkay; cameraUI(false); $('#tracking-status').textContent = '摄像头未开启'; }
hand = new HandMagic({ video: $('#webcam'), overlay: $('#hand-overlay'),
  onMode: () => { if (!$('#settings').open) nextPhoto(); }, onRotation: value => tree.setHandRotation(value),
  onStatus: (state, text) => { $('#tracking-status').textContent = text; if (state === 'loading') $('#camera-status').textContent = text; },
  onError: error => { stopCamera(); const message = errorMessage(error); $('#camera-status').textContent = message; toast(message); },
});
async function toggleCamera() {
  if (hand.active) { stopCamera(); return; }
  if (starting || !graphicsOkay) return;
  const action = ++cameraAction; starting = true; $('#camera-toggle').disabled = true; $('#camera-status').textContent = '请允许浏览器使用摄像头…';
  try {
    const active = await hand.start(); if (action !== cameraAction) return;
    if (active) { cameraUI(true); hideSettings(); toast(album.items.length ? '手势已开启，把手掌放进镜头试试' : '手势已开启，放入照片后就能唤出回忆'); }
  } catch (error) { if (action === cameraAction) { cameraUI(false, errorMessage(error)); toast(errorMessage(error)); } }
  finally { if (action === cameraAction) { starting = false; $('#camera-toggle').disabled = !graphicsOkay; } }
}
$('#camera-toggle').addEventListener('click', toggleCamera);

function monitor() {
  monitorFrame = null;
  if (!$('#settings').open || !$('.camera-details').open) return;
  const canvas = $('#camera-monitor'), video = $('#webcam');
  if (video.readyState >= 2 && hand.active) { if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; } const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0); ctx.drawImage($('#hand-overlay'), 0, 0, canvas.width, canvas.height); }
  monitorFrame = requestAnimationFrame(monitor);
}
$('.camera-details').addEventListener('toggle', () => { cancelAnimationFrame(monitorFrame); monitor(); });
$('#star-control').addEventListener('click', () => { if ($('.camera-details').open) monitor(); });
async function toggleMusic() { const button = $('#music-toggle'); button.disabled = true; try { const enabled = await music.toggle(); button.setAttribute('aria-checked', String(enabled)); button.setAttribute('aria-label', enabled ? '关闭圣诞音乐' : '开启圣诞音乐'); } catch (error) { toast(error.message || '音乐暂时无法播放'); } finally { button.disabled = false; } }
$('#music-toggle').addEventListener('click', toggleMusic);
$('#fullscreen-toggle').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('可以用浏览器的全屏功能沉浸观看'); } catch { toast('当前浏览器暂时无法进入全屏'); } });
document.addEventListener('fullscreenchange', () => { $('#fullscreen-toggle').textContent = document.fullscreenElement ? '退出全屏' : '进入全屏'; });
$('#share-link').addEventListener('click', async () => {
  const url = location.origin + location.pathname;
  try { await navigator.clipboard.writeText(url); toast('分享链接已复制，发给想一起看的人吧'); }
  catch { toast(`复制失败，链接是 ${url}`, 6000); }
});

document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if ($('#settings').open) return;
  if (e.code === 'Space' || e.key === 'ArrowRight' || ['1', '2', '3'].includes(e.key)) { e.preventDefault(); nextPhoto(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); nextPhoto(true); }
  else if (e.key === 'Escape') { if (tree.activePhoto) tree.closePhoto(); else showSettings(); }
  else if (e.key.toLowerCase() === 'p') $('#photo-input').click();
  else if (e.key.toLowerCase() === 'g') toggleCamera();
  else if (e.key.toLowerCase() === 'm') toggleMusic();
});
window.addEventListener('pagehide', e => { stopCamera(); music.stop(); $('#music-toggle').setAttribute('aria-checked', 'false'); if (!e.persisted) album.dispose(); });
album.load().then(result => { if (!result.manifestLoaded) toast('相册清单暂时没加载好，刷新后再试；也可自行导入照片'); });
