export const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
export const ANILIST_USERNAME = 'emilumiq';

export const ANILIST_QUERY = `
query ($userName: String!) {
  anime: MediaListCollection(userName: $userName, type: ANIME) {
    lists { name entries { ...entryFields } }
  }
  manga: MediaListCollection(userName: $userName, type: MANGA) {
    lists { name entries { ...entryFields } }
  }
}
fragment entryFields on MediaList {
  id
  status
  progress
  score
  updatedAt
  completedAt { year month day }
  media {
    id
    type
    format
    status
    episodes
    chapters
    volumes
    siteUrl
    coverImage { extraLarge large color }
    title { romaji english native }
  }
}
`;

export type AniListStatus =
  | 'CURRENT'
  | 'REPEATING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'PLANNING'
  | 'DROPPED';

export type AniListEntry = {
  id: number;
  type: 'ANIME' | 'MANGA';
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  format: string | null;
  status: AniListStatus;
  listName: string;
  progress: number;
  maxProgress: number | null;
  score: number | null;
  updatedAt: string | null;
  completedAt: string | null;
  cover: string | null;
  color: string | null;
  url: string;
};

export type AniListPayload = {
  generatedAt: string;
  username: string;
  anime: AniListEntry[];
  manga: AniListEntry[];
};

type RawMedia = {
  id: number;
  type?: 'ANIME' | 'MANGA';
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  siteUrl?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null; color?: string | null } | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
};

type RawEntry = {
  id: number;
  status?: AniListStatus | null;
  progress?: number | null;
  score?: number | null;
  updatedAt?: number | null;
  completedAt?: { year?: number | null; month?: number | null; day?: number | null } | null;
  media?: RawMedia | null;
};

type RawGroup = { name?: string | null; entries?: RawEntry[] | null };
type RawCollection = { lists?: RawGroup[] | null };

export type RawResponse = {
  data?: { anime?: RawCollection | null; manga?: RawCollection | null } | null;
  errors?: { message?: string }[];
};

const STATUS_RANK: Record<AniListStatus, number> = {
  CURRENT: 0,
  REPEATING: 0,
  PAUSED: 1,
  COMPLETED: 2,
  PLANNING: 3,
  DROPPED: 4,
};

function normalizeScore(score: number | null | undefined): number | null {
  const value = score && score > 0 ? score : null;
  if (value == null) return null;
  const scaled = value > 10 ? value / 10 : value;
  return Math.round(scaled * 10) / 10;
}

function fuzzyDate(raw: RawEntry['completedAt']): string | null {
  if (!raw?.year || !raw.month || !raw.day) return null;
  return new Date(Date.UTC(raw.year, raw.month - 1, raw.day)).toISOString();
}

function mapEntry(entry: RawEntry, listName: string): AniListEntry | null {
  const media = entry.media;
  if (!media?.id) return null;
  const status = entry.status ?? 'PLANNING';
  const type = media.type ?? 'ANIME';
  const title =
    media.title?.romaji || media.title?.english || media.title?.native || null;
  if (!title) return null;

  const maxProgress =
    type === 'MANGA' ? media.chapters ?? null : media.episodes ?? null;
  const updatedAt =
    entry.updatedAt && entry.updatedAt > 0
      ? new Date(entry.updatedAt * 1000).toISOString()
      : null;

  return {
    id: media.id,
    type,
    title,
    titleEnglish: media.title?.english ?? null,
    titleNative: media.title?.native ?? null,
    format: media.format ?? null,
    status,
    listName,
    progress: entry.progress ?? 0,
    maxProgress,
    score: normalizeScore(entry.score),
    updatedAt,
    completedAt: fuzzyDate(entry.completedAt),
    cover: media.coverImage?.extraLarge || media.coverImage?.large || null,
    color: media.coverImage?.color ?? null,
    url: media.siteUrl ?? `https://anilist.co/${type.toLowerCase()}/${media.id}`,
  };
}

function collect(collection: RawCollection | null | undefined): AniListEntry[] {
  const seen = new Set<number>();
  const out: AniListEntry[] = [];
  for (const group of collection?.lists ?? []) {
    for (const raw of group.entries ?? []) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      const mapped = mapEntry(raw, group.name ?? '');
      if (mapped) out.push(mapped);
    }
  }

  out.sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    const at = a.updatedAt ?? '';
    const bt = b.updatedAt ?? '';
    if (at !== bt) return at < bt ? 1 : -1;
    return a.title.localeCompare(b.title);
  });

  return out;
}

export function normalizePayload(json: RawResponse, username: string): AniListPayload {
  if (!json.data) {
    const message = json.errors?.map((e) => e.message).join('; ') || 'empty upstream response';
    throw new Error(message);
  }
  return {
    generatedAt: new Date().toISOString(),
    username,
    anime: collect(json.data.anime),
    manga: collect(json.data.manga),
  };
}
