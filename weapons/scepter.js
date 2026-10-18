import { Weapon } from './base.js';

export class Scepter extends Weapon {
  static color = '#7ecb20';
  static icon = 'scepter_icon.png';

  constructor(player) {
    super(player);
    this.image.src = 'scepter.png';
    this.heal = 1;         // starts at 1, scales like Sword's damage
    this.damage = 0;       // never damages
    this.canHit = true;
    this._cooldownFrames = 0;
    this._cooldownMax = 8; // tiny delay between heals
  }

  update(isPlayerStunned) {
    if (this._cooldownFrames > 0) {
      this._cooldownFrames--;
      if (this._cooldownFrames <= 0) this.canHit = true;
    }
    if (!isPlayerStunned) {
      this.angle += 0.1 * this.spinDirection; // same spin as Sword
    }
  }

  canAttack(isPlayerStunned) { return this.canHit && !isPlayerStunned; }
  onStunEnd() { this.canHit = true; }
  onSuccessfulHit() { this.canHit = false; this._cooldownFrames = this._cooldownMax; }

  getHitStunDurations() { return { attacker: 8, defender: 8 }; } // healing still stuns like other weapons
  grantsImmunityOnHit() { return false; }
  shouldReverseOnHit() { return true; } // match Sword’s feel

  onHit(defender) {
    // Stack healing by +0.5 per successful hit they land ON TEAMMATES ONLY
    if (defender && this.player && this.player.team && defender.team && this.player.team === defender.team) {
      this.heal = Math.max(0, (this.heal || 0) + 0.5);
    }
  }

  playHitSound() {
    import('../audio.js').then(m => m.playScepterHitSound && m.playScepterHitSound());
  }

  getDamageDisplayText() {
    const val = Number.isInteger(this.heal) ? this.heal : this.heal.toFixed(1);
    return `Healing: +${val}`;
  }

  getCollisionPoints() {
    const pts = this._points; pts.length = 0;
    const s = this.getScale();
    const length = 100 * s;
    const num = 5;
    const r = 10 * s;
    const base = this.player.radius + 5;
    const step = (length - 20 * s) / (num - 1);
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    for (let i = 0; i < num; i++) {
      const d = base + i * step;
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
    const w = 100 * s;
    const h = w * (this.image.naturalHeight / this.image.naturalWidth);
    const x = this.player.radius;
    const y = -h / 2;
    // No tinting/color effects
    ctx.drawImage(this.image, x, y, w, h);
    ctx.restore();
  }
}