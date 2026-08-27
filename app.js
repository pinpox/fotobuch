// Photobook builder — fully static edition.
// Photos live in the browser (OPFS), state in localStorage, typst
// compiles to PDF in-browser via WASM (typst.ts), and "download bundle"
// produces a zip you can compile yourself with the typst CLI.

const $ = (s) => document.querySelector(s);
const setStatus = (t) => { $('#status').textContent = t; };

// ── geometry (all in cm) ─────────────────────────────────────
// bleed/inner come from layouts.typ; the trim size comes from the
// selected print format and is patched into layouts.typ for compiling.
const FORMATS = {
  wide: { w: 18.7, h: 10.5, label: '16:9 \u2014 18.7 \u00d7 10.5 cm' },
  a5l:  { w: 21.0, h: 14.8, label: 'A5 landscape \u2014 21 \u00d7 14.8 cm' },
  a5p:  { w: 14.8, h: 21.0, label: 'A5 portrait \u2014 14.8 \u00d7 21 cm' },
};
let layoutsSrc = '';                       // template text, reused by compile/bundle
let trimW, trimH, bleed, inner, pageW, pageH, m;
const safety = 0.3; // Sicherheitsabstand, measured inward from the trim edge
const r = (x, y, w, h, framed=false) => ({ x, y, w, h, framed });
let LAYOUTS = {};

function initGeometry(src) {
  layoutsSrc = src;
  const cm = (name) => {
    const m = src.match(new RegExp(`#let ${name}\\s*=\\s*([\\d.]+)(cm|mm)`));
    if (!m) throw new Error(`cannot find ${name} in layouts.typ`);
    return parseFloat(m[1]) * (m[2] === 'mm' ? 0.1 : 1);
  };
  bleed = cm('bleed'); inner = cm('inner');
}

// apply the book's print format: recompute geometry, layouts, palette
function applyFormat() {
  const f = FORMATS[state.format] || FORMATS.wide;
  trimW = f.w; trimH = f.h;
  pageW = trimW + 2*bleed; pageH = trimH + 2*bleed; m = bleed + inner;
  LAYOUTS = buildLayouts();
  $('#palette').innerHTML = '';
  buildPalette();
  const sel = $('#fmtSel');
  if (sel.value !== (state.format || 'wide')) sel.value = state.format || 'wide';
}

// layouts.typ with the selected trim size patched in
const patchedLayouts = () => layoutsSrc
  .replace(/#let trim-w\s*=\s*[\d.]+cm/, `#let trim-w = ${trimW}cm`)
  .replace(/#let trim-h\s*=\s*[\d.]+cm/, `#let trim-h = ${trimH}cm`);

const buildLayouts = () => ({
  full: { slots: [r(0, 0, pageW, pageH)] },
  grid4: { slots: (() => { const g=.2, cw=(pageW-g)/2, ch=(pageH-g)/2;
    return [r(0,0,cw,ch), r(cw+g,0,cw,ch), r(0,ch+g,cw,ch), r(cw+g,ch+g,cw,ch)]; })() },
  half: { caption: true, slots: (() => { const w=trimW/2;
    return [r(m, m, w, w*9/16)]; })() },
  duo: { caption: true, slots: (() => { const g=.4, w=(trimW-2*inner-g)/2, h=w*9/16;
    const x0=(pageW-(2*w+g))/2, y=(pageH-h)/2;
    return [r(x0,y,w,h), r(x0+w+g,y,w,h)]; })() },
  'duo-portrait': { uncropped: true, slots: (() => {
    const g=.8, h=trimH-2*0.4, w=h*3/4; // 4mm border; real width follows the photo
    const x0=(pageW-(2*w+g))/2, y=(pageH-h)/2;
    return [r(x0,y,w,h), r(x0+w+g,y,w,h)]; })() },
  'solo-portrait': { uncropped: true, slots: (() => {
    const h=trimH-2*0.4, w=h*3/4; // 4mm border; real width follows the photo
    return [r((pageW-w)/2, (pageH-h)/2, w, h)]; })() },
  'big-small': { slots: (() => { const bw=pageW*.66, sw=4.4, sh=sw*9/16;
    return [r(0,0,bw,bw*9/16), r(pageW-m-sw, pageH-m-sh, sw, sh)]; })() },
  mat: { caption: true, slots: (() => { const w=13, h=w*9/16;
    return [r((pageW-w)/2, bleed+1.1, w, h)]; })() },
  pano: { spread: true, slots: [r(0, 0, 2*pageW, pageH)] },
  'pano-trio': { spread: true, slots: (() => { const g=.2, pw=7, sw=2*pageW;
    return [r(0,0,pw,pageH), r(pw+g,0,sw-2*pw-2*g,pageH), r(sw-pw,0,pw,pageH)]; })() },
  blank: { slots: [] },
  stagger: { slots: (() => { const w=7.4, h=w*9/16;
    return [r(m,m,w,h), r(pageW-m-w, pageH-m-h, w, h)]; })() },
  bands: { slots: (() => { const g=.2, h=(pageH-g)/2;
    return [r(0,0,pageW,h), r(0,h+g,pageW,h)]; })() },
  bands3: { slots: (() => { const g=.2, h=(pageH-2*g)/3;
    return [0,1,2].map(i => r(0, i*(h+g), pageW, h)); })() },
  'bands-portrait': { slots: (() => { const g=.2, pw=pageH*2/3, lw=pageW-pw-g, bh=(pageH-g)/2;
    return [r(0,0,lw,bh), r(0,bh+g,lw,bh), r(lw+g,0,pw,pageH)]; })() },
  split: { slots: (() => { const g=.2, w=(pageW-g)/2;
    return [r(0,0,w,pageH), r(w+g,0,w,pageH)]; })() },
  triptych: { slots: (() => { const g=.2, w=(pageW-2*g)/3;
    return [0,1,2].map(i => r(i*(w+g), 0, w, pageH)); })() },
  row3: { caption: true, slots: (() => { const g=.5, w=(trimW-2*inner-2*g)/3, h=w*9/16;
    const x0=(pageW-(3*w+2*g))/2, y=(pageH-h)/2;
    return [0,1,2].map(i => r(x0+i*(w+g), y, w, h)); })() },
  inset: { slots: (() => { const sw=5.2, sh=sw*9/16, f=.2;
    return [r(0,0,pageW,pageH), r(pageW-m-f-sw, pageH-m-f-sh, sw, sh, true)]; })() },
  grid6: { slots: (() => { const g=.2, cw=(pageW-2*g)/3, ch=(pageH-g)/2;
    const out=[]; for (const y of [0, ch+g]) for (const x of [0, cw+g, 2*(cw+g)]) out.push(r(x,y,cw,ch));
    return out; })() },
});

const SCALE = 24; // px per cm on screen

// ── photo storage (OPFS) ─────────────────────────────────────
// files live in the origin-private file system; mtimes (for date sort,
// stable across rotation) live in localStorage.
let opfs;                 // root directory handle
let imagesMeta = [];      // [{name, mtime, size}]
let images = [];          // names, in current sort order
const urls = {};          // name -> object URL for <img> tags

const META_KEY = 'pb-mtimes';
const loadMtimes = () => JSON.parse(localStorage.getItem(META_KEY) || '{}');
const saveMtime = (name, mtime) => {
  const m = loadMtimes(); m[name] = mtime;
  localStorage.setItem(META_KEY, JSON.stringify(m));
};

async function loadImageIndex() {
  const mtimes = loadMtimes();
  imagesMeta = [];
  for await (const [name, handle] of opfs.entries()) {
    if (handle.kind !== 'file' || !/\.(jpe?g|png)$/i.test(name)) continue;
    const file = await handle.getFile();
    imagesMeta.push({ name, mtime: mtimes[name] ?? file.lastModified, size: file.size });
    if (urls[name]) URL.revokeObjectURL(urls[name]);
    urls[name] = URL.createObjectURL(file);
  }
}

async function importFiles(files) {
  let n = 0;
  for (const f of files) {
    if (!/\.(jpe?g|png)$/i.test(f.name)) continue;
    const handle = await opfs.getFileHandle(f.name, { create: true });
    const w = await handle.createWritable();
    await w.write(f);
    await w.close();
    saveMtime(f.name, f.lastModified);
    delete portrait[f.name];
    n++;
  }
  await loadImageIndex();
  applySort(); render();
  setStatus(`imported ${n} photo${n === 1 ? '' : 's'} (${imagesMeta.length} total)`);
}

async function getBytes(name) {
  const file = await (await opfs.getFileHandle(name)).getFile();
  return new Uint8Array(await file.arrayBuffer());
}

function applySort() {
  const mode = $('#sortSel').value;
  const sorted = [...imagesMeta];
  if (mode === 'date') sorted.sort((a, b) => a.mtime - b.mtime || a.name.localeCompare(b.name));
  else sorted.sort((a, b) => a.name.localeCompare(b.name));
  images = sorted.map(i => i.name);
}

// ── book state (localStorage) ────────────────────────────────
let state = { pages: [] };
let uid = 1;
let saveTimer;
const STATE_KEY = 'pb-state';
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, 300);
}
addEventListener('pagehide', () => { // flush pending save synchronously
  if (saveTimer == null) return;
  clearTimeout(saveTimer); saveTimer = null;
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
});

// ── typst export ─────────────────────────────────────────────
// slot entry -> typst arg; centered crop stays a plain path
function slotArg(s) {
  const z = s.zoom || 1;
  if ((s.fx === 50 && s.fy === 50 && z === 1) || !s.ar) return JSON.stringify(s.img);
  return `(path: ${JSON.stringify(s.img)}, fx: ${s.fx}%, fy: ${s.fy}%, ar: ${s.ar}` +
    (z !== 1 ? `, zoom: ${z})` : ')');
}

function toTypst() {
  const lines = ['#import "layouts.typ": *', '#show: book', ''];
  state.pages.forEach((pg, i) => {
    const def = LAYOUTS[pg.layout];
    if (pg.layout === 'blank') { lines.push('#blank()'); return; }
    if (pg.slots.some(s => !s)) {
      lines.push(`// page ${i+1}: #${pg.layout}(...) skipped — ${pg.slots.filter(s=>!s).length} empty slot(s)`);
      return;
    }
    const args = pg.slots.map(slotArg);
    if (def.caption && pg.caption?.trim())
      args.push(`caption: [${pg.caption.trim()}]`);
    lines.push(`#${pg.layout}(${args.join(', ')})`);
  });
  return lines.join('\n') + '\n';
}

const usedImages = () => {
  const set = new Set();
  for (const p of state.pages) for (const s of p.slots) if (s) set.add(s.img);
  return [...set];
};

// ── drag & drop ──────────────────────────────────────────────
// payload: { entry: {img, fx, fy}, from: {page, slot} | null }
let dragPayload = null;
function startDrag(e, entry, from = null) {
  dragPayload = { entry, from };
  e.dataTransfer.setData('text/plain', entry.img);
  e.dataTransfer.effectAllowed = 'move';
}
function dropInto(pi, si) {
  const p = dragPayload; dragPayload = null;
  if (!p) return;
  const dst = state.pages[pi];
  if (p.from) { // moving between slots -> swap (crop travels with the photo)
    const src = state.pages[p.from.page];
    src.slots[p.from.slot] = dst.slots[si];
  }
  dst.slots[si] = { ...p.entry };
  render(); save();
}

// ── rotation (canvas, EXIF gets baked in) ────────────────────
const portrait = {}; // img name -> true, from natural size

async function rotateImg(img, dir) {
  setStatus(`rotating ${img}\u2026`);
  try {
    const file = await (await opfs.getFileHandle(img)).getFile();
    const bmp = await createImageBitmap(file); // EXIF orientation applied
    const cv = document.createElement('canvas');
    cv.width = bmp.height; cv.height = bmp.width;
    const ctx = cv.getContext('2d');
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate((dir === 'ccw' ? -90 : 90) * Math.PI / 180);
    ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    bmp.close();
    const type = /\.png$/i.test(img) ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(res => cv.toBlob(res, type, 0.95));
    const handle = await opfs.getFileHandle(img, { create: true });
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
    // keep the original mtime so date sorting stays stable
    delete portrait[img];
    for (const p of state.pages) for (const s of p.slots)
      if (s && s.img === img) { s.fx = 50; s.fy = 50; s.ar = null; s.zoom = 1; }
    await loadImageIndex();
    applySort(); render(); save();
    setStatus(`rotated ${img}`);
  } catch (e) {
    setStatus(`rotate failed: ${e.message}`);
  }
}

// ── rendering ────────────────────────────────────────────────
function usedCounts() {
  const c = {};
  for (const p of state.pages) for (const s of p.slots) if (s) c[s.img] = (c[s.img]||0)+1;
  return c;
}

function renderTray() {
  const used = usedCounts();
  const tray = $('#tray');
  tray.innerHTML = '';
  if (!images.length) {
    tray.innerHTML = '<div class="hint">No photos yet — use \u201cimport photos\u201d above. ' +
      'Photos are stored in this browser only.</div>';
    return;
  }
  for (const img of images) {
    const d = document.createElement('div');
    d.className = 'thumb' + (used[img] ? ' used' : '') + (portrait[img] ? ' portrait' : '');
    d.draggable = true;
    d.title = img;
    d.innerHTML = `<img src="${urls[img]}" loading="lazy"><span class="n">${img}</span>` +
      `<span class="rots"><button title="rotate counter-clockwise">\u27f2</button>` +
      `<button title="rotate clockwise">\u27f3</button></span>` +
      (used[img] ? `<span class="badge">${used[img]}</span>` : '');
    const el = d.querySelector('img');
    el.addEventListener('load', () => {
      if (el.naturalHeight > el.naturalWidth && !portrait[img]) {
        portrait[img] = true;
        d.classList.add('portrait');
      }
    });
    const [ccw, cw] = d.querySelectorAll('.rots button');
    ccw.onclick = () => rotateImg(img, 'ccw');
    cw.onclick = () => rotateImg(img, 'cw');
    d.addEventListener('dragstart', (e) => startDrag(e, { img, fx: 50, fy: 50 }));
    tray.appendChild(d);
  }
}

function buildCard(pg, pi, def, phys) {
    const card = document.createElement('div');
    card.className = 'pagecard';

    const head = document.createElement('div');
    head.className = 'pagehead';
    const plabel = def.spread ? `p. ${phys}\u2013${phys+1}` : `p. ${phys}`;
    head.innerHTML = `<span>${plabel}</span> <span class="lname">#${pg.layout}</span>`;
    if (def.spread && phys % 2 === 1)
      head.innerHTML += ' <span class="warn">\u26a0 starts on a right page \u2014 insert a blank before</span>';
    for (const [label, fn] of [
      ['\u2191', () => { if (pi>0) { const t=state.pages[pi-1]; state.pages[pi-1]=pg; state.pages[pi]=t; } }],
      ['\u2193', () => { if (pi<state.pages.length-1) { const t=state.pages[pi+1]; state.pages[pi+1]=pg; state.pages[pi]=t; } }],
      ['\u00d7', () => state.pages.splice(pi, 1)],
    ]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => { fn(); render(); save(); };
      head.appendChild(b);
    }
    card.appendChild(head);

    const W = (def.spread ? 2*pageW : pageW) * SCALE, H = pageH * SCALE;
    const canvas = document.createElement('div');
    canvas.className = 'canvas' + (pg.layout === 'blank' ? ' blankpage' : '');
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    // print guides (wir-machen-druck): page edge = Datenformat (incl. 3mm
    // Beschnitt), red = Endformat (trim), green dashed = Sicherheitsabstand.
    // Spreads get one set per physical page — each page is trimmed on its own.
    const nPages = def.spread ? 2 : 1;
    for (let i = 0; i < nPages; i++) {
      for (const [cls, inset] of [['g-trim', bleed], ['g-safe', bleed + safety]]) {
        const g = document.createElement('div');
        g.className = `guide ${cls}`;
        g.style.cssText = `left:${(i*pageW + inset)*SCALE}px; top:${inset*SCALE}px;` +
          `width:${(pageW - 2*inset)*SCALE}px; height:${(pageH - 2*inset)*SCALE}px;`;
        g.title = cls === 'g-trim' ? 'Endformat (trim)' : 'Sicherheitsabstand (3mm)';
        canvas.appendChild(g);
      }
    }

    // gutter line for spreads
    if (def.spread) {
      const g = document.createElement('div');
      g.className = 'gutter';
      g.style.left = (W / 2) + 'px';
      canvas.appendChild(g);
    }

    def.slots.forEach((sl, si) => {
      const el = document.createElement('div');
      el.className = 'slot' + (sl.framed ? ' framed' : '');
      el.style.cssText = `left:${sl.x*SCALE}px; top:${sl.y*SCALE}px;` +
        `width:${sl.w*SCALE}px; height:${sl.h*SCALE}px;`;
      // filled uncropped slot: the photo's frame defines the footprint;
      // the area beside it is page background, not empty-slot hatching
      if (pg.slots[si] && def.uncropped) el.classList.add('bare');
      const s = pg.slots[si];
      if (s) {
        const title = `${s.img} — drag to reframe, shift+drag to zoom, double-click to reset`;
        const imgTag = `<img src="${urls[s.img] || ''}" draggable="false" title="${title}">`;
        el.innerHTML = (def.uncropped ? `<span class="uframe">${imgTag}</span>` : imgTag) +
          `<button class="mv" draggable="true" title="drag to another slot">\u283f</button>` +
          `<button class="rm" title="remove">\u00d7</button>`;
        const imgEl = el.querySelector('img');
        const frameEl = el.querySelector('.uframe');
        // frame = crop box. Fixed slot for cover layouts; for uncropped
        // layouts it takes the photo's own aspect at full slot height,
        // so zoom crops inside the photo's natural footprint.
        const frameSize = () => {
          const sh = el.clientHeight;
          if (!def.uncropped) return [el.clientWidth, sh];
          const fw = sh * imgEl.naturalWidth / imgEl.naturalHeight;
          return [fw, sh];
        };
        // explicit cover-crop sizing, mirrors ph()/phu() in layouts.typ
        const layoutImg = () => {
          const nw = imgEl.naturalWidth, nh = imgEl.naturalHeight;
          if (!nw) return;
          const [sw, sh] = frameSize();
          if (frameEl) {
            frameEl.style.width = sw + 'px';
            frameEl.style.left = (el.clientWidth - sw) / 2 + 'px';
          }
          const sc = Math.max(sw / nw, sh / nh) * (s.zoom || 1);
          const iw = nw * sc, ih = nh * sc;
          imgEl.style.cssText += `;position:absolute;width:${iw}px;height:${ih}px;` +
            `left:${-(iw - sw) * s.fx / 100}px;top:${-(ih - sh) * s.fy / 100}px;`;
        };
        imgEl.addEventListener('load', () => {
          layoutImg();
          // keep stored ar in sync with the actual pixels (files can be
          // rotated); set it lazily once framing is non-default
          const ar = +(imgEl.naturalWidth / imgEl.naturalHeight).toFixed(4);
          const nonDefault = s.fx !== 50 || s.fy !== 50 || (s.zoom || 1) !== 1;
          if ((s.ar && s.ar !== ar) || (!s.ar && nonDefault)) {
            s.ar = ar;
            save();
          }
        });
        if (imgEl.complete) layoutImg();
        // drag = pan the crop window, shift+drag = zoom (never below full coverage)
        imgEl.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 || !imgEl.naturalWidth) return;
          e.preventDefault();
          const zoomMode = e.shiftKey;
          const nw = imgEl.naturalWidth, nh = imgEl.naturalHeight;
          const [sw, sh] = frameSize();
          const x0 = e.clientX, y0 = e.clientY, fx0 = s.fx, fy0 = s.fy, z0 = s.zoom || 1;
          s.ar = +(nw / nh).toFixed(4);
          const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
          const move = (ev) => {
            if (zoomMode) {
              // drag right to zoom in; 1 = minimal cover crop
              s.zoom = +Math.min(4, Math.max(1, z0 * Math.exp((ev.clientX - x0) / 120))).toFixed(3);
            } else {
              const sc = Math.max(sw / nw, sh / nh) * (s.zoom || 1);
              const ox = nw * sc - sw, oy = nh * sc - sh;
              if (ox >= 1) s.fx = clamp(fx0 - (ev.clientX - x0) / ox * 100);
              if (oy >= 1) s.fy = clamp(fy0 - (ev.clientY - y0) / oy * 100);
            }
            layoutImg();
          };
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            save();
          };
          try { imgEl.setPointerCapture(e.pointerId); } catch {}
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        });
        imgEl.addEventListener('dblclick', () => {
          s.fx = 50; s.fy = 50; s.zoom = 1;
          layoutImg();
          save();
        });
        el.querySelector('.mv').addEventListener('dragstart',
          (e) => { e.stopPropagation(); startDrag(e, s, { page: pi, slot: si }); });
        el.querySelector('.rm').onclick = () => { pg.slots[si] = null; render(); save(); };
      }
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); dropInto(pi, si); });
      canvas.appendChild(el);
    });

    // drop on page background -> first empty slot
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const si = pg.slots.findIndex(s => !s);
      if (si >= 0) dropInto(pi, si); else dragPayload = null;
    });
    card.appendChild(canvas);

    if (def.caption) {
      const c = document.createElement('div');
      c.className = 'caption';
      c.innerHTML = `<input type="text" placeholder="caption (optional)">`;
      const inp = c.querySelector('input');
      inp.value = pg.caption || '';
      inp.addEventListener('input', () => { pg.caption = inp.value; save(); });
      card.appendChild(c);
    }
    return card;
}

function renderPages() {
  const cont = $('#pages');
  cont.innerHTML = '';
  let phys = 1;   // physical page number; even = left, odd = right
  let row = null; // open spread row waiting for its right page
  const newRow = () => {
    row = document.createElement('div');
    row.className = 'spread';
    cont.appendChild(row);
    return row;
  };
  const placeholder = () => {
    const d = document.createElement('div');
    d.className = 'placeholder';
    d.style.width = (pageW * SCALE) + 'px';
    d.style.height = (pageH * SCALE) + 'px';
    row.appendChild(d);
  };
  state.pages.forEach((pg, pi) => {
    const def = LAYOUTS[pg.layout];
    const card = buildCard(pg, pi, def, phys);
    if (def.spread) {
      if (row) { placeholder(); row = null; } // close a half-open spread
      newRow().appendChild(card);
      row = null;
      phys += 2;
    } else if (phys % 2 === 0) { // left page opens a spread
      newRow().appendChild(card);
      phys += 1;
    } else { // right page closes it
      if (!row) { newRow(); placeholder(); }
      row.appendChild(card);
      row = null;
      phys += 1;
    }
  });
}

function render() { renderTray(); renderPages(); }

// ── layout palette ───────────────────────────────────────────
// mini schematic: slot rects drawn to scale, spreads twice as wide
function layoutIcon(name, def) {
  const w = def.spread ? 2*pageW : pageW;
  const rects = def.slots.map(sl =>
    `<rect x="${sl.x}" y="${sl.y}" width="${sl.w}" height="${sl.h}" rx="0.25"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${pageH}"${def.spread ? ' style="width:116px"' : ''}>` +
    `<rect class="pg" x="0" y="0" width="${w}" height="${pageH}"/>${rects}</svg>`;
}

function buildPalette() {
  for (const [name, def] of Object.entries(LAYOUTS)) {
    const n = def.slots.length;
    const b = document.createElement('button');
    b.className = 'lbtn';
    b.title = `${name} — ${n} photo${n === 1 ? '' : 's'}${def.spread ? ', spans a spread' : ''}`;
    b.innerHTML = layoutIcon(name, def) + `<span>${name}</span>`;
    b.onclick = () => {
      state.pages.push({ id: uid++, layout: name, slots: def.slots.map(() => null), caption: '' });
      render(); save();
      $('#pages').lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    };
    $('#palette').appendChild(b);
  }
}

// ── zip writer (stored, no compression — JPEGs are incompressible) ──
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (bytes) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

// entries: [{name, bytes: Uint8Array}] -> zip Blob
function makeZip(entries) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const { name, bytes } of entries) {
    const nameB = enc.encode(name);
    const crc = crc32(bytes);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);            // version needed
    head.setUint32(14, crc, true);
    head.setUint32(18, bytes.length, true); // compressed (stored)
    head.setUint32(22, bytes.length, true); // uncompressed
    head.setUint16(26, nameB.length, true);
    parts.push(head.buffer, nameB, bytes);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true);
    c.setUint16(28, nameB.length, true);
    c.setUint32(42, offset, true);          // local header offset
    central.push(c.buffer, nameB);
    offset += 30 + nameB.length + bytes.length;
  }
  const centralSize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

const download = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── bundle: everything needed to compile with the typst CLI ──
const bundleReadme = () => `# Photobook bundle

Compile the book yourself with typst >= 0.12 (https://typst.app/open-source):

    typst compile main.typ book.pdf

- main.typ      the book: one layout call per page, in order
- layouts.typ   the page-layout template
- *.jpg/*.png   the photos, cropped/framed via parameters in main.typ
- book.json     builder state; "load backup" in the builder restores it

Print data: Endformat ${trimW} x ${trimH} cm, Datenformat ${pageW.toFixed(1)} x ${pageH.toFixed(1)} cm
(${bleed * 10} mm Beschnitt on every side), ${safety * 10} mm Sicherheitsabstand.
`;

async function makeBundle() {
  const enc = new TextEncoder();
  const used = usedImages();
  const missing = used.filter(n => !imagesMeta.some(i => i.name === n));
  if (missing.length) throw new Error(`missing photos: ${missing.join(', ')}`);
  const entries = [
    { name: 'main.typ', bytes: enc.encode(toTypst()) },
    { name: 'layouts.typ', bytes: enc.encode(patchedLayouts()) },
    { name: 'book.json', bytes: enc.encode(JSON.stringify(state, null, 1)) },
    { name: 'README.md', bytes: enc.encode(bundleReadme()) },
  ];
  for (const name of used) entries.push({ name, bytes: await getBytes(name) });
  return makeZip(entries);
}

// ── in-browser typst compilation (typst.ts, WASM) ────────────
const TYPST_CDN = 'https://cdn.jsdelivr.net/npm';
let typstPromise;
function loadTypst() {
  typstPromise ??= (async () => {
    const { $typst } = await import(
      `${TYPST_CDN}/@myriaddreamin/typst.ts@0.7.0/+esm`);
    $typst.setCompilerInitOptions({
      getModule: () =>
        `${TYPST_CDN}/@myriaddreamin/typst-ts-web-compiler@0.7.0/pkg/typst_ts_web_compiler_bg.wasm`,
    });
    return $typst;
  })();
  return typstPromise;
}

async function compilePdf() {
  setStatus('loading typst (WASM)\u2026');
  const $typst = await loadTypst();
  setStatus('preparing sources\u2026');
  await $typst.resetShadow();
  await $typst.addSource('/layouts.typ', patchedLayouts());
  const used = usedImages();
  for (let i = 0; i < used.length; i++) {
    setStatus(`loading photos ${i + 1}/${used.length}\u2026`);
    await $typst.mapShadow('/' + used[i], await getBytes(used[i]));
  }
  await $typst.addSource('/main.typ', toTypst());
  setStatus('compiling\u2026');
  const pdf = await $typst.pdf({ mainFilePath: '/main.typ' });
  if (!pdf) throw new Error('compilation failed (see browser console)');
  download(new Blob([pdf], { type: 'application/pdf' }), 'book.pdf');
  setStatus(`book.pdf \u2014 ${(pdf.length / 1e6).toFixed(1)} MB, ` +
    `${state.pages.reduce((a, p) => a + (LAYOUTS[p.layout].spread ? 2 : 1), 0)} pages`);
}

// ── toolbar ──────────────────────────────────────────────────
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').addEventListener('change', async () => {
  const files = [...$('#importFile').files];
  $('#importFile').value = '';
  if (files.length) await importFiles(files);
});
$('#compileBtn').onclick = async () => {
  $('#compileBtn').disabled = true;
  try { await compilePdf(); }
  catch (e) { console.error(e); setStatus(`compile failed: ${e.message || e}`); }
  finally { $('#compileBtn').disabled = false; }
};
$('#bundleBtn').onclick = async () => {
  $('#bundleBtn').disabled = true;
  try {
    setStatus('building bundle\u2026');
    const zip = await makeBundle();
    download(zip, `photobook-${new Date().toISOString().slice(0, 10)}.zip`);
    setStatus(`bundle \u2014 ${(zip.size / 1e6).toFixed(1)} MB, ${usedImages().length} photos`);
  } catch (e) { setStatus(`bundle failed: ${e.message}`); }
  finally { $('#bundleBtn').disabled = false; }
};
$('#typBtn').onclick = () => {
  download(new Blob([toTypst()], { type: 'text/plain' }), 'main.typ');
  setStatus('downloaded main.typ');
};
$('#backupBtn').onclick = () => {
  const name = `photobook-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.json`;
  download(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }), name);
  setStatus(`downloaded ${name}`);
};
$('#restoreBtn').onclick = () => $('#restoreFile').click();
$('#restoreFile').addEventListener('change', async () => {
  const f = $('#restoreFile').files[0];
  if (!f) return;
  $('#restoreFile').value = '';
  try {
    const st = JSON.parse(await f.text());
    if (!Array.isArray(st.pages)) throw new Error('no pages array');
    if (!confirm(`Replace the current book (${state.pages.length} pages) with "${f.name}" (${st.pages.length} pages)?`)) return;
    state = st;
    for (const p of state.pages)
      p.slots = p.slots.map(s => typeof s === 'string' ? { img: s, fx: 50, fy: 50 } : s);
    uid = Math.max(0, ...state.pages.map(p => p.id || 0)) + 1;
    applyFormat();
    render(); save();
    setStatus(`restored ${f.name}`);
  } catch (e) {
    setStatus(`restore failed: ${e.message}`);
  }
});

// drag & drop photo files anywhere -> import
addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files.length) return;
  e.preventDefault();
  importFiles([...e.dataTransfer.files]);
});

// ── init ─────────────────────────────────────────────────────
(async () => {
  initGeometry(await fetch('layouts.typ').then(r => r.text()));
  for (const [id, f] of Object.entries(FORMATS)) {
    const o = document.createElement('option');
    o.value = id; o.textContent = f.label;
    $('#fmtSel').appendChild(o);
  }
  $('#fmtSel').addEventListener('change', () => {
    state.format = $('#fmtSel').value;
    applyFormat(); render(); save();
  });
  opfs = await navigator.storage.getDirectory();
  navigator.storage.persist?.();
  state = JSON.parse(localStorage.getItem(STATE_KEY) || '{"pages":[]}');
  if (!state.pages) state = { pages: [] };
  for (const p of state.pages)
    p.slots = p.slots.map(s => typeof s === 'string' ? { img: s, fx: 50, fy: 50 } : s);
  uid = Math.max(0, ...state.pages.map(p => p.id || 0)) + 1;
  applyFormat();
  await loadImageIndex();
  $('#sortSel').value = localStorage.getItem('traySort') || 'name';
  $('#sortSel').addEventListener('change', () => {
    localStorage.setItem('traySort', $('#sortSel').value);
    applySort(); renderTray();
  });
  const chk = $('#guidesChk');
  chk.checked = localStorage.getItem('guides') !== 'off';
  document.body.classList.toggle('noguides', !chk.checked);
  chk.addEventListener('change', () => {
    localStorage.setItem('guides', chk.checked ? 'on' : 'off');
    document.body.classList.toggle('noguides', !chk.checked);
  });
  applySort();
  render();
  setStatus(`${images.length} photos`);
})();
