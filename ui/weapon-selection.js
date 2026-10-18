import { Sword, Dagger, Spear } from '../weapon.js';
import { Unarmed } from '../weapon.js';
import { Basic } from '../weapon.js';
import { Bow } from '../weapon.js';
import { Scythe } from '../weapon.js'; // NEW: Scythe
import { Shield } from '../weapon.js'; // NEW: Shield
import { Wrench } from '../weapon.js'; // NEW: Wrench
import { Hammer } from '../weapon.js'; // NEW: Hammer
import { Katana } from '../weapon.js'; // NEW: Katana
import { Pickaxe } from '../weapon.js'; // NEW: Pickaxe
import { Bomb } from '../weapon.js'; // NEW: Bomb
import { Bat } from '../weapon.js';

export async function createWeaponDisplay(weaponType) {
    const display = document.createElement('div');
    display.className = 'weapon-display';
    
    let icon, color;
    switch(weaponType) {
        case 'basic':
            icon = Basic.icon;
            color = Basic.color;
            break;
        case 'sword':
            icon = Sword.icon;
            color = Sword.color;
            break;
        case 'dagger':
            icon = Dagger.icon;
            color = Dagger.color;
            break;
        case 'spear':
            icon = Spear.icon;
            color = Spear.color;
            break;
        case 'unarmed':
            icon = Unarmed.icon;
            color = Unarmed.color;
            break;
        case 'bow':
            icon = Bow.icon;
            color = Bow.color;
            break;
        case 'staff': {
            const mod = await import('../weapon.js');
            icon = mod.Staff.icon;
            color = mod.Staff.color;
            break;
        }
        case 'scythe':
            icon = Scythe.icon;
            color = Scythe.color;
            break;
        case 'shuriken': {
            const mod = await import('../weapon.js');
            icon = mod.Shuriken.icon;
            color = mod.Shuriken.color;
            break;
        }
        case 'shield':
            icon = Shield.icon;
            color = Shield.color;
            break;
        case 'wrench': {
            const mod = await import('../weapon.js');
            icon = mod.Wrench.icon;
            color = mod.Wrench.color;
            break;
        }
        case 'hammer': {
            icon = Hammer.icon;
            color = Hammer.color;
            break;
        }
        case 'katana': {
            icon = Katana.icon;
            color = Katana.color;
            break;
        }
        case 'pickaxe': {
            icon = Pickaxe.icon;
            color = Pickaxe.color;
            break;
        }
        case 'bomb': {
            const mod = await import('../weapon.js');
            icon = mod.Bomb.icon;
            color = mod.Bomb.color;
            break;
        }
        case 'bat':
            icon = Bat.icon;
            color = Bat.color;
            break;
    }
    
    if (icon) {
        display.innerHTML = `<img src="${icon}" alt="${weaponType}" style="width: 60px; height: 60px;">`;
        display.style.backgroundColor = color;
    }
    
    return display;
}

export function setupClassicWeaponSelection(leftSelectionBox, rightSelectionBox, player1State, player2State, updateCallback, resetCallback) {
    // Clear existing content to prevent duplicate weapon icons if called multiple times
    leftSelectionBox.innerHTML = '';
    rightSelectionBox.innerHTML = '';

    const leftWeaponContainer = document.createElement('div');
    leftWeaponContainer.className = 'weapon-container';

    const rightWeaponContainer = document.createElement('div');
    rightWeaponContainer.className = 'weapon-container';

    // Order: ... bow, scythe, shield, shuriken, unarmed
    const weapons = ['basic', 'sword', 'dagger', 'spear', 'bow', 'staff', 'scythe', 'shield', 'shuriken', 'unarmed', 'wrench', 'hammer', 'katana', 'pickaxe', 'bomb', 'bat'];
    let leftSelectedType = player1State.type; 
    let rightSelectedType = player2State.type; 
    
    const leftDisplays = {};
    const rightDisplays = {};

    // Helper to build a display and wire handlers
    const buildDisplay = async (weaponType, side) => {
        const el = await createWeaponDisplay(weaponType);
        if (side === 'left') {
            leftDisplays[weaponType] = el;
            if (leftSelectedType === weaponType) el.classList.add('selected');
            el.addEventListener('click', async () => {
                leftSelectedType = weaponType;
                player1State.type = weaponType;
                switch(weaponType) {
                    case 'basic': player1State.color = Basic.color; break;
                    case 'sword': player1State.color = Sword.color; break;
                    case 'dagger': player1State.color = Dagger.color; break;
                    case 'spear': player1State.color = Spear.color; break;
                    case 'unarmed': player1State.color = Unarmed.color; break;
                    case 'bow': player1State.color = Bow.color; break;
                    case 'staff': { const m = await import('../weapon.js'); player1State.color = m.Staff.color; break; }
                    case 'scythe': player1State.color = Scythe.color; break;
                    case 'shuriken': {
                        const mod = await import('../weapon.js');
                        player1State.color = mod.Shuriken.color;
                        break;
                    }
                    case 'shield': player1State.color = Shield.color; break;
                    case 'wrench': player1State.color = Wrench.color; break;
                    case 'hammer': player1State.color = Hammer.color; break;
                    case 'katana': player1State.color = Katana.color; break;
                    case 'pickaxe': player1State.color = Pickaxe.color; break;
                    case 'bomb': { const m = await import('../weapon.js'); player1State.color = m.Bomb.color; break; }
                    case 'bat': player1State.color = Bat.color; break;
                }
                el.classList.add('selected');
                Object.values(leftDisplays).forEach(d => {
                    if (d !== el) d.classList.remove('selected');
                });
                updateCallback(player1State, player2State);
                resetCallback();
            });
        } else {
            rightDisplays[weaponType] = el;
            if (rightSelectedType === weaponType) el.classList.add('selected');
            el.addEventListener('click', async () => {
                rightSelectedType = weaponType;
                player2State.type = weaponType;
                switch(weaponType) {
                    case 'basic': player2State.color = Basic.color; break;
                    case 'sword': player2State.color = Sword.color; break;
                    case 'dagger': player2State.color = Dagger.color; break;
                    case 'spear': player2State.color = Spear.color; break;
                    case 'unarmed': player2State.color = Unarmed.color; break;
                    case 'bow': player2State.color = Bow.color; break;
                    case 'staff': { const m = await import('../weapon.js'); player2State.color = m.Staff.color; break; }
                    case 'scythe': player2State.color = Scythe.color; break;
                    case 'shuriken': {
                        const mod = await import('../weapon.js');
                        player2State.color = mod.Shuriken.color;
                        break;
                    }
                    case 'shield': player2State.color = Shield.color; break;
                    case 'wrench': player2State.color = Wrench.color; break;
                    case 'hammer': player2State.color = Hammer.color; break;
                    case 'katana': player2State.color = Katana.color; break;
                    case 'pickaxe': player2State.color = Pickaxe.color; break;
                    case 'bomb': { const m = await import('../weapon.js'); player2State.color = m.Bomb.color; break; }
                    case 'bat': player2State.color = Bat.color; break;
                }
                el.classList.add('selected');
                Object.values(rightDisplays).forEach(d => {
                    if (d !== el) d.classList.remove('selected');
                });
                updateCallback(player1State, player2State);
                resetCallback();
            });
        }
        return el;
    };

    // Build displays sequentially to preserve order
    (async () => {
        for (const wt of weapons) {
            const lEl = await buildDisplay(wt, 'left');
            leftWeaponContainer.appendChild(lEl);

            const rEl = await buildDisplay(wt, 'right');
            rightWeaponContainer.appendChild(rEl);
        }
        // NEW: append saved custom balls below pre-made weapons (as Basic variants)
        const customs = Array.isArray(window.customWeapons) ? window.customWeapons : [];
        customs.forEach(custom => {
            const mkEl = (side) => {
                const el = document.createElement('div');
                el.className = 'weapon-display';
                el.style.backgroundColor = custom.color || 'white';
                const img = document.createElement('img');
                img.src = custom.iconUrl || '';
                img.alt = custom.name || 'Custom';
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.imageRendering = 'pixelated';
                el.appendChild(img);
                el.title = custom.name || 'Custom';
                el.addEventListener('click', async () => {
                    const customType = `custom:${custom.id}`;
                    if (side === 'left') {
                        player1State.type = customType;
                        player1State.color = custom.color || 'white';
                    } else {
                        player2State.type = customType;
                        player2State.color = custom.color || 'white';
                    }
                    if (side === 'left') {
                        Object.values(leftDisplays).forEach(d => d.classList && d.classList.remove('selected'));
                    } else {
                        Object.values(rightDisplays).forEach(d => d.classList && d.classList.remove('selected'));
                    }
                    el.classList.add('selected');
                    updateCallback(player1State, player2State);
                    resetCallback();
                });
                return el;
            };
            leftWeaponContainer.appendChild(mkEl('left'));
            rightWeaponContainer.appendChild(mkEl('right'));
        });
    })();

    leftSelectionBox.appendChild(leftWeaponContainer);
    rightSelectionBox.appendChild(rightWeaponContainer);
}