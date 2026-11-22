import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GitPullRequest } from 'lucide-react';
import { getRelationEditorData } from '@/features/family/queries';
import { RelationEditor } from '@/components/admin/relation-editor';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';

async function RelationEditorContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = await paramsPromise;
  const data = await getRelationEditorData(id);
  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5">
        <div className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin/anggota">Direktori Anggota</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Hubung Relasi Silsilah</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              <GitPullRequest className="size-6 text-primary" />
              Hubung Relasi: {data.person.fullName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Atur garis leluhur, pasangan pernikahan, dan urutan kelahiran keturunan secara terstruktur.
            </p>
          </div>
        </div>
      </div>

      <RelationEditor data={data} />
    </div>
  );
}

function RelationEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-border pb-5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Skeleton className="h-[460px] rounded-xl lg:col-span-5" />
        <div className="space-y-5 lg:col-span-7">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function RelationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<RelationEditorSkeleton />}>
        <RelationEditorContent paramsPromise={params} />
      </Suspense>
    </div>
  );
}
