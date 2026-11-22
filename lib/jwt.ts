import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const AUTH_COOKIE_NAME = 'bani_sukar_token';
export const JWT_EXPIRY = '7d';
export const JWT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface JwtSessionPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

const DEV_FALLBACK_SECRET = 'bani-sukar-jwt-secret-key-at-least-32-chars-long-2026';

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production.');
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export async function signJwtToken(payload: JwtSessionPayload): Promise<string> {
  const secretKey = getJwtSecretKey();
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secretKey);
}

export async function verifyJwtToken(
  token: string | undefined | null
): Promise<JwtSessionPayload | null> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }

  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return extractSessionPayload(payload);
  } catch {
    return null;
  }
}

function extractSessionPayload(payload: JWTPayload): JwtSessionPayload | null {
  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  const email = typeof payload.email === 'string' ? payload.email : null;
  const name = typeof payload.name === 'string' ? payload.name : null;
  const role = typeof payload.role === 'string' ? payload.role : 'admin';

  if (!sub || !email || !name) {
    return null;
  }

  return { sub, email, name, role };
}
