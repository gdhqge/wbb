import { Sword, Dagger, Spear } from '../weapon.js';
import { playClickSound } from '../audio.js';
import { Unarmed } from '../weapon.js';
import { Basic } from '../weapon.js';
import { Bow } from '../weapon.js';
import { Shuriken } from '../weapon.js';
import { Scythe } from '../weapon.js'; // NEW: Scythe
import { Shield } from '../weapon.js'; // NEW: Shield
import { Wrench } from '../weapon.js'; // NEW: Wrench
import { Hammer } from '../weapon.js'; // NEW: Hammer
import { Scepter } from '../weapon.js'; // NEW: Scepter
import { Staff } from '../weapon.js';   // NEW: Staff
import { Katana } from '../weapon.js';  // NEW: Katana
import { Pickaxe } from '../weapon.js'; // NEW: Pickaxe
import { Bomb } from '../weapon.js'; // NEW: Bomb
import { Bat } from '../weapon.js';

let selectedBalls = [];

// New function to clear the selected balls for FFA mode
export function clearFFABallSelections() {
    selectedBalls = [];
}

export function setupFFABallSelection(resetGameCallback) {
    const leftSelectionBox = document.getElementById('selection-box-left');
    leftSelectionBox.innerHTML = ''; // Clear existing content

    const weaponContainer = document.createElement('div');
    weaponContainer.className = 'weapon-container';
    weaponContainer.style.display = 'flex';
    weaponContainer.style.flexDirection = 'column';
    weaponContainer.style.alignItems = 'stretch';
    weaponContainer.style.gap = '10px';
    weaponContainer.style.width = '100%';
    weaponContainer.style.height = '100%';
    weaponContainer.style.overflowX = 'hidden'; // Ensure no horizontal overflow here

    // Top section: weapon choices list (scrollable if needed)
    const listSection = document.createElement('div');
    listSection.style.display = 'flex';
    listSection.style.flexDirection = 'column';
    listSection.style.alignItems = 'center';
    listSection.style.gap = '10px';
    listSection.style.width = '100%';
    listSection.style.flex = '1 1 auto'; // grow to fill, allow scroll
    listSection.style.overflowY = 'auto';
    listSection.style.overflowX = 'hidden'; // Explicitly hide horizontal scroll for the list

    // Bottom section: actions
    const actionsSection = document.createElement('div');
    actionsSection.style.display = 'flex';
    actionsSection.style.flex = '0 0 auto';
    actionsSection.style.justifyContent = 'center';
    actionsSection.style.paddingTop = '6px';
    actionsSection.style.flexDirection = 'column'; // stack buttons vertically
    actionsSection.style.alignItems = 'center';    // center them

    // Create weapon selection buttons (including basic)
    // Swapped order: Bow before Unarmed
    const weaponTypes = [
        { type: 'basic', weapon: Basic, name: 'Basic' },
        { type: 'sword', weapon: Sword, name: 'Sword' },
        { type: 'dagger', weapon: Dagger, name: 'Dagger' },
        { type: 'spear', weapon: Spear, name: 'Spear' },
        { type: 'bow', weapon: Bow, name: 'Bow' },
        { type: 'staff', weapon: Staff, name: 'Staff' },
        { type: 'scythe', weapon: Scythe, name: 'Scythe' },   // NEW
        { type: 'shield', weapon: Shield, name: 'Shield' },   // NEW
        { type: 'shuriken', weapon: Shuriken, name: 'Shuriken' },
        { type: 'unarmed', weapon: Unarmed, name: 'Unarmed' },
        { type: 'wrench', weapon: Wrench, name: 'Wrench' },   // Wrench before Hammer/Katana
        { type: 'hammer', weapon: Hammer, name: 'Hammer' },   // Move under Wrench
        { type: 'katana', weapon: Katana, name: 'Katana' },   // Move under Hammer
        { type: 'pickaxe', weapon: Pickaxe, name: 'Pickaxe' }, // NEW
        { type: 'bomb', weapon: Bomb, name: 'Bomb' }, // NEW
        { type: 'bat', weapon: Bat, name: 'Bat' } // NEW: Bat in Teams
    ];

    // Keep references to displays by type for reliable counter updates
    const displaysByType = {};

    weaponTypes.forEach(weaponType => {
        // Create container for weapon display and buttons
        const weaponItemContainer = document.createElement('div');
        weaponItemContainer.style.display = 'flex';
        weaponItemContainer.style.flexDirection = 'column';
        weaponItemContainer.style.alignItems = 'center';
        weaponItemContainer.style.gap = '8px';
        weaponItemContainer.style.width = '100%';

        const weaponDisplay = document.createElement('div');
        weaponDisplay.className = 'weapon-display';
        weaponDisplay.style.position = 'relative';
        weaponDisplay.style.backgroundColor = weaponType.weapon.color;

        const icon = document.createElement('img');
        icon.src = weaponType.weapon.icon;
        icon.alt = weaponType.name;
        icon.style.width = '60px';   // Same as classic
        icon.style.height = '60px';  // Same as classic
        icon.style.imageRendering = 'pixelated';
        weaponDisplay.appendChild(icon);

        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '8px';
        buttonsContainer.style.alignItems = 'center';

        // Create count display
        const countDisplay = document.createElement('span');
        countDisplay.style.fontSize = '18px';
        countDisplay.style.fontFamily = 'Anton, sans-serif';
        countDisplay.style.color = 'white';
        countDisplay.style.minWidth = '20px';
        countDisplay.style.textAlign = 'center';
        countDisplay.style.textShadow = '-2px -2px 0 black, 2px -2px 0 black, -2px 2px 0 black, 2px 2px 0 black, 4px 4px 6px rgba(0,0,0,0.4)';
        countDisplay.textContent = '0';

        // Create minus button
        const minusButton = document.createElement('button');
        minusButton.textContent = '-';
        minusButton.style.width = '24px';
        minusButton.style.height = '24px';
        minusButton.style.fontSize = '16px';
        minusButton.style.fontWeight = 'bold';
        minusButton.style.backgroundColor = '#f44336';
        minusButton.style.color = 'white';
        minusButton.style.border = '2px solid black';
        minusButton.style.borderRadius = '4px';
        minusButton.style.cursor = 'pointer';
        minusButton.style.fontFamily = 'Arial, sans-serif'; // Changed to Arial
        minusButton.style.display = 'flex';
        minusButton.style.alignItems = 'center';
        minusButton.style.justifyContent = 'center';
        minusButton.style.padding = '0';

        // Create plus button
        const plusButton = document.createElement('button');
        plusButton.textContent = '+';
        plusButton.style.width = '24px';
        plusButton.style.height = '24px';
        plusButton.style.fontSize = '16px';
        plusButton.style.fontWeight = 'bold';
        plusButton.style.backgroundColor = '#4CAF50';
        plusButton.style.color = 'white';
        plusButton.style.border = '2px solid black';
        plusButton.style.borderRadius = '4px';
        plusButton.style.cursor = 'pointer';
        plusButton.style.fontFamily = 'Arial, sans-serif'; // Changed to Arial
        plusButton.style.display = 'flex';
        plusButton.style.alignItems = 'center';
        plusButton.style.justifyContent = 'center';
        plusButton.style.padding = '0';

        // Add event listeners
        plusButton.addEventListener('click', async () => {
            await playClickSound();
            if (selectedBalls.length < 200) {
                selectedBalls.push({ type: weaponType.type, color: weaponType.weapon.color, name: weaponType.name });
                updateWeaponCounters();
                resetGameCallback();
            }
        });

        minusButton.addEventListener('click', async () => {
            await playClickSound();
            const index = selectedBalls.findIndex(ball => ball.type === weaponType.type);
            if (index !== -1) {
                selectedBalls.splice(index, 1);
                updateWeaponCounters();
                resetGameCallback();
            }
        });

        // Assemble buttons container
        buttonsContainer.appendChild(minusButton);
        buttonsContainer.appendChild(countDisplay);
        buttonsContainer.appendChild(plusButton);

        // Assemble weapon item
        weaponItemContainer.appendChild(weaponDisplay);
        weaponItemContainer.appendChild(buttonsContainer);

        displaysByType[weaponType.type] = { display: weaponDisplay, counter: countDisplay };
        listSection.appendChild(weaponItemContainer);
    });

    // Clear button (moved to the bottom actions section, text black)
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear All';
    clearButton.className = 'ffa-clear-btn'; // Use a class for styling

    clearButton.addEventListener('click', async () => {
        await playClickSound();
        selectedBalls = [];
        updateWeaponCounters();
        resetGameCallback();
    });

    actionsSection.appendChild(clearButton);

    // NEW: Add All button (adds one of each weapon type up to 50 total)
    const addAllButton = document.createElement('button');
    addAllButton.textContent = 'Add All';
    addAllButton.className = 'ffa-add-btn';
    addAllButton.addEventListener('click', async () => {
        await playClickSound();
        const max = 200;
        for (const wt of weaponTypes) {
            if (selectedBalls.length >= max) break;
            selectedBalls.push({ type: wt.type, color: wt.weapon.color, name: wt.name });
        }
        updateWeaponCounters();
        resetGameCallback();
    });
    actionsSection.appendChild(addAllButton);

    // NEW: Append custom balls under pre-made with + / - controls
    (function appendCustomFFA() {
        const customs = Array.isArray(window.customWeapons) ? window.customWeapons : [];
        if (!customs.length) return;
        customs.forEach(custom => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '8px';
            wrap.style.width = '100%';

            const display = document.createElement('div');
            display.className = 'weapon-display';
            display.style.position = 'relative';
            display.style.backgroundColor = custom.color || 'white';
            const icon = document.createElement('img');
            icon.src = custom.iconUrl || '';
            icon.alt = custom.name || 'Custom';
            icon.style.width = '60px';
            icon.style.height = '60px';
            icon.style.imageRendering = 'pixelated';
            display.appendChild(icon);
            display.title = custom.name || 'Custom';

            const ctrls = document.createElement('div');
            ctrls.style.display = 'flex';
            ctrls.style.gap = '8px';
            ctrls.style.alignItems = 'center';

            const minus = document.createElement('button');
            minus.textContent = '-';
            minus.style.width = '24px';
            minus.style.height = '24px';
            minus.style.fontSize = '16px';
            minus.style.fontWeight = 'bold';
            minus.style.backgroundColor = '#f44336';
            minus.style.color = 'white';
            minus.style.border = '2px solid black';
            minus.style.borderRadius = '4px';
            minus.style.cursor = 'pointer';
            minus.style.fontFamily = 'Arial, sans-serif';
            minus.style.display = 'flex';
            minus.style.alignItems = 'center';
            minus.style.justifyContent = 'center';
            minus.style.padding = '0';

            const count = document.createElement('span');
            count.style.fontSize = '18px';
            count.style.fontFamily = 'Anton, sans-serif';
            count.style.color = 'white';
            count.style.minWidth = '20px';
            count.style.textAlign = 'center';
            count.style.textShadow = '-2px -2px 0 black, 2px -2px 0 black, -2px 2px 0 black, 2px 2px 0 black, 4px 4px 6px rgba(0,0,0,0.4)';
            count.textContent = '0';

            const plus = document.createElement('button');
            plus.textContent = '+';
            plus.style.width = '24px';
            plus.style.height = '24px';
            plus.style.fontSize = '16px';
            plus.style.fontWeight = 'bold';
            plus.style.backgroundColor = '#4CAF50';
            plus.style.color = 'white';
            plus.style.border = '2px solid black';
            plus.style.borderRadius = '4px';
            plus.style.cursor = 'pointer';
            plus.style.fontFamily = 'Arial, sans-serif';
            plus.style.display = 'flex';
            plus.style.alignItems = 'center';
            plus.style.justifyContent = 'center';
            plus.style.padding = '0';

            const updateCount = () => {
                const typeStr = `custom:${custom.id}`;
                const n = selectedBalls.filter(b => b.type === typeStr).length;
                count.textContent = String(n);
            };

            plus.addEventListener('click', async () => {
                await playClickSound();
                if (selectedBalls.length < 200) {
                    const typeStr = `custom:${custom.id}`;
                    selectedBalls.push({ type: typeStr, color: custom.color || 'white', name: custom.name || 'Custom' });
                    updateCount();
                    resetGameCallback();
                }
            });
            minus.addEventListener('click', async () => {
                await playClickSound();
                const typeStr = `custom:${custom.id}`;
                const idx = selectedBalls.findIndex(b => b.type === typeStr);
                if (idx !== -1) {
                    selectedBalls.splice(idx, 1);
                    updateCount();
                    resetGameCallback();
                }
            });

            ctrls.appendChild(minus);
            ctrls.appendChild(count);
            ctrls.appendChild(plus);

            wrap.appendChild(display);
            wrap.appendChild(ctrls);
            listSection.appendChild(wrap);
            updateCount();
        });
    })();

    // Assemble sections
    weaponContainer.appendChild(listSection);
    weaponContainer.appendChild(actionsSection);
    leftSelectionBox.appendChild(weaponContainer);

    function updateWeaponCounters() {
        const counters = {};
        selectedBalls.forEach(ball => {
            counters[ball.type] = (counters[ball.type] || 0) + 1;
        });

        weaponTypes.forEach(weaponType => {
            const { counter } = displaysByType[weaponType.type];
            const count = counters[weaponType.type] || 0;
            counter.textContent = count;
        });
    }

    // Call update to reflect the current state of selectedBalls on setup
    updateWeaponCounters();
}

export function setupTeamsBallSelection(resetGameCallback) {
    const leftSelectionBox = document.getElementById('selection-box-left');
    const rightSelectionBox = document.getElementById('selection-box-right');
    
    // Setup left team (blue)
    setupTeamSidebar(leftSelectionBox, 'blue', resetGameCallback);
    
    // Setup right team (red)
    setupTeamSidebar(rightSelectionBox, 'red', resetGameCallback);
}

function setupTeamSidebar(selectionBox, teamColor, resetGameCallback) {
    selectionBox.innerHTML = ''; // Clear existing content

    const weaponContainer = document.createElement('div');
    weaponContainer.className = 'weapon-container';
    weaponContainer.style.display = 'flex';
    weaponContainer.style.flexDirection = 'column';
    weaponContainer.style.alignItems = 'stretch';
    weaponContainer.style.gap = '10px';
    weaponContainer.style.width = '100%';
    weaponContainer.style.height = '100%';
    weaponContainer.style.overflowX = 'hidden';

    // Top section: weapon choices list (scrollable if needed)
    const listSection = document.createElement('div');
    listSection.style.display = 'flex';
    listSection.style.flexDirection = 'column';
    listSection.style.alignItems = 'center';
    listSection.style.gap = '10px';
    listSection.style.width = '100%';
    listSection.style.flex = '1 1 auto';
    listSection.style.overflowY = 'auto';
    listSection.style.overflowX = 'hidden';

    // Bottom section: actions
    const actionsSection = document.createElement('div');
    actionsSection.style.display = 'flex';
    actionsSection.style.flex = '0 0 auto';
    actionsSection.style.justifyContent = 'center';
    actionsSection.style.paddingTop = '6px';
    actionsSection.style.flexDirection = 'column'; // stack buttons vertically
    actionsSection.style.alignItems = 'center';    // center them

    // Create weapon selection buttons (including basic)
    // Swapped order: Bow before Unarmed
    const weaponTypes = [
        { type: 'basic', weapon: Basic, name: 'Basic' },
        { type: 'sword', weapon: Sword, name: 'Sword' },
        { type: 'dagger', weapon: Dagger, name: 'Dagger' },
        { type: 'spear', weapon: Spear, name: 'Spear' },
        { type: 'bow', weapon: Bow, name: 'Bow' },
        { type: 'staff', weapon: Staff, name: 'Staff' },
        { type: 'scythe', weapon: Scythe, name: 'Scythe' },
        { type: 'shield', weapon: Shield, name: 'Shield' },
        { type: 'shuriken', weapon: Shuriken, name: 'Shuriken' },
        { type: 'unarmed', weapon: Unarmed, name: 'Unarmed' },
        { type: 'wrench', weapon: Wrench, name: 'Wrench' },
        { type: 'hammer', weapon: Hammer, name: 'Hammer' },
        { type: 'katana', weapon: Katana, name: 'Katana' },
        { type: 'pickaxe', weapon: Pickaxe, name: 'Pickaxe' },
        { type: 'bomb', weapon: Bomb, name: 'Bomb' },
        { type: 'bat', weapon: Bat, name: 'Bat' } // NEW: Bat in Teams
    ];
    // Teams mode: allow Scepter for both teams; Boss mode uses a separate right-side picker
    weaponTypes.push({ type: 'scepter', weapon: Scepter, name: 'Scepter' });

    const displaysByType = {};
    const teamBgColor = teamColor === 'blue' ? '#2196f3' : '#f44336';

    weaponTypes.forEach(weaponType => {
        // Create container for weapon display and buttons
        const weaponItemContainer = document.createElement('div');
        weaponItemContainer.style.display = 'flex';
        weaponItemContainer.style.flexDirection = 'column';
        weaponItemContainer.style.alignItems = 'center';
        weaponItemContainer.style.gap = '8px';
        weaponItemContainer.style.width = '100%';

        const weaponDisplay = document.createElement('div');
        weaponDisplay.className = 'weapon-display';
        weaponDisplay.style.position = 'relative';
        weaponDisplay.style.backgroundColor = teamBgColor; // Always team color

        const icon = document.createElement('img');
        icon.src = weaponType.weapon.icon;
        icon.alt = weaponType.name;
        icon.style.width = '60px';   // Same as classic
        icon.style.height = '60px';  // Same as classic
        icon.style.imageRendering = 'pixelated';
        weaponDisplay.appendChild(icon);

        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '8px';
        buttonsContainer.style.alignItems = 'center';

        // Create count display
        const countDisplay = document.createElement('span');
        countDisplay.style.fontSize = '18px';
        countDisplay.style.fontFamily = 'Anton, sans-serif';
        countDisplay.style.color = 'white';
        countDisplay.style.minWidth = '20px';
        countDisplay.style.textAlign = 'center';
        countDisplay.style.textShadow = '-2px -2px 0 black, 2px -2px 0 black, -2px 2px 0 black, 2px 2px 0 black, 4px 4px 6px rgba(0,0,0,0.4)';
        countDisplay.textContent = '0';

        // Create minus button
        const minusButton = document.createElement('button');
        minusButton.textContent = '-';
        minusButton.style.width = '24px';
        minusButton.style.height = '24px';
        minusButton.style.fontSize = '16px';
        minusButton.style.fontWeight = 'bold';
        minusButton.style.backgroundColor = '#f44336';
        minusButton.style.color = 'white';
        minusButton.style.border = '2px solid black';
        minusButton.style.borderRadius = '4px';
        minusButton.style.cursor = 'pointer';
        minusButton.style.fontFamily = 'Arial, sans-serif';
        minusButton.style.display = 'flex';
        minusButton.style.alignItems = 'center';
        minusButton.style.justifyContent = 'center';
        minusButton.style.padding = '0';

        // Create plus button
        const plusButton = document.createElement('button');
        plusButton.textContent = '+';
        plusButton.style.width = '24px';
        plusButton.style.height = '24px';
        plusButton.style.fontSize = '16px';
        plusButton.style.fontWeight = 'bold';
        plusButton.style.backgroundColor = '#4CAF50';
        plusButton.style.color = 'white';
        plusButton.style.border = '2px solid black';
        plusButton.style.borderRadius = '4px';
        plusButton.style.cursor = 'pointer';
        plusButton.style.fontFamily = 'Arial, sans-serif';
        plusButton.style.display = 'flex';
        plusButton.style.alignItems = 'center';
        plusButton.style.justifyContent = 'center';
        plusButton.style.padding = '0';

        // Add event listeners (teams combine both team selections for now)
        plusButton.addEventListener('click', async () => {
            await playClickSound();
            if (selectedBalls.length < 200) {
                selectedBalls.push({ 
                    type: weaponType.type, 
                    color: teamBgColor, // Use team color instead of weapon color
                    name: weaponType.name,
                    team: teamColor
                });
                updateWeaponCounters();
                resetGameCallback();
            }
        });

        minusButton.addEventListener('click', async () => {
            await playClickSound();
            // Remove the last ball of this type and team
            for (let i = selectedBalls.length - 1; i >= 0; i--) {
                if (selectedBalls[i].type === weaponType.type && selectedBalls[i].team === teamColor) {
                    selectedBalls.splice(i, 1);
                    break;
                }
            }
            updateWeaponCounters();
            resetGameCallback();
        });

        // Assemble buttons container
        buttonsContainer.appendChild(minusButton);
        buttonsContainer.appendChild(countDisplay);
        buttonsContainer.appendChild(plusButton);

        // Assemble weapon item
        weaponItemContainer.appendChild(weaponDisplay);
        weaponItemContainer.appendChild(buttonsContainer);

        displaysByType[weaponType.type] = { display: weaponDisplay, counter: countDisplay };
        listSection.appendChild(weaponItemContainer);
    });

    // NEW: Append saved custom balls with + / - controls for this team
    (function appendCustomTeams() {
        const customs = Array.isArray(window.customWeapons) ? window.customWeapons : [];
        if (!customs.length) return;
        customs.forEach(custom => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '8px';
            wrap.style.width = '100%';

            const display = document.createElement('div');
            display.className = 'weapon-display';
            display.style.position = 'relative';
            display.style.backgroundColor = teamBgColor; // team color frame
            const img = document.createElement('img');
            img.src = custom.iconUrl || '';
            img.alt = custom.name || 'Custom';
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.imageRendering = 'pixelated';
            display.appendChild(img);
            display.title = custom.name || 'Custom';

            const ctrls = document.createElement('div');
            ctrls.style.display = 'flex';
            ctrls.style.gap = '8px';
            ctrls.style.alignItems = 'center';

            const minus = document.createElement('button');
            minus.textContent = '-';
            minus.style.width = '24px';
            minus.style.height = '24px';
            minus.style.fontSize = '16px';
            minus.style.fontWeight = 'bold';
            minus.style.backgroundColor = '#f44336';
            minus.style.color = 'white';
            minus.style.border = '2px solid black';
            minus.style.borderRadius = '4px';
            minus.style.cursor = 'pointer';
            minus.style.fontFamily = 'Arial, sans-serif';
            minus.style.display = 'flex';
            minus.style.alignItems = 'center';
            minus.style.justifyContent = 'center';
            minus.style.padding = '0';

            const count = document.createElement('span');
            count.style.fontSize = '18px';
            count.style.fontFamily = 'Anton, sans-serif';
            count.style.color = 'white';
            count.style.minWidth = '20px';
            count.style.textAlign = 'center';
            count.style.textShadow = '-2px -2px 0 black, 2px -2px 0 black, -2px 2px 0 black, 2px 2px 0 black, 4px 4px 6px rgba(0,0,0,0.4)';
            count.textContent = '0';

            const plus = document.createElement('button');
            plus.textContent = '+';
            plus.style.width = '24px';
            plus.style.height = '24px';
            plus.style.fontSize = '16px';
            plus.style.fontWeight = 'bold';
            plus.style.backgroundColor = '#4CAF50';
            plus.style.color = 'white';
            plus.style.border = '2px solid black';
            plus.style.borderRadius = '4px';
            plus.style.cursor = 'pointer';
            plus.style.fontFamily = 'Arial, sans-serif';
            plus.style.display = 'flex';
            plus.style.alignItems = 'center';
            plus.style.justifyContent = 'center';
            plus.style.padding = '0';

            const typeStr = `custom:${custom.id}`;
            const updateCount = () => {
                const n = selectedBalls.filter(b => b.type === typeStr && b.team === teamColor).length;
                count.textContent = String(n);
            };

            plus.addEventListener('click', async () => {
                await playClickSound();
                if (selectedBalls.length < 200) {
                    selectedBalls.push({
                        type: typeStr,
                        color: teamBgColor,
                        name: custom.name || 'Custom',
                        team: teamColor
                    });
                    updateCount();
                    resetGameCallback();
                }
            });

            minus.addEventListener('click', async () => {
                await playClickSound();
                for (let i = selectedBalls.length - 1; i >= 0; i--) {
                    if (selectedBalls[i].type === typeStr && selectedBalls[i].team === teamColor) {
                        selectedBalls.splice(i, 1);
                        break;
                    }
                }
                updateCount();
                resetGameCallback();
            });

            ctrls.appendChild(minus);
            ctrls.appendChild(count);
            ctrls.appendChild(plus);
            wrap.appendChild(display);
            wrap.appendChild(ctrls);
            listSection.appendChild(wrap);
            updateCount();
        });
    })();

    // Clear button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear All';
    clearButton.className = 'ffa-clear-btn';

    clearButton.addEventListener('click', async () => {
        await playClickSound();
        // Remove all balls of this team
        selectedBalls = selectedBalls.filter(ball => ball.team !== teamColor);
        updateWeaponCounters();
        resetGameCallback();
    });

    actionsSection.appendChild(clearButton);

    // NEW: Add All button (team-scoped)
    const addAllButton = document.createElement('button');
    addAllButton.textContent = 'Add All';
    addAllButton.className = 'ffa-add-btn';
    addAllButton.addEventListener('click', async () => {
        await playClickSound();
        const max = 200;
        for (const wt of weaponTypes) {
            if (selectedBalls.length >= max) break;
            selectedBalls.push({
                type: wt.type,
                color: teamBgColor,
                name: wt.name,
                team: teamColor
            });
        }
        updateWeaponCounters();
        resetGameCallback();
    });
    actionsSection.appendChild(addAllButton);

    // Assemble sections
    weaponContainer.appendChild(listSection);
    weaponContainer.appendChild(actionsSection);
    selectionBox.appendChild(weaponContainer);

    function updateWeaponCounters() {
        const counters = {};
        selectedBalls.forEach(ball => {
            if (ball.team === teamColor) {
                counters[ball.type] = (counters[ball.type] || 0) + 1;
            }
        });

        weaponTypes.forEach(weaponType => {
            const { counter } = displaysByType[weaponType.type];
            const count = counters[weaponType.type] || 0;
            counter.textContent = count;
        });
    }

    // Call update to reflect the current state
    updateWeaponCounters();
}

// NEW: Boss mode selection
export function setupBossBallSelection(resetGameCallback) {
    const leftSelectionBox = document.getElementById('selection-box-left');
    const rightSelectionBox = document.getElementById('selection-box-right');
    leftSelectionBox.innerHTML = '';
    rightSelectionBox.innerHTML = '';

    // Left: Blue team (multiple)
    setupTeamSidebar(leftSelectionBox, 'blue', resetGameCallback);

    // Right: Boss picker (single)
    const bossContainer = document.createElement('div');
    bossContainer.className = 'weapon-container';
    bossContainer.style.display = 'flex';
    bossContainer.style.flexDirection = 'column';
    bossContainer.style.alignItems = 'stretch';
    bossContainer.style.gap = '10px';
    bossContainer.style.width = '100%';
    bossContainer.style.height = '100%';
    bossContainer.style.overflowX = 'hidden';

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.alignItems = 'center';
    list.style.gap = '10px';
    list.style.width = '100%';
    list.style.flex = '1 1 auto';
    list.style.overflowY = 'auto';

    const weaponTypes = [
        { type: 'basic', weapon: Basic, name: 'Basic' },
        { type: 'sword', weapon: Sword, name: 'Sword' },
        { type: 'dagger', weapon: Dagger, name: 'Dagger' },
        { type: 'spear', weapon: Spear, name: 'Spear' },
        { type: 'bow', weapon: Bow, name: 'Bow' },
        { type: 'staff', weapon: Staff, name: 'Staff' },
        { type: 'scythe', weapon: Scythe, name: 'Scythe' },
        { type: 'shield', weapon: Shield, name: 'Shield' },
        { type: 'shuriken', weapon: Shuriken, name: 'Shuriken' },
        { type: 'unarmed', weapon: Unarmed, name: 'Unarmed' },
        { type: 'wrench', weapon: Wrench, name: 'Wrench' },
        { type: 'hammer', weapon: Hammer, name: 'Hammer' },
        { type: 'katana', weapon: Katana, name: 'Katana' },
        { type: 'pickaxe', weapon: Pickaxe, name: 'Pickaxe' },
        { type: 'bomb', weapon: Bomb, name: 'Bomb' },
        { type: 'bat', weapon: Bat, name: 'Bat' } // NEW: Bat in Boss picker
    ];

    let currentBossType = null;

    function setBossType(type, color) {
        // Remove existing red boss entry
        selectedBalls = selectedBalls.filter(b => b.team !== 'red');
        // Add one boss entry
        selectedBalls.push({
            type,
            color: '#f44336', // Red team frame color
            name: 'Boss',
            team: 'red'
        });
        currentBossType = type;
        resetGameCallback();
        updateSelectedHighlight();
    }

    function updateSelectedHighlight() {
        const cards = list.querySelectorAll('.weapon-display');
        cards.forEach(card => {
            if (card.dataset.type === currentBossType) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    weaponTypes.forEach(w => {
        const card = document.createElement('div');
        card.className = 'weapon-display';
        card.style.backgroundColor = '#f44336';
        card.style.cursor = 'pointer';
        card.dataset.type = w.type;

        const icon = document.createElement('img');
        icon.src = w.weapon.icon;
        icon.alt = w.name;
        icon.style.width = '60px';
        icon.style.height = '60px';
        icon.style.imageRendering = 'pixelated';

        card.appendChild(icon);
        card.addEventListener('click', async (e) => {
            // Remove explicit click sound here to avoid double-playing;
            // the global .weapon-display click handler will play it once.
            // e.stopPropagation(); // Optional: keep default so global plays it
            setBossType(w.type, '#f44336');
        });

        list.appendChild(card);
    });

    // NEW: Append saved custom balls to Boss picker (right side)
    (function appendCustomBoss() {
        const customs = Array.isArray(window.customWeapons) ? window.customWeapons : [];
        if (!customs.length) return;
        customs.forEach(custom => {
            const card = document.createElement('div');
            card.className = 'weapon-display';
            card.style.backgroundColor = '#f44336';
            card.style.cursor = 'pointer';
            card.dataset.type = `custom:${custom.id}`;

            const icon = document.createElement('img');
            icon.src = custom.iconUrl || '';
            icon.alt = custom.name || 'Custom';
            icon.style.width = '60px';
            icon.style.height = '60px';
            icon.style.imageRendering = 'pixelated';

            card.appendChild(icon);
            card.addEventListener('click', async () => {
                setBossType(`custom:${custom.id}`, '#f44336');
            });

            list.appendChild(card);
        });
    })();

    // Ensure there's always exactly one boss by default (default to Basic)
    if (!selectedBalls.some(b => b.team === 'red')) {
        setBossType('basic', '#f44336');
    } else {
        currentBossType = selectedBalls.find(b => b.team === 'red')?.type || null;
        updateSelectedHighlight();
    }

    bossContainer.appendChild(list);
    rightSelectionBox.appendChild(bossContainer);
}

export function getSelectedBalls() {
    return [...selectedBalls];
}