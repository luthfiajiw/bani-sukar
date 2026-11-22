import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  signJwtToken,
  verifyJwtToken,
  verifyPassword,
} from '../auth';

describe('JWT Auth & Password Hashing', () => {
  it('signs and verifies a valid admin JWT payload', async () => {
    const token = await signJwtToken({
      sub: 'user-123',
      email: 'admin@banisukar.id',
      name: 'Admin Bani Sukar',
      role: 'admin',
    });

    expect(token.split('.')).toHaveLength(3);

    const payload = await verifyJwtToken(token);
    expect(payload).toEqual({
      sub: 'user-123',
      email: 'admin@banisukar.id',
      name: 'Admin Bani Sukar',
      role: 'admin',
    });
  });

  it('rejects empty, malformed, and tampered JWT tokens', async () => {
    expect(await verifyJwtToken(undefined)).toBeNull();
    expect(await verifyJwtToken('')).toBeNull();
    expect(await verifyJwtToken('not.a.valid.jwt')).toBeNull();

    const validToken = await signJwtToken({
      sub: 'user-123',
      email: 'admin@banisukar.id',
      name: 'Admin Bani Sukar',
      role: 'admin',
    });
    const parts = validToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalid_signature_xyz`;
    expect(await verifyJwtToken(tampered)).toBeNull();
  });

  it('hashes passwords with unique salts and verifies correctly', () => {
    const hash1 = hashPassword('AdminBaniSukar123!');
    const hash2 = hashPassword('AdminBaniSukar123!');

    expect(hash1).not.toBe(hash2);
    expect(hash1.split(':')).toHaveLength(2);

    expect(verifyPassword('AdminBaniSukar123!', hash1)).toBe(true);
    expect(verifyPassword('AdminBaniSukar123!', hash2)).toBe(true);
    expect(verifyPassword('WrongPassword123!', hash1)).toBe(false);
    expect(verifyPassword('AdminBaniSukar123!', 'malformed-hash')).toBe(false);
    expect(verifyPassword('AdminBaniSukar123!', 'deadbeef:short')).toBe(false);
  });
});
