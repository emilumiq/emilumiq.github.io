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
  progressed_at: string | null;
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

const STATUS_COLORS: Record<string, string> = {
  'In progress': 'bg-emerald-500',
  Completed: 'bg-accent',
  Planning: 'bg-indigo-400',
  Paused: 'bg-amber-500',
  Dropped: 'bg-rose-400',
};

const PROGRESS_UNITS: Record<string, string> = {
  manga: 'ch',
};

function formatDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
    ? 'group block shrink-0 w-28 sm:w-36'
    : 'group block';

  // Poster
  const poster = document.createElement('div');
  poster.className = 'relative aspect-[2/3] overflow-hidden bg-surface border border-line';

  if (entry.image) {
    const img = document.createElement('img');
    img.src = entry.image;
    img.alt = entry.title;
    img.loading = 'lazy';
    img.className = 'h-full w-full object-cover transition duration-300 group-hover:opacity-80';
    poster.append(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'h-full w-full bg-line flex items-center justify-center text-muted text-xs';
    placeholder.textContent = TYPE_LABELS[entry.media_type] ?? entry.media_type;
    poster.append(placeholder);
  }

  const progress = entry.progress ?? 0;
  const maxProg = entry.max_progress;

  // Score badge (only the user's own score) — bottom-left dark chip
  if (entry.score != null && entry.score > 0) {
    const chip = document.createElement('div');
    chip.className = 'absolute bottom-1.5 left-1.5 z-10 rounded-sm bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-[0_1px_4px_rgba(0,0,0,0.7)]';
    chip.textContent = entry.score % 1 === 0 ? `${entry.score}` : entry.score.toFixed(1);
    poster.append(chip);
  }

  // Progress count — bottom-right with gradient
  if (progress > 0 && entry.media_type !== 'movie') {
    const hasMax = maxProg != null && maxProg > 0;

    const gradient = document.createElement('div');
    gradient.className = 'absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/70 to-transparent';

    const count = document.createElement('span');
    count.className = 'absolute bottom-1 right-2 text-[11px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]';
    count.textContent = hasMax
      ? `${progress}/${maxProg}`
      : `${progress} ${PROGRESS_UNITS[entry.media_type] ?? 'ep'}`;

    gradient.append(count);
    poster.append(gradient);
  }

  // Info block
  const info = document.createElement('div');
  info.className = 'mt-1.5 px-0.5';

  // Title
  const title = document.createElement('p');
  title.className = 'text-base font-medium text-foreground group-hover:text-accent transition-colors leading-snug line-clamp-2';
  title.textContent = entry.title;

  // Subtitle: status dot + type + date
  const sub = document.createElement('p');
  sub.className = 'mt-0.5 text-sm text-muted flex items-center justify-between gap-1';

  const subLeft = document.createElement('span');

  const statusColor = entry.status ? STATUS_COLORS[entry.status] : null;
  if (statusColor) {
    const dot = document.createElement('span');
    dot.className = `inline-block h-1.5 w-1.5 rounded-full align-middle mr-1 ${statusColor}`;
    dot.title = entry.status!;
    subLeft.append(dot);
  }

  subLeft.append(document.createTextNode(TYPE_LABELS[entry.media_type] ?? entry.media_type));

  const dateStr = formatDate(entry.progressed_at);

  sub.append(subLeft);

  if (dateStr) {
    const date = document.createElement('span');
    date.className = 'text-xs text-muted/60';
    date.textContent = dateStr;
    sub.append(date);
  }

  info.append(title, sub);
  a.append(poster, info);
  return a;
}

/** Show a fallback message inside a container. */
export function showFallback(container: HTMLElement, message: string) {
  container.replaceChildren();
  const box = document.createElement('div');
  box.className = 'px-5 py-8 text-center';
  const p = document.createElement('p');
  p.className = 'text-sm text-muted';
  p.textContent = message;
  box.append(p);
  container.append(box);
}

function entryTime(entry: Entry): number {
  if (!entry.progressed_at) return 0;
  const t = Date.parse(entry.progressed_at);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Carousel order: in progress and paused always first, the rest sorted by
 * recency with finished titles counting as COMPLETED_FRESH days newer — so
 * planning added today floats above a series finished a month ago, while
 * older completed ones stay near the top instead of sinking under hundreds
 * of backlog planning entries. Recency inside a group, title as tiebreak.
 */
const FIXED_RANK: Record<string, number> = {
  'In progress': 0,
  Paused: 1,
};

const COMPLETED_FRESH = 21 * 24 * 60 * 60 * 1000;

export function sortWatchlist(entries: Entry[]): Entry[] {
  const now = Date.now();
  const fixedOf = (e: Entry): number => FIXED_RANK[e.status ?? ''] ?? -1;
  const ageOf = (e: Entry): number => {
    const t = entryTime(e);
    return t > 0 ? now - t : Number.MAX_SAFE_INTEGER;
  };
  const byTimeThenTitle = (a: Entry, b: Entry): number => {
    const at = entryTime(a);
    const bt = entryTime(b);
    if (at !== bt) return bt - at;
    return a.title.localeCompare(b.title);
  };

  return [...entries].sort((a, b) => {
    const af = fixedOf(a);
    const bf = fixedOf(b);
    if (af !== bf) {
      const ar = af < 0 ? Number.MAX_SAFE_INTEGER : af;
      const br = bf < 0 ? Number.MAX_SAFE_INTEGER : bf;
      return ar - br;
    }
    if (af >= 0) return byTimeThenTitle(a, b);

    const ka = ageOf(a) - (a.status === 'Completed' ? COMPLETED_FRESH : 0);
    const kb = ageOf(b) - (b.status === 'Completed' ? COMPLETED_FRESH : 0);
    if (ka !== kb) return ka - kb;
    return a.title.localeCompare(b.title);
  });
}
