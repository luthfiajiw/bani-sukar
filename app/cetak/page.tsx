import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PrintStudio } from '@/components/export/print-studio';
import { SiteHeader } from '@/components/site-header';
import { Skeleton } from '@/components/ui/skeleton';
import { getFamilyData } from '@/features/family/queries';

export const metadata: Metadata = {
  title: 'Ekspor & Cetak Bagan Silsilah — Bani Sukar',
  description:
    'Atur tata letak cetak poster sambung kertas (tiling), buku silsilah per cabang, PNG, ZIP, dan SVG vektor untuk Trah Bani Sukar & Sadirah.',
};

function PrintStudioSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-65px)] flex-col bg-background lg:flex-row">
      {/* Desktop sidebar skeleton */}
      <aside className="hidden w-[360px] shrink-0 flex-col gap-4 border-r border-border bg-card p-4 lg:flex">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="mt-auto h-10 w-full rounded-lg" />
      </aside>

      {/* Main preview area skeleton */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-36 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
          <Skeleton className="hidden h-8 w-36 rounded-md lg:block" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Skeleton className="h-28 w-64 rounded-xl" />
          <div className="flex gap-4">
            <Skeleton className="h-24 w-44 rounded-xl" />
            <Skeleton className="h-24 w-44 rounded-xl" />
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Menyiapkan studio ekspor &amp; pratinjau cetak...
          </p>
        </div>
      </div>
    </div>
  );
}

async function PrintStudioLoader() {
  const { persons, unions } = await getFamilyData();
  return <PrintStudio persons={persons} unions={unions} />;
}

export default function CetakPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader activePath="/cetak" />
      <main className="flex-1">
        <Suspense fallback={<PrintStudioSkeleton />}>
          <PrintStudioLoader />
        </Suspense>
      </main>
    </div>
  );
}
