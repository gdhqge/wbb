// Spear implementation (grows damage and length on hits)
import { Sword } from './sword.js';
import { playSpearHitSound } from '../audio.js';

export class Spear extends Sword {
  static color = '#1bfff5';
  static icon = 'spear_icon.png';

  constructor(player) {
    super(player);
    this.image.src = 'spear.png';
    this.spearLength = 1;
    this._lastTint = 'rgba(255, 0, 0, 0)';
  }

  onHit(defender) {
    this.damage += 0.2;
    this.spearLength += 0.1;
    const hitCount = (this.damage - 1) / 0.2;
    const alpha = Math.min(1, hitCount * 0.08);
    this.tintColor = `rgba(0, 255, 255, ${alpha})`;
  }

  playHitSound() { playSpearHitSound(); }

  getDamageDisplayText() {
    const displayValue = Number.isInteger(this.damage) ? this.damage : this.damage.toFixed(1);
    return `Damage/Range: ${displayValue}`;
  }

  getCollisionPoints() {
    const points = this._points;
    points.length = 0;

    const s = this.getScale();
    // Use the exact geometry from draw(): width stretched by spearLength, thickness from texture aspect
    const baseLength = 120 * s;
    const length = baseLength * this.spearLength;
    const aspect = (this.image && this.image.naturalWidth > 0) ? (this.image.naturalHeight / this.image.naturalWidth) : 0.42;
    const thickness = baseLength * aspect;

    const baseOffset = this.player.radius;                // start exactly where the texture starts
    const samples = Math.max(16, Math.floor(length / (16 * s)));
    const step = samples > 1 ? (length / (samples - 1)) : length;
    const radiusAlong = Math.max(6 * s, (thickness * 0.5) * 0.9); // match visual thickness

    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);

    for (let i = 0; i < samples; i++) {
      const d = baseOffset + i * step;
      points.push({ x: this.player.x + d * ca, y: this.player.y + d * sa, radius: radiusAlong });
    }

    // Small tip coverage inside the drawn blade (avoid overreaching past the texture)
    const tipBase = baseOffset + length;
    const tipA = Math.max(0, length * 0.08);
    const tipB = Math.max(0, length * 0.15);
    points.push({ x: this.player.x + (tipBase - tipA) * ca, y: this.player.y + (tipBase - tipA) * sa, radius: radiusAlong * 1.05 });
    points.push({ x: this.player.x + (tipBase - tipB) * ca, y: this.player.y + (tipBase - tipB) * sa, radius: radiusAlong * 1.02 });

    return points;
  }

  draw(ctx) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;

    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.angle);

    const s = this.getScale();
    const baseLength = 120 * s;
    const stretchedLength = baseLength * this.spearLength;
    const aspectRatio = this.image.naturalHeight / this.image.naturalWidth;
    const thickness = baseLength * aspectRatio;

    const spearX = this.player.radius;
    const spearY = -thickness / 2;

    const tempCanvas = this.tintCanvas;
    const needResize = (tempCanvas.width !== stretchedLength || tempCanvas.height !== thickness);
    const needRetint = (this._lastTint !== this.tintColor);

    if (needResize) {
      tempCanvas.width = stretchedLength;
      tempCanvas.height = thickness;
    }
    if (needResize || needRetint) {
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.clearRect(0, 0, stretchedLength, thickness);
      tempCtx.drawImage(this.image, 0, 0, stretchedLength, thickness);

      if (this.tintColor !== 'rgba(255, 0, 0, 0)') {
        tempCtx.globalCompositeOperation = 'multiply';
        tempCtx.fillStyle = this.tintColor;
        tempCtx.fillRect(0, 0, stretchedLength, thickness);
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(this.image, 0, 0, stretchedLength, thickness);
        tempCtx.globalCompositeOperation = 'source-over';
      }
      this._lastTint = this.tintColor;
    }

    ctx.drawImage(tempCanvas, spearX, spearY, stretchedLength, thickness);
    ctx.restore();
  }
}