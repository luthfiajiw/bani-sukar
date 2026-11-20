import { Suspense } from 'react';
import { SiteHeader } from '@/components/site-header';
import { FamilyCanvas } from '@/components/tree/family-canvas';
import { Skeleton } from '@/components/ui/skeleton';
import { getLayoutData } from '@/features/family/queries';

interface HomePageProps {
  searchParams: Promise<{
    cabang?: string | string[];
    fokus?: string | string[];
  }>;
}

function TreeSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="border-b border-border bg-card px-4 py-2.5 sm:px-5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="hidden items-center gap-2 xl:flex">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="relative flex h-[calc(100dvh-120px)] min-h-[500px] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <Skeleton className="h-20 w-52 rounded-xl" />
          <div className="flex gap-6">
            <Skeleton className="h-20 w-44 rounded-xl" />
            <Skeleton className="h-20 w-44 rounded-xl" />
            <Skeleton className="h-20 w-44 rounded-xl" />
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Memuat bagan silsilah keluarga Bani Sukar...
          </p>
        </div>
      </div>
    </div>
  );
}

async function TreeContent({ searchParams }: HomePageProps) {
  const resolved = await searchParams;
  const cabang =
    typeof resolved.cabang === 'string' && resolved.cabang.trim().length > 0
      ? resolved.cabang.trim()
      : null;
  const fokus =
    typeof resolved.fokus === 'string' && resolved.fokus.trim().length > 0
      ? resolved.fokus.trim()
      : null;

  const layout = await getLayoutData(cabang);

  return (
    <FamilyCanvas
      layout={layout}
      selectedBranchId={cabang}
      initialFocusId={fokus}
    />
  );
}

export default function HomePage({ searchParams }: HomePageProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader activePath="/" />
      <main className="flex-1">
        <Suspense fallback={<TreeSkeleton />}>
          <TreeContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
