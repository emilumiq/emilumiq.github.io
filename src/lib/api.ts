export function apiOrigin(): string {
  const configured = (import.meta.env.PUBLIC_API_URL ?? '') as string;
  return configured.trim().replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  const base = apiOrigin();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${suffix}` : suffix;
}
