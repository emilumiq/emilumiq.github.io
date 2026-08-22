/**
 * Shared card rendering for watchlist cards on both
 * the main page and the /watching page.
 */

export type Entry = {
  title: string;
  image: string | null;
  media_type: string;
  score: number | null;
  status: string | null;
  progress: number | null;
  max_progress: number | null;
  url: string;
};

const TYPE_LABELS: Record<string, string> = {
  tv: 'series',
  anime: 'anime',
  movie: 'movie',
  manga: 'manga',
  game: 'game',
  book: 'book',
};

/**
 * Create a watchlist card.
 *
 * @param mode  'scroller' — horizontal scroll (main page)
 *              'grid'     — responsive grid (watching page)
 */
export function createCard(
  entry: Entry,
  mode: 'scroller' | 'grid' = 'scroller',
): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = entry.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = mode === 'scroller'
    ? 'group block shrink-0 w-40 sm:w-48'
    : 'group block';

  // Poster container
  const poster = document.createElement('div');
  poster.className =
    'relative aspect-[2/3] overflow-hidden rounded-sm border border-line bg-surface';

  if (entry.image) {
    const img = document.createElement('img');
    img.src = entry.image;
    img.alt = entry.title;
    img.loading = 'lazy';
    img.className =
      'h-full w-full object-cover transition duration-300 group-hover:scale-105';
    poster.append(img);
  }

  const progress = entry.progress ?? 0;
  const maxProg = entry.max_progress;
  const isComplete =
    entry.status === 'Completed' || entry.media_type === 'movie';

  // Top-left: checkmark (completed) or type badge
  if (isComplete) {
    const check = document.createElement('span');
    check.className =
      'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-accent text-sm font-bold backdrop-blur-sm';
    check.textContent = '✓';
    poster.append(check);
  } else {
    const typeBadge = document.createElement('span');
    typeBadge.className =
      'absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white backdrop-blur-sm';
    typeBadge.textContent = TYPE_LABELS[entry.media_type] ?? entry.media_type;
    poster.append(typeBadge);
  }

  // Top-right: score badge
  if (entry.score != null) {
    const badge = document.createElement('span');
    badge.className =
      'absolute right-2 top-2 rounded px-2 py-0.5 text-xs font-bold bg-amber-500 text-black shadow';
    badge.textContent = `★ ${entry.score}`;
    poster.append(badge);
  }

  // Bottom: progress bar (TV / anime only)
  if (progress > 0 && entry.media_type !== 'movie') {
    const gradient = document.createElement('div');
    gradient.className =
      'absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/80 to-transparent';

    const bar = document.createElement('div');
    bar.className = 'absolute bottom-0 left-0 h-1.5 bg-accent';
    if (maxProg && maxProg > 0) {
      bar.style.width = `${Math.min(100, (progress / maxProg) * 100)}%`;
    } else {
      bar.style.width = '100%';
    }

    const count = document.createElement('span');
    count.className =
      'absolute bottom-1.5 right-2 text-xs font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]';
    count.textContent = maxProg ? `${progress} / ${maxProg}` : `${progress} ep`;

    gradient.append(bar);
    poster.append(gradient);
    poster.append(count);
  }

  // Title
  const title = document.createElement('p');
  title.className =
    'mt-2 truncate text-sm font-medium text-foreground group-hover:text-accent';
  title.textContent = entry.title;

  // Type label
  const sub = document.createElement('p');
  sub.className = 'text-xs text-muted';
  sub.textContent = TYPE_LABELS[entry.media_type] ?? entry.media_type;

  a.append(poster, title, sub);
  return a;
}

/** Show a fallback message inside a container. */
export function showFallback(container: HTMLElement, message: string) {
  container.replaceChildren();
  const box = document.createElement('div');
  box.className = 'border border-line bg-surface px-5 py-8 text-center';
  const p = document.createElement('p');
  p.className = 'text-sm text-muted';
  p.textContent = message;
  box.append(p);
  container.append(box);
}
