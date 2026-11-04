import * as Chibi from './chibi.js';
import { Globe } from './globe.js';
import { FAKE_CHAT, colorFor } from './names.js';
import { startLogin, finishLogin } from './twitch.js';
import { sha256hex } from './sha256.js';

// localhost and 127.0.0.1 are different origins to the browser, and Twitch only sends logins back to localhost
if (location.hostname === '127.0.0.1') location.replace(location.href.replace('127.0.0.1', 'localhost'));

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const body = document.body;
const PTS_SVG = '<svg class="pts-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 6.4l1.7 3.9 3.9 1.7-3.9 1.7-1.7 3.9-1.7-3.9L6.4 12l3.9-1.7z" fill="currentColor"/></svg>';

// ---------- state (kept in this browser only) ----------
const STORE = 'sarxina-gacha-v1';
const fresh = () => ({ user: null, pulls: {}, hits: {}, cost: false, costAmt: 1000, balances: {}, chatCursor: 0, total: 0 });
const state = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && typeof s === 'object') return { ...fresh(), ...s };
  } catch { /* storage blocked or empty */ }
  return fresh();
})();
let saveTimer = null;
function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* storage blocked: the page still works */ }
}
function save() {
  if (!saveTimer) saveTimer = setTimeout(flush, 250);
}
window.addEventListener('pagehide', flush);

const RARITY_OF = Array.from({ length: Chibi.POOL + 1 }, (_, i) => Chibi.rarityOf(Chibi.comboFromIndex(i)));
let globe = null;
let busy = false;
let frenzyOn = false;
let frenzyTimer = null;

// ---------- small helpers ----------
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), ms);
}

function rand(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function balanceFor(login) {
  if (state.balances[login] == null) state.balances[login] = 5000 + (parseInt(sha256hex(`pts|${login}`).slice(0, 4), 16) % 100) * 250;
  return state.balances[login];
}

const pad4 = (i) => String(i + 1).padStart(4, '0');

// ---------- header / login ----------
function renderUser() {
  const u = state.user;
  body.classList.toggle('logged-out', !u);
  $('loginTop').hidden = !!u;
  $('user').hidden = !u;
  if (u) {
    const av = $('userAvatar');
    av.textContent = '';
    if (u.avatar) {
      const img = new Image();
      img.alt = '';
      img.src = u.avatar;
      av.append(img);
    } else {
      av.textContent = u.display.slice(0, 1).toUpperCase();
      av.style.background = colorFor(u.login);
    }
    $('userName').textContent = u.display;
    const n = state.pulls[u.login] || 0;
    $('ctaSub').textContent = n === 0 ? '' : `${n} pull${n === 1 ? '' : 's'} so far`;
  } else {
    $('ctaSub').textContent = '';
  }
  renderPoints(false);
}

function renderPoints(hit) {
  const u = state.user;
  const p = $('points');
  const show = !!(u && state.cost);
  if (show && p.hidden) {
    p.hidden = false;
    p.classList.remove('is-in'); void p.offsetWidth; p.classList.add('is-in');
  }
  if (!show) p.hidden = true;
  if (u) $('pointsVal').textContent = fmt(balanceFor(u.login));
  if (hit) { p.classList.remove('is-hit'); void p.offsetWidth; p.classList.add('is-hit'); }
}

function loginAs(name) {
  const clean = name.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{1,25}$/.test(clean)) { toast('Twitch names are letters, numbers and underscores'); return; }
  state.user = { login: clean.toLowerCase(), display: clean, avatar: '', via: 'offline' };
  save();
  renderUser();
}

// ---------- channel point cost ----------
function renderCost(animate) {
  body.classList.toggle('has-cost', state.cost);
  $('costToggle').setAttribute('aria-checked', String(state.cost));
  $('costAmt').value = state.costAmt;
  const amt = fmt(state.costAmt);
  $('tagAmt').textContent = amt;
  $('pullCostVal').textContent = amt;
  document.getElementById('coinLabel').textContent = state.cost ? amt : 'FREE';
  const tag = $('priceTag');
  if (state.cost) {
    if (tag.hidden || animate) {
      tag.hidden = false;
      if (animate) {
        tag.animate([
          { transform: 'rotate(34deg) scale(2.8)', opacity: 0 },
          { transform: 'rotate(5deg) scale(.9)', opacity: 1, offset: 0.62 },
          { transform: 'rotate(9deg) scale(1.04)', offset: 0.82 },
          { transform: 'rotate(8deg) scale(1)', opacity: 1 },
        ], { duration: 520, easing: 'cubic-bezier(.3,1.2,.5,1)' });
        $('machine').animate([
          { transform: 'none' }, { transform: 'translate(-5px, 3px) rotate(-.6deg)', offset: 0.35 },
          { transform: 'translate(4px, -2px) rotate(.4deg)', offset: 0.6 }, { transform: 'none' },
        ], { duration: 360, delay: 300 });
        const pull = $('pull');
        pull.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 420, delay: 380, easing: 'ease-out' });
      }
    }
  } else if (!tag.hidden) {
    if (animate) {
      tag.animate([{ opacity: 1 }, { opacity: 0, transform: 'rotate(24deg) translateY(30px)' }], { duration: 260 }).onfinish = () => { tag.hidden = true; };
    } else tag.hidden = true;
  }
  renderPoints(false);
}

function setCost(on) {
  state.cost = on;
  save();
  renderCost(true);
}

// ---------- the pool ----------
const flashes = new Map();
let gridRaf = 0;
function drawGrid() {
  gridRaf = 0;
  const c = $('grid');
  const COLS = 36, ROWS = 30, gap = 2;
  const w = c.clientWidth;
  if (!w) return;
  const cell = (w - gap * (COLS - 1)) / COLS;
  const h = ROWS * cell + gap * (ROWS - 1);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = `${h}px`;
  }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const now = performance.now();
  for (let i = 0; i < Chibi.POOL; i++) {
    const x = (i % COLS) * (cell + gap), y = Math.floor(i / COLS) * (cell + gap);
    const got = state.hits[i];
    ctx.fillStyle = got ? Chibi.RARITY[RARITY_OF[i]].color : 'rgba(255,255,255,.07)';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, cell, cell, Math.min(2.5, cell / 3));
    ctx.fill();
    const f = flashes.get(i);
    if (f != null) {
      const t = (now - f) / 900;
      if (t >= 1) flashes.delete(i);
      else {
        const grow = (1 - t) * cell * 0.9;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.roundRect(x - grow / 2, y - grow / 2, cell + grow, cell + grow, 3);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
  if (flashes.size) gridRaf = requestAnimationFrame(drawGrid);
}
function kickGrid() { if (!gridRaf) gridRaf = requestAnimationFrame(drawGrid); }

function renderPool() {
  const keys = Object.keys(state.hits).map(Number);
  const front = keys.filter((k) => k !== Chibi.SECRET);
  $('foundN').textContent = fmt(front.length);
  $('foundBar').style.width = `${(front.length / Chibi.POOL) * 100}%`;
  const counts = { r: 0, sr: 0, ssr: 0, cursed: 0 };
  for (const k of front) counts[RARITY_OF[k]]++;
  $('legend').innerHTML = ['r', 'sr', 'ssr', 'cursed'].map((r) =>
    `<span><i style="background:${Chibi.RARITY[r].color}"></i>${Chibi.RARITY[r].tag} ${counts[r]}</span>`).join('');
  const secret = state.hits[Chibi.SECRET];
  $('secretSlot').classList.toggle('is-found', !!secret);
  $('secretText').textContent = secret ? 'Secret Sarxina: the back of his head' : 'Secret Sarxina: not pulled yet';
  kickGrid();
}

function record(idx) {
  const isNew = !state.hits[idx];
  state.hits[idx] = (state.hits[idx] || 0) + 1;
  state.total++;
  if (idx !== Chibi.SECRET) flashes.set(idx, performance.now());
  renderPool();
  return isNew;
}

// ---------- chat feed ----------
function addFeed({ name, login, idx, n, isNew, you = false, spent = 0 }) {
  const combo = Chibi.comboFromIndex(idx);
  const rar = RARITY_OF[idx];
  const li = document.createElement('li');
  li.className = `fi fi--${rar}${you ? ' fi--you' : ''}`;
  const cv = document.createElement('canvas');
  cv.className = 'fi__thumb';
  const t = Chibi.thumb(idx, 112);
  cv.width = t.width; cv.height = t.height;
  cv.getContext('2d').drawImage(t, 0, 0);
  const bodyEl = document.createElement('div');
  bodyEl.className = 'fi__body';
  const line = document.createElement('div');
  line.className = 'fi__line';
  const who = document.createElement('b');
  who.textContent = name;
  who.style.color = you ? '#bf94ff' : colorFor(login);
  const tag = document.createElement('span');
  tag.className = 'rtag';
  tag.textContent = Chibi.RARITY[rar].tag;
  line.append(who, tag);
  if (isNew) {
    const nt = document.createElement('span');
    nt.className = 'newtag';
    nt.textContent = 'NEW';
    line.append(nt);
  }
  const title = document.createElement('div');
  title.className = 'fi__title';
  title.textContent = Chibi.titleOf(combo);
  const meta = document.createElement('div');
  meta.className = 'fi__meta';
  const no = document.createElement('span');
  no.textContent = idx === Chibi.SECRET ? 'Secret' : `No. ${pad4(idx)}`;
  const hash = document.createElement('span');
  hash.textContent = `#${Chibi.serialOf(combo)}`;
  const pull = document.createElement('span');
  pull.textContent = `pull ${n}`;
  meta.append(no, hash, pull);
  if (spent) {
    const s = document.createElement('span');
    s.className = 'spent';
    s.innerHTML = `${PTS_SVG}<span></span>`;
    s.lastChild.textContent = `-${fmt(spent)}`;
    meta.append(s);
  }
  bodyEl.append(line, title, meta);
  li.append(cv, bodyEl);
  const list = $('feed');
  list.prepend(li);
  while (list.children.length > 24) list.lastChild.remove();
  $('feedEmpty').hidden = true;
  $('pullCount').textContent = `${fmt(state.total)} pull${state.total === 1 ? '' : 's'}`;
}

// ---------- the machine ----------
function chutePoint() {
  const r = $('machine').getBoundingClientRect();
  return { x: r.left + r.width * 0.66, y: r.top + r.height * 0.874 };
}

function eject(color) {
  const box = $('ejects');
  if (box.children.length > 16) return;
  const el = document.createElement('div');
  el.className = 'eject';
  el.style.setProperty('--c', color);
  box.append(el);
  const w = $('machine').clientWidth;
  const dx = w * (0.25 + Math.random() * 0.75);
  const up = -(40 + Math.random() * 120);
  const dy = -(Math.random() * w * 0.5) + 20;
  const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360);
  el.animate([
    { transform: 'translate(-10px, -10px) scale(.3)', opacity: 0 },
    { transform: `translate(${dx * 0.35}px, ${up}px) scale(1) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.35 },
    { transform: `translate(${dx}px, ${dy}px) scale(.8) rotate(${spin}deg)`, opacity: 0 },
  ], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.25,.6,.4,1)' }).onfinish = () => el.remove();
}

async function crank() {
  const m = $('machine');
  m.classList.add('is-busy');
  globe.stir(1100, 1);
  document.querySelector('.crank__arm').animate(
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(380deg)', offset: 0.8 }, { transform: 'rotate(360deg)' }],
    { duration: 820, easing: 'cubic-bezier(.45,0,.25,1)' });
  await wait(620);
  const color = globe.takeOne();
  document.querySelector('.chute-glow').animate([{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], { duration: 500 });
  await wait(260);
  m.classList.remove('is-busy');
  return color;
}

function spendFloat(amount) {
  const r = $('pull').getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'spend';
  el.innerHTML = `${PTS_SVG}<span></span>`;
  el.lastChild.textContent = `-${fmt(amount)}`;
  el.style.left = `${r.right - 40}px`;
  el.style.top = `${r.top - 10}px`;
  document.body.append(el);
  el.animate([{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: 'translateY(-70px)', opacity: 0 }],
    { duration: 1100, easing: 'ease-out' }).onfinish = () => el.remove();
}

// ---------- pulling ----------
async function userPull() {
  if (!state.user) { startLogin(); return; }
  if (busy) return;
  const u = state.user;
  let spent = 0;
  if (state.cost) {
    const bal = balanceFor(u.login);
    if (bal < state.costAmt) {
      const p = $('pull');
      p.classList.remove('is-broke'); void p.offsetWidth; p.classList.add('is-broke');
      toast(`Not enough channel points (${fmt(bal)} left)`);
      return;
    }
    state.balances[u.login] = bal - state.costAmt;
    spent = state.costAmt;
    spendFloat(spent);
    renderPoints(true);
  }
  busy = true;
  $('pull').disabled = true;
  const n = (state.pulls[u.login] || 0) + 1;
  state.pulls[u.login] = n;
  const idx = Chibi.pickIndex(u.login, n);
  const color = await crank();
  const isNew = record(idx);
  save();
  await reveal({ idx, n, who: u.display, isNew, color });
  addFeed({ name: u.display, login: u.login, idx, n, isNew, you: true, spent });
  renderUser();
  busy = false;
  $('pull').disabled = false;
}

function nextChatter() {
  const c = state.chatCursor++;
  if (c < FAKE_CHAT.length) return FAKE_CHAT[c];
  return FAKE_CHAT[Math.floor(rand(c * 7919) * FAKE_CHAT.length)];
}

function chatPull() {
  const name = nextChatter();
  const n = (state.pulls[name] || 0) + 1;
  state.pulls[name] = n;
  const idx = Chibi.pickIndex(name, n);
  const isNew = record(idx);
  eject(globe.takeOne());
  addFeed({ name, login: name, idx, n, isNew, spent: state.cost ? state.costAmt : 0 });
  if (idx === Chibi.SECRET) toast(`${name} pulled the SECRET Sarxina`, 3200);
  save();
}

function setFrenzy(on) {
  frenzyOn = on;
  body.classList.toggle('is-frenzy', on);
  $('machine').classList.toggle('is-frenzy', on);
  $('frenzyToggle').setAttribute('aria-checked', String(on));
  globe.setContinuous(on ? 0.55 : 0);
  clearTimeout(frenzyTimer);
  if (on) frenzyTick();
}
function frenzyTick() {
  if (!frenzyOn) return;
  chatPull();
  const speed = Number($('frenzySpeed').value) || 2.5;
  frenzyTimer = setTimeout(frenzyTick, (320 / speed) * (0.35 + Math.random() * 1.3));
}

// ---------- the reveal ----------
const revealEl = $('reveal');
let revealOpen = false;

function sparks(count, big) {
  const box = $('sparks');
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    box.append(s);
    const a = Math.random() * Math.PI * 2;
    const d = (big ? 220 : 160) + Math.random() * (big ? 260 : 160);
    const sc = 0.5 + Math.random() * (big ? 1.4 : 0.9);
    s.animate([
      { transform: 'translate(0,0) scale(0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d * 0.75}px, ${Math.sin(a) * d * 0.75}px) scale(${sc}) rotate(140deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 30}px) scale(0) rotate(260deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(.15,.8,.3,1)' }).onfinish = () => s.remove();
  }
}

function fillCard({ idx, n, who, isNew }) {
  const combo = Chibi.comboFromIndex(idx);
  const rar = RARITY_OF[idx];
  const R = Chibi.RARITY[rar];
  $('cardBadge').textContent = R.tag;
  $('cardRName').textContent = { cursed: '180 of the 1,080', secret: '1 in 1,081' }[rar] || R.name;
  $('cardTitle').textContent = Chibi.titleOf(combo);
  $('cardWho').textContent = n === 1 ? `@${who}'s own Sarxina` : `@${who} · pull #${n}`;
  $('cardNo').textContent = combo.secret ? 'No. ???? · off the list' : `No. ${pad4(idx)} / 1,080`;
  $('cardHash').textContent = `Hash #${Chibi.serialOf(combo)}`;
  const traits = $('cardTraits');
  traits.textContent = '';
  const rows = combo.secret
    ? [['Pose', 'Facing away', true]]
    : [['brows', 'Brows'], ['eyes', 'Eyes'], ['mouth', 'Mouth'], ['marks', 'Marks'], ['pose', 'Pose']].map(([k, label], i) => [label, Chibi.traitLabel(k, combo[k]), i === 4]);
  for (const [label, value, wide] of rows) {
    const li = document.createElement('li');
    if (wide) li.className = 'wide';
    const sm = document.createElement('small');
    sm.textContent = label;
    li.append(sm, document.createTextNode(value));
    traits.append(li);
  }
  const nw = $('cardNew');
  nw.classList.toggle('dupe', !isNew);
  nw.textContent = isNew ? 'NEW: first time anyone pulled this one' : `Duplicate: pulled ${state.hits[idx]} times now`;
  $('again').innerHTML = state.cost ? `Pull again ${PTS_SVG}<span>${fmt(state.costAmt)}</span>` : 'Pull again';
}

async function reveal(p) {
  const rar = RARITY_OF[p.idx];
  const R = Chibi.RARITY[rar];
  revealEl.className = `reveal r-${rar}`;
  revealEl.style.setProperty('--rcol', R.color);
  revealEl.style.setProperty('--glow', R.glow);
  revealEl.style.setProperty('--ray', R.glow.replace(/[\d.]+\)$/, '0.16)'));
  revealEl.style.setProperty('--cap', rar === 'r' || rar === 'sr' ? R.color : p.color);
  $('banner').textContent = { r: 'RARE', sr: 'SUPER RARE', ssr: 'SSR!', cursed: 'CURSED', secret: 'SECRET' }[rar];
  fillCard(p);
  Chibi.drawInto($('chibi'), p.idx);

  for (const a of revealEl.getAnimations({ subtree: true })) a.cancel();
  const cap = $('capsule'), top = cap.querySelector('.capsule__top'), bot = cap.querySelector('.capsule__bottom'), crack = cap.querySelector('.capsule__crack');
  const chibi = $('chibiWrap'), card = $('card'), rays = $('rays'), glow = $('glow'), banner = $('banner');
  chibi.classList.remove('is-idle');
  revealEl.hidden = false;
  revealOpen = true;
  const keep = { fill: 'forwards' };

  revealEl.querySelector('.reveal__backdrop').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, ...keep });
  const stage = $('stage').getBoundingClientRect();
  const from = chutePoint();
  const dx = from.x - (stage.left + stage.width / 2), dy = from.y - (stage.top + stage.height * 0.52);
  glow.animate([{ opacity: 0 }, { opacity: 0.45 }], { duration: 700, ...keep });
  await cap.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(.16) rotate(-540deg)`, opacity: 0 },
    { opacity: 1, offset: 0.15 },
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
  ], { duration: 760, easing: 'cubic-bezier(.18,.9,.3,1.1)', ...keep }).finished;

  const long = rar === 'secret' || rar === 'ssr' || rar === 'cursed';
  const shakeMs = long ? 1300 : 850;
  crack.animate([{ opacity: 0 }, { opacity: 0.2, offset: 0.5 }, { opacity: 1 }], { duration: shakeMs, ...keep });
  glow.animate([{ opacity: 0.45 }, { opacity: 1 }], { duration: shakeMs, ...keep });
  const amp = long ? [6, -6, 10, -10, 14, -14, 18, -18, 22, -22, 0] : [5, -5, 9, -9, 13, -13, 0];
  await cap.animate(amp.map((d, i) => ({ transform: `translate(0,0) rotate(${d}deg) scale(${1 + i * 0.012})`, opacity: 1 })),
    { duration: shakeMs, easing: 'ease-in', ...keep }).finished;

  // pop
  $('flash').animate([{ opacity: 0 }, { opacity: rar === 'secret' ? 1 : 0.8 }, { opacity: 0 }], { duration: 480, easing: 'ease-out' });
  top.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(-40%, -190%) rotate(-70deg)', opacity: 0 }], { duration: 760, easing: 'cubic-bezier(.2,.7,.3,1)', ...keep });
  bot.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(30%, 170%) rotate(40deg)', opacity: 0 }], { duration: 760, easing: 'cubic-bezier(.2,.7,.3,1)', ...keep });
  crack.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, ...keep });
  rays.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 700, easing: 'ease-out', ...keep });
  sparks(rar === 'r' ? 18 : 30, long);
  const out = chibi.animate([
    { opacity: 0, transform: 'translateY(18%) scale(.2)' },
    { opacity: 1, transform: 'translateY(-5%) scale(1.1)', offset: 0.6 },
    { opacity: 1, transform: 'translateY(0) scale(1)' },
  ], { duration: 720, easing: 'cubic-bezier(.2,1,.3,1)', ...keep });
  banner.animate([
    { opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(.94)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' },
  ], { duration: 520, delay: 160, easing: 'cubic-bezier(.3,1.2,.5,1)', ...keep });
  card.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 380, easing: 'cubic-bezier(.2,.9,.3,1)', ...keep });
  await out.finished;
  chibi.classList.add('is-idle');
}

async function closeReveal(fast = false) {
  if (!revealOpen) return;
  revealOpen = false;
  await revealEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fast ? 140 : 220 }).finished;
  revealEl.hidden = true;
  for (const a of revealEl.getAnimations({ subtree: true })) a.cancel();
}

async function pullAgain() {
  if (busy) return;
  await closeReveal(true);
  userPull();
}

// ---------- wiring ----------
function bind() {
  $('loginTop').addEventListener('click', startLogin);
  $('pull').addEventListener('click', () => userPull());
  $('crankHit').addEventListener('click', () => userPull());
  $('again').addEventListener('click', pullAgain);
  $('done').addEventListener('click', () => closeReveal());
  revealEl.querySelector('.reveal__backdrop').addEventListener('click', () => { if (!busy) closeReveal(); });
  $('costToggle').addEventListener('click', () => setCost(!state.cost));
  $('costAmt').addEventListener('change', (e) => {
    state.costAmt = Math.max(1, Math.round(Number(e.target.value) || 1000));
    save();
    renderCost(false);
  });
  $('frenzyToggle').addEventListener('click', () => setFrenzy(!frenzyOn));
  $('offlineForm').addEventListener('submit', (e) => {
    e.preventDefault();
    loginAs($('offlineName').value);
    $('offlineName').value = '';
    $('offlineName').blur();
  });
  $('logout').addEventListener('click', () => { state.user = null; save(); renderUser(); });
  let armed = 0;
  $('reset').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (Date.now() - armed > 3000) {
      armed = Date.now();
      btn.classList.add('is-armed');
      btn.textContent = 'Click again to reset';
      setTimeout(() => { btn.classList.remove('is-armed'); btn.textContent = 'Reset pulls'; }, 3000);
      return;
    }
    armed = 0;
    const keep = { user: state.user, cost: state.cost, costAmt: state.costAmt };
    Object.assign(state, fresh(), keep);
    save();
    $('feed').textContent = '';
    $('feedEmpty').hidden = false;
    $('pullCount').textContent = '0 pulls';
    renderUser(); renderPool();
    btn.classList.remove('is-armed'); btn.textContent = 'Reset pulls';
    toast('Pulls, collection and points reset');
  });
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'enter') {
      if (e.target instanceof HTMLButtonElement && k === 'enter') return;
      e.preventDefault();
      if (revealOpen) pullAgain(); else userPull();
    } else if (k === 'escape') closeReveal();
    else if (k === 'c') setCost(!state.cost);
    else if (k === 'f') setFrenzy(!frenzyOn);
    else if (k === 'h') body.classList.toggle('hide-controls');
  });
  new ResizeObserver(() => kickGrid()).observe($('grid'));
}

async function init() {
  bind();
  renderUser();
  renderCost(false);
  try {
    await Chibi.loadLayers('layers/');
  } catch (err) {
    toast(`The chibi art did not load: ${err.message}`, 8000);
    return;
  }
  globe = new Globe($('globe'), 26);
  renderPool();
  const back = await finishLogin();
  if (back?.user) {
    state.user = back.user;
    save();
    renderUser();
    toast(`Logged in as ${back.user.display}`);
  } else if (back?.error) {
    toast(`Twitch login did not finish: ${back.error}`, 6000);
  }
  const as = new URLSearchParams(location.search).get('as');
  if (as) { loginAs(as); history.replaceState(null, '', location.pathname); }
  window.gacha = { state, globe, userPull, setFrenzy, setCost, chatPull, closeReveal, loginAs, // for the console and the headless checks
    preview: (idx, who = 'preview') => reveal({ idx, n: 1, who, isNew: true, color: '#8fa6e8' }) };
}

init();
