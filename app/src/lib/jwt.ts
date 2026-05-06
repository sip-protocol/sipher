// app/src/lib/jwt.ts

export interface JwtPayload {
  wallet: string;
  iat: number;
  exp: number;
  isAdmin?: boolean;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // Use base64url decoding; atob handles padded base64
    const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(json);
    if (typeof obj !== 'object' || obj === null) return null;
    if (typeof obj.wallet !== 'string') return null;
    if (typeof obj.iat !== 'number') return null;
    if (typeof obj.exp !== 'number') return null;
    return obj as JwtPayload;
  } catch {
    return null;
  }
}

export function getJwtExpiresAt(token: string): number | null {
  const payload = decodeJwtPayload(token);
  return payload?.exp ?? null;
}

export function isJwtExpired(token: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const exp = getJwtExpiresAt(token);
  if (exp === null) return true; // defensive: treat malformed as expired
  return nowSeconds >= exp;
}
