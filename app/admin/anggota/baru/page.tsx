import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { PersonForm } from '@/components/admin/person-form';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export default function NewAnggotaPage() {
  return (
    <div className="mx-auto w-full max-w-360 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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
                <BreadcrumbPage>Tambah Anggota Baru</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              <UserPlus className="size-6 text-primary" />
              Tambah Anggota Keluarga
            </h1>
            <p className="text-sm text-muted-foreground">
              Catat identitas anggota keluarga baru atau menantu ke dalam trah Bani Sukar.
            </p>
          </div>
        </div>
      </div>

      <PersonForm mode="create" />
    </div>
  );
}
