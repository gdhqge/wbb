import { playParrySound } from './audio.js';
import { playBowImpactSound, playHitHurtSound } from './audio.js'; // NEW: impact sounds for deflected hits
import { Player } from './player.js'; // NEW: to spawn split halves
import { getDefaultHealth, getDefaultBossHealth } from './state.js';

// NEW: Shield per-target contact lock to prevent multiple reflects from a single continuous overlap
// Uses a nested Map keyed by attacker -> defender with a time-based unlock to avoid frame bookkeeping.
const shieldContactLock = new Map();
function isShieldLocked(attacker, defender) {
    const map = shieldContactLock.get(attacker);
    if (!map) return false;
    const unlockAt = map.get(defender) || 0;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return now < unlockAt;
}
function lockShield(attacker, defender, ms = 220) {
    let map = shieldContactLock.get(attacker);
    if (!map) {
        map = new Map();
        shieldContactLock.set(attacker, map);
    }
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    map.set(defender, now + ms);
}

// NEW: generic per-attacker→defender hit lock (prevents multi-hits during one overlap)
const hitContactLock = new Map();
function isHitLocked(attacker, defender) {
    const m = hitContactLock.get(attacker); if (!m) return false;
    const t = m.get(defender) || 0; const now = (performance?.now?.() || Date.now());
    return now < t;
}
function lockHit(attacker, defender, ms = 220) {
    let m = hitContactLock.get(attacker); if (!m) { m = new Map(); hitContactLock.set(attacker, m); }
    const now = (performance?.now?.() || Date.now()); m.set(defender, now + ms);
}

// NEW: swept test to catch fast projectile collisions
function segmentCircleIntersects(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx*dx + dy*dy || 1e-6;
    const b = 2 * (fx*dx + fy*dy);
    const c = (fx*fx + fy*fy) - r*r;
    let t = (-b - Math.sqrt(Math.max(0, b*b - 4*a*c))) / (2*a);
    return t >= 0 && t <= 1;
}

function deflectProjectile(projectilePoint, weaponPoint, deflectingPlayer) {
    const arrow = projectilePoint.arrowRef || projectilePoint.projectileRef;
    if (!arrow || arrow.parryCooldown > 0) return;

    const dx = arrow.x - weaponPoint.x;
    const dy = arrow.y - weaponPoint.y;
    const magSq = dx * dx + dy * dy;

    if (magSq < 0.0001) {
        arrow.vx *= -1;
        arrow.vy *= -1;
        arrow.angle = Math.atan2(arrow.vy, arrow.vx);
    } else {
        const speed = Math.max(8, Math.hypot(arrow.vx, arrow.vy) * 1.05);
        const invMag = 1 / Math.sqrt(magSq);
        const nx = dx * invMag;
        const ny = dy * invMag;
        arrow.vx = nx * speed;
        arrow.vy = ny * speed;
        arrow.angle = Math.atan2(arrow.vy, arrow.vx);
    }

    arrow.parryCooldown = 6;

    // NEW: mark as deflected so it can deal damage to anyone it hits afterward
    arrow.deflected = true;
    arrow.lastDeflectedBy = deflectingPlayer || null;
    arrow.deflectedFrames = 0;

    // NEW: debug log for shield/projectile deflects
    import('./debug.js').then(({ isShieldDebugEnabled, logShield }) => {
        if (isShieldDebugEnabled()) {
            const who = deflectingPlayer ? (deflectingPlayer.team ? `${deflectingPlayer.team} team` : 'player') : 'unknown';
            logShield(`Projectile deflected by ${who}. Kind=${projectilePoint.type}`);
        }
    });
}

// Extended to handle arrow parries. Returns true when a parry or deflect occurred.
function checkWeaponParry(player1, player2, isMenuContext = false) {
    if (
        player1.type === 'basic' || player2.type === 'basic' ||
        player1.type === 'unarmed' || player2.type === 'unarmed' ||
        player1.stunned || player2.stunned || player1.onParryCooldown || player2.onParryCooldown
    ) {
        return false;
    }

    const weaponPoints1 = player1.getWeaponCollisionPoints();
    const weaponPoints2 = player2.getWeaponCollisionPoints();

    if (weaponPoints1.length === 0 || weaponPoints2.length === 0) return false;

    // RESTORED: simple, consistent parry rules
    // - projectiles deflect on overlap
    // - melee parry when weapon points overlap AND both are generally facing each other
    const facingDotMin = 0.05;      // more permissive facing requirement
    // NEW: small dynamic buffer helps catch fast-crossing parries
    const relVxParry = (player1.vx || 0) - (player2.vx || 0);
    const relVyParry = (player1.vy || 0) - (player2.vy || 0);
    const relSpeedParry = Math.hypot(relVxParry, relVyParry);
    const overlapBuffer = Math.min(16, 6 + relSpeedParry * 0.2); // bigger buffer at speed

    function isFacing(attacker, defender) {
        const fx = Math.cos(attacker.weapon.angle);
        const fy = Math.sin(attacker.weapon.angle);
        const dx = defender.x - attacker.x;
        const dy = defender.y - attacker.y;
        const mag = Math.hypot(dx, dy) || 1;
        const dot = (fx * dx + fy * dy) / mag;
        return dot > facingDotMin;
    }

    for (const point1 of weaponPoints1) {
        for (const point2 of weaponPoints2) {
            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            const distSq = dx * dx + dy * dy;
            const r = point1.radius + point2.radius + overlapBuffer;

            if (distSq < r * r) {
                // Projectile deflects (single SFX, then return)
                const point1IsProj = point1 && (point1.type === 'arrow' || point1.type === 'shuriken') && (point1.arrowRef || point1.projectileRef);
                const point2IsProj = point2 && (point2.type === 'arrow' || point2.type === 'shuriken') && (point2.arrowRef || point2.projectileRef);

                // Staff fireballs are handled by staff.js; ignore here
                if ((point1 && point1.type === 'staff-fireball') || (point2 && point2.type === 'staff-fireball')) {
                    continue;
                }

                if (point1IsProj) {
                    if (!isMenuContext) { try { playParrySound(); } catch {} }
                    deflectProjectile(point1, point2, player2);
                    return true;
                }
                if (point2IsProj) {
                    if (!isMenuContext) { try { playParrySound(); } catch {} }
                    deflectProjectile(point2, point1, player1);
                    return true;
                }

                // Melee parry: require both facing each other; single SFX, then stun both
                const highSpeed = relSpeedParry > 6; // allow high-speed parries without strict facing
                if (!highSpeed && (!isFacing(player1, player2) || !isFacing(player2, player1))) continue;
                if (!isMenuContext) { try { playParrySound(); } catch {} }

                // Apply classic parry effects
                player1.stun(15);
                player2.stun(15);
                player1.reverseWeaponOnStunEnd = true;
                player2.reverseWeaponOnStunEnd = true;
                player1.gainParryCooldownOnStunEnd = true;
                player2.gainParryCooldownOnStunEnd = true;
                player1.canHit = false;
                player2.canHit = false;

                // Gentle separation to avoid immediate re-trigger
                const invLen = 1 / (Math.hypot(dx, dy) || 1);
                const nx = dx * invLen, ny = dy * invLen;
                const sep = 3;
                player1.x -= nx * sep; player1.y -= ny * sep;
                player2.x += nx * sep; player2.y += ny * sep;

                return true;
            }
        }
    }

    return false;
}

// NEW: projectile vs weapon-owner damage check (no stun for arrows; consumes projectile)
function _projectileHitsWeaponOwner(proj, kind, victim) {
    if (!victim || !victim.isAlive || !victim.getWeaponCollisionPoints) return false;
    const pts = victim.getWeaponCollisionPoints();
    if (!pts || !pts.length) return false;

    // projectile radius
    const pr = (kind === 'arrow')
      ? Math.max(10, (proj.baseRadius || 12))
      : Math.max(10, (proj.collisionRadius || 14));

    // NEW: helper to reflect a projectile away from a point (no despawn)
    function reflectAway(p, fromX, fromY) {
        const dx = p.x - fromX, dy = p.y - fromY;
        const mag = Math.hypot(dx, dy) || 1;
        const nx = dx / mag, ny = dy / mag;
        const speed = Math.max(8, Math.hypot(p.vx || 0, p.vy || 0) * 1.05);
        p.vx = nx * speed; p.vy = ny * speed;
        p.angle = Math.atan2(p.vy, p.vx);
        p.parryCooldown = 6;
    }

    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dx = p.x - proj.x, dy = p.y - proj.y;
        const rr = (p.radius + pr);
        if (dx*dx + dy*dy <= rr*rr) {
            // NEW: if an arrow has already been deflected, don't despawn on weapon contact — reflect it again
            if (kind === 'arrow' && proj.deflected) {
                reflectAway(proj, p.x, p.y);
                try { playParrySound(); } catch {}
                return true; // handled (no damage, no despawn)
            }
            victim.health -= 1;             // deal 1 on weapon contact
            proj.life = 0;                  // consume projectile
            try {
              if (kind === 'arrow') playBowImpactSound();
              else playHitHurtSound();
            } catch {}
            return true;
        }
    }
    return false;
}

function processDeflectedProjectiles(players, gameOverCallback) {
    // Iterate through every player's projectiles that were marked deflected
    for (const owner of players) {
        if (!owner.isAlive || !owner.weapon) continue;

        // Collect candidate projectiles
        const projectiles = [];
        if (owner.type === 'bow' && Array.isArray(owner.weapon.arrows)) {
            owner.weapon.arrows.forEach(a => { if (a && a.deflected) projectiles.push(a); });
        }
        if (owner.type === 'shuriken' && Array.isArray(owner.weapon.projectiles)) {
            owner.weapon.projectiles.forEach(p => { if (p && p.deflected) projectiles.push(p); });
        }
        if (!projectiles.length) continue;

        // Tick deflected frame counter
        projectiles.forEach(p => { p.deflectedFrames = (p.deflectedFrames || 0) + 1; });

        for (const victim of players) {
            if (!victim.isAlive) continue;

            for (const proj of projectiles) {
                // NEW: prevent friendly fire in Teams/Boss modes
                // If victim shares a team with the original owner OR the deflector, skip damage.
                const deflector = proj.lastDeflectedBy || null;
                if (victim.team && (
                    (owner.team && victim.team === owner.team) ||
                    (deflector && deflector.team && victim.team === deflector.team)
                )) {
                    continue;
                }

                // Simple circle hit test
                const dx = victim.x - proj.x;
                const dy = victim.y - proj.y;
                const distSq = dx * dx + dy * dy;

                // Reasonable radii per projectile type
                const pr =
                    proj.kind === 'arrow'
                        ? Math.max(10, (proj.baseRadius || 12))
                        : Math.max(10, (proj.collisionRadius || 14));

                let effectiveR = victim.radius + pr;
                // NEW: slightly enlarge projectile hit radius against bosses
                if (victim.isBoss) {
                  effectiveR *= 1.15;
                }

                if (distSq <= effectiveR * effectiveR) {
                    // Deal 1 damage (projectile base damage)
                    victim.health -= 1;

                    // NEW: swept test for fast deflected projectiles
                    const prevX = Number.isFinite(proj.prevX) ? proj.prevX : proj.x - (proj.vx || 0);
                    const prevY = Number.isFinite(proj.prevY) ? proj.prevY : proj.y - (proj.vy || 0);
                    if (proj.life > 0 && segmentCircleIntersects(prevX, prevY, proj.x, proj.y, victim.x, victim.y, effectiveR)) {
                        victim.health -= 1; proj.life = 0; try { playHitHurtSound(); } catch {}
                    }

                    // Do not stun or grant immunity for arrow hits so multiple arrows can land at once
                    if (proj.kind !== 'arrow') {
                        const stun = { attacker: 6, defender: 8 };
                        victim.stun(stun.defender);
                        const attackerRef = (proj.lastDeflectedBy || owner);
                        if (attackerRef && attackerRef.isAlive && stun.attacker > 0) {
                            attackerRef.stun(stun.attacker);
                        }
                    }

                    // Immunity on stun end mirrors bow behavior for arrows only
                    victim.gainImmunityOnStunEnd = (proj.kind === 'arrow');

                    // Remove projectile after hit
                    proj.life = 0;

                    // Death handling
                    const DEATH_THRESHOLD = 0.5;
                    if (victim.health <= DEATH_THRESHOLD) {
                        victim.health = 0;
                        if (victim.isAlive) {
                            victim.isAlive = false;
                            victim.spawnFragments();
                        }
                        if (typeof gameOverCallback === 'function') {
                            // In non-FFA modes, end round if applicable
                            const attackerRef = (proj.lastDeflectedBy || owner);
                            gameOverCallback(attackerRef || null);
                        }
                    }
                }

                // NEW: allow deflected projectiles to damage on weapon contact too (e.g., Shield)
                if (proj.life > 0) {
                    const kind = proj.kind === 'arrow' ? 'arrow' : 'shuriken';
                    if (_projectileHitsWeaponOwner(proj, kind, victim)) {
                        // no stun for arrows; shuriken keep default below
                        if (kind !== 'arrow') {
                            victim.stun(8);
                            owner.stun(6);
                        }
                        // death check
                        if (victim.health <= 0.5) {
                          victim.health = 0;
                          if (victim.isAlive) { victim.isAlive = false; victim.spawnFragments(); }
                          if (typeof gameOverCallback === 'function') gameOverCallback(owner);
                        }
                        continue;
                    }
                }
            }
        }
    }
}

// NEW: handle non-deflected owner projectiles (arrows, shuriken) vs players
function processOwnerProjectiles(players, gameOverCallback) {
    for (const owner of players) {
        if (!owner.isAlive || !owner.weapon) continue;

        const arrows = (owner.type === 'bow' && Array.isArray(owner.weapon.arrows)) ? owner.weapon.arrows : [];
        const stars  = (owner.type === 'shuriken' && Array.isArray(owner.weapon.projectiles)) ? owner.weapon.projectiles : [];

        // Local helper to test a projectile against all victims
        const testHits = (proj, kind) => {
            if (!proj || proj.deflected) return;
            for (const victim of players) {
                if (!victim.isAlive) continue;
                if (victim === owner) continue;
                if (victim.team && owner.team && victim.team === owner.team) continue;

                const dx = victim.x - proj.x;
                const dy = victim.y - proj.y;
                const pr = kind === 'arrow'
                    ? Math.max(10, (proj.baseRadius || 12))
                    : Math.max(12, (proj.collisionRadius || 14));
                let effectiveR = victim.radius + pr;
                if (victim.isBoss) effectiveR *= 1.15; // slight boost vs boss

                if (dx*dx + dy*dy <= effectiveR * effectiveR) {
                    // Apply 1 damage per projectile
                    victim.health -= 1;

                    // NEW: swept collision for fast projectiles (arrows/shuriken)
                    const prevX = Number.isFinite(proj.prevX) ? proj.prevX : proj.x - (proj.vx || 0);
                    const prevY = Number.isFinite(proj.prevY) ? proj.prevY : proj.y - (proj.vy || 0);
                    const hitSwept = segmentCircleIntersects(prevX, prevY, proj.x, proj.y, victim.x, victim.y, effectiveR);
                    if (proj.life > 0 && hitSwept) {
                        victim.health -= 1; proj.life = 0; try { if (kind==='arrow') playBowImpactSound(); else playHitHurtSound(); } catch {}
                    }

                    // Do not stun or grant post-stun immunity for arrow hits, so multiple arrows can connect simultaneously
                    if (kind !== 'arrow') {
                        const stun = { attacker: 6, defender: 8 };
                        victim.stun(stun.defender);
                        owner.stun(stun.attacker);
                    }

                    // Sounds
                    try {
                        if (kind === 'arrow') playBowImpactSound();
                        else playHitHurtSound();
                    } catch {}

                    // Consume projectile
                    proj.life = 0;

                    // Death handling
                    const DEATH_THRESHOLD = 0.5;
                    if (victim.health <= DEATH_THRESHOLD) {
                        victim.health = 0;
                        if (victim.isAlive) { victim.isAlive = false; victim.spawnFragments(); }
                        if (typeof gameOverCallback === 'function') gameOverCallback(owner);
                        // NEW: inform weapon of successful projectile hit (Shuriken bounce scaling)
                        try { owner.weapon.onHit(victim); owner.weapon.onSuccessfulHit(); } catch {}
                        break; // stop checking this projectile
                    }
                }
            }
        };

        arrows.forEach(a => testHits(a, 'arrow'));
        stars.forEach(s => testHits(s, 'shuriken'));
    }
}

function checkWeaponCollision(attacker, defender, gameOverCallback, players, isMenuContext = false) {
    // Allow custom weapons to interact with teammates so heal/buff rules can apply; still block others (except scepter)
    const isSameTeam = (attacker.team && defender.team && attacker.team === defender.team);
    const isCustomAttacker = (typeof attacker.type === 'string' && attacker.type.startsWith('custom:'));
    if (isSameTeam && attacker.type !== 'scepter' && !isCustomAttacker) return;
    // NEW: Scepter should not interact with non-teammates (enemy team); parry handled earlier
    if (attacker.type === 'scepter' && !isSameTeam) return;
    // NEW: block repeated contacts for a short time between the same pair
    if (isHitLocked(attacker, defender)) return;

    if (attacker.attackCooldown && attacker.attackCooldown > 0) return;

    const canAttack = attacker.weapon.canAttack(attacker.stunned);
    if (attacker.type === 'basic' || !defender.isAlive || !attacker.isAlive || !canAttack || defender.isImmune) return;

    if (attacker.type === 'shield' && isShieldLocked(attacker, defender)) return;

    // NEW: quick radial reach culling to skip expensive point checks when too far apart
    {
        const dxc = defender.x - attacker.x;
        const dyc = defender.y - attacker.y;
        const reach = (attacker.weapon?.getMaxReach ? attacker.weapon.getMaxReach() : (attacker.radius + 160));
        const maxDist = reach + (defender.radius || 0) + 24; // small buffer
        if ((dxc*dxc + dyc*dyc) > (maxDist * maxDist)) return;
    }

    const weaponCollisionPoints = attacker.getWeaponCollisionPoints();
    const defenderWeaponPoints = defender.getWeaponCollisionPoints();
    if (weaponCollisionPoints.length === 0) return;

    let weaponToWeaponCollision = false;
    if ((defender.type === 'shield' || (attacker.type !== 'unarmed' && defender.type !== 'unarmed')) && defenderWeaponPoints.length > 0) {
        const buffer = 5;
        for (const attackPoint of weaponCollisionPoints) {
            for (const defendPoint of defenderWeaponPoints) {
                const dx = defendPoint.x - attackPoint.x;
                const dy = defendPoint.y - attackPoint.y;
                const distSq = dx * dx + dy * dy;
                const r = attackPoint.radius + defendPoint.radius + buffer;
                if (distSq < r * r) {
                    weaponToWeaponCollision = true;
                    break;
                }
            }
            if (weaponToWeaponCollision) break;
        }
    }

    let hitDetected = false;
    let hitPoint = null;
    for (const weaponPoint of weaponCollisionPoints) {
        if (weaponPoint.type === 'shuriken-weapon') continue;
        // Staff fireball: explode instead of direct damage
        if (weaponPoint.type === 'staff-fireball' && weaponPoint.arrowRef) {
            // handled entirely in staff.js; ignore here
            continue;
        }
        const dx = defender.x - weaponPoint.x;
        const dy = defender.y - weaponPoint.y;
        const distSq = dx * dx + dy * dy;

        // NEW: dynamic padding based on relative speed (prevents tunneling)
        const relVx = (attacker.vx || 0) - (defender.vx || 0);
        const relVy = (attacker.vy || 0) - (defender.vy || 0);
        const relSpeed = Math.hypot(relVx, relVy);
        let speedPad = Math.min(16, relSpeed * 0.25);
        if (attacker.type === 'spear') speedPad = Math.min(22, relSpeed * 0.35);

        const basePad = (attacker.type === 'dagger') ? 2 : 0;
        // NEW: boss body padding so hits land reliably on giant targets
        const bossBodyPad = defender.isBoss ? Math.max(10, defender.radius * 0.12) : 0;
        // NEW: give shields a small extra body pad to reduce tunneling through the ball
        const shieldBodyPad = (defender.type === 'shield') ? Math.max(4, defender.radius * 0.06) : 0;
        // NEW: length-based padding by weapon type to better catch long/fast sweeps
        let lengthPad = 0;
        if (attacker.type === 'spear') {
          const scl = attacker.weapon?.getScale ? attacker.weapon.getScale() : 1;
          const L = Math.max(1, attacker.weapon?.spearLength || 1);
          lengthPad = Math.min(28, (8 + L * 12) * scl);
        } else if (attacker.type === 'bat') {
          const scl = attacker.weapon?.getScale ? attacker.weapon.getScale() : 1;
          lengthPad = Math.min(24, 12 * scl);
        } else if (attacker.type !== 'unarmed' && attacker.type !== 'basic') {
          const scl = attacker.weapon?.getScale ? attacker.weapon.getScale() : 1;
          lengthPad = Math.min(12, 6 * scl);
        }

        const effectiveRadius = defender.radius + weaponPoint.radius + basePad + speedPad + shieldBodyPad + bossBodyPad + lengthPad;

        // NEW: allow body hits on a shield even if weapons are overlapping;
        // weapon-to-weapon contact should not suppress shield body reflection
        const tipPriority = (attacker.type === 'spear' && (weaponPoint.isTip === true));
        // NEW: do not block hits when either side is a custom weapon
        const isCustomAtt = (typeof attacker.type === 'string' && attacker.type.startsWith('custom:'));
        const isCustomDef = (typeof defender.type === 'string' && defender.type.startsWith('custom:'));
        const blocked = (attacker.type === 'unarmed')
            ? false
            : (weaponToWeaponCollision && !tipPriority && defender.type !== 'shield' && !(isCustomAtt || isCustomDef));

        if (distSq < effectiveRadius * effectiveRadius && !blocked) {
            hitDetected = true;
            hitPoint = weaponPoint;
            break;
        }
    }

    if (hitDetected) {
        // Handle custom ranged projectile points (arrow/shuriken) so they actually deal damage and despawn
        if (hitPoint && (hitPoint.type === 'arrow' || hitPoint.type === 'shuriken') && hitPoint.arrowRef) {
            const proj = hitPoint.arrowRef;
            defender.health -= 1;
            try {
                if (hitPoint.type === 'arrow') playBowImpactSound();
                else playHitHurtSound();
            } catch {}
            // Stun only for shuriken-like; arrows do not stun
            if (hitPoint.type !== 'arrow') {
                defender.stun(8);
                if (attacker && attacker.isAlive) attacker.stun(6);
            }
            proj.life = 0;
            if (defender.health <= 0.5) {
                defender.health = 0;
                if (defender.isAlive) { defender.isAlive = false; defender.spawnFragments(); }
                gameOverCallback(attacker);
            }
            // NEW: trigger weapon hit hooks so Shuriken bounce stat scales on projectile hits
            try { attacker.weapon.onHit(defender); attacker.weapon.onSuccessfulHit(); } catch {}
            return; // stop standard melee resolution
        }

        // Custom vs same-team: apply only custom rules (e.g., heals/buffs), no standard damage/stuns
        if (isSameTeam && isCustomAttacker) {
            // Prevent spamming one overlap; treat like a single "blow"
            const lockMs = (attacker.type === 'dagger') ? 60 : 240;
            lockHit(attacker, defender, lockMs);
            if (attacker.weapon && typeof attacker.weapon.onPreResolveHit === 'function') {
                try { attacker.weapon.onPreResolveHit(defender); } catch {}
            }
            try { attacker.weapon.onHit(defender); } catch {}
            // NEW: apply combined pending heal for custom-friendly hits (stats modify pending)
            const heal = Math.max(0, Number(attacker.weapon._pendingHeal || attacker.weapon.heal || 0));
            const cap = defender.isBoss ? getDefaultBossHealth() : getDefaultHealth();
            if (heal > 0) defender.health = Math.min(cap, defender.health + heal);
            // clear pendings after use
            attacker.weapon._pendingDamage = 0; attacker.weapon._pendingHeal = 0;
            try { attacker.weapon.onSuccessfulHit(); } catch {}
            attacker.attackCooldown = Math.max(attacker.attackCooldown || 0, attacker.type === 'dagger' ? 0 : 10);
            return;
        }

        // NEW: For custom weapons vs opponents, apply any pending heal to the attacker (self-heal behaviors)
        const isCustomAttacker = (typeof attacker.type === 'string' && attacker.type.startsWith('custom:'));
        if (isCustomAttacker && attacker.weapon && typeof attacker.weapon.onPreResolveHit === 'function') {
            try { attacker.weapon.onPreResolveHit(defender); } catch {}
        }
        const pendingHealForAttacker = (isCustomAttacker && Number(attacker.weapon?._pendingHeal || 0) > 0) ? Number(attacker.weapon._pendingHeal || 0) : 0;

        // Standard hit processing for all non-shield attackers
        const lockMs = (attacker.type === 'dagger') ? 60 : 240;
        lockHit(attacker, defender, lockMs); // NEW: shorter pair lock for dagger to allow rapid multi-hits
        // NEW: for custom weapons, use per-hit pending damage (behavior base + stat mods)
        const isCustom = (typeof attacker.type === 'string' && attacker.type.startsWith('custom:'));
        let dmgThisHit = isCustom ? Math.max(0, Number(attacker.weapon._pendingDamage || 0)) : attacker.weapon.damage;
        // Shield reflects half of defender's own weapon damage
        if (attacker.type === 'shield') {
          const oppDmg = Number(defender.weapon?.damage || 0);
          dmgThisHit = Math.max(0, oppDmg * 0.5);
        }

        // NEW: Scepter heals teammates on hit, capped to current default max health
        if (attacker.type === 'scepter' && isSameTeam) {
            const healAmt = Math.max(0, Number(attacker.weapon?.heal || 0));
            if (healAmt > 0) {
                const cap = defender.isBoss ? getDefaultBossHealth() : getDefaultHealth();
                defender.health = Math.min(cap, defender.health + healAmt);
            }
        }

        defender.health -= dmgThisHit;
        // clear pendings after applying
        if (isCustom) {
            // apply self-heal behaviors now for opponent hits
            if (pendingHealForAttacker > 0) {
                attacker.health = Math.min(100, attacker.health + pendingHealForAttacker);
            }
            attacker.weapon._pendingDamage = 0; attacker.weapon._pendingHeal = 0;
        }
        const DEATH_THRESHOLD = 0.5;
        if (defender.health <= DEATH_THRESHOLD) {
            defender.health = 0;
        }

        // NEW: Apply global per-attack cooldown for melee/ranged-weapon body hits
        attacker.attackCooldown = Math.max(attacker.attackCooldown || 0, attacker.type === 'dagger' ? 0 : 10); // dagger: no cooldown

        let damageDisplayId;
        let damageDisplay;
        
        if (players.length === 2) {
            damageDisplayId = (attacker === players[0]) ? 'damage-display-left' : 'damage-display-right';
            damageDisplay = document.getElementById(damageDisplayId);
        } else {
            const attackerIndex = players.indexOf(attacker);
            if (attackerIndex !== -1) {
                damageDisplay = document.getElementById(`damage-display-ffa-value-${attackerIndex}`);
            }
        }
        
        if (damageDisplay) {
            damageDisplay.innerHTML = attacker.weapon.getDamageDisplayText();
            damageDisplay.style.color = attacker.color;
        }
        
        const stunDurations = attacker.weapon.getHitStunDurations();
        if (!(attacker.type === 'bat' && defender.stunned)) {
            defender.stun(stunDurations.defender);
            if (attacker.type === 'bat') {
                defender._stunnedByBatTimer = Math.max(defender._stunnedByBatTimer || 0, stunDurations.defender);
            }
        }
        if (stunDurations.attacker > 0) {
            attacker.stun(stunDurations.attacker);
        }

        attacker.reverseWeaponOnStunEnd = attacker.weapon.shouldReverseOnHit();
        defender.reverseWeaponOnStunEnd = false;
        
        defender.gainImmunityOnStunEnd = attacker.weapon.grantsImmunityOnHit();
        attacker.gainImmunityOnStunEnd = false;
        
        defender.gainParryCooldownOnStunEnd = true;
        attacker.gainParryCooldownOnStunEnd = false;

        defender.isVisuallyStunned = true;
        defender.stunEffectAlpha = 1;
        attacker.isVisuallyStunned = false;

        // NEW: play weapon-specific hit sound on successful hit
        try {
            if (!isMenuContext && attacker.weapon && typeof attacker.weapon.playHitSound === 'function') {
                attacker.weapon.playHitSound();
            }
        } catch {}

        attacker.weapon.onHit(defender);
        attacker.weapon.onSuccessfulHit();

        if (defender.health <= 0) {
            gameOverCallback(attacker);
        }

        // NEW: Wrench spawns a turret at the exact hit location (or fallback near defender)
        if (attacker.type === 'wrench') {
            try {
                if (typeof window.ensureTurretField === 'function') window.ensureTurretField();
                if (window.turretField && typeof window.turretField.addTurret === 'function') {
                    const sx = (hitPoint && isFinite(hitPoint.x)) ? hitPoint.x : defender.x;
                    const sy = (hitPoint && isFinite(hitPoint.y)) ? hitPoint.y : defender.y;
                    window.turretField.addTurret(
                        sx,
                        sy,
                        attacker.team || null,
                        attacker,
                        attacker.originalColor || attacker.color || '#f3a310'
                    );
                }
            } catch {}
        }
    }
}

export function handleCollision(player1, player2, gameOverCallback, players, isMenuContext = false) {
    const allowSpecialBody =
        (players.length > 2) && (
            player1.type === 'bat' || player2.type === 'bat' ||
            (player1.stunned && player1._stunnedByBatTimer > 0) ||
            (player2.stunned && player2._stunnedByBatTimer > 0)
        );
    if (player1.isAlive && player2.isAlive && (!player1.stunned && !player2.stunned || allowSpecialBody)) {
        const dx = player2.x - player1.x;
        const dy = player2.y - player1.y;
        const minDistance = player1.radius + player2.radius;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistance * minDistance) {
            const distance = Math.sqrt(distSq) || 0.00001;

            const overlap = minDistance - distance;
            const separationX = (dx / distance) * (overlap / 2);
            const separationY = (dy / distance) * (overlap / 2);

            player1.x -= separationX;
            player1.y -= separationY;
            player2.x += separationX;
            player2.y += separationY;

            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const vx1 = player1.vx * cos + player1.vy * sin;
            const vy1 = player1.vy * cos - player1.vx * sin;
            const vx2 = player2.vx * cos + player2.vy * sin;
            const vy2 = player2.vy * cos - player2.vx * sin;

            const newVx1 = ((player1.mass - player2.mass) * vx1 + 2 * player2.mass * vx2) / (player1.mass + player2.mass);
            const newVx2 = ((player2.mass - player1.mass) * vx2 + 2 * player1.mass * vx1) / (player1.mass + player2.mass);

            player1.vx = newVx1 * cos - vy1 * sin;
            player1.vy = vy1 * cos + newVx1 * sin;
            player2.vx = newVx2 * cos - vy2 * sin;
            player2.vy = vy2 * cos + newVx2 * sin;

            const speed1 = Math.sqrt(player1.vx * player1.vx + player1.vy * player1.vy);
            const speed2 = Math.sqrt(player2.vx * player2.vx + player2.vy * player2.vy);
            
            if (speed1 > 0) {
                player1.vx = (player1.vx / speed1) * player1.speed;
                player1.vy = (player1.vy / speed1) * player1.speed;
            }
            if (speed2 > 0) {
                player2.vx = (player2.vx / speed2) * player2.speed;
                player2.vy = (player2.vy / speed2) * player2.speed;
            }
        }
    }
    
    let parried = false;
    if (!(players.length > 2 && player1.team && player2.team && player1.team === player2.team)) {
        parried = checkWeaponParry(player1, player2, isMenuContext);
    }

    if (parried) {
        // Even if a parry happened, still process deflected projectile damage for any already-deflected shots
        processDeflectedProjectiles(players, gameOverCallback);
        return;
    }

    checkWeaponCollision(player1, player2, gameOverCallback, players, isMenuContext);
    checkWeaponCollision(player2, player1, gameOverCallback, players, isMenuContext);

    // NEW: resolve owner projectiles first (normal hits), then deflected ones
    try { if (typeof processOwnerProjectiles === 'function') processOwnerProjectiles(players, gameOverCallback); } catch {}
    // NEW: After regular collisions, resolve any deflected projectile hits (with friendly-fire protection)
    processDeflectedProjectiles(players, gameOverCallback);
}