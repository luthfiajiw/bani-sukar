import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  ArrowLeft,
  Baby,
  Calendar,
  ChevronRight,
  GitPullRequest,
  Heart,
  HeartCrack,
  Link2,
  MapPin,
  Pencil,
  TreePine,
  User,
  Users,
} from 'lucide-react';
import { GenderBadge } from '@/components/gender-icon';
import { PersonAvatar } from '@/components/person-avatar';
import { PersonAvatarPreview } from '@/components/person-avatar-preview';
import { SiteHeader } from '@/components/site-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { getPersonDetail } from '@/features/family/queries';
import type { UnionStatus } from '@/features/family/types';
import {
  formatDateId,
  formatYearRange,
  getBirthOrderLabel,
  getGenerationLabel,
} from '@/lib/format';

interface PersonProfilePageProps {
  params: Promise<{ id: string }>;
}

const UNION_STATUS_META: Record<
  UnionStatus,
  { label: string; variant: 'success' | 'destructive' | 'secondary' }
> = {
  married: { label: 'Menikah', variant: 'success' },
  divorced: { label: 'Bercerai', variant: 'destructive' },
  widowed: { label: 'Cerai Mati', variant: 'secondary' },
};

export async function generateMetadata({
  params,
}: PersonProfilePageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getPersonDetail(id);

  if (!detail) {
    return {
      title: 'Anggota Tidak Ditemukan — Bani Sukar',
    };
  }

  const years = formatYearRange(
    detail.person.birthDate,
    detail.person.deathDate,
    detail.person.isDeceased,
  );

  return {
    title: `${detail.person.fullName} — Silsilah Bani Sukar`,
    description: `Profil silsilah ${detail.person.fullName} (${getGenerationLabel(detail.generation)}, ${years}) dalam keluarga besar Trah Bani Sukar & Sadirah.`,
  };
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-360 space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="lg:col-span-7">
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

async function PersonDetailContent({ params }: PersonProfilePageProps) {
  const { id } = await params;
  const detail = await getPersonDetail(id);

  if (!detail) {
    notFound();
  }

  const { person, generation, parents, spouses, children, siblings, stats, lineagePath } =
    detail;

  const yearRange = formatYearRange(
    person.birthDate,
    person.deathDate,
    person.isDeceased,
  );

  const spouseByUnionId = new Map<string, string>();
  for (const s of spouses) {
    if (s.spouse) {
      spouseByUnionId.set(s.union.id, s.spouse.fullName);
    }
  }

  return (
    <div className="mx-auto max-w-360 space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      {/* Breadcrumb Lineage Path */}
      <nav
        aria-label="Jalur Nasab"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:text-sm"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Bagan Utama
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {getGenerationLabel(generation)}
        </span>
        {lineagePath.map((node, index) => {
          const isCurrent = node.id === person.id && index === lineagePath.length - 1;
          return (
            <span key={`${node.id}-${index}`} className="inline-flex items-center gap-1.5">
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
              {isCurrent ? (
                <span className="font-semibold text-foreground">{node.fullName}</span>
              ) : (
                <Link
                  href={`/anggota/${node.id}`}
                  className="hover:text-primary hover:underline"
                >
                  {node.fullName}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {/* Hero Card */}
      <Card className="overflow-hidden border-[#d4c3bc] bg-card shadow-xs">
        <div className="h-2 bg-gradient-to-r from-primary via-accent to-primary/70" />
        <CardContent className="pt-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <PersonAvatarPreview
                fullName={person.fullName}
                gender={person.gender}
                isDeceased={person.isDeceased}
                photoUrl={person.photoUrl}
                size="xl"
                className="shrink-0"
              />
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-semibold">
                    {getGenerationLabel(generation)}
                  </Badge>
                  <Badge variant={person.isBloodLine ? 'default' : 'accent'}>
                    {person.isBloodLine ? 'Nasab Bani Sukar' : 'Menantu / Pasangan'}
                  </Badge>
                  <Badge variant={person.isDeceased ? 'destructive' : 'success'}>
                    {person.isDeceased ? 'Almarhum / Wafat' : 'Masih Hidup'}
                  </Badge>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {person.fullName}
                </h1>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {person.nickname && (
                    <span>
                      Panggilan:{' '}
                      <strong className="font-medium text-foreground">
                        {person.nickname}
                      </strong>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5 text-primary" />
                    {yearRange}
                  </span>
                  {person.birthPlace && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5 text-primary" />
                      {person.birthPlace}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/?fokus=${person.id}`}>
                  <TreePine className="size-4 text-primary" />
                  <span>Lihat di Bagan Pohon</span>
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/admin/relasi/${person.id}`}>
                  <Link2 className="size-4" />
                  <span>Hubung Relasi</span>
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/admin/anggota/${person.id}`}>
                  <Pencil className="size-4" />
                  <span>Sunting Profil</span>
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card className="gap-2 py-4">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pasangan</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {stats.spouses}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-primary">
              <Heart className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-2 py-4">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Putra &amp; Putri
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {stats.children}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Baby className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-2 py-4">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Cucu (Wayah)
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {stats.grandchildren}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-2 py-4">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Cicit (Buyut)
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {stats.greatGrandchildren}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#2d4030]/10 text-[#2d4030]">
              <GitPullRequest className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Data Vital, Orang Tua, Daftar Pasangan */}
        <div className="space-y-6 lg:col-span-5">
          {/* Data Vital */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4 text-primary" />
                Data Vital
              </CardTitle>
              <CardDescription>
                Informasi kelahiran, garis keturunan, dan status kehidupan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Jenis Kelamin</span>
                <GenderBadge gender={person.gender} size="md" />
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Tempat &amp; Tgl Lahir</span>
                <span className="text-right font-medium">
                  {person.birthPlace ? `${person.birthPlace}, ` : ''}
                  {formatDateId(person.birthDate)}
                </span>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Status Kehidupan</span>
                <span className="text-right font-medium">
                  {person.isDeceased ? (
                    <span className="text-destructive">Almarhum / Telah Wafat</span>
                  ) : (
                    <span className="text-[#2d4030]">Masih Hidup</span>
                  )}
                </span>
              </div>
              {person.isDeceased && (
                <>
                  <Separator />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Tanggal Wafat</span>
                    <span className="text-right font-medium">
                      {formatDateId(person.deathDate)}
                    </span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Status Nasab</span>
                <span className="text-right font-medium">
                  {person.isBloodLine
                    ? 'Keturunan Langsung Bani Sukar'
                    : 'Menantu / Pasangan'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Orang Tua / Leluhur */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <TreePine className="size-4 text-primary" />
                Orang Tua / Leluhur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!parents.father && !parents.mother ? (
                <p className="text-sm text-muted-foreground">
                  {generation === 1
                    ? 'Leluhur pendiri (Generasi 1) Trah Bani Sukar.'
                    : 'Data orang tua belum terhubung di silsilah.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {parents.father && (
                    <Link
                      href={`/anggota/${parents.father.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/60"
                    >
                      <PersonAvatar
                        fullName={parents.father.fullName}
                        gender={parents.father.gender}
                        isDeceased={parents.father.isDeceased}
                        photoUrl={parents.father.photoUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Ayah
                        </p>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {parents.father.fullName}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  )}
                  {parents.mother && (
                    <Link
                      href={`/anggota/${parents.mother.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/60"
                    >
                      <PersonAvatar
                        fullName={parents.mother.fullName}
                        gender={parents.mother.gender}
                        isDeceased={parents.mother.isDeceased}
                        photoUrl={parents.mother.photoUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Ibu
                        </p>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {parents.mother.fullName}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  )}
                </div>
              )}

              {siblings.length > 0 && (
                <div className="pt-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Saudara Kandung ({siblings.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {siblings.map((sib) => (
                      <Link
                        key={sib.id}
                        href={`/anggota/${sib.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            sib.isDeceased ? 'bg-destructive' : 'bg-[#2d4030]'
                          }`}
                        />
                        {sib.fullName}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daftar Pasangan */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="size-4 text-primary" />
                Ikatan Pernikahan ({spouses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spouses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada catatan pernikahan.
                </p>
              ) : (
                <div className="space-y-3">
                  {spouses.map(({ union, spouse, children: unionChildren }) => {
                    const statusMeta = UNION_STATUS_META[union.status];
                    return (
                      <div
                        key={union.id}
                        className="rounded-lg border border-border bg-muted/35 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          {spouse ? (
                            <Link
                              href={`/anggota/${spouse.id}`}
                              className="flex min-w-0 flex-1 items-center gap-3 group"
                            >
                              <PersonAvatar
                                fullName={spouse.fullName}
                                gender={spouse.gender}
                                isDeceased={spouse.isDeceased}
                                photoUrl={spouse.photoUrl}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary group-hover:underline">
                                  {spouse.fullName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatYearRange(
                                    spouse.birthDate,
                                    spouse.deathDate,
                                    spouse.isDeceased,
                                  )}
                                </p>
                              </div>
                            </Link>
                          ) : (
                            <div className="text-sm text-muted-foreground italic">
                              Pasangan tidak tercatat
                            </div>
                          )}
                          <Badge variant={statusMeta.variant} className="shrink-0">
                            {union.status === 'divorced' && (
                              <HeartCrack className="size-3" />
                            )}
                            {statusMeta.label}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Keturunan dari pernikahan ini:{' '}
                          <strong className="font-medium text-foreground">
                            {unionChildren.length} anak
                          </strong>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Generasi Penerus (Anak-anak) */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4 text-primary" />
                    Generasi Penerus ({children.length} Anak)
                  </CardTitle>
                  <CardDescription>
                    Daftar putra dan putri berurutan berdasarkan urutan kelahiran
                  </CardDescription>
                </div>
                <Button variant="outline" size="xs" asChild>
                  <Link href={`/admin/relasi/${person.id}`}>Kelola Anak</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {children.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
                  <Baby className="size-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Belum ada data putra atau putri
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Tambahkan hubungan anak melalui halaman Hubung Relasi apabila
                    sudah memiliki keturunan.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {children.map((child, idx) => {
                    const orderNumber = child.birthOrder ?? idx + 1;
                    const orderLabel = getBirthOrderLabel(
                      orderNumber,
                      children.length,
                    );
                    const otherParentName = child.parentUnionId
                      ? spouseByUnionId.get(child.parentUnionId)
                      : undefined;

                    return (
                      <Link
                        key={child.id}
                        href={`/anggota/${child.id}`}
                        className="group flex flex-col justify-between rounded-xl border border-[#d4c3bc] bg-background p-4 transition-all hover:border-primary hover:bg-card hover:shadow-sm"
                      >
                        <div>
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {orderNumber}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {orderLabel && (
                                <Badge
                                  variant={
                                    orderLabel === 'Sulung'
                                      ? 'accent'
                                      : orderLabel === 'Bungsu'
                                        ? 'secondary'
                                        : 'outline'
                                  }
                                  className="text-[10px]"
                                >
                                  {orderLabel}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  child.isDeceased ? 'destructive' : 'success'
                                }
                                className="text-[10px]"
                              >
                                {child.isDeceased ? 'Wafat' : 'Hidup'}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <PersonAvatar
                              fullName={child.fullName}
                              gender={child.gender}
                              isDeceased={child.isDeceased}
                              photoUrl={child.photoUrl}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">
                                {child.fullName}
                              </h3>
                              {child.nickname && (
                                <p className="text-xs text-muted-foreground">
                                  ({child.nickname})
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-2">
                            <GenderBadge gender={child.gender} size="xs" />
                            <span className="font-medium text-foreground">
                              {formatYearRange(
                                child.birthDate,
                                child.deathDate,
                                child.isDeceased,
                              )}
                            </span>
                          </div>
                          {otherParentName && (
                            <p className="truncate text-[11px]">
                              {person.gender === 'L' ? 'Ibu' : 'Ayah'}:{' '}
                              <span className="text-foreground">
                                {otherParentName}
                              </span>
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PersonProfilePage({ params }: PersonProfilePageProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader activePath="/" />
      <main className="flex-1">
        <Suspense fallback={<ProfileSkeleton />}>
          <PersonDetailContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}
