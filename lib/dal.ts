import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE_NAME, verifyJwtToken } from '@/lib/jwt';

export interface AppSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AppSession {
  user: AppSessionUser;
}

export const getSession = cache(async (): Promise<AppSession | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const payload = await verifyJwtToken(token);
    if (!payload) {
      return null;
    }

    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
    };
  } catch {
    return null;
  }
});

export async function requireAdmin(): Promise<AppSession> {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/login');
  }
  return session;
}
