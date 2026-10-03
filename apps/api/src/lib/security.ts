import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/** Hash a password with scrypt (OWASP-recommended parameters). Format: scrypt$N$r$p$salt$hash */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT.keylen, SCRYPT).toString('hex');
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const candidate = scryptSync(password, salt, SCRYPT.keylen, { N: Number(n), r: Number(r), p: Number(p) });
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function newUuid(): string {
  return randomBytes(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}
