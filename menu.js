import { Player } from './player.js';
import { Sword, Dagger, Spear, Bow, Shuriken, Scythe, Shield, Wrench, Hammer, Staff, Katana, Scepter, Pickaxe, Bomb, Bat } from './weapon.js';
import { handleCollision } from './collision.js';
import { playMenuMusic, fadeMenuMusicOut } from './audio.js';
// NEW: import SFX mute toggle
import { setSfxMuted } from './audio.js';

let menuBalls = [];
let menuAnimationId = null;
let menuCanvas = null;
let menuCtx = null;
let rainbowAnimationFrameId = null;
let hue = 0;
let gameTitleElement = null;
let mainMenuElement = null;
let menuPaused = false;
// NEW: throttle menu rendering to ~30fps
let _menuLastFrame = 0;

function menuAnimationLoop() {
    if (!menuCtx || !menuCanvas || menuPaused) return;

    // NEW: simple 30fps throttle
    const now = (performance && performance.now) ? performance.now() : Date.now();
    if (now - _menuLastFrame < 33) {
        menuAnimationId = requestAnimationFrame(menuAnimationLoop);
        return;
    }
    _menuLastFrame = now;

    // OPTIMIZED: use a single fillRect without changing state frequently
    menuCtx.fillStyle = '#fff4ec';
    menuCtx.fillRect(0, 0, menuCanvas.width, menuCanvas.height);

    // Tight for-loops for better JIT
    for (let i = 0; i < menuBalls.length; i++) {
        const ball = menuBalls[i];
        ball.update(menuCanvas.width, menuCanvas.height, true, false); 
        ball.drawWeapon(menuCtx);
        ball.draw(menuCtx);
    }

    const dummyGameOver = () => {};
    for (let i = 0; i < menuBalls.length; i++) {
        for (let j = i + 1; j < menuBalls.length; j++) {
            handleCollision(menuBalls[i], menuBalls[j], dummyGameOver, [menuBalls[i], menuBalls[j]], true);
        }
    }

    // OPTIMIZED: compact in place instead of filter
    let write = 0;
    for (let read = 0; read < menuBalls.length; read++) {
        const b = menuBalls[read];
        if (b.isAlive || b.fragments.length > 0) {
            menuBalls[write++] = b;
        }
    }
    if (write !== menuBalls.length) menuBalls.length = write;

    if (menuBalls.length === 0) {
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * (menuCanvas.width - 100) + 50;
            const y = Math.random() * (menuCanvas.height - 100) + 50;
            const radius = 35;
            const types = ['basic', 'sword', 'dagger', 'spear', 'unarmed', 'bow', 'staff', 'scythe', 'shield', 'shuriken', 'wrench', 'hammer', 'katana', 'pickaxe', 'bomb', 'bat'];
            const type = types[(Math.random() * types.length) | 0];
            let color;
            if (type === 'sword') color = Sword.color;
            else if (type === 'dagger') color = Dagger.color;
            else if (type === 'spear') color = Spear.color;
            else if (type === 'bow') color = Bow.color;
            else if (type === 'scythe') color = Scythe.color;
            else if (type === 'shuriken') color = Shuriken.color;
            else if (type === 'wrench') color = Wrench.color;
            else if (type === 'hammer') color = Hammer.color;
            else if (type === 'staff') color = Staff.color;
            else if (type === 'katana') color = Katana.color; // NEW: Katana color
            else if (type === 'bomb') color = Bomb.color;
            else if (type === 'bat') color = Bat.color;
            else color = 'white';

            const speed = 4; 
            const angle = Math.random() * 2 * Math.PI;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            const ball = new Player(x, y, radius, color, vx, vy, type);
            ball.weapon.spinDirection = Math.random() > 0.5 ? 1 : -1;
            if (type === 'spear') {
                ball.weapon.spearLength = 0.7 + Math.random() * 0.5;
            }
            menuBalls.push(ball);
        }
    }

    menuAnimationId = requestAnimationFrame(menuAnimationLoop);
}

function animateRainbowTitle() {
    if (!gameTitleElement) return;
    hue = (hue + 1) % 360;
    gameTitleElement.style.color = `hsl(${hue}, 100%, 50%)`;
    rainbowAnimationFrameId = requestAnimationFrame(animateRainbowTitle);
}

function startRainbowAnimation() {
    if (!rainbowAnimationFrameId) {
        animateRainbowTitle();
    }
}

function stopRainbowAnimation() {
    if (rainbowAnimationFrameId) {
        cancelAnimationFrame(rainbowAnimationFrameId);
        rainbowAnimationFrameId = null;
    }
}

export function setupMenu(mainMenu, gameTitle) {
    mainMenuElement = mainMenu;
    gameTitleElement = gameTitle;

    menuCanvas = document.createElement('canvas');
    menuCanvas.id = 'menu-background-canvas';
    menuCanvas.width = window.innerWidth;
    menuCanvas.height = window.innerHeight;
    menuCtx = menuCanvas.getContext('2d');
    mainMenuElement.appendChild(menuCanvas);
    
    const numBalls = 10;
    menuBalls = [];
    for (let i = 0; i < numBalls; i++) {
        const x = Math.random() * (menuCanvas.width - 100) + 50;
        const y = Math.random() * (menuCanvas.height - 100) + 50;
        const radius = 35;
        const types = ['basic', 'sword', 'dagger', 'spear', 'unarmed', 'bow', 'staff', 'scythe', 'shield', 'shuriken', 'wrench', 'hammer', 'katana', 'pickaxe', 'bomb', 'bat'];
        const type = types[(Math.random() * types.length) | 0];
        let color;
        if (type === 'sword') color = Sword.color;
        else if (type === 'dagger') color = Dagger.color;
        else if (type === 'spear') color = Spear.color;
        else if (type === 'bow') color = Bow.color;
        else if (type === 'scythe') color = Scythe.color;
        else if (type === 'shuriken') color = Shuriken.color;
        else if (type === 'wrench') color = Wrench.color;
        else if (type === 'hammer') color = Hammer.color;
        else if (type === 'staff') color = Staff.color;
        else if (type === 'katana') color = Katana.color; // NEW: Katana color
        else if (type === 'bomb') color = Bomb.color;
        else if (type === 'bat') color = Bat.color;
        else color = 'white';
        
        const speed = 4; 
        const angle = Math.random() * 2 * Math.PI;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        const ball = new Player(x, y, radius, color, vx, vy, type);
        
        ball.weapon.spinDirection = Math.random() > 0.5 ? 1 : -1;
        if (type === 'spear') {
            ball.weapon.spearLength = 0.7 + Math.random() * 0.5;
        }
        
        menuBalls.push(ball);
    }
    
    menuAnimationLoop();
    startRainbowAnimation();

    // NEW: attempt to start menu music immediately with fade-in
    // If autoplay is blocked, the fallback listeners below will retry on first interaction.
    playMenuMusic();

    // NEW: start menu music on the earliest possible user interaction (fallback)
    const tryStartMenuMusicOnce = async () => {
        try {
            await playMenuMusic();
        } finally {
            events.forEach(ev => document.removeEventListener(ev, tryStartMenuMusicOnce, true));
        }
    };
    const events = ['pointermove', 'keydown', 'wheel', 'touchstart', 'pointerdown'];
    events.forEach(ev => document.addEventListener(ev, tryStartMenuMusicOnce, true));

    // NEW: mute all SFX while in the main menu (music continues)
    setSfxMuted(true);
}

export function pauseMenu() {
    menuPaused = true;
}

export function resumeMenu() {
    if (menuPaused) {
        menuPaused = false;
        if (!menuAnimationId) {
            menuAnimationLoop();
        }
        // Ensure menu music is playing when the menu is resumed
        playMenuMusic();
    }
}

export function cleanupMenu() {
    // NEW: unmute SFX when leaving the main menu
    setSfxMuted(false);
    fadeMenuMusicOut();
    if (menuAnimationId) {
        cancelAnimationFrame(menuAnimationId);
        menuAnimationId = null;
    }
    
    // Immediate cleanup without waiting for slide animation
    if (menuCanvas) {
        menuCanvas.remove();
        menuCanvas = null;
        menuCtx = null;
    }
    menuBalls.length = 0;
    
    stopRainbowAnimation();
}