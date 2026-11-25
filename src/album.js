export class PhotoDeck {
  constructor(random = Math.random) { this.random = random; this.items = []; this.bag = []; this.history = []; this.cursor = -1; }
  set(items) { this.items = [...items]; this.bag = []; this.history = []; this.cursor = -1; }
  next() {
    if (!this.items.length) return null;
    if (this.cursor < this.history.length - 1) return this.history[++this.cursor];
    if (!this.bag.length) {
      this.bag = [...this.items];
      for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; }
      const last = this.history[this.cursor];
      if (this.bag.length > 1 && this.bag[this.bag.length - 1].id === last?.id) [this.bag[0], this.bag[this.bag.length - 1]] = [this.bag[this.bag.length - 1], this.bag[0]];
    }
    const item = this.bag.pop(); this.history.push(item); this.cursor++;
    if (this.history.length > 1000) { this.history.shift(); this.cursor--; }
    return item;
  }
  previous() { if (this.cursor > 0) return this.history[--this.cursor]; return this.history[0] || this.next(); }
}

const MAX_PHOTOS = 300;
function database() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('照片无法保存在当前浏览器'));
    const request = indexedDB.open('starlit-christmas-photos', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('photos')) request.result.createObjectStore('photos', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭其他圣诞树页面后再试'));
  });
}
function transact(db, mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', mode); const result = callback(tx.objectStore('photos'));
    tx.oncomplete = () => resolve(result?.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('照片没有保存成功'));
  });
}
function blobFromCanvas(canvas, type, quality) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法处理这张照片')), type, quality)); }
async function preparePhoto(file) {
  if (!file.type.startsWith('image/') || file.size > 45 * 1024 * 1024) throw new Error('格式或大小不支持');
  let image;
  try { image = await createImageBitmap(file); }
  catch { const url = URL.createObjectURL(file); try { image = new Image(); image.src = url; await image.decode(); } finally { URL.revokeObjectURL(url); } }
  try {
    const factor = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * factor)); canvas.height = Math.max(1, Math.round(image.height * factor));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await blobFromCanvas(canvas, 'image/jpeg', .86);
    const thumbCanvas = document.createElement('canvas'); thumbCanvas.width = 240; thumbCanvas.height = 300;
    const t = thumbCanvas.getContext('2d'), scale = Math.max(240 / canvas.width, 300 / canvas.height);
    t.fillStyle = '#fff'; t.fillRect(0, 0, 240, 300); t.drawImage(canvas, (240 - canvas.width * scale) / 2, (300 - canvas.height * scale) / 2, canvas.width * scale, canvas.height * scale);
    const thumb = await blobFromCanvas(thumbCanvas, 'image/jpeg', .8);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
    return { id: `local-${Array.from(hash.slice(0, 12), b => b.toString(16).padStart(2, '0')).join('')}`, name: file.name, width: canvas.width, height: canvas.height, blob, thumb, added: Date.now() };
  } finally { image.close?.(); }
}

export class PhotoAlbum {
  constructor(onChange) { this.onChange = onChange; this.bundled = []; this.local = []; this.urls = new Map(); this.deck = new PhotoDeck(); this.persisted = true; }
  get items() { return [...this.bundled, ...this.local]; }
  async load() {
    const base = new URL(import.meta.env.BASE_URL, document.baseURI);
    const settled = await Promise.allSettled([
      fetch(new URL('photos/manifest.json', base)).then(r => { if (!r.ok) throw new Error('相册清单加载失败'); return r.json(); }),
      database().then(async db => { this.db = db; return await transact(db, 'readonly', s => s.getAll()); }),
    ]);
    if (settled[0].status === 'fulfilled') {
      const rows = settled[0].value.photos;
      if (Array.isArray(rows)) this.bundled = rows.slice(0, MAX_PHOTOS).filter(p => p && typeof p.src === 'string').map((p, i) => ({ ...p, id: `bundled-${p.id || i}`, name: p.caption || '', src: new URL(p.src, new URL('photos/', base)).href, thumbSrc: new URL(p.thumb || p.src, new URL('photos/', base)).href }));
    }
    if (settled[1].status === 'fulfilled') this.local = (settled[1].value || []).filter(p => p.blob instanceof Blob).sort((a, b) => a.added - b.added);
    else this.persisted = false;
    this.changed();
    return { manifestLoaded: settled[0].status === 'fulfilled', persisted: this.persisted };
  }
  changed() { this.deck.set(this.items); this.onChange?.(this.items); }
  getURL(photo, thumb = false) {
    if (photo.src) return thumb ? photo.thumbSrc || photo.src : photo.src;
    const key = `${photo.id}-${thumb}`;
    if (!this.urls.has(key)) this.urls.set(key, URL.createObjectURL(thumb ? photo.thumb || photo.blob : photo.blob));
    return this.urls.get(key);
  }
  async import(files, onProgress) {
    if (this.importing) throw new Error('上一批照片还在准备中');
    this.importing = true;
    try {
      const remaining = MAX_PHOTOS - this.items.length;
      if (remaining <= 0) throw new Error(`这棵树已经放了 ${MAX_PHOTOS} 张照片`);
      const incoming = [...files].filter(f => f.type.startsWith('image/')).slice(0, remaining), known = new Set(this.items.map(p => p.id)), rows = [];
      let failed = 0, duplicate = 0;
      for (let i = 0; i < incoming.length; i++) {
        try { const photo = await preparePhoto(incoming[i]); if (known.has(photo.id)) duplicate++; else { rows.push(photo); known.add(photo.id); } } catch (error) { failed++; if (failed === 1) console.warn('Photo could not be prepared:', error.message); }
        onProgress?.(i + 1, incoming.length);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (rows.length) {
        try { this.db ||= await database(); await transact(this.db, 'readwrite', s => { rows.forEach(row => s.put(row)); }); this.persisted = true; } catch { this.persisted = false; }
        this.local.push(...rows); this.changed();
      }
      return { added: rows.length, failed, duplicate, persisted: this.persisted, limited: files.length > incoming.length };
    } finally { this.importing = false; }
  }
  async clearImported() {
    if (this.importing) throw new Error('照片还在准备中，稍后再移除');
    if (this.db) await transact(this.db, 'readwrite', s => s.clear());
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear(); this.local = []; this.changed();
  }
  dispose() { for (const url of this.urls.values()) URL.revokeObjectURL(url); this.urls.clear(); this.db?.close(); }
}
