import { playBatHitSound } from '../audio.js';

export class Bat extends (await import('./base.js')).Weapon {
  static color = '#FEFFC7';
  static icon = 'bat_icon.png';
  constructor(player) {
    super(player);
    this.image.src = 'bat.png';
    this.power = 0.5;        // shared Damage/Stun value, starts at 0.5
    this.damage = this.power;
  }
  update(isPlayerStunned) {
    if (!isPlayerStunned) this.angle += 0.08 * this.spinDirection;
  }
  onHit(defender) {
    this.power += 0.2;
    this.damage = this.power;
    this.spinDirection *= -1; // reverse spin immediately on hit
  }
  canAttack(isPlayerStunned) { return !isPlayerStunned; }
  getHitStunDurations() {
    const frames = Math.max(1, Math.round(this.power * 60));
    return { attacker: 0, defender: frames };
  }
  grantsImmunityOnHit() { return false; }
  shouldReverseOnHit() { return false; }
  getDamageDisplayText() {
    const val = Number.isInteger(this.power) ? this.power : this.power.toFixed(1);
    return `<span class="stat-small">Damage/Stun: ${val}</span>`;
  }
  getCollisionPoints() {
    const pts = this._points; pts.length = 0;
    if (!this.image || !this.image.complete || this.image.naturalWidth === 0) return pts;
    const s = this.getScale();
    const w = 120 * s;
    const h = w * (this.image.naturalHeight / this.image.naturalWidth || 1);
    const startDist = this.player.radius;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const samples = Math.max(7, Math.ceil(w / (16 * s))); // denser sampling
    const step = samples > 1 ? (w / (samples - 1)) : 0;
    const r = Math.max(6 * s, (h * 0.5) * 0.55); // slightly thicker than visual half
    for (let i = 0; i < samples; i++) {
      const d = startDist + i * step;
      pts.push({ x: this.player.x + d * ca, y: this.player.y + d * sa, radius: r, type: 'bat' });
    }
    // extra tip coverage ahead of sprite to catch fast sweeps
    const tip = startDist + w;
    const ahead = Math.max(10 * s, h * 0.25);
    pts.push({ x: this.player.x + (tip + ahead) * ca, y: this.player.y + (tip + ahead) * sa, radius: r * 0.9, type: 'bat' });
    pts.push({ x: this.player.x + (tip + ahead * 1.8) * ca, y: this.player.y + (tip + ahead * 1.8) * sa, radius: r * 0.8, type: 'bat' });
    return pts;
  }
  draw(ctx) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;
    ctx.save(); ctx.translate(this.player.x, this.player.y); ctx.rotate(this.angle);
    const s = this.getScale(), w = 120 * s, h = w * (this.image.naturalHeight / this.image.naturalWidth || 1);
    ctx.drawImage(this.image, this.player.radius, -h / 2, w, h); ctx.restore();
  }
  playHitSound() { playBatHitSound(); }
}