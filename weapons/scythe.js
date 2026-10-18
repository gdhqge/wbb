// Scythe: applies stacking poison that deals damage over time.
// - On hit: add 1 Poison stack to the defender.
// - Every 5 seconds (300 frames), defender takes damage equal to current Poison stacks.
// - Damage display shows "Poisons: N" (N = current stacks applied so far by this scythe).
// - Visual: keep object position fixed; rotate texture; align RIGHT edge of texture to ball center.

import { Weapon } from './base.js';
import { playScytheHitSound } from '../audio.js';

export class Scythe extends Weapon {
  static color = '#AA3FFF';         // Main purple theme
  static icon = 'scythe_icon.png';  // Button icon
  constructor(player) {
    super(player);
    this.image.src = 'scythe.png';
    this.damage = 1; // Deal 1 immediate hit damage; poison does the damage over time separately

    // Start with 1 poison shown in UI (applies to opponents on first hit)
    this.stacksApplied = 1;

    // Hit gating to prevent rapid multi-procs
    this.canHit = true;
    this._cooldownFrames = 0;
    this._cooldownMax = 18; // increased: stronger lockout to prevent immediate re-hits
  }

  update(isPlayerStunned) {
    // Tick down mini-cooldown
    if (this._cooldownFrames > 0) this._cooldownFrames--;

    if (!isPlayerStunned) {
      // Slow, ominous spin
      this.angle += 0.06 * this.spinDirection;
    }
  }

  // EXACT sword-like stun behavior with added mini-cooldown gate:
  canAttack(isPlayerStunned) { 
    return this.canHit && this._cooldownFrames <= 0 && !isPlayerStunned; 
  }
  onStunEnd() { this.canHit = true; }
  onSuccessfulHit() { 
    // enforce single proc per contact + flip spin immediately on hit
    this.canHit = false; 
    this._cooldownFrames = this._cooldownMax; 
    this.spinDirection *= -1; // reverse spin right when the hit occurs
  }

  getHitStunDurations() { return { attacker: 8, defender: 8 }; }
  grantsImmunityOnHit() { return false; }
  // We flip spin on hit immediately, so don't also schedule a flip on stun end.
  shouldReverseOnHit() { return false; }

  onHit(defender) {
    // Initialize poison state if missing
    if (typeof defender.poisonStacks !== 'number') defender.poisonStacks = 0;
    if (typeof defender.poisonCycleFrames !== 'number') defender.poisonCycleFrames = 300; // 5s at ~60fps
    if (typeof defender.poisonElapsedFrames !== 'number') defender.poisonElapsedFrames = 0;

    // Add one poison stack on every successful hit
    defender.poisonStacks += 1;

    // NEW: remember last scythe attacker to enable Shield poison reflection
    defender._lastPoisonApplier = this.player;

    // Do NOT deal immediate poison damage on hit anymore.
    // Poison now ticks for 1 damage at evenly spaced intervals within a 5s cycle.
    // More stacks => more ticks within the same 5s window, reducing cooldown between ticks.
    // Keep elapsed time to preserve cadence continuity.

    this.stacksApplied += 1;

    // Visual feedback: subtle purple flash to indicate a successful application (optional)
    defender.poisonFlashFrames = defender.poisonFlashMax || 12;
    // Note: regular periodic ticks will still cause their own purple flashes.
  }

  // NEW: play scythe hit sound
  playHitSound() {
    playScytheHitSound();
  }

  getDamageDisplayText() {
    return `Poisons: ${this.stacksApplied || 0}`;
  }

  getCollisionPoints() {
    // Improve reliability at high speeds by sampling more points along the blade
    // and using a slightly more generous radius.
    const points = this._points;
    points.length = 0;

    const s = this.getScale();
    const bladeLength = 110 * s;           // slight length increase
    const numPoints = 13;                  // even more samples helps parry detection
    const collisionRadius = 11 * s;        // slightly tuned down to reduce false overlaps
    const baseOffset = this.player.radius + 6; // start just outside ball
    const pointSpacing = (bladeLength - 20 * s) / (numPoints - 1);

    const ca = Math.cos(this.angle);
    const sa = Math.sin(this.angle);

    for (let i = 0; i < numPoints; i++) {
      const dist = baseOffset + (i * pointSpacing);
      points.push({
        x: this.player.x + dist * ca,
        y: this.player.y + dist * sa,
        radius: collisionRadius,
        type: 'scythe' // tag for better parry tuning
      });
    }

    // Add a dedicated "hook/guard" parry point a bit past the tip with larger radius,
    // to make parries more consistent when the curved blade meets another weapon.
    const guardDist = baseOffset + bladeLength + 8 * s;
    points.push({
      x: this.player.x + guardDist * ca,
      y: this.player.y + guardDist * sa,
      radius: Math.max(12 * s, collisionRadius + 2 * s),
      type: 'scythe-guard'
    });

    return points;
  }

  draw(ctx) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;

    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.angle + Math.PI / 2);

    const s = this.getScale();
    const drawW = 80 * s;
    const drawH = drawW * (this.image.naturalHeight / this.image.naturalWidth);

    // OPTIMIZED: Only rebuild tinted cache when alpha changes +/- small epsilon or size changes
    const alpha = Math.min(0.7, (this.stacksApplied || 0) * 0.06);
    const needResize = (this._cacheW !== drawW || this._cacheH !== drawH);
    const needRetint = (this._lastAlpha === undefined || Math.abs(this._lastAlpha - alpha) > 0.02);

    const tempCanvas = this.tintCanvas;
    if (needResize) {
      tempCanvas.width = drawW;
      tempCanvas.height = drawH;
      this._cacheW = drawW;
      this._cacheH = drawH;
    }
    if (needResize || needRetint) {
      const tctx = tempCanvas.getContext('2d');
      tctx.clearRect(0, 0, drawW, drawH);
      tctx.drawImage(this.image, 0, 0, drawW, drawH);
      if (alpha > 0) {
        tctx.globalCompositeOperation = 'multiply';
        tctx.fillStyle = `rgba(170, 63, 255, ${alpha})`;
        tctx.fillRect(0, 0, drawW, drawH);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(this.image, 0, 0, drawW, drawH);
        tctx.globalCompositeOperation = 'source-over';
      }
      this._lastAlpha = alpha;
    }

    const outwardGap = 8 * s;
    const shiftRight = 24 * s;
    const drawX = -drawW - outwardGap + shiftRight;
    const drawY = -drawH / 2 - 88 * s;

    ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
    ctx.restore();
  }
}