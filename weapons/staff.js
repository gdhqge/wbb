import { Weapon } from './base.js';
import { players as plist } from '../state.js';
import { playStaffWhooshSound, playStaffHitSound } from '../audio.js';

export class Staff extends Weapon {
  static color = '#3b77fc';
  static icon = 'staff_icon.png';
  
  constructor(player) {
    super(player);
    this.image.src = 'staff.png';
    this.damageRadius = 2.5; // start Damage/Radius at 2.5
    this.fireballs = [];
    this.explosions = []; // Initialize explosions array
    this._explodedSet = new WeakSet(); // NEW: guard to ensure a projectile explodes only once
    this.frameImages = [ 'frame_1.png', 'frame_2.png', 'frame_3.png', 'frame_4.png' ].map(src => {
      const img = new Image(); img.src = src; return img;
    });
    this.canShoot = true;
    this.shootTimer = 0;
    this.shootInterval = 56; // even slower fire rate (was 42)
    this.baseSpeed = 10;
  }

  update(isPlayerStunned) {
    if (!isPlayerStunned) {
      this.angle += 0.05 * this.spinDirection; // spin as fast as Bow/Shuriken
      this.shootTimer--;
      if (this.shootTimer <= 0) { this.shoot(); this.shootTimer = this.shootInterval; }
    }
    this.updateProjectiles();
    this.updateExplosions();
  }

  shoot() {
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const s = this.getScale();
    const startX = this.player.x + ca * (this.player.radius + 42 * s); // spawn slightly farther to avoid overlap
    const startY = this.player.y + sa * (this.player.radius + 42 * s);
    const proj = {
      x: startX, y: startY, vx: ca * this.baseSpeed, vy: sa * this.baseSpeed,
      angle: this.angle, life: 180, frame: 0, frameTick: 0,
      kind: 'staff-fireball', baseRadius: 48 * s,  // larger fireball (was 36*s)
      ownerWeapon: this,
      owner: this.player,
      spawnFrames: 8,           // visual warmup frames
      armFrames: 6,             // NEW: short arming delay to ignore player collisions
      _exploded: false // NEW: mark to avoid any post-explosion interactions
    };
    // Store explosion function but don't create explosion entity yet
    proj.onExplode = () => { proj._explodeRequested = true; };
    this.fireballs.push(proj);
    // NEW: whoosh on shoot
    if (!this.isMenuContext) { try { playStaffWhooshSound(); } catch {} }
  }

  updateProjectiles() {
    const canvas = document.getElementById('gameCanvas');
    let keep = 0;
     
    for (let i = 0; i < this.fireballs.length; i++) {
      const p = this.fireballs[i];
      if (p._exploded) continue; // NEW: skip any already-exploded projectile completely
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.spawnFrames > 0) p.spawnFrames--;
      if (p.armFrames > 0) p.armFrames--;
      p.frameTick = (p.frameTick + 1) % 6;
      if (p.frameTick === 0) p.frame = (p.frame + 1) % this.frameImages.length;
 
      let shouldExplode = false;
 
      // Wall collision
      if (canvas && (p.x < 4 || p.x > canvas.width - 4 || p.y < 4 || p.y > canvas.height - 4)) {
        shouldExplode = true;
      }
 
      // Block collision
      if (window.customMap && window.customMap.collideProjectile) {
        window.customMap.collideProjectile(p, 'staff', this.isMenuContext);
        if (p.life <= 0) shouldExplode = true;
      }
       
      // Turret collision
      if (window.turretField && window.turretField.collideProjectile) {
        window.turretField.collideProjectile(p, 'staff');
        if (p.life <= 0) shouldExplode = true;
      }

      // Players (handled only here; never via global collision system)
      if (!shouldExplode && p.armFrames <= 0) {
        for (const victim of plist) {
          if (!victim || !victim.isAlive) continue;
          if (victim === this.player) continue;              // never hit owner
          if (victim.team && this.player.team && victim.team === this.player.team) continue; // no friendly fire
          const dx = victim.x - p.x, dy = victim.y - p.y;
          const rr = victim.radius + p.baseRadius;
          if (dx*dx + dy*dy <= rr*rr) {
            shouldExplode = true;
            break;
          }
        }
      }

      // Explode exactly once when requested or on collision; never spawn twice
      if (p._explodeRequested || shouldExplode) {
        if (!this._explodedSet.has(p)) { // NEW: hard guard against double triggers
          this._explodedSet.add(p);
          p._exploded = true;
          this.explodeAt(p.x, p.y);
        }
        continue; // remove projectile this frame so it cannot interact with the explosion
      }
      if (p.life > 0) {
        this.fireballs[keep++] = p;
      }
    }
     
    this.fireballs.length = keep;
  }

  explodeAt(x, y) {
    const s = this.getScale();
    const radius = Math.max(26, Math.floor(24 * this.damageRadius * s));
    
    // Create explosion visual effect (separate from collision), with a quick "sprout" growth
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
    if (hits > 0) { 
      this.damageRadius += 0.2 * hits; 
    }
    // NEW: dedicated staff hit sound on explosion
    if (!this.isMenuContext) {
      try { playStaffHitSound(); } catch {}
    }
  }

  updateExplosions() {
    let keep = 0;
    for (let i = 0; i < this.explosions.length; i++) {
      const e = this.explosions[i];
      e.age++;                  // advance growth age
      e.life--;                 // decay life
      if (e.life > 0) this.explosions[keep++] = e;
    }
    this.explosions.length = keep;
  }

  getCollisionPoints() {
    const pts = this._points; pts.length = 0;
    const s = this.getScale();
    const samples = 3, r = 8 * s, base = this.player.radius + 6, step = 22 * s;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    for (let i = 0; i < samples; i++) {
      const d = base + i * step;
      pts.push({ x: this.player.x + ca * d, y: this.player.y + sa * d, radius: r, type: 'staff' });
    }
    // IMPORTANT: do NOT add fireballs or explosions to collision points; staff owns those collisions
    return pts;
  }

  getDamageDisplayText() {
    const val = (Math.round(this.damageRadius * 10) / 10).toFixed(1);
    return `<span class="stat-small">Damage/Radius: ${val}</span>`;
  }

  draw(ctx) {
    if (this.image.complete && this.image.naturalWidth > 0) {
      ctx.save(); ctx.translate(this.player.x, this.player.y); ctx.rotate(this.angle);
      const s = this.getScale(); const w = 88 * s; const h = w * (this.image.naturalHeight / this.image.naturalWidth); // smaller staff (was 110*s)
      ctx.drawImage(this.image, this.player.radius, -h/2, w, h); ctx.restore();
    }
    this.fireballs.forEach(p => {
      const img = this.frameImages[p.frame] || null;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + Math.PI);
        const size = p.baseRadius * 2; // stays proportional to the now smaller baseRadius
        const aspect = img.naturalHeight / img.naturalWidth;
        ctx.drawImage(img, -size/2, -(size*aspect)/2, size, size*aspect);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.fillStyle = '#ff9800'; ctx.arc(p.x, p.y, p.baseRadius, 0, Math.PI*2); ctx.fill();
      }
    });
    if (this.explosions) {
      this.explosions.forEach(e => {
        const alpha = Math.max(0, e.life / 12);
        // Smooth fast growth from r0 -> r1 using ease-out cubic over 'grow' frames
        const t = Math.min(1, (e.age || 0) / Math.max(1, e.grow || 1));
        const easeOut = 1 - Math.pow(1 - t, 3);
        const curR = (e.r0 ?? 0) + (e.r1 ?? 0) * easeOut;
        ctx.save();
        ctx.globalAlpha = 0.18 * alpha;
        ctx.fillStyle = '#ff9800';
        ctx.beginPath(); ctx.arc(e.x, e.y, curR, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 8; // thicker orange outline
        ctx.beginPath(); ctx.arc(e.x, e.y, curR, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      });
    }
  }

  canAttack(isPlayerStunned) { return !isPlayerStunned; }
  onHit() {}
  onSuccessfulHit() {}
  getHitStunDurations() { return { attacker: 6, defender: 6 }; }
  grantsImmunityOnHit() { return true; } // behave like Bow on body hits (grant brief immunity)
  shouldReverseOnHit() { return false; }
}