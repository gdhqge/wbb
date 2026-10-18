import { Player } from './player.js';
import { ARENA_SIZES } from './arena/arena-constants.js';

// Store reference to getSelectedBalls function
let getSelectedBallsFunction = null;

// Function to set the getSelectedBalls reference from outside
export function setGetSelectedBallsFunction(fn) {
    getSelectedBallsFunction = fn;
}

function getRandomVelocity(speedMin = 9, speedMax = 14) {
    const angle = Math.random() * 2 * Math.PI;
    const speed = Math.random() * (speedMax - speedMin) + speedMin;
    return {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
    };
}

// Define default arena dimensions
export const DEFAULT_ARENA_WIDTH = 520;
export const DEFAULT_ARENA_HEIGHT = 520;

// Initial player states based on default arena size
export const initialPlayer1State = { x: DEFAULT_ARENA_WIDTH * 0.2, y: DEFAULT_ARENA_HEIGHT / 2, radius: 35, color: 'white', vx: 0, vy: 0, health: 100, type: 'basic' };
export const initialPlayer2State = { x: DEFAULT_ARENA_WIDTH * 0.8, y: DEFAULT_ARENA_HEIGHT / 2, radius: 35, color: 'white', vx: 0, vy: 0, health: 100, type: 'basic' };

// Do not persist defaultHealth; always start at 100 per session and reset on refresh
let defaultHealth = 100;
// Boss default health should not persist across sessions; always start at 5000
let defaultBossHealth = 5000;
export function getDefaultHealth() { return defaultHealth; }
export function setDefaultHealth(v) { defaultHealth = Math.max(0, Number(v) || 0); /* no persistence */ }
export function getDefaultBossHealth() { return defaultBossHealth; }
export function setDefaultBossHealth(v) { defaultBossHealth = Math.max(0, Number(v) || 0); }

// GLOBAL STATE FOR MODE
let currentMode = 'classic';
let currentFFACount = 2;

// Exported, mutable array of players
export const players = [];

// Helper: positions like dice faces (normalized -1..1), extended up to 10
function getNormalizedSpawnPositions(count, arenaWidth) {
    // Guard: if no players selected, return empty list
    if (!count || count <= 0) return [];

    // Calculate a dynamic spread factor based on arena size.
    // This will make balls more spread out on larger maps.
    const min_width = 380; // small arena
    const max_width = 1200; // accommodate larger-than-before huge arenas
    const min_C = 0.55; // Spread factor for smallest arena
    const max_C = 0.85; // Spread factor for largest arena

    // Clamp width to handle unexpected sizes and avoid division by zero
    const clampedWidth = Math.max(min_width, Math.min(arenaWidth, max_width));
    
    // Linearly interpolate the spread factor 'C' based on the arena width
    const scale = (clampedWidth - min_width) / (max_width - min_width);
    const C = min_C + scale * (max_C - min_C);

    const positions = [];

    // Handle special case for 1 player: spawn in the center
    if (count === 1) {
        positions.push([0, 0]);
        return positions;
    }

    // Arrange players in a circle
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI; // Calculate angle for each player
        const x = C * Math.cos(angle);
        const y = C * Math.sin(angle);
        positions.push([x, y]);
    }

    return positions;
}

// NEW: Deterministic per-team vertical line positions generator
function getVerticalLinePositions(count, xNorm) {
    const positions = [];
    if (count <= 0) return positions;

    if (count === 1) {
        positions.push([xNorm, 0]);
        return positions;
    }

    // Spread from top to bottom around the center
    const maxSpread = 1.6; // ~80% of arena height from center
    const spacing = maxSpread / (count - 1);
    const startY = -maxSpread / 2;
    for (let i = 0; i < count; i++) {
        const y = startY + i * spacing;
        positions.push([xNorm, y]);
    }
    return positions;
}

function getTeamSpawnPositions(selectedBalls, arenaWidth, arenaHeight) {
    const blueTeam = selectedBalls.filter(ball => ball.team === 'blue');
    const redTeam = selectedBalls.filter(ball => ball.team === 'red');
    
    const positions = [];
    
    // Blue team on the left side in a vertical line - spread out as much as possible
    const blueX = -0.75; // Moved further left to ensure they stay on their side
    const blueCount = blueTeam.length;
    
    if (blueCount > 0) {
        if (blueCount === 1) {
            positions.push([blueX, 0]); // Center single player
        } else {
            // Spread players from top to bottom of available space
            const maxSpread = 1.6; // Maximum vertical spread (80% of arena height from center)
            const spacing = maxSpread / (blueCount - 1);
            const startY = -maxSpread / 2;
            
            for (let i = 0; i < blueCount; i++) {
                const y = startY + (i * spacing);
                positions.push([blueX, y]);
            }
        }
    }
    
    // Red team on the right side in a vertical line - spread out as much as possible
    const redX = 0.75; // Moved further right to ensure they stay on their side
    const redCount = redTeam.length;
    
    if (redCount > 0) {
        if (redCount === 1) {
            positions.push([redX, 0]); // Center single player
        } else {
            // Spread players from top to bottom of available space
            const maxSpread = 1.6; // Maximum vertical spread (80% of arena height from center)
            const spacing = maxSpread / (redCount - 1);
            const startY = -maxSpread / 2;
            
            for (let i = 0; i < redCount; i++) {
                const y = startY + (i * spacing);
                positions.push([redX, y]);
            }
        }
    }
    
    return positions;
}

function createPlayerAtNorm(normX, normY, arenaWidth, arenaHeight, radius, type = 'basic', team = null) {
    // Map normalized -1..1 to inner bounds leaving margin = radius + 10
    const margin = radius + 10;
    const minX = margin;
    const maxX = arenaWidth - margin;
    const minY = margin;
    const maxY = arenaHeight - margin;

    const x = ((normX + 1) / 2) * (maxX - minX) + minX;
    const y = ((normY + 1) / 2) * (maxY - minY) + minY;

    const { vx, vy } = getRandomVelocity();
    const player = new Player(x, y, radius, 'white', vx, vy, type);
    
    // NEW: Set team property
    if (team) {
        player.team = team;
    }
    
    // NEW: apply default spawn health
    player.health = defaultHealth;
    
    return player;
}

// Configure players based on current mode
async function buildPlayersForMode(arenaWidth, arenaHeight) {
    players.length = 0;
    // Match ball size to grid tile size in Custom arena only
    const isCustomArena = !!(window.arenaSizingControls && typeof window.arenaSizingControls.getSelection === 'function' && window.arenaSizingControls.getSelection() === 'custom');
    const radius = isCustomArena ? Math.round((arenaWidth / 16) / 2) : 35;

    if (currentMode === 'ffa') {
        if (!getSelectedBallsFunction) {
            console.error('getSelectedBalls function not set');
            return;
        }

        const selectedBalls = getSelectedBallsFunction() || [];
        const count = Math.min(200, selectedBalls.length);

        if (count === 0) {
            // No players selected; leave players empty and let UI disable Play
            return;
        }

        const norms = getNormalizedSpawnPositions(count, arenaWidth);
        
        for (let i = 0; i < count; i++) {
            const [nx, ny] = norms[i];
            const ballType = selectedBalls[i];
            if (!ballType) continue; // Extra safety

            const p = createPlayerAtNorm(nx, ny, arenaWidth, arenaHeight, radius, ballType.type, ballType.team);
            // Use team color for teams mode
            p.color = ballType.color;
            players.push(p);
        }
    } else if (currentMode === 'teams') {
        if (!getSelectedBallsFunction) {
            console.error('getSelectedBalls function not set');
            return;
        }

        const selectedBalls = getSelectedBallsFunction() || [];
        const count = Math.min(200, selectedBalls.length);

        if (count === 0) {
            // No players selected; leave players empty and let UI disable Play
            return;
        }

        // NEW: Always place players on the correct side lines regardless of selection order
        const blueBalls = selectedBalls.filter(b => b.team === 'blue');
        const redBalls  = selectedBalls.filter(b => b.team === 'red');

        const bluePositions = getVerticalLinePositions(blueBalls.length, -0.75);
        const redPositions  = getVerticalLinePositions(redBalls.length,  0.75);

        // Create blue team players (left line)
        for (let i = 0; i < blueBalls.length; i++) {
            const [nx, ny] = bluePositions[i];
            const ballType = blueBalls[i];
            const p = createPlayerAtNorm(nx, ny, arenaWidth, arenaHeight, radius, ballType.type, 'blue');
            // In teams mode, override weapon color with team color
            p.color = ballType.color; // team color from UI
            p.originalColor = ballType.color;
            p.originalColorRgb = parseColor(ballType.color);
            players.push(p);
        }

        // Create red team players (right line)
        for (let i = 0; i < redBalls.length; i++) {
            const [nx, ny] = redPositions[i];
            const ballType = redBalls[i];
            const p = createPlayerAtNorm(nx, ny, arenaWidth, arenaHeight, radius, ballType.type, 'red');
            p.color = ballType.color;
            p.originalColor = ballType.color;
            p.originalColorRgb = parseColor(ballType.color);
            players.push(p);
        }
    } else if (currentMode === 'boss') {
        if (!getSelectedBallsFunction) {
            console.error('getSelectedBalls function not set');
            return;
        }
        const selectedBalls = getSelectedBallsFunction() || [];
        // Split selections
        const blueBalls = selectedBalls.filter(b => b.team === 'blue');
        const bossBall = selectedBalls.find(b => b.team === 'red'); // exactly one

        // Spawn the boss pre-emptively even if there are no blues yet
        if (!bossBall) {
            // If no boss selection exists, don't construct anything yet
            return;
        }

        // Place blue team on left line (only if any selected)
        if (blueBalls.length > 0) {
            const bluePositions = getVerticalLinePositions(blueBalls.length, -0.75);
            for (let i = 0; i < blueBalls.length; i++) {
                const [nx, ny] = bluePositions[i];
                const ballType = blueBalls[i];
                const p = createPlayerAtNorm(nx, ny, arenaWidth, arenaHeight, radius, ballType.type, 'blue');
                p.color = ballType.color;
                p.originalColor = ballType.color;
                p.originalColorRgb = parseColor(ballType.color);
                // Explicitly mark NOT boss
                p.isBoss = false;
                players.push(p);
            }
        }

        // Place boss on right side center
        const [bx, by] = [0.75, 0]; // centered vertically
        // Make boss the same size regardless of arena: match Huge arena boss size
        const hugeRef = Math.min(ARENA_SIZES.HUGE.w, ARENA_SIZES.HUGE.h);
        const bossRadius = Math.max(90, Math.min(160, Math.floor(hugeRef * 0.12))); // equals Huge boss size
        const boss = createPlayerAtNorm(bx, by, arenaWidth, arenaHeight, bossRadius, bossBall.type, 'red');
        boss.color = '#f44336';
        boss.originalColor = '#f44336';
        boss.originalColorRgb = parseColor('#f44336');
        boss.isBoss = true; // NEW: mark the boss so it gets thick outline only in Boss mode

        // Boss attributes
        boss.health = defaultBossHealth; // NEW: use configured default boss health
        boss.speed = 5; // slower than normal players
        boss.mass = boss.radius * boss.radius * 2; // heavier
        // Reduce initial velocity so it's lumbering
        boss.vx *= 0.5;
        boss.vy *= 0.5;

        players.push(boss);

    } else {
        // classic default: 2 players positioned like before
        const vel1 = getRandomVelocity();
        const vel2 = getRandomVelocity();

        const p1 = new Player(arenaWidth * 0.2, arenaHeight / 2, radius, 'white', vel1.vx, vel1.vy, initialPlayer1State.type);
        const p2 = new Player(arenaWidth * 0.8, arenaHeight / 2, radius, 'white', vel2.vx, vel2.vy, initialPlayer2State.type);
        // NEW: apply default spawn health to classic players
        p1.health = defaultHealth; p2.health = defaultHealth;
        players.push(p1, p2);
    }
}

// Helper function to parse colors (needed for teams mode color override)
function parseColor(color) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
}

// Public setters for mode and FFA count
export function setMode(mode) {
    currentMode = mode;
}

export function setFFACount(count) {
    currentFFACount = Math.max(1, Math.min(50, count | 0));
}

// Modify resetPlayers to be async
export async function resetPlayers(arenaWidth = DEFAULT_ARENA_WIDTH, arenaHeight = DEFAULT_ARENA_HEIGHT) {
    // Rebuild the array for the current mode
    await buildPlayersForMode(arenaWidth, arenaHeight);

    // Update UI damage areas based on current mode
    const damageLeft = document.getElementById('damage-display-left');
    const damageRight = document.getElementById('damage-display-right');
    const damageWrapper = document.getElementById('damage-info-wrapper');
    
    if (currentMode === 'ffa') {
        // Clear existing content in the wrapper
        if (damageWrapper) {
            damageWrapper.innerHTML = '';
            // FFA Info text is completely removed per user request.
            // The wrapper itself will be hidden by main.js
        }
    } else if (currentMode === 'teams') {
        // Clear existing content in the wrapper
        if (damageWrapper) {
            damageWrapper.innerHTML = '';
            // The wrapper itself will be hidden by main.js
        }
    } else {
        // Classic mode - restore original two-panel layout
        if (damageWrapper) {
            damageWrapper.innerHTML = `
                <div id="damage-display-left" class="damage-display"></div>
                <div id="damage-display-right" class="damage-display"></div>
            `;
        }
        
        // Update for first two players only (classic context)
        const newDamageLeft = document.getElementById('damage-display-left');
        const newDamageRight = document.getElementById('damage-display-right');
        if (players[0] && newDamageLeft) {
            newDamageLeft.innerHTML = players[0].weapon.getDamageDisplayText();
            newDamageLeft.style.color = players[0].color;
        }
        if (players[1] && newDamageRight) {
            newDamageRight.innerHTML = players[1].weapon.getDamageDisplayText();
            newDamageRight.style.color = players[1].color;
        }
    }
}

// Initialize default (classic) players at startup so existing code functions before first reset
buildPlayersForMode(DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT);