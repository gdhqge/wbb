import { NoWeapon, Sword, Dagger, Spear, Unarmed, Bow, Shuriken } from './weapon.js';
import { Scythe } from './weapon.js';
import { Shield } from './weapon.js';
import { Wrench } from './weapon.js';
import { Staff } from './weapon.js';
import { playSwordHitSound } from './audio.js';
import { Hammer } from './weapon.js';
import { Scepter } from './weapon.js';
import { Katana } from './weapon.js'; // NEW: import Katana
import { Pickaxe } from './weapon.js'; // NEW: import Pickaxe
import { Bomb } from './weapon.js';
import { Bat } from './weapon.js';

function parseColor(color) {
    // This is a simplified parser. For a robust solution, a library might be better.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
}

export class Player {
    constructor(x, y, radius, color, vx, vy, type = 'basic') {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = vx;
        this.vy = vy;
        this.speed = 10;
        this.mass = this.radius * this.radius;
        
        // Defer weapon and color setup to setWeapon
        this.weapon = null;
        this.setWeapon(type, color);

        // Initialize other properties
        this.health = 100;
        this.stunned = false;
        this.stunTimer = 0;
        this.isAlive = true;
        this.fragments = [];
        this.isImmune = false;
        this.immunityTimer = 0;
        this.onParryCooldown = false;
        this.parryCooldownTimer = 0;
        this.isVisuallyStunned = false;
        this.reverseWeaponOnStunEnd = false;
        this.gainImmunityOnStunEnd = false;
        this.gainParryCooldownOnStunEnd = false;
        this.stunEffectAlpha = 0;

        // NEW: Simple global per-attacker cooldown (frames) to space out hits
        this.attackCooldown = 0;
        
        // NEW: Trail for unarmed players
        this.trail = [];
        this.maxTrailLength = 12; // slightly longer for smoother multi-copy fade

        // NEW: Poison state (reworked scheduling)
        // The poison system deals 1 damage per "tick".
        // There is a fixed 5s cycle (poisonCycleFrames). With N stacks, there will be N ticks
        // evenly spaced within that 5s (so spacing = cycle/stacks). This ensures:
        // - Starts at 1 dmg every 5s
        // - Each new stack adds another 1 dmg within that same 5s window
        // - Cooldown between ticks decreases as stacks increase
        this.poisonStacks = 0;             // number of concurrent poison stacks
        this.poisonCycleFrames = 300;      // ~5s at 60fps
        this.poisonElapsedFrames = 0;      // accumulates time since last poison tick

        // NEW: Purple flash when poison ticks
        this.poisonFlashFrames = 0;     
        this.poisonFlashMax = 12;       
        
        // NEW: group id for death/win logic and splits
        if (typeof Player._nextGroupId !== 'number') Player._nextGroupId = 1;
        this.groupId = Player._nextGroupId++;
    }

    setWeapon(type, color = 'white') {
        this.type = type;
        // NEW: Support custom weapon types: custom:{id}
        if (typeof type === 'string' && type.startsWith('custom:')) {
            const id = type.split(':')[1];
            const defs = Array.isArray(window.customWeapons) ? window.customWeapons : [];
            const def = defs.find(d => d.id === id) || {};
            this.weapon = new CustomWeapon(this, def);
            this.color = def.color || color || 'white';
        } else {
            switch(type) {
                case 'sword':
                    this.weapon = new Sword(this);
                    this.color = Sword.color;
                    break;
                case 'dagger':
                    this.weapon = new Dagger(this);
                    this.color = Dagger.color;
                    break;
                case 'spear':
                    this.weapon = new Spear(this);
                    this.color = Spear.color;
                    break;
                case 'unarmed':
                    this.weapon = new Unarmed(this);
                    this.color = Unarmed.color;
                    break;
                case 'bow':
                    this.weapon = new Bow(this);
                    this.color = Bow.color;
                    break;
                case 'shuriken':
                    this.weapon = new Shuriken(this);
                    this.color = Shuriken.color;
                    break;
                case 'scythe':
                    this.weapon = new Scythe(this);
                    this.color = Scythe.color;
                    break;
                case 'shield':
                    this.weapon = new Shield(this);
                    this.color = Shield.color;
                    break;
                case 'wrench':
                    this.weapon = new Wrench(this);
                    this.color = Wrench.color;
                    break;
                case 'hammer':
                    this.weapon = new Hammer(this);
                    this.color = Hammer.color;
                    break;
                case 'scepter':
                    this.weapon = new Scepter(this);
                    this.color = Scepter.color;
                    break;
                case 'staff':
                    this.weapon = new Staff(this);
                    this.color = Staff.color;
                    break;
                case 'katana':
                    this.weapon = new Katana(this);
                    this.color = Katana.color;
                    break;
                case 'pickaxe':
                    this.weapon = new Pickaxe(this);
                    this.color = Pickaxe.color;
                    break;
                case 'bomb':
                    this.weapon = new Bomb(this);
                    this.color = Bomb.color;
                    break;
                case 'bat':
                    this.weapon = new Bat(this);
                    this.color = Bat.color;
                    break;
                default:
                    this.weapon = new NoWeapon(this);
                    this.color = color;
                    break;
            }
        }
        this.originalColor = this.color;
        this.originalColorRgb = parseColor(this.color);
    }
    
    reset(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.health = 100;
        this.stunned = false;
        this.stunTimer = 0;
        this.isAlive = true;
        this.fragments = [];
        this.isImmune = false;
        this.immunityTimer = 0;
        this.onParryCooldown = false;
        this.parryCooldownTimer = 0;
        this.isVisuallyStunned = false;
        this.stunEffectAlpha = 0;
        this.reverseWeaponOnStunEnd = false;
        this.gainImmunityOnStunEnd = false;
        this.gainParryCooldownOnStunEnd = false;

        // Reset poison state (reworked)
        this.poisonStacks = 0;
        this.poisonCycleFrames = 300;
        this.poisonElapsedFrames = 0;
        this.poisonFlashFrames = 0;

        // NEW: reset global attack cooldown
        this.attackCooldown = 0;
    }

    draw(ctx) {
        if (this.isAlive) {
            // Trail for unarmed: draw multiple fading copies of the ball (no health text)
            if (this.type === 'unarmed' && this.trail.length > 1) {
                const outlineWidth = this.isBoss ? Math.max(5, Math.round(this.radius * 0.06)) : 2;
                ctx.save();
                // Draw from oldest to newest so the freshest looks strongest under the main ball
                for (let i = 0; i < this.trail.length; i++) {
                    const t = (i + 1) / this.trail.length; // 0..1
                    const alpha = t * 0.45; // subtle, layered fade
                    const pos = this.trail[i];

                    // Fill
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
                    ctx.fillStyle = this.originalColor;
                    ctx.fill();

                    // Stroke outline (same width as main, also faded)
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = outlineWidth;
                    ctx.stroke();
                }
                ctx.restore();
            }

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

            const { r, g, b } = this.originalColorRgb;
            let blendedR = r, blendedG = g, blendedB = b;

            if (this.isVisuallyStunned) {
                this.stunEffectAlpha = Math.max(0, this.stunEffectAlpha - 0.15); // Fast fade from white
            }
            // NEW: drive Bat stun pulse phase while Bat-stunned
            if (this._stunnedByBatTimer > 0) {
                this._batPulse = (this._batPulse || 0) + 0.28;
            }

            if (this.poisonFlashFrames > 0) {
                const t = Math.min(1, this.poisonFlashFrames / this.poisonFlashMax);
                const pr = 170, pg = 63, pb = 255; // #AA3FFF
                blendedR = Math.round(blendedR * (1 - t) + pr * t);
                blendedG = Math.round(blendedG * (1 - t) + pg * t);
                blendedB = Math.round(blendedB * (1 - t) + pb * t);
            }
            // NEW: pulsing white overlay during Bat stun (visual only)
            if (this.stunned && this._stunnedByBatTimer > 0) {
                const t = Math.sin(this._batPulse || 0) * 0.5 + 0.5;
                const a = 0.6 * t;
                blendedR = Math.round(blendedR * (1 - a) + 255 * a);
                blendedG = Math.round(blendedG * (1 - a) + 255 * a);
                blendedB = Math.round(blendedB * (1 - a) + 255 * a);
            }

            ctx.fillStyle = `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
            // use custom outline color if provided by custom weapon
            const outlineColor = (this.weapon && this.weapon._outlineColor) ? this.weapon._outlineColor : 'black';
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = this.isBoss ? Math.max(5, Math.round(this.radius * 0.06)) : 2;

            ctx.fill();
            ctx.stroke();

            // Health text (skip for trail copies; only draw for the main ball)
            const computed = Math.round(this.radius * 1.1);
            const healthFontSize = (this.team === 'red')
                ? Math.max(28, Math.min(110, computed))
                : Math.max(24, Math.min(72, computed));
            ctx.font = `${healthFontSize}px Anton, sans-serif`;
            // use custom health text color if provided by custom weapon
            const healthTextColor = (this.weapon && this.weapon._healthTextColor) ? this.weapon._healthTextColor : 'black';
            ctx.fillStyle = healthTextColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(this.health), this.x, this.y + 6);
        } else {
            // Compact loop for fragments
            for (let i = 0; i < this.fragments.length; i++) {
                const fragment = this.fragments[i];
                ctx.beginPath();
                ctx.arc(fragment.x, fragment.y, fragment.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${fragment.r}, ${fragment.g}, ${fragment.b}, ${fragment.alpha})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(0, 0, 0, ${fragment.alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    drawWeapon(ctx) {
        if (!this.isAlive) return;
        this.weapon.draw(ctx);
    }

    stun(duration) {
        this.stunned = true;
        this.stunTimer = duration;
        this.isVisuallyStunned = true;
        this.stunEffectAlpha = 1; // Instant full white flash
    }

    update(width, height, isMenuContext = false, gravityOn = true) {
        if (this.isAlive) {
            // Check for death early
            const DEATH_THRESHOLD = 0.5;
            if (this.health <= DEATH_THRESHOLD) {
                this.health = 0;
                this.isAlive = false;
                this.spawnFragments();
                return;
            }

            // NEW: tick down global attack cooldown each frame
            if (this.attackCooldown > 0) {
                this.attackCooldown--;
            }

            // NEW: Reworked poison ticking scheme
            if (this.poisonStacks > 0) {
                // Determine per-tick spacing based on current stacks (always at least a short gap)
                const spacing = Math.max(6, Math.floor(this.poisonCycleFrames / this.poisonStacks));
                this.poisonElapsedFrames++;

                // Only ever tick once per frame; if elapsed surpasses spacing, consume exactly one tick
                if (this.poisonElapsedFrames >= spacing) {
                    this.poisonElapsedFrames -= spacing; // keep residual to maintain even spacing

                    // Apply 1 poison damage per tick
                    this.health -= 1;
                    // NEW: Shields reflect poison tick back to the most recent scythe applier
                    if (this.type === 'shield' && this._lastPoisonApplier && this._lastPoisonApplier.isAlive) {
                        this._lastPoisonApplier.health -= 1;
                    }

                    // Trigger purple flash for visual feedback
                    this.poisonFlashFrames = this.poisonFlashMax;
                }
            }

            // Decay poison flash
            if (this.poisonFlashFrames > 0) this.poisonFlashFrames--;

            // Propagate context
            if (this.weapon) {
                this.weapon.isMenuContext = !!isMenuContext;
            }

            // NEW: Update trail for unarmed players
            if (this.type === 'unarmed') {
                this.trail.push({ x: this.x, y: this.y });
                if (this.trail.length > this.maxTrailLength) {
                    this.trail.shift();
                }
            }

            // Handle stun timer FIRST
            if (this.stunned) {
                this.stunTimer--;
                
                // Smooth transition for stun effect (NEW)
                if (this.isVisuallyStunned) {
                    this.stunEffectAlpha = Math.max(0, this.stunEffectAlpha - 0.15); // Fast fade from white
                }
                
                if (this.stunTimer <= 0) {
                    this.stunned = false;
                    this.isVisuallyStunned = false;
                    this.stunEffectAlpha = 0;
                    this._stunnedByBatTimer = 0;
                    this._batPulse = 0; // NEW: reset Bat pulse
                    
                    this.weapon.onStunEnd();
                    
                    // Reverse weapon spin direction when stun ends, only if flag is set
                    if (this.reverseWeaponOnStunEnd) {
                        this.weapon.spinDirection *= -1;
                    }
                    this.reverseWeaponOnStunEnd = false; // Reset the flag
                    
                    // Set immunity after stun ends for a short duration, if flagged to do so
                    if (this.gainImmunityOnStunEnd) {
                        this.isImmune = true;
                        this.immunityTimer = 15; // Immunity for 15 frames (0.25s)
                        this.gainImmunityOnStunEnd = false; // Reset the flag
                    }

                    // Set parry cooldown after stun ends, if flagged
                    if (this.gainParryCooldownOnStunEnd) {
                        this.onParryCooldown = true;
                        this.parryCooldownTimer = 10; // Parry cooldown for 10 frames (~0.16s)
                        this.gainParryCooldownOnStunEnd = false; // Reset the flag
                    }
                }
            }

            // Handle immunity timer (runs regardless of stun state)
            if (this.isImmune) {
                this.immunityTimer--;
                if (this.immunityTimer <= 0) {
                    this.isImmune = false;
                }
            }
            // NEW: tick down parry cooldown so parries can occur again after delay
            if (this.onParryCooldown) {
                this.parryCooldownTimer--;
                if (this.parryCooldownTimer <= 0) this.onParryCooldown = false;
            }
            // Decay Bat-stun tag timer independently (used for multi-player body collisions)
            if (this._stunnedByBatTimer > 0) this._stunnedByBatTimer--;

            // Delegate weapon update
            this.weapon.update(this.stunned, gravityOn);

            // Only move/apply physics if NOT stunned
            if (!this.stunned) {
                // Gravity handling:
                // - isMenuContext: no gravity (0)
                // - game context: default 0.15 when gravityOn is true
                let gravity = 0;
                if (!isMenuContext && gravityOn) {
                    // CHANGE: Unarmed now uses the same gravity as other balls
                    gravity = 0.15;
                }

                // Move player horizontally
                // NEW: remember previous position for swept collisions against blocks
                this.prevX = this.x; 
                this.prevY = this.y;
                this.x += this.vx;
                
                // Apply gravity and move player vertically
                this.vy += gravity;
                this.y += this.vy;

                // Wall collision detection
                if (this.x + this.radius > width) {
                    this.vx *= -1;
                    this.x = width - this.radius;
                    // NEW: notify weapon of horizontal bounce
                    if (this.weapon && typeof this.weapon.onWallBounce === 'function') {
                        this.weapon.onWallBounce('x');
                    }
                } else if (this.x - this.radius < 0) {
                    this.vx *= -1;
                    this.x = this.radius;
                    // NEW: notify weapon of horizontal bounce
                    if (this.weapon && typeof this.weapon.onWallBounce === 'function') {
                        this.weapon.onWallBounce('x');
                    }
                }

                if (this.y + this.radius > height) {
                    this.vy *= -1; // Perfectly elastic bounce
                    this.y = height - this.radius;
                    // NEW: notify weapon of vertical bounce
                    if (this.weapon && typeof this.weapon.onWallBounce === 'function') {
                        this.weapon.onWallBounce('y');
                    }
                    
                    // Stop small vertical movement to prevent endless jittering on floor
                    if (Math.abs(this.vy) < 1) { 
                        this.vy = 0;
                    }
                } else if (this.y - this.radius < 0) {
                    this.vy *= -1; // Perfectly elastic bounce
                    this.y = this.radius;
                    // NEW: notify weapon of vertical bounce
                    if (this.weapon && typeof this.weapon.onWallBounce === 'function') {
                        this.weapon.onWallBounce('y');
                    }
                }
            }
        } else {
            // Update fragments if player is not alive
            // Remove fragments that have fully faded out
            this.fragments = this.fragments.filter(fragment => fragment.alpha > 0);

            this.fragments.forEach(fragment => {
                // Gravity for fragments is also 0 in menu context
                const gravity = (!isMenuContext && gravityOn) ? 0.15 : 0; 
                const bounceDamping = 0.8; // Fragments bounce less
                const friction = 0.99; // Horizontal friction for fragments

                fragment.vy += gravity;
                fragment.x += fragment.vx;
                fragment.y += fragment.vy;
                
                // Apply some friction to slow down horizontal movement
                fragment.vx *= friction;

                // Wall collision for fragments
                if (fragment.x + fragment.radius > width) {
                    fragment.vx *= -bounceDamping;
                    fragment.x = width - fragment.radius;
                } else if (fragment.x - fragment.radius < 0) {
                    fragment.vx *= -bounceDamping;
                    fragment.x = fragment.radius;
                }

                if (fragment.y + fragment.radius > height) {
                    fragment.vy *= -bounceDamping;
                    fragment.y = height - fragment.radius;
                    // Stop small vertical movement to prevent endless jittering on floor
                    if (Math.abs(fragment.vy) < 1) { 
                        fragment.vy = 0;
                    }
                } else if (fragment.y - fragment.radius < 0) {
                    fragment.vy *= -bounceDamping;
                    fragment.y = fragment.radius;
                }

                // Fade out fragments over time
                fragment.alpha -= 0.01; // Fades out over 100 frames (approx 1.6 seconds at 60fps)
            });
        }
    }

    // Returns an array of collision points (circles) along the sword's length
    getWeaponCollisionPoints() {
        if (!this.isAlive) return [];
        return this.weapon.getCollisionPoints();
    }

    // Method to spawn small circles when the player dies
    spawnFragments() {
        this.fragments = []; // Clear any existing fragments
        const numFragments = Math.floor(Math.random() * 5) + 5; // 5 to 9 fragments
        
        for (let i = 0; i < numFragments; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1; // Random initial speed between 1 and 5 pixels/frame
            
            const { r, g, b } = this.originalColorRgb; // Use pre-parsed color
            this.fragments.push({
                x: this.x,
                y: this.y,
                radius: Math.random() * 4 + 2, // Radius between 2 and 6 pixels (larger than before)
                r: r,
                g: g,
                b: b,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1 // Start fully opaque
            });
        }
    }
}

// NEW: lightweight CustomWeapon that draws user texture and behaves like a fixed-damage melee
class CustomWeapon extends NoWeapon {
  constructor(player, def) {
    super(player);
    this.def = def || {};
    // cache audio elements
    this._hitAudio = null;
    this._shootAudio = null;
    // NEW: normalize legacy values so saved customs continue working
    if (Array.isArray(this.def.stats)) {
      this.def.stats = this.def.stats.map(s => {
        const when = (s?.when === 'when hitting teammates only') ? 'when hitting teammates' : s?.when;
        return { ...s, when };
      });
    }
    if (Array.isArray(this.def.rules)) {
      this.def.rules = this.def.rules.map(r => {
        const scope = (r?.scope === 'teammates only') ? 'teammates' : r?.scope;
        return { ...r, scope };
      });
    }
    this.image = new Image();
    if (this.def.weaponUrl) this.image.src = this.def.weaponUrl;
    this.damage = 0;
    this.heal = 0;
    this.canHit = true;
    this.spinDirection = 1;
    this._points = [];
    this._statTimers = []; // NEW: timers for "every X seconds" stat lines
    // NEW: apply saved ball stats to the player
    const b = this.def.ball || {};
    if (Number.isFinite(b.radius)) this.player.radius = Math.max(6, Math.min(120, b.radius));
    if (Number.isFinite(b.speed)) this._applyBallSpeed(b.speed);
    this._outlineColor = b.outlineColor || '#000';
    this._healthTextColor = b.healthTextColor || '#000';
    // NEW: spin rate from maker (range 0..0.5)
    this.spinRate = Number.isFinite(b.spin) ? b.spin : 0.08;
    // NEW: rendering params
    const r = this.def.render || {};
    this._render = {
      size: Number.isFinite(r.weaponSize) ? r.weaponSize : 1,
      length: Number.isFinite(r.weaponLength) ? r.weaponLength : 1,
      offset: Number.isFinite(r.weaponOffset) ? r.weaponOffset : 0.6,
      rotationDeg: Number.isFinite(r.weaponRotation) ? r.weaponRotation : 0
    };
    // Ranged support
    this.isRanged = !!this.def.isRanged;
    this._fireRateMs = (this.def.ranged && Number.isFinite(this.def.ranged.fireRateMs)) ? this.def.ranged.fireRateMs : null;
    // force all custom projectiles to be arrows (no bounces)
    this._maxBounces = 0;
    this._projImg = null; if (this.def.ranged && this.def.ranged.projUrl) { this._projImg = new Image(); this._projImg.src = this.def.ranged.projUrl; }
    this.projectiles = [];
    // prepare sounds
    if (this.def.sounds?.hit) { this._hitAudio = new Audio(this.def.sounds.hit); this._hitAudio.volume = 0.35; }
    if (this.def.sounds?.shoot) { this._shootAudio = new Audio(this.def.sounds.shoot); this._shootAudio.volume = 0.3; }
    // NEW: persistent per-scope bonuses that modify behavior (rules) every hit
    this._statBonuses = {
      opponent: { damage: 0, healing: 0 },
      teammates: { damage: 0, healing: 0 },
      anything: { damage: 0, healing: 0 },
      itself: { damage: 0, healing: 0 }
    };
    // NEW: ensure ranged defaults so it fires even without textures or explicit rate
    this._shootTimer = 0;
    if (this.isRanged && !Number.isFinite(this._fireRateMs)) this._fireRateMs = 300;
  }
  _applyBallSpeed(makerSpeed) {
    // Map maker 0..0.3 to in-game 2..18
    const mapped = 2 + Math.max(0, Math.min(0.3, makerSpeed)) * ((18 - 2) / 0.3);
    this.player.speed = mapped;
    // normalize current velocity to new speed
    const ang = Math.atan2(this.player.vy || 0, this.player.vx || 1);
    this.player.vx = Math.cos(ang) * mapped;
    this.player.vy = Math.sin(ang) * mapped;
  }
  update(isPlayerStunned, gravityOn) {
    if (!isPlayerStunned) {
      this.angle += (this.spinRate || 0.08) * this.spinDirection;
      // "every X seconds" stats
      const stats = Array.isArray(this.def.stats) ? this.def.stats : [];
      for (let i = 0; i < stats.length; i++) {
        const s = stats[i];
        if (s.when !== 'every X seconds') continue;
        const frames = Math.max(1, Math.floor((s.seconds || 1) * 60));
        this._statTimers[i] = (this._statTimers[i] || 0) + 1;
        if (this._statTimers[i] >= frames) {
          this._statTimers[i] = 0;
          this._applyStatOp(s, this.player, this);
        }
      }
      // Ranged firing
      if (this.isRanged && Number.isFinite(this._fireRateMs)) {
        this._shootTimer -= 16;
        while (this._shootTimer <= 0) {
          this._shootTimer += Math.max(50, this._fireRateMs);
          if (this._shootAudio) { try { this._shootAudio.currentTime = 0; this._shootAudio.play().catch(()=>{}); } catch {} }
          const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
          const off = (this.player.radius * (this._render?.offset || 0.6)) + 42;
          this.projectiles.push({
            x: this.player.x + ca * off, y: this.player.y + sa * off,
            vx: ca * 10, vy: sa * 10, angle: this.angle, life: 180,
            baseRadius: 12 * this.getScale()
          });
        }
      }
      // Update projectiles (bounce or act like arrows when bounces=0)
      let keep = 0, w = document.getElementById('gameCanvas');
      for (let i = 0; i < this.projectiles.length; i++) {
        const p = this.projectiles[i];
        // init per-proj bounce counter once
        if (typeof p.bouncesLeft !== 'number') p.bouncesLeft = this._maxBounces;
        p.x += p.vx; p.y += p.vy; p.life--;
        if (w) {
          const hitX = (p.x < 4) || (p.x > w.width - 4);
          const hitY = (p.y < 4) || (p.y > w.height - 4);
          if ((hitX || hitY)) {
            // always arrows: no bouncing
            p.life = 0;
          }
        }
        // Custom blocks/turrets collision: treat as arrows when no bounces
        const kind = 'arrow';
        if (window.customMap && typeof window.customMap.collideProjectile === 'function') {
          const bvx = p.vx, bvy = p.vy;
          window.customMap.collideProjectile(p, kind, this.isMenuContext);
          if (p.vx !== bvx || p.vy !== bvy) p.life = 0;
        }
        if (window.turretField && typeof window.turretField.collideProjectile === 'function') {
          const bvx2 = p.vx, bvy2 = p.vy;
          window.turretField.collideProjectile(p, kind);
          if (p.vx !== bvx2 || p.vy !== bvy2) p.life = 0;
        }
        if (p.life > 0) this.projectiles[keep++] = p;
      }
      this.projectiles.length = keep;
    }
  }
  // play custom hit sound (used by collision.js generic hook)
  playHitSound() {
    if (this._hitAudio) { try { this._hitAudio.currentTime = 0; this._hitAudio.play().catch(()=>{}); } catch {} }
  }
  onWallBounce(axis) {
    // Apply any 'when hitting wall' rules
    const stats = Array.isArray(this.def.stats) ? this.def.stats : [];
    for (const s of stats) if (s.when === 'when hitting wall') this._applyStatOp(s, this.player, null);
  }
  canAttack(isPlayerStunned) { return !isPlayerStunned; }
  getHitStunDurations() { return { attacker: 6, defender: 6 }; }
  grantsImmunityOnHit() { return false; }
  shouldReverseOnHit() { return true; }

  // NEW: apply stat-line effects that should influence THIS hit before damage is computed
  onPreResolveHit(defender) {
    const stats = Array.isArray(this.def.stats) ? this.def.stats : [];
    // Determine target string for filtering
    const isSameTeam = (a, b) => !!(a && b && a.team && b.team && a.team === b.team);
    const tgt = defender ? (isSameTeam(this.player, defender) ? 'teammates' : 'opponent') : 'anything';
    // NEW: initialize per-hit pending values and seed from behavior rules
    this._pendingDamage = 0; this._pendingHeal = 0;
    const rules = Array.isArray(this.def.rules) ? this.def.rules : [];
    rules.forEach(r => {
      if (!(r && r.effect && r.target)) return;
      const matches = (r.target === 'anything' || r.target === tgt || (r.target === 'wall' && !defender));
      if (!matches) return;
      if (r.effect === 'damages') this._pendingDamage += Number(r.amount) || 0;
      if (r.effect === 'heals')   this._pendingHeal   += Number(r.amount) || 0;
    });
    // NEW: add persistent bonuses from stats (behaviors modified by stats)
    const b = this._statBonuses;
    const addDmg = (b.anything?.damage || 0) + (b[tgt]?.damage || 0);
    const addHeal = (b.anything?.healing || 0) + (b[tgt]?.healing || 0);
    this._pendingDamage += addDmg;
    this._pendingHeal += addHeal;
  }

  onHit(defender) {
    // Apply behavior rules on contact (immediate effects like grow/shrink/etc.), but NOT direct damage/heal
    const rules = Array.isArray(this.def.rules) ? this.def.rules : [];
    const isSameTeam = (a, b) => !!(a && b && a.team && b.team && a.team === b.team);
    const tgt = defender ? (isSameTeam(this.player, defender) ? 'teammates' : 'opponent') : 'anything';

    const applyTo = (scope) => {
      if (scope === 'itself') return [this.player];
      if (scope === 'teammates') return defender && isSameTeam(this.player, defender) ? [defender] : [];
      if (scope === 'opponent') return defender && !isSameTeam(this.player, defender) ? [defender] : [];
      if (scope === 'everyone') return defender ? [this.player, defender] : [this.player];
      return defender ? [defender] : [];
    };

    for (const r of rules) {
      // NEW: skip damages/heals here; they're already combined into pending values pre-resolve
      if (r.effect === 'damages' || r.effect === 'heals') continue;
      const targets = applyTo(r.scope || 'opponent');
      for (const subj of targets) this._applyRule(r, subj, defender);
    }

    // NOTE: Stat lines that trigger "when hitting ..." are now processed in onPreResolveHit
    // to ensure their effects (e.g., damage increases) apply to the current hit.
    // NEW: Also apply non-damage/healing stat lines after the hit so they stack with behavior for future hits.
    const stats = Array.isArray(this.def.stats) ? this.def.stats : [];
    for (const s of stats) {
      if (s.when === 'when hitting anything' || s.when === `when hitting ${tgt}` || s.when === 'when hitting itself') {
        // NEW: damage/healing stats persistently modify bonuses instead of this-hit pending values
        if (s.field === 'damage' || s.field === 'healing') {
          const scopeKey = (s.when === 'when hitting anything') ? 'anything'
            : (s.when === 'when hitting itself') ? 'itself' : tgt;
          const bonuses = this._statBonuses[scopeKey] || (this._statBonuses[scopeKey] = { damage:0, healing:0 });
          const amt = Number(s.amount) || 0;
          const op = s.op;
          const apply = (cur) => {
            if (!Number.isFinite(cur)) cur = 0;
            if (op === 'increase') return cur + amt;
            if (op === 'decrease') return cur - amt;
            if (op === 'multiply') return cur * amt;
            if (op === 'divide')   return amt !== 0 ? cur / amt : cur;
            return cur;
          };
          if (s.field === 'damage') bonuses.damage = apply(bonuses.damage);
          else bonuses.healing = apply(bonuses.healing);
          continue;
        }
        this._applyStatOp(s, this.player, this, defender);
      }
    }
  }
  _applyRule(rule, subject, defender) {
    const amt = Number(rule.amount) || 0;
    // Subject can be a Player (immediate health/size/speed) or the weapon (stat-like)
    if (rule.effect === 'damages') {
      // NEW: accumulate into per-hit pending damage (no immediate HP change)
      if (subject === defender) this._pendingDamage = (this._pendingDamage || 0) + amt;
      return;
    }
    if (rule.effect === 'heals') {
      // NEW: accumulate into per-hit pending heal (no immediate HP change)
      if (subject === defender) this._pendingHeal = (this._pendingHeal || 0) + amt;
      return;
    }
    if (rule.effect === 'grows') { this.player.radius = Math.min(120, this.player.radius + amt); return; }
    if (rule.effect === 'shrinks') { this.player.radius = Math.max(6, this.player.radius - amt); return; }
    if (rule.effect === 'faster') { const curMaker = ((this.player.speed - 2) * 0.3 / 16); this._applyBallSpeed(Math.max(0, curMaker + 0.01 * amt)); return; }
    if (rule.effect === 'slower') { const curMaker = ((this.player.speed - 2) * 0.3 / 16); this._applyBallSpeed(Math.max(0, curMaker - 0.01 * amt)); return; }
  }
  _applyStatOp(stat, player, weapon, defender) {
    const applyTo = (obj, field, amount, op) => {
      const applyNum = (cur) => {
        if (!Number.isFinite(cur)) cur = 0;
        if (op === 'increase') return cur + amount;
        if (op === 'decrease') return cur - amount;
        if (op === 'multiply') return cur * amount;
        if (op === 'divide')   return amount !== 0 ? cur / amount : cur;
        return cur;
      };
      if (field === 'damage') weapon.damage = Math.max(0, applyNum(weapon.damage));
      else if (field === 'healing') weapon.heal = Math.max(0, applyNum(weapon.heal || 0));
      else if (field === 'size') player.radius = Math.max(6, Math.min(120, applyNum(player.radius)));
      else if (field === 'speed') {
        // Clamp maker-speed domain to [0, 0.3] for stable stacking, then map back to game speed.
        const makerCur = (player.speed - 2) * (0.3 / 16);
        const makerNext = Math.max(0, Math.min(0.3, applyNum(makerCur)));
        weapon._applyBallSpeed(makerNext);
      }
      else if (field === 'spin speed') weapon.spinRate = Math.max(0, Math.min(0.5, applyNum(weapon.spinRate || 0.08)));
      else if (field === 'fire rate' && Number.isFinite(weapon._fireRateMs)) {
        // Interpret "fire rate" as shots per second (intuitive):
        // Convert ms -> shots/sec, apply op, then convert back to ms (clamped).
        const EPS = 0.0001;
        let sps = 1000 / Math.max(EPS, weapon._fireRateMs);
        sps = applyNum(sps);
        sps = Math.max(EPS, sps);                 // prevent zero/negative rates
        weapon._fireRateMs = Math.max(50, 1000 / sps); // clamp to minimum 50ms between shots
      }
    };
    applyTo(player, stat.field, Number(stat.amount) || 0, stat.op);
  }
  getCollisionPoints() {
    const pts = this._points; pts.length = 0;
    if (!this.def.weaponUrl || !(this.image && this.image.complete && this.image.naturalWidth > 0)) {
      pts.push({ x: this.player.x, y: this.player.y, radius: this.player.radius + 3 });
      return pts;
    }
    const s = this.getScale();
    const offsetMul = (this._render?.offset ?? 0.6);
    const sizeMul = (this._render?.size ?? 1);
    const lengthMul = (this._render?.length ?? 1);
    const rotDeg = (this._render?.rotationDeg ?? 0);

    const baseW = 100 * sizeMul * s;
    const w = baseW * lengthMul;
    const h = baseW * (this.image.naturalHeight / this.image.naturalWidth);
    const startDist = this.player.radius * offsetMul;

    // Attach point along main angle only (position unchanged by orientation)
    const caMain = Math.cos(this.angle), saMain = Math.sin(this.angle);
    const ax = this.player.x + caMain * startDist;
    const ay = this.player.y + saMain * startDist;

    // Direction of the weapon's length uses local orientation
    const thetaDir = this.angle + (Math.PI * rotDeg / 180);
    const ca = Math.cos(thetaDir), sa = Math.sin(thetaDir);

    const samples = Math.max(5, Math.ceil(w / (20 * s)));
    const step = samples > 1 ? (w / (samples - 1)) : 0;
    const r = Math.max(6 * s, (h * 0.5) * 0.5);

    for (let i = 0; i < samples; i++) {
      const d = i * step;
      pts.push({ x: ax + ca * d, y: ay + sa * d, radius: r });
    }

    const ahead = Math.max(10 * s, h * 0.25);
    const tipD = w;
    pts.push({ x: ax + ca * (tipD + ahead),     y: ay + sa * (tipD + ahead),     radius: r * 0.9 });
    pts.push({ x: ax + ca * (tipD + ahead * 2), y: ay + sa * (tipD + ahead * 2), radius: r * 0.8 });

    if (this.isRanged) {
      const pr = Math.max(12 * this.getScale(), 12);
      this.projectiles.forEach(p => {
        const asArrow = (this._maxBounces <= 0);
        pts.push({ x: p.x, y: p.y, radius: pr, type: asArrow ? 'arrow' : 'shuriken', arrowRef: p });
      });
    }
    return pts;
  }
  draw(ctx) {
    if (!this.image || !this.image.complete || this.image.naturalWidth === 0) return;
    ctx.save();
    // 1) rotate only by weapon angle for positioning (attachment point stays put)
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.angle);
    const s = this.getScale();
    const baseW = 100 * (this._render?.size || 1) * s;
    const w = baseW * (this._render?.length || 1);
    const h = baseW * (this.image.naturalHeight / this.image.naturalWidth);
    const attach = this.player.radius * (this._render?.offset || 0.6);
    // move to attachment point along main angle only
    ctx.translate(attach, 0);
    // 2) rotate texture locally by orientation (does not affect attachment position)
    const rotLocal = Math.PI * (this._render?.rotationDeg || 0) / 180;
    ctx.rotate(rotLocal);
    ctx.drawImage(this.image, 0, -h / 2, w, h);
    ctx.restore();
    
    // Draw projectiles if ranged
    if (this.isRanged) {
      this.projectiles.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        if (this._projImg && this._projImg.complete && this._projImg.naturalWidth > 0) {
          const bw = 72 * (this.def.ranged?.projSize || 1) * (this.def.ranged?.projLength || 1);
          const bh = bw * (this._projImg.naturalHeight / this._projImg.naturalWidth);
          ctx.drawImage(this._projImg, -bw/2, -bh/2, bw, bh);
        } else {
          ctx.fillStyle = '#444'; ctx.fillRect(-12, -4, 24, 8);
        }
        ctx.restore();
      });
    }
  }
}