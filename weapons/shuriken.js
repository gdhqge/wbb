// Shuriken implementation (ranged, projectiles bounce; increases max bounces on hit)
import { Weapon } from './base.js';
import { playShurikenThrowSound, playShurikenBounceSound, playHitHurtSound } from '../audio.js';

export class Shuriken extends Weapon {
  static color = '#86910E';
  static icon = 'shuriken.png';
  static MAX_PROJECTILES = 40;

  constructor(player) {
    super(player);
    this.image.src = 'shuriken.png';
    this.projectileImage = this.image; // same asset
    this.projectiles = [];
    this.damage = 1;

    // Start with 1 allowed bounce per shuriken
    this.maxBounces = 1;

    // Firing cadence
    this.shootInterval = 28; // a bit slower than bow default
    this.shootTimer = 0;

    // Flight characteristics
    this.baseSpeed = 12;
    this.spinRate = 0.35; // how fast the thrown shuriken spins visually
    this.size = 54; // projectile draw size

    // Cache canvas for bounds
    this._canvas = document.getElementById('gameCanvas');
  }

  update(isPlayerStunned) {
    if (!isPlayerStunned) {
      // idle rotate weapon (not necessary for a held shuriken, but keeps parity)
      this.angle += 0.05 * this.spinDirection;

      // shoot cadence
      this.shootTimer--;
      if (this.shootTimer <= 0) {
        this.shootProjectile();
        this.shootTimer = this.shootInterval;
      }
    }

    this.updateProjectiles();
  }

  shootProjectile() {
    const ca = Math.cos(this.angle);
    const sa = Math.sin(this.angle);

    // Spawn in front of player
    const forwardFromOrigin = this.player.radius + 38;
    const startX = this.player.x + ca * forwardFromOrigin;
    const startY = this.player.y + sa * forwardFromOrigin;

    const proj = {
      x: startX,
      y: startY,
      vx: ca * this.baseSpeed,
      vy: sa * this.baseSpeed,
      angle: this.angle,
      spin: this.spinRate * (this.spinDirection || 1),
      bouncesLeft: this.maxBounces,
      life: 240, // hard cap on lifetime
      parryCooldown: 0,
      // NEW: annotate for deflection-damage system
      kind: 'shuriken',
      deflected: false,
      lastDeflectedBy: null,
      deflectedFrames: 0,
      collisionRadius: Math.max(12, 14 * this.getScale())
    };

    if (this.projectiles.length >= Shuriken.MAX_PROJECTILES) {
      this.projectiles.shift();
    }
    this.projectiles.push(proj);

    // Play throw SFX (only in game, not in menu)
    if (!this.isMenuContext) {
      playShurikenThrowSound();
    }
  }

  updateProjectiles() {
    const canvas = this._canvas;

    // OPTIMIZED: compact in-place instead of filter
    let write = 0;
    for (let read = 0; read < this.projectiles.length; read++) {
      const p = this.projectiles[read];

      // NEW: remember previous position for swept collisions
      p.prevX = p.x;
      p.prevY = p.y;

      // Move and spin
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      p.life--;
      if (p.parryCooldown > 0) p.parryCooldown--;

      // Wall bounces
      if (canvas) {
        if (p.x > canvas.width - 4) {
          p.x = canvas.width - 4;
          if (p.bouncesLeft > 0) {
            p.vx *= -1;
            p.bouncesLeft--;
            if (!this.isMenuContext) playShurikenBounceSound();
          } else {
            p.life = 0; // no bouncing at 0 -> consume projectile
          }
        }
        if (p.x < 4) {
          p.x = 4;
          if (p.bouncesLeft > 0) {
            p.vx *= -1;
            p.bouncesLeft--;
            if (!this.isMenuContext) playShurikenBounceSound();
          } else {
            p.life = 0;
          }
        }
        if (p.y > canvas.height - 4) {
          p.y = canvas.height - 4;
          if (p.bouncesLeft > 0) {
            p.vy *= -1;
            p.bouncesLeft--;
            if (!this.isMenuContext) playShurikenBounceSound();
          } else {
            p.life = 0;
          }
        }
        if (p.y < 4) {
          p.y = 4;
          if (p.bouncesLeft > 0) {
            p.vy *= -1;
            p.bouncesLeft--;
            if (!this.isMenuContext) playShurikenBounceSound();
          } else {
            p.life = 0;
          }
        }
      }

      // NEW: collide shuriken with custom blocks (reflect like walls)
      if (window.customMap && typeof window.customMap.collideProjectile === 'function') {
        const beforeVx = p.vx, beforeVy = p.vy;
        window.customMap.collideProjectile(p, 'shuriken', this.isMenuContext);
        // If no bounces allowed, kill on any map-induced reflection/stop
        if (this.maxBounces <= 0 && (p.vx !== beforeVx || p.vy !== beforeVy)) {
          p.life = 0;
        }
      }
      // NEW: collide shuriken with turrets (reflect like walls)
      if (window.turretField && typeof window.turretField.collideProjectile === 'function') {
        const beforeVx = p.vx, beforeVy = p.vy;
        window.turretField.collideProjectile(p, 'shuriken');
        if (this.maxBounces <= 0 && (p.vx !== beforeVx || p.vy !== beforeVy)) {
          p.life = 0;
        }
      }

      // Cull
      let keep = true;
      if (p.life <= 0) keep = false;
      if (keep && p.bouncesLeft < 0) keep = false;
      if (keep && canvas) {
        if (p.x < -10 || p.x > canvas.width + 10 || p.y < -10 || p.y > canvas.height + 10) {
          keep = false;
        }
      }
      if (keep) {
        this.projectiles[write++] = p;
      }
    }
    if (write !== this.projectiles.length) {
      this.projectiles.length = write;
    }
  }

  // Called when a hit lands
  onHit(defender) {
    // Increase how many bounces future shurikens can take
    this.maxBounces += 1;
  }

  getHitStunDurations() {
    // modest stun for both
    return { attacker: 6, defender: 8 };
  }

  canAttack(isPlayerStunned) {
    // Shuriken can land multiple hits via projectiles; no special cooldown gating
    return !isPlayerStunned;
  }

  playHitSound() {
    // Use the requested hit sound
    playHitHurtSound();
  }

  getDamageDisplayText() {
    return `Bounces: ${this.maxBounces}`;
  }

  getCollisionPoints() {
    const points = this._points;
    points.length = 0;

    const s = this.getScale();

    // Held weapon body samples aligned with draw geometry
    const size = 92 * s;
    const aspect = (this.image && this.image.naturalWidth > 0)
      ? (this.image.naturalHeight / this.image.naturalWidth)
      : 1;
    const h = size * aspect;
    const startDist = this.player.radius - 6; // matches draw() x offset
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const samples = Math.max(3, Math.ceil(size / (26 * s)));
    const step = samples > 1 ? (size / (samples - 1)) : 0;
    const bodyR = Math.max(6 * s, (h * 0.5) * 0.5);
    for (let i = 0; i < samples; i++) {
      const d = startDist + i * step;
      points.push({ x: this.player.x + ca * d, y: this.player.y + sa * d, radius: bodyR, type: 'shuriken-weapon' });
    }

    // Projectiles collision points (unchanged)
    const projRadius = 14 * s;
    this.projectiles.forEach(p => {
      points.push({
        x: p.x,
        y: p.y,
        radius: projRadius,
        type: 'shuriken',
        arrowRef: p
      });
    });

    return points;
  }

  draw(ctx) {
    // Draw the held/rotating shuriken "weapon"
    if (this.image.complete && this.image.naturalWidth > 0) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      // Revert: no extra 45° angle, just the weapon's current angle
      ctx.rotate(this.angle);
      const s = this.getScale();
      const size = 92 * s;
      const aspect = this.image.naturalHeight / this.image.naturalWidth;
      const h = size * aspect;
      const x = this.player.radius - 6; // original offset
      const y = -h / 2;
      ctx.drawImage(this.image, x, y, size, h);
      ctx.restore();
    }

    // Draw projectiles
    const s = this.getScale();
    const projDrawSize = this.size * s;
    this.projectiles.forEach(p => {
      if (this.projectileImage.complete && this.projectileImage.naturalWidth > 0) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        const aspect = this.projectileImage.naturalHeight / this.projectileImage.naturalWidth;
        const h = projDrawSize * aspect;
        ctx.drawImage(this.projectileImage, -projDrawSize / 2, -h / 2, projDrawSize, h);
        ctx.restore();
      } else {
        // Fallback: simple cross
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.strokeStyle = '#86910E';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
        ctx.moveTo(0, -10); ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();
      }
    });
  }
}