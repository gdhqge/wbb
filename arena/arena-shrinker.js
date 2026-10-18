// Orchestrates the full shrinking sequence using the animator and UI helpers.
// Freezes gameplay during transitions via a lightweight "active" flag queried by game.js.

import { ARENA_SIZES, HOLD_MS, TRANSITION_MS } from './arena-constants.js';
import { applyArenaSizeClasses, updateControlsSpacing, updateUIForCanvas } from './arena-ui.js';
import { animateResize } from './arena-anim.js';

export function createShrinkingController({ canvas, gameContainer, onProgressUpdate }) {
  const DAMAGE_WRAP = document.getElementById('damage-info-wrapper');
  const OVERLAY = document.getElementById('arena-shrinking-overlay');

  const MASSIVE = { ...ARENA_SIZES.MASSIVE, label: 'massive' };
  const HUGE = { ...ARENA_SIZES.HUGE, label: 'huge' };
  const LARGE = { ...ARENA_SIZES.LARGE, label: 'large' };
  const MED   = { ...ARENA_SIZES.MEDIUM, label: 'medium' };
  const SMALL = { ...ARENA_SIZES.SMALL, label: 'small' };

  let timeouts = [];
  let activeAnim = null;
  let cancelled = false;
  let paused = false;
  let active = false;

  // For pause bookkeeping
  let nextPhaseTimeoutRemaining = 0;
  let nextPhaseDueTime = 0;
  let pendingPhase = null;

  function clearAllTimeouts() {
    timeouts.forEach(id => clearTimeout(id));
    timeouts = [];
  }

  function setActive(v) { 
    active = !!v; 
    // Toggle blackout overlay when actually shrinking (during transitions only)
    if (OVERLAY) {
      OVERLAY.style.display = active ? 'flex' : 'none';
    }
  }
  function isActive() { return active; }

  function scheduleTransition(from, to, afterTransitionFn) {
    const holdId = setTimeout(() => {
      if (cancelled || paused) return;

      setActive(true);

      activeAnim = animateResize(
        canvas, from.w, from.h, to.w, to.h, TRANSITION_MS,
        (curW, curH) => {
          if (typeof onProgressUpdate === 'function') {
            onProgressUpdate(curW, curH);
          }
        },
        () => {
          applyArenaSizeClasses(gameContainer, to.label);
          setActive(false);
          activeAnim = null;

          // Ensure UI exactly matches new size
          updateControlsSpacing(to.h);
          updateUIForCanvas(to.w, to.h);

          if (typeof afterTransitionFn === 'function') afterTransitionFn();
        }
      );
    }, HOLD_MS);

    timeouts.push(holdId);

    nextPhaseDueTime = performance.now() + HOLD_MS;
    pendingPhase = {
      from, to,
      afterTransitionFn
    };
  }

  function startSequence() {
    // Ensure we begin at MASSIVE size before any transitions
    canvas.width = MASSIVE.w;
    canvas.height = MASSIVE.h;
    applyArenaSizeClasses(gameContainer, 'shrinking'); // starts at Massive
    updateControlsSpacing(canvas.height);
    updateUIForCanvas(canvas.width, canvas.height);

    // MASSIVE -> HUGE -> LARGE -> MED -> SMALL
    scheduleTransition(MASSIVE, HUGE, () => {
      scheduleTransition(HUGE, LARGE, () => {
        scheduleTransition(LARGE, MED, () => {
          scheduleTransition(MED, SMALL, () => {
            pendingPhase = null; // finished
          });
        });
      });
    });
  }

  return {
    start() { startSequence(); },
    cancel() {
      cancelled = true;
      clearAllTimeouts();
      if (activeAnim && activeAnim.cancel) activeAnim.cancel();
      activeAnim = null;
      pendingPhase = null;
      setActive(false); // also hides overlay
    },
    pause() {
      if (paused) return;
      paused = true;
      if (pendingPhase) {
        nextPhaseTimeoutRemaining = Math.max(0, nextPhaseDueTime - performance.now());
      }
      clearAllTimeouts();
      if (activeAnim && activeAnim.pause) {
        activeAnim.pause(performance.now());
      }
      // Keep overlay visible if we paused mid-transition; if we paused during hold, it should already be hidden.
      if (OVERLAY && active) OVERLAY.style.display = 'flex';
    },
    resume() {
      if (!paused) return;
      paused = false;

      if (activeAnim && activeAnim.resume) {
        activeAnim.resume();
        return;
      }

      if (pendingPhase) {
        const { from, to, afterTransitionFn } = pendingPhase;
        const remHold = Math.max(0, nextPhaseTimeoutRemaining || 0);
        const id = setTimeout(() => {
          if (cancelled || paused) return;

          setActive(true);

          activeAnim = animateResize(
            canvas, from.w, from.h, to.w, to.h, TRANSITION_MS,
            (curW, curH) => {
              if (typeof onProgressUpdate === 'function') {
                onProgressUpdate(curW, curH);
              }
            },
            () => {
              applyArenaSizeClasses(gameContainer, to.label);
              setActive(false);
              activeAnim = null;

              updateControlsSpacing(to.h);
              updateUIForCanvas(to.w, to.h);

              if (typeof afterTransitionFn === 'function') afterTransitionFn();
            }
          );
        }, remHold);
        timeouts.push(id);
        nextPhaseDueTime = performance.now() + remHold;
      }
    },
    isActive
  };
}