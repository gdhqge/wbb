import { setupAudio, areSoundsReady, playClickSound, playStartupSound } from './audio.js';
import { setupUI, resetSelections } from './ui.js';
import { DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT } from './state.js';
import { setupMenu, cleanupMenu, pauseMenu } from './menu.js';
import { setupGame, resetGame } from './game.js';
// NEW: Import refactored modules
import { setupMenuNavigation } from './menu-navigation.js';
import { setupGamemodeManagement } from './gamemode-management.js';
import { setupArenaSizing } from './arena-sizing.js';
import { setupUIState } from './ui-state.js';
import { ensureFullscreen } from './fullscreen.js'; // NEW: Fullscreen helper
import { setupCustomMap } from './maps/custom-map.js'; // NEW: Custom map overlay
// NEW: also import playMenuMusic to ensure song starts reliably when menu shows
import { playMenuMusic } from './audio.js';
// NEW: import music mute helpers
import { toggleMusicMute, isMusicMuted } from './audio.js';
import { players } from './state.js';

// NEW: import default health getters/setters
import { getDefaultHealth, setDefaultHealth, getDefaultBossHealth, setDefaultBossHealth } from './state.js';

// NEW: import current gamemode to color health rows per mode
import { getCurrentGamemode } from './gamemode-management.js';

const canvas = document.getElementById('gameCanvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingScreenText = loadingScreen.querySelector('p');
const mainMenu = document.getElementById('main-menu');
const gameContainer = document.getElementById('game-container');
const gameTitle = document.getElementById('game-title');
const playButton = document.getElementById('playButton');
const resetButton = document.getElementById('resetButton');

// Set initial display states
mainMenu.style.opacity = '0';
mainMenu.style.pointerEvents = 'none';
mainMenu.style.display = 'none';

gameContainer.style.display = 'none';
gameContainer.style.opacity = '0';

loadingScreen.style.display = 'flex';
loadingScreen.style.opacity = '1';

// NEW: load saved custom balls before any UI that reads them
try {
  const s = localStorage.getItem('wbb_custom_weapons_v1');
  window.customWeapons = s ? JSON.parse(s) : [];
} catch {
  window.customWeapons = [];
}

// NEW: Health panel wiring
let healthPanelOpen = false;
let healthRefreshTimer = null;
function buildHealthList() {
    const list = document.getElementById('healthList');
    if (!list) return;
    const iconForType = (t) => {
        if (typeof t === 'string' && t.startsWith('custom:')) {
            const id = t.split(':')[1];
            const d = (window.customWeapons || []).find(x => x.id === id);
            return d?.iconUrl || '';
        }
        const map = {
          basic: 'pixil-frame-0%20(5).png', sword: 'pixil-frame-0.png', dagger: 'dagger_icon.png',
          spear: 'spear_icon.png', bow: 'bow_icon.png', staff: 'staff_icon.png',
          scythe: 'scythe_icon.png', shuriken: 'shuriken.png', shield: 'shield_icon.png',
          wrench: 'wrench_icon.png', hammer: 'hammer_icon.png', scepter: 'scepter_icon.png',
          unarmed: 'unarmed_icon%20(2).png', katana: 'katana_icon.png', pickaxe: 'pickaxe_icon.png',
          bomb: 'bomb.png', bat: 'bat_icon.png'
        };
        return map[t] || map.basic;
    };
    // Classic: show P1 (left) and P2 (right) side-by-side
    if (players.length === 2) {
        const p1 = players[0], p2 = players[1];
        const icon1 = iconForType(p1.type);
        const icon2 = iconForType(p2.type);
        list.innerHTML = `
          <div class="health-two-col">
            <div class="health-item" data-index="0">
              <img class="icon" src="${icon1}" alt="" />
              <div class="name" style="color:${p1.color || '#000'}"></div>
              <div class="hp-label">HP</div>
              <input type="number" min="0" max="9999" step="1" value="${Math.round(p1.health)}" />
            </div>
            <div class="health-item" data-index="1">
              <img class="icon" src="${icon2}" alt="" />
              <div class="name" style="color:${p2.color || '#000'}"></div>
              <div class="hp-label">HP</div>
              <input type="number" min="0" max="9999" step="1" value="${Math.round(p2.health)}" />
            </div>
          </div>
        `;
        // NEW: color the mini frame per mode/team
        const mode = getCurrentGamemode && getCurrentGamemode();
        const teamColor = (t) => t === 'blue' ? '#2196f3' : (t === 'red' ? '#f44336' : null);
        const rows = list.querySelectorAll('.health-item');
        rows.forEach(row => {
          const idx = Number(row.getAttribute('data-index'));
          const p = players[idx];
          if (!p) return;
          const bg = (mode === 'teams' || mode === 'boss') ? (teamColor(p.team) || p.color || '#f8f8f8') : (p.color || '#f8f8f8');
          row.style.background = bg;
        });
    } else {
      const rows = players.map((p, idx) => {
          const icon = iconForType(p.type);
          const color = p.color || '#000';
          return `
            <div class="health-item" data-index="${idx}">
              <img class="icon" src="${icon}" alt="" />
              <div class="name" style="color:${color}"></div>
              <div class="hp-label">HP</div>
              <input type="number" min="0" max="9999" step="1" value="${Math.round(p.health)}" />
            </div>
          `;
      }).join('');
      list.innerHTML = rows;
      // NEW: color the mini frame per mode/team for all rows
      const mode = getCurrentGamemode && getCurrentGamemode();
      const teamColor = (t) => t === 'blue' ? '#2196f3' : (t === 'red' ? '#f44336' : null);
      list.querySelectorAll('.health-item').forEach(row => {
        const idx = Number(row.getAttribute('data-index'));
        const p = players[idx];
        if (!p) return;
        const bg = (mode === 'teams' || mode === 'boss') ? (teamColor(p.team) || p.color || '#f8f8f8') : (p.color || '#f8f8f8');
        row.style.background = bg;
      });
    }

    // Preserve scroll and skip rebuild if user is editing an input
    const panel = document.getElementById('health-panel');
    const activeEl = document.activeElement;
    if (panel && activeEl && panel.contains(activeEl) && activeEl.tagName === 'INPUT') return;
    const prevScroll = list.scrollTop;

    // Attach handlers
    list.querySelectorAll('.health-item').forEach(row => {
        const idx = parseInt(row.getAttribute('data-index'), 10);
        const input = row.querySelector('input[type="number"]');
        input.addEventListener('input', () => {
            const val = Math.max(0, Math.min(9999, Number(input.value) || 0));
            if (players[idx]) {
                players[idx].health = val;
            }
        });
    });

    // NEW: Defaults area under the mini icon frames
    const showBossDefault = players.some(p => p.isBoss);
    const defaultsHTML = `
      <div class="health-defaults" style="margin-top:10px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
        <label style="font-family:'Anton',sans-serif; color:#fff; text-shadow:-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;">Default health:</label>
        <input id="defaultHealthInput" type="number" min="0" max="9999" step="1" value="${getDefaultHealth()}" style="width:90px; padding:4px 6px; border:2px solid #000; border-radius:6px; font-family:'Noto Sans', Arial, sans-serif;"/>
        ${showBossDefault ? `
          <label style="font-family:'Anton',sans-serif; color:#fff; text-shadow:-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;">Default boss health:</label>
          <input id="defaultBossHealthInput" type="number" min="0" max="999999" step="1" value="${getDefaultBossHealth()}" style="width:110px; padding:4px 6px; border:2px solid #000; border-radius:6px; font-family:'Noto Sans', Arial, sans-serif;"/>
        ` : ``}
      </div>
    `;
    // Append (keep existing items)
    list.insertAdjacentHTML('beforeend', defaultsHTML);

    const defH = document.getElementById('defaultHealthInput');
    defH && defH.addEventListener('input', () => setDefaultHealth(defH.value));
    const defBH = document.getElementById('defaultBossHealthInput');
    defBH && defBH.addEventListener('input', () => setDefaultBossHealth(defBH.value));

    // Restore scroll
    list.scrollTop = prevScroll;
}

function openHealthPanel() {
    const panel = document.getElementById('health-panel');
    if (!panel) return;
    healthPanelOpen = true;
    panel.style.display = 'flex';
    buildHealthList();
    // Keep list in sync while open (e.g., resets or mode changes)
    if (healthRefreshTimer) clearInterval(healthRefreshTimer);
    healthRefreshTimer = setInterval(() => {
        if (!healthPanelOpen) return;
        // Skip auto-rebuild if an input is focused to prevent deselection
        const activeEl = document.activeElement;
        if (panel && activeEl && panel.contains(activeEl) && activeEl.tagName === 'INPUT') return;
        buildHealthList();
    }, 1000);
}

function closeHealthPanel() {
    const panel = document.getElementById('health-panel');
    if (!panel) return;
    healthPanelOpen = false;
    panel.style.display = 'none';
    if (healthRefreshTimer) {
        clearInterval(healthRefreshTimer);
        healthRefreshTimer = null;
    }
}

document.addEventListener('click', async (event) => {
    // Attempt to enter fullscreen on first user interaction
    ensureFullscreen(); // NEW: best-effort fullscreen entry

    if (!areSoundsReady()) {
        return; 
    }
    const target = event.target;
    if (target.closest('.weapon-display')) {
        await playClickSound();
    }
});

function onAudioLoadingStateChange(isLoadingState) {
    if (isLoadingState) {
        loadingScreenText.textContent = 'Loading Game...';
    } else {
        if (areSoundsReady()) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.pointerEvents = 'none';
            loadingScreen.style.display = 'none';
            
            mainMenu.style.display = 'flex';
            requestAnimationFrame(() => {
                mainMenu.style.opacity = '1';
                mainMenu.style.pointerEvents = 'auto';
            });
            setupMenu(mainMenu, gameTitle);
            // NEW: Start menu music immediately after menu becomes visible (extra safety)
            // This complements setupMenu's own attempt and helps with timing/autoplay edge cases.
            playMenuMusic();
        } else {
            loadingScreenText.textContent = 'Failed to load assets. Please refresh.';
            loadingScreenText.style.color = 'red';
        }
    }
}

// Initial Setup
setupUI(() => resetGame(canvas.width, canvas.height));
setupGame({
    canvas,
    playButton,
    resetButton,
    gameContainer
});

// NEW: Setup refactored modules
setupMenuNavigation();
setupGamemodeManagement();
setupArenaSizing();
setupUIState();

// NEW: Initialize Custom Map overlay controller
setupCustomMap();

// NEW: wire up music mute button
const musicMuteBtn = document.getElementById('musicMuteButton');
if (musicMuteBtn) {
    const syncLabel = () => {
        musicMuteBtn.textContent = isMusicMuted() ? 'Unmute Music' : 'Mute Music';
    };
    syncLabel();
    musicMuteBtn.addEventListener('click', async () => {
        await playClickSound();
        toggleMusicMute();
        syncLabel();
    });
}

// NEW: wire up health button and close action
const healthBtn = document.getElementById('healthButton');
const healthCloseBtn = document.getElementById('healthCloseButton');
if (healthBtn) {
    healthBtn.addEventListener('click', async () => {
        await playClickSound();
        openHealthPanel();
    });
}
if (healthCloseBtn) {
    healthCloseBtn.textContent = 'x';
    healthCloseBtn.addEventListener('click', async () => {
        await playClickSound();
        closeHealthPanel();
    });
}

setupAudio(onAudioLoadingStateChange);