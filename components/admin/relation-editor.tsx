'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Baby,
  ExternalLink,
  GitPullRequest,
  Heart,
  Link2Off,
  Loader2,
  Search,
  Trash2,
  Unlink,
  UserCog,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type { RelationEditorData, UnionStatus } from '@/features/family/types';
import {
  deleteUnionAction,
  reorderChildrenAction,
  setParentsAction,
  updateUnionAction,
} from '@/features/family/actions';
import { AddChildDialog } from '@/components/admin/add-child-dialog';
import { AddSpouseDialog } from '@/components/admin/add-spouse-dialog';
import { GenderBadge, GenderIcon } from '@/components/gender-icon';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatYearRange, getBirthOrderLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

const UNION_STATUS_META: Record<
  UnionStatus,
  { label: string; badgeVariant: 'success' | 'destructive' | 'secondary' }
> = {
  married: { label: 'Menikah', badgeVariant: 'success' },
  divorced: { label: 'Cerai', badgeVariant: 'destructive' },
  widowed: { label: 'Wafat Pasangan', badgeVariant: 'secondary' },
};

interface RelationEditorProps {
  data: RelationEditorData;
}

export function RelationEditor({ data }: RelationEditorProps) {
  const router = useRouter();
  const { person, parents, unions, allPersons, allUnions } = data;

  const [personFilter, setPersonFilter] = useState('');
  const [selectedParentUnionId, setSelectedParentUnionId] = useState(
    parents.union?.id ?? '',
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const filteredPersons = useMemo(() => {
    const q = personFilter.trim().toLowerCase();
    const sorted = [...allPersons].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'id'),
    );
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        (p.nickname ?? '').toLowerCase().includes(q),
    );
  }, [allPersons, personFilter]);

  const parentUnionOptions = useMemo(
    () =>
      allUnions.filter(
        (u) => u.union.husbandId !== person.id && u.union.wifeId !== person.id,
      ),
    [allUnions, person.id],
  );

  const existingSpouseIds = useMemo(
    () =>
      unions
        .map((item) => item.spouse?.id)
        .filter((id): id is string => Boolean(id)),
    [unions],
  );

  const allChildrenPreview = useMemo(() => {
    const list: Array<{ child: RelationEditorData['person']; orderLabel: string | null }> = [];
    for (const group of unions) {
      group.children.forEach((child, idx) => {
        list.push({
          child,
          orderLabel: getBirthOrderLabel(idx + 1, group.children.length),
        });
      });
    }
    return list;
  }, [unions]);

  async function handleSaveParentUnion() {
    if (!selectedParentUnionId) {
      toast.error('Pilih pasangan orang tua terlebih dahulu.');
      return;
    }
    setBusyKey('save-parent');
    try {
      const res = await setParentsAction(person.id, selectedParentUnionId);
      if (!res.ok) {
        toast.error(res.error || 'Gagal memperbarui hubungan orang tua.');
        return;
      }
      toast.success('Garis leluhur (orang tua) berhasil diperbarui.');
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat memperbarui orang tua.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUnlinkParents() {
    setBusyKey('unlink-parent');
    try {
      const res = await setParentsAction(person.id, null);
      if (!res.ok) {
        toast.error(res.error || 'Gagal memutus hubungan orang tua.');
        return;
      }
      setSelectedParentUnionId('');
      toast.success('Hubungan dengan orang tua berhasil diputus.');
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat memutus hubungan orang tua.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpdateUnionStatus(unionId: string, status: UnionStatus) {
    setBusyKey(`union-status-${unionId}`);
    try {
      const res = await updateUnionAction(unionId, { status });
      if (!res.ok) {
        toast.error(res.error || 'Gagal mengubah status pernikahan.');
        return;
      }
      toast.success('Status ikatan pernikahan diperbarui.');
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat mengubah status pernikahan.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteUnion(unionId: string) {
    setBusyKey(`union-delete-${unionId}`);
    try {
      const res = await deleteUnionAction(unionId);
      if (!res.ok) {
        toast.error(res.error || 'Gagal menghapus ikatan pernikahan.');
        return;
      }
      toast.success('Ikatan pernikahan berhasil dihapus.');
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat menghapus pernikahan.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleMoveChild(
    unionId: string,
    children: RelationEditorData['person'][],
    index: number,
    direction: 'up' | 'down',
  ) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= children.length) return;

    const reordered = [...children];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setBusyKey(`reorder-${unionId}`);
    try {
      const res = await reorderChildrenAction(
        unionId,
        reordered.map((c) => c.id),
      );
      if (!res.ok) {
        toast.error(res.error || 'Gagal mengubah urutan kelahiran anak.');
        return;
      }
      toast.success('Urutan kelahiran anak diperbarui.');
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat mengubah urutan anak.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUnlinkChild(childId: string, childName: string) {
    setBusyKey(`unlink-child-${childId}`);
    try {
      const res = await setParentsAction(childId, null);
      if (!res.ok) {
        toast.error(res.error || 'Gagal melepaskan relasi anak.');
        return;
      }
      toast.success(`"${childName}" dilepas dari garis keturunan ini.`);
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat melepaskan anak.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      {/* Left Column: 3-Generation Preview Diagram */}
      <aside className="lg:sticky lg:top-24 lg:col-span-5">
        <Card className="overflow-hidden border-border bg-card pt-0">
          <CardHeader className="border-b border-border/70 bg-muted/60 pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitPullRequest className="size-4 text-primary" />
                <CardTitle className="text-sm">
                  Pratinjau Diagram 3 Generasi
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[11px]">
                Simulasi Struktur Nasab
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Klik kartu keluarga di bawah untuk berpindah tokoh fokus.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 bg-[radial-gradient(#d4c3bc_1px,transparent_1px)] [background-size:16px_16px] py-6">
            {/* Tier 1: Parents */}
            <div className="space-y-2">
              <p className="text-center text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Generasi Atas • Orang Tua
              </p>
              {parents.union ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {[parents.father, parents.mother].map((parent, idx) =>
                    parent ? (
                      <Link
                        key={parent.id}
                        href={`/admin/relasi/${parent.id}`}
                        className="flex min-w-[140px] max-w-[190px] items-center gap-2 rounded-lg border border-[#d4c3bc] bg-card px-2.5 py-2 shadow-xs transition-colors hover:border-primary"
                      >
                        <PersonAvatar
                          fullName={parent.fullName}
                          gender={parent.gender}
                          isDeceased={parent.isDeceased}
                          photoUrl={parent.photoUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {parent.fullName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {idx === 0 ? 'Ayah' : 'Ibu'}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div
                        key={`unknown-parent-${idx}`}
                        className="flex min-w-[130px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
                      >
                        {idx === 0 ? 'Ayah belum tercatat' : 'Ibu belum tercatat'}
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="mx-auto max-w-xs rounded-lg border border-dashed border-border bg-card/80 px-3 py-2.5 text-center text-xs text-muted-foreground">
                  Belum terhubung ke orang tua (Leluhur / Akar)
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <div className="h-6 w-px bg-[#b89f94]" />
            </div>

            {/* Tier 2: Focal Person + Spouses */}
            <div className="space-y-2">
              <p className="text-center text-[10px] font-semibold tracking-widest text-primary uppercase">
                Tokoh Fokus &amp; Pasangan
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <div className="flex min-w-[180px] max-w-[230px] items-center gap-2.5 rounded-xl border-2 border-primary bg-card px-3 py-2.5 shadow-sm ring-2 ring-accent/30">
                  <PersonAvatar
                    fullName={person.fullName}
                    gender={person.gender}
                    isDeceased={person.isDeceased}
                    photoUrl={person.photoUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {person.fullName}
                    </p>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <GenderBadge gender={person.gender} size="xs" />
                      <span>• {person.isBloodLine ? 'Nasab' : 'Menantu'}</span>
                    </p>
                  </div>
                </div>

                {unions.map((item) => (
                  <div key={item.union.id} className="flex items-center gap-2">
                    <span
                      title={UNION_STATUS_META[item.union.status].label}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full border text-[11px] font-bold shadow-xs',
                        item.union.status === 'divorced'
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : 'border-accent/50 bg-card text-primary',
                      )}
                    >
                      {item.union.status === 'divorced' ? (
                        '//'
                      ) : (
                        <Heart className="size-3 fill-current" />
                      )}
                    </span>

                    {item.spouse ? (
                      <Link
                        href={`/admin/relasi/${item.spouse.id}`}
                        className="flex min-w-[150px] max-w-[200px] items-center gap-2 rounded-lg border border-dashed border-[#d4c3bc] bg-muted px-2.5 py-2 shadow-xs transition-colors hover:border-primary"
                      >
                        <PersonAvatar
                          fullName={item.spouse.fullName}
                          gender={item.spouse.gender}
                          isDeceased={item.spouse.isDeceased}
                          photoUrl={item.spouse.photoUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {item.spouse.fullName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {UNION_STATUS_META[item.union.status].label}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                        Pasangan belum diisi
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <div className="h-6 w-px bg-[#b89f94]" />
            </div>

            {/* Tier 3: Children */}
            <div className="space-y-2">
              <p className="text-center text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Generasi Bawah • Anak ({allChildrenPreview.length})
              </p>
              {allChildrenPreview.length === 0 ? (
                <div className="mx-auto max-w-xs rounded-lg border border-dashed border-border bg-card/80 px-3 py-2.5 text-center text-xs text-muted-foreground">
                  Belum ada keturunan yang terhubung
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {allChildrenPreview.map(({ child, orderLabel }) => (
                    <Link
                      key={child.id}
                      href={`/admin/relasi/${child.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#d4c3bc] bg-card px-2.5 py-2 shadow-xs transition-colors hover:border-primary"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <PersonAvatar
                          fullName={child.fullName}
                          gender={child.gender}
                          isDeceased={child.isDeceased}
                          photoUrl={child.photoUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {child.fullName}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {formatYearRange(
                              child.birthDate,
                              child.deathDate,
                              child.isDeceased,
                            )}
                          </p>
                        </div>
                      </div>
                      {orderLabel && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {orderLabel}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Right Column: 4 Numbered Control Cards */}
      <div className="space-y-5 lg:col-span-7">
        {/* Card 1: Select Focal Person */}
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <div>
                  <CardTitle className="text-base">
                    Pilih Tokoh Utama yang Dihubungkan
                  </CardTitle>
                  <CardDescription>
                    Beralih ke anggota keluarga mana pun untuk mengatur nasabnya.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="xs" asChild>
                  <Link href={`/anggota/${person.id}`}>
                    <ExternalLink className="size-3.5" />
                    Profil
                  </Link>
                </Button>
                <Button variant="outline" size="xs" asChild>
                  <Link href={`/admin/anggota/${person.id}`}>
                    <UserCog className="size-3.5" />
                    Sunting
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari cepat nama anggota..."
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={person.id}
              onValueChange={(nextId) => {
                if (nextId && nextId !== person.id) {
                  router.push(`/admin/relasi/${nextId}`);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih anggota keluarga" />
              </SelectTrigger>
              <SelectContent>
                {filteredPersons.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Tidak ada nama yang cocok.
                  </div>
                ) : (
                  filteredPersons.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="inline-flex items-center gap-1.5">
                        <GenderIcon gender={item.gender} className="size-3.5" />
                        <span>
                          {item.fullName}
                          {item.nickname ? ` — ${item.nickname}` : ''}
                        </span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Card 2: Ancestor / Parents */}
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                2
              </span>
              <div>
                <CardTitle className="text-base">Garis Leluhur (Orang Tua)</CardTitle>
                <CardDescription>
                  Hubungkan tokoh ini sebagai anak dari pasangan pernikahan orang tua.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {parents.union ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Orang Tua Saat Ini
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {parents.father?.fullName ?? 'Ayah tidak tercatat'} &amp;{' '}
                    {parents.mother?.fullName ?? 'Ibu tidak tercatat'}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyKey !== null}
                  onClick={handleUnlinkParents}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {busyKey === 'unlink-parent' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Link2Off className="size-4" />
                  )}
                  Putus Hubungan
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
                Belum terhubung ke orang tua. Pilih pasangan orang tua di bawah apabila tokoh ini merupakan keturunan dari pasangan yang sudah tercatat.
              </p>
            )}

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Select
                  value={selectedParentUnionId}
                  onValueChange={setSelectedParentUnionId}
                  disabled={busyKey !== null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pasangan orang tua..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parentUnionOptions.map((item) => (
                      <SelectItem key={item.union.id} value={item.union.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={busyKey !== null || !selectedParentUnionId}
                onClick={handleSaveParentUnion}
              >
                {busyKey === 'save-parent' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Orang Tua'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Spouses / Unions */}
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  3
                </span>
                <div>
                  <CardTitle className="text-base">
                    Pasangan Pernikahan ({person.gender === 'L' ? 'Istri' : 'Suami'})
                  </CardTitle>
                  <CardDescription>
                    Kelola ikatan pernikahan, status cerai/wafat, atau tambah pasangan baru.
                  </CardDescription>
                </div>
              </div>

              <AddSpouseDialog
                person={person}
                allPersons={allPersons}
                existingSpouseIds={existingSpouseIds}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-1">
            {unions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada pasangan pernikahan tercatat untuk {person.fullName}.
              </div>
            ) : (
              unions.map((item, idx) => {
                const statusMeta = UNION_STATUS_META[item.union.status];
                return (
                  <div
                    key={item.union.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {item.spouse ? (
                        <PersonAvatar
                          fullName={item.spouse.fullName}
                          gender={item.spouse.gender}
                          isDeceased={item.spouse.isDeceased}
                          photoUrl={item.spouse.photoUrl}
                          size="md"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-border bg-muted text-muted-foreground">
                          <Users className="size-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.spouse?.fullName ?? 'Pasangan tidak tercatat'}
                          </p>
                          <Badge variant={statusMeta.badgeVariant}>
                            {statusMeta.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Pernikahan ke-{idx + 1} • {item.children.length} anak tercatat
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-36">
                        <Select
                          value={item.union.status}
                          onValueChange={(next) =>
                            handleUpdateUnionStatus(
                              item.union.id,
                              next as UnionStatus,
                            )
                          }
                          disabled={busyKey !== null}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="married">Menikah</SelectItem>
                            <SelectItem value="divorced">Cerai</SelectItem>
                            <SelectItem value="widowed">Wafat Pasangan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busyKey !== null}
                        onClick={() => handleDeleteUnion(item.union.id)}
                        title="Hapus ikatan pernikahan"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {busyKey === `union-delete-${item.union.id}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Card 4: Children */}
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  4
                </span>
                <div>
                  <CardTitle className="text-base">
                    Garis Keturunan (Anak-anak)
                  </CardTitle>
                  <CardDescription>
                    Atur urutan kelahiran (Sulung → Bungsu) atau tambahkan anak ke pernikahan terkait.
                  </CardDescription>
                </div>
              </div>

              {unions.length > 0 && (
                <AddChildDialog
                  person={person}
                  unionOptions={unions}
                  allPersons={allPersons}
                />
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-1">
            {unions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Tambahkan pasangan pernikahan pada bagian 3 terlebih dahulu sebelum menambahkan anak.
              </div>
            ) : (
              unions.map((group, groupIdx) => (
                <div
                  key={group.union.id}
                  className="space-y-3 rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Pernikahan #{groupIdx + 1}
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        Bersama {group.spouse?.fullName ?? 'Pasangan tidak tercatat'}
                      </p>
                    </div>

                    <AddChildDialog
                      person={person}
                      unionOptions={unions}
                      defaultUnionId={group.union.id}
                      allPersons={allPersons}
                      trigger={
                        <Button size="xs" variant="outline">
                          <Baby className="size-3.5" />
                          <span>+ Tambah Anak</span>
                        </Button>
                      }
                    />
                  </div>

                  <Separator />

                  {group.children.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">
                      Belum ada anak pada pernikahan ini.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {group.children.map((child, idx) => {
                        const orderLabel = getBirthOrderLabel(
                          idx + 1,
                          group.children.length,
                        );
                        return (
                          <div
                            key={child.id}
                            className="flex flex-col gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                                {idx + 1}
                              </span>
                              <PersonAvatar
                                fullName={child.fullName}
                                gender={child.gender}
                                isDeceased={child.isDeceased}
                                photoUrl={child.photoUrl}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Link
                                    href={`/admin/relasi/${child.id}`}
                                    className="truncate text-sm font-semibold text-foreground hover:text-primary hover:underline"
                                  >
                                    {child.fullName}
                                  </Link>
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
                                </div>
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <GenderBadge gender={child.gender} size="xs" />
                                  <span>
                                    •{' '}
                                    {formatYearRange(
                                      child.birthDate,
                                      child.deathDate,
                                      child.isDeceased,
                                    )}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={busyKey !== null || idx === 0}
                                onClick={() =>
                                  handleMoveChild(
                                    group.union.id,
                                    group.children,
                                    idx,
                                    'up',
                                  )
                                }
                                title="Naikkan urutan"
                                aria-label={`Naikkan urutan ${child.fullName}`}
                              >
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                disabled={
                                  busyKey !== null ||
                                  idx === group.children.length - 1
                                }
                                onClick={() =>
                                  handleMoveChild(
                                    group.union.id,
                                    group.children,
                                    idx,
                                    'down',
                                  )
                                }
                                title="Turunkan urutan"
                                aria-label={`Turunkan urutan ${child.fullName}`}
                              >
                                <ArrowDown className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={busyKey !== null}
                                onClick={() =>
                                  handleUnlinkChild(child.id, child.fullName)
                                }
                                title="Lepaskan dari garis keturunan ini"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Unlink className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
