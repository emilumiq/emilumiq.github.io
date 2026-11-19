export function attachMenu(root: HTMLElement): void {
  const trigger = root.querySelector<HTMLButtonElement>('[data-menu-button]');
  const panel = root.querySelector<HTMLElement>('[data-menu-panel]');
  if (!trigger || !panel) return;

  const items = () =>
    Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter((i) => !i.hidden);

  const setOpen = (open: boolean) => {
    if (open) {
      panel.showPopover();
      const r = trigger.getBoundingClientRect();
      panel.style.top = `${r.bottom + 4}px`;
      panel.style.left = `${r.left}px`;
    } else {
      panel.hidePopover();
    }
    trigger.setAttribute('aria-expanded', String(open));
  };

  trigger.addEventListener('click', () => {
    const open = !panel.matches(':popover-open');
    setOpen(open);
    if (open) items()[0]?.focus();
  });

  panel.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[role="menuitem"]')) {
      setOpen(false);
      trigger.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target as Node) && panel.matches(':popover-open')) setOpen(false);
  });

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      trigger.focus();
      return;
    }
    const list = items();
    const idx = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(idx + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(idx - 1 + list.length) % list.length]?.focus();
    }
  });
}
