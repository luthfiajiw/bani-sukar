'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Baby, Loader2, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Gender, Person, Union } from '@/features/family/types';
import { createPersonAction, setParentsAction } from '@/features/family/actions';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatYearRange } from '@/lib/format';
import { cn } from '@/lib/utils';

interface UnionOption {
  union: Union;
  spouse: Person | null;
  children: Person[];
}

interface AddChildDialogProps {
  person: Person;
  unionOptions: UnionOption[];
  defaultUnionId?: string;
  allPersons: Person[];
  trigger?: ReactNode;
}

export function AddChildDialog({
  person,
  unionOptions,
  defaultUnionId,
  allPersons,
  trigger,
}: AddChildDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialUnionId = defaultUnionId ?? unionOptions[0]?.union.id ?? '';
  const [targetUnionId, setTargetUnionId] = useState(initialUnionId);

  // New child fields
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender>('L');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isDeceased, setIsDeceased] = useState(false);
  const [deathDate, setDeathDate] = useState('');

  // Existing person fields
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');

  const selectedUnion = unionOptions.find((u) => u.union.id === targetUnionId);

  const candidateChildren = useMemo(() => {
    const excluded = new Set<string>([person.id]);
    if (selectedUnion) {
      if (selectedUnion.union.husbandId) excluded.add(selectedUnion.union.husbandId);
      if (selectedUnion.union.wifeId) excluded.add(selectedUnion.union.wifeId);
      for (const child of selectedUnion.children) {
        excluded.add(child.id);
      }
    }

    const q = searchQuery.trim().toLowerCase();
    return allPersons
      .filter((candidate) => {
        if (excluded.has(candidate.id)) return false;
        if (!q) return true;
        return (
          candidate.fullName.toLowerCase().includes(q) ||
          (candidate.nickname ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
  }, [allPersons, person.id, searchQuery, selectedUnion]);

  function resetForm() {
    setTargetUnionId(defaultUnionId ?? unionOptions[0]?.union.id ?? '');
    setFullName('');
    setNickname('');
    setGender('L');
    setBirthPlace('');
    setBirthDate('');
    setIsDeceased(false);
    setDeathDate('');
    setSearchQuery('');
    setSelectedChildId('');
    setTab('new');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!targetUnionId) {
      toast.error('Tambahkan pasangan pernikahan terlebih dahulu sebelum menambah anak.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (tab === 'new') {
        const trimmedName = fullName.trim();
        if (trimmedName.length < 2) {
          toast.error('Nama lengkap anak minimal 2 karakter.');
          setIsSubmitting(false);
          return;
        }
        if (isDeceased && birthDate && deathDate && deathDate < birthDate) {
          toast.error('Tanggal wafat tidak boleh lebih awal dari tanggal lahir.');
          setIsSubmitting(false);
          return;
        }

        const nextOrder = (selectedUnion?.children.length ?? 0) + 1;
        const result = await createPersonAction({
          fullName: trimmedName,
          nickname: nickname.trim() || null,
          gender,
          isBloodLine: true,
          birthPlace: birthPlace.trim() || null,
          birthDate: birthDate.trim() || null,
          isDeceased,
          deathDate: isDeceased && deathDate.trim() ? deathDate.trim() : null,
          parentUnionId: targetUnionId,
          birthOrder: nextOrder,
        });

        if (!result.ok) {
          toast.error(result.error || 'Gagal menambahkan anak.');
          setIsSubmitting(false);
          return;
        }

        toast.success(`"${result.data.fullName}" berhasil ditambahkan sebagai anak.`);
      } else {
        if (!selectedChildId) {
          toast.error('Pilih anggota keluarga yang akan dihubungkan sebagai anak.');
          setIsSubmitting(false);
          return;
        }

        const result = await setParentsAction(selectedChildId, targetUnionId);
        if (!result.ok) {
          toast.error(result.error || 'Gagal menghubungkan anak ke pernikahan ini.');
          setIsSubmitting(false);
          return;
        }

        toast.success('Anggota berhasil dihubungkan sebagai anak.');
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat menyimpan data anak.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          setOpen(next);
          if (next) {
            setTargetUnionId(defaultUnionId ?? unionOptions[0]?.union.id ?? '');
          } else {
            resetForm();
          }
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="default" disabled={unionOptions.length === 0}>
            <Baby className="size-4" />
            <span>+ Tambah Anak</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah Anak (Garis Keturunan)</DialogTitle>
          <DialogDescription>
            Tambahkan anak baru ke garis keturunan{' '}
            <strong className="text-foreground">{person.fullName}</strong> atau hubungkan anggota yang sudah tercatat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {unionOptions.length > 1 && (
            <div className="space-y-1.5">
              <Label>Dari Pernikahan Dengan</Label>
              <Select
                value={targetUnionId}
                onValueChange={setTargetUnionId}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pasangan orang tua" />
                </SelectTrigger>
                <SelectContent>
                  {unionOptions.map((item, index) => (
                    <SelectItem key={item.union.id} value={item.union.id}>
                      Pernikahan #{index + 1}:{' '}
                      {item.spouse ? item.spouse.fullName : 'Pasangan tidak tercatat'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'new' | 'existing')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">
                <UserPlus className="size-4" />
                Buat Anak Baru
              </TabsTrigger>
              <TabsTrigger value="existing">
                <Users className="size-4" />
                Hubungkan Anggota Ada
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4 pt-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="child-fullname">
                    Nama Lengkap <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="child-fullname"
                    placeholder="cth. Tegar Pambudi"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="child-nickname">Nama Panggilan</Label>
                  <Input
                    id="child-nickname"
                    placeholder="Opsional"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Jenis Kelamin</Label>
                <RadioGroup
                  value={gender}
                  onValueChange={(val) => setGender(val as Gender)}
                  className="grid grid-cols-2 gap-3"
                  disabled={isSubmitting}
                >
                  <label
                    htmlFor="child-gender-l"
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm',
                      gender === 'L' ? 'border-primary bg-primary/5 font-medium' : 'border-border',
                    )}
                  >
                    <RadioGroupItem id="child-gender-l" value="L" />
                    Laki-laki (Putra)
                  </label>
                  <label
                    htmlFor="child-gender-p"
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm',
                      gender === 'P' ? 'border-primary bg-primary/5 font-medium' : 'border-border',
                    )}
                  >
                    <RadioGroupItem id="child-gender-p" value="P" />
                    Perempuan (Putri)
                  </label>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="child-birthplace">Tempat Lahir</Label>
                  <Input
                    id="child-birthplace"
                    placeholder="cth. Pati"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="child-birthdate">Tanggal Lahir</Label>
                  <Input
                    id="child-birthdate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Telah Wafat</p>
                  <p className="text-xs text-muted-foreground">
                    Anak baru otomatis berstatus Keturunan Bani Sukar.
                  </p>
                </div>
                <Switch
                  checked={isDeceased}
                  onCheckedChange={(checked) => {
                    setIsDeceased(checked);
                    if (!checked) setDeathDate('');
                  }}
                  disabled={isSubmitting}
                />
              </div>

              {isDeceased && (
                <div className="space-y-1.5">
                  <Label htmlFor="child-deathdate">Tanggal Wafat</Label>
                  <Input
                    id="child-deathdate"
                    type="date"
                    value={deathDate}
                    onChange={(e) => setDeathDate(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="existing" className="space-y-3 pt-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari anggota untuk dihubungkan sebagai anak..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={isSubmitting}
                />
              </div>

              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background/60 p-2">
                {candidateChildren.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Tidak ada kandidat anggota yang tersedia.
                  </p>
                ) : (
                  candidateChildren.map((candidate) => {
                    const isSelected = selectedChildId === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedChildId(candidate.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-transparent bg-card hover:border-border hover:bg-muted/60',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <PersonAvatar
                            fullName={candidate.fullName}
                            gender={candidate.gender}
                            isDeceased={candidate.isDeceased}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {candidate.fullName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {candidate.birthPlace ? `${candidate.birthPlace} • ` : ''}
                              {formatYearRange(
                                candidate.birthDate,
                                candidate.deathDate,
                                candidate.isDeceased,
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge variant={candidate.parentUnionId ? 'secondary' : 'outline'}>
                          {candidate.parentUnionId ? 'Sudah punya ortu' : 'Belum terhubung'}
                        </Badge>
                      </button>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting || !targetUnionId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Anak'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
