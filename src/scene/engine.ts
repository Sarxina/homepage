// The library scene: the illustration's separate pieces, drawn on a canvas and moved every frame.
// Everything is positioned in the illustration's own pixels (4160 x 2341) and a camera fits that to the screen.

export type RigData = {
  world: [number, number];
  glint: [number, number];
  order: string[];
  parts: Record<string, { left: number; top: number; w: number; h: number; file: string }>;
  rig: Record<string, { parent: string | null; k: number; lag: number; pivot: [number, number] | null }>;
  books: { name: string; file: string; left: number; top: number; w: number; h: number; front: boolean }[];
};

export type BookSpot = { name: string; x: number; y: number; r: number };

type Mat = [number, number, number, number, number, number]; // a b c d e f, as the canvas takes them

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const move = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const turnAbout = (px: number, py: number, deg: number): Mat => {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return [c, s, -s, c, px - c * px + s * py, py - s * px - c * py];
};
const apply = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOut = (u: number) => 1 - Math.pow(1 - clamp(u, 0, 1), 4);

const EYES = new Set(['White eyes', 'Pupil 1', 'Pupil 2', 'Lashes 1', 'Lashes 2', 'Bottom lashes 1', 'Bottom lashes 2']);
const GOLD = '255, 214, 130';
const INTRO_SECONDS = 1.15;
const DRAG_HISTORY = 40; // frames of drag kept, so loose pieces can follow late

// How deep each layer sits: the pointer slides near layers further than far ones.
const DEPTH = { background: 0.25, backBooks: 0.6, character: 1, frontBooks: 1.35 };

export class LibraryScene {
  private ctx: CanvasRenderingContext2D;
  private images = new Map<string, HTMLImageElement>();
  private background!: HTMLImageElement;
  private light!: HTMLImageElement;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private raf = 0;
  private last = 0;
  private clock = 0;
  private started = -1;
  private running = false;
  private still = false;

  private pointerX = 0.5; // 0 to 1 across the view
  private pointerY = 0.4;
  private easedX = 0.5;
  private easedY = 0.4;
  private wind = 0;
  private drag = 0;
  private dragSpeed = 0;
  private dragLog: number[] = new Array(DRAG_HISTORY).fill(0);
  private pupilX = 0;
  private pupilY = 0;
  private nextBlink = 2.5;
  private blinkUntil = 0;
  private glintAt = -10;
  private zoom = 0;
  private hovered = '';
  private dust: { x: number; y: number; r: number; speed: number; phase: number }[] = [];
  private sparks: { x: number; y: number; vx: number; vy: number; born: number; life: number; r: number }[] = [];

  onBooks: (spots: BookSpot[]) => void = () => {};

  constructor(
    private canvas: HTMLCanvasElement,
    private rig: RigData,
  ) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 70; i++) {
      this.dust.push({ x: Math.random() * rig.world[0], y: Math.random() * rig.world[1], r: 2 + Math.random() * 5, speed: 12 + Math.random() * 30, phase: Math.random() * 6.28 });
    }
  }

  async load(base: string) {
    const get = (file: string) =>
      new Promise<HTMLImageElement>((done, fail) => {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => fail(new Error('could not load ' + file));
        img.src = base + file;
      });
    const names = [...this.rig.order.map((n) => this.rig.parts[n].file), ...this.rig.books.map((b) => b.file)];
    const [background, light, ...rest] = await Promise.all([get('background.webp'), get('light.webp'), ...names.map(get)]);
    this.background = background;
    this.light = light;
    names.forEach((file, i) => this.images.set(file, rest[i]));
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = box.width;
    this.height = box.height;
    this.canvas.width = Math.round(box.width * this.dpr);
    this.canvas.height = Math.round(box.height * this.dpr);
    const [W, H] = this.rig.world;
    const tall = box.height > box.width * 1.05;
    // A wide view shows the whole room. A tall one moves in on him, and leaves the lower part of the screen to the links.
    const viewH = tall ? box.height * 0.66 : box.height;
    this.scale = Math.max(box.width / W, viewH / H) * (tall ? 1.42 : 1.04);
    const focusX = tall ? 1010 : 1560;
    const focusY = tall ? 760 : 1120;
    this.offsetX = clamp(box.width * (tall ? 0.5 : 0.44) - focusX * this.scale, box.width - W * this.scale, 0);
    this.offsetY = clamp(viewH * 0.5 - focusY * this.scale, viewH - H * this.scale, 0);
    if (this.still) this.draw(0);
  }

  start(still: boolean) {
    this.still = still;
    this.resize();
    if (still) {
      this.started = -10;
      this.draw(0);
      return;
    }
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.draw(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resume() {
    if (this.running || this.still) return;
    this.start(false);
  }

  setPointer(clientX: number, clientY: number, speedX: number) {
    const box = this.canvas.getBoundingClientRect();
    this.pointerX = clamp((clientX - box.left) / box.width, 0, 1);
    this.pointerY = clamp((clientY - box.top) / box.height, 0, 1);
    this.wind = clamp(this.wind + speedX / 900, -1.2, 1.2);
    if (Math.abs(speedX) > 6 && Math.random() < 0.35) {
      this.sparks.push({ x: clientX - box.left, y: clientY - box.top, vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 50, born: this.clock, life: 0.5 + Math.random() * 0.4, r: 1 + Math.random() * 2.2 });
    }
  }

  setHovered(book: string) {
    this.hovered = book;
  }

  setZoom(amount: number) {
    this.zoom = clamp(amount, 0, 1);
  }

  /** a tap on him: the glasses glint and he is knocked back a little */
  poke() {
    this.glintAt = this.clock;
    this.dragSpeed += 9;
  }

  private layer(depth: number): Mat {
    const reach = 26 * depth;
    const zoom = 1 + this.zoom * 0.16 * depth;
    const s = this.scale * zoom;
    const cx = this.width / 2;
    const cy = this.height / 2;
    return [s * this.dpr, 0, 0, s * this.dpr, (cx + (this.offsetX - cx) * zoom - (this.easedX - 0.5) * reach) * this.dpr, (cy + (this.offsetY - cy) * zoom - (this.easedY - 0.5) * reach * 0.6) * this.dpr];
  }

  private draw(dt: number) {
    const ctx = this.ctx;
    const rig = this.rig;
    this.clock += dt;
    const t = this.clock;
    if (this.started < 0 && !this.still) this.started = t;
    const intro = this.still ? 1 : easeOut((t - this.started) / INTRO_SECONDS);

    // the pointer, eased; the wind it makes dies away; the drag is a spring chasing the wind
    this.easedX += (this.pointerX - this.easedX) * Math.min(1, dt * 4);
    this.easedY += (this.pointerY - this.easedY) * Math.min(1, dt * 4);
    this.wind *= Math.pow(0.02, dt);
    const flying = intro < 0.82 ? 1 : 0;
    const target = this.wind + flying + 0.1 * Math.sin(t * 1.1);
    this.dragSpeed += ((target - this.drag) * 60 - this.dragSpeed * 7) * dt;
    this.drag += this.dragSpeed * dt;
    this.dragLog.unshift(this.drag);
    this.dragLog.length = DRAG_HISTORY;
    const dragAt = (lag: number) => this.dragLog[Math.min(DRAG_HISTORY - 1, Math.round(lag * 60))];

    if (t > this.nextBlink && !this.still) {
      this.blinkUntil = t + 0.13;
      this.nextBlink = t + (Math.random() < 0.2 ? 0.32 : 2.4 + Math.random() * 3.6);
    }
    const blinking = t < this.blinkUntil;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // the room
    const back = this.layer(DEPTH.background);
    ctx.setTransform(...back);
    ctx.drawImage(this.background, -60, -34, rig.world[0] + 120, rig.world[1] + 68);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.72 + 0.1 * Math.sin(t * 0.7);
    ctx.drawImage(this.light, -60, -34, rig.world[0] + 120, rig.world[1] + 68);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const spots: BookSpot[] = [];
    const drawBooks = (front: boolean) => {
      const cam = this.layer(front ? DEPTH.frontBooks : DEPTH.backBooks);
      rig.books.forEach((b, i) => {
        if (b.front !== front) return;
        const cx = b.left + b.w / 2;
        const cy = b.top + b.h / 2;
        const lift = this.hovered === b.name ? -18 : 0;
        const m = mul(cam, mul(move(Math.sin(t * 0.5 + i * 1.7) * 10, Math.sin(t * 0.8 + i * 2.3) * 16 + lift + (1 - intro) * 260 * (i % 2 ? 1 : -1)), turnAbout(cx, cy, Math.sin(t * 0.6 + i) * 3.2)));
        ctx.setTransform(...m);
        if (this.hovered === b.name) {
          ctx.shadowColor = `rgba(${GOLD}, 0.95)`;
          ctx.shadowBlur = 46 * this.dpr;
        }
        ctx.globalAlpha = intro;
        ctx.drawImage(this.images.get(b.file)!, b.left, b.top, b.w, b.h);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        const [sx, sy] = apply(m, cx, cy);
        spots.push({ name: b.name, x: sx / this.dpr, y: sy / this.dpr, r: (Math.max(b.w, b.h) * this.scale) / 2 });
      });
    };
    drawBooks(false);

    // him: flown in from the corner on arrival, then afloat
    const cam = this.layer(DEPTH.character);
    const root = rig.rig['Torso'].pivot!;
    const body = mul(
      move((1 - intro) * -2300 + Math.sin(t * 0.45) * 8, (1 - intro) * 1100 + Math.sin(t * 0.9) * 13),
      turnAbout(root[0], root[1], (1 - intro) * -22 + Math.sin(t * 0.6) * 0.9),
    );
    const head = apply(mul(cam, body), rig.glint[0], rig.glint[1]);
    const lookX = this.pointerX * this.width * this.dpr - head[0];
    const lookY = this.pointerY * this.height * this.dpr - head[1];
    const far = Math.hypot(lookX, lookY) || 1;
    const pull = Math.min(1, far / (220 * this.dpr));
    this.pupilX += ((lookX / far) * 5.5 * pull - this.pupilX) * Math.min(1, dt * 10);
    this.pupilY += ((lookY / far) * 3.5 * pull - this.pupilY) * Math.min(1, dt * 10);

    const posed = new Map<string, Mat>();
    const poseOf = (name: string): Mat => {
      const done = posed.get(name);
      if (done) return done;
      const node = rig.rig[name];
      let m = node.parent ? poseOf(node.parent) : IDENTITY;
      if (node.k && node.pivot) {
        const sway = 0.07 * Math.sin(t * 1.3 + name.length * 1.9);
        m = mul(m, turnAbout(node.pivot[0], node.pivot[1], node.k * (dragAt(node.lag) + sway)));
      }
      if (name.startsWith('Pupil')) m = mul(m, move(this.pupilX, this.pupilY));
      posed.set(name, m);
      return m;
    };
    for (const name of rig.order) {
      if (blinking && EYES.has(name)) continue;
      const p = rig.parts[name];
      ctx.setTransform(...mul(cam, mul(body, poseOf(name))));
      ctx.drawImage(this.images.get(p.file)!, p.left, p.top, p.w, p.h);
    }

    drawBooks(true);
    this.onBooks(spots);

    // gold dust in the window light
    ctx.setTransform(...this.layer(0.8));
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.dust) {
      const y = (((d.y - t * d.speed) % rig.world[1]) + rig.world[1]) % rig.world[1];
      const x = d.x + Math.sin(t * 0.4 + d.phase) * 40;
      const glow = 0.25 + 0.3 * Math.sin(t * 1.7 + d.phase);
      if (glow <= 0) continue;
      ctx.fillStyle = `rgba(${GOLD}, ${glow})`;
      ctx.beginPath();
      ctx.arc(x, y, d.r, 0, 6.283);
      ctx.fill();
    }

    // sparks shed by the pointer
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.sparks = this.sparks.filter((s) => t - s.born < s.life);
    for (const s of this.sparks) {
      const age = t - s.born;
      ctx.fillStyle = `rgba(${GOLD}, ${0.9 * (1 - age / s.life)})`;
      ctx.beginPath();
      ctx.arc(s.x + s.vx * age, s.y + s.vy * age, s.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // the glint on his glasses: focus lines close in, a four-point star opens and turns
    const since = t - this.glintAt;
    if (since >= 0 && since < 0.7) {
      const gx = head[0] / this.dpr;
      const gy = head[1] / this.dpr;
      const fade = since < 0.08 ? since / 0.08 : 1 - clamp((since - 0.4) / 0.3, 0, 1);
      ctx.fillStyle = `rgba(16, 20, 52, ${0.42 * fade})`;
      ctx.fillRect(0, 0, this.width, this.height);
      const seed = Math.floor(t * 30);
      let rnd = seed * 9301 + 49297;
      const next = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
      ctx.fillStyle = `rgba(255, 246, 225, ${0.85 * fade})`;
      const reach = Math.hypot(this.width, this.height);
      for (let i = 0; i < 46; i++) {
        const a = next() * 6.283;
        const half = 0.004 + next() * 0.014;
        const inner = (220 + next() * 190) * (this.scale * 2.6);
        ctx.beginPath();
        ctx.moveTo(gx + Math.cos(a) * inner, gy + Math.sin(a) * inner);
        ctx.lineTo(gx + Math.cos(a - half) * reach, gy + Math.sin(a - half) * reach);
        ctx.lineTo(gx + Math.cos(a + half) * reach, gy + Math.sin(a + half) * reach);
        ctx.fill();
      }
      const size = 150 * this.scale * 2.2 * Math.sin(clamp(since / 0.18, 0, 1) * 1.5708) * (1 - 0.4 * clamp((since - 0.3) / 0.4, 0, 1));
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(0.35 + since * 2.2);
      ctx.shadowColor = `rgba(${GOLD}, 1)`;
      ctx.shadowBlur = 30;
      ctx.fillStyle = `rgba(255, 252, 240, ${fade})`;
      for (let k = 0; k < 4; k++) {
        ctx.rotate(1.5708);
        const long = size * (k % 2 ? 0.62 : 1);
        ctx.beginPath();
        ctx.moveTo(-size * 0.07, 0);
        ctx.lineTo(0, -long);
        ctx.lineTo(size * 0.07, 0);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.13, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
  }
}
