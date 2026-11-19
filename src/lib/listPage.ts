import { createCard, showFallback, type Entry } from './cards';
import { attachMenu } from './popover';

export type ListPageOptions = {
  load: () => Promise<Entry[]>;
  emptyMessage?: string;
  errorMessage?: string;
};

export function mountListPage({
  load,
  emptyMessage = 'nothing here',
  errorMessage = 'could not load the list',
}: ListPageOptions): void {
  const grid = document.getElementById('list-grid');
  const statusEl = document.getElementById('list-status');
  const filterRoot = document.querySelector<HTMLElement>('[data-status-filter]');
  if (!grid || !statusEl || !filterRoot) return;

  const label = filterRoot.querySelector<HTMLElement>('[data-status-label]');
  const menuItems = Array.from(filterRoot.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  attachMenu(filterRoot);

  let all: Entry[] = [];
  let current = '';

  const setCurrent = (value: string) => {
    current = value;
    const item = menuItems.find((i) => (i.dataset.value ?? '') === value);
    if (label && item) label.textContent = item.dataset.label ?? '';
    for (const i of menuItems) {
      i.setAttribute('aria-current', String((i.dataset.value ?? '') === value));
    }
  };

  const syncOptions = () => {
    const present = new Set(all.map((e) => e.status ?? ''));
    for (const item of menuItems) {
      const value = item.dataset.value ?? '';
      item.hidden = !!value && !present.has(value);
    }
    if (current && !present.has(current)) setCurrent('');
  };

  const render = () => {
    const filtered = current ? all.filter((e) => e.status === current) : all;
    if (filtered.length === 0) {
      showFallback(grid, all.length === 0 ? errorMessage : emptyMessage);
    } else {
      grid.replaceChildren(...filtered.map((e) => createCard(e)));
    }
    statusEl.textContent = filtered.length ? `${filtered.length}` : '';
  };

  const apply = (items: Entry[]) => {
    all = items;
    syncOptions();
    render();
  };

  for (const item of menuItems) {
    item.addEventListener('click', () => {
      setCurrent(item.dataset.value ?? '');
      render();
    });
  }

  const attempt = () => {
    statusEl.textContent = 'loading…';
    load()
      .then(apply)
      .catch(() => {
        all = [];
        statusEl.textContent = '';
        showFallback(grid, errorMessage, attempt);
      });
  };
  attempt();
}
