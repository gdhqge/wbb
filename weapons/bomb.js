import { Weapon } from './base.js';
import { players as plist } from '../state.js';
import { playBombThrowSound, playBombExplodeSound } from '../audio.js';

export class Bomb extends Weapon {
  static color = '#B74B27';
  static icon = 'bomb.png';

  constructor(player) {
    super(player);
    this.image.src = 'bomb.png';
    this.projectileImage = this.image; // visuals only for now
    this.damage = 0; // visuals only
    this.damageRadius = 2.5; // Damage/Radius stat (like Staff)
    this.bombs = [];
    this.explosions = [];
    this._armedSet = new WeakSet();
    this.canThrow = true;
    this.throwTimer = 0;
    this.throwInterval = 64;
    this.baseSpeed = 9;
    // NEW: wield the actual projectile; manage reload
    this.held = { angle: this.angle };
    this.reloadTimer = 0;
  }

  update(isPlayerStunned, gravityOn) {
    if (!isPlayerStunned) {
      this.angle += 0.05 * this.spinDirection;
      // NEW: throw when timer elapses and a bomb is held; then reload
      this.throwTimer--;
      if (this.throwTimer <= 0 && this.held) {
        this.throwHeld();
        this.throwTimer = this.throwInterval;
        this.reloadTimer = 30; // brief empty hands
      }
    }
    // NEW: acquire a new held bomb after reload
    if (!this.held && this.reloadTimer > 0) this.reloadTimer--;
    if (!this.held && this.reloadTimer <= 0) this.held = { angle: this.angle };

    this.updateProjectiles(!!gravityOn);
    this.updateExplosions();
  }

  throwBomb() {
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const s = this.getScale();
    const startX = this.player.x + ca * (this.player.radius + 48 * s);
    const startY = this.player.y + sa * (this.player.radius + 48 * s);
    this.bombs.push({
      x: startX, y: startY,
      vx: ca * this.baseSpeed, vy: sa * this.baseSpeed,
      angle: this.angle,
      life: 420,
      armedTimer: 0, // counts down from 180 when armed
      blinkTick: 0,
      immobileFrames: 0
    });
  }

  updateProjectiles(gravityOn) {
    const canvas = document.getElementById('gameCanvas');
    // Keep the held bomb riding with the player (no physics yet)
    if (this.held) this.held.angle = this.angle;
    let keep = 0;
    for (let i = 0; i < this.bombs.length; i++) {
      const p = this.bombs[i];
      // remember previous for swept tests (not used yet, but reserved)
      p.prevX = p.x; p.prevY = p.y;

      // NEW: global fuse countdown started on throw; explode when it ends
      if (typeof p.fuseTimer === 'number') {
        p.fuseTimer--;
        if (p.fuseTimer <= 0) { this.explodeAt(p.x, p.y); continue; }
      }

      if (p.stuckTo && p.stuckTo.isAlive) {
        // Anticipate victim's movement this frame to avoid visual wiggle
        p.x = p.stuckTo.x + (p.stuckTo.vx || 0) + (p.offsetX || 0);
        p.y = p.stuckTo.y + (p.stuckTo.vy || 0) + (p.offsetY || 0);
        p.vx = 0; p.vy = 0;
        // countdown if armed
        if (p.armedTimer > 0) {
          p.armedTimer--;
          p.blinkTick = (p.blinkTick + 1) % 6;
          if (p.armedTimer <= 0) { this.explodeAt(p.x, p.y); continue; }
        }
        if (p.life > 0) this.bombs[keep++] = p;
        continue;
      }

      // If stuck to a wall, pin position and skip physics
      if (p.stuckWall) {
        p.x = p.anchorX; p.y = p.anchorY;
        p.vx = 0; p.vy = 0;
        if (p.life > 0 && p.fuseTimer > 0) this.bombs[keep++] = p;
        continue;
      }

      if (p.armedTimer > 0) {
        p.armedTimer--;
        p.blinkTick = (p.blinkTick + 1) % 6;
        if (p.armedTimer <= 0) {
          this.explodeAt(p.x, p.y);
          continue; // remove bomb on this frame
        }
      } else {
        // Physics until armed
        if (gravityOn) {
          p.vy += 0.18; // gravity pull
          // simple floor/wall contact detection => arm on any wall touch
          if (canvas) {
            // integrate
            p.x += p.vx; p.y += p.vy; p.life--;
            // walls: clamp and arm
            if (p.x < 4) { p.x = 4; this._armBomb(p); p.stuckWall = 'left'; p.anchorX = p.x; p.anchorY = p.y; }
            else if (p.x > canvas.width - 4) { p.x = canvas.width - 4; this._armBomb(p); p.stuckWall = 'right'; p.anchorX = p.x; p.anchorY = p.y; }
            if (p.y < 4) { p.y = 4; this._armBomb(p); p.stuckWall = 'top'; p.anchorX = p.x; p.anchorY = p.y; }
            else if (p.y > canvas.height - 4) { p.y = canvas.height - 4; this._armBomb(p); p.stuckWall = 'bottom'; p.anchorX = p.x; p.anchorY = p.y; }
          } else {
            p.x += p.vx; p.y += p.vy; p.life--;
          }
        } else {
          // No gravity: glide with friction and arm when nearly stopped
          p.x += p.vx; p.y += p.vy; p.life--;
          p.vx *= 0.985;
          p.vy *= 0.985;
          const speed = Math.hypot(p.vx, p.vy);
          if (speed < 0.18) {
            p.immobileFrames++;
            if (p.immobileFrames > 12) this._armBomb(p);
          } else {
            p.immobileFrames = 0;
          }
          // If hits arena bounds, arm immediately
          if (canvas) {
            if (p.x < 4) { p.x = 4; this._armBomb(p); p.stuckWall = 'left'; p.anchorX = p.x; p.anchorY = p.y; }
            else if (p.x > canvas.width - 4) { p.x = canvas.width - 4; this._armBomb(p); p.stuckWall = 'right'; p.anchorX = p.x; p.anchorY = p.y; }
            if (p.y < 4) { p.y = 4; this._armBomb(p); p.stuckWall = 'top'; p.anchorX = p.x; p.anchorY = p.y; }
            else if (p.y > canvas.height - 4) { p.y = canvas.height - 4; this._armBomb(p); p.stuckWall = 'bottom'; p.anchorX = p.x; p.anchorY = p.y; }
          }
        }

        // Collide with players: stick to ANY player/opponent on touch
        for (let k = 0; k < plist.length; k++) {
          const victim = plist[k];
          if (!victim || !victim.isAlive) continue;
          if (victim === this.player) continue; // avoid sticking to self
          if (victim.team && this.player.team && victim.team === this.player.team) continue; // don't stick to teammates
          const s = this.getScale();
          const pr = Math.max(18, Math.floor(20 * s)); // bomb collision radius
          const dx = victim.x - p.x, dy = victim.y - p.y;
          if (dx*dx + dy*dy <= (victim.radius + pr) * (victim.radius + pr)) {
            p.stuckTo = victim;
            p.offsetX = p.x - victim.x;
            p.offsetY = p.y - victim.y;
            this._armBomb(p);
          }
        }

        // Collide with custom blocks/turrets: arm on any reflection/stop
        if (window.customMap && window.customMap.collideProjectile) {
          const bvx = p.vx, bvy = p.vy;
          window.customMap.collideProjectile(p, 'bomb', this.isMenuContext);
          if (p.vx !== bvx || p.vy !== bvy || p.stuckWall) {
            // ensure hard stick on blocks
            p.stuckWall = p.stuckWall || 'block';
            p.anchorX = p.anchorX ?? p.x;
            p.anchorY = p.anchorY ?? p.y;
            this._armBomb(p);
          }
        }
        if (window.turretField && window.turretField.collideProjectile) {
          const bvx2 = p.vx, bvy2 = p.vy;
          window.turretField.collideProjectile(p, 'bomb');
          if (p.vx !== bvx2 || p.vy !== bvy2) {
            // stick onto turret surface (turrets are stationary)
            p.stuckWall = p.stuckWall || 'turret';
            p.anchorX = p.x; p.anchorY = p.y;
            this._armBomb(p);
          }
        }
      }

      if (p.life > 0 && p.fuseTimer > 0) this.bombs[keep++] = p;
    }
    this.bombs.length = keep;
  }

  _armBomb(p) {
    if (this._armedSet.has(p)) return;
    this._armedSet.add(p);
    p.vx = 0; p.vy = 0;
    p.stuck = true; // NEW: mark stuck without resetting fuse
    p.blinkTick = 0;
  }

  explodeAt(x, y) {
    const s = this.getScale();
    const radius = Math.max(26, Math.floor(24 * this.damageRadius * s));
    this.explosions.push({ x, y, r0: 0, r1: radius, age: 0, grow: 8, life: 12 });

    let hits = 0;
    plist.forEach(victim => {
      if (!victim.isAlive) return;
      if (victim === this.player) return;
      if (this.player.team && victim.team && victim.team === this.player.team) return;
      const dx = victim.x - x, dy = victim.y - y;
      if (dx*dx + dy*dy <= (victim.radius + radius) ** 2) {
        victim.health -= this.damageRadius;
        victim.stun(6);
        hits++;
      }
    });
    if (hits > 0) this.damageRadius += 0.5 * hits;
    if (!this.isMenuContext) {
      try { playBombExplodeSound(); } catch {}
    }
  }

  updateExplosions() {
    let keep = 0;
    for (let i = 0; i < this.explosions.length; i++) {
      const e = this.explosions[i];
      e.age++; e.life--;
      if (e.life > 0) this.explosions[keep++] = e;
    }
    this.explosions.length = keep;
  }

  getDamageDisplayText() {
    const val = (Math.round(this.damageRadius * 10) / 10).toFixed(1);
    return `<span class="stat-small">Damage/Radius: ${val}</span>`;
  }

  draw(ctx) {
    // Draw held bomb (use the projectile itself)
    if (this.held && this.projectileImage.complete && this.projectileImage.naturalWidth > 0) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(this.angle);
      const s = this.getScale();
      const size = 48 * s; // slightly larger
      const aspect = this.projectileImage.naturalHeight / this.projectileImage.naturalWidth;
      const w = size, h = size * aspect;
      ctx.translate(this.player.radius + 22 * s, -4 * s); // slightly closer and slightly left
      ctx.drawImage(this.projectileImage, -w/2, -h/2, w, h);
      ctx.restore();
    }
    // Draw thrown bombs
    this.bombs.forEach(p => {
      if (!this.projectileImage.complete || this.projectileImage.naturalWidth === 0) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const s = this.getScale();
      const size = 48 * s; // match wielded size, slightly larger
      const aspect = this.projectileImage.naturalHeight / this.projectileImage.naturalWidth;
      const w = size, h = size * aspect;
      // Draw base sprite
      ctx.drawImage(this.projectileImage, -w/2, -h/2, w, h);
      // NEW: flash starts immediately on throw; cadence based on fuseTimer
      if (p.fuseTimer > 0 && ((Math.floor(p.fuseTimer / 10) % 2) === 0)) {
        const off = (this._offscreen ||= document.createElement('canvas'));
        if (off.width !== Math.ceil(w) || off.height !== Math.ceil(h)) {
          off.width = Math.ceil(w); off.height = Math.ceil(h);
        }
        const octx = (this._octx ||= off.getContext('2d'));
        octx.clearRect(0, 0, off.width, off.height);
        octx.drawImage(this.projectileImage, 0, 0, off.width, off.height);
        octx.globalCompositeOperation = 'source-in';
        octx.fillStyle = 'rgba(255,0,0,0.55)';
        octx.fillRect(0, 0, off.width, off.height);
        octx.globalCompositeOperation = 'source-over';
        ctx.drawImage(off, -w/2, -h/2);
      }
      ctx.restore();
    });
    // Draw explosions
    this.explosions.forEach(e => {
      const t = Math.min(1, (e.age || 0) / Math.max(1, e.grow || 1));
      const easeOut = 1 - Math.pow(1 - t, 3);
      const curR = (e.r0 ?? 0) + (e.r1 ?? 0) * easeOut;
      const alpha = Math.max(0, e.life / 12); // match Staff's decay curve
      ctx.save();
      ctx.globalAlpha = 0.18 * alpha; ctx.fillStyle = '#ff0000'; // same fill transparency as Staff
      ctx.beginPath(); ctx.arc(e.x, e.y, curR, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(e.x, e.y, curR, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    });
  }

  throwHeld() {
    if (!this.held) return;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const s = this.getScale();
    const startX = this.player.x + ca * (this.player.radius + 48 * s);
    const startY = this.player.y + sa * (this.player.radius + 48 * s);
    const p = Object.assign(this.held, {
      x: startX, y: startY,
      vx: ca * this.baseSpeed, vy: sa * this.baseSpeed,
      angle: this.angle,
      life: 420,
      fuseTimer: 180, // NEW: start 3s fuse immediately on throw
      blinkTick: 0,
      immobileFrames: 0
    });
    this.bombs.push(p);
    this.held = null;

    if (!this.isMenuContext) {
      try { playBombThrowSound(); } catch {}
    }
  }

  canAttack(isPlayerStunned) { return !isPlayerStunned; }
  onHit() {}
  onSuccessfulHit() {}
  getHitStunDurations() { return { attacker: 6, defender: 6 }; }
  grantsImmunityOnHit() { return true; }
  shouldReverseOnHit() { return false; }
}