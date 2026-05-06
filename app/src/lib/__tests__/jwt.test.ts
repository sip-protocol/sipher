import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, isJwtExpired, getJwtExpiresAt } from '../jwt';

describe('jwt helpers', () => {
  // Valid JWT: { wallet: 'TestWallet', iat: 1700000000, exp: 1700003600 }
  // (signature is irrelevant for client-side decode)
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXQiOiJUZXN0V2FsbGV0IiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.fake-sig';

  it('decodes payload', () => {
    const payload = decodeJwtPayload(validToken);
    expect(payload).toEqual({ wallet: 'TestWallet', iat: 1700000000, exp: 1700003600 });
  });

  it('returns null for malformed token', () => {
    expect(decodeJwtPayload('not.a.jwt')).toBeNull();
    expect(decodeJwtPayload('only-one-part')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('isJwtExpired returns true for expired token', () => {
    expect(isJwtExpired(validToken, 1700004000)).toBe(true);
  });

  it('isJwtExpired returns false for valid token', () => {
    expect(isJwtExpired(validToken, 1700001800)).toBe(false);
  });

  it('isJwtExpired returns true for malformed token (defensive)', () => {
    expect(isJwtExpired('not.a.jwt', 1700001800)).toBe(true);
  });

  it('getJwtExpiresAt returns exp claim in seconds', () => {
    expect(getJwtExpiresAt(validToken)).toBe(1700003600);
  });

  it('getJwtExpiresAt returns null for malformed', () => {
    expect(getJwtExpiresAt('not.a.jwt')).toBeNull();
  });
});
