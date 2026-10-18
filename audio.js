// Complete rewrite to properly define and export audio functions

let audioContext = null;
let soundsLoaded = false;
let isLoading = false;
const audioBuffers = {};
let menuMusicSource = null; // To store the AudioBufferSourceNode for menu music
let menuMusicGainNode = null; // To control the volume of menu music
// NEW: global SFX mute (menu-only)
let sfxMuted = false;
// NEW: track playing state to avoid duplicate sources
let menuMusicPlaying = false;
/* NEW: game music nodes */
let gameMusicSource = null;
let gameMusicGainNode = null;
let gameMusicPlaying = false;
// NEW: global music mute toggle and helpers
let musicMuted = false;
const MENU_TARGET_VOL = 0.5;
const GAME_TARGET_VOL = 0.55;

export function isMusicMuted() { return musicMuted; }
export function setMusicMuted(muted) {
    musicMuted = !!muted;
    if (!audioContext) return;
    const now = audioContext.currentTime || 0;
    try {
        if (menuMusicGainNode) {
            menuMusicGainNode.gain.cancelScheduledValues(now);
            menuMusicGainNode.gain.setValueAtTime(menuMusicGainNode.gain.value, now);
            menuMusicGainNode.gain.linearRampToValueAtTime(musicMuted ? 0 : MENU_TARGET_VOL, now + 0.2);
        }
    } catch {}
    try {
        if (gameMusicGainNode) {
            gameMusicGainNode.gain.cancelScheduledValues(now);
            gameMusicGainNode.gain.setValueAtTime(gameMusicGainNode.gain.value, now);
            gameMusicGainNode.gain.linearRampToValueAtTime(musicMuted ? 0 : GAME_TARGET_VOL, now + 0.2);
        }
    } catch {}
}
export function toggleMusicMute() { setMusicMuted(!musicMuted); }

// NEW: expose SFX mute setter for menu to toggle SFX while keeping music
export function setSfxMuted(muted) {
    sfxMuted = !!muted;
}

/**
 * Initializes the AudioContext and loads all sound files.
 * This should be called once on page load.
 * @param {Function} onStateChange - Callback to notify UI of loading state changes.
 */
export async function setupAudio(onStateChange) {
    if (isLoading || soundsLoaded) return; // Prevent multiple loading attempts
    isLoading = true;
    if (onStateChange) onStateChange(true); // Notify UI that loading has started

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load sound files
        await Promise.all([
            loadSoundFile('swordHit', '/11L-A_sword_slashing_int-1754445544888.mp3'), // Changed to the specified sword slashing sound
            loadSoundFile('parry', '/11L-A_sword_slash.-1754445653447.mp3'),
            loadSoundFile('clickSound', '/mouse-click-290204.mp3'), // Load click sound
            loadSoundFile('daggerHit', '/dagger_sfx.mp3'), // NEW: Load dagger hit sound
            loadSoundFile('spearHit', '/spear_sfx.mp3'), // Load spear hit sound
            loadSoundFile('unarmedHit', '/unarmed_sfx.mp3'), // NEW: Load unarmed hit sound
            loadSoundFile('bowHit', '/ARROWSHOOTSKELETON.mp3'), // NEW: Load bow shoot sound
            // Updated: use the requested arrow hit sound effect
            loadSoundFile('bowImpact', '/Hit6.wav'), // NEW: Bow impact sound
            // NEW: Shuriken SFX
            loadSoundFile('shurikenThrow', '/shuriken_sfx1.mp3'),
            loadSoundFile('shurikenBounce', '/shuriken_sfx2.mp3'),
            // NEW: Generic hitHurt sound for shuriken hits
            loadSoundFile('hitHurt', '/hitHurt.wav'),
            // NEW: Scythe hit SFX
            loadSoundFile('scytheHit', '/scythe_sfx.mp3'),
            // NEW: Shield hit SFX
            loadSoundFile('shieldHit', '/shield_sfx.mp3'),
            // NEW: Wrench hit SFX
            loadSoundFile('wrenchHit', '/wrench_sfx.mp3'),
            // NEW: Hammer sounds
            loadSoundFile('hammerHit', '/hammer_sfx.mp3'),
            loadSoundFile('hammerWhoosh', '/hammer_woosh.mp3'),
            // NEW: startup sound (plays on Start Game click)
            loadSoundFile('startupSound', '/Windows XP Startup.mp3'),
            // NEW: menu music
            loadSoundFile('menuSong', '/WBB_menu.mp3'),
            /* NEW: game song */
            loadSoundFile('gameSong', '/WBB_song.mp3'),
            // NEW: Staff SFX
            loadSoundFile('staffWhoosh', '/staff_whoosh.mp3'),
            loadSoundFile('staffHit', '/staff_hit.mp3'),
            // NEW: Katana slice hit SFX
            loadSoundFile('katanaHit', '/katana_sfx.mp3'),
            // NEW: Scepter heal sound
            loadSoundFile('scepterHit', '/scepter_sfx.mp3'),
            // NEW: Pickaxe hit SFX
            loadSoundFile('pickaxeHit', '/pickaxe_sfx.mp3'),
            // NEW: Bomb SFX
            loadSoundFile('bombThrow', '/bomb_throw.mp3'),
            loadSoundFile('bombExplode', '/bomb_explode.mp3'),
            loadSoundFile('batHit', '/bat_hit.mp3')
        ]);
        
        soundsLoaded = true;
    } catch (e) {
        console.error("Could not create AudioContext or load audio assets:", e);
    } finally {
        isLoading = false;
        if (onStateChange) onStateChange(false); // Notify UI that loading is complete (or failed)
    }
}

/**
 * Attempts to resume the AudioContext.
 * This should be called in response to a user gesture (e.g., a button click).
 */
export async function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log('AudioContext resumed.');
        } catch (e) {
            console.error('Failed to resume AudioContext:', e);
            throw e; // Re-throw to propagate the error
        }
    }
}

/**
 * Loads a single sound file into an AudioBuffer.
 * @param {string} name - The key to store the audio buffer under.
 * @param {string} url - The URL of the audio file.
 */
async function loadSoundFile(name, url) {
    if (!audioContext) {
        throw new Error("AudioContext not initialized before loading sound.");
    }
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    audioBuffers[name] = decoded;
}

/**
 * Plays a loaded sound from the audioBuffers.
 * Ensures AudioContext is running before playing.
 * @param {string} name - The name of the sound to play.
 * @param {number} volume - The volume level (0.0 to 1.0).
 * @returns {Promise<void>} A promise that resolves when the sound starts playing, or rejects if it fails.
 */
async function playSound(name, volume = 0.3) {
    if (!audioContext || !audioBuffers[name]) {
        console.warn(`Cannot play sound '${name}': AudioContext not ready or buffer missing.`);
        return;
    }
    // NEW: mute all SFX when sfxMuted is true, but allow menu music and startup sound
    if (sfxMuted && name !== 'menuSong' && name !== 'startupSound') {
        return;
    }

    // Always attempt to resume if suspended. This promise resolves when context is running.
    // If it's already running, resume() resolves immediately.
    try {
        await resumeAudioContext();
    } catch (e) {
        console.error(`Failed to resume AudioContext for sound '${name}':`, e);
        return; // Cannot play if resume failed
    }

    // Now context should be running
    if (audioContext.state === 'running') {
        const src = audioContext.createBufferSource();
        src.buffer = audioBuffers[name];
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume; 
        
        src.connect(gainNode);
        gainNode.connect(audioContext.destination);
        src.start(0);
        return Promise.resolve(); // Indicate successful attempt to play
    } else {
        console.warn(`AudioContext is not running after resume attempt for sound '${name}'.`);
        return Promise.reject(new Error("AudioContext not running"));
    }
}

// Lazy loader for optional sounds (e.g., scepter) so missing assets won't break setup
async function ensureOptionalSound(name, url) {
    if (!audioContext) return false;
    if (audioBuffers[name]) return true;
    try {
        await loadSoundFile(name, url);
        return true;
    } catch {
        return false;
    }
}

export async function playSwordHitSound() {
    return playSound('swordHit', 0.2); // Adjusted volume
}

export async function playParrySound() {
    return playSound('parry', 0.15); // Reduced volume
}

export async function playClickSound() {
    return playSound('clickSound', 0.2); // Reduced volume
}

// NEW: Function to play startup sound
export async function playStartupSound() {
    // Play a short, quiet startup sound when Start is pressed
    return playSound('startupSound', 0.32);
}

// NEW: Function to play dagger hit sound
export async function playDaggerHitSound() {
    return playSound('daggerHit', 0.3); // Reduced volume
}

// NEW: Function to play spear hit sound
export async function playSpearHitSound() {
    return playSound('spearHit', 0.3);
}

// NEW: Function to play unarmed hit sound
export async function playUnarmedHitSound() {
    return playSound('unarmedHit', 0.3);
}

// NEW: Function to play bow hit sound (shoot/release)
export async function playBowHitSound() {
    return playSound('bowHit', 0.3);
}

// UPDATED: Bow impact (on-hit) uses Hit6.wav
export async function playBowImpactSound() {
    return playSound('bowImpact', 0.28);
}

// NEW: Shuriken sounds
export async function playShurikenThrowSound() {
    return playSound('shurikenThrow', 0.35);
}
export async function playShurikenBounceSound() {
    // Make bounce sound much quieter
    return playSound('shurikenBounce', 0.06);
}

// NEW: Generic hit-hurt sound (used by Shuriken hits)
export async function playHitHurtSound() {
    return playSound('hitHurt', 0.28);
}

// NEW: Scythe hit sound
export async function playScytheHitSound() {
    // Increased volume for a more impactful scythe hit
    return playSound('scytheHit', 0.55);
}

// NEW: Shield hit sound
export async function playShieldHitSound() {
    return playSound('shieldHit', 0.5);
}

// NEW: Wrench hit sound
export async function playWrenchHitSound() {
    return playSound('wrenchHit', 0.22);
}

// NEW: Hammer sounds
export async function playHammerHitSound() {
    return playSound('hammerHit', 0.4);
}
export async function playHammerWhooshSound() {
    return playSound('hammerWhoosh', 0.28);
}

// NEW: Staff-specific SFX
export async function playStaffWhooshSound() {
    return playSound('staffWhoosh', 0.28);
}
export async function playStaffHitSound() {
    return playSound('staffHit', 0.32);
}

// NEW: Katana slice hit sound
export async function playKatanaHitSound() {
    return playSound('katanaHit', 0.28);
}

// NEW: Scepter heal sound (lazy-load to avoid failing if asset missing)
export async function playScepterHitSound() {
    return playSound('scepterHit', 0.35);
}

// NEW: Pickaxe hit sound
export async function playPickaxeHitSound() {
    return playSound('pickaxeHit', 0.35);
}

// NEW: Bomb sounds
export async function playBombThrowSound() {
    return playSound('bombThrow', 0.4);
}
export async function playBombExplodeSound() {
    return playSound('bombExplode', 0.22);
}
export async function playBatHitSound() {
    return playSound('batHit', 0.36);
}

/**
 * Plays the menu background music on loop.
 */
export async function playMenuMusic() {
    try {
        if (!audioContext || !audioBuffers.menuSong) return;
        await resumeAudioContext();
        // If already playing, just ensure it's faded to the right level (respect mute)
        if (menuMusicSource && menuMusicGainNode && menuMusicPlaying) {
            const target = musicMuted ? 0 : MENU_TARGET_VOL;
            const now = audioContext.currentTime;
            menuMusicGainNode.gain.cancelScheduledValues(now);
            menuMusicGainNode.gain.setValueAtTime(menuMusicGainNode.gain.value, now);
            menuMusicGainNode.gain.linearRampToValueAtTime(target, now + 1.5);
            return;
        }
        // Create fresh source + gain
        const src = audioContext.createBufferSource();
        src.buffer = audioBuffers.menuSong;
        src.loop = true;

        const gain = audioContext.createGain();
        // start at 0 then fade to target (or stay 0 if muted)
        const targetVol = musicMuted ? 0 : MENU_TARGET_VOL;
        gain.gain.value = 0;

        src.connect(gain);
        gain.connect(audioContext.destination);

        menuMusicSource = src;
        menuMusicGainNode = gain;
        menuMusicPlaying = true;

        const now = audioContext.currentTime;
        src.start(0);
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(targetVol, now + 1.5);

        src.onended = () => {
            menuMusicPlaying = false;
            try { if (menuMusicSource) menuMusicSource.disconnect(); } catch {}
            try { if (menuMusicGainNode) menuMusicGainNode.disconnect(); } catch {}
            menuMusicSource = null;
            menuMusicGainNode = null;
        };
    } catch {
        // ignore autoplay errors silently
    }
}

/**
 * Fades out the menu music and stops it.
 */
export function fadeMenuMusicOut(durationSec = 0.4) {
    if (!audioContext || !menuMusicSource || !menuMusicGainNode) return;
    const now = audioContext.currentTime;
    try {
        menuMusicGainNode.gain.cancelScheduledValues(now);
        menuMusicGainNode.gain.setValueAtTime(menuMusicGainNode.gain.value, now);
        menuMusicGainNode.gain.linearRampToValueAtTime(0, now + Math.max(0.05, durationSec));
        const srcRef = menuMusicSource;
        const gainRef = menuMusicGainNode;
        setTimeout(() => {
            try { srcRef.stop(0); } catch {}
            try { srcRef.disconnect(); } catch {}
            try { gainRef.disconnect(); } catch {}
            if (menuMusicSource === srcRef) menuMusicSource = null;
            if (menuMusicGainNode === gainRef) menuMusicGainNode = null;
            menuMusicPlaying = false;
        }, Math.ceil(Math.max(0.05, durationSec) * 1000) + 20);
    } catch {
        // best-effort
    }
}

// NEW: immediate hard stop for menu music
export function stopMenuMusicNow() {
    if (!menuMusicSource || !menuMusicGainNode) return;
    try { menuMusicSource.stop(0); } catch {}
    try { menuMusicSource.disconnect(); } catch {}
    try { menuMusicGainNode.disconnect(); } catch {}
    menuMusicSource = null;
    menuMusicGainNode = null;
    menuMusicPlaying = false;
}

/* NEW: play the in-game music (WBB_song.mp3) with fade-in */
export async function playGameMusic() {
    try {
        if (!audioContext || !audioBuffers.gameSong) return;
        await resumeAudioContext();
        if (gameMusicSource && gameMusicGainNode && gameMusicPlaying) {
            const now = audioContext.currentTime;
            const target = musicMuted ? 0 : GAME_TARGET_VOL;
            gameMusicGainNode.gain.cancelScheduledValues(now);
            gameMusicGainNode.gain.setValueAtTime(gameMusicGainNode.gain.value, now);
            gameMusicGainNode.gain.linearRampToValueAtTime(target, now + 1.2);
            return;
        }
        const src = audioContext.createBufferSource();
        src.buffer = audioBuffers.gameSong; src.loop = true;
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        src.connect(gain); gain.connect(audioContext.destination);
        gameMusicSource = src; gameMusicGainNode = gain; gameMusicPlaying = true;
        const now = audioContext.currentTime; src.start(0);
        const target = musicMuted ? 0 : GAME_TARGET_VOL;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(target, now + 1.2);
        src.onended = () => { gameMusicPlaying = false; try { src.disconnect(); gain.disconnect(); } catch {} gameMusicSource = null; gameMusicGainNode = null; };
    } catch {}
}

/**
 * Checks if sounds have been loaded and the audio context is ready to play (or be resumed).
 * @returns {boolean} True if sounds are ready, false otherwise.
 */
export function areSoundsReady() {
    return soundsLoaded && (audioContext && (audioContext.state === 'running' || audioContext.state === 'suspended'));
}