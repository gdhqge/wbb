import { playClickSound, playStartupSound, fadeMenuMusicOut, playMenuMusic } from './audio.js';
import { pauseMenu, cleanupMenu, setupMenu, resumeMenu } from './menu.js';
import { DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT } from './state.js';
import { resetGame } from './game.js';
import { syncSidePanelsToCanvas } from './ui-state.js';
import { ensureFullscreen } from './fullscreen.js'; // NEW: Fullscreen helper
// NEW: Import WebsimSocket for leaderboard
import { WebsimSocket } from '@websim/websim-socket';
// NEW: ensure audio is loaded before playing startup sound
import { areSoundsReady, setupAudio } from './audio.js';
// NEW: also import resumeAudioContext to ensure audio plays on Start reliably
import { resumeAudioContext } from './audio.js';
// NEW: also import immediate stop for menu music
import { stopMenuMusicNow } from './audio.js';
// NEW: import game music starter
import { playGameMusic } from './audio.js';
import { setupUI } from './ui.js'; // NEW: to rebuild classic sidebars after save

// NEW: pull in live players to hot-update custom weapons in-game
import { players } from './state.js';

// NEW: Initialize WebsimSocket for leaderboard
const room = new WebsimSocket();

// NEW: persistence helpers for custom balls
const CUSTOMS_KEY = 'wbb_custom_weapons_v1';
function readCustoms() {
  try { const s = localStorage.getItem(CUSTOMS_KEY); window.customWeapons = s ? JSON.parse(s) : (window.customWeapons || []); } catch {}
  return Array.isArray(window.customWeapons) ? window.customWeapons : [];
}
function writeCustoms(list) {
  try { localStorage.setItem(CUSTOMS_KEY, JSON.stringify(list)); } catch {}
  window.customWeapons = list;
}

export function setupMenuNavigation() {
    const startButton = document.getElementById('startButton');
    const creditsButton = document.getElementById('creditsButton');
    const leaderboardButton = document.getElementById('leaderboardButton');
    // NEW: How To Play elements
    const howToPlayButton = document.getElementById('howToPlayButton');
    const howtoMenu = document.getElementById('howto-menu');
    const howtoBackButton = document.getElementById('howtoBackButton');

    const creditsMenu = document.getElementById('credits-menu');
    const leaderboardMenu = document.getElementById('leaderboard-menu');
    const creditsBackButton = document.getElementById('creditsBackButton');
    const leaderboardBackButton = document.getElementById('leaderboardBackButton');
    const mainMenu = document.getElementById('main-menu');
    const gameContainer = document.getElementById('game-container');
    const canvas = document.getElementById('gameCanvas');

    // NEW: Custom Maker elements
    const customMakerButton = document.getElementById('customMakerButton');
    const customMakerMenu = document.getElementById('custom-maker-menu');
    const customMakerBackButton = document.getElementById('customMakerBackButton');
    const makerName = document.getElementById('makerName');
    const makerType = document.getElementById('makerType');
    const makerBehavior = document.getElementById('makerBehavior');
    const makerAIGenerate = document.getElementById('makerAIGenerate');
    const makerWeaponTex = document.getElementById('makerWeaponTex');
    const makerProjTex = document.getElementById('makerProjTex');
    const makerWeaponPreview = document.getElementById('makerWeaponPreview');
    const makerProjPreview = document.getElementById('makerProjPreview');
    // NEW: Icon texture elements
    const makerIconTex = document.getElementById('makerIconTex');
    const makerIconPreview = document.getElementById('makerIconPreview');
    /* NEW: sliders */
    const makerWeaponSize = document.getElementById('makerWeaponSize');
    const makerWeaponLength = document.getElementById('makerWeaponLength');
    const makerProjSize = document.getElementById('makerProjSize');
    const makerProjLength = document.getElementById('makerProjLength');
    const makerProjFireRate = document.getElementById('makerProjFireRate');
    const makerWeaponOffset = document.getElementById('makerWeaponOffset');
    const makerProjRow = document.getElementById('makerProjRow');
    const makerStatsMinus = document.getElementById('makerStatsMinus');
    const makerStatsPlus = document.getElementById('makerStatsPlus');
    const makerStatsLines = document.getElementById('makerStatsLines');
    // NEW: define missing DOM element refs to prevent ReferenceErrors
    const makerArenaCanvas = document.getElementById('makerArenaCanvas');
    const makerWeaponRotation = document.getElementById('makerWeaponRotation');
    const makerProjRotation = document.getElementById('makerProjRotation');
    const makerBallSize = document.getElementById('makerBallSize');
    const makerBallSpeed = document.getElementById('makerBallSpeed');
    const makerFireRateSlot = document.getElementById('makerFireRateSlot');
    const makerBouncesSlot = document.getElementById('makerBouncesSlot');
    const makerProjBounces = document.getElementById('makerProjBounces');
    const makerShootSoundRow = document.getElementById('makerShootSoundRow');
    const makerHitSound = document.getElementById('makerHitSound');
    const makerShootSound = document.getElementById('makerShootSound');
    // NEW: missing elements (define early to avoid TDZ errors)
    const makerArenaCtx = makerArenaCanvas?.getContext('2d') || null;
    let makerArenaRAF = null, makerBall = null;
    /* NEW: ranged preview state */
    let makerProjectiles = [], makerFireTimerMs = 0;
    // NEW: Reset Preview button
    const makerResetPreviewBtn = document.getElementById('makerResetPreview');
    const makerContentEl = document.getElementById('custom-maker-content'); // NEW: left main frame reference
    const makerColor = document.getElementById('makerColor'); // NEW: color picker
    const makerTweaks = document.getElementById('makerTweaks'); // NEW: tweaks section
    const makerTweaksFields = document.getElementById('makerTweaksFields'); // NEW: tweak fields container
    let lastGen = null; // NEW: keep the latest AI generation to drive Tweaks
    // NEW: track which props the user explicitly mentioned
    let lastMentioned = null;
    // NEW: lightweight mention extractor (synonyms included)
    const mentionedSet = (text) => {
        const t = (text || '').toLowerCase(); const S = new Set(); const add=(k,arr)=>{ if (arr.some(w=>t.includes(w))) S.add(k); };
        add('radius',['radius','size','big','bigger','small','smaller','tiny','massive','giant','huge','minuscule']);
        add('speed',['speed','velocity','fast','faster','quick','quicker','slow','slower','agile']);
        add('spinRate',['spin rate','spinrate','spin','spinning','rotate','rotation']);
        add('health',['health','hp','tank','tanky','durable','sturdy','fragile','glass','squishy']);
        add('projectileSpeed',['projectile speed','arrow speed','bullet speed','shot speed']);
        add('fireRate',['fire rate','firerate','shots/s','shots per second','shoot rate','cadence','minigun','rapid','spray','burst']);
        add('damage',['damage','dmg','hard-hitting','hits hard','weak hit','weaker','stronger']);
        add('range',['range','reach','sniper','long-range','short-range','close-range','melee reach']);
        add('growthPerHit',['growth per hit','growth','scales per hit','scaling','per hit','ramps','ramps up']);
        return S;
    };

    // NEW: Rule editor element (dropdowns/number)
    // NEW: read all 5 rule rows into currentRules and reset game on changes
    let currentRules = [];

    // Cache original credits HTML so we can restore on each open
    const creditsTrackEl = document.querySelector('#credits-menu .credits-track');
    const originalCreditsHTML = creditsTrackEl ? creditsTrackEl.innerHTML : '';
    // NEW: track the id of the custom currently being edited (used by Save to overwrite)
    let makerEditingId = null;

    startButton.addEventListener('click', async () => {
        await playClickSound();
        // Ensure audio buffers are loaded before attempting to play the startup sound
        if (!areSoundsReady()) {
            try { await setupAudio(); } catch {}
        }
        // NEW: aggressively ensure context is running, then play startup sound with a quick retry fallback
        try { await resumeAudioContext(); } catch {}
        try {
            await playStartupSound();
        } catch {
            setTimeout(() => { try { playStartupSound(); } catch {} }, 120);
        }
        // NEW: rapidly fade out menu music immediately on start
        fadeMenuMusicOut(0.2);
        // Stop menu music immediately on start (no lingering)
        stopMenuMusicNow();
        // NEW: Request fullscreen when starting the game
        ensureFullscreen();

        mainMenu.classList.add('sliding-out-left');

        setTimeout(() => {
            // Only stop music and tear down when starting the actual game
            cleanupMenu();
            
            mainMenu.style.display = 'none';
            
            gameContainer.style.display = 'flex';
            canvas.width = DEFAULT_ARENA_WIDTH;
            canvas.height = DEFAULT_ARENA_HEIGHT;
            syncSidePanelsToCanvas();
            resetGame(canvas.width, canvas.height);
            // NEW: start in-game music after game appears
            playGameMusic();

            requestAnimationFrame(() => { 
                gameContainer.style.opacity = '1';
            });

        }, 800);
    });

    creditsButton.addEventListener('click', async () => {
        await playClickSound();
        // stop menu music off main menu
        fadeMenuMusicOut();

        // Restore credits content and restart animation each time it's opened
        const track = document.querySelector('#credits-menu .credits-track');
        if (track) {
            track.innerHTML = originalCreditsHTML;
            // Restart CSS animation
            track.style.animation = 'none';
            // Force reflow
            void track.offsetHeight;
            track.style.animation = '';
            // Ensure it uses the single-run animation
            track.style.animation = 'creditsScrollOnce 30s linear forwards';

            // After animation ends, clear the credits
            track.addEventListener('animationend', () => {
                track.innerHTML = '';
            }, { once: true });
        }
        
        // Keep menu music/loop alive; just hide the main menu UI
        mainMenu.style.display = 'none';
        
        creditsMenu.style.display = 'flex';
        creditsMenu.style.opacity = '0';
        creditsMenu.style.pointerEvents = 'auto';
        
        // Smooth fade in
        requestAnimationFrame(() => {
            creditsMenu.style.opacity = '1';
        });
    });

    leaderboardButton.addEventListener('click', async () => {
        await playClickSound();
        // stop menu music off main menu
        fadeMenuMusicOut();
        
        // Keep menu music/loop alive; just hide the main menu UI
        mainMenu.style.display = 'none';
        
        leaderboardMenu.style.display = 'flex';
        leaderboardMenu.style.opacity = '0';
        leaderboardMenu.style.pointerEvents = 'auto';
        
        // Smooth fade in
        requestAnimationFrame(() => {
            leaderboardMenu.style.opacity = '1';
        });
        
        loadLeaderboardData();
    });

    // NEW: How To Play open
    howToPlayButton.addEventListener('click', async () => {
        await playClickSound();
        // stop menu music off main menu
        fadeMenuMusicOut();

        mainMenu.style.display = 'none';

        howtoMenu.style.display = 'flex';
        howtoMenu.style.opacity = '0';
        howtoMenu.style.pointerEvents = 'auto';

        requestAnimationFrame(() => {
            howtoMenu.style.opacity = '1';
        });
    });

    creditsBackButton.addEventListener('click', async () => {
        await playClickSound();
        
        // Do NOT cleanup menu here; we want music and background to continue
        creditsMenu.style.display = 'none';
        mainMenu.style.display = 'flex';
        mainMenu.style.opacity = '1';
        mainMenu.style.pointerEvents = 'auto';
        // No re-setup; the menu is still running behind the scenes
        // resume menu music on returning to main menu
        playMenuMusic();
    });

    leaderboardBackButton.addEventListener('click', async () => {
        await playClickSound();
        
        // Do NOT cleanup menu here; we want music and background to continue
        leaderboardMenu.style.display = 'none';
        mainMenu.style.display = 'flex';
        mainMenu.style.opacity = '1';
        mainMenu.style.pointerEvents = 'auto';
        // No re-setup; the menu is still running behind the scenes
        // resume menu music on returning to main menu
        playMenuMusic();
    });

    // NEW: How To Play back
    howtoBackButton.addEventListener('click', async () => {
        await playClickSound();

        howtoMenu.style.display = 'none';
        mainMenu.style.display = 'flex';
        mainMenu.style.opacity = '1';
        mainMenu.style.pointerEvents = 'auto';
        // resume menu music on returning to main menu
        playMenuMusic();
    });

    // OPEN: Custom Ball Maker
    if (customMakerButton) {
        customMakerButton.addEventListener('click', async () => {
            await playClickSound();
            fadeMenuMusicOut();
            // Instant show (no fade/RAF)
            mainMenu.style.display = 'none';
            customMakerMenu.style.display = 'flex';
            customMakerMenu.style.opacity = '1';
            customMakerMenu.style.pointerEvents = 'auto';
            syncProjRow();
            // NEW: start the static preview arena
            startMakerArena();
        });
    }

    // BACK: Custom Ball Maker
    if (customMakerBackButton) {
        customMakerBackButton.addEventListener('click', async () => {
            await playClickSound();
            // NEW: stop the preview arena loop
            stopMakerArena();
            customMakerMenu.style.display = 'none';
            mainMenu.style.display = 'flex';
            mainMenu.style.opacity = '1';
            mainMenu.style.pointerEvents = 'auto';
        });
    }

    // NEW: Behavior line count controls
    let ruleLinesCount = 1;
    const ruleMinusBtn = document.getElementById('makerRuleMinus');
    const rulePlusBtn = document.getElementById('makerRulePlus');

    function updateRuleRowsVisibility() {
      for (let i = 0; i < 5; i++) {
        const row = document.querySelector(`#makerRuleLine [data-rule="${i}"]`);
        if (row) row.style.display = (i < ruleLinesCount) ? '' : 'none';
      }
    }
    // NEW: normalize any legacy "teammates only" options to "teammates"
    function normalizeScopeOptions() {
      for (let i = 0; i < 5; i++) {
        const sel = document.getElementById(`ruleScope${i}`);
        if (!sel) continue;
        [...sel.options].forEach(opt => {
          if (opt.value === 'teammates only') { opt.value = 'teammates'; opt.textContent = 'teammates'; }
        });
      }
    }
    ruleMinusBtn?.addEventListener('click', () => { ruleLinesCount = Math.max(1, ruleLinesCount - 1); updateRuleRowsVisibility(); syncRulesFromControls(); });
    rulePlusBtn?.addEventListener('click', () => { ruleLinesCount = Math.min(5, ruleLinesCount + 1); updateRuleRowsVisibility(); syncRulesFromControls(); });
    updateRuleRowsVisibility();
    normalizeScopeOptions(); // NEW

    // NEW: Stats lines builder and sync
    let statLinesCount = 1;
    function rebuildStatLines() {
      if (!makerStatsLines) return;
      // Preserve existing stats before rebuilding so users never lose them accidentally
      const prev = Array.from(makerStatsLines.children || []).map(row => {
        const parts = row.querySelectorAll('select,input');
        return {
          op: parts[0]?.value || '', field: parts[1]?.value || '', amount: parts[2]?.value || '',
          when: parts[3]?.value || '', seconds: parts[4]?.value || ''
        };
      });
      makerStatsLines.innerHTML = '';
      for (let i = 0; i < statLinesCount; i++) {
        const row = document.createElement('div'); row.style.display='flex'; row.style.flexWrap='wrap'; row.style.gap='8px'; row.style.alignItems='center';
        const op = document.createElement('select'); 
        op.appendChild(new Option('', ''));
        ['increase','decrease','multiply','divide'].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; op.appendChild(o); });
        const field = document.createElement('select'); 
        const ranged = makerType?.value === 'ranged'; 
        field.appendChild(new Option('', ''));
        const opts = ['damage','healing','size','speed','spin speed'].concat(ranged?['fire rate']:[]);
        opts.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; field.appendChild(o); });
        const bySpan = document.createElement('span'); bySpan.textContent = ' by ';
        const amt = document.createElement('input'); amt.type='number'; amt.step='0.1'; amt.min='0'; amt.style.width='90px';
        const whenSel = document.createElement('select'); 
        whenSel.appendChild(new Option('', ''));
        ['every X seconds','when hitting opponent','when hitting teammates','when hitting wall','when hitting itself','when hitting anything']
          .forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; whenSel.appendChild(o); });
        const sec = document.createElement('input'); sec.type='number'; sec.step='0.1'; sec.min='0.1'; sec.placeholder='seconds'; sec.style.width='90px'; sec.style.display='none';
        whenSel.addEventListener('change', ()=>{ sec.style.display = (whenSel.value==='every X seconds')?'':'none'; });
        row.append(op, field, bySpan, amt, whenSel, sec); makerStatsLines.appendChild(row);
        // Restore previous values for this row if available (add missing option if needed)
        const p = prev[i]; if (p) {
          op.value = p.op || '';
          if (p.field && ![...field.options].some(o=>o.value===p.field)) field.appendChild(new Option(p.field, p.field));
          field.value = p.field || '';
          amt.value = p.amount || '';
          whenSel.value = p.when || '';
          sec.style.display = (whenSel.value==='every X seconds')?'':'none';
          if (p.when==='every X seconds') sec.value = p.seconds || '';
        }
      }
    }
    makerStatsMinus?.addEventListener('click', ()=>{ statLinesCount=Math.max(1,statLinesCount-1); rebuildStatLines(); });
    makerStatsPlus?.addEventListener('click', ()=>{ statLinesCount=Math.min(5,statLinesCount+1); rebuildStatLines(); });
    rebuildStatLines();

    // Hide deprecated AI controls
    if (makerAIGenerate) makerAIGenerate.parentElement && (makerAIGenerate.parentElement.style.display = 'none');
    if (makerTweaks) makerTweaks.style.display = 'none';

    // NEW: wire rule controls to currentRule and preview
    // NEW: read all 5 rule rows into currentRules and reset game on changes
    function syncRulesFromControls() {
        const rules = [];
        for (let i = 0; i < ruleLinesCount; i++) {
            const eff = document.getElementById(`ruleEffect${i}`)?.value || '';
            const amtStr = document.getElementById(`ruleAmount${i}`)?.value ?? '';
            const tgt = document.getElementById(`ruleTarget${i}`)?.value || '';
            // CHANGED: use let + normalize "teammates only" -> "teammates"
            let scope = (eff === 'damages' || eff === 'heals') ? (document.getElementById(`ruleScope${i}`)?.value || 'opponent') : null;
            if (scope === 'teammates only') scope = 'teammates';
            const amt = parseFloat(amtStr);
            if (eff && tgt && !isNaN(amt)) rules.push({ effect: eff, amount: amt, target: tgt, scope });
            const scopeEl = document.getElementById(`ruleScope${i}`);
            if (scopeEl) scopeEl.style.display = (eff === 'damages' || eff === 'heals') ? '' : 'none';
        }
        currentRules = rules;

        // NEW: immediately persist edited stats/rules to the in-memory custom being edited
        if (makerEditingId) {
          const list = readCustoms();
          const idx = list.findIndex(w => w.id === makerEditingId);
          if (idx >= 0) {
            const liveStats = readStatsFromEditorNow();
            list[idx] = { ...list[idx], rules: currentRules.slice(), stats: liveStats.slice() };
            writeCustoms(list);
            // Hot-update any live players using this custom so behavior changes take effect right away
            players.forEach(p => {
              if (typeof p.type === 'string' && p.type === `custom:${makerEditingId}` && p.weapon && p.weapon.def) {
                p.weapon.def.rules = currentRules.slice();
                p.weapon.def.stats = liveStats.slice();
              }
            });
          }
        }

        // Immediately preview "anything" effects so changes are visible without waiting
        if (makerBall) { currentRules.forEach(r => { if (r.target === 'anything') applyRuleToPreview(makerBall, r); }); }
        resetMainGameNow();
    }
    // attach listeners for all rule rows
    for (let i = 0; i < 5; i++) {
        ['ruleEffect','ruleAmount','ruleTarget'].forEach(k => {
            const el = document.getElementById(`${k}${i}`);
            if (el) el.addEventListener(k === 'ruleAmount' ? 'input' : 'change', syncRulesFromControls);
        });
        const effEl = document.getElementById(`ruleEffect${i}`);
        if (effEl) effEl.addEventListener('change', () => {
            const scopeEl = document.getElementById(`ruleScope${i}`);
            if (scopeEl) scopeEl.style.display = (effEl.value === 'damages' || effEl.value === 'heals') ? '' : 'none';
        });
    }
    syncRulesFromControls();

    // Texture uploads
    async function handleImageUpload(inputEl, previewEl) {
        if (!inputEl || !inputEl.files || !inputEl.files[0]) return null;
        const file = inputEl.files[0];
        // Instant preview with object URL
        const objUrl = URL.createObjectURL(file);
        if (previewEl) {
          previewEl.src = objUrl;
          previewEl.style.display = 'inline-block';
        }
        const clearBtn = document.getElementById('makerWeaponClear');
        if (clearBtn && previewEl === makerWeaponPreview) clearBtn.style.display = 'inline-flex';
        refreshMakerArenaConfig(); resetMainGameNow();
        // Background upload; swap to CDN URL when ready
        try {
          const uploaded = await window.websim.upload(file);
          if (uploaded && previewEl) {
            previewEl.dataset.uploadUrl = uploaded;
            previewEl.src = uploaded;
          }
          return uploaded;
        } catch (e) { console.warn('Upload failed:', e); return objUrl; }
    }
    makerWeaponTex?.addEventListener('change', () => handleImageUpload(makerWeaponTex, makerWeaponPreview).then(() => {
        const clearBtn = document.getElementById('makerWeaponClear');
        if (makerWeaponPreview?.src) { if (clearBtn) clearBtn.style.display = 'inline-flex'; }
    }));
    makerProjTex?.addEventListener('change', () => handleImageUpload(makerProjTex, makerProjPreview).then(() => {
        const clearBtn = document.getElementById('makerProjClear');
        if (makerProjPreview?.src) { if (clearBtn) clearBtn.style.display = 'inline-flex'; }
    }));
    makerIconTex?.addEventListener('change', () => handleImageUpload(makerIconTex, makerIconPreview).then(() => {
        const clearBtn = document.getElementById('makerIconClear');
        if (makerIconPreview?.src) { if (clearBtn) clearBtn.style.display = 'inline-flex'; }
    }));

    // NEW: also cache outline color and weapon offset slider
    const makerOutlineColor = document.getElementById('makerOutlineColor');
    const makerHealthTextColor = document.getElementById('makerHealthTextColor');
    const makerSpinSpeed = document.getElementById('makerSpinSpeed');

    // NEW: holders for uploaded sound URLs
    let makerHitSoundUrl = '';
    let makerShootSoundUrl = '';

    // Hook color/size/speed/rotation pickers to live preview
    makerColor?.addEventListener('input', () => { if (makerBall) makerBall.color = makerColor.value; resetMainGameNow(); });
    makerOutlineColor?.addEventListener('input', () => { if (makerBall) makerBall.outlineColor = makerOutlineColor.value; });
    makerHealthTextColor?.addEventListener('input', () => { if (makerBall) makerBall.healthTextColor = makerHealthTextColor.value; });
    makerBallSize?.addEventListener('input', () => { if (makerBall) makerBall.r = parseFloat(makerBallSize.value || '35'); });
    makerBallSpeed?.addEventListener('input', () => {
        if (!makerBall) return;
        const makerSpeed = parseFloat(makerBallSpeed.value || '0.15');
        const gameSpeed = 2 + Math.max(0, Math.min(0.3, makerSpeed)) * ((18 - 2) / 0.3);
        const ang = Math.atan2(makerBall.vy || 0, makerBall.vx || 1);
        makerBall.vx = Math.cos(ang) * gameSpeed;
        makerBall.vy = Math.sin(ang) * gameSpeed;
    });
    makerSpinSpeed?.addEventListener('input', () => { if (makerBall) makerBall.spin = parseFloat(makerSpinSpeed.value || '0.05'); });
    makerWeaponRotation?.addEventListener('input', () => { /* preview uses this each frame */ });
    makerProjRotation?.addEventListener('input', () => { /* reserved for future projectile preview */ });
    // NEW: sliders reset main game and re-render preview
    [makerWeaponSize, makerWeaponLength, makerProjSize, makerProjLength, makerProjFireRate, makerWeaponOffset, makerWeaponRotation, makerProjRotation, makerBallSize, makerBallSpeed, makerSpinSpeed]
      .forEach(el => el && el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
        if (el === makerBallSize && makerBall) makerBall.r = parseFloat(makerBallSize.value || '35');
        if (el === makerBallSpeed && makerBall) makerBall.spin = parseFloat(makerBallSpeed.value || '0.15');
        if (el === makerSpinSpeed && makerBall) makerBall.spin = parseFloat(makerSpinSpeed.value || '0.05');
        resetMainGameNow();
      }));
    // NEW: resize preview arena to match the main frame height and current canvas CSS width
    function resizeMakerArena() {
        if (!makerArenaCanvas || !makerContentEl) return;
        const cssWidth = makerArenaCanvas.clientWidth || makerArenaCanvas.parentElement.clientWidth || 380;
        const targetHeight = makerContentEl.clientHeight || 260; // match main frame height
        makerArenaCanvas.width = cssWidth;
        makerArenaCanvas.height = targetHeight;
        // Center the preview ball after any resize so it stays centered
        if (makerBall) {
            makerBall.x = makerArenaCanvas.width * 0.5;
            makerBall.y = makerArenaCanvas.height * 0.5;
        }
    }

    // NEW: apply behavior rule to the preview ball
    function applyRuleToPreview(b, rule) {
        const amt = Number(rule?.amount) || 0;
        switch (rule?.effect) {
            case 'grows': b.r = Math.min(120, b.r + amt); break;
            case 'shrinks': b.r = Math.max(6, b.r - amt); break;
            case 'faster': { const sp = Math.hypot(b.vx,b.vy)+amt; const a=Math.atan2(b.vy,b.vx); b.vx=Math.cos(a)*sp; b.vy=Math.sin(a)*sp; break; }
            case 'slower': { const sp = Math.max(0.5, Math.hypot(b.vx,b.vy)-amt); const a=Math.atan2(b.vy,b.vx); b.vx=Math.cos(a)*sp; b.vy=Math.sin(a)*sp; break; }
            case 'spin_faster': b.spin = Math.min(0.5, (b.spin || 0.05) + 0.01 * amt); break;
            case 'spin_slower': b.spin = Math.max(0.0, (b.spin || 0.05) - 0.01 * amt); break;
            case 'damages': { if (rule.scope === 'itself' || rule.scope === 'everyone') b.health = Math.max(0, (b.health ?? 100) - amt); break; }
            case 'heals': { b.health = Math.min(100, (b.health ?? 100) + amt); break; }
            default: break;
        }
    }

    // PARSER: "[effect] by [number] when hitting [opponent|wall]"
    function parseRule(text) {
        const t = String(text || '').trim().toLowerCase();
        // find effect phrase up to " by "
        const byIdx = t.indexOf(' by ');
        const whenIdx = t.indexOf(' when hitting ');
        let effect = 'grows', amount = 1, target = 'wall';
        if (byIdx > 0) {
            effect = t.slice(0, byIdx).trim();
        }
        if (byIdx >= 0 && whenIdx > byIdx) {
            const amtStr = t.slice(byIdx + 4, whenIdx).trim();
            const n = parseFloat(amtStr);
            if (!isNaN(n)) amount = n;
        }
        if (whenIdx >= 0) {
            const tail = t.slice(whenIdx + ' when hitting '.length).trim();
            if (tail.startsWith('wall')) target = 'wall';
            else if (tail.startsWith('opponent')) target = 'opponent';
        }
        // normalize common effects
        const aliases = new Map([
            ['damages','damages'],['damage','damages'],
            ['grows','grows'],['grow','grows'],
            ['shrinks','shrinks'],['shrink','shrinks'],
            ['gets faster','faster'],['faster','faster'],['speed up','faster'],
            ['gets slower','slower'],['slower','slower'],['slow down','slower'],
            ['spins faster','spin_faster'],['spin faster','spin_faster'],
            ['spins slower','spin_slower'],['spin slower','spin_slower'],
        ]);
        let key = effect;
        for (const [k,v] of aliases) { if (effect.startsWith(k)) { key = v; break; } }
        return { effect: key, amount, target };
    }
    // DEPRECATE old free-text behavior editor (no longer used)
    // Leave existing makerRule handlers intact but harmless if element is absent
    const makerRule = document.getElementById('makerRule');
    if (makerRule) {
        const syncRule = () => { currentRule = parseRule(makerRule.textContent || makerRule.innerText || ''); };
        makerRule.addEventListener('input', syncRule);
        makerRule.addEventListener('blur', syncRule);
        currentRule = parseRule(makerRule.textContent || makerRule.innerText || '');
    }

    // Helper: reset main game immediately (same as Reset button does)
    function resetMainGameNow() {
        if (!canvas) return;
        resetGame(canvas.width, canvas.height);
    }

    // Allow spacebar inside inputs/textareas without triggering global key handlers
    function preventSpaceCapture(el) {
      if (!el) return;
      el.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ') {
          e.stopPropagation();
        }
      });
    }
    [makerName, makerBehavior].forEach(preventSpaceCapture);

    // NEW: wire Load and Hard Reset buttons
    const makerLoadButton = document.getElementById('makerLoadButton');
    const makerHardResetButton = document.getElementById('makerHardResetButton');
    const makerSaveButton = document.getElementById('makerSaveButton');
    const makerLoadPanel = document.getElementById('makerLoadPanel');
    const makerLoadList = document.getElementById('makerLoadList');
    const makerLoadClose = document.getElementById('makerLoadClose');

    // NEW: timer holder to safely revert Save button text
    let makerSaveResetTimer = null;

    // NEW: read Stats from editor on demand (same order as Save)
    function readStatsFromEditorNow() {
      const out = [];
      const linesWrap = document.getElementById('makerStatsLines');
      if (!linesWrap) return out;
      const rows = Array.from(linesWrap.children || []);
      rows.forEach(row => {
        const parts = row.querySelectorAll('select,input');
        const op = parts[0]?.value || '';
        const field = parts[1]?.value || '';
        const amount = parseFloat(parts[2]?.value || '0');
        const when = parts[3]?.value || '';
        const seconds = (when === 'every X seconds') ? parseFloat(parts[4]?.value || '0') : null;
        if (op && field && !isNaN(amount) && when) out.push({ op, field, amount, when, seconds });
      });
      return out;
    }

    // NEW: helper to ensure a preview image is uploaded to a persistent URL (not a blob:)
    async function ensureUploadedFromPreview(previewEl) {
      const existing = previewEl?.dataset?.uploadUrl;
      if (existing) return existing;
      const src = previewEl?.src || '';
      if (!src) return '';
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const file = new File([blob], 'custom-asset.png', { type: blob.type || 'image/png' });
        const url = await window.websim.upload(file);
        if (previewEl) previewEl.dataset.uploadUrl = url;
        return url;
      } catch { return src; }
    }
    // NEW: upload audio file and return persistent URL
    async function uploadAudioFile(inputEl) {
      if (!inputEl || !inputEl.files || !inputEl.files[0]) return '';
      const file = inputEl.files[0];
      try { const url = await window.websim.upload(file); return url || ''; } catch { return ''; }
    }

    function fillEditorFromCustom(entry) {
      if (!entry) return;
      if (makerName) makerName.value = entry.name || 'Custom';
      if (makerType) makerType.value = (entry.type === 'ranged') ? 'ranged' : 'melee';
      if (makerColor) makerColor.value = entry.color || '#ffffff';
      if (makerIconPreview && entry.iconUrl) {
        makerIconPreview.src = entry.iconUrl;
        makerIconPreview.style.display = 'inline-block';
      }
      syncProjRow();
      /* NEW: restore Stats editor rows from saved entry */
      const statsArr = Array.isArray(entry.stats) ? entry.stats : [];
      statLinesCount = Math.max(1, statsArr.length || 1);
      rebuildStatLines();
      if (statsArr.length) {
        const rows = makerStatsLines ? Array.from(makerStatsLines.children) : [];
        statsArr.forEach((s, i) => {
          const row = rows[i]; if (!row) return;
          const parts = row.querySelectorAll('select,input');
          // order: [op(select), field(select), amount(input), when(select), seconds(input)]
          parts[0] && (parts[0].value = s.op || '');
          parts[1] && (parts[1].value = s.field || '');
          parts[2] && (parts[2].value = Number.isFinite(s.amount) ? String(s.amount) : (s.amount || ''));
          parts[3] && (parts[3].value = s.when || '');
          parts[4] && (parts[4].style.display = (s.when === 'every X seconds') ? '' : 'none');
          parts[4] && (parts[4].value = Number.isFinite(s.seconds) ? String(s.seconds) : (s.seconds || ''));
        });
      }
      /* NEW: restore Rule rows from saved entry */
      const rulesArr = Array.isArray(entry.rules) ? entry.rules : [];
      ruleLinesCount = Math.max(1, rulesArr.length || 1);
      updateRuleRowsVisibility();
      normalizeScopeOptions(); // NEW: ensure UI options are normalized before setting values
      rulesArr.forEach((r, i) => {
        const effEl = document.getElementById(`ruleEffect${i}`);
        const scopeEl = document.getElementById(`ruleScope${i}`);
        const amtEl = document.getElementById(`ruleAmount${i}`);
        const tgtEl = document.getElementById(`ruleTarget${i}`);
        if (effEl) effEl.value = r.effect || '';
        if (scopeEl) {
          scopeEl.style.display = (r.effect === 'damages' || r.effect === 'heals') ? '' : 'none';
          // NEW: map legacy "teammates only" to "teammates"
          const normalizedScope = (r.scope === 'teammates only') ? 'teammates' : (r.scope || 'opponent');
          scopeEl.value = normalizedScope;
        }
        if (amtEl) amtEl.value = (Number.isFinite(r.amount) ? String(r.amount) : (r.amount || ''));
        if (tgtEl) tgtEl.value = r.target || '';
      });
      // restore sounds (no preview UI, just keep URLs in memory)
      makerHitSoundUrl = entry.sounds?.hit || '';
      makerShootSoundUrl = entry.sounds?.shoot || '';
      // sync internal state after populating
      syncProjRow(); syncRulesFromControls(); resetMainGameNow();
      /* NEW: remember which custom is being edited so Save overwrites it */
      makerEditingId = entry.id || null;
    }

    makerLoadButton?.addEventListener('click', async () => {
      await playClickSound();
      // ensure we read the latest saved customs from storage
      const list = readCustoms();
      makerLoadList.innerHTML = (list.length === 0)
        ? '<div style="padding:8px; background:#1f1f1f; border:2px solid #000; border-radius:8px;">No saved customs</div>'
        : list.map(w => `
          <div style="display:flex; align-items:center; gap:10px; background:#1f1f1f; border:2px solid #000; border-radius:8px; padding:8px;">
            <img src="${w.iconUrl || ''}" alt="" style="width:40px; height:40px; image-rendering:pixelated; background:#fff; border:2px solid #000; border-radius:4px;" />
            <div style="flex:1;">
              <div style="font-family:'Anton',sans-serif;">${w.name || 'Custom'}</div>
              <div style="font-family:Arial, sans-serif; font-size:12px; opacity:0.8;">${w.type === 'ranged' ? 'Ranged' : 'Melee'}</div>
            </div>
            <button data-id="${w.id}" class="maker-load-choose" style="background:#fff; border:3px solid #000; border-radius:8px; padding:6px 10px; font-family:'Anton',sans-serif;">Load</button>
            <button data-id="${w.id}" class="maker-load-delete" style="background:#f44336; color:#fff; border:3px solid #000; border-radius:8px; padding:6px 10px; font-family:'Anton',sans-serif;">-</button>
          </div>`).join('');
      makerLoadPanel.style.display = 'block';
      makerLoadList.querySelectorAll('.maker-load-choose').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          await playClickSound();
          const id = e.currentTarget.getAttribute('data-id');
          const entry = list.find(w => w.id === id);
          fillEditorFromCustom(entry);
          makerLoadPanel.style.display = 'none';
        });
      });
      // NEW: per-item delete buttons
      makerLoadList.querySelectorAll('.maker-load-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          await playClickSound();
          const id = e.currentTarget.getAttribute('data-id');
          const current = readCustoms().filter(w => w.id !== id);
          writeCustoms(current);
          // If the user deleted the item currently being edited, clear the editing id immediately
          if (makerEditingId === id) makerEditingId = null;
          // Refresh the list UI immediately
          makerLoadButton.click();
          // Defer heavy sidebar rebuild so Save stays instant after delete
          const defer = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 0));
          defer(() => { try { setupUI(() => resetGame(canvas.width, canvas.height)); } catch {} });
        });
      });
    });
    makerLoadClose?.addEventListener('click', async () => {
      await playClickSound();
      makerLoadPanel.style.display = 'none';
    });
    // Save: persist current custom to window.customWeapons and refresh sidebars
    makerSaveButton?.addEventListener('click', async () => {
      await playClickSound();
      const name = makerName?.value?.trim() || 'Custom';
      const type = (makerType?.value === 'ranged') ? 'ranged' : 'melee';
      const color = makerColor?.value || '#ffffff';
      // NEW: guarantee persistent CDN URLs for textures before saving
      const iconUrl = await ensureUploadedFromPreview(makerIconPreview);
      const weaponUrl = await ensureUploadedFromPreview(makerWeaponPreview);
      /* NEW: gather full config */
      const render = {
        weaponSize: parseFloat(makerWeaponSize?.value || '1'),
        weaponLength: parseFloat(makerWeaponLength?.value || '1'),
        weaponOffset: parseFloat(makerWeaponOffset?.value || '0.6'),
        weaponRotation: parseFloat(makerWeaponRotation?.value || '0')
      };
      const ball = {
        radius: parseFloat(makerBallSize?.value || '35'),
        speed:  parseFloat(makerBallSpeed?.value || '0.15'),
        spin:   parseFloat(makerSpinSpeed?.value || '0.03'),
        outlineColor: document.getElementById('makerOutlineColor')?.value || '#000000',
        healthTextColor: document.getElementById('makerHealthTextColor')?.value || '#000000'
      };
      const ranged = {
        fireRateMs: parseFloat(makerProjFireRate?.value || '600'),
        projSize: parseFloat(makerProjSize?.value || '1'),
        projLength: parseFloat(makerProjLength?.value || '1'),
        projRotation: parseFloat(makerProjRotation?.value || '0'),
        projUrl: await ensureUploadedFromPreview(makerProjPreview)
      };
      // include optional sounds
      const sounds = { hit: makerHitSoundUrl || '', shoot: makerShootSoundUrl || '' };
      /* NEW: extract Stats lines */
      const stats = [];
      if (makerStatsLines) {
        Array.from(makerStatsLines.children).forEach(row => {
          const parts = row.querySelectorAll('select,input');
          // Correct order: [op(select), field(select), amount(input), when(select), seconds(input)]
          const op = parts[0]?.value || '';
          const field = parts[1]?.value || '';
          const amt = parseFloat(parts[2]?.value || '0');
          const when = parts[3]?.value || '';
          const seconds = (when === 'every X seconds') ? parseFloat(parts[4]?.value || '0') : null;
          if (op && field && !isNaN(amt) && when) stats.push({ op, field, amount: amt, when, seconds });
        });
      }
      /* NEW: use currentRules from editor */
      const rules = Array.isArray(currentRules) ? currentRules.slice() : [];

      // If editing an existing custom, keep its id and overwrite; else create a new id
      const id = makerEditingId || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const newEntry = {
        id, name, type, isRanged: (type === 'ranged'), color, iconUrl, weaponUrl,
        render, ball, ranged, stats, rules, sounds
      };

      // FAST PATH: choose minimal UI fields locally (no network) for instant save
      const fastUiStats = (() => {
        const fields = [];
        const canDamage = (stats.some(s=>s.field==='damage') || rules.some(r=>r.effect==='damages'));
        const canHeal = (stats.some(s=>s.field==='healing') || rules.some(r=>r.effect==='heals'));
        const isRanged = newEntry.isRanged;
        if (canDamage) fields.push('damage');
        if (canHeal) fields.push('healing');
        if (isRanged) fields.push('fire rate');
        fields.push('speed');
        if (!isRanged) fields.push('spin');
        return Array.from(new Set(fields)).slice(0, 4);
      })();
      newEntry.uiStats = fastUiStats;

      // Replace or append in-memory list, then persist (IMMEDIATE)
      const list = Array.isArray(window.customWeapons) ? window.customWeapons : [];
      const idx = list.findIndex(w => w.id === id);
      if (idx >= 0) { list[idx] = newEntry; } else { list.push(newEntry); }
      window.customWeapons = list;
      writeCustoms(window.customWeapons); // persist immediately for zero-lag saves
      // NEW: hot-update any live players using this custom so changes apply instantly in-game
      players.forEach(p => {
        if (typeof p.type === 'string' && p.type === `custom:${id}` && p.weapon && p.weapon.def) {
          p.weapon.def = { ...newEntry }; // replace full def (stats, rules, textures, render)
          // also refresh cached images if available
          if (p.weapon.image && newEntry.weaponUrl) p.weapon.image.src = newEntry.weaponUrl;
          if (p.weapon._projImg && newEntry.ranged?.projUrl) p.weapon._projImg.src = newEntry.ranged.projUrl;
        }
      });

      // Keep editor populated and show quick feedback
      applyStatsToEditor(stats);
      const originalLabel = makerSaveButton.textContent;
      makerSaveButton.textContent = 'Saved!';
      if (makerSaveResetTimer) clearTimeout(makerSaveResetTimer);
      makerSaveResetTimer = setTimeout(() => {
        makerSaveButton.textContent = originalLabel || 'Save';
        makerSaveResetTimer = null;
      }, 800);
      makerEditingId = id;

      // DEFERRED: rebuild sidebars and AI refinement happen off the critical path
      const defer = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 0));

      // Defer UI sidebar rebuild to avoid save lag
      defer(() => {
        try { setupUI(() => resetGame(canvas.width, canvas.height)); } catch {}
      });

      // Defer AI-based uiStats refinement; update storage silently when it returns
      defer(async () => {
        try {
          const allowed = ['damage','healing','size','speed','spin','fire rate'];
          const completion = await window.websim.chat.completions.create({
            messages: [
              { role: 'system', content: `Return only JSON {"fields": string[]} selecting 2-4 key fields from ${allowed.join(', ')}. Prefer damage if applicable; fire rate only for ranged.` },
              { role: 'user', content: [{ type: 'text', text: JSON.stringify({
                type: newEntry.type, isRanged: newEntry.isRanged, rules: newEntry.rules, stats: newEntry.stats,
                base: { damage: 1, healing: 0, size: newEntry.ball?.radius, speed: newEntry.ball?.speed, spin: newEntry.ball?.spin, fireRate: newEntry.ranged?.fireRateMs }
              }) }] }
            ],
            json: true
          });
          const parsed = JSON.parse(completion.content || '{}');
          const refined = Array.isArray(parsed.fields) ? parsed.fields.filter(f=>allowed.includes(f)).slice(0,4) : null;
          if (refined && refined.length) {
            // Update saved record silently
            const cur = readCustoms();
            const i = cur.findIndex(w => w.id === id);
            if (i >= 0) {
              cur[i] = { ...cur[i], uiStats: refined };
              writeCustoms(cur);
            }
          }
        } catch { /* ignore AI errors silently */ }
      });
    });

    makerHardResetButton?.addEventListener('click', async () => {
      await playClickSound();
      // Reset all fields to defaults
      if (makerName) makerName.value = '';
      if (makerType) makerType.value = 'melee';
      if (makerColor) makerColor.value = '#ffffff';
      if (makerOutlineColor) makerOutlineColor.value = '#000000';
      if (makerHealthTextColor) makerHealthTextColor.value = '#000000';
      if (makerWeaponPreview) { makerWeaponPreview.src=''; makerWeaponPreview.style.display='none'; delete makerWeaponPreview.dataset.uploadUrl; }
      if (makerProjPreview) { makerProjPreview.src=''; makerProjPreview.style.display='none'; delete makerProjPreview.dataset.uploadUrl; }
      if (makerIconPreview) { makerIconPreview.src=''; makerIconPreview.style.display='none'; delete makerIconPreview.dataset.uploadUrl; }
      if (makerWeaponTex) makerWeaponTex.value = '';
      if (makerProjTex) makerProjTex.value = '';
      if (makerIconTex) makerIconTex.value = '';
      if (makerWeaponSize) makerWeaponSize.value = '1';
      if (makerWeaponLength) makerWeaponLength.value = '1';
      if (makerWeaponOffset) makerWeaponOffset.value = '0.6';
      if (makerWeaponRotation) makerWeaponRotation.value = '0';
      if (makerProjSize) makerProjSize.value = '1';
      if (makerProjLength) makerProjLength.value = '1';
      if (makerProjRotation) makerProjRotation.value = '0';
      if (makerBallSize) makerBallSize.value = '35';
      if (makerBallSpeed) makerBallSpeed.value = '0.15';
      if (makerSpinSpeed) makerSpinSpeed.value = '0.05';
      // NEW: reset bounces (default 0)
      if (makerProjBounces) makerProjBounces.value = '0';
      // reset sounds
      makerHitSoundUrl = ''; makerShootSoundUrl = '';
      if (makerHitSound) makerHitSound.value = '';
      if (makerShootSound) makerShootSound.value = '';
      // NEW: also clear editing state so next Save creates a new custom
      makerEditingId = null;
      // Refresh preview and main game
      resetMainGameNow();
      // NEW: also reset the preview ball to defaults and re-center it
      resetMakerPreview();
      resizeMakerArena();
    });

    // NEW: Reset preview ball/projectiles to defaults without touching textures or rules
    function resetMakerPreview() {
        if (!makerBall || !makerArenaCanvas) return;
        // Fully reset all preview properties based on current editor controls
        const r = parseFloat(makerBallSize?.value || '35');
        const spin = parseFloat(makerSpinSpeed?.value || '0.05');
        const color = makerColor?.value || '#ffffff';
        const outline = document.getElementById('makerOutlineColor')?.value || '#000000';
        const healthText = document.getElementById('makerHealthTextColor')?.value || '#000000';
        // Center the ball
        makerBall.x = makerArenaCanvas.width * 0.5;
        makerBall.y = makerArenaCanvas.height * 0.5;
        // Kinematics
        makerBall.vx = 0;
        makerBall.vy = 0;
        makerBall.a = 0;
        // Visual/Gameplay props
        makerBall.r = r;
        makerBall.spin = spin;
        makerBall.color = color;
        makerBall.outlineColor = outline;
        makerBall.healthTextColor = healthText;
        makerBall.health = 100;
        // Clear projectiles and timers
        makerProjectiles.length = 0;
        makerFireTimerMs = 0;
    }

    // NEW: Load real leaderboard data from Websim
    async function loadLeaderboardData() {
        const leaderboardList = document.getElementById('leaderboard-list');
        
        try {
            leaderboardList.innerHTML = '<div class="leaderboard-loading">Loading leaderboard...</div>';
            
            // Get current project info
            const project = await window.websim.getCurrentProject();
            const projectId = project.id;

            // Helper: fetch a paginated endpoint to the end
            async function fetchAllPages(urlBuilder) {
                const all = [];
                let after = null;
                let hasNext = true;
                while (hasNext) {
                    const { url } = urlBuilder(after);
                    const resp = await fetch(url);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const data = await resp.json();
                    const page = (data && data.comments && data.comments.data) ? data.comments.data : [];
                    all.push(...page);
                    const meta = data && data.comments && data.comments.meta ? data.comments.meta : {};
                    hasNext = !!meta.has_next_page;
                    after = meta.end_cursor || null;
                }
                return all;
            }

            // 1) Get all top-level tip comments
            const tipTopLevel = await fetchAllPages((after) => {
                const params = new URLSearchParams();
                params.append('only_tips', 'true');
                params.append('first', '100');
                if (after) params.append('after', after);
                return { url: `/api/v1/projects/${projectId}/comments?${params}` };
            });

            // 2) Also include tip replies.
            //    We need the IDs of all top-level comments (not just tips), then fetch all replies under each and pick the ones with tips.
            const allTopLevel = await fetchAllPages((after) => {
                const params = new URLSearchParams();
                params.append('first', '100');
                if (after) params.append('after', after);
                return { url: `/api/v1/projects/${projectId}/comments?${params}` };
            });

            // Fetch replies for any comment with replies > 0 (paginate replies as well)
            async function fetchAllRepliesFor(commentId) {
                return fetchAllPages((after) => {
                    const params = new URLSearchParams();
                    params.append('first', '100');
                    if (after) params.append('after', after);
                    return { url: `/api/v1/projects/${projectId}/comments/${commentId}/replies?${params}` };
                });
            }

            const topLevelWithReplies = allTopLevel.filter(entry => (entry.comment && entry.comment.reply_count > 0));
            const repliesArrays = await Promise.all(topLevelWithReplies.map(entry => fetchAllRepliesFor(entry.comment.id)));
            const allRepliesFlat = repliesArrays.flat();

            // 3) Combine tip comments: top-level tips + tip replies
            const tipReplies = allRepliesFlat.filter(entry => {
                const c = entry && entry.comment;
                return c && c.card_data && c.card_data.type === 'tip_comment';
            });

            const allTipEntries = [...tipTopLevel, ...tipReplies];

            // 4) Aggregate by author.id (not username) to avoid undercounting when users change names
            const tipsByUserId = new Map();
            allTipEntries.forEach(entry => {
                const comment = entry.comment;
                if (!comment || !comment.card_data || comment.card_data.type !== 'tip_comment') return;
                const author = comment.author || {};
                const uid = author.id || `unknown_${author.username || 'unknown'}`;
                const username = author.username || 'unknown';
                const credits = comment.card_data.credits_spent || 0;

                const prev = tipsByUserId.get(uid);
                if (!prev) {
                    tipsByUserId.set(uid, { userId: uid, username, totalCredits: credits });
                } else {
                    prev.totalCredits += credits;
                    // Keep the latest known username for display
                    if (username && prev.username !== username) prev.username = username;
                }
            });

            // 5) Sort and take top 10
            const leaderboardData = Array.from(tipsByUserId.values())
                .sort((a, b) => b.totalCredits - a.totalCredits)
                .slice(0, 10);

            if (leaderboardData.length > 0) {
                leaderboardList.innerHTML = leaderboardData.map((item, index) => {
                    const avatarUrl = `https://images.websim.com/avatar/${encodeURIComponent(item.username)}`;
                    return `
                        <div class="leaderboard-item">
                            <span class="rank">${index + 1}.</span>
                            <span class="username">
                                <img class="avatar" src="${avatarUrl}" alt="@${item.username}" />
                                @${item.username}
                            </span>
                            <span class="amount">${item.totalCredits} credits</span>
                        </div>
                    `;
                }).join('');
            } else {
                leaderboardList.innerHTML = `
                    <div class="leaderboard-item">
                        <span class="username" style="text-align: center; width: 100%;">No tips found</span>
                    </div>
                `;
            }

            // Listen for real-time new comments (top-level or replies) to keep leaderboard fresh
            window.websim.addEventListener('comment:created', (data) => {
                const c = data && data.comment;
                if (!c) return;
                if (c.card_data && c.card_data.type === 'tip_comment') {
                    // Re-load to include this new tip
                    loadLeaderboardData();
                }
            });
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            leaderboardList.innerHTML = `
                <div class="leaderboard-item">
                    <span class="username" style="text-align: center; width: 100%; color: #f44336;">Failed to load leaderboard</span>
                </div>
            `;
        }
    }

    // Show Projectile Texture only for ranged type
    const syncProjRow = () => {
        if (makerProjRow) makerProjRow.style.display = (makerType?.value === 'ranged') ? '' : 'none';
        // Also toggle the moved projectile controls under arena
        const projCtrls = document.getElementById('makerProjControls');
        if (projCtrls) projCtrls.style.display = (makerType?.value === 'ranged') ? '' : 'none';
        // Conditionally show Fire Rate in Stats when ranged
        if (makerFireRateSlot && makerProjFireRate) {
          makerFireRateSlot.style.display = (makerType?.value === 'ranged') ? 'flex' : 'none';
        }
        if (makerBouncesSlot && makerProjBounces) {
          makerBouncesSlot.style.display = (makerType?.value === 'ranged') ? 'flex' : 'none';
        }
        // Toggle shoot sound row for ranged
        if (makerShootSoundRow) makerShootSoundRow.style.display = (makerType?.value === 'ranged') ? '' : 'none';
        // Do NOT rebuild Stats here to avoid wiping user-entered lines; preserve as-is
    };
    makerType?.addEventListener('change', () => { syncProjRow(); resetMainGameNow(); }); // NEW: reset on type change
    makerName?.addEventListener('input', () => { resetMainGameNow(); });                  // NEW: reset on name change
    syncProjRow();

    const makerWeaponClear = document.getElementById('makerWeaponClear');
    if (makerWeaponClear) {
        makerWeaponClear.addEventListener('click', async () => {
            if (makerWeaponPreview) { makerWeaponPreview.src = ''; makerWeaponPreview.style.display = 'none'; delete makerWeaponPreview.dataset.uploadUrl; }
            if (makerWeaponTex) makerWeaponTex.value = '';
            makerWeaponClear.style.display = 'none';
            resetMainGameNow();
        });
    }
    const makerProjClear = document.getElementById('makerProjClear');
    if (makerProjClear) {
        makerProjClear.addEventListener('click', async () => {
            if (makerProjPreview) { makerProjPreview.src = ''; makerProjPreview.style.display = 'none'; delete makerProjPreview.dataset.uploadUrl; }
            if (makerProjTex) makerProjTex.value = '';
            makerProjClear.style.display = 'none';
            resetMainGameNow();
        });
    }
    const makerIconClear = document.getElementById('makerIconClear');
    if (makerIconClear) {
        makerIconClear.addEventListener('click', async () => {
            if (makerIconPreview) { makerIconPreview.src = ''; makerIconPreview.style.display = 'none'; delete makerIconPreview.dataset.uploadUrl; }
            if (makerIconTex) makerIconTex.value = '';
            makerIconClear.style.display = 'none';
        });
    }

    // NEW: declare resize observer and RAF holder for the custom maker arena
    let makerResizeObserver = null;
    let makerResizeRAF = null;

    // Side arena simulation (no gravity) for live preview
    function startMakerArena() {
        if (!makerArenaCtx || !makerArenaCanvas) return;
        // Move Fire Rate control into Stats slot (label + input)
        if (makerFireRateSlot && makerProjFireRate && !makerFireRateSlot._inited) {
          const lab = document.createElement('label'); lab.style.minWidth = '80px'; lab.textContent = 'Fire rate';
          makerFireRateSlot.appendChild(lab);
          makerFireRateSlot.appendChild(makerProjFireRate);
          makerProjFireRate.style.display = '';
          makerFireRateSlot._inited = true;
        }
        // Static, larger preview ball (no motion)
        const MAKER_DEFAULT_RADIUS = 35;
        const MAKER_DEFAULT_HEALTH = 100;
        makerBall = { x: makerArenaCanvas.width/2, y: makerArenaCanvas.height/2, vx: 0, vy: 0, r: MAKER_DEFAULT_RADIUS, a: 0, health: MAKER_DEFAULT_HEALTH, color: (makerColor?.value || '#ffffff'), spin: parseFloat(makerSpinSpeed?.value || `${MAKER_DEFAULT_RADIUS}`), outlineColor: (makerOutlineColor?.value || '#000000'), healthTextColor: (makerHealthTextColor?.value || '#000000') };
        resizeMakerArena();
        cancelAnimationFrame(makerArenaRAF);
        tickMakerArena();
        // Wire Reset Preview button
        if (makerResetPreviewBtn) {
            // Ensure the Reset button is placed under the arena controls container
            const under = document.getElementById('makerControlsUnderArena');
            if (under && makerResetPreviewBtn.parentElement !== under) {
                under.appendChild(makerResetPreviewBtn);
            }
            makerResetPreviewBtn.onclick = async () => {
                await playClickSound();
                resetMakerPreview();
            };
        }
        // When entering the maker, if a texture already exists, make sure the X is visible
        const clearBtn = document.getElementById('makerWeaponClear');
        if (makerWeaponPreview && makerWeaponPreview.src) {
            if (clearBtn) clearBtn.style.display = 'inline-flex';
            makerWeaponPreview.style.display = 'inline-block';
        }
        const projClr = document.getElementById('makerProjClear');
        if (makerProjPreview && makerProjPreview.src) {
            if (projClr) projClr.style.display = 'inline-flex';
            makerProjPreview.style.display = 'inline-block';
        }
        const iconClr = document.getElementById('makerIconClear');
        if (makerIconPreview && makerIconPreview.src) {
            if (iconClr) iconClr.style.display = 'inline-flex';
            makerIconPreview.style.display = 'inline-block';
        }

        // Debounced resize handling to prevent ResizeObserver loop warnings
        const scheduleMakerResize = () => {
            if (makerResizeRAF) cancelAnimationFrame(makerResizeRAF);
            makerResizeRAF = requestAnimationFrame(() => {
                makerResizeRAF = null;
                resizeMakerArena();
            });
        };

        window.addEventListener('resize', scheduleMakerResize);

        // Observe only the right-side arena frame to reduce feedback loops
        const rightFrame = document.getElementById('custom-maker-arena');
        if (rightFrame) {
            makerResizeObserver = new ResizeObserver(() => scheduleMakerResize());
            makerResizeObserver.observe(rightFrame);
            if (makerContentEl) makerResizeObserver.observe(makerContentEl); // also observe main frame height
        }
    }
    function stopMakerArena() {
        if (makerArenaRAF) cancelAnimationFrame(makerArenaRAF);
        makerArenaRAF = null;
        window.removeEventListener('resize', resizeMakerArena); // remove old direct listener (if any)
        // NEW: also remove the debounced listener
        window.removeEventListener('resize', () => {}); // no-op cleanup guard
        if (makerResizeObserver) {
            try { makerResizeObserver.disconnect(); } catch {}
            makerResizeObserver = null;
        }
        if (makerResizeRAF) {
            cancelAnimationFrame(makerResizeRAF);
            makerResizeRAF = null;
        }
    }
    function refreshMakerArenaConfig() { /* textures applied on next frame automatically */ }
    function tickMakerArena() {
        const c = makerArenaCanvas, ctx = makerArenaCtx, b = makerBall; if (!c||!ctx||!b) return;
        // Move and bounce ball
        b.x += (b.vx ?? 0); b.y += (b.vy ?? 0);
        if (b.x - b.r < 2) { b.x = 2 + b.r; b.vx = Math.abs(b.vx || 0); }
        if (b.x + b.r > c.width - 2) { b.x = c.width - 2 - b.r; b.vx = -Math.abs(b.vx || 0); }
        if (b.y - b.r < 2) { b.y = 2 + b.r; b.vy = Math.abs(b.vy || 0); }
        if (b.y + b.r > c.height - 2) { b.y = c.height - 2 - b.r; b.vy = -Math.abs(b.vy || 0); }

        // Spin
        b.a = (b.a || 0) + (b.spin || 0.05);

        // Ranged projectile sim (match in-game maker ranged config)
        if (makerType?.value === 'ranged') {
            const fireMs = Math.max(50, parseFloat(makerProjFireRate?.value || '600'));
            makerFireTimerMs += 16; // ~60fps
            while (makerFireTimerMs >= fireMs) {
                makerFireTimerMs -= fireMs;
                const ca = Math.cos(b.a), sa = Math.sin(b.a);
                const offsetMul = parseFloat(makerWeaponOffset?.value || '0.6');
                const spawnX = b.x + ca * (b.r * offsetMul + 42);
                const spawnY = b.y + sa * (b.r * offsetMul + 42);
                makerProjectiles.push({
                    x: spawnX, y: spawnY,
                    vx: ca * 10, vy: sa * 10,
                    a: b.a + (parseFloat(makerProjRotation?.value || '0') * Math.PI/180),
                    life: 180
                });
            }
            // Update projectiles
            let keep = 0;
            for (let i = 0; i < makerProjectiles.length; i++) {
                const p = makerProjectiles[i];
                p.x += p.vx; p.y += p.vy; p.life--;
                // act like arrows: no bouncing, remove on contact with borders
                if (p.x < 4 || p.x > c.width - 4 || p.y < 4 || p.y > c.height - 4) { p.life = 0; }
                if (p.life > 0) makerProjectiles[keep++] = p;
            }
            makerProjectiles.length = keep;
        }

        // Draw arena and ball
        ctx.clearRect(0,0,c.width,c.height);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,c.width,c.height);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeRect(2,2,c.width-4,c.height-4);
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fillStyle = b.color || '#ffffff'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = b.outlineColor || '#000'; ctx.stroke();
        const computed = Math.round(b.r * 1.1);
        const healthFontSize = Math.max(24, Math.min(72, computed));
        ctx.font = `${healthFontSize}px Anton, sans-serif`;
        ctx.fillStyle = b.healthTextColor || '#000';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(b.health || 100), b.x, b.y + 6);

        // Draw weapon (same math as in-game CustomWeapon)
        if (makerWeaponPreview && makerWeaponPreview.src && makerWeaponPreview.complete && makerWeaponPreview.naturalWidth > 0) {
            const sizeMul = parseFloat(makerWeaponSize?.value || '1');
            const lenMul = parseFloat(makerWeaponLength?.value || '1');
            const offsetMul = parseFloat(makerWeaponOffset?.value || '0.6');
            const rotOff = ((parseFloat(makerWeaponRotation?.value || '0') || 0) * Math.PI / 180);
            const w = 100 * sizeMul * lenMul; // same base width as CustomWeapon
            const h = w * (makerWeaponPreview.naturalHeight / makerWeaponPreview.naturalWidth);
            const attach = b.r * offsetMul;
            const ca = Math.cos(b.a), sa = Math.sin(b.a);
            const px = b.x + ca * attach, py = b.y + sa * attach;
            ctx.save(); ctx.translate(px, py); ctx.rotate(b.a + rotOff);
            ctx.drawImage(makerWeaponPreview, 0, -h/2, w, h);
            ctx.restore();
        }

        // Draw projectiles for ranged preview
        if (makerType?.value === 'ranged') {
            const projImg = makerProjPreview && makerProjPreview.complete && makerProjPreview.naturalWidth > 0 ? makerProjPreview : null;
            const sizeMul = parseFloat(makerProjSize?.value || '1');
            const lenMul = parseFloat(makerProjLength?.value || '1');
            makerProjectiles.forEach(p => {
                const baseW = 72 * sizeMul * lenMul;
                const h = projImg ? (baseW * (projImg.naturalHeight / projImg.naturalWidth)) : (baseW * 0.5);
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a || 0);
                if (projImg) {
                    ctx.drawImage(projImg, -baseW/2, -h/2, baseW, h);
                } else {
                    ctx.fillStyle = '#444'; ctx.fillRect(-baseW/2, -h/2, baseW, h);
                }
                ctx.restore();
            });
        }

        makerArenaRAF = requestAnimationFrame(tickMakerArena);
    }

    // NEW: helper to apply a stats array back into the editor immediately (prevents UI-clearing side effects)
    function applyStatsToEditor(statsArr) {
      if (!makerStatsLines) return;
      const list = Array.isArray(statsArr) ? statsArr : [];
      statLinesCount = Math.max(1, list.length || 1);
      rebuildStatLines();
      if (list.length) {
        const rows = Array.from(makerStatsLines.children);
        list.forEach((s, i) => {
          const row = rows[i]; if (!row) return;
          const parts = row.querySelectorAll('select,input');
          // [op, field, amount, when, seconds]
          if (parts[0]) parts[0].value = s.op || '';
          if (parts[1]) parts[1].value = s.field || '';
          if (parts[2]) parts[2].value = Number.isFinite(s.amount) ? String(s.amount) : (s.amount || '');
          if (parts[3]) parts[3].value = s.when || '';
          if (parts[4]) {
            parts[4].style.display = (s.when === 'every X seconds') ? '' : 'none';
            parts[4].value = Number.isFinite(s.seconds) ? String(s.seconds) : (s.seconds || '');
          }
        });
      }
    }
}