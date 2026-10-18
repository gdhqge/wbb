// Unarmed weapon implementation (body-as-weapon with charging speed)
import { Weapon } from './base.js';
import { playUnarmedHitSound } from '../audio.js';

export class Unarmed extends Weapon {
  static color = '#CFCFCF';
  static icon = 'unarmed_icon%20(2).png';

  constructor(player) {
    super(player);
    this.maxCharge = 3;
    this.currentCharge = 0;
    this.canHit = true;
    this._cooldownFrames = 0;
    this._cooldownMax = 12;
    this.originalSpeed = player.speed;
    player.speed = 0;

    this._dirAngle = Math.random() * Math.PI * 2;
    const initialNudge = 0.8;
    this.player.vx = Math.cos(this._dirAngle) * initialNudge;
    this.player.vy = Math.sin(this._dirAngle) * initialNudge;
  }

  setHeadingFromVelocity(vx, vy) {
    const mag = Math.hypot(vx, vy);
    if (mag > 0.0001) {
      this._dirAngle = Math.atan2(vy, vx);
    }
  }

  onWallBounce(axis) {
    if (axis === 'x') {
      // reflect horizontally
      this._dirAngle = Math.PI - this._dirAngle;
    } else if (axis === 'y') {
      // reflect vertically
      this._dirAngle = -this._dirAngle;
    }
    // Normalize angle to keep it in reasonable range
    if (!Number.isFinite(this._dirAngle)) this._dirAngle = 0;
    while (this._dirAngle > Math.PI) this._dirAngle -= 2 * Math.PI;
    while (this._dirAngle < -Math.PI) this._dirAngle += 2 * Math.PI;

    // NEW: add a tiny random jitter to avoid infinite axis-aligned ping-pong at high speeds
    const jitter = (Math.random() - 0.5) * 0.18; // ~±10.3°
    this._dirAngle += jitter;
    // If the angle is still nearly axis-aligned, nudge a bit more
    const ax = Math.abs(Math.cos(this._dirAngle));
    const ay = Math.abs(Math.sin(this._dirAngle));
    if (ax < 0.02 || ay < 0.02) {
      this._dirAngle += (Math.random() < 0.5 ? 1 : -1) * 0.12; // ~6.9°
    }
  }

  getCollisionPoints() {
    const pts = this._points;
    pts.length = 0;
    pts.push({
      x: this.player.x,
      y: this.player.y,
      radius: this.player.radius + 3
    });
    return pts;
  }

  update(isPlayerStunned, gravityOn) {
    if (this._cooldownFrames > 0) {
      this._cooldownFrames--;
      if (this._cooldownFrames <= 0) this.canHit = true;
    }

    if (!isPlayerStunned) {
      const framesToMax = 150;
      const linearRate = this.maxCharge / framesToMax;
      const minFloor = 0.02;
      const rate = Math.max(minFloor, linearRate);

      if (this.currentCharge < this.maxCharge) {
        this.currentCharge = Math.min(this.maxCharge, this.currentCharge + rate);
      }
    }

    this.damage = Math.floor(this.currentCharge);
    this.player.speed = this.currentCharge;

    const desired = this.player.speed;
    if (desired <= 0) return;

    if (!gravityOn) {
      // No-gravity: follow current velocity direction like other balls
      const vx = this.player.vx || 0;
      const vy = this.player.vy || 0;
      const mag = Math.hypot(vx, vy);
      if (mag > 0.0001) {
        const ux = vx / mag, uy = vy / mag;
        this._dirAngle = Math.atan2(vy, vx);
        this.player.vx = ux * desired;
        this.player.vy = uy * desired;
      } else {
        // Seed with existing heading or random
        const ang = Number.isFinite(this._dirAngle) ? this._dirAngle : Math.random() * Math.PI * 2;
        this.player.vx = Math.cos(ang) * desired;
        this.player.vy = Math.sin(ang) * desired;
      }
      return;
    }

    // Gravity ON: keep heading synced to current motion, steer horizontal; gravity affects vy
    const movMag = Math.hypot(this.player.vx || 0, this.player.vy || 0);
    if (movMag > 0.0001) this._dirAngle = Math.atan2(this.player.vy, this.player.vx);
    const nx = Math.cos(this._dirAngle);
    this.player.vx = nx * desired;
    // When gravity is OFF, also align vertical velocity to the heading so motion is a straight line.
    if (!gravityOn) {
      const ny = Math.sin(this._dirAngle);
      this.player.vy = ny * desired;
    }
  }

  canAttack(isPlayerStunned) {
    return this.canHit && !isPlayerStunned;
  }

  onHit(defender) {
    this.currentCharge = 0;
    this.maxCharge += 1;
    this.player.speed = 0;
  }

  getHitStunDurations() {
    return { attacker: 4, defender: 8 };
  }

  grantsImmunityOnHit() { return false; }
  shouldReverseOnHit() { return false; }

  onSuccessfulHit() {
    this.canHit = false;
    this._cooldownFrames = this._cooldownMax;
  }

  playHitSound() {
    playUnarmedHitSound();
  }

  getDamageDisplayText() {
    const maxInt = Math.round(this.maxCharge);
    const curInt = Math.round(this.currentCharge);
    return `<span class="stat-smaller">Max Speed: ${maxInt}<br>Speed/Damage: ${curInt}</span>`;
  }

  draw() {}
}