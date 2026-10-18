import { Sword } from './sword.js';

export class Pickaxe extends Sword {
  static color = '#4b7b9a';
  static icon = 'pickaxe_icon.png';

  constructor(player) {
    super(player);
    this.image.src = 'pickaxe.png';
    // keep base damage constant; pickaxe's power is in chipping opponents
    this.damage = 1;
    this.particles = []; // NEW: hit particles
    this.chipping = 1;   // NEW: independent chipping percentage (starts at 1%)
  }

  onHit(defender) {
    // Chip away by current damage percent (e.g., damage=1 => 1%, 1.2 => 1.2%)
    if (!defender || !defender.isAlive) return;
    const roundUp2 = (v) => Math.ceil(v * 100) / 100;

    // Ensure current chipping reflects the latest damage value
    const chipPercent = Math.max(0, this.chipping || 0); // use independent chipping stat
    const factor = Math.max(0, 1 - (chipPercent / 100));

    // Size and mass
    defender.radius = roundUp2(Math.max(6, defender.radius * factor));
    defender.mass = defender.radius * defender.radius;

    // Speed and velocity (preserve direction)
    defender.speed = roundUp2(Math.max(0.5, defender.speed * factor));
    const ang = Math.atan2(defender.vy || 0, defender.vx || 1);
    defender.vx = Math.cos(ang) * defender.speed;
    defender.vy = Math.sin(ang) * defender.speed;

    // Chip common weapon stats proportionally and round up to 2 decimals
    const w = defender.weapon;
    if (w) {
      const scaleNum = (val, min = 0) => (typeof val === 'number' ? roundUp2(Math.max(min, val * factor)) : val);
      w.damage = scaleNum(w.damage, 0);
      w.spinRate = scaleNum(w.spinRate, 0);
      w.spearLength = scaleNum(w.spearLength, 0.1);
      w.heal = scaleNum(w.heal, 0);
      w.maxBounces = scaleNum(w.maxBounces, 0);
      // NEW: also chip Staff/Bomb style explosion stat
      w.damageRadius = scaleNum(w.damageRadius, 0.1);

      // Ranged cadence fields (reduce arrows/s and keep interval in sync; round arrows/s up to 2 decimals)
      if (typeof w.arrowsPerSecond === 'number') {
        w.arrowsPerSecond = roundUp2(Math.max(0, w.arrowsPerSecond * factor));
        if (typeof w.shootInterval === 'number' && w.arrowsPerSecond > 0) {
          w.shootInterval = Math.max(1, Math.floor(24 / w.arrowsPerSecond));
        }
      }
      // Custom weapons: reduce fire rate (shots/sec) -> increase ms per shot; round result up to 2 decimals (ms precision)
      if (typeof w._fireRateMs === 'number' && isFinite(w._fireRateMs)) {
        w._fireRateMs = roundUp2(Math.max(50, w._fireRateMs / Math.max(0.0001, factor)));
      }
    }

    // Increase chipping by +0.5% and damage by +0.5 each successful hit
    this.chipping = roundUp2((this.chipping || 0) + 0.5);
    this.damage = roundUp2((this.damage || 0) + 0.5);

    // NEW: spawn hit particles colored like the defender
    const col = defender.originalColorRgb || { r: 255, g: 255, b: 255 };
    const n = 10;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 3;
      this.particles.push({
        x: defender.x + (Math.random() - 0.5) * 8,
        y: defender.y + (Math.random() - 0.5) * 8,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1.0,
        r: 2 + Math.random() * 4,
        alpha: 1,
        cr: col.r, cg: col.g, cb: col.b
      });
    }
  }

  playHitSound() {
    import('../audio.js').then(m => m.playPickaxeHitSound && m.playPickaxeHitSound());
  }

  // Make the pickaxe visually smaller than the sword
  draw(ctx) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;
    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.angle);
    const s = this.getScale();
    const drawW = 90 * s; // smaller than sword's 120
    const drawH = drawW * (this.image.naturalHeight / this.image.naturalWidth);
    const x = this.player.radius;
    const y = -drawH / 2;
    ctx.drawImage(this.image, x, y, drawW, drawH);
    ctx.restore();

    // NEW: draw hit particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${p.alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(0,0,0,${Math.max(0, p.alpha)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  getDamageDisplayText() {
    const roundUp2 = (v) => Math.ceil(v * 100) / 100;
    const chip = roundUp2(Math.min(100, this.chipping || 0));
    const dmg = roundUp2(this.damage || 0);
    return `<span class="stat-smaller">Chipping: ${chip}%<br>Damage: ${dmg}</span>`;
  }

  // NEW: precise hitbox aligned to texture geometry
  getCollisionPoints() {
    const pts = this._points; pts.length = 0;

    const s = this.getScale();
    const drawW = 90 * s;
    const drawH = drawW * (this.image.naturalHeight / this.image.naturalWidth || 1);

    const startDist = this.player.radius; // same as draw()
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);

    const samples = Math.max(5, Math.ceil(drawW / (20 * s)));
    const step = samples > 1 ? (drawW / (samples - 1)) : 0;
    const r = Math.max(6 * s, (drawH * 0.5) * 0.5);

    for (let i = 0; i < samples; i++) {
      const d = startDist + i * step;
      pts.push({ x: this.player.x + d * ca, y: this.player.y + d * sa, radius: r });
    }
    return pts;
  }

  // NEW: advance/fade hit particles each frame
  update(isPlayerStunned) {
    super.update(isPlayerStunned);
    if (!this.particles || !this.particles.length) return;
    const keep = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.vy += 0.15;
      p.x += p.vx; p.y += p.vy;
      p.alpha -= 0.04;
      if (p.alpha > 0) keep.push(p);
    }
    this.particles = keep;
  }
}