import { cache } from 'react';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isDbAvailable } from '@/db';

export interface AppSessionUser {
  id: string;
  email: string;
  name: string;
  role?: string | null;
}

export interface AppSession {
  user: AppSessionUser;
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

export const DEV_ADMIN_COOKIE = 'bani_sukar_dev_admin';

export const MOCK_DEV_ADMIN_SESSION: AppSession = {
  user: {
    id: 'dev-admin',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@banisukar.id',
    name: process.env.SEED_ADMIN_NAME || 'Admin Bani Sukar',
    role: 'admin',
  },
};

export const getSession = cache(async (): Promise<AppSession | null> => {
  const dbOnline = await isDbAvailable();

  if (dbOnline) {
    try {
      const reqHeaders = await headers();
      const session = await auth.api.getSession({
        headers: reqHeaders,
      });
      if (session?.user) {
        return {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            role: (session.user as { role?: string | null }).role ?? 'admin',
          },
          session: session.session
            ? {
                id: session.session.id,
                userId: session.session.userId,
                expiresAt: new Date(session.session.expiresAt),
              }
            : undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // Only honor DEV_ADMIN_COOKIE when not in production AND database is not available
  if (process.env.NODE_ENV !== 'production') {
    try {
      const cookieStore = await cookies();
      if (cookieStore.get(DEV_ADMIN_COOKIE)?.value === '1') {
        return MOCK_DEV_ADMIN_SESSION;
      }
    } catch {
      // cookies() outside request context
    }
  }

  return null;
});

export async function requireAdmin(): Promise<AppSession> {
  const session = await getSession();
  if (!session?.user || (session.user.role && session.user.role !== 'admin')) {
    redirect('/login');
  }
  return session;
}
