// The pool: every permutation of the Irasutoya chibi's PSD layers, stitched at runtime.
//   brows 3 x eyes 3 x mouth 6 x expression marks 4 x pose 5 = 1,080, plus the back view as the secret 1,081st.
// Linked layers follow the idea page: the glasses follow the eyes (open / closed), the nose follows the mouth
// (open / closed), the purple face shadow follows the worried brows (as in his own exports), and the crossed
// arms bring their own body and chest plate.
import { sha256hex } from './sha256.js';

export const POOL = 1080;
export const SECRET = 1080; // index of the back view

export const TRAITS = {
  brows: [['default', 'Default'], ['surprised', 'Raised'], ['worried', 'Worried']],
  eyes: [['open', 'Open'], ['closed', 'Closed'], ['happy', 'Happy squint']],
  mouth: [['smile', 'Smile'], ['talk', 'Talking'], ['gasp', 'Gasp'], ['scared', 'Scared'], ['flat', 'Flat'], ['sweat', 'Sweating']],
  marks: [['none', 'None'], ['bang', '!'], ['question', '?'], ['both', '! and ?']],
  pose: [['default', 'Arms down'], ['crossed', 'Arms crossed'], ['shrug', 'Shrug'], ['point', 'Point'], ['bracelet', 'Point with bracelet']],
};
export const TRAIT_LABELS = { brows: 'Brows', eyes: 'Eyes', mouth: 'Mouth', marks: 'Marks', pose: 'Pose' };
const RADIX = ['pose', 'marks', 'mouth', 'eyes', 'brows']; // least significant first

export const RARITY = {
  r: { tag: 'R', name: 'Rare', color: '#8fa6e8', glow: 'rgba(143,166,232,.55)' },
  sr: { tag: 'SR', name: 'Super Rare', color: '#e6c08c', glow: 'rgba(255,217,138,.6)' },
  ssr: { tag: 'SSR', name: 'Super Super Rare', color: '#ff9ad5', glow: 'rgba(255,170,230,.7)' },
  cursed: { tag: 'CURSED', name: 'Cursed', color: '#b06bff', glow: 'rgba(176,107,255,.75)' },
  secret: { tag: 'SECRET', name: 'Secret', color: '#ffd98a', glow: 'rgba(255,217,138,.9)' },
};

export function comboFromIndex(index) {
  if (index === SECRET) return { index, secret: true };
  const combo = { index, secret: false };
  let rest = index;
  for (const key of RADIX) {
    const n = TRAITS[key].length;
    combo[key] = TRAITS[key][rest % n][0];
    rest = Math.floor(rest / n);
  }
  return combo;
}

export function rarityOf(c) {
  if (c.secret) return 'secret';
  if ((c.brows === 'worried' && (c.mouth === 'talk' || c.mouth === 'smile')) || (c.eyes === 'happy' && c.mouth === 'scared')) return 'cursed';
  if (c.marks === 'both') return 'ssr';
  if (c.marks !== 'none') return 'sr';
  return 'r';
}

export function traitLabel(key, id) {
  return TRAITS[key].find(([k]) => k === id)[1];
}

const MOOD = { smile: 'Smug', talk: 'Chatty', gasp: 'Shocked', scared: 'Terrified', flat: 'Unbothered', sweat: 'Sweating' };
const POSE_WORD = { default: '', crossed: 'Arms-Crossed', shrug: 'Shrugging', point: 'Pointing', bracelet: 'Bejeweled' };
const BROW_WORD = { default: '', surprised: 'Startled', worried: 'Anxious' };
const MARK_TAIL = { none: '', bang: ' !', question: ' ?', both: ' ?!' }; // no-break space: the mark never wraps alone

export function titleOf(c) {
  if (c.secret) return 'The Back of His Head';
  const mood = rarityOf(c) === 'cursed' ? 'Cursed' : MOOD[c.mouth];
  const words = [mood, c.eyes === 'happy' && c.mouth !== 'smile' ? 'Squinting' : BROW_WORD[c.brows], POSE_WORD[c.pose], 'Sarxina'];
  return words.filter(Boolean).join(' ') + MARK_TAIL[c.marks];
}

/** The permutation's own hash: its layer recipe through SHA-256, shown as the capsule serial. */
export function serialOf(c) {
  const recipe = c.secret ? 'SARXINA|back' : `SARXINA|${RADIX.map((k) => `${k}=${c[k]}`).join('|')}`;
  const h = sha256hex(recipe).toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}`;
}

/** Which Sarxina a Twitch name gets on its nth pull. Pull 1 is that name's own Sarxina. */
export function pickIndex(login, pullNo = 1) {
  const h = sha256hex(`sarxina-gacha|${login.trim().toLowerCase()}|${pullNo}`);
  return parseInt(h.slice(0, 12), 16) % (POOL + 1);
}

export function layersFor(c) {
  if (c.secret) return ['back'];
  const open = c.mouth === 'talk' || c.mouth === 'gasp' || c.mouth === 'scared';
  const ids = [];
  const arms = { default: 'arms_default', shrug: 'arms_shrug', point: 'arms_point', bracelet: 'arms_point_bracelet' }[c.pose];
  if (arms) ids.push(arms);
  ids.push(c.pose === 'crossed' ? 'body_crossed' : 'body_default', 'hair_back', 'face');
  if (c.brows === 'worried') ids.push('face_shadow');
  ids.push(open ? 'nose_open' : 'nose_closed');
  if (c.eyes === 'open') ids.push('glasses_open_lens', 'glasses_open_frame');
  else ids.push('glasses_closed');
  ids.push({ smile: 'mouth_smile', talk: 'mouth_talk', gasp: 'mouth_gasp', scared: 'mouth_scared', flat: 'mouth_flat', sweat: 'mouth_flat' }[c.mouth]);
  if (c.mouth === 'sweat') ids.push('sweat');
  if (c.marks === 'bang' || c.marks === 'both') ids.push('mark_bang');
  if (c.marks === 'question' || c.marks === 'both') ids.push('mark_question');
  ids.push({ open: 'eyes_open', closed: 'eyes_closed', happy: 'eyes_happy' }[c.eyes]);
  ids.push(`brows_${c.brows}`);
  ids.push(c.pose === 'crossed' ? 'chest_crossed' : 'chest_default', 'hair_front');
  return ids;
}

// ---------- the stitcher ----------
let manifest = null;
const images = {};
let scratch = null;
const fullCache = new Map(); // index -> canvas (small LRU)
const thumbCache = new Map(); // `${index}@${w}` -> canvas

// The part of the 800 x 768 canvas the character (and its marks) lives in.
export const CROP = { x: 110, y: 90, w: 570, h: 670 };

export async function loadLayers(base = 'layers/') {
  manifest = await (await fetch(`${base}layers.json`)).json();
  await Promise.all(Object.keys(manifest.pieces).map((id) => new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => { images[id] = img; ok(); };
    img.onerror = () => fail(new Error(`layer ${id} did not load`));
    img.src = `${base}${id}.png`;
  })));
  scratch = makeCanvas(manifest.width, manifest.height);
  return manifest;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function drawPiece(ctx, id) {
  const p = manifest.pieces[id];
  ctx.globalAlpha = p.opacity;
  ctx.imageSmoothingEnabled = !p.native;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(images[id], p.x, p.y, p.w, p.h);
  ctx.globalAlpha = 1;
}

// A layer clipped to everything drawn so far (the PSD's clipping masks on the character group).
function clipped(base, id, mode) {
  const s = scratch.getContext('2d');
  s.globalCompositeOperation = 'source-over';
  s.clearRect(0, 0, scratch.width, scratch.height);
  drawPiece(s, id);
  s.globalAlpha = 1;
  s.globalCompositeOperation = 'destination-in';
  s.drawImage(base, 0, 0);
  s.globalCompositeOperation = 'source-over';
  const ctx = base.getContext('2d');
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = manifest.pieces[id].opacity;
  ctx.drawImage(scratch, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** The full 800 x 768 stitched chibi for a pool index. */
export function render(index) {
  if (fullCache.has(index)) {
    const hit = fullCache.get(index);
    fullCache.delete(index); fullCache.set(index, hit);
    return hit;
  }
  const c = comboFromIndex(index);
  const canvas = makeCanvas(manifest.width, manifest.height);
  const ctx = canvas.getContext('2d');
  for (const id of layersFor(c)) drawPiece(ctx, id);
  clipped(canvas, 'tex_stripes', 'multiply');
  clipped(canvas, 'tex_grain', 'overlay');
  const out = sticker(canvas, 6);
  fullCache.set(index, out);
  if (fullCache.size > 24) fullCache.delete(fullCache.keys().next().value);
  return out;
}

// A white die-cut edge around the stitched chibi, like a sticker or an acrylic stand, so the dark
// "?" mark and the navy outfit still read on the dark page.
function sticker(src, px) {
  const out = makeCanvas(src.width, src.height);
  const ctx = out.getContext('2d');
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.drawImage(src, Math.cos(a) * px, Math.sin(a) * px);
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fdfaf3';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(src, 0, 0);
  return out;
}

/** Draw the cropped chibi into a canvas of the given pixel width (height follows the crop). */
export function drawInto(target, index) {
  const src = render(index);
  const ctx = target.getContext('2d');
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, target.width, target.height);
}

export function thumb(index, w = 88) {
  const key = `${index}@${w}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const h = Math.round(w * CROP.h / CROP.w);
  // step down in two passes so the small thumb stays clean
  const mid = makeCanvas(w * 2, h * 2);
  drawInto(mid, index);
  const t = makeCanvas(w, h);
  const ctx = t.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mid, 0, 0, w, h);
  thumbCache.set(key, t);
  return t;
}
