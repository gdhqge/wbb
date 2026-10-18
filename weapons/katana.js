// Katana: spinning melee that applies "slices" during defender's stun.
// Color: #7effbf, icon: katana_icon.png, texture: katana.png
import { Weapon } from './base.js';
import { playKatanaHitSound } from '../audio.js';

export class Katana extends Weapon {
  static color = '#7effbf';
  static icon = 'katana_icon.png';

  constructor(player) {
    super(player);
    this.image.src = 'katana.png';
    this.damage = 0;       // body hit does not deal damage; all damage comes from slices
    this.slices = 1;       // starts at 1 slice
    this.canHit = true;    // cooldown like sword
    this._cooldownFrames = 0;
    this._cooldownMax = 8;

    this._sliceQueues = [];  // [{ target, remaining, cool }]
    this._vfx = [];          // local VFX this katana spawned

    // NEW: prevent stacking multiple "single-blow" queues while target is already stunned
    this._recentHitMap = new WeakMap();
    this._lastTint = null; // cache for tinting
  }

  update(isPlayerStunned) {
    if (this._cooldownFrames > 0) {
      this._cooldownFrames--;
      if (this._cooldownFrames <= 0) this.canHit = true;
    }
    if (!isPlayerStunned) {
      this.angle += 0.1 * this.spinDirection; // sword-like spin
    }
    // Drive slice queues: only hit while target currently stunned
    const next = [];
    for (const q of this._sliceQueues) {
      if (!q.target || !q.target.isAlive) continue;
      if (q.remaining <= 0) continue;
      q.cool = (q.cool || 0) - 1;
      if (q.cool <= 0) {
        if (!q.target.stunned) q.target.stun(2); // ensure a tiny window to finish all slices
        // Always damage the target by 1
        q.target.health -= 1;
        // Additionally reflect to attacker when target is a Shield
        if (q.target.type === 'shield') {
          const src = this.player || q.source;
          if (src && src.isAlive) src.health -= 1;
        }
        if (!this.isMenuContext) { try { playKatanaHitSound(); } catch {} }
        q.target.isVisuallyStunned = true; // emphasize stun visuals
        q.target.stunEffectAlpha = Math.min(1, (q.target.stunEffectAlpha || 0) + 0.25);
        this._spawnSliceVfx(q.target);
        q.remaining -= 1;
        q.cool = 2; // rapid consecutive hits
      }
      if (q.remaining > 0) next.push(q);
    }
    this._sliceQueues = next;

    // Update slice VFX
    for (let i = this._vfx.length - 1; i >= 0; i--) {
      const v = this._vfx[i];
      v.age++;
      const t = v.age / v.life;
      // progress along path
      v.pos = {
        x: v.from.x + (v.to.x - v.from.x) * Math.min(1, t * 1.2),
        y: v.from.y + (v.to.y -v.from.y) * Math.min(1, t * 1.2),
      };
      // shrink width more aggressively for a longer, thinning streak
      v.w = v.w0 * Math.max(0, 1 - t * 1.9);
      if (v.age >= v.life) this._vfx.splice(i, 1);
    }
  }

  canAttack(isPlayerStunned) { return this.canHit && !isPlayerStunned; }
  onStunEnd() { this.canHit = true; }
  onSuccessfulHit() { this.canHit = false; this._cooldownFrames = this._cooldownMax; }
  getHitStunDurations() { return { attacker: 8, defender: 8 }; }
  grantsImmunityOnHit() { return true; }
  shouldReverseOnHit() { return true; }

  onHit(defender) {
    // NEW: if defender is already stunned, avoid re-queuing slices multiple times per overlap
    if (defender && defender.stunned) {
      const now = (performance?.now?.() || Date.now());
      const last = this._recentHitMap.get(defender) || 0;
      if ((now - last) < 220) return; // ignore rapid re-contacts within ~0.22s
      this._recentHitMap.set(defender, now);
    }

    // Queue slices to occur during defender's current stun window
    const count = Math.max(1, Math.floor(this.slices));
    this._sliceQueues.push({ target: defender, remaining: count, cool: 0, source: this.player });
    this.slices += 1; // grow stat
  }

  getDamageDisplayText() { return `Slices: ${this.slices}`; }

  getCollisionPoints() {
    const pts = this._points; pts.length = 0;

    const s = this.getScale();
    const w = 120 * s;
    const h = w * (this.image.naturalHeight / this.image.naturalWidth || 1);

    const startDist = this.player.radius; // same as draw()
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);

    const samples = Math.max(5, Math.ceil(w / (20 * s)));
    const step = samples > 1 ? (w / (samples - 1)) : 0;
    const r = Math.max(6 * s, (h * 0.5) * 0.5);

    for (let i = 0; i < samples; i++) {
      const d = startDist + i * step;
      pts.push({ x: this.player.x + d * ca, y: this.player.y + d * sa, radius: r, type: 'katana' });
    }
    return pts;
  }

  draw(ctx) {
    // blade with progressive tint like Sword (color #7effbf)
    if (this.image.complete && this.image.naturalWidth > 0) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(this.angle);
      const s = this.getScale();
      const w = 120 * s;
      const h = w * (this.image.naturalHeight / this.image.naturalWidth || 1);

      // compute tint alpha based on slices
      const alpha = Math.min(0.7, (this.slices || 0) * 0.06);
      const needResize = (this.tintCanvas.width !== w || this.tintCanvas.height !== h);
      const tintKey = `rgba(126,255,191,${alpha.toFixed(3)})`;
      const needRetint = (this._lastTint !== tintKey) || needResize;

      if (needResize) { this.tintCanvas.width = w; this.tintCanvas.height = h; }
      if (needRetint) {
        const tctx = this.tintCanvas.getContext('2d');
        tctx.clearRect(0, 0, w, h);
        tctx.drawImage(this.image, 0, 0, w, h);
        if (alpha > 0) {
          tctx.globalCompositeOperation = 'multiply';
          tctx.fillStyle = tintKey;
          tctx.fillRect(0, 0, w, h);
          tctx.globalCompositeOperation = 'destination-in';
          tctx.drawImage(this.image, 0, 0, w, h);
          tctx.globalCompositeOperation = 'source-over';
        }
        this._lastTint = tintKey;
      }

      ctx.drawImage(this.tintCanvas, this.player.radius, -h / 2, w, h);
      ctx.restore();
    }
    // VFX (angled slicing rectangles) — make longer and borderless
    for (const v of this._vfx) {
      if (!v.target || !v.target.isAlive) continue;
      const a = v.angle;
      ctx.save();
      ctx.translate(v.pos.x, v.pos.y);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(126,255,191,0.85)';
      // borderless (no stroke)
      ctx.fillRect(-v.w / 2, -v.h / 2, v.w, v.h);
      ctx.restore();
    }
  }

  _spawnSliceVfx(target) {
    const ang = Math.random() * Math.PI * 2;
    const dist = target.radius * (0.2 + Math.random() * 0.6);
    const center = { x: target.x, y: target.y };
    const from = { x: center.x - Math.cos(ang) * dist, y: center.y - Math.sin(ang) * dist };
    const to   = { x: center.x + Math.cos(ang) * dist, y: center.y + Math.sin(ang) * dist };
    this._vfx.push({
      target,
      angle: ang + Math.PI / 2,
      from, to,
      pos: { x: from.x, y: from.y },
      // NEW: longer, thicker rectangles
      w0: Math.max(18, target.radius * 1.6),
      w:  Math.max(18, target.radius * 1.6),
      h:  Math.max(8,  target.radius * 0.16),
      age: 0,
      life: 14
    });
  }
}