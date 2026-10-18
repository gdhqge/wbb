import { playClickSound } from './audio.js';
import { getCurrentGamemode } from './gamemode-management.js';

let uiHidden = false;

export function setupUIState() {
    const hideUIButton = document.getElementById('hideUIButton');

    hideUIButton.addEventListener('click', async () => {
        await playClickSound();
        uiHidden = !uiHidden;
        const selectionBoxLeft = document.getElementById('selection-box-left');
        const selectionBoxRight = document.getElementById('selection-box-right');
        const playBtn = document.getElementById('playButton');
        const resetBtn = document.getElementById('resetButton');
        const gamemodesBtn = document.getElementById('gamemodesButton');
        const gravityBtn = document.getElementById('gravityButton');
        const zoomControls = document.getElementById('zoom-controls'); // NEW: Zoom controls container
        // NEW: Custom tool buttons
        const brushBtn = document.getElementById('brushSizeButton');
        const paintBtn = document.getElementById('paintButton');
        const eraseBtn = document.getElementById('eraseButton');
        // NEW: Music mute button
        const musicBtn = document.getElementById('musicMuteButton');
        // NEW: Speed button
        const speedBtn = document.getElementById('speedButton');
        // NEW: Custom Ball Maker button
        const makerBtn = document.getElementById('customMakerButton');
        // NEW: Health button and panel
        const healthBtn = document.getElementById('healthButton');
        const healthPanel = document.getElementById('health-panel');
        
        const currentGamemode = getCurrentGamemode();

        if (uiHidden) {
            // Always hide both sidebars when hiding UI (including Boss mode)
            selectionBoxLeft.style.display = 'none';
            selectionBoxRight.style.display = 'none';

            playBtn.style.display = 'none';
            resetBtn.style.display = 'none';
            gamemodesBtn.style.display = 'none';
            if (gravityBtn) gravityBtn.style.display = 'none';
            if (zoomControls) zoomControls.style.display = 'none';
            // NEW: hide custom tool buttons too
            if (brushBtn) brushBtn.style.display = 'none';
            if (paintBtn) paintBtn.style.display = 'none';
            if (eraseBtn) eraseBtn.style.display = 'none';
            // NEW: hide music mute button
            if (musicBtn) musicBtn.style.display = 'none';
            // NEW: hide speed button
            if (speedBtn) speedBtn.style.display = 'none';
            // NEW: hide Custom Ball Maker button
            if (makerBtn) makerBtn.style.display = 'none';
            // NEW: hide Health button and panel
            if (healthBtn) healthBtn.style.display = 'none';
            if (healthPanel) healthPanel.style.display = 'none';

            hideUIButton.textContent = 'Show UI';
        } else {
            // Show everything back, INCLUDING the Boss sidebar in Boss mode
            selectionBoxLeft.style.display = 'flex';
            if (currentGamemode === 'boss' || currentGamemode === 'teams' || currentGamemode === 'classic') {
                selectionBoxRight.style.display = 'flex';
            } else {
                // In FFA we keep the right sidebar hidden
                selectionBoxRight.style.display = 'none';
            }

            playBtn.style.display = '';
            resetBtn.style.display = '';
            gamemodesBtn.style.display = '';
            if (gravityBtn) gravityBtn.style.display = '';
            if (zoomControls) zoomControls.style.display = 'flex';
            // NEW: only show custom tool buttons if Custom mode is enabled
            const customEnabled = !!(window.customMap && typeof window.customMap.isEnabled === 'function' && window.customMap.isEnabled());
            if (brushBtn) brushBtn.style.display = customEnabled ? '' : 'none';
            if (paintBtn) paintBtn.style.display = customEnabled ? '' : 'none';
            if (eraseBtn) eraseBtn.style.display = customEnabled ? '' : 'none';
            // NEW: show music mute button
            if (musicBtn) musicBtn.style.display = '';
            // NEW: show speed button
            if (speedBtn) speedBtn.style.display = '';
            // NEW: show Custom Ball Maker button
            if (makerBtn) makerBtn.style.display = '';
            // NEW: show Health button
            if (healthBtn) healthBtn.style.display = '';
            if (healthPanel) healthPanel.style.display = '';

            hideUIButton.textContent = 'Hide UI';
        }
    });
}

export function syncSidePanelsToCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const h = `${canvas.height}px`;
    const left = document.getElementById('selection-box-left');
    const right = document.getElementById('selection-box-right');
    if (left) left.style.height = h;
    if (right) right.style.height = h;

    const damageWrapper = document.getElementById('damage-info-wrapper');
    const arenaWrapper = document.getElementById('arena-wrapper');
    const canvasStack = document.getElementById('canvas-stack');
    const gameContainer = document.getElementById('game-container');

    if (damageWrapper) {
        const isLargeUp = gameContainer && (
          gameContainer.classList.contains('arena-large') ||
          gameContainer.classList.contains('arena-huge') ||
          gameContainer.classList.contains('arena-massive')
        );
        if (isLargeUp && arenaWrapper && canvasStack) {
            // Use precise relative position to align with canvas within game-container
            const gcRect = gameContainer.getBoundingClientRect();
            const csRect = canvasStack.getBoundingClientRect();
            const offset = Math.max(0, Math.round(csRect.left - gcRect.left));
            damageWrapper.style.marginLeft = `${offset}px`;
            damageWrapper.style.width = `${canvas.width}px`;
        } else {
            damageWrapper.style.marginLeft = '';
            damageWrapper.style.width = `${canvas.width + 10}px`;
        }
    }
}