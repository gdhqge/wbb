// Utilities extracted from arena-sizing: player clamping, etc.

import { players } from '../state.js';

export function clampPlayersToCanvas(width, height) {
  players.forEach(p => {
    const r = p.radius || 0;
    if (p.x > width - r) p.x = width - r;
    if (p.x < r) p.x = r;
    if (p.y > height - r) p.y = height - r;
    if (p.y < r) p.y = r;

    if (p.x === width - r && p.vx > 0) p.vx *= -1;
    if (p.x === r && p.vx < 0) p.vx *= -1;
    if (p.y === height - r && p.vy > 0) p.vy *= -1;
    if (p.y === r && p.vy < 0) p.vy *= -1;
  });
}