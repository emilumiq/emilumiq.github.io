/**
 * Repeat `fn` every `intervalMs` while the tab is visible, and once right
 * away when the tab becomes visible again.
 */
export function onVisibleInterval(intervalMs: number, fn: () => void): void {
  let timer: number | null = null;

  const stop = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    stop();
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') fn();
    }, intervalMs);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fn();
      start();
    } else {
      stop();
    }
  });

  start();
}
