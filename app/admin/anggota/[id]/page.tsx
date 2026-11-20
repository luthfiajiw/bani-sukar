import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, GitBranch, UserCog } from 'lucide-react';
import { getPersonDetail } from '@/features/family/queries';
import { PersonForm } from '@/components/admin/person-form';
import { DeletePersonDialog } from '@/components/admin/delete-person-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

async function EditAnggotaContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = await paramsPromise;
  const detail = await getPersonDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <Link href="/admin/anggota" className="hover:text-primary">
              Direktori Anggota
            </Link>
            <span>/</span>
            <Link href={`/anggota/${detail.person.id}`} className="hover:text-primary">
              {detail.person.fullName}
            </Link>
            <span>/</span>
            <span className="text-foreground">Sunting Data</span>
          </div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <UserCog className="size-6 text-primary" />
            Sunting Profil: {detail.person.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Perbarui identitas diri, status kehidupan, atau lanjutkan ke pengaturan relasi silsilah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/anggota">
              <ArrowLeft className="size-4" />
              Direktori
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/anggota/${detail.person.id}`}>
              <ExternalLink className="size-4" />
              Profil Publik
            </Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/admin/relasi/${detail.person.id}`}>
              <GitBranch className="size-4" />
              Hubung Relasi
            </Link>
          </Button>
          <DeletePersonDialog
            personId={detail.person.id}
            personName={detail.person.fullName}
            redirectTo="/admin/anggota"
          />
        </div>
      </div>

      <PersonForm
        mode="edit"
        initialPerson={detail.person}
        generation={detail.generation}
      />
    </div>
  );
}

function EditPersonSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-border pb-5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
        <div className="space-y-5 lg:col-span-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function EditAnggotaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<EditPersonSkeleton />}>
        <EditAnggotaContent paramsPromise={params} />
      </Suspense>
    </div>
  );
}
