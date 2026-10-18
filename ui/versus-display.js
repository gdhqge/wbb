import { Sword, Dagger, Spear } from '../weapon.js';
import { Unarmed } from '../weapon.js';
import { Bow } from '../weapon.js';
import { Shuriken } from '../weapon.js'; // NEW: Import Shuriken
import { Scythe } from '../weapon.js'; // NEW: Import Scythe
import { Basic } from '../weapon.js'; // NEW: Import Basic
import { Shield } from '../weapon.js'; // NEW: Import Shield
import { Wrench } from '../weapon.js'; // NEW: Import Wrench
import { Hammer } from '../weapon.js'; // NEW: Import Hammer
import { Scepter } from '../weapon.js'; // NEW: Import Scepter
import { Staff } from '../weapon.js'; // NEW: Import Staff
import { players } from '../state.js';
import { Katana } from '../weapon.js';  // NEW: Import Katana
import { Pickaxe } from '../weapon.js'; // NEW: Import Pickaxe
import { Bomb } from '../weapon.js';    // NEW: Import Bomb
import { Bat } from '../weapon.js';     // NEW: Import Bat

export function updateVersusDisplay(player1State, player2State) {
    const versusDisplay = document.getElementById('versus-display');
    versusDisplay.innerHTML = ''; // Clear previous content

    const p1Type = player1State.type;
    const p2Type = player2State.type;
    
    function createVersusElement(type, isPlayer2 = false) {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '15px';

        const text = document.createElement('span');
        text.className = 'versus-text';
        text.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        
        let icon = null;
        let weaponColor = 'white'; // Default for 'basic'

        if (type === 'sword') {
            icon = document.createElement('img');
            icon.src = Sword.icon;
            icon.alt = 'Sword Icon';
            weaponColor = Sword.color;
        } else if (type === 'dagger') {
            icon = document.createElement('img');
            icon.src = Dagger.icon;
            icon.alt = 'Dagger Icon';
            weaponColor = Dagger.color;
        } else if (type === 'spear') {
            icon = document.createElement('img');
            icon.src = Spear.icon;
            icon.alt = 'Spear Icon';
            weaponColor = Spear.color;
        } else if (type === 'unarmed') {
            icon = document.createElement('img');
            icon.src = Unarmed.icon;
            icon.alt = 'Unarmed Icon';
            weaponColor = Unarmed.color;
        } else if (type === 'bow') {
            icon = document.createElement('img');
            icon.src = Bow.icon;
            icon.alt = 'Bow Icon';
            weaponColor = Bow.color;
        } else if (type === 'staff') {
            icon = document.createElement('img');
            icon.src = Staff.icon;
            icon.alt = 'Staff Icon';
            weaponColor = Staff.color;
        } else if (type === 'katana') {
            icon = document.createElement('img');
            icon.src = Katana.icon;
            icon.alt = 'Katana Icon';
            weaponColor = Katana.color;
        } else if (type === 'pickaxe') {
            icon = document.createElement('img');
            icon.src = Pickaxe.icon;
            icon.alt = 'Pickaxe Icon';
            weaponColor = Pickaxe.color;
        } else if (type === 'scythe') {
            icon = document.createElement('img');
            icon.src = Scythe.icon;
            icon.alt = 'Scythe Icon';
            weaponColor = Scythe.color;
        } else if (type === 'shuriken') {
            icon = document.createElement('img');
            icon.src = Shuriken.icon;
            icon.alt = 'Shuriken Icon';
            weaponColor = Shuriken.color;
        } else if (type === 'basic') { // NEW: Basic now shows icon and color
            icon = document.createElement('img');
            icon.src = Basic.icon;
            icon.alt = 'Basic Icon';
            weaponColor = Basic.color;
        } else if (type === 'shield') {
            icon = document.createElement('img');
            icon.src = Shield.icon;
            icon.alt = 'Shield Icon';
            weaponColor = Shield.color;
        } else if (type === 'wrench') {
            icon = document.createElement('img');
            icon.src = Wrench.icon;
            icon.alt = 'Wrench Icon';
            weaponColor = Wrench.color;
        } else if (type === 'hammer') {
            icon = document.createElement('img');
            icon.src = Hammer.icon;
            icon.alt = 'Hammer Icon';
            weaponColor = Hammer.color;
        } else if (type === 'scepter') {
            icon = document.createElement('img');
            icon.src = Scepter.icon;
            icon.alt = 'Scepter Icon';
            weaponColor = Scepter.color;
        } else if (type === 'bomb') {
            icon = document.createElement('img');
            icon.src = Bomb.icon;
            icon.alt = 'Bomb Icon';
            weaponColor = Bomb.color;
        } else if (type === 'bat') {
            icon = document.createElement('img');
            icon.src = Bat.icon;
            icon.alt = 'Bat Icon';
            weaponColor = Bat.color;
        } else if (typeof type === 'string' && type.startsWith('custom:')) {
            const id = type.split(':')[1];
            const defs = Array.isArray(window.customWeapons) ? window.customWeapons : [];
            const def = defs.find(d => d.id === id) || {};
            icon = document.createElement('img');
            icon.src = def.iconUrl || '';
            icon.alt = def.name || 'Custom';
            weaponColor = def.color || 'white';
            // Override label to custom name
            text.textContent = def.name || 'Custom';
        }
        
        text.style.color = weaponColor; // Set color based on weapon type

        if (icon) {
            icon.className = 'versus-icon';
            if (isPlayer2) {
                icon.classList.add('flipped');
            }
        }

        if (isPlayer2) {
            if(icon) container.appendChild(icon);
            container.appendChild(text);
        } else {
            container.appendChild(text);
            if(icon) container.appendChild(icon);
        }
        
        // Assign IDs for later updates
        if (isPlayer2) {
            container.id = 'versus-p2-container';
        } else {
            container.id = 'versus-p1-container';
        }

        return container;
    }

    const p1Display = createVersusElement(p1Type);
    versusDisplay.appendChild(p1Display);

    const vsText = document.createElement('span');
    vsText.className = 'versus-text';
    vsText.id = 'vs-text'; // Add ID to target the VS text specifically
    vsText.textContent = 'VS';
    vsText.style.color = 'white'; // VS text is always white
    versusDisplay.appendChild(vsText);

    const p2Display = createVersusElement(p2Type, true);
    versusDisplay.appendChild(p2Display);
}

export function resetVersusUI() {
    const versusP1 = document.getElementById('versus-p1-container');
    const versusP2 = document.getElementById('versus-p2-container');
    const vsText = document.getElementById('vs-text'); // Get the VS text element

    if (vsText) {
        vsText.style.color = 'white'; // Reset VS text to white
    }
    
    // The player text color is now set by `updateVersusDisplay`, which is called
    // during a reset flow, so there's no need to manually reset colors here.
    // Removing the incorrect logic that forced them to white.

    // Restore each side's color to the current players' colors (if available)
    if (versusP1) {
        const textEl = versusP1.querySelector('.versus-text');
        if (textEl && players[0]) {
            textEl.style.color = players[0].color || 'white';
        }
    }
    if (versusP2) {
        const textEl = versusP2.querySelector('.versus-text');
        if (textEl && players[1]) {
            textEl.style.color = players[1].color || 'white';
        }
    }
}

export function updateLoserUI(loserSide) {
    const LOSER_COLOR = '#7C7879';
    
    if (loserSide === 'left') {
        const damageDisplay = document.getElementById('damage-display-left');
        const versusContainer = document.getElementById('versus-p1-container');
        if (damageDisplay) damageDisplay.style.color = LOSER_COLOR;
        if (versusContainer) {
            const textEl = versusContainer.querySelector('.versus-text');
            if (textEl) textEl.style.color = LOSER_COLOR;
        }
    } else if (loserSide === 'right') {
        const damageDisplay = document.getElementById('damage-display-right');
        const versusContainer = document.getElementById('versus-p2-container');
        if (damageDisplay) damageDisplay.style.color = LOSER_COLOR;
        if (versusContainer) {
            const textEl = versusContainer.querySelector('.versus-text');
            if (textEl) textEl.style.color = LOSER_COLOR;
        }
    }
}