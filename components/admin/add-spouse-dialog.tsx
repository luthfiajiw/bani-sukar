'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { HeartPlus, Loader2, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Gender, Person, UnionStatus } from '@/features/family/types';
import { createPersonAction, createUnionAction } from '@/features/family/actions';
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

interface AddSpouseDialogProps {
  person: Person;
  allPersons: Person[];
  existingSpouseIds: string[];
  trigger?: ReactNode;
}

export function AddSpouseDialog({
  person,
  allPersons,
  existingSpouseIds,
  trigger,
}: AddSpouseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<UnionStatus>('married');

  // New person fields
  const spouseGender: Gender = person.gender === 'L' ? 'P' : 'L';
  const spouseRoleLabel = spouseGender === 'P' ? 'Istri' : 'Suami';
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isDeceased, setIsDeceased] = useState(false);
  const [deathDate, setDeathDate] = useState('');

  // Existing person fields
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpouseId, setSelectedSpouseId] = useState('');

  const candidateSpouses = useMemo(() => {
    const excluded = new Set([person.id, ...existingSpouseIds]);
    const q = searchQuery.trim().toLowerCase();
    return allPersons
      .filter((candidate) => {
        if (excluded.has(candidate.id)) return false;
        if (candidate.gender !== spouseGender) return false;
        if (!q) return true;
        return (
          candidate.fullName.toLowerCase().includes(q) ||
          (candidate.nickname ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
  }, [allPersons, existingSpouseIds, person.id, searchQuery, spouseGender]);

  function resetForm() {
    setFullName('');
    setNickname('');
    setBirthPlace('');
    setBirthDate('');
    setIsDeceased(false);
    setDeathDate('');
    setSearchQuery('');
    setSelectedSpouseId('');
    setStatus('married');
    setTab('new');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let spouseId = selectedSpouseId;

      if (tab === 'new') {
        const trimmedName = fullName.trim();
        if (trimmedName.length < 2) {
          toast.error('Nama lengkap pasangan minimal 2 karakter.');
          setIsSubmitting(false);
          return;
        }
        if (isDeceased && birthDate && deathDate && deathDate < birthDate) {
          toast.error('Tanggal wafat tidak boleh lebih awal dari tanggal lahir.');
          setIsSubmitting(false);
          return;
        }

        const personRes = await createPersonAction({
          fullName: trimmedName,
          nickname: nickname.trim() || null,
          gender: spouseGender,
          isBloodLine: false,
          birthPlace: birthPlace.trim() || null,
          birthDate: birthDate.trim() || null,
          isDeceased,
          deathDate: isDeceased && deathDate.trim() ? deathDate.trim() : null,
        });

        if (!personRes.ok) {
          toast.error(personRes.error || 'Gagal membuat data pasangan.');
          setIsSubmitting(false);
          return;
        }

        spouseId = personRes.data.id;
      } else if (!spouseId) {
        toast.error(`Pilih ${spouseRoleLabel.toLowerCase()} dari daftar terlebih dahulu.`);
        setIsSubmitting(false);
        return;
      }

      const husbandId = person.gender === 'L' ? person.id : spouseId;
      const wifeId = person.gender === 'P' ? person.id : spouseId;

      const unionRes = await createUnionAction({
        husbandId,
        wifeId,
        status,
      });

      if (!unionRes.ok) {
        toast.error(unionRes.error || 'Gagal menghubungkan pernikahan.');
        setIsSubmitting(false);
        return;
      }

      toast.success(`${spouseRoleLabel} berhasil ditambahkan ke relasi ${person.fullName}.`);
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error('Terjadi kesalahan saat menyimpan relasi pasangan.');
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
          if (!next) resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="default">
            <HeartPlus className="size-4" />
            <span>+ Tambah Pasangan</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah Pasangan ({spouseRoleLabel})</DialogTitle>
          <DialogDescription>
            Hubungkan {spouseRoleLabel.toLowerCase()} untuk{' '}
            <strong className="text-foreground">{person.fullName}</strong>. Anda dapat membuat anggota baru (menantu) atau memilih dari anggota yang sudah terdaftar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'new' | 'existing')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">
                <UserPlus className="size-4" />
                Buat Pasangan Baru
              </TabsTrigger>
              <TabsTrigger value="existing">
                <Users className="size-4" />
                Pilih Anggota Ada
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4 pt-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="spouse-fullname">
                    Nama Lengkap <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="spouse-fullname"
                    placeholder={`Nama ${spouseRoleLabel.toLowerCase()}`}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spouse-nickname">Nama Panggilan</Label>
                  <Input
                    id="spouse-nickname"
                    placeholder="Opsional"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="spouse-birthplace">Tempat Lahir</Label>
                  <Input
                    id="spouse-birthplace"
                    placeholder="cth. Pati"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spouse-birthdate">Tanggal Lahir</Label>
                  <Input
                    id="spouse-birthdate"
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
                    Otomatis tercatat sebagai menantu/pasangan ({spouseRoleLabel},{' '}
                    {spouseGender}).
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
                  <Label htmlFor="spouse-deathdate">Tanggal Wafat</Label>
                  <Input
                    id="spouse-deathdate"
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
                  placeholder={`Cari ${spouseRoleLabel.toLowerCase()} (${spouseGender})...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={isSubmitting}
                />
              </div>

              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background/60 p-2">
                {candidateSpouses.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Tidak ada kandidat {spouseRoleLabel.toLowerCase()} yang tersedia.
                  </p>
                ) : (
                  candidateSpouses.map((candidate) => {
                    const isSelected = selectedSpouseId === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedSpouseId(candidate.id)}
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
                        <Badge variant={candidate.isBloodLine ? 'default' : 'outline'}>
                          {candidate.isBloodLine ? 'Nasab' : 'Menantu'}
                        </Badge>
                      </button>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-1.5 border-t border-border pt-3">
            <Label>Status Ikatan Pernikahan</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as UnionStatus)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="married">Menikah (Aktif)</SelectItem>
                <SelectItem value="divorced">Cerai</SelectItem>
                <SelectItem value="widowed">Wafat Pasangan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Pasangan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
