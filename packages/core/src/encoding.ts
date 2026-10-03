/** Environment-agnostic base64 helpers (Node + browser). */
export function toBase64(input: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(input, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(input)));
}

export function toBase64UrlSafe(input: string): string {
  return toBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64(input: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(input, 'base64').toString('utf8');
  return decodeURIComponent(escape(atob(input)));
}
