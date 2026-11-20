import Link from 'next/link';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { PersonForm } from '@/components/admin/person-form';
import { Button } from '@/components/ui/button';

export default function NewAnggotaPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Link href="/admin/anggota" className="hover:text-primary">
              Direktori Anggota
            </Link>
            <span>/</span>
            <span className="text-foreground">Tambah Anggota Baru</span>
          </div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <UserPlus className="size-6 text-primary" />
            Tambah Anggota Keluarga
          </h1>
          <p className="text-sm text-muted-foreground">
            Catat identitas anggota keluarga baru atau menantu ke dalam trah Bani Sukar.
          </p>
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/anggota">
            <ArrowLeft className="size-4" />
            Kembali ke Direktori
          </Link>
        </Button>
      </div>

      <PersonForm mode="create" />
    </div>
  );
}
