import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { listAdminUsersAction } from '@/features/family/actions';
import { getSession } from '@/lib/dal';
import { UserManagement } from '@/components/admin/user-management';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

async function AdminUsersContent() {
  const [session, usersRes] = await Promise.all([
    getSession(),
    listAdminUsersAction(),
  ]);

  const users = usersRes.ok ? usersRes.data : [];

  return (
    <div className="space-y-6">
      {!usersRes.ok && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {usersRes.error}
        </div>
      )}

      <UserManagement users={users} currentUserId={session?.user.id} />
    </div>
  );
}

function AdminUsersSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function AdminPenggunaPage() {
  return (
    <div className="mx-auto w-full max-w-360 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin/anggota">Portal Admin</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Kelola Admin</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              <ShieldCheck className="size-6 text-primary" />
              Kelola Akun Pengurus Admin
            </h1>
            <p className="text-sm text-muted-foreground">
              Tambah pengurus keluarga baru, atur ulang kata sandi, atau kelola akses admin portal.
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<AdminUsersSkeleton />}>
        <AdminUsersContent />
      </Suspense>
    </div>
  );
}
