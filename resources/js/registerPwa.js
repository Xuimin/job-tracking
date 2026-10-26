/** Register the service worker from the Vite PWA build output (production only). */
export function registerPwa() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/build/sw.js', { scope: '/' }).catch(() => {});
  });
}
