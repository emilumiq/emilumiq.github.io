/**
 * Shared behaviour for the /watching and /reading list pages:
 * status tabs, grid rendering and empty-state handling.
 */

import { createCard, showFallback, type Entry } from './cards';
import { onVisibleInterval } from './live';

export type ListPageOptions = {
  /** Resolves the full (unfiltered) list of entries. */
  load: () => Promise<Entry[]>;
  /** Re-run `load` on this interval to keep the list fresh. */
  refreshMs?: number;
  /** Message shown when the current filter matches nothing. */
  emptyMessage?: string;
  errorMessage?: string;
};

export function mountListPage({
  load,
  refreshMs,
  emptyMessage = 'nothing here',
  errorMessage = 'could not load the list',
}: ListPageOptions): void {
  const grid = document.getElementById('list-grid');
  const statusEl = document.getElementById('list-status');
  if (!grid || !statusEl) return;

  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.status-tab'));
  let all: Entry[] = [];
  let current = '';

  const setTabStyles = () => {
    for (const btn of tabs) {
      const active = (btn.dataset.status ?? '') === current;
      const empty = btn.classList.contains('is-empty');
      btn.className = `status-tab text-sm font-medium ${
        active ? 'status-tab-active' : 'status-tab-inactive'
      }${empty ? ' is-empty' : ''}`;
    }
  };

  const hideEmptyTabs = () => {
    const present = new Set(all.map((e) => e.status ?? ''));
    for (const btn of tabs) {
      const status = btn.dataset.status ?? '';
      if (status && !present.has(status)) btn.classList.add('is-empty');
      else btn.classList.remove('is-empty');
    }
  };

  const render = () => {
    const filtered = current ? all.filter((e) => e.status === current) : all;
    if (filtered.length === 0) {
      showFallback(grid, all.length === 0 ? errorMessage : emptyMessage);
    } else {
      grid.replaceChildren(...filtered.map((e) => createCard(e, 'grid')));
    }
    statusEl.textContent = filtered.length ? `${filtered.length}` : '';
  };

  const apply = (items: Entry[]) => {
    all = items;
    hideEmptyTabs();
    render();
  };

  for (const btn of tabs) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.status ?? '';
      if (next === current) return;
      current = next;
      setTabStyles();
      render();
    });
  }

  setTabStyles();

  load()
    .then(apply)
    .catch(() => {
      all = [];
      showFallback(grid, errorMessage);
      statusEl.textContent = '';
    });

  if (refreshMs) {
    onVisibleInterval(refreshMs, () => {
      load()
        .then(apply)
        .catch(() => {
          /* keep the last good list */
        });
    });
  }
}
