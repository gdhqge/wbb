// Centralized constants for arena sizes and shrinking timings
export const ARENA_SIZES = {
  SMALL:  { w: 380,  h: 380  },
  MEDIUM: { w: 520,  h: 520  },
  LARGE:  { w: 900,  h: 900  }, // Increased: was 660x660
  HUGE:   { w: 1100, h: 1100 },
  MASSIVE:{ w: 1800, h: 1800 }, // NEW: even more massive (icon unchanged)
  CUSTOM: { w: 1120, h: 1120 } // 16 x (2 * 35px) so 1 tile = 1 ball diameter
};

// Timings (faster per user request)
export const HOLD_MS = 8000;      // was 30000
export const TRANSITION_MS = 2000; // was 5000