// Smooth canvas resize with pause/resume/cancel and world scaling support

import { players } from '../state.js';
import { clampPlayersToCanvas } from './arena-utils.js'; // NEW: keep bodies inside during shrink steps

function scaleWorld(fx, fy) {
  if (!Array.isArray(players) || !players.length) return;
  for (const p of players) {
    // Player body
    p.x *= fx; p.y *= fy;

    // Unarmed trails
    if (p.type === 'unarmed' && Array.isArray(p.trail) && p.trail.length) {
      for (const t of p.trail) {
        t.x *= fx; t.y *= fy;
      }
    }

    // Fragments
    if (Array.isArray(p.fragments) && p.fragments.length) {
      for (const f of p.fragments) {
        f.x *= fx; f.y *= fy;
      }
    }

    // Projectiles per weapon type
    if (p.weapon) {
      if (p.type === 'bow' && Array.isArray(p.weapon.arrows)) {
        for (const a of p.weapon.arrows) {
          a.x *= fx; a.y *= fy;
        }
      }
      if (p.type === 'shuriken' && Array.isArray(p.weapon.projectiles)) {
        for (const s of p.weapon.projectiles) {
          s.x *= fx; s.y *= fy;
        }
      }
    }
  }
}

export function animateResize(canvas, fromW, fromH, toW, toH, durationMs, onProgress, onComplete) {
  let start = null;
  let rafId = null;
  let paused = false;
  let elapsedBeforePause = 0;

  let lastW = fromW;
  let lastH = fromH;

  const step = (t) => {
    if (paused) return;
    if (!start) start = t;
    const elapsed = t - start + elapsedBeforePause;
    const p = Math.min(1, elapsed / durationMs);
    const eased = p * p * (3 - 2 * p);
    const curW = Math.round(fromW + (toW - fromW) * eased);
    const curH = Math.round(fromH + (toH - fromH) * eased);

    // Scale world before committing new canvas size
    if (curW !== lastW || curH !== lastH) {
      const fx = lastW ? (curW / lastW) : 1;
      const fy = lastH ? (curH / lastH) : 1;
      if (isFinite(fx) && isFinite(fy) && fx > 0 && fy > 0) {
        scaleWorld(fx, fy);
      }
      lastW = curW; lastH = curH;
    }

    canvas.width = curW;
    canvas.height = curH;

    // NEW: Clamp all players/projectiles safely into the canvas after each step
    // This prevents "disappearing" when the arena gets smaller mid-animation.
    clampPlayersToCanvas(curW, curH);

    if (typeof onProgress === 'function') onProgress(curW, curH, eased);
    if (p < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      if (typeof onComplete === 'function') onComplete();
    }
  };
  rafId = requestAnimationFrame(step);

  return {
    cancel() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    },
    pause(nowTs) {
      if (paused) return;
      paused = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      // Capture current progress as elapsed
      const delta = toW - fromW;
      const ratio = delta === 0 ? 1 : (lastW - fromW) / delta;
      const clampedP = Math.max(0, Math.min(1, ratio));
      elapsedBeforePause = clampedP * durationMs;
    },
    resume() {
      if (!paused) return;
      paused = false;
      const curW = lastW;
      const curH = lastH;
      const remDuration = Math.max(1, durationMs - elapsedBeforePause);
      start = null;
      const next = animateResize(canvas, curW, curH, toW, toH, remDuration, onProgress, onComplete);
      this.cancel = next.cancel.bind(next);
      this.pause = next.pause ? next.pause.bind(next) : (() => {});
      this.resume = next.resume ? next.resume.bind(next) : (() => {});
    }
  };
}