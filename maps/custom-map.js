// Custom Map: 16x16 grid cells on a background canvas (under the game canvas).
// - Edit via transparent overlay capturing clicks
// - Blocks persist during Play (only gridlines hide on play)
// - Brush size button cycles 1x1 -> 2x2 -> 3x3
// - Separate red Erase button toggles erasing mode (clicks paint by default)
// - Blocks act as solid walls that collide with balls
// - Grid/blocks appear ONLY in Custom mode
// - Outlines merge dynamically across connected blocks

let enabled = false;
let overlayCanvas = null;     // click-capture transparent layer (no drawing)
let bgCanvas = null;          // background drawing (grid + blocks)
let bgCtx = null;

const COLS = 16;
const ROWS = 16;

// Change: gridlines hidden by default; only show when Custom is enabled and not playing
let showGridLines = false;    // hide gridlines unless editing in Custom
let brushSize = 1;            // 1..5
// REWORK: explicit tool mode; start UNEQUIPPED so user can drag balls by default
let toolMode = null;          // 'paint' | 'erase' | null
// NEW: track hovered grid cells while a tool is equipped
let hoverCells = null;

// NEW: RAF batching for hover redraws
let _hoverRAF = null;

// Persistent set of filled cells
const blocks = new Set(); // keys: `${cx},${cy}`

function getOverlayCanvas() {
  if (!overlayCanvas) overlayCanvas = document.getElementById('custom-grid-overlay');
  return overlayCanvas;
}
function getBgCanvas() {
  if (!bgCanvas) bgCanvas = document.getElementById('custom-grid-background');
  return bgCanvas;
}
function getArenaCanvas() {
  return document.getElementById('gameCanvas');
}

function getBodyBgColor() {
  const cs = getComputedStyle(document.body);
  return cs.backgroundColor || '#fff4ec';
}

// NEW: Ensure the background/overlay canvases align EXACTLY with the inner content box of the arena canvas (inside its CSS border)
function syncOverlayAndBgPosition() {
  const ac = getArenaCanvas();
  const oc = getOverlayCanvas();
  const bc = getBgCanvas();
  if (!ac || !oc || !bc) return;

  const cs = getComputedStyle(ac);
  const borderL = parseFloat(cs.borderLeftWidth) || 0;
  const borderT = parseFloat(cs.borderTopWidth) || 0;
  const borderR = parseFloat(cs.borderRightWidth) || 0;
  const borderB = parseFloat(cs.borderBottomWidth) || 0;

  // The canvas element's content box size (in CSS pixels)
  const contentWidthCss = ac.clientWidth;
  const contentHeightCss = ac.clientHeight;

  // Position the bg/overlay so their CSS box matches the inner drawing area of the arena
  [oc, bc].forEach(el => {
    el.style.position = 'absolute';
    el.style.left = `${borderL}px`;
    el.style.top = `${borderT}px`;
    el.style.width = `${contentWidthCss}px`;
    el.style.height = `${contentHeightCss}px`;
  });
}

function resizeCanvasesToArena() {
  const ac = getArenaCanvas();
  const oc = getOverlayCanvas();
  const bc = getBgCanvas();
  if (!ac || !oc || !bc) return;

  // Match the logical resolution to the arena canvas inner drawing size
  bc.width = ac.width;
  bc.height = ac.height;
  oc.width = ac.width;
  oc.height = ac.height;

  // Ensure their CSS positioning aligns with the inner area (inside 5px border)
  syncOverlayAndBgPosition();

  bgCtx = bc.getContext('2d');
}

function drawGridLines(width, height, cellW, cellH) {
  if (!showGridLines) return;
  bgCtx.save();
  bgCtx.strokeStyle = '#bdbdbd';
  bgCtx.lineWidth = 2; // Thicker grid lines

  // IMPORTANT: pixel alignment — only offset by 0.5 when lineWidth is odd.
  const offset = (bgCtx.lineWidth % 2 === 1) ? 0.5 : 0;

  bgCtx.beginPath();
  // verticals
  for (let c = 0; c <= COLS; c++) {
    const x = Math.round(c * cellW) + offset;
    bgCtx.moveTo(x, 0);
    bgCtx.lineTo(x, height);
  }
  // horizontals
  for (let r = 0; r <= ROWS; r++) {
    const y = Math.round(r * cellH) + offset;
    bgCtx.moveTo(0, y);
    bgCtx.lineTo(width, y);
  }
  bgCtx.stroke();
  bgCtx.restore();
}

function drawBlocks(width, height, cellW, cellH) {
  // Fill all blocks (exactly aligned to the grid)
  bgCtx.save();
  bgCtx.fillStyle = '#fff5ed';
  blocks.forEach(key => {
    const [cx, cy] = key.split(',').map(n => parseInt(n, 10));
    const x = cx * cellW;
    const y = cy * cellH;
    bgCtx.fillRect(x, y, cellW, cellH);
  });
  bgCtx.restore();
}

function drawMergedOutlines(width, height, cellW, cellH) {
  // Draw only border edges (no internal edges), merged visually
  bgCtx.save();
  bgCtx.strokeStyle = '#000000';
  bgCtx.lineWidth = 5;       // Match arena outline thickness
  bgCtx.lineJoin = 'miter';
  bgCtx.lineCap = 'square';  // Square caps to merge cleanly with arena outer edge

  const has = (x, y) => blocks.has(`${x},${y}`);

  // For crisp strokes with odd line width, offset by 0.5
  const offset = (bgCtx.lineWidth % 2 === 1) ? 0.5 : 0;

  for (const key of blocks) {
    const [cx, cy] = key.split(',').map(n => parseInt(n, 10));
    const x = cx * cellW;
    const y = cy * cellH;

    const leftEmpty = (cx - 1 < 0) || !has(cx - 1, cy);
    const rightEmpty = (cx + 1 >= COLS) || !has(cx + 1, cy);
    const topEmpty = (cy - 1 < 0) || !has(cx, cy - 1);
    const bottomEmpty = (cy + 1 >= ROWS) || !has(cx, cy + 1);

    bgCtx.beginPath();
    // Top edge
    if (topEmpty) {
      const yLine = y + offset;
      bgCtx.moveTo(x + offset, yLine);
      bgCtx.lineTo(x + cellW - offset, yLine);
    }
    // Bottom edge
    if (bottomEmpty) {
      const yLine = y + cellH - offset;
      bgCtx.moveTo(x + offset, yLine);
      bgCtx.lineTo(x + cellW - offset, yLine);
    }
    // Left edge
    if (leftEmpty) {
      const xLine = x + offset;
      bgCtx.moveTo(xLine, y + offset);
      bgCtx.lineTo(xLine, y + cellH - offset);
    }
    // Right edge
    if (rightEmpty) {
      const xLine = x + cellW - offset;
      bgCtx.moveTo(xLine, y + offset);
      bgCtx.lineTo(xLine, y + cellH - offset);
    }

    bgCtx.stroke();
  }

  // EXTRA: merge long runs along arena perimeter to match the outer border visually
  // Top runs
  for (let c = 0; c < COLS; c++) {
    if (!has(c, 0)) continue;
    let start = c;
    while (c + 1 < COLS && has(c + 1, 0)) c++;
    const end = c;
    bgCtx.beginPath();
    const yLine = 0 + offset;
    bgCtx.moveTo(start * cellW + offset, yLine);
    bgCtx.lineTo((end + 1) * cellW - offset, yLine);
    bgCtx.stroke();
  }
  // Bottom runs
  for (let c = 0; c < COLS; c++) {
    if (!has(c, ROWS - 1)) continue;
    let start = c;
    while (c + 1 < COLS && has(c + 1, ROWS - 1)) c++;
    const end = c;
    bgCtx.beginPath();
    const yLine = height - offset;
    bgCtx.moveTo(start * cellW + offset, yLine);
    bgCtx.lineTo((end + 1) * cellW - offset, yLine);
    bgCtx.stroke();
  }
  // Left runs
  for (let r = 0; r < ROWS; r++) {
    if (!has(0, r)) continue;
    let start = r;
    while (r + 1 < ROWS && has(0, r + 1)) r++;
    const end = r;
    bgCtx.beginPath();
    const xLine = 0 + offset;
    bgCtx.moveTo(xLine, start * cellH + offset);
    bgCtx.lineTo(xLine, (end + 1) * cellH - offset);
    bgCtx.stroke();
  }
  // Right runs
  for (let r = 0; r < ROWS; r++) {
    if (!has(COLS - 1, r)) continue;
    let start = r;
    while (r + 1 < ROWS && has(COLS - 1, r + 1)) r++;
    const end = r;
    bgCtx.beginPath();
    const xLine = width - offset;
    bgCtx.moveTo(xLine, start * cellH + offset);
    bgCtx.lineTo(xLine, (end + 1) * cellH - offset);
    bgCtx.stroke();
  }

  bgCtx.restore();
}

function drawBackground() {
  const bc = getBgCanvas();
  const ac = getArenaCanvas();
  if (!bc || !ac || !bgCtx) return;

  const width = bc.width = ac.width;
  const height = bc.height = ac.height;

  const cellW = width / COLS;
  const cellH = height / ROWS;

  // Clear
  bgCtx.clearRect(0, 0, width, height);

  if (!enabled) return;

  // Grid lines (only in edit)
  drawGridLines(width, height, cellW, cellH);

  // Blocks fill, then merged outline
  drawBlocks(width, height, cellW, cellH);
  drawMergedOutlines(width, height, cellW, cellH);

  // NEW: hover highlight for active tool (supports brush sizes > 1x1)
  if (toolMode && hoverCells && hoverCells.length) {
    bgCtx.save();
    bgCtx.globalAlpha = 0.35;
    bgCtx.fillStyle = (toolMode === 'paint') ? '#4CAF50' : '#f44336';
    for (const { cx, cy } of hoverCells) {
      const x = cx * cellW, y = cy * cellH;
      bgCtx.fillRect(x, y, cellW, cellH);
    }
    bgCtx.globalAlpha = 1;
    bgCtx.lineWidth = 3;
    bgCtx.strokeStyle = (toolMode === 'paint') ? '#2e7d32' : '#b71c1c';
    for (const { cx, cy } of hoverCells) {
      const x = cx * cellW, y = cy * cellH;
      bgCtx.strokeRect(x + 1.5, y + 1.5, cellW - 3, cellH - 3);
    }
    bgCtx.restore();
  }
}

function gridCoordsFromEvent(e) {
  const oc = getOverlayCanvas();
  if (!oc) return null;
  const rect = oc.getBoundingClientRect();
  const scaleX = oc.width / rect.width;
  const scaleY = oc.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const cellW = oc.width / COLS;
  const cellH = oc.height / ROWS;
  const cx = Math.floor(x / cellW);
  const cy = Math.floor(y / cellH);

  return { cx, cy, cellW, cellH };
}

// NEW: compute the exact set of cells affected by current brush size (top-left biased for even sizes)
function getBrushCells(centerCx, centerCy) {
  const cells = [];
  const half = Math.floor((brushSize - 1) / 2);
  const startX = centerCx - half;
  const startY = centerCy - half;
  for (let y = startY; y < startY + brushSize; y++) {
    for (let x = startX; x < startX + brushSize; x++) {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
        cells.push({ cx: x, cy: y });
      }
    }
  }
  return cells;
}

function paintAt(cx, cy) {
  const cells = getBrushCells(cx, cy);
  for (const { cx: x, cy: y } of cells) {
    blocks.add(`${x},${y}`);
  }
}
function eraseAt(cx, cy) {
  const cells = getBrushCells(cx, cy);
  for (const { cx: x, cy: y } of cells) {
    blocks.delete(`${x},${y}`);
  }
}

function handleClick(e) {
  if (!enabled) return;
  if (!toolMode) return; // No tool equipped
  const pos = gridCoordsFromEvent(e);
  if (!pos) return;
  if (toolMode === 'erase') {
    eraseAt(pos.cx, pos.cy);
  } else if (toolMode === 'paint') {
    paintAt(pos.cx, pos.cy);
  }
  drawBackground();
}

function handleMove(e) {
  if (!enabled || !toolMode) return;
  const pos = gridCoordsFromEvent(e);
  const newCells = (pos && pos.cx >= 0 && pos.cy >= 0 && pos.cx < COLS && pos.cy < ROWS)
    ? getBrushCells(pos.cx, pos.cy)
    : null;

  const changed = (() => {
    if (!hoverCells && !newCells) return false;
    if ((!hoverCells && newCells) || (hoverCells && !newCells)) return true;
    if (hoverCells.length !== newCells.length) return true;
    for (let i = 0; i < hoverCells.length; i++) {
      if (hoverCells[i].cx !== newCells[i].cx || hoverCells[i].cy !== newCells[i].cy) return true;
    }
    return false;
  })();

  hoverCells = newCells;
  if (changed) {
    // Batch redraw to once per frame
    if (!_hoverRAF) {
      _hoverRAF = requestAnimationFrame(() => {
        _hoverRAF = null;
        drawBackground();
      });
    }
  }
}

function setupBrushButton() {
  const btn = document.getElementById('brushSizeButton');
  if (!btn) return;
  const updateLabel = () => {
    btn.textContent = `Brush: ${brushSize}x${brushSize}`;
  };
  btn.onclick = () => {
    // Cycle 1 -> 2 -> 3 -> 4 -> 5 -> 1
    brushSize = brushSize >= 5 ? 1 : (brushSize + 1);
    updateLabel();
  };
  updateLabel();
}

// NEW: unified tool equip handling
function setTool(mode) {
  toolMode = mode; // 'paint' | 'erase' | null

  const paintBtn = document.getElementById('paintButton');
  const eraseBtn = document.getElementById('eraseButton');
  const oc = getOverlayCanvas();

  if (paintBtn) paintBtn.classList.toggle('active', toolMode === 'paint');
  if (eraseBtn) eraseBtn.classList.toggle('active', toolMode === 'erase');

  // Only capture pointer events when a tool is equipped; otherwise let clicks reach the game canvas for dragging
  if (oc) {
    oc.style.pointerEvents = (enabled && toolMode) ? 'auto' : 'none';
  }
  // Clear hover highlight if tool unequipped
  if (!toolMode) {
    hoverCells = null;
    drawBackground();
  }
}

function setupPaintButton() {
  const btn = document.getElementById('paintButton');
  if (!btn) return;
  btn.onclick = () => {
    // Toggle paint; ensure erase is off
    if (toolMode === 'paint') {
      setTool(null);
    } else {
      setTool('paint');
    }
  };
}

function setupEraseButton() {
  const btn = document.getElementById('eraseButton');
  if (!btn) return;
  btn.onclick = () => {
    // Toggle erase; ensure paint is off
    if (toolMode === 'erase') {
      setTool(null);
    } else {
      setTool('erase');
    }
  };
}

// Physics helpers: circle-rect collision resolution
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function resolveCircleVsRect(p, rx, ry, rw, rh) {
  // Find closest point on rect to circle center
  const closestX = clamp(p.x, rx, rx + rw);
  const closestY = clamp(p.y, ry, ry + rh);

  const dx = p.x - closestX;
  const dy = p.y - closestY;
  const distSq = dx*dx + dy*dy;
  const r = p.radius;

  if (distSq >= r*r) return false;

  const dist = Math.sqrt(distSq) || 0.00001;
  const nx = dx / dist, ny = dy / dist;

  // Push circle out by penetration depth
  const penetration = r - dist;
  p.x += nx * penetration;
  p.y += ny * penetration;
  // Small extra slop to avoid re-penetration next frame
  p.x += nx * 0.5; 
  p.y += ny * 0.5;

  // Proper elastic reflection of velocity across the contact normal:
  // v' = v - (1 + e) * (v·n) * n
  // Use perfectly elastic restitution to match arena walls
  const e = 1.0;
  // NEW: decompose into normal/tangent and apply tangential damping to reduce sliding/jitter
  const tx = -ny, ty = nx;
  const vn0 = p.vx * nx + p.vy * ny;
  const vt0 = p.vx * tx + p.vy * ty;
  const vn1 = -e * vn0;
  const vt1 = vt0 * 0.90; // tangential friction
  p.vx = vn1 * nx + vt1 * tx;
  p.vy = vn1 * ny + vt1 * ty;
  return true;
}

function collidePlayerWithBlocks(p) {
  const ac = getArenaCanvas();
  if (!ac) return;

  const cellW = ac.width / COLS;
  const cellH = ac.height / ROWS;

  // Swept movement: step along last segment from prev -> current
  const prevX = Number.isFinite(p.prevX) ? p.prevX : (p.x - p.vx);
  const prevY = Number.isFinite(p.prevY) ? p.prevY : (p.y - p.vy);
  const dx = p.x - prevX, dy = p.y - prevY;
  const dist = Math.hypot(dx, dy);
  const stepLen = Math.max(1, Math.min(cellW, cellH) / 3);
  const steps = Math.max(1, Math.min(12, Math.ceil(dist / stepLen)));

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const targetX = prevX + dx * t;
    const targetY = prevY + dy * t;
    p.x = targetX; p.y = targetY;

    // Determine which cells to check around current substep
    const cx = Math.floor(p.x / cellW);
    const cy = Math.floor(p.y / cellH);
    const minC = Math.max(0, cx - 3), maxC = Math.min(COLS - 1, cx + 3);
    const minR = Math.max(0, cy - 3), maxR = Math.min(ROWS - 1, cy + 3);

    // Multiple resolution passes at each substep
    for (let iter = 0; iter < 6; iter++) {
      let anyResolved = false;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (!blocks.has(`${c},${r}`)) continue;
          const rx = c * cellW, ry = r * cellH;
          if (resolveCircleVsRect(p, rx, ry, cellW, cellH)) anyResolved = true;
        }
      }
      if (!anyResolved) break;
    }
  }
}

// NEW: projectile-vs-block collision (arrows stop; shuriken bounce like walls)
import { playShurikenBounceSound, playBowImpactSound } from '../audio.js';

function resolveProjectileVsRect(proj, kind, rx, ry, rw, rh, isMenuContext) {
  // Treat projectile as a small circle
  const r = kind === 'shuriken' ? Math.max(10, proj.collisionRadius || 14)
           : kind === 'bomb' ? Math.max(14, proj.collisionRadius || proj.baseRadius || 16)
           : Math.max(8, proj.baseRadius || 12);
  // Early AABB check
  if (proj.x + r < rx || proj.x - r > rx + rw || proj.y + r < ry || proj.y - r > ry + rh) return false;

  // Compute closest point
  const cx = clamp(proj.x, rx, rx + rw);
  const cy = clamp(proj.y, ry, ry + rh);
  const dx = proj.x - cx;
  const dy = proj.y - cy;
  const distSq = dx*dx + dy*dy;
  if (distSq > r*r) return false;

  if (kind === 'arrow') {
    // Arrows are blocked by walls: mark for removal and play impact
    proj.life = 0;
    if (!isMenuContext) playBowImpactSound();
    return true;
  } else if (kind === 'bomb') {
    // Bombs STICK to blocks: snap to contact point and zero velocity
    const dist = Math.sqrt(distSq) || 0.00001;
    const nx = dx / dist, ny = dy / dist;
    const penetration = r - dist;
    proj.x += nx * penetration;
    proj.y += ny * penetration;
    proj.vx = 0; proj.vy = 0;
    proj.angle = Math.atan2(proj.vy, proj.vx) || 0;
    // Mark as anchored so weapon can pin it
    proj.stuckWall = 'block';
    proj.anchorX = proj.x; proj.anchorY = proj.y;
    return true;
  } else {
    // Shuriken reflect across the collision normal, decrement bounces
    const dist = Math.sqrt(distSq) || 0.00001;
    const nx = dx / dist;
    const ny = dy / dist;

    // Push out
    const penetration = r - dist;
    proj.x += nx * penetration;
    proj.y += ny * penetration;

    // Reflect velocity
    const vn = proj.vx * nx + proj.vy * ny;
    const restitution = 1.0; // perfectly elastic, same as arena walls
    const tx = -ny, ty = nx;
    const vn0 = proj.vx * nx + proj.vy * ny;
    const vt0 = proj.vx * tx + proj.vy * ty;
    const vn1 = -restitution * vn0;
    const vt1 = vt0 * 0.90; // tangential friction
    proj.vx = vn1 * nx + vt1 * tx;
    proj.vy = vn1 * ny + vt1 * ty;
    proj.angle = Math.atan2(proj.vy, proj.vx);
    if (typeof proj.bouncesLeft === 'number') proj.bouncesLeft--;
    if (!isMenuContext) playShurikenBounceSound();
    return true;
  }
}

function collideProjectileWithBlocks(proj, kind, isMenuContext = false) {
  const ac = getArenaCanvas();
  if (!ac) return;
  const cellW = ac.width / COLS;
  const cellH = ac.height / ROWS;

  // NEW: swept sampling from previous position to current to prevent tunneling
  const px0 = Number.isFinite(proj.prevX) ? proj.prevX : (proj.x - (proj.vx || 0));
  const py0 = Number.isFinite(proj.prevY) ? proj.prevY : (proj.y - (proj.vy || 0));
  const dx = (proj.x - px0);
  const dy = (proj.y - py0);
  const dist = Math.hypot(dx, dy);
  const stepLen = Math.max(1, Math.min(cellW, cellH) / 2);
  const steps = Math.max(1, Math.min(24, Math.ceil(dist / stepLen)));

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    // Temporarily place projectile along the path (mutates in-place for resolution)
    proj.x = px0 + dx * t;
    proj.y = py0 + dy * t;

    const cx = Math.floor(proj.x / cellW);
    const cy = Math.floor(proj.y / cellH);
    const minC = Math.max(0, cx - 2);
    const maxC = Math.min(COLS - 1, cx + 2);
    const minR = Math.max(0, cy - 2);
    const maxR = Math.min(ROWS - 1, cy + 2);

    // Iterate a couple times to settle out of penetrations (bomb sticks on first contact)
    for (let iter = 0; iter < 2; iter++) {
      let hit = false;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (!blocks.has(`${c},${r}`)) continue;
          const rx = c * cellW, ry = r * cellH;
          if (resolveProjectileVsRect(proj, kind, rx, ry, cellW, cellH, isMenuContext)) {
            hit = true;
            if (kind === 'arrow' || kind === 'staff' || kind === 'bomb') return; // arrow/staff consumed, bomb sticks
          }
        }
      }
      if (!hit) break;
    }
  }
}

export function setupCustomMap() {
  overlayCanvas = getOverlayCanvas();
  bgCanvas = getBgCanvas();

  if (!overlayCanvas || !bgCanvas) return;

  overlayCanvas.addEventListener('click', handleClick);
  // NEW: hover tracking for highlight
  overlayCanvas.addEventListener('pointermove', handleMove);
  overlayCanvas.addEventListener('pointerleave', () => { if (hoverCells) { hoverCells = null; drawBackground(); } });

  // Initialize controls
  setupBrushButton();
  setupPaintButton();
  setupEraseButton();
  setTool(null); // Start UNEQUIPPED so users can drag balls until they choose a tool

  // expose controls
  window.customMap = {
    setEnabled(on) {
      enabled = !!on;
      const oc = getOverlayCanvas();
      const bc = getBgCanvas();
      const ac = getArenaCanvas();
      if (!oc || !ac || !bc) return;

      // Resize and redraw
      resizeCanvasesToArena();
      showGridLines = enabled; // show lines only while editing (custom mode)
      // Show/hide canvases appropriately
      bc.style.display = enabled ? 'block' : 'none';
      oc.style.display = enabled ? 'block' : 'none';
      // Pointer events only when a tool is equipped
      oc.style.pointerEvents = (enabled && toolMode) ? 'auto' : 'none';

      // Make sure alignment is exact before drawing
      syncOverlayAndBgPosition();
      drawBackground();
    },
    onResize() {
      if (!getArenaCanvas()) return;
      resizeCanvasesToArena();
      syncOverlayAndBgPosition();
      drawBackground();
    },
    onPlayStart() {
      // Hide only the grid lines & interaction; keep blocks and physics active
      const oc = getOverlayCanvas();
      if (oc) {
        oc.style.display = 'none';
        oc.style.pointerEvents = 'none';
      }
      showGridLines = false;
      drawBackground();
    },
    onReset() {
      if (!enabled) return;
      // Restore overlay visibility; pointer events depend on tool equip state
      const oc = getOverlayCanvas();
      if (oc) {
        oc.style.display = 'block';
        oc.style.pointerEvents = toolMode ? 'auto' : 'none';
      }
      // Keep the user's tool selection; do not force equip
      showGridLines = true;
      // Re-sync positions in case border/zoom/layout changed
      syncOverlayAndBgPosition();
      drawBackground();
    },
    // Physics API
    isEnabled() { return enabled; },
    collidePlayer(player) {
      if (!enabled) return;
      collidePlayerWithBlocks(player);
    },
    // NEW: projectiles API
    collideProjectile(proj, kind, isMenuContext = false) {
      if (!enabled || !proj) return;
      collideProjectileWithBlocks(proj, kind, isMenuContext);
    },
    // Useful for debugging
    getCellCount() { return { cols: COLS, rows: ROWS }; },
    hasBlock(c, r) { return blocks.has(`${c},${r}`); }
  };

  // Keep alignment correct on window resize/zoom changes
  window.addEventListener('resize', () => {
    syncOverlayAndBgPosition();
    drawBackground();
  });

  // Initial sync (hidden by default until enabled)
  resizeCanvasesToArena();
  // Hide background canvas initially so grid never shows in non-Custom modes
  if (bgCanvas) bgCanvas.style.display = 'none';
  // Draw once (will be a clear canvas since enabled=false)
  drawBackground();
}