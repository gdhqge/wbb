// Dagger implementation (fast spinner, now with mini hit-cooldown)
import { Sword } from './sword.js';
import { playDaggerHitSound } from '../audio.js';

export class Dagger extends Sword {
  static color = '#11FF0D';
  static icon = 'dagger_icon.png';

  constructor(player) {
    super(player);
    this.image.src = 'dagger.png';
    this.spinSpeed = 1;
    this.firstHit = true;
  }

  update(isPlayerStunned) {
    // Make spin speed scale sub-linearly but unbounded with spinSpeed so it keeps getting faster
    // even at very high values (e.g., >150). Using sqrt growth prevents hard feeling caps.
    // Previous log-based growth felt flat at high values.
    const growth = 0.06 * Math.sqrt(Math.max(0, this.spinSpeed)); // unbounded, smooth
    const base = 0.10; // slight idle motion
    this.angle += (base + growth) * this.spinDirection;
  }

  onStunEnd() {}
  onSuccessfulHit() {
    // no cooldown on hit
  }

  canAttack(isPlayerStunned) { 
    return !isPlayerStunned; 
  }

  getHitStunDurations() { return { attacker: 0, defender: 1 }; }
  grantsImmunityOnHit() { return false; }
  shouldReverseOnHit() { return false; }

  onHit(defender) {
    // Increase attack speed: +9 on first hit, then +10 on every subsequent hit
    if (this.firstHit) {
      this.spinSpeed += 9;
      this.firstHit = false;
    } else {
      this.spinSpeed += 10;
    }
  }

  playHitSound() { playDaggerHitSound(); }
  getDamageDisplayText() { return `Attack Speed: ${this.spinSpeed}`; }

  getCollisionPoints() {
    const points = this._points;
    points.length = 0;

    const s = this.getScale();
    const swordSize = 80 * s; // dagger size scaled
    const aspectRatio = this.image.naturalHeight / this.image.naturalWidth || 1;
    const swordHeight = swordSize * aspectRatio;

    const startDist = this.player.radius; // same as draw()
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);

    const samples = Math.max(4, Math.ceil(swordSize / (18 * s)));
    const step = samples > 1 ? (swordSize / (samples - 1)) : 0;
    const r = Math.max(6 * s, (swordHeight * 0.5) * 0.5);

    for (let i = 0; i < samples; i++) {
      const d = startDist + i * step;
      points.push({ x: this.player.x + d * ca, y: this.player.y + d * sa, radius: r });
    }
    return points;
  }

  draw(ctx) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;

    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.angle);

    const s = this.getScale();
    const swordSize = 80 * s; // dagger size scaled
    const aspectRatio = this.image.naturalHeight / this.image.naturalWidth;
    const swordHeight = swordSize * aspectRatio;
    const swordX = this.player.radius;
    const swordY = -swordHeight / 2;

    const tempCanvas = this.tintCanvas;
    if (tempCanvas.width !== swordSize || tempCanvas.height !== swordHeight) {
      tempCanvas.width = swordSize;
      tempCanvas.height = swordHeight;
    }
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.clearRect(0, 0, swordSize, swordHeight);
    tempCtx.drawImage(this.image, 0, 0, swordSize, swordHeight);
    ctx.drawImage(tempCanvas, swordX, swordY, swordSize, swordHeight);
    ctx.restore();
  }
}