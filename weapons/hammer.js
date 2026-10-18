import { Weapon } from './base.js';

export class Hammer extends Weapon {
  static color = '#d74d8b';
  static icon = 'hammer_icon.png';

  constructor(player) {
    super(player);
    this.image.src = 'hammer.png';
    // start with "Max Spin" and "Spin/Damage" both at 1
    this.maxSpin = 1;
    this.currentSpin = 1;
    this.damage = 1;

    this.canHit = true;
    this._cooldownFrames = 0;
    this._cooldownMax = 10; // tiny delay between hits
    // track cumulative rotation to trigger a whoosh per full loop
    this._rotationAccum = 0;
  }

  update(isPlayerStunned) {
    if (this._cooldownFrames > 0) {
      this._cooldownFrames--;
      if (this._cooldownFrames <= 0) this.canHit = true;
    }

    if (!isPlayerStunned) {
      // Charge Spin/Damage up to Max Spin over ~220 frames (slower buildup)
      const framesToMax = 220;
      const rate = Math.max(0.02, this.maxSpin / framesToMax);
      if (this.currentSpin < this.maxSpin) {
        this.currentSpin = Math.min(this.maxSpin, this.currentSpin + rate);
      }
      // Slower baseline and gentler scaling
      const angularSpeed = 0.02 + 0.02 * (this.currentSpin - 1);
      this.angle += angularSpeed * this.spinDirection;
      // Play whoosh exactly once per full rotation (2π), regardless of speed
      this._rotationAccum += Math.abs(angularSpeed);
      if (!this.isMenuContext && this._rotationAccum >= Math.PI * 2) {
        import('../audio.js').then(m => m.playHammerWhooshSound && m.playHammerWhooshSound());
        this._rotationAccum -= Math.PI * 2;
      }
    }
    // Damage mirrors Spin/Damage (integer)
    this.damage = Math.max(1, Math.floor(this.currentSpin));
  }

  canAttack(isPlayerStunned) { return this.canHit && !isPlayerStunned; }
  onSuccessfulHit() { this.canHit = false; this._cooldownFrames = this._cooldownMax; }
  onStunEnd() {}

  getHitStunDurations() { return { attacker: 6, defender: 10 }; }
  grantsImmunityOnHit() { return false; }
  shouldReverseOnHit() { return true; }

  onHit(defender) {
    // On hit: increase Max Spin, reset Spin/Damage back to 1
    this.maxSpin += 1;
    this.currentSpin = 1;
    this.damage = 1;
  }

  playHitSound() {
    import('../audio.js').then(m => m.playHammerHitSound && m.playHammerHitSound());
  }

  getDamageDisplayText() {
    const maxSpinInt = Math.max(1, Math.round(this.maxSpin));
    const curSpinInt = Math.max(1, Math.round(this.currentSpin));
    return `<span class="stat-smaller">Max Spin: ${maxSpinInt}<br>Spin/Damage: ${curSpinInt}</span>`;
  }

  getCollisionPoints() {
    const pts = this._points;
    pts.length = 0;

    const s = this.getScale();
    const drawW = 110 * s;
    const drawH = drawW * (this.image.naturalHeight / this.image.naturalWidth || 1);

    const startDist = this.player.radius; // same as draw()
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);

    const samples = Math.max(6, Math.ceil(drawW / (20 * s)));
    const step = samples > 1 ? (drawW / (samples - 1)) : 0;
    const r = Math.max(6 * s, (drawH * 0.5) * 0.5);

    for (let i = 0; i < samples; i++) {
      const d = startDist + i * step;
      pts.push({ x: this.player.x + d * ca, y: this.player.y + d * sa, radius: r });
    }
    return pts;
  }

  draw(ctx) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;

    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.angle);

    const s = this.getScale();
    const drawW = 110 * s;
    const drawH = drawW * (this.image.naturalHeight / this.image.naturalWidth);

    const x = this.player.radius;
    const y = -drawH / 2;

    // draw image directly (remove tint overlay)
    ctx.drawImage(this.image, x, y, drawW, drawH);

    ctx.restore();
  }
}