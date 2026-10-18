import { updateVersusDisplay, resetVersusUI, updateLoserUI } from './ui/versus-display.js';
import { setupClassicWeaponSelection } from './ui/weapon-selection.js';
import { setupFFABallSelection, getSelectedBalls as getSelectedFFABalls, clearFFABallSelections } from './ui/ffa-selection.js';
import { initialPlayer1State, initialPlayer2State, setGetSelectedBallsFunction } from './state.js';

export { updateLoserUI, resetVersusUI, getSelectedFFABalls as getSelectedBalls };

// Set the function reference to avoid circular dependency
setGetSelectedBallsFunction(getSelectedFFABalls);

export function resetSelections() {
    // Reset internal state objects for classic mode
    initialPlayer1State.type = 'basic';
    initialPlayer1State.color = 'white';
    initialPlayer2State.type = 'basic';
    initialPlayer2State.color = 'white';

    // Remove 'selected' class from all weapon displays to reset UI visuals (classic)
    document.querySelectorAll('.weapon-display.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Clear selected balls for FFA mode
    clearFFABallSelections();

    // Reset the versus display to show "Basic VS Basic"
    updateVersusDisplay(initialPlayer1State, initialPlayer2State);
}

export function setupUI(resetGameCallback) {
    const leftSelectionBox = document.getElementById('selection-box-left');
    const rightSelectionBox = document.getElementById('selection-box-right');

    setupClassicWeaponSelection(
        leftSelectionBox, 
        rightSelectionBox, 
        initialPlayer1State, 
        initialPlayer2State,
        updateVersusDisplay,
        resetGameCallback
    );

    updateVersusDisplay(initialPlayer1State, initialPlayer2State);
}

// Re-export setupFFABallSelection for compatibility
export { setupFFABallSelection };

// NEW: Re-export setupTeamsBallSelection
export { setupTeamsBallSelection } from './ui/ffa-selection.js';

// NEW: Re-export Boss selection
export { setupBossBallSelection } from './ui/ffa-selection.js';