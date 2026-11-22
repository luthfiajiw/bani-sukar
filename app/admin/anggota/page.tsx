import { Suspense } from 'react';
import Link from 'next/link';
import {
  Baby,
  ExternalLink,
  GitPullRequest,
  Heart,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { listPersonsAdmin } from '@/features/family/queries';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { DeletePersonDialog } from '@/components/admin/delete-person-dialog';
import { GenderBadge } from '@/components/gender-icon';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateId, formatYearRange, getGenerationLabel } from '@/lib/format';
import { DEFAULT_PAGE_SIZE, paginateItems } from '@/lib/pagination';

interface SearchParamsValue {
  q?: string;
  gender?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}

async function AnggotaDirectoryContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<SearchParamsValue>;
}) {
  const params = await searchParamsPromise;
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const gender = typeof params.gender === 'string' ? params.gender.trim() : '';
  const status = typeof params.status === 'string' ? params.status.trim() : '';

  const rows = await listPersonsAdmin({
    q: q || undefined,
    gender: gender || undefined,
    status: status || undefined,
  });

  const pagination = paginateItems(rows, params.page, params.pageSize);
  const paginatedRows = pagination.items;

  const hasFilters = Boolean(q || gender || status);
  const livingCount = rows.filter((r) => !r.isDeceased).length;
  const bloodlineCount = rows.filter((r) => r.isBloodLine).length;

  return (
    <div className="space-y-6">
      {/* Header & CTA */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <Users className="size-6 text-primary" />
            Direktori Anggota Bani Sukar
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola seluruh anggota trah, data kelahiran/wafat, serta akses cepat ke penyuntingan relasi silsilah.
          </p>
        </div>

        <Button asChild size="default">
          <Link href="/admin/anggota/baru">
            <Plus className="size-4" />
            + Tambah Anggota
          </Link>
        </Button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="py-3.5">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {hasFilters ? 'Total Sesuai Filter' : 'Total Anggota'}
              </p>
              <p className="mt-0.5 text-2xl font-bold text-foreground">{rows.length}</p>
            </div>
            <Badge variant="outline">Jiwa</Badge>
          </CardContent>
        </Card>
        <Card className="py-3.5">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Garis Nasab Langsung</p>
              <p className="mt-0.5 text-2xl font-bold text-foreground">{bloodlineCount}</p>
            </div>
            <Badge variant="default">Keturunan</Badge>
          </CardContent>
        </Card>
        <Card className="py-3.5">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Masih Hidup</p>
              <p className="mt-0.5 text-2xl font-bold text-foreground">{livingCount}</p>
            </div>
            <Badge variant="success">Aktif</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="py-4">
        <CardContent>
          <form
            method="GET"
            action="/admin/anggota"
            className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end"
          >
            {pagination.pageSize !== DEFAULT_PAGE_SIZE && (
              <input type="hidden" name="pageSize" value={pagination.pageSize} />
            )}
            <div className="space-y-1.5 md:col-span-5">
              <label
                htmlFor="filter-q"
                className="text-xs font-medium text-muted-foreground"
              >
                Cari Nama, Panggilan, atau Tempat Lahir
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="filter-q"
                  name="q"
                  defaultValue={q}
                  placeholder="cth. Sukar, Imam Sanadi, Pati..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label
                htmlFor="filter-gender"
                className="text-xs font-medium text-muted-foreground"
              >
                Jenis Kelamin
              </label>
              <select
                id="filter-gender"
                name="gender"
                defaultValue={gender}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">Semua (L &amp; P)</option>
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-3">
              <label
                htmlFor="filter-status"
                className="text-xs font-medium text-muted-foreground"
              >
                Status Kehidupan / Nasab
              </label>
              <select
                id="filter-status"
                name="status"
                defaultValue={status}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">Semua Status</option>
                <option value="alive">Masih Hidup</option>
                <option value="deceased">Telah Wafat</option>
                <option value="bloodline">Keturunan Bani Sukar</option>
                <option value="spouse">Menantu / Pasangan</option>
              </select>
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" className="flex-1">
                Filter
              </Button>
              {hasFilters && (
                <Button variant="outline" size="icon" asChild title="Reset filter">
                  <Link href="/admin/anggota" aria-label="Reset filter">
                    <RotateCcw className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Empty State */}
      {rows.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Users className="size-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              Tidak ada anggota yang sesuai
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Coba ubah kata kunci pencarian atau filter, atau tambahkan anggota keluarga baru ke dalam direktori.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {hasFilters && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/anggota">Reset Pencarian</Link>
                </Button>
              )}
              <Button size="sm" asChild>
                <Link href="/admin/anggota/baru">
                  <UserPlus className="size-4" />
                  Tambah Anggota Baru
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden overflow-hidden py-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Anggota</TableHead>
                  <TableHead>Generasi &amp; Gender</TableHead>
                  <TableHead>Kelahiran &amp; Status</TableHead>
                  <TableHead>Orang Tua</TableHead>
                  <TableHead>Pasangan &amp; Anak</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-normal">
                      <div className="flex items-center gap-3">
                        <PersonAvatar
                          fullName={row.fullName}
                          gender={row.gender}
                          isDeceased={row.isDeceased}
                          photoUrl={row.photoUrl}
                          size="md"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/anggota/${row.id}`}
                            className="font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            {row.fullName}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {row.nickname && <span>“{row.nickname}”</span>}
                            <Badge
                              variant={row.isBloodLine ? 'outline' : 'accent'}
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {row.isBloodLine ? 'Nasab' : 'Menantu'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-normal">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[11px]">
                          Gen {row.generation}
                        </Badge>
                        <GenderBadge gender={row.gender} size="sm" />
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-normal">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">
                          {row.birthDate
                            ? formatDateId(row.birthDate)
                            : row.birthPlace || 'Tanggal belum tercantum'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={row.isDeceased ? 'destructive' : 'success'}
                            className="text-[10px]"
                          >
                            {row.isDeceased ? 'Telah Wafat' : 'Masih Hidup'}
                          </Badge>
                          {row.birthPlace && row.birthDate && (
                            <span className="text-[11px] text-muted-foreground">
                              {row.birthPlace}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="max-w-[200px] whitespace-normal">
                      {row.parentNames.length > 0 ? (
                        <p className="text-xs text-foreground">
                          {row.parentNames.join(' & ')}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="max-w-[220px] whitespace-normal">
                      <div className="space-y-1 text-xs">
                        <p className="flex items-center gap-1 text-foreground">
                          <Heart className="size-3 shrink-0 text-primary/70" />
                          <span className="truncate">
                            {row.spouseNames.length > 0
                              ? row.spouseNames.join(', ')
                              : 'Belum ada pasangan'}
                          </span>
                        </p>
                        <p className="flex items-center gap-1 text-muted-foreground">
                          <Baby className="size-3 shrink-0" />
                          <span>{row.childrenCount} anak</span>
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="xs" asChild>
                          <Link href={`/anggota/${row.id}`}>
                            <ExternalLink className="size-3.5" />
                            Profil
                          </Link>
                        </Button>
                        <Button variant="outline" size="xs" asChild>
                          <Link href={`/admin/anggota/${row.id}`}>
                            <Pencil className="size-3.5" />
                            Sunting
                          </Link>
                        </Button>
                        <Button variant="secondary" size="xs" asChild>
                          <Link href={`/admin/relasi/${row.id}`}>
                            <GitPullRequest className="size-3.5" />
                            Relasi
                          </Link>
                        </Button>
                        <DeletePersonDialog
                          personId={row.id}
                          personName={row.fullName}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Hapus ${row.fullName}`}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile & Tablet Card List */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
            {paginatedRows.map((row) => (
              <Card key={row.id} className="gap-3 py-4">
                <CardHeader className="pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <PersonAvatar
                        fullName={row.fullName}
                        gender={row.gender}
                        isDeceased={row.isDeceased}
                        photoUrl={row.photoUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          <Link
                            href={`/anggota/${row.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {row.fullName}
                          </Link>
                        </CardTitle>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.nickname ? `“${row.nickname}” • ` : ''}
                          {getGenerationLabel(row.generation)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={row.isDeceased ? 'destructive' : 'success'}
                      className="shrink-0 text-[10px]"
                    >
                      {row.isDeceased ? 'Wafat' : 'Hidup'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <GenderBadge gender={row.gender} size="sm" />
                    <Badge variant={row.isBloodLine ? 'secondary' : 'accent'}>
                      {row.isBloodLine ? 'Keturunan Bani Sukar' : 'Menantu / Pasangan'}
                    </Badge>
                  </div>

                  <div className="space-y-1 rounded-lg bg-muted/50 p-2.5 text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Lahir/Masa:</strong>{' '}
                      {row.birthPlace ? `${row.birthPlace} • ` : ''}
                      {formatYearRange(row.birthDate, row.deathDate, row.isDeceased)}
                    </p>
                    <p>
                      <strong className="text-foreground">Orang Tua:</strong>{' '}
                      {row.parentNames.length > 0 ? row.parentNames.join(' & ') : '—'}
                    </p>
                    <p>
                      <strong className="text-foreground">Pasangan:</strong>{' '}
                      {row.spouseNames.length > 0 ? row.spouseNames.join(', ') : '—'} ({row.childrenCount}{' '}
                      anak)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button variant="ghost" size="xs" asChild>
                      <Link href={`/anggota/${row.id}`}>
                        <ExternalLink className="size-3.5" />
                        Profil
                      </Link>
                    </Button>
                    <Button variant="outline" size="xs" asChild>
                      <Link href={`/admin/anggota/${row.id}`}>
                        <Pencil className="size-3.5" />
                        Sunting
                      </Link>
                    </Button>
                    <Button variant="secondary" size="xs" asChild>
                      <Link href={`/admin/relasi/${row.id}`}>
                        <GitPullRequest className="size-3.5" />
                        Relasi
                      </Link>
                    </Button>
                    <DeletePersonDialog
                      personId={row.id}
                      personName={row.fullName}
                      trigger={
                        <Button
                          variant="ghost"
                          size="xs"
                          className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          Hapus
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <AdminPagination
            basePath="/admin/anggota"
            currentPage={pagination.currentPage}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            hasPrevPage={pagination.hasPrevPage}
            hasNextPage={pagination.hasNextPage}
            pageNumbers={pagination.pageNumbers}
            queryParams={{
              q: q || undefined,
              gender: gender || undefined,
              status: status || undefined,
            }}
          />
        </>
      )}
    </div>
  );
}

function AnggotaDirectorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

export default function AdminAnggotaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsValue>;
}) {
  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<AnggotaDirectorySkeleton />}>
        <AnggotaDirectoryContent searchParamsPromise={searchParams} />
      </Suspense>
    </div>
  );
}
