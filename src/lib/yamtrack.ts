/**
 * Client-side Yamtrack API helpers.
 *
 * Data requests go through the Vercel proxy (`api/yamtrack.ts`), which
 * attaches the Yamtrack token server-side — the token never ships in the
 * browser bundle. PUBLIC_YAMTRACK_URL is only used for poster URLs,
 * which are served publicly without auth.
 */

import { apiOrigin } from './api';

export const PAGE_SIZE = 24;

export type YamtrackEntry = {
  /** Stable dedup key: "{source}:{media_type}:{media_id}" */
  key: string;
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

type YamtrackRawItem = {
  media_id?: string | number;
  source?: string;
  media_type?: string;
  title?: string;
  image?: string | null;
};

type YamtrackRawResponse = {
  score?: number | null;
  status?: string | null;
  progress?: number | null;
  max_progress?: number | null;
  progressed_at?: string | null;
  item?: YamtrackRawItem;
};

export type WatchlistPage = {
  entries: YamtrackEntry[];
  total: number;
};

function externalUrl(
  source: string,
  mediaType: string,
  mediaId: string | number,
): string | null {
  switch (source) {
    case 'tmdb':
      return `https://www.themoviedb.org/${mediaType}/${mediaId}`;
    case 'mal':
      return `https://myanimelist.net/${mediaType}/${mediaId}`;
    case 'igdb':
      return `https://www.igdb.com/games/${mediaId}`;
    case 'openlibrary':
      return `https://openlibrary.org/works/${mediaId}`;
    case 'mangaupdates':
      return `https://www.mangaupdates.com/series.html?id=${mediaId}`;
    case 'comicvine':
      return `https://comicvine.gamespot.com/${mediaType}/${mediaId}`;
    case 'bgg':
      return `https://boardgamegeek.com/boardgame/${mediaId}`;
    default:
      return null;
  }
}

/** Public origin used to build poster URLs (images need no auth). */
function getImageOrigin(): string {
  const configured = import.meta.env.PUBLIC_YAMTRACK_URL as string | undefined;
  return (configured || 'https://list.neome.uk').replace(/\/+$/, '');
}

function normalizeImage(image: string | null | undefined): string | null {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  const origin = getImageOrigin();
  return `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
}

function makeKey(source: string, mediaType: string, mediaId: string | number): string {
  return `${source}:${mediaType}:${mediaId}`;
}

/** Parse progressed_at safely, returning null on invalid/missing values. */
function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapEntry(raw: YamtrackRawResponse): YamtrackEntry | null {
  const item = raw.item;
  if (!item?.title) return null;
  const mediaType = item.media_type ?? 'tv';
  const source = item.source ?? '';
  const mediaId = item.media_id ?? '';
  const extUrl =
    item.media_id && item.source
      ? externalUrl(item.source, mediaType, item.media_id)
      : null;
  return {
    key: makeKey(source, mediaType, mediaId),
    title: item.title,
    image: normalizeImage(item.image),
    media_type: mediaType,
    score: raw.score ?? null,
    status: raw.status ?? null,
    progress: raw.progress ?? null,
    max_progress: raw.max_progress ?? null,
    progressed_at: raw.progressed_at ?? null,
    url: extUrl ?? getImageOrigin(),
  };
}

/** Fetch one page through the Vercel proxy — no credentials in the browser. */
async function apiFetch(
  url: URL,
): Promise<{ ok: boolean; status: number; data: { count?: number; results?: YamtrackRawResponse[] } | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = (await res.json()) as { count?: number; results?: YamtrackRawResponse[] };
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch one page of media from Yamtrack.
 *
 * Returns parsed entries plus the server-side total count for pagination.
 */
export async function fetchMediaPage(
  mediaType: string,
  status: string,
  offset: number,
  limit: number,
): Promise<WatchlistPage> {
  const url = new URL('/api/yamtrack', apiOrigin());
  url.searchParams.set('media_type', mediaType);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (status) url.searchParams.set('status', status);

  const { ok, data } = await apiFetch(url);
  if (!ok || !data) return { entries: [], total: 0 };

  const entries = (data.results ?? [])
    .map(mapEntry)
    .filter((e): e is YamtrackEntry => e !== null);
  return { entries, total: data.count ?? entries.length };
}

/**
 * Lazy paginated loader that streams through all media types.
 *
 * Each call to `next()` returns up to `pageSize` entries (deduped across
 * tv/movie/anime).  Calling it again continues from where the previous
 * call left off.
 */
export function createWatchlistLoader(status = '', pageSize = PAGE_SIZE) {
  const TYPES = ['tv', 'movie', 'anime'] as const;
  let typeIdx = 0;
  let offset = 0;
  let done = false;
  const seen = new Set<string>();

  return {
    async next(): Promise<{ entries: YamtrackEntry[]; done: boolean }> {
      if (done) return { entries: [], done: true };
      const acc: YamtrackEntry[] = [];

      while (acc.length < pageSize && typeIdx < TYPES.length) {
        const type = TYPES[typeIdx];
        const { entries, total } = await fetchMediaPage(
          type, status, offset, pageSize - acc.length + 16,
        );

        for (const e of entries) {
          if (seen.has(e.key)) continue;
          seen.add(e.key);
          acc.push(e);
          if (acc.length >= pageSize) break;
        }

        offset += entries.length;
        if (offset >= total || entries.length === 0) {
          typeIdx++;
          offset = 0;
        }
      }

      if (typeIdx >= TYPES.length) done = true;
      return { entries: acc, done };
    },
  };
}

/**
 * Fetch all media across types, deduplicated, sorted by status and date.
 *
 * This is the primary data source for the /watching page — data is
 * fetched once and reused across all status tabs (filtered client-side).
 */
export async function fetchAll(): Promise<YamtrackEntry[]> {
  const types = ['tv', 'movie', 'anime'] as const;
  const pages = await Promise.all(
    types.map((t) => fetchAllPages(t)),
  );

  const seen = new Set<string>();
  const all = pages.flat().filter((e) => {
    if (seen.has(e.key)) return false;
    seen.add(e.key);
    return true;
  });

  // Explicit global sort:
  // 1. In progress (newest date first)
  // 2. Recently completed (last 2 weeks, newest first)
  // 3. Planning (newest first)
  // 4. Completed >2 weeks ago (oldest first — watched long ago)
  // 5. Without dates (by title)
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  function dateGroup(entry: YamtrackEntry): number {
    const status = entry.status ?? '';
    const d = parseDate(entry.progressed_at);
    if (status === 'In progress') return 0;
    if (d) {
      if (now - d.getTime() < TWO_WEEKS_MS) return 1;
      return 3;
    }
    if (status === 'Planning') return 2;
    return 4;
  }

  all.sort((a, b) => {
    const ag = dateGroup(a);
    const bg = dateGroup(b);
    if (ag !== bg) return ag - bg;

    const ad = parseDate(a.progressed_at);
    const bd = parseDate(b.progressed_at);

    // Within group 0 (In progress) or 1 (recent): newest first
    if (ag <= 1 && ad && bd) return bd.getTime() - ad.getTime();

    // Within group 3 (old completed): oldest first
    if (ag === 3 && ad && bd) return ad.getTime() - bd.getTime();

    // Dated before undated within same group
    if (ad && !bd) return -1;
    if (!ad && bd) return 1;

    return a.title.localeCompare(b.title);
  });

  return all;
}

async function fetchAllPages(mediaType: string): Promise<YamtrackEntry[]> {
  const all: YamtrackEntry[] = [];
  let offset = 0;

  for (let safety = 0; safety < 50; safety++) {
    const url = new URL('/api/yamtrack', apiOrigin());
    url.searchParams.set('media_type', mediaType);
    url.searchParams.set('limit', '100');
    url.searchParams.set('offset', String(offset));

    const { ok, data } = await apiFetch(url);
    if (!ok || !data) break;

    const entries = (data.results ?? [])
      .map(mapEntry)
      .filter((e): e is YamtrackEntry => e !== null);

    if (entries.length === 0) break;

    all.push(...entries);
    const prevOffset = offset;
    offset += entries.length;

    // Safety: if offset didn't advance or already past count, stop
    if (offset <= prevOffset || offset >= (data.count ?? entries.length)) break;
  }

  return all;
}
