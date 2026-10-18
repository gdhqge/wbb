import { DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT } from './state.js';
import { playClickSound } from './audio.js';
import { resetGame } from './game.js';
import { getCurrentGamemode } from './gamemode-management.js';
import { syncSidePanelsToCanvas } from './ui-state.js';

import { ARENA_SIZES, HOLD_MS, TRANSITION_MS } from './arena/arena-constants.js';
import { applyArenaSizeClasses, updateControlsSpacing, updateUIForCanvas } from './arena/arena-ui.js';
import { createShrinkingController } from './arena/arena-shrinker.js';
import { clampPlayersToCanvas } from './arena/arena-utils.js';

let currentArenaSelection = 'medium'; 
let shrinkingController = null;
let shrinkingPending = false;

if (!window.arenaSizingControls) window.arenaSizingControls = {};
window.arenaSizingControls.isShrinkingActive = () =>
  !!(shrinkingController && shrinkingController.isActive && shrinkingController.isActive());
window.arenaSizingControls._setShrinkingActive = () => { /* no-op: managed internally in the controller now */ };
window.arenaSizingControls._isShrinkingPending = () => shrinkingPending;

/* NEW: helper to toggle custom map overlay */
function applyCustomMapEnabled(enabled) {
  if (window.customMap && typeof window.customMap.setEnabled === 'function') {
    window.customMap.setEnabled(enabled);
  }
  // Toggle brush, paint & erase button visibility
  const brushBtn = document.getElementById('brushSizeButton');
  const paintBtn = document.getElementById('paintButton');
  const eraseBtn = document.getElementById('eraseButton');
  if (brushBtn) brushBtn.style.display = enabled ? '' : 'none';
  if (paintBtn) paintBtn.style.display = enabled ? '' : 'none';
  if (eraseBtn) eraseBtn.style.display = enabled ? '' : 'none';
}

export function setupArenaSizing() {
  const smallArenaBtn = document.getElementById('small-arena-btn');
  const mediumArenaBtn = document.getElementById('medium-arena-btn');
  const largeArenaBtn = document.getElementById('large-arena-btn');
  const hugeArenaBtn = document.getElementById('huge-arena-btn');
  const shrinkingArenaBtn = document.getElementById('shrinking-arena-btn');
  // NEW: Custom (classic)
  const customArenaBtn = document.getElementById('custom-arena-btn');
  // NEW: Massive (classic)
  const massiveArenaBtn = document.getElementById('massive-arena-btn');

  const smallArenaBtnFFA = document.getElementById('small-arena-btn-ffa');
  const mediumArenaBtnFFA = document.getElementById('medium-arena-btn-ffa');
  const largeArenaBtnFFA = document.getElementById('large-arena-btn-ffa');
  const hugeArenaBtnFFA = document.getElementById('huge-arena-btn-ffa');
  const shrinkingArenaBtnFFA = document.getElementById('shrinking-arena-btn-ffa');
  // NEW: Custom (FFA)
  const customArenaBtnFFA = document.getElementById('custom-arena-btn-ffa');
  // NEW: Massive (FFA)
  const massiveArenaBtnFFA = document.getElementById('massive-arena-btn-ffa');

  const smallArenaBtnTeams = document.getElementById('small-arena-btn-teams');
  const mediumArenaBtnTeams = document.getElementById('medium-arena-btn-teams');
  const largeArenaBtnTeams = document.getElementById('large-arena-btn-teams');
  const hugeArenaBtnTeams = document.getElementById('huge-arena-btn-teams');
  const shrinkingArenaBtnTeams = document.getElementById('shrinking-arena-btn-teams');
  // NEW: Custom (Teams)
  const customArenaBtnTeams = document.getElementById('custom-arena-btn-teams');
  // NEW: Massive (Teams)
  const massiveArenaBtnTeams = document.getElementById('massive-arena-btn-teams');

  const largeArenaBtnBoss = document.getElementById('large-arena-btn-boss');
  const hugeArenaBtnBoss = document.getElementById('huge-arena-btn-boss');
  // NEW: Custom (Boss)
  const customArenaBtnBoss = document.getElementById('custom-arena-btn-boss');
  // NEW: Massive (Boss)
  const massiveArenaBtnBoss = document.getElementById('massive-arena-btn-boss');

  smallArenaBtn.addEventListener('click', () => startGameWithArenaSize('small'));
  mediumArenaBtn.addEventListener('click', () => startGameWithArenaSize('medium'));
  largeArenaBtn.addEventListener('click', () => startGameWithArenaSize('large'));
  hugeArenaBtn.addEventListener('click', () => startGameWithArenaSize('huge'));
  if (shrinkingArenaBtn) shrinkingArenaBtn.addEventListener('click', () => startGameWithArenaSize('shrinking'));
  if (customArenaBtn) customArenaBtn.addEventListener('click', () => startGameWithArenaSize('custom'));
  if (massiveArenaBtn) massiveArenaBtn.addEventListener('click', () => startGameWithArenaSize('massive'));

  smallArenaBtnFFA.addEventListener('click', () => startGameWithArenaSize('small'));
  mediumArenaBtnFFA.addEventListener('click', () => startGameWithArenaSize('medium'));
  largeArenaBtnFFA.addEventListener('click', () => startGameWithArenaSize('large'));
  hugeArenaBtnFFA.addEventListener('click', () => startGameWithArenaSize('huge'));
  if (shrinkingArenaBtnFFA) shrinkingArenaBtnFFA.addEventListener('click', () => startGameWithArenaSize('shrinking'));
  if (customArenaBtnFFA) customArenaBtnFFA.addEventListener('click', () => startGameWithArenaSize('custom'));
  if (massiveArenaBtnFFA) massiveArenaBtnFFA.addEventListener('click', () => startGameWithArenaSize('massive'));

  smallArenaBtnTeams.addEventListener('click', () => startGameWithArenaSize('small'));
  mediumArenaBtnTeams.addEventListener('click', () => startGameWithArenaSize('medium'));
  largeArenaBtnTeams.addEventListener('click', () => startGameWithArenaSize('large'));
  hugeArenaBtnTeams.addEventListener('click', () => startGameWithArenaSize('huge'));
  if (shrinkingArenaBtnTeams) shrinkingArenaBtnTeams.addEventListener('click', () => startGameWithArenaSize('shrinking'));
  if (customArenaBtnTeams) customArenaBtnTeams.addEventListener('click', () => startGameWithArenaSize('custom'));
  if (massiveArenaBtnTeams) massiveArenaBtnTeams.addEventListener('click', () => startGameWithArenaSize('massive'));

  if (largeArenaBtnBoss) largeArenaBtnBoss.addEventListener('click', () => startGameWithArenaSize('large'));
  if (hugeArenaBtnBoss) hugeArenaBtnBoss.addEventListener('click', () => startGameWithArenaSize('huge'));
  if (customArenaBtnBoss) customArenaBtnBoss.addEventListener('click', () => startGameWithArenaSize('custom'));
  if (massiveArenaBtnBoss) massiveArenaBtnBoss.addEventListener('click', () => startGameWithArenaSize('massive'));

  async function startGameWithArenaSize(size) {
    await playClickSound();

    const mode = getCurrentGamemode();
    if (mode === 'boss' && (size === 'small' || size === 'medium' || size === 'shrinking')) {
      size = 'large';
    }

    currentArenaSelection = size;

    // Turn off shrinking controller for non-shrinking sizes
    if (size !== 'shrinking' && shrinkingController) {
      shrinkingController.cancel();
      shrinkingController = null;
      shrinkingPending = false;
    }

    // NEW: toggle custom map overlay
    applyCustomMapEnabled(size === 'custom');

    const { w: newWidth, h: newHeight } =
      size === 'small' ? ARENA_SIZES.SMALL :
      size === 'large' ? ARENA_SIZES.LARGE :
      size === 'huge' ? ARENA_SIZES.HUGE :
      size === 'massive' ? ARENA_SIZES.MASSIVE :
      size === 'shrinking' ? ARENA_SIZES.MASSIVE :
      size === 'custom' ? ARENA_SIZES.CUSTOM :
      ARENA_SIZES.MEDIUM;

    const gamemodesMenu = document.getElementById('gamemodes-menu');
    const gameContainer = document.getElementById('game-container');
    const canvas = document.getElementById('gameCanvas');

    applyArenaSizeClasses(gameContainer, size === 'custom' ? 'huge' : size);

    gamemodesMenu.style.display = 'none';
    gamemodesMenu.style.opacity = '0';
    gamemodesMenu.style.pointerEvents = 'none';

    canvas.width = newWidth;
    canvas.height = newHeight;
    clampPlayersToCanvas(newWidth, newHeight);

    syncSidePanelsToCanvas();
    updateControlsSpacing(newHeight);
    updateUIForCanvas(newWidth, newHeight);

    const currentGamemode = getCurrentGamemode();

    resetGame(newWidth, newHeight);

    if (currentGamemode === 'ffa' || currentGamemode === 'teams' || currentGamemode === 'boss') {
      const damageInfoWrapper = document.getElementById('damage-info-wrapper');
      if (damageInfoWrapper) {
        damageInfoWrapper.style.left = `${newWidth + 1}px`;
        damageInfoWrapper.style.height = `${newHeight}px`;
        damageInfoWrapper.style.width = `${newWidth + 10}px`;
      }
    }

    // NOTE: We used to call customMap.onResize()/onReset() here, but when the game container
    // is still hidden, the arena canvas client sizes are 0, which causes misalignment and
    // the grid not appearing. We now show the game first, then trigger these hooks.

    collapseAllSizePanels();

    gameContainer.style.display = 'flex';
    gameContainer.style.opacity = '1';

    // After the container is visible, align and draw the custom grid so it appears immediately.
    if (window.customMap && typeof window.customMap.onResize === 'function') {
      window.customMap.onResize();
    }
    if (size === 'custom' && window.customMap && typeof window.customMap.onReset === 'function') {
      window.customMap.onReset();
    }

    if (size === 'shrinking') {
      if (mode === 'boss') return;
      if (shrinkingController) {
        shrinkingController.cancel();
        shrinkingController = null;
      }
      shrinkingPending = true;
    }
  }

  window.arenaSizingControls.getSelection = () => currentArenaSelection;
  window.arenaSizingControls.pauseShrinking = () => {
    if (shrinkingController) shrinkingController.pause();
  };
  window.arenaSizingControls.resumeShrinking = () => {
    if (shrinkingController) {
      shrinkingController.resume();
      return;
    }
    if (currentArenaSelection === 'shrinking' && shrinkingPending) {
      const canvas = document.getElementById('gameCanvas');
      const gameContainer = document.getElementById('game-container');
      shrinkingController = createShrinkingController({
        canvas,
        gameContainer,
        onProgressUpdate: (curW, curH) => {
          clampPlayersToCanvas(curW, curH);
          syncSidePanelsToCanvas();
          updateControlsSpacing(curH);
          updateUIForCanvas(curW, curH);
          const DAMAGE_WRAP = document.getElementById('damage-info-wrapper');
          if (DAMAGE_WRAP) {
            DAMAGE_WRAP.style.height = `${curH}px`;
            DAMAGE_WRAP.style.width = `${curW + 10}px`;
            if (getComputedStyle(DAMAGE_WRAP).position !== 'relative') {
              DAMAGE_WRAP.style.left = `${curW + 1}px`;
            }
          }
        }
      });
      shrinkingController.start();
      shrinkingPending = false;
    }
  };
  window.arenaSizingControls.resetArenaOnReset = () => {
    const canvas = document.getElementById('gameCanvas');
    const gameContainer = document.getElementById('game-container');

    if (shrinkingController) {
      shrinkingController.cancel();
      shrinkingController = null;
    }

    let target = ARENA_SIZES.MEDIUM;
    let label = 'medium';
    if (currentArenaSelection === 'small') { target = ARENA_SIZES.SMALL; label = 'small'; }
    else if (currentArenaSelection === 'medium') { target = ARENA_SIZES.MEDIUM; label = 'medium'; }
    else if (currentArenaSelection === 'large') { target = ARENA_SIZES.LARGE; label = 'large'; }
    else if (currentArenaSelection === 'huge') { target = ARENA_SIZES.HUGE; label = 'huge'; }
    else if (currentArenaSelection === 'massive') { target = ARENA_SIZES.MASSIVE; label = 'massive'; }
    else if (currentArenaSelection === 'shrinking') {
      target = ARENA_SIZES.MASSIVE;
      label = 'shrinking';
      shrinkingPending = true;
    } else if (currentArenaSelection === 'custom') {
      target = ARENA_SIZES.CUSTOM;
      label = 'huge';
      // keep custom enabled; grid should reappear on reset
      applyCustomMapEnabled(true);
    }

    canvas.width = target.w;
    canvas.height = target.h;
    clampPlayersToCanvas(target.w, target.h);

    applyArenaSizeClasses(gameContainer, label);
    syncSidePanelsToCanvas();
    updateControlsSpacing(target.h);
    updateUIForCanvas(target.w, target.h);

    if (window.customMap && typeof window.customMap.onResize === 'function') {
      window.customMap.onResize();
    }
  };
}

export function collapseAllSizePanels() {
  const arenaSizeSelection = document.getElementById('arena-size-selection');
  const arenaSizeSelectionFFA = document.getElementById('arena-size-selection-ffa');
  const arenaSizeSelectionTeams = document.getElementById('arena-size-selection-teams');
  const arenaSizeSelectionBoss = document.getElementById('arena-size-selection-boss'); 

  arenaSizeSelection.classList.remove('expanded');
  arenaSizeSelectionFFA.classList.remove('expanded');
  arenaSizeSelectionTeams.classList.remove('expanded');
  if (arenaSizeSelectionBoss) arenaSizeSelectionBoss.classList.remove('expanded');
}