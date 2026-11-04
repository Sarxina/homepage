// Every VTuber gacha: the stream overlay. Chat redeems channel points, a finger presses the crank, a capsule pops out
// and opens on a VTuber from the pool (web/data/vtubers.json: every VTuber the Virtual YouTuber Wiki and vtbs.moe list).
// Everything is drawn inside one 1920x1080 box; overlay.html mounts it for OBS, and the page can be driven by calls:
//   ov.redeem(user, entry?)  one pull, opened big in front of the machine
//   ov.burst(user, entry?)   one pull in a frenzy: a small card that lands in the pile around the machine
//   ov.setFrenzy(on)         the machine rumbles and spins while chat mashes
//   ov.addCursor(user)       a chatter's finger hovering over the machine
// Every chatter name and VTuber name is set with textContent (the overlay must never run chat's text as HTML).
import { Globe } from './globe.js';
import { colorFor } from './names.js';

const PTS = '<svg class="pts-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 6.4l1.7 3.9 3.9 1.7-3.9 1.7-1.7 3.9-1.7-3.9L6.4 12l3.9-1.7z" fill="currentColor"/></svg>';
const HAND = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 6c-3 0-5 2.3-5 5.2V34l-3.6-4.2c-2-2.3-5.4-2.5-7.5-.5-1.8 1.7-2 4.5-.5 6.6l11 15.3C19.2 56 23.6 58 28.4 58H40c7.7 0 14-6.3 14-14V30c0-2.8-2.2-5-5-5-1 0-2 .3-2.8.9-.7-2.2-2.7-3.8-5.1-3.8-1.2 0-2.3.4-3.2 1.1-.8-2-2.8-3.4-5-3.4-.8 0-1.6.2-2.3.5V11.2C27 8.3 25 6 22 6z" fill="#fff" stroke="#1b1f4d" stroke-width="3.2" stroke-linejoin="round"/><path d="M27 24v12M35.6 25v11M44.2 28v9" stroke="#1b1f4d" stroke-width="2.6" stroke-linecap="round" opacity=".55"/></svg>';
const CAP_TOPS = ['#8fa6e8', '#e6c08c', '#5fc39a', '#f29bb8', '#b79cf0', '#6f7fd6', '#ffd98a', '#7cc7e8'];
export const RARITY = {
  dead: { tag: 'DEAD CHANNEL', color: '#9aa3b8', glow: 'rgba(154,163,184,.35)' },
  r: { tag: 'R', color: '#8fa6e8', glow: 'rgba(143,166,232,.45)' },
  sr: { tag: 'SR', color: '#c9a8ff', glow: 'rgba(201,168,255,.55)' },
  ssr: { tag: 'SSR', color: '#ffd98a', glow: 'rgba(255,217,138,.65)' },
  ur: { tag: 'UR', color: '#ff9ad5', glow: 'rgba(255,154,213,.7)' },
};
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.append(e); return e; };

// rarity from what the sources say: big names are SSR, agency talents SR, the rest R, and a channel the sources show as
// gone (the wiki lists it as retired) or that barely started (a Bilibili channel under 1,000 followers) is a DEAD CHANNEL.
export function rarityOf(e, famous) {
  if (e.rar) return e.rar;
  if (famous && famous.has(e.n)) return 'ssr';
  if (e.r || (e.s === 'bili' && e.f >= 0 && e.f < 1000)) return 'dead';
  if (e.a) return 'sr';
  return 'r';
}
export function subOf(e) {
  if (e.sub) return e.sub;
  if (e.s === 'bili') return `Bilibili · ${fmt(Math.max(0, e.f))} followers`;
  const who = e.a || 'Independent';
  return e.d ? `${who} · debuted ${e.d}` : who;
}

export function createOverlay(root, opts = {}) {
  const pool = opts.pool || [];
  const famous = opts.famous || new Set();
  const cost = opts.cost ?? 1000;
  const reward = opts.reward || 'Every VTuber Gacha';
  const imageFor = opts.imageFor || ((e) => e.img);
  const count = opts.count ?? pool.length;
  const rnd = opts.random || Math.random;
  const toastTTL = opts.toastTTL ?? 4000;   // a redeem alert goes away by itself after this long
  const avoid = opts.avoid || null;          // [x0, y0, x1, y1]: keep the pile off this box (the streamer's face)
  const pulls = new Map();   // name -> times pulled (dupes)
  let spent = 0;

  root.classList.add('ov');
  root.innerHTML = `
    <div class="ov-pile"></div>
    <div class="ov-machine" hidden><div class="ov-machine__in">
      <div class="machine__halo"></div>
      <svg class="machine__svg" viewBox="0 0 600 900">
        <defs>
          <linearGradient id="oGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2cf"/><stop offset=".35" stop-color="#e6c08c"/><stop offset=".7" stop-color="#b8894e"/><stop offset="1" stop-color="#f0d29d"/></linearGradient>
          <linearGradient id="oGoldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c9"/><stop offset=".5" stop-color="#e2b87e"/><stop offset="1" stop-color="#a87a42"/></linearGradient>
          <linearGradient id="oBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3375"/><stop offset=".55" stop-color="#1a2150"/><stop offset="1" stop-color="#10153a"/></linearGradient>
          <radialGradient id="oGlobeBack" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#4a5cb0" stop-opacity=".45"/><stop offset=".75" stop-color="#1b2260" stop-opacity=".7"/><stop offset="1" stop-color="#0d1236" stop-opacity=".9"/></radialGradient>
          <filter id="oSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
        </defs>
        <ellipse cx="300" cy="884" rx="250" ry="16" fill="#000" opacity=".45" filter="url(#oSoft)"/>
        <circle cx="300" cy="290" r="236" fill="url(#oGlobeBack)"/>
        <rect x="104" y="540" width="392" height="306" rx="40" fill="url(#oBody)" stroke="url(#oGold)" stroke-width="5"/>
        <rect x="128" y="606" width="344" height="216" rx="26" fill="#ffffff" fill-opacity=".035" stroke="#e6c08c" stroke-opacity=".35" stroke-width="1.6"/>
        <text x="300" y="592" text-anchor="middle" class="svg-plaque"></text>
        <rect x="86" y="834" width="428" height="42" rx="18" fill="#0d1236" stroke="url(#oGold)" stroke-width="4"/>
        <g fill="#e6c08c" opacity=".85"><path d="M180 849l6 6-6 6-6-6z"/><path d="M240 849l6 6-6 6-6-6z"/><path d="M300 846l9 9-9 9-9-9z"/><path d="M360 849l6 6-6 6-6-6z"/><path d="M420 849l6 6-6 6-6-6z"/></g>
        <rect x="146" y="498" width="308" height="58" rx="22" fill="url(#oGoldV)"/>
      </svg>
      <canvas class="machine__globe"></canvas>
      <svg class="machine__svg" viewBox="0 0 600 900">
        <defs>
          <radialGradient id="oGlass" cx=".5" cy=".5" r=".5"><stop offset=".72" stop-color="#bcd0ff" stop-opacity="0"/><stop offset=".93" stop-color="#bcd0ff" stop-opacity=".16"/><stop offset="1" stop-color="#e8efff" stop-opacity=".34"/></radialGradient>
          <radialGradient id="oKnob" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff6dd"/><stop offset=".45" stop-color="#e6c08c"/><stop offset="1" stop-color="#9c7038"/></radialGradient>
          <filter id="oBlur6"><feGaussianBlur stdDeviation="6"/></filter>
          <linearGradient id="oChute" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#151b48"/></linearGradient>
        </defs>
        <circle cx="300" cy="290" r="236" fill="url(#oGlass)"/>
        <path d="M128 200a190 190 0 0 1 120-122" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="16" stroke-linecap="round" filter="url(#oBlur6)"/>
        <path d="M140 190a178 178 0 0 1 96-104" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>
        <circle cx="300" cy="290" r="236" fill="none" stroke="url(#oGold)" stroke-width="7"/>
        <path d="M226 74c0-40 33-62 74-62s74 22 74 62z" fill="url(#oGold)"/>
        <rect x="214" y="66" width="172" height="16" rx="8" fill="#b8894e"/>
        <path class="crown-star" d="M300 0l7 17 18 2-14 11 4 18-15-10-15 10 4-18-14-11 18-2z" fill="#fff4d6"/>
        <g class="bulbs"><circle cx="176" cy="527" r="7"/><circle cx="212" cy="527" r="7"/><circle cx="248" cy="527" r="7"/><circle cx="284" cy="527" r="7"/><circle cx="316" cy="527" r="7"/><circle cx="352" cy="527" r="7"/><circle cx="388" cy="527" r="7"/><circle cx="424" cy="527" r="7"/></g>
        <g><circle cx="214" cy="714" r="62" fill="url(#oGold)"/><circle cx="214" cy="714" r="49" fill="#141a45"/>
          <g class="crank__arm"><rect x="160" y="702" width="108" height="24" rx="12" fill="url(#oKnob)"/><circle cx="160" cy="714" r="15" fill="url(#oKnob)"/><circle cx="268" cy="714" r="15" fill="url(#oKnob)"/><circle cx="214" cy="714" r="13" fill="#fff4d6"/></g></g>
        <text x="214" y="806" text-anchor="middle" class="svg-label">TURN</text>
        <rect x="350" y="632" width="92" height="84" rx="16" fill="#0b0f2e" stroke="url(#oGold)" stroke-width="3"/>
        <rect x="390" y="646" width="12" height="40" rx="6" fill="#000" stroke="#e6c08c" stroke-opacity=".5" stroke-width="1.5"/>
        <text x="396" y="707" text-anchor="middle" class="svg-coin"></text>
        <rect x="334" y="738" width="124" height="74" rx="20" fill="#05071c" stroke="url(#oGold)" stroke-width="4"/>
        <rect x="342" y="746" width="108" height="58" rx="14" fill="url(#oChute)"/>
        <path d="M350 749h92" stroke="#e6c08c" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
        <circle class="chute-glow" cx="396" cy="792" r="26" fill="#ffd98a" opacity="0"/>
      </svg>
      <div class="ov-tag">${PTS}<b></b><span>per pull</span></div>
      <div class="ov-rates"><h4>RATES</h4><p class="ur">UR: on a schedule<i>0.01%</i></p><p class="ssr">SSR<i>0.6%</i></p><p class="dead">DEAD CHANNEL<i>99%</i></p></div>
    </div></div>
    <div class="ov-spent" hidden><small>chat has spent</small><b>${PTS}<span>0</span></b></div>
    <div class="ov-stage"><div class="ov-rays"></div><div class="ov-flash"></div></div>
    <div class="ov-fly"></div>
    <div class="ov-toasts"></div>
    <div class="ov-cursors"></div>`;

  const $ = (s) => root.querySelector(s);
  const machine = $('.ov-machine'), mIn = $('.ov-machine__in'), stage = $('.ov-stage'), fly = $('.ov-fly');
  const pile = $('.ov-pile'), toasts = $('.ov-toasts'), cursorsBox = $('.ov-cursors'), spentBox = $('.ov-spent');
  $('.svg-plaque').textContent = `${fmt(count)} VTUBERS INSIDE`;
  $('.svg-coin').textContent = fmt(cost);
  $('.ov-tag b').textContent = fmt(cost);
  const globe = new Globe($('.machine__globe'), 28);

  // machine geometry in overlay px
  const M = { x: 855, y: 105, w: 400, h: 600 };
  const at = (fx, fy) => ({ x: M.x + M.w * fx, y: M.y + M.h * fy });
  const CHUTE = at(396 / 600, 790 / 900), CRANK = at(214 / 600, 714 / 900), GLOBE = at(0.5, 290 / 900);
  const STAGE = { x: 1055, y: 470 };

  // ---------- chat's fingers ----------
  const cursors = new Map();
  function addCursor(user, x, y) {
    if (cursors.has(user)) return cursors.get(user);
    const c = el('div', 'ov-cur', cursorsBox);
    c.innerHTML = HAND;
    const tag = el('span', 'ov-cur__name', c);
    tag.textContent = user;
    tag.style.setProperty('--cc', colorFor(user));
    const k = cursors.size;
    const home = { x: x ?? GLOBE.x + Math.cos(k * 2.39) * (150 + (k % 3) * 40), y: y ?? GLOBE.y + Math.sin(k * 2.39) * (130 + (k % 3) * 30) };
    const cur = { el: c, user, x: home.x, y: home.y + 60, home, target: null, born: performance.now(), seed: k * 13.7, press: 0 };
    cursors.set(user, cur);
    c.animate([{ opacity: 0, transform: `translate(${cur.x}px, ${cur.y}px) scale(.3)` }, { opacity: 1, transform: `translate(${cur.x}px, ${cur.y}px) scale(1)` }],
      { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    return cur;
  }
  function moveCursor(user, x, y, ms = 300) {
    const c = cursors.get(user) || addCursor(user);
    c.target = { x, y, from: { x: c.x, y: c.y }, t0: performance.now(), ms };
    return c;
  }
  function tickCursors(now) {
    for (const c of cursors.values()) {
      const t = (now - c.born) / 1000;
      let x = c.home.x + Math.sin(t * 1.7 + c.seed) * 14 + Math.sin(t * 3.1 + c.seed * 2) * 6;
      let y = c.home.y + Math.cos(t * 1.3 + c.seed) * 12 + Math.sin(t * 2.6 + c.seed) * 5;
      if (c.target) {
        const u = Math.min(1, (now - c.target.t0) / c.target.ms), e = 1 - Math.pow(1 - u, 3);
        x = c.target.from.x + (c.target.x - c.target.from.x) * e; y = c.target.from.y + (c.target.y - c.target.from.y) * e;
        if (now - c.target.t0 > c.target.ms + (c.target.hold ?? 420)) { c.home = { ...c.home }; c.target = null; }
      }
      c.x = x; c.y = y;
      const p = c.press;   // a press squashes the finger flat, then it springs back
      c.el.style.transform = `translate(${x - 14}px, ${y - 4 + p * 6}px) scale(${1 + 0.22 * p}, ${1 - 0.3 * p})`;
      c.press = Math.max(0, c.press - 0.08);
    }
  }
  const loop = () => { tickCursors(performance.now()); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  // ---------- pieces ----------
  function showMachine() {
    machine.hidden = false; spentBox.hidden = false;
    machine.classList.remove('is-in'); void machine.offsetWidth; machine.classList.add('is-in');
  }
  function setSpent(v) {
    spent = v; spentBox.querySelector('span').textContent = fmt(spent);
    spentBox.classList.remove('is-hit'); void spentBox.offsetWidth; spentBox.classList.add('is-hit');
  }
  const toastList = [];
  function toast(user) {
    const t = el('div', 'ov-toast', toasts);
    const av = el('span', 'ov-toast__av', t); av.textContent = user.slice(0, 1).toUpperCase(); av.style.background = colorFor(user);
    const who = el('b', '', t); who.textContent = user; who.style.color = colorFor(user);
    t.append(document.createTextNode(' redeemed '));
    const rw = el('span', 'rw', t); rw.textContent = reward;
    const c = el('span', 'ov-toast__cost', t); c.innerHTML = `${PTS}<span></span>`; c.lastChild.textContent = fmt(cost);
    toastList.unshift(t);
    toastList.forEach((x, i) => {
      const y = 112 + i * 72, y0 = x.dataset.y ?? (y - 40);
      if (i === 0) x.animate([{ transform: `translateY(${y0}px) scale(.2, .2)`, opacity: 0 }, { transform: `translateY(${y - 8}px) scale(1.18, .82)`, opacity: 1, offset: 0.35 },
        { transform: `translateY(${y}px) scale(.92, 1.1)`, offset: 0.58 }, { transform: `translateY(${y}px) scale(1.04, .97)`, offset: 0.78 }, { transform: `translateY(${y}px) scale(1, 1)`, opacity: 1 }],
        { duration: 420, easing: 'linear', fill: 'forwards' });
      else x.animate([{ transform: `translateY(${y0}px)` }, { transform: `translateY(${y + 6}px) scale(1.03, .96)`, offset: 0.6 }, { transform: `translateY(${y}px)`, opacity: i > 2 ? 0 : 1 }],
        { duration: 300, easing: 'ease-out', fill: 'forwards' });
      x.dataset.y = y;
    });
    while (toastList.length > 4) toastList.pop().remove();
    setTimeout(() => {
      const i = toastList.indexOf(t); if (i < 0) return;
      toastList.splice(i, 1);
      t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).onfinish = () => t.remove();
    }, toastTTL);
    return t;
  }
  function pressCrank(user) {
    const c = moveCursor(user, CRANK.x + 30, CRANK.y - 6, 220);
    c.target.hold = 260;
    setTimeout(() => { c.press = 1; }, 220);
    mIn.querySelector('.crank__arm').animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(380deg)', offset: 0.8 }, { transform: 'rotate(360deg)' }],
      { duration: 700, delay: 230, easing: 'cubic-bezier(.45,0,.25,1)' });
    mIn.animate([{ transform: 'none' }, { transform: 'scale(1.06, .92)', offset: 0.28 }, { transform: 'scale(.96, 1.05)', offset: 0.55 }, { transform: 'scale(1.02, .98)', offset: 0.78 }, { transform: 'none' }],
      { duration: 460, delay: 220, easing: 'linear' });
    globe.stir(900, 1);
    machine.classList.add('is-busy'); setTimeout(() => machine.classList.remove('is-busy'), 1100);
    mIn.querySelector('.chute-glow').animate([{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], { duration: 500, delay: 650 });
  }
  function capsule(color, ssr) {
    const cap = el('div', 'ov-cap' + (ssr ? ' ssr' : ''), fly);
    cap.style.setProperty('--cap', color);
    el('i', 't', cap); el('i', 'b', cap); el('i', 'k', cap);
    return cap;
  }
  function artImg(e, parent) {
    const src = imageFor(e);
    if (!src) {   // no picture we can show: a silhouette with a question mark
      parent.style.background = 'radial-gradient(circle at 50% 38%, #3a447e 0 22%, transparent 23%), radial-gradient(ellipse at 50% 100%, #3a447e 0 46%, transparent 47%), #1d2457';
      return null;
    }
    const img = el('img', '', parent); img.alt = ''; img.decoding = 'sync'; img.src = src;
    img.onerror = () => { img.remove(); parent.style.background = '#1d2457'; };
    return img;
  }
  function dupeTag(e, parent) {
    const n = pulls.get(e.n) || 0;
    if (n > 1) { const d = el('span', 'ov-card__dupe', parent); d.textContent = `DUPE ×${n}`; }
  }
  function stamp(parent, delay, text = 'RETIRED') {
    const s = el('div', 'ov-stamp', parent); s.textContent = text;
    s.animate([{ transform: 'scale(3.2)', opacity: 0 }, { transform: 'scale(1.18, .78)', opacity: 1, offset: 0.55 }, { transform: 'scale(.93, 1.08)', offset: 0.75 },
      { transform: 'scale(1.03, .98)', offset: 0.9 }, { transform: 'scale(1)', opacity: 1 }], { duration: 340, delay, easing: 'linear', fill: 'backwards' });
    return s;
  }
  function pick() { return pool[Math.floor(rnd() * pool.length)]; }

  // ---------- one pull, opened big ----------
  const big = [];
  async function redeem(user, entry, o = {}) {
    entry = entry || pick();
    pulls.set(entry.n, (pulls.get(entry.n) || 0) + 1);
    const rar = rarityOf(entry, famous), R = RARITY[rar];
    if (!o.skipToast) toast(user);
    setSpent(spent + cost);
    if (!o.quick) pressCrank(user);
    else { const c = cursors.get(user); if (c) c.press = 1; }
    const tOut = o.quick ? 0 : (o.out ?? 900);    // capsule leaves the chute
    const tFly = o.quick ? 0 : (o.fly ?? 520);    // flight to the front
    const tShake = o.quick ? 0 : (o.shake ?? 600); // shaking before it pops
    const to = o.at || STAGE;
    // every stage starts on its own timer (not on the previous animation's end), so a scripted pull lands on its frame
    if (!o.quick) {
      await wait(tOut);
      globe.takeOne();
      const cap = capsule(CAP_TOPS[Math.floor(rnd() * CAP_TOPS.length)], rar === 'ssr' || rar === 'ur');
      cap.style.setProperty('--glow', R.color);
      cap.animate([
        { transform: `translate(${CHUTE.x}px, ${CHUTE.y}px) scale(.3) rotate(0deg)` },
        { transform: `translate(${(CHUTE.x + to.x) / 2 + 60}px, ${Math.min(CHUTE.y, to.y) - 120}px) scale(.9) rotate(-300deg)`, offset: 0.55 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(1.6) rotate(-540deg)` },
      ], { duration: tFly, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      await wait(tFly);
      cap.querySelector('.k').animate([{ opacity: 0 }, { opacity: 1 }], { duration: tShake, fill: 'forwards' });
      const amp = [[0, 1.95, 1.3], [9, 1.45, 1.8], [-9, 1.8, 1.45], [12, 1.45, 1.8], [-12, 1.85, 1.4], [15, 1.4, 1.85], [-15, 1.9, 1.35], [0, 1.6, 1.6]];
      cap.animate(amp.map(([d, sx, sy]) => ({ transform: `translate(${to.x}px, ${to.y}px) rotate(${d}deg) scale(${sx}, ${sy})` })), { duration: tShake, easing: 'linear', fill: 'forwards' });
      await wait(tShake);
      cap.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(${to.x}px, ${to.y}px) scale(2.2)` }], { duration: 160, fill: 'forwards' }).onfinish = () => cap.remove();
    } else globe.takeOne();
    // pop
    const st = o.at ? Object.assign(el('div', 'ov-stage', root), { style: `left:${to.x}px;top:${to.y}px` }) : stage;
    if (o.at) { el('div', 'ov-rays', st); el('div', 'ov-flash', st); }
    st.style.setProperty('--ray', R.glow.replace(/[\d.]+\)$/, '0.22)'));
    st.querySelector('.ov-flash').animate([{ opacity: 0 }, { opacity: 0.95 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    const rays = st.querySelector('.ov-rays');
    rays.animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
    for (let i = 0; i < 22; i++) {
      const s = el('div', 'ov-spark', st), a = rnd() * Math.PI * 2, d = 200 + rnd() * 240, sc = 0.6 + rnd() * 1.3;
      s.style.background = i % 3 ? R.color : '#fff';
      s.animate([{ transform: 'translate(0,0) scale(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d * 0.75}px, ${Math.sin(a) * d * 0.75}px) scale(${sc}) rotate(140deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 40}px) scale(0) rotate(260deg)`, opacity: 0 }], { duration: 800 + rnd() * 500, easing: 'cubic-bezier(.15,.8,.3,1)' }).onfinish = () => s.remove();
    }
    const card = el('div', 'ov-card', st);
    card.style.setProperty('--rc', R.color); card.style.setProperty('--rg', R.glow); card.style.setProperty('--uc', colorFor(user));
    const art = el('div', 'ov-card__art', card); artImg(entry, art);
    const rr = el('span', 'ov-card__rar', card); rr.textContent = R.tag;
    dupeTag(entry, card);
    const body = el('div', 'ov-card__body', card);
    const nm = el('h3', 'ov-card__name', body); nm.textContent = entry.n;
    const sb = el('p', 'ov-card__sub', body); sb.textContent = subOf(entry);
    const who = el('div', 'ov-card__who', card); who.append(document.createTextNode('pulled by '));
    const wb = el('b', '', who); wb.textContent = `@${user}`;
    const wc = el('span', '', who); wc.innerHTML = `${PTS}<span></span>`; wc.lastChild.textContent = `-${fmt(cost)}`;
    const scale = o.scale ?? 1;
    const k_ = scale;
    card.animate([{ transform: 'translateY(70px) scale(.12, .12) rotate(-10deg)', opacity: 0 },
      { transform: `translateY(-34px) scale(${k_ * .86}, ${k_ * 1.24}) rotate(4deg)`, opacity: 1, offset: 0.28 },
      { transform: `translateY(6px) scale(${k_ * 1.16}, ${k_ * .87}) rotate(-2deg)`, offset: 0.48 },
      { transform: `translateY(-4px) scale(${k_ * .95}, ${k_ * 1.06}) rotate(1deg)`, offset: 0.66 },
      { transform: `scale(${k_ * 1.025}, ${k_ * .98}) rotate(0deg)`, offset: 0.83 },
      { transform: `scale(${k_}, ${k_}) rotate(0deg)`, opacity: 1 }], { duration: 700, easing: 'linear', fill: 'forwards' });
    const ring = el('div', 'ov-ring', st); ring.style.setProperty('--rc', R.color);
    ring.animate([{ opacity: 1, transform: 'scale(.4)', borderWidth: '16px' }, { opacity: 0, transform: 'scale(4.2)', borderWidth: '2px' }], { duration: 420, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => ring.remove();
    for (let i = 0; i < 8; i++) {
      const hgt = el('div', 'ov-heart', st), a = -Math.PI / 2 + (rnd() - 0.5) * 2.6, d = 230 + rnd() * 160;
      hgt.style.setProperty('--hc', ['#ff9ad5', '#ffd98a', '#9fefc8', '#c9a8ff'][i % 4]);
      hgt.animate([{ transform: 'translate(0,0) scale(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d * .7}px, ${Math.sin(a) * d * .7}px) scale(1.5)`, opacity: 1, offset: .5 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 60}px) scale(.6)`, opacity: 0 }], { duration: 900 + rnd() * 400, easing: 'cubic-bezier(.15,.8,.3,1)' }).onfinish = () => hgt.remove();
    }
    if (entry.r) stamp(card, o.stampDelay ?? 420);
    big.push({ card, st, rays });
    return card;
  }
  // put a big card away (it shrinks into the pile)
  function stow(card, x, y, rot = 0, ms = 380, scale = 0.42) {
    const b = big.find((q) => q.card === card); if (!b) return;
    b.rays.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    const r0 = b.st.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const k = rr.width / 1920, sx = (r0.left - rr.left) / k, sy = (r0.top - rr.top) / k;
    card.animate([{ transform: getComputedStyle(card).transform }, { transform: `translate(${x - sx}px, ${y - sy}px) scale(${scale}) rotate(${rot}deg)` }],
      { duration: ms, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
  }

  // ---------- one pull in a frenzy: a small card into the pile ----------
  let pileN = 0;
  function burst(user, entry, o = {}) {
    entry = entry || pick();
    pulls.set(entry.n, (pulls.get(entry.n) || 0) + 1);
    const rar = rarityOf(entry, famous), R = RARITY[rar];
    if (o.toast !== false) toast(user);
    setSpent(spent + cost);
    if (o.press !== false) { const c = cursors.get(user) || addCursor(user); c.press = 1; }
    globe.takeOne();
    const cap = capsule(CAP_TOPS[Math.floor(rnd() * CAP_TOPS.length)], rar === 'ssr');
    const to = o.to || pileSpot(pileN++);
    const rot = o.rot ?? (rnd() - 0.5) * 34;
    const ms = o.fly ?? 360 + rnd() * 160;
    cap.animate([{ transform: `translate(${CHUTE.x}px, ${CHUTE.y}px) scale(.3)` }, { transform: `translate(${(CHUTE.x + to.x) / 2}px, ${Math.min(CHUTE.y, to.y) - 90 - rnd() * 120}px) scale(.8) rotate(-240deg)`, offset: 0.5 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(.9) rotate(-420deg)` }], { duration: ms, easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'forwards' })
      .onfinish = () => {
        cap.remove();
        const m = el('div', 'ov-mini', o.over ? pileOver() : pile);
        m.style.setProperty('--rc', R.color);
        const a = el('div', 'ov-mini__art', m); artImg(entry, a);
        const nm = el('div', 'ov-mini__name', m); nm.textContent = entry.n;
        const rr = el('div', 'ov-mini__rar', m); rr.textContent = R.tag;
        dupeTag(entry, m);
        const s = o.scale ?? 1;
        const T_ = `translate(${to.x}px, ${to.y}px) rotate(${rot}deg)`;
        m.animate([{ transform: `translate(${to.x}px, ${to.y}px) rotate(${rot * 2}deg) scale(.2, .2)`, opacity: 0 }, { transform: `${T_} scale(${s * 1.25}, ${s * .78})`, opacity: 1, offset: 0.32 },
          { transform: `${T_} scale(${s * .88}, ${s * 1.14})`, offset: 0.55 }, { transform: `${T_} scale(${s * 1.05}, ${s * .96})`, offset: 0.76 }, { transform: `${T_} scale(${s}, ${s})`, opacity: 1 }],
          { duration: 380, easing: 'linear', fill: 'forwards' });
        const f = el('div', 'ov-flash', m); f.style.cssText = 'left:-60px;top:-60px;width:290px;height:356px;border-radius:30px';
        f.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
        if (entry.r) stamp(m, 160);
      };
  }
  let over = null;
  function pileOver() { if (!over) { over = el('div', 'ov-pile over', root); } return over; }
  // the pile grows outward around the machine: rings of spots, left side first (toward the streamer) then right
  function pileSpot(i) {
    const ring = Math.floor(i / 14), k = i % 14;
    const a = (k / 14) * Math.PI * 2 + ring * 0.7 + (rnd() - 0.5) * 0.3;
    const rx = 300 + ring * 120 + rnd() * 40, ry = 250 + ring * 60 + rnd() * 30;
    let p = { x: GLOBE.x + Math.cos(a) * rx, y: 440 + Math.sin(a) * ry };
    if (avoid && p.x > avoid[0] && p.x < avoid[2] && p.y > avoid[1] && p.y < avoid[3]) p = { x: p.x, y: avoid[3] + 60 + rnd() * 220 };
    return p;
  }

  function setFrenzy(on) {
    machine.classList.toggle('is-frenzy', on);
    globe.setContinuous(on ? 0.6 : 0);
  }

  return { root, globe, showMachine, addCursor, moveCursor, redeem, burst, stow, setFrenzy, toast, pileSpot,
    get spent() { return spent; }, CHUTE, CRANK, GLOBE, STAGE };
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
