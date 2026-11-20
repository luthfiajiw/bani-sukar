import { Suspense, type ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { requireAdmin } from '@/lib/dal';

async function AdminAuthGate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

function AdminShellSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-8 w-56 animate-pulse rounded-md bg-secondary" />
      <div className="mt-6 h-64 w-full animate-pulse rounded-xl bg-secondary/70" />
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader isAdminView />
      <main className="flex-1">
        <Suspense fallback={<AdminShellSkeleton />}>
          <AdminAuthGate>{children}</AdminAuthGate>
        </Suspense>
      </main>
    </div>
  );
}
