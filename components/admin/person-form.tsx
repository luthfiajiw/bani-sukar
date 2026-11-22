'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  HeartHandshake,
  Loader2,
  MapPin,
  Save,
  Sparkles,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Gender, Person } from '@/features/family/types';
import { createPersonAction, updatePersonAction } from '@/features/family/actions';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { formatDateId, formatYearRange, getGenerationLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PersonFormProps {
  mode: 'create' | 'edit';
  initialPerson?: Person;
  generation?: number;
}

export function PersonForm({ mode, initialPerson, generation }: PersonFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initialPerson?.fullName ?? '');
  const [nickname, setNickname] = useState(initialPerson?.nickname ?? '');
  const [gender, setGender] = useState<Gender>(initialPerson?.gender ?? 'L');
  const [isBloodLine, setIsBloodLine] = useState<boolean>(
    initialPerson?.isBloodLine ?? true,
  );
  const [birthPlace, setBirthPlace] = useState(initialPerson?.birthPlace ?? '');
  const [birthDate, setBirthDate] = useState(initialPerson?.birthDate ?? '');
  const [isDeceased, setIsDeceased] = useState<boolean>(
    initialPerson?.isDeceased ?? false,
  );
  const [deathDate, setDeathDate] = useState(initialPerson?.deathDate ?? '');

  const [submittingTarget, setSubmittingTarget] = useState<
    null | 'directory' | 'relations'
  >(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isBusy = submittingTarget !== null;

  function handleDeceasedChange(checked: boolean) {
    setIsDeceased(checked);
    if (!checked) {
      setDeathDate('');
    }
  }

  async function handleSave(redirectTarget: 'directory' | 'relations') {
    setFieldErrors({});
    setFormError(null);

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setFieldErrors({ fullName: ['Nama lengkap minimal 2 karakter.'] });
      toast.error('Nama lengkap minimal 2 karakter.');
      return;
    }

    if (isDeceased && birthDate && deathDate && deathDate < birthDate) {
      setFieldErrors({
        deathDate: ['Tanggal wafat tidak boleh lebih awal dari tanggal lahir.'],
      });
      toast.error('Tanggal wafat tidak boleh lebih awal dari tanggal lahir.');
      return;
    }

    setSubmittingTarget(redirectTarget);

    const payload = {
      fullName: trimmedName,
      nickname: nickname.trim() ? nickname.trim() : null,
      gender,
      isBloodLine,
      birthPlace: birthPlace.trim() ? birthPlace.trim() : null,
      birthDate: birthDate.trim() ? birthDate.trim() : null,
      isDeceased,
      deathDate: isDeceased && deathDate.trim() ? deathDate.trim() : null,
    };

    try {
      const result =
        mode === 'create'
          ? await createPersonAction(payload)
          : await updatePersonAction(initialPerson!.id, payload);

      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        toast.error(result.error || 'Gagal menyimpan data anggota.');
        return;
      }

      const savedId = result.data.id;
      toast.success(
        mode === 'create'
          ? `Data "${result.data.fullName}" berhasil ditambahkan.`
          : `Data "${result.data.fullName}" berhasil diperbarui.`,
      );

      if (redirectTarget === 'relations') {
        router.push(`/admin/relasi/${savedId}`);
      } else {
        router.push('/admin/anggota');
      }
      router.refresh();
    } catch {
      const msg = 'Terjadi kesalahan jaringan saat menyimpan data.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmittingTarget(null);
    }
  }

  const previewName = fullName.trim() || 'Nama Anggota Baru';
  const previewNickname = nickname.trim();
  const previewBirthPlace = birthPlace.trim();
  const previewYearRange = formatYearRange(
    birthDate || null,
    isDeceased ? deathDate || null : null,
    isDeceased,
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      {/* Main Form Column */}
      <div className="space-y-6 lg:col-span-8">
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {formError}
          </div>
        )}

        {/* Section 01: Identitas Diri */}
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                01
              </span>
              <div>
                <CardTitle className="text-base">Identitas Diri</CardTitle>
                <CardDescription>
                  Nama lengkap, sapaan, jenis kelamin, dan kedudukan dalam trah.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Nama Lengkap <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  placeholder="cth. Imam Sanadi"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.fullName?.length)}
                  disabled={isBusy}
                />
                {fieldErrors.fullName?.[0] && (
                  <p className="text-xs text-destructive">{fieldErrors.fullName[0]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Nama Panggilan / Sapaan</Label>
                <Input
                  id="nickname"
                  placeholder="cth. Mbah Sanadi / Pakde"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={isBusy}
                />
                {fieldErrors.nickname?.[0] && (
                  <p className="text-xs text-destructive">{fieldErrors.nickname[0]}</p>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2.5">
              <Label>
                Jenis Kelamin <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={gender}
                onValueChange={(val) => setGender(val as Gender)}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                disabled={isBusy}
              >
                <label
                  htmlFor="gender-l"
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors',
                    gender === 'L'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  <RadioGroupItem id="gender-l" value="L" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Laki-laki
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Kode L • Putra / Suami
                    </span>
                  </div>
                </label>

                <label
                  htmlFor="gender-p"
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors',
                    gender === 'P'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  <RadioGroupItem id="gender-p" value="P" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Perempuan
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Kode P • Putri / Istri
                    </span>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-2.5">
              <Label>Status Garis Keturunan</Label>
              <RadioGroup
                value={isBloodLine ? 'bloodline' : 'spouse'}
                onValueChange={(val) => setIsBloodLine(val === 'bloodline')}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                disabled={isBusy}
              >
                <label
                  htmlFor="lineage-blood"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                    isBloodLine
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  <RadioGroupItem id="lineage-blood" value="bloodline" className="mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <UserCheck className="size-3.5 text-primary" />
                      Keturunan Bani Sukar
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Nasab langsung (anak, cucu, cicit) atau leluhur pendiri.
                    </span>
                  </div>
                </label>

                <label
                  htmlFor="lineage-spouse"
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                    !isBloodLine
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  <RadioGroupItem id="lineage-spouse" value="spouse" className="mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <HeartHandshake className="size-3.5 text-accent" />
                      Menantu / Pasangan
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Bergabung melalui ikatan pernikahan (garis batas putus-putus).
                    </span>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Section 02: Kelahiran & Wafat */}
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                02
              </span>
              <div>
                <CardTitle className="text-base">Kelahiran &amp; Wafat</CardTitle>
                <CardDescription>
                  Catatan tempat lahir serta tanggal lahir dan wafat apabila tersedia.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birthPlace">Tempat Lahir</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="birthPlace"
                    placeholder="cth. Pati, Jawa Tengah"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    className="pl-9"
                    disabled={isBusy}
                  />
                </div>
                {fieldErrors.birthPlace?.[0] && (
                  <p className="text-xs text-destructive">{fieldErrors.birthPlace[0]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">Tanggal Lahir</Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="pl-9"
                    disabled={isBusy}
                  />
                </div>
                {fieldErrors.birthDate?.[0] && (
                  <p className="text-xs text-destructive">{fieldErrors.birthDate[0]}</p>
                )}
              </div>
            </div>

            {isDeceased && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="deathDate">Tanggal Wafat</Label>
                  <Input
                    id="deathDate"
                    type="date"
                    value={deathDate}
                    onChange={(e) => setDeathDate(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.deathDate?.length)}
                    disabled={isBusy}
                  />
                  <p className="text-xs text-muted-foreground">
                    Opsional — kosongkan jika tanggal pasti wafat belum diketahui.
                  </p>
                  {fieldErrors.deathDate?.[0] && (
                    <p className="text-xs text-destructive">{fieldErrors.deathDate[0]}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Footer */}
        <div className="flex flex-col-reverse gap-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" asChild disabled={isBusy}>
            <Link href={mode === 'edit' && initialPerson ? `/anggota/${initialPerson.id}` : '/admin/anggota'}>
              Batal
            </Link>
          </Button>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => handleSave('directory')}
            >
              {submittingTarget === 'directory' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Simpan Data Saja
                </>
              )}
            </Button>

            <Button
              type="button"
              disabled={isBusy}
              onClick={() => handleSave('relations')}
            >
              {submittingTarget === 'relations' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  Simpan &amp; Hubungkan Relasi
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sticky Preview & Status Sidebar */}
      <aside className="space-y-5 lg:sticky lg:top-24 lg:col-span-4">
        <Card className="overflow-hidden border-border bg-card pt-0">
          <CardHeader className="border-b border-border/70 bg-muted/60 pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" />
                <CardTitle className="text-sm">Pratinjau Kartu Bagan</CardTitle>
              </div>
              <Badge variant={isBloodLine ? 'default' : 'accent'}>
                {isBloodLine ? 'Nasab' : 'Menantu'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Tampilan langsung kartu pada bagan pohon silsilah.
            </CardDescription>
          </CardHeader>

          <CardContent className="bg-background/60 py-6">
            <div
              className={cn(
                'mx-auto w-full max-w-[260px] rounded-xl border p-3.5 shadow-sm transition-all',
                isBloodLine
                  ? 'border-[#d4c3bc] bg-card'
                  : 'border-dashed border-[#d4c3bc] bg-muted',
              )}
            >
              <div className="flex items-start gap-3">
                <PersonAvatar
                  fullName={previewName}
                  gender={gender}
                  isDeceased={isDeceased}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                    {previewName}
                  </p>
                  {previewNickname && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      “{previewNickname}”
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[11px]">
                  {gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                </Badge>
                {generation ? (
                  <Badge variant="secondary" className="text-[11px]">
                    {getGenerationLabel(generation)}
                  </Badge>
                ) : null}
                <Badge
                  variant={isDeceased ? 'destructive' : 'success'}
                  className="text-[11px]"
                >
                  {isDeceased ? 'Almarhum/ah' : 'Masih Hidup'}
                </Badge>
              </div>

              <div className="mt-3 space-y-1 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 truncate">
                  <MapPin className="size-3.5 shrink-0 text-primary/70" />
                  <span className="truncate">
                    {previewBirthPlace || 'Tempat lahir belum diisi'}
                  </span>
                </p>
                <p className="flex items-center gap-1.5 truncate">
                  <Calendar className="size-3.5 shrink-0 text-primary/70" />
                  <span className="truncate">{previewYearRange}</span>
                </p>
                {birthDate && (
                  <p className="pl-5 text-[11px] text-muted-foreground/80">
                    Lahir: {formatDateId(birthDate)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" />
              <CardTitle className="text-sm">Status Kehidupan</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Tandai apakah anggota keluarga masih hidup atau telah wafat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-3.5 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isDeceased ? 'Telah Wafat' : 'Masih Hidup'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isDeceased
                    ? 'Menampilkan penanda wafat pada kartu'
                    : 'Status aktif dalam keluarga'}
                </p>
              </div>
              <Switch
                id="isDeceased"
                checked={isDeceased}
                onCheckedChange={handleDeceasedChange}
                disabled={isBusy}
                aria-label="Status Kehidupan Telah Wafat"
              />
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
