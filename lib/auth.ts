import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export {
  AUTH_COOKIE_NAME,
  JWT_EXPIRY,
  JWT_MAX_AGE_SECONDS,
  signJwtToken,
  verifyJwtToken,
  type JwtSessionPayload,
} from './jwt';

const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [salt, keyHex] = parts;
  if (!salt || !keyHex) {
    return false;
  }

  try {
    const keyBuffer = Buffer.from(keyHex, 'hex');
    if (keyBuffer.length !== SCRYPT_KEY_LENGTH) {
      return false;
    }

    const derivedBuffer = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
    if (derivedBuffer.length !== keyBuffer.length) {
      return false;
    }

    return timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}
