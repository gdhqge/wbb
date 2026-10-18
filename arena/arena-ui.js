// UI spacing and class helpers (extracted from the monolith)

export function applyArenaSizeClasses(gameContainer, sizeLabel) {
  gameContainer.classList.remove('arena-small', 'arena-medium', 'arena-large', 'arena-huge', 'arena-massive', 'zoom-extra');
  if (sizeLabel === 'small') {
    gameContainer.classList.add('arena-small');
  } else if (sizeLabel === 'medium') {
    gameContainer.classList.add('arena-medium');
  } else if (sizeLabel === 'large') {
    gameContainer.classList.add('arena-large');
  } else if (sizeLabel === 'huge' || sizeLabel === 'shrinking') {
    gameContainer.classList.add('arena-huge');
    gameContainer.classList.add('zoom-extra'); // extra zoom only while huge
  } else if (sizeLabel === 'massive') {
    gameContainer.classList.add('arena-massive');
    gameContainer.classList.add('zoom-extra');
  }
}

// Adjust bottom button row spacing based on canvas height
export function updateControlsSpacing(curH) {
  const controls = document.getElementById('controls');
  if (!controls) return;

  // NEW: much gentler scaling to avoid huge gaps on Shrinking/Huge
  // But check if we're in shrinking/huge mode and override with CSS instead
  const gameContainer = document.getElementById('game-container');
  if (gameContainer && gameContainer.classList.contains('zoom-extra')) {
    // Let CSS handle the spacing for huge/shrinking arenas
    controls.style.marginTop = '';
    return;
  }

  const mt = Math.round(Math.max(12, Math.min(50, 10 + curH * 0.03)));
  controls.style.marginTop = `${mt}px`;
}

// Adapt top controls and VS spacing to canvas geometry
export function updateUIForCanvas(curW, curH) {
  const gameContainer = document.getElementById('game-container');
  const versusDisplay = document.getElementById('versus-display');
  const topControls = document.getElementById('top-controls');

  const h = Math.max(380, Math.min(1100, curH));

  const vsMargin = Math.round(14 + (h - 380) * (24 - 14) / (1100 - 380));
  const topOffsetAtSmall = -35;
  const topOffsetAtHuge = -75;
  const topOffset = Math.round(topOffsetAtSmall + (h - 380) * (topOffsetAtHuge - topOffsetAtSmall) / (1100 - 380));

  if (versusDisplay) versusDisplay.style.marginBottom = `${vsMargin}px`;
  if (topControls) topControls.style.transform = `translateY(${topOffset}px)`;

  if (gameContainer) {
    if (curW > 900) {
      gameContainer.classList.add('zoom-extra');
    } else {
      gameContainer.classList.remove('zoom-extra');
    }
  }
}