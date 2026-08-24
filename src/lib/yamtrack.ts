/**
 * Client-side Yamtrack API helpers.
 *
 * Fetches directly from the Yamtrack instance using
 * PUBLIC_YAMTRACK_URL and PUBLIC_YAMTRACK_TOKEN env vars
 * (inlined at build time by Astro).
 */

export const PAGE_SIZE = 24;

export type YamtrackEntry = {
  title: string;
  image: string | null;
  media_type: string;
  score: number | null;
  status: string | null;
  progress: number | null;
  max_progress: number | null;
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

function getOrigin(): string {
  return (
    import.meta.env.PUBLIC_YAMTRACK_URL ??
    import.meta.env.YAMTRACK_URL ??
    'https://list.neome.uk'
  );
}

function getToken(): string | null {
  const t =
    import.meta.env.PUBLIC_YAMTRACK_TOKEN ??
    import.meta.env.YAMTRACK_TOKEN ??
    null;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

function normalizeImage(image: string | null | undefined): string | null {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  const origin = getOrigin();
  return `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
}

function mapEntry(raw: YamtrackRawResponse): YamtrackEntry | null {
  const item = raw.item;
  if (!item?.title) return null;
  const mediaType = item.media_type ?? 'tv';
  const origin = getOrigin();
  const extUrl =
    item.media_id && item.source
      ? externalUrl(item.source, mediaType, item.media_id)
      : null;
  return {
    title: item.title,
    image: normalizeImage(item.image),
    media_type: mediaType,
    score: raw.score ?? null,
    status: raw.status ?? null,
    progress: raw.progress ?? null,
    max_progress: raw.max_progress ?? null,
    url: extUrl ?? origin,
  };
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
  const token = getToken();
  if (!token) return { entries: [], total: 0 };

  const origin = getOrigin();
  const url = new URL('/api/media/', origin);
  url.searchParams.set('media_type', mediaType);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  if (status) url.searchParams.set('status', status);

  for (const scheme of ['Token', 'Bearer'] as const) {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `${scheme} ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        count?: number;
        results?: YamtrackRawResponse[];
      };
      const entries = (data.results ?? []).map(mapEntry).filter((e): e is YamtrackEntry => e !== null);
      return { entries, total: data.count ?? entries.length };
    }
    if (res.status !== 401) break;
  }
  return { entries: [], total: 0 };
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
          const key = `${e.url}:${e.title}`;
          if (seen.has(key)) continue;
          seen.add(key);
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
 * Fetch all media (legacy, for small result sets).
 */
export async function fetchWatchlist(
  status: string = '',
  limit: number = 8,
): Promise<YamtrackEntry[]> {
  const loader = createWatchlistLoader(status, limit);
  const { entries } = await loader.next();
  return entries;
}
