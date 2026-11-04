// The capsules inside the glass: small verlet physics in a circle. Pulls stir them; one sinks out of
// the bottom for each capsule dispensed and a fresh one drops in from the top.
export const CAPSULE_TOPS = ['#8fa6e8', '#e6c08c', '#5fc39a', '#f29bb8', '#b79cf0', '#6f7fd6', '#ffd98a', '#7cc7e8'];
const CREAM = '#f6f2ea';

export class Globe {
  constructor(canvas, count = 26) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.count = count;
    this.caps = [];
    this.stirUntil = 0;
    this.stirPower = 0;
    this.continuous = 0;
    this.acc = 0;
    this.last = performance.now();
    this.resize();
    for (let i = 0; i < count; i++) this.spawn(true);
    // settle before the first frame so the pile is resting when the page appears
    for (let i = 0; i < 360; i++) this.step(1 / 120);
    new ResizeObserver(() => this.resize()).observe(canvas);
    const loop = (t) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.acc += dt;
      while (this.acc >= 1 / 120) { this.step(1 / 120); this.acc -= 1 / 120; }
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const css = this.canvas.clientWidth || 400;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const old = this.size || css;
    this.size = css;
    this.canvas.width = Math.round(css * dpr);
    this.canvas.height = Math.round(css * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cx = css / 2; this.cy = css / 2;
    this.R = css / 2 - 4;
    this.r = this.R * 0.13;
    const k = css / old;
    if (k !== 1) for (const c of this.caps) { c.x *= k; c.y *= k; c.px *= k; c.py *= k; }
  }

  spawn(initial = false) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * this.R * 0.5;
    const x = this.cx + Math.cos(a) * d;
    const y = initial ? this.cy + Math.sin(a) * d : this.cy - this.R * 0.62;
    this.caps.push({
      x, y, px: x - (Math.random() - 0.5) * 2, py: y, angle: Math.random() * Math.PI * 2, spin: 0,
      top: CAPSULE_TOPS[Math.floor(Math.random() * CAPSULE_TOPS.length)], alpha: initial ? 1 : 0, leaving: 0,
    });
  }

  /** Swirl the capsules for `ms` milliseconds. */
  stir(ms = 900, power = 1) {
    this.stirUntil = Math.max(this.stirUntil, performance.now() + ms);
    this.stirPower = Math.max(this.stirPower, power);
  }

  /** Keep stirring until set back to 0 (chat frenzy). */
  setContinuous(power) { this.continuous = power; }

  /** The lowest capsule sinks out of the chute; a new one falls in a moment later. */
  takeOne() {
    let low = null;
    for (const c of this.caps) if (!c.leaving && (!low || c.y > low.y)) low = c;
    if (!low) return CAPSULE_TOPS[0];
    low.leaving = 1;
    setTimeout(() => this.spawn(false), 700 + Math.random() * 500);
    return low.top;
  }

  step(dt) {
    const now = performance.now();
    const stirring = now < this.stirUntil ? this.stirPower : this.continuous;
    if (now >= this.stirUntil) this.stirPower = 0;
    const s = this.R / 220;
    const g = 1500 * s;
    const { cx, cy, R, r } = this;
    for (const c of this.caps) {
      let ax = 0, ay = g;
      if (stirring > 0) {
        const dx = c.x - cx, dy = c.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        // round and round, with a kick up from the floor like the paddle under real machines
        ax += (-dy / d) * 900 * s * stirring;
        ay += (dx / d) * 900 * s * stirring;
        if (dy > -R * 0.1) ay -= (1800 + Math.random() * 4200) * s * stirring * (0.4 + dy / R);
        ax += (Math.random() - 0.5) * 3000 * s * stirring;
      }
      const vx = (c.x - c.px) * 0.995, vy = (c.y - c.py) * 0.995;
      c.px = c.x; c.py = c.y;
      c.x += vx + ax * dt * dt;
      c.y += vy + ay * dt * dt;
      c.spin = c.spin * 0.97 + vx * 0.03 / (r / 20);
      c.angle += c.spin * 0.25;
      if (c.leaving) {
        c.leaving += dt * 2.2;
        c.alpha = Math.max(0, 1.6 - c.leaving);
      } else if (c.alpha < 1) c.alpha = Math.min(1, c.alpha + dt * 3);
    }
    this.caps = this.caps.filter((c) => c.alpha > 0 || !c.leaving);
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < this.caps.length; i++) {
        const a = this.caps[i];
        if (a.leaving) continue;
        for (let j = i + 1; j < this.caps.length; j++) {
          const b = this.caps[j];
          if (b.leaving) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy, min = r * 2;
          if (d2 < min * min && d2 > 1e-6) {
            const d = Math.sqrt(d2), push = (min - d) / 2;
            const nx = dx / d, ny = dy / d;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
        }
      }
      for (const c of this.caps) {
        const dx = c.x - cx, dy = c.y - cy;
        const d = Math.hypot(dx, dy);
        const lim = c.leaving ? R + r * 3 : R - r;
        if (d > lim) { c.x = cx + dx / d * lim; c.y = cy + dy / d * lim; }
      }
    }
  }

  draw() {
    const { ctx, size, r } = this;
    ctx.clearRect(0, 0, size, size);
    for (const c of this.caps) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.translate(c.x, c.y);
      // contact shadow
      ctx.fillStyle = 'rgba(5,8,30,.28)';
      ctx.beginPath(); ctx.ellipse(r * 0.08, r * 0.16, r * 1.02, r * 0.98, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(c.angle);
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = c.top; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.closePath();
      ctx.fillStyle = CREAM; ctx.fill();
      // seam band
      ctx.fillStyle = 'rgba(20,24,60,.28)';
      ctx.fillRect(-r, -r * 0.06, r * 2, r * 0.12);
      // shading + shine
      const shade = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      shade.addColorStop(0, 'rgba(255,255,255,.55)');
      shade.addColorStop(0.45, 'rgba(255,255,255,0)');
      shade.addColorStop(1, 'rgba(10,14,50,.32)');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = shade; ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.strokeStyle = 'rgba(18,22,58,.45)';
      ctx.stroke();
      ctx.restore();
    }
  }
}
