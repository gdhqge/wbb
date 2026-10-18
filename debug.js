// Lightweight debug utilities for Shield collision verification.
// Enable by adding ?debugShield=1 to the URL.

let cachedFlag = null;

export function isShieldDebugEnabled() {
  if (cachedFlag !== null) return cachedFlag;
  try {
    const usp = new URLSearchParams(window.location.search);
    cachedFlag = usp.get('debugShield') === '1';
    return cachedFlag;
  } catch {
    return false;
  }
}

export function logShield(...args) {
  if (!isShieldDebugEnabled()) return;
  // Prefix logs for easy filtering
  console.debug('[ShieldDebug]', ...args);
}