import { players, resetPlayers } from './state.js';
import { handleCollision } from './collision.js';
import { updateLoserUI, resetVersusUI } from './ui.js';
import { playClickSound, areSoundsReady } from './audio.js';
import { getBroadphasePairs } from './collision-broadphase.js';
import { syncSidePanelsToCanvas } from './ui-state.js';

let isPlaying = false;
let gameEnded = false;
let animationFrameId = null;

// NEW: simple adaptive render skip based on smoothed frame time
let _perfLastTs = 0;
let _perfAvgMs = 0;
let _renderSkipModulo = 0;

let ctx;
let canvas;
let playButton;
let resetButton;
let gameContainer;

// NEW: gravity enabled state (true => gravity on, false => off)
let gravityEnabled = true;

// NEW: pointer-dragging state
let draggingPlayer = null;
let dragPointerId = null;

// FIX: define currentMode with a safe default to prevent ReferenceError before setGameMode is called
let currentMode = 'classic';

// NEW: speed multiplier for simulation steps (1x..5x)
let speedMultiplier = 1;
// NEW: half-speed flip-flop to skip updates every other frame at 0.5x
let halfSpeedFlip = false;

// NEW: zoom scaling state helpers
const MIN_SCALE = 0.3;
const MAX_SCALE = 1.4;
const SCALE_STEP = 0.1;

// NEW: group tracking for classic mode victory after splits
let classicGroupAId = null;
let classicGroupBId = null;

// Utility to read current effective scale from computed transform (handles CSS classes or inline styles)
function getCurrentScale() {
    const style = window.getComputedStyle(gameContainer);
    const transform = style.transform || style.webkitTransform || style.mozTransform;
    if (transform && transform !== 'none') {
        // matrix(a, b, c, d, tx, ty) -> scaleX = a, scaleY = d
        const match = transform.match(/matrix\(([^)]+)\)/);
        if (match) {
            const parts = match[1].split(',').map(v => parseFloat(v.trim()));
            if (parts.length >= 4) {
                const a = parts[0], d = parts[3];
                // If non-uniform, just return X
                return isFinite(a) ? a : 0.7;
            }
        }
        // matrix3d(...) fallback
        const match3d = transform.match(/matrix3d\(([^)]+)\)/);
        if (match3d) {
            const parts = match3d[1].split(',').map(v => parseFloat(v.trim()));
            // scaleX is parts[0]
            if (parts.length >= 1 && isFinite(parts[0])) return parts[0];
        }
    }
    // Default baseline defined in CSS
    return 0.7;
}

function applyScale(scale) {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    // Inline transform overrides class-based transform
    gameContainer.style.transform = `scale(${clamped})`;
}

function gameOver(winner) {
    if (gameEnded) return;

    gameEnded = true;

    if (currentMode === 'ffa') {
        // No special UI; leave fragments to play out
        return;
    }

    // Classic: determine loser and UI
    const loser = (winner === players[0]) ? players[1] : players[0];
    if (loser) {
        loser.isAlive = false;
        loser.spawnFragments();
        updateLoserUI(loser === players[0] ? 'left' : 'right');
    }
}

function updatePlayButtonState() {
    if (!playButton) return;

    // NEW: disable when sounds not ready
    if (!areSoundsReady()) {
        playButton.disabled = true;
        playButton.textContent = 'Loading...';
        return;
    }

    // NEW: In FFA and Teams, disable play when fewer than 2 circles (no visual feedback)
    if (currentMode === 'ffa' || currentMode === 'teams') {
        const aliveOrTotal = players.length; // At reset all are alive
        if (aliveOrTotal < 2) {
            playButton.disabled = true;
            playButton.textContent = isPlaying ? 'Pause' : 'Play';
            playButton.classList.toggle('paused', isPlaying);
            return;
        }
    }

    playButton.disabled = false;
    playButton.textContent = isPlaying ? 'Pause' : 'Play';
    playButton.classList.toggle('paused', isPlaying);
}

function updateGravityButtonUI() {
    const gravityBtn = document.getElementById('gravityButton');
    if (!gravityBtn) return;
    gravityBtn.textContent = `Gravity: ${gravityEnabled ? 'On' : 'Off'}`;

    // On => white button with black text and black outline
    // Off => black button with white text and white outline
    if (gravityEnabled) {
        gravityBtn.style.backgroundColor = 'var(--white)';
        gravityBtn.style.color = 'var(--black)';
        gravityBtn.style.borderColor = 'var(--black)';
    } else {
        gravityBtn.style.backgroundColor = 'var(--black)';
        gravityBtn.style.color = 'var(--white)';
        gravityBtn.style.borderColor = 'var(--white)'; // Outline white when off
    }
}

// NEW: speed button label helper
function updateSpeedButtonUI() {
    const btn = document.getElementById('speedButton');
    if (!btn) return;
    btn.textContent = `${speedMultiplier}x speed`;
}

export function resetGame(arenaWidth, arenaHeight) {
    isPlaying = false;
    gameEnded = false;
    // Stop any ongoing drag
    draggingPlayer = null;
    dragPointerId = null;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    resetPlayers(arenaWidth, arenaHeight);
    resetVersusUI();
    updatePlayButtonState();
    updateGravityButtonUI();

    // NEW: capture initial classic groups for win logic (after players are built)
    if (currentMode === 'classic') {
        classicGroupAId = players[0] ? players[0].groupId : null;
        classicGroupBId = players[1] ? players[1].groupId : null;
    }

    if (window.turretField && typeof window.turretField.clear === 'function') {
        window.turretField.clear();
    }

    if (!animationFrameId) {
        idleLoop();
    }
}

function idleLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw balls first
    players.forEach(player => player.draw(ctx));
    // Then draw all non-shield weapons
    players.forEach(player => { if (player.type !== 'shield') player.drawWeapon(ctx); });
    // Finally draw all shields on top of their balls
    players.forEach(player => { if (player.type === 'shield') player.drawWeapon(ctx); });
    if (window.turretField && typeof window.turretField.draw === 'function') {
        window.turretField.draw(ctx);
    }

    // Keep classic UI text refreshed while idle (so current values stay visible)
    updateDamageDisplays();

    if (!isPlaying && !gameEnded) {
        animationFrameId = requestAnimationFrame(idleLoop);
    }
}

function gameLoop() {
    const zeroGravity = !gravityEnabled;

    const pauseForShrink = !!(window.arenaSizingControls && typeof window.arenaSizingControls.isShrinkingActive === 'function' && window.arenaSizingControls.isShrinkingActive());
    if (pauseForShrink) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw balls then weapons (shield last)
        players.forEach(player => player.draw(ctx));
        players.forEach(player => { if (player.type !== 'shield') player.drawWeapon(ctx); });
        players.forEach(player => { if (player.type === 'shield') player.drawWeapon(ctx); });
        updateDamageDisplays();
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
    }

    if (!isPlaying && gameEnded) {
        const anyFragmentsLeft = players.some(p => !p.isAlive && p.fragments.length > 0);
        if (!anyFragmentsLeft) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            return;
        }
    } else if (!isPlaying && !gameEnded) {
        idleLoop();
        return;
    }

    // Run simulation updates based on speedMultiplier; 0.5x skips updates every other frame
    let skipUpdates = false;
    if (speedMultiplier === 0.5) {
        halfSpeedFlip = !halfSpeedFlip;
        skipUpdates = !halfSpeedFlip;
    }

    if (!skipUpdates) {
        // Run simulation updates 'steps' times per frame for speed >= 1x
        const steps = Math.max(1, Math.min(5, Math.floor(speedMultiplier)));
        for (let step = 0; step < steps; step++) {
            // Update players (includes poison ticking)
            players.forEach(player => {
                player.update(canvas.width, canvas.height, false, gravityEnabled);
                // NEW: collide players with custom blocks when Custom map is enabled
                if (window.customMap && typeof window.customMap.isEnabled === 'function' && window.customMap.isEnabled()) {
                    if (typeof window.customMap.collidePlayer === 'function') {
                        window.customMap.collidePlayer(player);
                    }
                }
                if (window.turretField && typeof window.turretField.collidePlayer === 'function') {
                    window.turretField.collidePlayer(player);
                }
            });

            // NEW: advance turret rotation and firing each frame during gameplay
            if (window.turretField && typeof window.turretField.update === 'function') {
                window.turretField.update(canvas);
            }

            // NEW: Classic mode now uses broadphase over all players and group-based win checks
            if (!gameEnded && currentMode === 'classic') {
                // Collide all pairs so split halves interact properly
                const pairs = getBroadphasePairs(players, 90);
                for (let k = 0; k < pairs.length; k++) {
                    const [i, j] = pairs[k];
                    const a = players[i], b = players[j];
                    handleCollision(a, b, () => {}, players);
                }

                // Group-based win: a side only loses when ALL in its group are dead
                const aAlive = players.some(p => p.groupId === classicGroupAId && p.isAlive);
                const bAlive = players.some(p => p.groupId === classicGroupBId && p.isAlive);
                if (aAlive && !bAlive) {
                    const winner = players.find(p => p.groupId === classicGroupAId && p.isAlive) || null;
                    gameOver(winner);
                } else if (!aAlive && bAlive) {
                    const winner = players.find(p => p.groupId === classicGroupBId && p.isAlive) || null;
                    gameOver(winner);
                } else if (!aAlive && !bAlive) {
                    gameOver(null);
                }
            } else if (!gameEnded) {
                if (currentMode === 'ffa' || currentMode === 'teams' || currentMode === 'boss') {
                    // Use a spatial hash to prune pair checks
                    // Cell size roughly 2x typical radius to catch neighbors
                    const cellSize = 90;
                    const pairs = getBroadphasePairs(players, cellSize);

                    for (let k = 0; k < pairs.length; k++) {
                        const [i, j] = pairs[k];
                        const a = players[i], b = players[j];
                        handleCollision(a, b, () => {}, players);
                    }

                    const alive = players.filter(p => p.isAlive);
                    if (currentMode === 'boss') {
                        const boss = players.find(p => p.team === 'red');
                        const bluesAlive = players.filter(p => p.team === 'blue' && p.isAlive).length;
                        if (!boss || !boss.isAlive) {
                            gameOver(players.find(p => p.team === 'blue' && p.isAlive) || null);
                        } else if (bluesAlive === 0) {
                            gameOver(boss);
                        }
                    } else {
                        if (alive.length <= 1) {
                            gameOver(alive[0] || null);
                        }
                    }
                } else {
                    if (players[0] && players[1]) {
                        handleCollision(players[0], players[1], gameOver, players);
                    }
                }
            }
        }
    }

    // NEW: adaptive render skip — if average frame time is high, draw every other frame
    const now = (performance && performance.now) ? performance.now() : Date.now();
    if (_perfLastTs) {
        const dt = now - _perfLastTs;
        _perfAvgMs = _perfAvgMs ? (_perfAvgMs * 0.9 + dt * 0.1) : dt;
        _renderSkipModulo = (_perfAvgMs > 20) ? 2 : 0; // >20ms -> ~50fps budget, skip render 1/2 frames
    }
    _perfLastTs = now;

    // Skip draw on this frame if under pressure
    if (_renderSkipModulo && (Math.floor(now) % _renderSkipModulo) !== 0) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw balls first for proper layering
    for (let i = 0; i < players.length; i++) {
        players[i].draw(ctx);
    }
    // Draw non-shield weapons
    for (let i = 0; i < players.length; i++) {
        if (players[i].type !== 'shield') players[i].drawWeapon(ctx);
    }
    // Draw shields on top
    for (let i = 0; i < players.length; i++) {
        if (players[i].type === 'shield') players[i].drawWeapon(ctx);
    }
    if (window.turretField && typeof window.turretField.draw === 'function') {
        window.turretField.draw(ctx);
    }

    // Throttled UI refresh
    updateDamageDisplays();

    animationFrameId = requestAnimationFrame(gameLoop);
}

// NEW: Throttle damage display updates to reduce DOM churn
let damageUiFrameCounter = 0;
let lastLeftText = '';
let lastRightText = '';
let lastLeftColor = '';
let lastRightColor = '';

function updateDamageDisplays() {
    if (currentMode !== 'classic') return;
    // Only update every 6th frame (~10fps at 60Hz)
    if ((damageUiFrameCounter = (damageUiFrameCounter + 1) % 6) !== 0) return;

    const left = document.getElementById('damage-display-left');
    const right = document.getElementById('damage-display-right');
    if (players[0] && left) {
        const text = players[0].weapon.getDamageDisplayText();
        const color = players[0].color;
        if (text !== lastLeftText) {
            left.innerHTML = text;
            lastLeftText = text;
        }
        if (color !== lastLeftColor) {
            left.style.color = color;
            lastLeftColor = color;
        }
    }
    if (players[1] && right) {
        const text = players[1].weapon.getDamageDisplayText();
        const color = players[1].color;
        if (text !== lastRightText) {
            right.innerHTML = text;
            lastRightText = text;
        }
        if (color !== lastRightColor) {
            right.style.color = color;
            lastRightColor = color;
        }
    }
}

export async function togglePlayPause() {
    await playClickSound();
    if (isPlaying) {
        isPlaying = false;
        if (window.arenaSizingControls && typeof window.arenaSizingControls.pauseShrinking === 'function') {
            window.arenaSizingControls.pauseShrinking();
        }
        // No grid changes on pause; grid only reappears on Reset per spec
        playButton.classList.remove('paused');
        updatePlayButtonState();
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            if (!gameEnded) {
                idleLoop();
            }
        }
    } else {
        if ((currentMode === 'ffa' || currentMode === 'teams') && players.length < 2) {
            updatePlayButtonState();
            return;
        }
        isPlaying = true;
        if (window.arenaSizingControls && typeof window.arenaSizingControls.resumeShrinking === 'function') {
            window.arenaSizingControls.resumeShrinking();
        }
        // NEW: Hide custom grid overlay; keep blocks on background
        if (window.customMap && typeof window.customMap.onPlayStart === 'function') {
            window.customMap.onPlayStart();
        }

        playButton.classList.add('paused');
        updatePlayButtonState();
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        gameLoop();
    }
}

export function setupGame(config) {
    canvas = config.canvas;
    playButton = config.playButton;
    resetButton = config.resetButton;
    gameContainer = config.gameContainer;
    
    ctx = canvas.getContext('2d');
    
    playButton.addEventListener('click', togglePlayPause);
    resetButton.addEventListener('click', async () => {
        await playClickSound();

        if (window.arenaSizingControls && typeof window.arenaSizingControls.resetArenaOnReset === 'function') {
            window.arenaSizingControls.resetArenaOnReset();
        }

        // NEW: Show custom grid again on reset (and gridlines)
        if (window.customMap && typeof window.customMap.onReset === 'function') {
            window.customMap.onReset();
        }

        resetGame(canvas.width, canvas.height);
    });

    // NEW: zoom controls
    const zoomInBtn = document.getElementById('zoomInButton');
    const zoomOutBtn = document.getElementById('zoomOutButton');
    if (zoomInBtn && zoomOutBtn) {
        zoomInBtn.addEventListener('click', async () => {
            await playClickSound();
            const current = getCurrentScale();
            applyScale(current + SCALE_STEP);
        });
        zoomOutBtn.addEventListener('click', async () => {
            await playClickSound();
            const current = getCurrentScale();
            applyScale(current - SCALE_STEP);
        });
    }

    // NEW: speed control button
    const speedBtn = document.getElementById('speedButton');
    if (speedBtn) {
        speedBtn.addEventListener('click', async () => {
            await playClickSound();
            const cycle = [1, 2, 3, 4, 5, 0.5];
            const idx = cycle.indexOf(speedMultiplier);
            speedMultiplier = cycle[(idx + 1) % cycle.length];
            updateSpeedButtonUI();
        });
        updateSpeedButtonUI();
    }

    // NEW: gravity toggle button
    const gravityBtn = document.getElementById('gravityButton');
    if (gravityBtn) {
        gravityBtn.addEventListener('click', async () => {
            await playClickSound();
            gravityEnabled = !gravityEnabled;
            updateGravityButtonUI();
        });
        // Initialize label on load
        updateGravityButtonUI();
    }

    // NEW: Pointer-based dragging on the canvas
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', (e) => {
        // Only end drag if the same pointer leaves the canvas
        if (dragPointerId === e.pointerId) onPointerUp(e);
    });

    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space' && gameContainer.style.display === 'flex') {
            event.preventDefault();
            togglePlayPause();
        }
    });

    updatePlayButtonState();
    updateGravityButtonUI();
    updateSpeedButtonUI();
}

/**
 * Hard reset and clear the canvas without re-starting any loops.
 * Leaves the game in a clean, idle, reset state with a clear canvas.
 */
export function resetAndClear(arenaWidth, arenaHeight) {
    isPlaying = false;
    gameEnded = false;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    resetPlayers(arenaWidth || (canvas ? canvas.width : 0), arenaHeight || (canvas ? canvas.height : 0));

    if (canvas) {
        const h = `${canvas.height}px`;
        const left = document.getElementById('selection-box-left');
        const right = document.getElementById('selection-box-right');
        if (left) left.style.height = h;
        if (right) right.style.height = h;
        // align stats to arena edges via shared helper
        syncSidePanelsToCanvas();
    }

    if (playButton) {
        playButton.textContent = 'Play';
        playButton.classList.remove('paused');
        updatePlayButtonState();
    }
    updateGravityButtonUI();

    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// NEW: allow main to inform game mode
export function setGameMode(mode) {
    currentMode = mode;

    // Set default gravity per mode:
    if (mode === 'classic') {
        gravityEnabled = true;
    } else {
        gravityEnabled = false;
    }
    updateGravityButtonUI();

    updatePlayButtonState();
}

// NEW: Helpers for dragging
function getCanvasCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

function findTopmostPlayerAt(x, y) {
    // Iterate from last to first to approximate "topmost" (last drawn)
    for (let i = players.length - 1; i >= 0; i--) {
        const p = players[i];
        if (!p.isAlive) continue;
        const dx = x - p.x;
        const dy = y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= p.radius) return p;
    }
    return null;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function onPointerDown(e) {
    const { x, y } = getCanvasCoords(e);
    const p = findTopmostPlayerAt(x, y);
    if (p) {
        draggingPlayer = p;
        dragPointerId = e.pointerId;
        canvas.setPointerCapture(dragPointerId);
        // Preserve the player's momentum from BEFORE the drag
        p._preDragVx = p.vx;
        p._preDragVy = p.vy;
        // While dragging, stop the player's motion for stable placement
        p.vx = 0;
        p.vy = 0;
    }
}

function onPointerMove(e) {
    if (!draggingPlayer || dragPointerId !== e.pointerId) return;
    const { x, y } = getCanvasCoords(e);
    // Clamp inside arena bounds with margin = radius
    const r = draggingPlayer.radius;
    draggingPlayer.x = clamp(x, r, canvas.width - r);
    draggingPlayer.y = clamp(y, r, canvas.height - r);
    // Keep velocity zero while dragging
    draggingPlayer.vx = 0;
    draggingPlayer.vy = 0;
}

function onPointerUp(e) {
    if (dragPointerId === e.pointerId) {
        try {
            canvas.releasePointerCapture(dragPointerId);
        } catch {}
        // Restore the player's pre-drag momentum exactly as it was before dragging
        if (draggingPlayer) {
            if (typeof draggingPlayer._preDragVx === 'number' && typeof draggingPlayer._preDragVy === 'number') {
                draggingPlayer.vx = draggingPlayer._preDragVx;
                draggingPlayer.vy = draggingPlayer._preDragVy;
            }
            delete draggingPlayer._preDragVx;
            delete draggingPlayer._preDragVy;
        }
        dragPointerId = null;
        draggingPlayer = null;
    }
}