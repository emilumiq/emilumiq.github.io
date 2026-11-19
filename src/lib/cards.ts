import { RELOAD_SVG } from './icons';

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

const PROGRESS_UNITS: Record<string, string> = {
  manga: 'ch',
};

const STATUS_TEXT: Record<string, string> = {
  'In progress': 'text-[var(--status-current)]',
  Completed: 'text-accent',
  Planning: 'text-[var(--status-planning)]',
  Paused: 'text-[var(--status-paused)]',
  Dropped: 'text-[var(--status-dropped)]',
};

function statusLabel(entry: Entry): string | null {
  if (!entry.status) return null;
  if (entry.status === 'In progress') return entry.media_type === 'manga' ? 'reading' : 'watching';
  return entry.status.toLowerCase();
}

function formatDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function createCard(entry: Entry): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'group/card relative min-w-0';

  const poster = document.createElement('div');
  poster.className = 'relative overflow-hidden rounded-poster bg-skeleton';

  const a = document.createElement('a');
  a.className = 'block';
  a.href = entry.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  if (entry.image) {
    const img = document.createElement('img');
    img.src = entry.image;
    img.alt = entry.title;
    img.loading = 'lazy';
    img.width = 200;
    img.height = 280;
    img.className = 'aspect-[5/7] w-full object-cover transition-opacity group-hover/card:opacity-90';
    a.append(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'grid aspect-[5/7] w-full place-items-center text-caption text-faint';
    placeholder.textContent = TYPE_LABELS[entry.media_type] ?? entry.media_type;
    a.append(placeholder);
  }

  const progress = entry.progress ?? 0;
  const maxProg = entry.max_progress;
  const hasMax = maxProg != null && maxProg > 0;

  if (entry.score != null && entry.score > 0) {
    const badge = document.createElement('span');
    badge.className = 'absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-sm bg-accent px-1.5 py-0.5 font-display text-caption font-semibold text-on-accent';
    const star = document.createElement('span');
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '★';
    const value = document.createElement('span');
    value.textContent = entry.score % 1 === 0 ? `${entry.score}` : entry.score.toFixed(1);
    const srScore = document.createElement('span');
    srScore.className = 'sr-only';
    srScore.textContent = 'score ';
    badge.append(star, srScore, value);
    a.append(badge);
  }

  if (progress > 0 && entry.media_type !== 'movie') {
    const badge = document.createElement('span');
    badge.className = 'absolute top-1.5 right-1.5 rounded-sm bg-black/60 px-1.5 py-0.5 font-display text-caption font-medium text-white';
    badge.textContent = hasMax
      ? `${progress}/${maxProg}`
      : `${progress} ${PROGRESS_UNITS[entry.media_type] ?? 'ep'}`;
    a.append(badge);
  }

  poster.append(a);

  const title = document.createElement('a');
  title.className = 'mt-1.5 block font-display text-ui leading-[1.3] font-medium text-ink transition-colors hover:text-accent-strong';
  title.href = entry.url;
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  const titleText = document.createElement('span');
  titleText.className = 'line-clamp-2';
  titleText.textContent = entry.title;
  title.append(titleText);

  li.append(poster, title);

  const caption = document.createElement('p');
  caption.className = 'mt-0.5 truncate text-caption text-faint';

  let first = true;
  const add = (node: Node) => {
    if (!first) caption.append(document.createTextNode(' · '));
    caption.append(node);
    first = false;
  };

  const label = statusLabel(entry);
  if (label) {
    const status = document.createElement('span');
    status.className = `font-medium ${STATUS_TEXT[entry.status!] ?? ''}`;
    status.textContent = label;
    add(status);
  }
  const dateStr = formatDate(entry.progressed_at);
  if (dateStr) add(document.createTextNode(dateStr));

  if (!first) li.append(caption);
  return li;
}

export function showFallback(container: HTMLElement, message: string, onRetry?: () => void) {
  container.replaceChildren();
  const box = document.createElement(container.tagName === 'UL' ? 'li' : 'div');
  box.className = 'col-span-full w-full px-5 py-8 text-center';
  const p = document.createElement('p');
  p.className = 'text-meta text-muted';
  p.textContent = message;
  box.append(p);
  if (onRetry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mt-3 inline-flex min-h-11 items-center gap-1.5 px-3 text-meta font-medium text-accent transition-colors hover:text-accent-strong';
    btn.innerHTML = `${RELOAD_SVG}<span>retry</span>`;
    btn.addEventListener('click', onRetry);
    box.append(btn);
  }
  container.append(box);
}

function entryTime(entry: Entry): number {
  if (!entry.progressed_at) return 0;
  const t = Date.parse(entry.progressed_at);
  return Number.isNaN(t) ? 0 : t;
}

const PLANNING_HEAD = 12;
const FRESH_WINDOW = 14 * 24 * 60 * 60 * 1000;

export function sortWatchlist(entries: Entry[]): Entry[] {
  const now = Date.now();
  const byDate = (a: Entry, b: Entry): number =>
    entryTime(b) - entryTime(a) || a.title.localeCompare(b.title);

  const active: Entry[] = [];
  const freshCompleted: Entry[] = [];
  const mid: Entry[] = [];
  const backlog: Entry[] = [];

  for (const entry of entries) {
    const status = entry.status ?? '';
    const time = entryTime(entry);

    if (status === 'In progress' || status === 'Paused') {
      active.push(entry);
    } else if (status === 'Completed') {
      if (time > 0 && now - time < FRESH_WINDOW) freshCompleted.push(entry);
      else mid.push(entry);
    } else if (status === 'Dropped') {
      mid.push(entry);
    } else {
      backlog.push(entry);
    }
  }

  active.sort(byDate);
  freshCompleted.sort(byDate);
  mid.sort(byDate);
  backlog.sort(byDate);

  return [
    ...active,
    ...freshCompleted,
    ...backlog.slice(0, PLANNING_HEAD),
    ...mid,
    ...backlog.slice(PLANNING_HEAD),
  ];
}
