/**
 * Client-side Yamtrack API helpers.
 *
 * Fetches directly from the Yamtrack instance using
 * PUBLIC_YAMTRACK_URL and PUBLIC_YAMTRACK_TOKEN env vars
 * (inlined at build time by Astro).
 */

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

// External URL builders per source
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

async function fetchMediaType(
  mediaType: string,
  status: string,
  limit = 50,
  offset = 0,
): Promise<YamtrackRawResponse[]> {
  const token = getToken();
  if (!token) return [];

  const origin = getOrigin();
  const url = new URL('/api/media/', origin);
  url.searchParams.set('media_type', mediaType);
  url.searchParams.set('status', status);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  for (const scheme of ['Token', 'Bearer'] as const) {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `${scheme} ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = (await res.json()) as { results?: YamtrackRawResponse[] };
      return data.results ?? [];
    }
    if (res.status !== 401) break;
  }
  return [];
}

/**
 * Fetch all media from Yamtrack, deduplicated by source:media_id.
 */
export async function fetchWatchlist(
  status: string = '',
  limit = 50,
  offset = 0,
): Promise<{ items: YamtrackEntry[]; hasMore: boolean }> {
  const types = ['tv', 'movie', 'anime'];
  const results = await Promise.all(
    types.map((t) => fetchMediaType(t, status, limit, offset)),
  );

  const seen = new Set<string>();
  const origin = getOrigin();

  const items = results
    .flat()
    .filter((raw) => {
      const id = raw.item?.media_id ?? '';
      const source = raw.item?.source ?? '';
      const key = `${source}:${id}`;
      if (!id || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((raw): YamtrackEntry | null => {
      const item = raw.item;
      if (!item?.title) return null;
      const mediaType = item.media_type ?? 'tv';
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
    })
    .filter((e): e is YamtrackEntry => e !== null)
    .sort(
      (a, b) =>
        Date.parse(b.url ? '' : '') - Date.parse(a.url ? '' : ''),
    );

  return {
    items,
    hasMore: items.length >= limit,
  };
}
