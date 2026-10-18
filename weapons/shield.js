// Shield: reflects incoming damage instead of dealing its own.
// UPDATE: Per latest instructions, Shield does not deal any damage at all, and has a mini-cooldown.
// - Color theme: #b48206
// - Uses shield_icon.png for both icon and weapon image
// - Starts vertically short (squished) and STRETCHES PERPENDICULAR with diminishing sensitivity so it doesn't explode in size
// - Weapon-to-weapon contact with Shield parries normally (handled in collision.js).
// - Projectiles that hit the Shield are deflected (handled in collision.js).
// - Body contact with Shield reflects HALF of the opponent's own damage back to them, without stunning the opponent.

import { Weapon } from './base.js';
import { playShieldHitSound } from '../audio.js';

export class Shield extends Weapon {
  static color = '#b48206';
  static icon = 'shield_icon.png';

  constructor(player) {
    super(player);
    this.image.src = 'shield_icon.png';
    this.damage = 0; // Shield doesn't deal direct damage

    // Rotate initial orientation 90° counter-clockwise (points "up" like others after rotation math)
    this.angle = -Math.PI;

    // Growth/shape controls
    this.widthFactor = 2.5;           // START WIDTH set to 2.5 (was 0.8)
    this._growthSensitivity = 0.35;   
    this._verticalSquish = 0.5;

    // Make the shield thicker (across its facing direction)
    this._baseThickness = 56;         

    // Mini-cooldown to avoid rapid repeats
    this.canHit = true;
    this._cooldownFrames = 0;
    this._cooldownMax = 8;
  }

  // INTERNAL: compute the exact geometry used by both draw and hitbox so they always match.
  _computeGeom() {
    const s = this.getScale();

    // Rotation used in draw
    const theta = this.angle + Math.PI / 2;
    const ca = Math.cos(theta);
    const sa = Math.sin(theta);

    // Facing/perpendicular axes
    const fx = ca, fy = sa;
    const lx = -sa, ly = ca;

    // Dimensions exactly as in draw()
    const baseThickness = this._baseThickness * s;
    const w = Math.max(10, baseThickness);

    const basePerp = 90 * s;
    const aspect = (this.image.naturalHeight > 0 && this.image.naturalWidth > 0)
      ? (this.image.naturalHeight / this.image.naturalWidth)
      : 1;
    const baseH = basePerp * aspect;
    const effectiveStretch = 1 + (this.widthFactor * this._growthSensitivity);
    const h = Math.max(12, baseH * this._verticalSquish * effectiveStretch);

    // The draw code places the image at x = player.radius - 0.25*w (in rotated space),
    // so the rectangle's center is forward by (player.radius + 0.25*w).
    const centerForward = this.player.radius + (0.25 * w);

    // World-space center of the shield rectangle
    const cx = this.player.x + fx * centerForward;
    const cy = this.player.y + fy * centerForward;

    return { s, theta, ca, sa, fx, fy, lx, ly, w, h, cx, cy };
  }

  update(isPlayerStunned) {
    if (!isPlayerStunned) {
      // Spin significantly slower than sword
      this.angle += 0.03 * this.spinDirection;
    }

    // Tick down mini-cooldown
    if (this._cooldownFrames > 0) {
      this._cooldownFrames--;
      if (this._cooldownFrames <= 0) this.canHit = true;
    }
  }

  canAttack(isPlayerStunned) {
    return this.canHit && !isPlayerStunned;
  }

  onReflect(attacker) {
    this.widthFactor += 0.2; // numerical increment remains 0.2
    this.canHit = false;
    this._cooldownFrames = this._cooldownMax;
  }

  getHitStunDurations() { return { attacker: 8, defender: 8 }; }
  onSuccessfulHit() { this.canHit = false; this._cooldownFrames = this._cooldownMax; }
  onHit(defender) { this.onReflect(defender); }
  playHitSound() { playShieldHitSound(); } // NEW: play shield SFX on hit

  // Reverse spin after a hit, like sword
  shouldReverseOnHit() { return true; }

  getDamageDisplayText() {
    const w = (Math.round(this.widthFactor * 10) / 10).toFixed(1);
    return `Width: ${w}`;
  }

  getCollisionPoints() {
    const pts = this._points;
    pts.length = 0;

    // Ensure hitbox only exists once the texture is available (prevents invisible hits)
    if (!(this.image.complete && this.image.naturalWidth > 0)) return pts;
    const { s, lx, ly, w, h, cx, cy } = this._computeGeom();

    // Use the exact visual half-span so hitbox width matches drawn height precisely
    const halfSpan = h / 2;

    // Circle radius equals half of the drawn thickness for perfect coverage
    const circleR = Math.max(6 * s, w * 0.5);
    // Choose sample count so adjacent circles overlap slightly and cover full height
    const samples = Math.max(4, Math.ceil((h / (circleR * 0.9))));
    const step = samples > 1 ? (halfSpan * 2) / (samples - 1) : 0;

    for (let i = 0; i < samples; i++) {
      const t = -halfSpan + i * step;
      pts.push({
        x: cx + lx * t,
        y: cy + ly * t,
        radius: circleR,
        type: 'shield'
      });
    }

    return pts;
  }

  draw(ctx) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;

    const { theta, w, h } = this._computeGeom();

    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(theta);

    const x = this.player.radius - (w * 0.25);
    const y = -h / 2;

    // draw the shield image directly (remove color tint)
    ctx.drawImage(this.image, x, y, w, h);

    ctx.restore();

    // DEBUG points
    import('../debug.js').then(({ isShieldDebugEnabled }) => {
      if (!isShieldDebugEnabled()) return;
      const pts = this.getCollisionPoints();
      ctx.save();
      ctx.strokeStyle = 'rgba(180,130,6,0.85)';
      ctx.fillStyle = 'rgba(180,130,6,0.22)';
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }).catch(() => {});
  }
}