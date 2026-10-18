// Bow implementation (shoots arrows; improves cadence; better parry collisions)
import { Weapon } from './base.js';
import { playBowHitSound, playBowImpactSound } from '../audio.js';

export class Bow extends Weapon {
  static color = '#FFD700';
  static icon = 'bow_icon.png';
  static MAX_ARROWS = 40;

  constructor(player) {
    super(player);
    this.image.src = 'bow.png';
    this.arrowImage = new Image();
    this.arrowImage.src = 'arrow.png';

    // Start with 1 arrow
    this.arrowsPerSecond = 1;
    this.shootTimer = 0;
    this.shootInterval = Math.max(1, Math.floor(24 / this.arrowsPerSecond));
    this.arrows = [];
    this.damage = 1;
    this.canHit = true;

    this.shotsFiredInBurst = 0;
    this.burstCooldownTimer = 0;
    this.baseBurstCooldown = 36;

    this.bowSize = 130;           // base, will scale dynamically in draw
    this.bowXOffsetBase = -60;    // base, will scale dynamically in draw

    this.baseArrowSpeed = 14;

    this._canvas = document.getElementById('gameCanvas');

    this.arrowLifetime = 120;
  }

  getArrowSpeedMultiplier() {
    const n = this.arrows.length;
    return 1 + Math.min(1.0, 0.06 * n);
  }

  update(isPlayerStunned) {
    if (this.burstCooldownTimer > 0) this.burstCooldownTimer--;

    if (!isPlayerStunned) {
      this.angle += 0.05 * this.spinDirection;

      if (this.burstCooldownTimer <= 0) {
        this.shootTimer--;
        if (this.shootTimer <= 0) {
          this.shootArrow();
          this.shootTimer = this.shootInterval;

          this.shotsFiredInBurst++;

          const burstSize = Math.max(1, Math.round(this.arrowsPerSecond));
          if (this.shotsFiredInBurst >= burstSize) {
            this.burstCooldownTimer = this.baseBurstCooldown;
            this.shotsFiredInBurst = 0;
          }
        }
      }
    }

    this.updateArrows();
  }

  shootArrow() {
    const spawnMultiplier = this.getArrowSpeedMultiplier();
    const arrowSpeed = this.baseArrowSpeed * spawnMultiplier;
    const shootAngle = this.angle;

    const s = this.getScale();
    const bowXLocal = this.player.radius + (this.bowXOffsetBase * s);
    const forwardFromOrigin = bowXLocal + (this.bowSize * s) - 8 * s;

    const ca = Math.cos(shootAngle);
    const sa = Math.sin(shootAngle);

    const startX = this.player.x + ca * forwardFromOrigin;
    const startY = this.player.y + sa * forwardFromOrigin;

    const arrow = {
      x: startX,
      y: startY,
      vx: ca * arrowSpeed,
      vy: sa * arrowSpeed,
      angle: shootAngle,
      life: this.arrowLifetime,
      baseRadius: 12 * s,
      parryCooldown: 0,
      // NEW: annotate for deflection-damage system
      kind: 'arrow',
      deflected: false,
      lastDeflectedBy: null,
      deflectedFrames: 0
    };

    if (this.arrows.length >= Bow.MAX_ARROWS) {
      this.arrows.shift();
    }
    this.arrows.push(arrow);

    if (!this.isMenuContext) playBowHitSound();
  }

  updateArrows() {
    const targetMultiplier = this.getArrowSpeedMultiplier();
    const targetSpeed = this.baseArrowSpeed * targetMultiplier;
    const accelLerp = 0.08;

    const canvas = this._canvas;

    // OPTIMIZED: compact in-place instead of Array.filter to reduce allocations
    let write = 0;
    for (let read = 0; read < this.arrows.length; read++) {
      const arrow = this.arrows[read];

      // NEW: remember previous position for swept collisions
      arrow.prevX = arrow.x;
      arrow.prevY = arrow.y;

      const curSpeed = Math.hypot(arrow.vx, arrow.vy);
      if (curSpeed > 0.0001) {
        const newSpeed = curSpeed + (targetSpeed - curSpeed) * accelLerp;
        const inv = 1 / curSpeed;
        const nx = arrow.vx * inv;
        const ny = arrow.vy * inv;
        arrow.vx = nx * newSpeed;
        arrow.vy = ny * newSpeed;
        arrow.angle = Math.atan2(arrow.vy, arrow.vx);
      }

      arrow.x += arrow.vx;
      arrow.y += arrow.vy;
      arrow.life--;
      if (arrow.parryCooldown > 0) arrow.parryCooldown--;

      // NEW: collide arrows with custom map blocks (arrows are destroyed on hit)
      if (window.customMap && typeof window.customMap.collideProjectile === 'function') {
        window.customMap.collideProjectile(arrow, 'arrow', this.isMenuContext);
      }
      // NEW: collide arrows with turrets (treat like walls)
      if (window.turretField && typeof window.turretField.collideProjectile === 'function') {
        window.turretField.collideProjectile(arrow, 'arrow');
      }

      // Cull
      let keep = true;
      if (arrow.life <= 0) keep = false;
      if (keep && canvas) {
        if (arrow.x < -10 || arrow.x > canvas.width + 10 ||
            arrow.y < -10 || arrow.y > canvas.height + 10) {
          keep = false;
        }
      }
      if (keep) {
        this.arrows[write++] = arrow;
      }
    }
    if (write !== this.arrows.length) {
      this.arrows.length = write;
    }
  }

  onStunEnd() { this.canHit = true; }
  onSuccessfulHit() { this.canHit = false; }

  canAttack(isPlayerStunned) { return this.canHit && !isPlayerStunned; }
  getHitStunDurations() { return { attacker: 6, defender: 6 }; }
  grantsImmunityOnHit() { return true; }
  shouldReverseOnHit() { return false; }

  onHit(defender) {
    this.arrowsPerSecond += 1;
    this.shootInterval = Math.max(1, Math.floor(24 / this.arrowsPerSecond));

    const hitCount = this.arrowsPerSecond - 1;
    const alpha = Math.min(1, hitCount * 0.1);
    this.tintColor = `rgba(255, 215, 0, ${alpha})`;

    const burstSize = Math.max(1, Math.round(this.arrowsPerSecond));
    if (this.shotsFiredInBurst > burstSize) {
      this.burstCooldownTimer = this.baseBurstCooldown;
      this.shotsFiredInBurst = 0;
    }
  }

  playHitSound() { playBowImpactSound(); }
  getDamageDisplayText() { return `Arrows: ${this.arrowsPerSecond}`; }

  getCollisionPoints() {
    const points = this._points;
    points.length = 0;

    const s = this.getScale();

    // Bow body samples for parry collisions
    const bowSamples = 3;
    const bowCollisionRadius = 8 * s;
    const localStart = this.player.radius + (this.bowXOffsetBase * s) + 16 * s;
    const localEnd = localStart + (this.bowSize * s) - 36 * s;

    const step = bowSamples > 1 ? (localEnd - localStart) / (bowSamples - 1) : 0;
    const caBow = Math.cos(this.angle);
    const saBow = Math.sin(this.angle);

    for (let i = 0; i < bowSamples; i++) {
      const dist = localStart + i * step;
      const bx = this.player.x + caBow * dist;
      const by = this.player.y + saBow * dist;
      points.push({ x: bx, y: by, radius: bowCollisionRadius, type: 'bow' });
    }

    // Arrow tip sample
    const tipLen = 32 * s;
    this.arrows.forEach(arrow => {
      const ca = Math.cos(arrow.angle);
      const sa = Math.sin(arrow.angle);
      const axTip = arrow.x + ca * tipLen;
      const ayTip = arrow.y + sa * tipLen;
      const rTip = Math.max(9 * s, arrow.baseRadius + 1);
      points.push({ x: axTip, y: ayTip, radius: rTip, type: 'arrow', arrowRef: arrow });
    });

    return points;
  }

  draw(ctx) {
    if (this.image.complete && this.image.naturalWidth > 0) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(this.angle);

      const s = this.getScale();
      const bowSize = this.bowSize * s;
      const aspectRatio = this.image.naturalHeight / this.image.naturalWidth;
      const bowHeight = bowSize * aspectRatio;
      const bowX = this.player.radius + (this.bowXOffsetBase * s);
      const bowY = -bowHeight / 2;

      const tempCanvas = this.tintCanvas;
      if (tempCanvas.width !== bowSize || tempCanvas.height !== bowHeight) {
        tempCanvas.width = bowSize;
        tempCanvas.height = bowHeight;
      }
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.clearRect(0, 0, bowSize, bowHeight);
      tempCtx.drawImage(this.image, 0, 0, bowSize, bowHeight);

      if (this.tintColor !== 'rgba(255, 0, 0, 0)') {
        tempCtx.globalCompositeOperation = 'multiply';
        tempCtx.fillStyle = this.tintColor;
        tempCtx.fillRect(0, 0, bowSize, bowHeight);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(this.image, 0, 0, bowSize, bowHeight);
        tempCtx.globalCompositeOperation = 'source-over';
      }

      ctx.drawImage(tempCanvas, bowX, bowY, bowSize, bowHeight);
      ctx.restore();
    }

    this.arrows.forEach(arrow => {
      if (this.arrowImage.complete && this.arrowImage.naturalWidth > 0) {
        ctx.save();
        ctx.translate(arrow.x, arrow.y);
        ctx.rotate(arrow.angle);

        const s = this.getScale();
        const arrowSize = 72 * s;
        const aspectRatio = this.arrowImage.naturalHeight / this.arrowImage.naturalWidth;
        const arrowHeight = arrowSize * aspectRatio;

        ctx.drawImage(this.arrowImage, -arrowSize/2, -arrowHeight/2, arrowSize, arrowHeight);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 5;
        ctx.moveTo(arrow.x - 18 * Math.cos(arrow.angle), arrow.y - 18 * Math.sin(arrow.angle));
        ctx.lineTo(arrow.x + 18 * Math.cos(arrow.angle), arrow.y + 18 * Math.sin(arrow.angle));
        ctx.stroke();
      }
    });
  }
}