import { playClickSound } from './audio.js';
import { resetSelections, setupUI, setupFFABallSelection, setupTeamsBallSelection } from './ui.js';
import { setMode as setStateMode, setFFACount } from './state.js';
import { setGameMode } from './game.js';
import { collapseAllSizePanels } from './arena-sizing.js';
import { resetGame } from './game.js';

let currentGamemode = 'classic';
let previousGamemode = 'classic';
let gamemodesTitleElement = null;
let gamemodesTitleHue = 0;
let gamemodesTitleAnimationFrameId = null;

export function setupGamemodeManagement() {
    const gamemodesButton = document.getElementById('gamemodesButton');
    const gamemodesMenu = document.getElementById('gamemodes-menu');
    const backButton = document.getElementById('backButton');
    const classicButton = document.getElementById('classicButton');
    const freeForAllButton = document.getElementById('freeForAllButton');
    const teamsButton = document.getElementById('teamsButton');
    const gameContainer = document.getElementById('game-container');
    const gamemodesTitle = document.querySelector('#gamemodes-menu h1');

    // NEW: Boss mode elements
    const bossButton = document.getElementById('bossButton');

    gamemodesTitleElement = gamemodesTitle;

    gamemodesButton.addEventListener('click', async () => {
        await playClickSound();

        previousGamemode = currentGamemode;

        gameContainer.style.display = 'none';

        gamemodesMenu.style.display = 'flex';
        gamemodesMenu.style.opacity = '1';
        gamemodesMenu.style.pointerEvents = 'auto';

        startGamemodesTitleRainbowAnimation();
    });

    backButton.addEventListener('click', async () => {
        await playClickSound();

        setGamemode(previousGamemode);

        gamemodesMenu.style.display = 'none';
        gamemodesMenu.style.opacity = '0';
        gamemodesMenu.style.pointerEvents = 'none';
        stopGamemodesTitleRainbowAnimation();
        collapseAllSizePanels();

        gameContainer.style.display = 'flex';
        gameContainer.style.opacity = '1';
    });

    classicButton.addEventListener('click', async () => {
        await playClickSound();
        setGamemode('classic');
        const arenaSizeSelection = document.getElementById('arena-size-selection');
        const willExpand = !arenaSizeSelection.classList.contains('expanded');
        collapseAllSizePanels();
        if (willExpand) arenaSizeSelection.classList.add('expanded');
        gameContainer.classList.remove('sliding-out-left');
    });

    freeForAllButton.addEventListener('click', async () => {
        await playClickSound();
        setGamemode('ffa');
        const arenaSizeSelectionFFA = document.getElementById('arena-size-selection-ffa');
        const willExpand = !arenaSizeSelectionFFA.classList.contains('expanded');
        collapseAllSizePanels();
        if (willExpand) arenaSizeSelectionFFA.classList.add('expanded');
    });

    teamsButton.addEventListener('click', async () => {
        await playClickSound();
        setGamemode('teams');
        const arenaSizeSelectionTeams = document.getElementById('arena-size-selection-teams');
        const willExpand = !arenaSizeSelectionTeams.classList.contains('expanded');
        collapseAllSizePanels();
        if (willExpand) arenaSizeSelectionTeams.classList.add('expanded');
    });

    // NEW: Boss mode nav
    bossButton.addEventListener('click', async () => {
        await playClickSound();
        setGamemode('boss');
        const arenaSizeSelectionBoss = document.getElementById('arena-size-selection-boss');
        const willExpand = !arenaSizeSelectionBoss.classList.contains('expanded');
        collapseAllSizePanels();
        if (willExpand) arenaSizeSelectionBoss.classList.add('expanded');
    });

    function setGamemode(mode) {
        if (currentGamemode !== mode) {
            resetSelections();
            currentGamemode = mode;
        }
        setStateMode(mode);
        setGameMode(mode);
        
        const versusDisplay = document.getElementById('versus-display');
        const rightSelectionBox = document.getElementById('selection-box-right');
        const damageInfoWrapper = document.getElementById('damage-info-wrapper');
        
        if (mode === 'ffa') {
            versusDisplay.style.display = 'none';
            rightSelectionBox.style.display = 'none';
            setupFFABallSelection(() => resetGame(document.getElementById('gameCanvas').width, document.getElementById('gameCanvas').height));
            damageInfoWrapper.style.display = 'none';
        
        } else if (mode === 'teams') {
            versusDisplay.style.display = 'none';
            rightSelectionBox.style.display = 'flex';
            setupTeamsBallSelection(() => resetGame(document.getElementById('gameCanvas').width, document.getElementById('gameCanvas').height));
            damageInfoWrapper.style.display = 'none';

        } else if (mode === 'boss') {
            // NEW: Boss Fight replicates teams layout but right side is a single boss picker
            versusDisplay.style.display = 'none';
            rightSelectionBox.style.display = 'flex';
            // Use specialized boss selection
            import('./ui/ffa-selection.js').then(mod => {
                mod.setupBossBallSelection(() => resetGame(document.getElementById('gameCanvas').width, document.getElementById('gameCanvas').height));
            });
            damageInfoWrapper.style.display = 'none';
            
        } else {
            versusDisplay.style.display = 'flex';
            rightSelectionBox.style.display = 'flex';
            damageInfoWrapper.style.display = 'flex';
            damageInfoWrapper.style.flexDirection = 'row';
            damageInfoWrapper.style.position = 'relative';
            damageInfoWrapper.style.left = 'auto';
            damageInfoWrapper.style.right = 'auto';
            damageInfoWrapper.style.top = 'auto';
            damageInfoWrapper.style.width = 'auto';
            damageInfoWrapper.style.height = 'auto';
            damageInfoWrapper.style.justifyContent = 'space-between';
            damageInfoWrapper.style.alignItems = 'center';
            damageInfoWrapper.style.paddingTop = '0';
            damageInfoWrapper.style.marginTop = '5px';
            damageInfoWrapper.style.zIndex = 'auto';
            
            setupUI(() => resetGame(document.getElementById('gameCanvas').width, document.getElementById('gameCanvas').height));
        }
    }

    function animateGamemodesTitleRainbow() {
        if (!gamemodesTitleElement) return;
        gamemodesTitleHue = (gamemodesTitleHue + 1) % 360;
        gamemodesTitleElement.style.color = `hsl(${gamemodesTitleHue}, 100%, 50%)`;
        gamemodesTitleAnimationFrameId = requestAnimationFrame(animateGamemodesTitleRainbow);
    }

    function startGamemodesTitleRainbowAnimation() {
        if (!gamemodesTitleAnimationFrameId) {
            animateGamemodesTitleRainbow();
        }
    }

    function stopGamemodesTitleRainbowAnimation() {
        if (gamemodesTitleAnimationFrameId) {
            cancelAnimationFrame(gamemodesTitleAnimationFrameId);
            gamemodesTitleAnimationFrameId = null;
        }
    }
}

export function getCurrentGamemode() {
    return currentGamemode;
}