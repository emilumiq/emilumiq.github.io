const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

let hideTimer: number | undefined;
let removeTimer: number | undefined;

export function showToast(message: string): void {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }

  window.clearTimeout(hideTimer);
  window.clearTimeout(removeTimer);
  host.replaceChildren();

  const toast = document.createElement('div');
  toast.className =
    'toast pointer-events-auto flex items-center gap-3 rounded-lg bg-elevated px-4 py-3 text-meta font-medium text-ink shadow-small';
  const icon = document.createElement('span');
  icon.className = 'grid size-5 shrink-0 place-items-center rounded-full bg-accent text-on-accent';
  icon.innerHTML = CHECK_SVG;
  const text = document.createElement('span');
  text.textContent = message;
  toast.append(icon, text);
  host.append(toast);

  requestAnimationFrame(() => toast.classList.add('toast-in'));
  hideTimer = window.setTimeout(() => {
    toast.classList.remove('toast-in');
    removeTimer = window.setTimeout(() => toast.remove(), 200);
  }, 1800);
}
