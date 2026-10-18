import { Sword } from './sword.js';
import { players as playersRef } from '../state.js';
import { playWrenchHitSound } from '../audio.js';

export class Wrench extends Sword {
  static color = '#f3a310';
  static icon = 'wrench_icon.png';

  constructor(player) {
    super(player);
    this.image.src = 'wrench.png';
    this.damage = 1; // always 1
  }

  // Override sword growth: no scaling on hit, just spawn a turret
  onHit(defender) {
    // no stat scaling
  }

  onSuccessfulHit() {
    super.onSuccessfulHit();
    if (this.isMenuContext) return;
    // spawn moved to collision.js at the actual hit location
  }

  // Make the wrench visually smaller than the sword
  draw(ctx) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;
    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.angle);
    const s = this.getScale();
    const size = 92 * s; // was 80; slightly larger as requested
    const aspect = this.image.naturalHeight / this.image.naturalWidth;
    const h = size * aspect;
    const x = this.player.radius;
    const y = -h / 2;
    ctx.drawImage(this.image, x, y, size, h);
    ctx.restore();
  }

  getCollisionPoints() {
    const pts = this._points; pts.length = 0;

    const s = this.getScale();
    const size = 92 * s;
    const drawH = size * (this.image.naturalHeight / this.image.naturalWidth || 1);

    const startDist = this.player.radius; // same forward offset as draw()
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);

    const samples = Math.max(5, Math.ceil(size / (20 * s)));
    const step = samples > 1 ? (size / (samples - 1)) : 0;
    const r = Math.max(6 * s, (drawH * 0.5) * 0.5);

    for (let i = 0; i < samples; i++) {
      const d = startDist + i * step;
      pts.push({ x: this.player.x + d * ca, y: this.player.y + d * sa, radius: r });
    }
    return pts;
  }

  getDamageDisplayText() {
    const count = (window.turretField && typeof window.turretField.getTurretCount === 'function')
      ? window.turretField.getTurretCount()
      : 0;
    return `Turrets: ${count}`;
  }

  // NEW: play wrench-specific hit sound
  playHitSound() {
    playWrenchHitSound();
  }
}

// --- Turret manager (global, single) ---
function ensureTurretField() {
  if (window.turretField) return;
  const turrets = [];
  const bullets = [];

  function addTurret(x, y, team, owner, color) {
    const scaleFactor = owner && owner.isBoss ? Math.max(1, owner.radius / 35) : 1;
    turrets.push({
      x, y,
      r: 16 * scaleFactor, // was 18 — slightly smaller turrets
      angle: Math.random() * Math.PI * 2,
      fireCd: 0,
      team: team || null,
      owner: owner || null,
      color: color || (owner && owner.originalColor) || getTeamColor(team) // UPDATED: allow custom color
    });
  }

  function update(canvas) {
    const w = canvas.width, h = canvas.height;
    turrets.forEach(t => {
      const scaleFactor = t.r / 16; // recover scale factor from radius
      t.angle += 0.05;
      if (t.fireCd > 0) t.fireCd--;
      if (t.fireCd <= 0) {
        const baseSpeed = 8;
        const speed = baseSpeed * Math.max(1, scaleFactor * 0.85);
        const vx = Math.cos(t.angle) * speed;
        const vy = Math.sin(t.angle) * speed;
        const bulletR = 4 * Math.max(1, scaleFactor * 0.9); // was 5 — slightly smaller bullets
        bullets.push({
          x: t.x + Math.cos(t.angle) * (t.r + 10),
          y: t.y + Math.sin(t.angle) * (t.r + 10),
          vx, vy, r: bulletR, life: 180,
          team: t.team || null, owner: t.owner || null, baseRadius: bulletR,
          color: t.color /* NEW: carry turret/owner color onto bullets */
        });
        t.fireCd = Math.max(18, Math.floor(36 / Math.max(1, scaleFactor))); // larger turret fires a bit faster
      }
    });

    // move bullets
    let wKeep = 0;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;
      // arrows-like behavior: destroy on wall impact (no bounce)
      if (b.x < b.r || b.x > w - b.r || b.y < b.r || b.y > h - b.r) {
        b.life = 0;
      }
      // NEW: collide bullets with custom blocks (treat as arrows -> destroy on hit)
      if (window.customMap && typeof window.customMap.collideProjectile === 'function') {
        window.customMap.collideProjectile(b, 'arrow', false);
      }
      if (b.life > 0) bullets[wKeep++] = b;
    }
    bullets.length = wKeep;

    // bullets vs turrets (block)
    bullets.forEach(b => {
      turrets.forEach(t => {
        // allow blocking regardless of team so enemy turrets clearly interact with boss and others
        const dx = b.x - t.x, dy = b.y - t.y, rr = (b.r + t.r);
        if (dx*dx + dy*dy < rr*rr) {
          b.life = 0;
        }
      });
    });

    // bullets vs players (damage)
    {
      const plist = playersRef;
      bullets.forEach(b => {
        for (const p of plist) {
          if (!p.isAlive) continue;
          if (b.owner && p === b.owner) continue; // do not damage the wrench owner
          if (p.team && b.team && p.team === b.team) continue; // no friendly fire
          const dx = p.x - b.x, dy = p.y - b.y, rr = (p.radius + b.r);
          if (dx*dx + dy*dy <= rr*rr) {
            p.health -= 1;
            p.stun(6);
            b.life = 0;
          }
        }
      });
    }
    // cull dead bullets
    let keep = 0;
    for (let i = 0; i < bullets.length; i++) if (bullets[i].life > 0) bullets[keep++] = bullets[i];
    bullets.length = keep;
  }

  function draw(ctx) {
    turrets.forEach(t => {
      const scaleFactor = t.r / 16;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = t.color || '#f3a310';
      ctx.strokeStyle = '#000';
      // Match boss outline width if owner is the boss
      const outlineWidth = (t.owner && t.owner.isBoss) ? Math.max(5, Math.round(t.owner.radius * 0.06)) : 2;
      ctx.lineWidth = outlineWidth;
      ctx.beginPath();
      ctx.rect(0, -6 * scaleFactor, (t.r + 12) * 1.2, 12 * scaleFactor);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = t.color || '#f3a310';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = outlineWidth;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });

    bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fillStyle = b.color || '#000'; /* UPDATED: color bullets by turret/owner */
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function collidePlayer(p) {
    turrets.forEach(t => {
      // circle-circle collision resolve with reflection
      const dx = p.x - t.x, dy = p.y - t.y;
      const rr = p.radius + t.r;
      const d2 = dx*dx + dy*dy;
      if (d2 < rr*rr) {
        const dist = Math.sqrt(d2) || 0.00001;
        const nx = dx / dist, ny = dy / dist;
        const pen = rr - dist;
        p.x += nx * pen; p.y += ny * pen;
        const vn = p.vx * nx + p.vy * ny;
        p.vx = p.vx - (1 + 1.0) * vn * nx;
        p.vy = p.vy - (1 + 1.0) * vn * ny;
      }
    });
  }

  function collideProjectile(proj, kind) {
    // treat like blocks: arrows destroyed, shuriken reflect with bounce decrement
    turrets.forEach(t => {
      const r = kind === 'shuriken' ? Math.max(10, proj.collisionRadius || 14) : Math.max(8, proj.baseRadius || 12);
      const dx = proj.x - t.x, dy = proj.y - t.y, rr = r + t.r;
      if (dx*dx + dy*dy < rr*rr) {
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.00001;
        const nx = dx / dist, ny = dy / dist;
        // push out
        const pen = rr - dist;
        proj.x += nx * pen; proj.y += ny * pen;
        if (kind === 'arrow') {
          proj.life = 0;
          if (proj.onExplode) proj.onExplode();
        } else if (kind === 'staff') {
          proj.life = 0;
          if (proj.onExplode) proj.onExplode();
        } else {
          const vn = proj.vx * nx + proj.vy * ny;
          proj.vx = proj.vx - (1 + 1.0) * vn * nx;
          proj.vy = proj.vy - (1 + 1.0) * vn * ny;
          if (typeof proj.bouncesLeft === 'number') proj.bouncesLeft--;
          proj.angle = Math.atan2(proj.vy, proj.vx);
        }
      }
    });
  }

  function clear() {
    turrets.length = 0;
    bullets.length = 0;
  }

  window.turretField = { addTurret, update, draw, collidePlayer, collideProjectile, clear, getTurretCount: () => turrets.length };
}

// Expose initializer so other systems (e.g., Shield reflect) can spawn turrets too.
if (typeof window !== 'undefined') {
  window.ensureTurretField = ensureTurretField;
}

/* Helpers */
function getTeamColor(team) {
  if (team === 'blue') return '#2196f3';
  if (team === 'red') return '#f44336';
  return '#f3a310';
}