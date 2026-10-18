// Utility to request fullscreen as soon as a user gesture occurs.
// Browsers require a user interaction; we call this from Start and from first click.
let triedFullscreen = false;

export async function ensureFullscreen() {
  if (triedFullscreen) return;
  triedFullscreen = true;

  const de = document.documentElement;
  try {
    if (!document.fullscreenElement) {
      if (de.requestFullscreen) {
        await de.requestFullscreen();
      } else if (de.webkitRequestFullscreen) {
        // Safari
        await de.webkitRequestFullscreen();
      } else if (de.msRequestFullscreen) {
        // Older Edge/IE
        await de.msRequestFullscreen();
      }
    }
  } catch (e) {
    // If it fails (e.g., blocked), don't spam more attempts this click.
    // We'll try again on the next user interaction.
    triedFullscreen = false;
    console.warn('Fullscreen request failed:', e);
  }
}