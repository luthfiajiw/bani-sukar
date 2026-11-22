'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Gender, Person } from '@/features/family/types';
import {
  removePersonPhotoAction,
  uploadPersonPhotoAction,
} from '@/features/family/actions';
import {
  PHOTO_ACCEPTED_TYPES,
  PHOTO_MAX_INPUT_BYTES,
  validatePhotoFile,
} from '@/lib/photo';
import {
  type ResizedPhotoResult,
  resizeImageToSquareWebp,
} from '@/lib/resize-image';
import { PersonAvatar } from '@/components/person-avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface PendingPhotoUpload extends ResizedPhotoResult {
  previewUrl: string;
}

interface PersonPhotoFieldProps {
  mode: 'create' | 'edit';
  personId?: string;
  fullName: string;
  gender: Gender;
  isDeceased: boolean;
  photoUrl: string | null;
  disabled?: boolean;
  onPhotoUpdated?: (person: Person) => void;
  onPendingChange?: (pending: PendingPhotoUpload | null) => void;
}

export function PersonPhotoField({
  mode,
  personId,
  fullName,
  gender,
  isDeceased,
  photoUrl,
  disabled = false,
  onPhotoUpdated,
  onPendingChange,
}: PersonPhotoFieldProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const busy = disabled || isProcessing || isRemoving;
  const displayName = fullName.trim() || 'Anggota Keluarga';
  const hasPhoto = Boolean(photoUrl);

  async function processFile(file: File) {
    setErrorMessage(null);

    const validationError = validatePhotoFile(file, PHOTO_MAX_INPUT_BYTES);
    if (validationError) {
      setErrorMessage(validationError);
      toast.error(validationError);
      return;
    }

    setIsProcessing(true);
    try {
      const resized = await resizeImageToSquareWebp(file);

      if (mode === 'create') {
        const previewUrl = URL.createObjectURL(resized.blob);
        onPendingChange?.({ ...resized, previewUrl });
        toast.success('Foto siap diunggah saat data anggota disimpan.');
        return;
      }

      if (!personId) {
        throw new Error('ID anggota tidak ditemukan.');
      }

      const fd = new FormData();
      fd.set('personId', personId);
      fd.set(
        'file',
        new File([resized.blob], resized.fileName, {
          type: resized.contentType,
        }),
      );

      const result = await uploadPersonPhotoAction(fd);
      if (!result.ok) {
        setErrorMessage(result.error);
        toast.error(result.error);
        return;
      }

      onPhotoUpdated?.(result.data);
      toast.success('Foto profil berhasil diperbarui.');
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal memproses foto profil.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  async function handleRemove() {
    setErrorMessage(null);

    if (mode === 'create') {
      onPendingChange?.(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      return;
    }

    if (!personId) return;

    setIsRemoving(true);
    try {
      const result = await removePersonPhotoAction(personId);
      if (!result.ok) {
        setErrorMessage(result.error);
        toast.error(result.error);
        return;
      }

      onPhotoUpdated?.(result.data);
      toast.success('Foto profil berhasil dihapus.');
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menghapus foto profil.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsRemoving(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (busy) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-primary" />
            <CardTitle className="text-sm">Foto Profil</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {mode === 'edit' ? 'Simpan Otomatis' : 'Opsional'}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {mode === 'edit'
            ? 'Foto langsung tersimpan ke Supabase Storage saat dipilih.'
            : 'Pilih foto sekarang untuk ikut diunggah setelah anggota disimpan.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_ACCEPTED_TYPES.join(',')}
          onChange={handleInputChange}
          disabled={busy}
          className="sr-only"
          aria-label="Pilih file foto profil"
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center gap-3 rounded-xl border border-dashed p-4 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/40',
            busy && 'opacity-70',
          )}
        >
          <div className="relative">
            <PersonAvatar
              fullName={displayName}
              gender={gender}
              isDeceased={isDeceased}
              photoUrl={photoUrl}
              size="xl"
            />
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">
              {isDragging
                ? 'Lepaskan file di sini...'
                : 'Tarik & lepas gambar atau klik tombol di bawah'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              JPG, PNG, atau WebP • Maks. 10 MB (otomatis 512×512)
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant={hasPhoto ? 'outline' : 'secondary'}
              size="xs"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Mengunggah...
                </>
              ) : hasPhoto ? (
                <>
                  <Upload className="size-3.5" />
                  Ganti Foto
                </>
              ) : (
                <>
                  <ImagePlus className="size-3.5" />
                  Pilih Foto
                </>
              )}
            </Button>

            {hasPhoto &&
              (mode === 'create' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  onClick={() => void handleRemove()}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Batalkan
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={busy}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {isRemoving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Hapus Foto
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus Foto Profil?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Foto profil untuk{' '}
                        <strong className="text-foreground">
                          {displayName}
                        </strong>{' '}
                        akan dihapus permanen dan tampilan akan kembali
                        menggunakan inisial nama.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void handleRemove()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Ya, Hapus Foto
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ))}
          </div>
        </div>

        {errorMessage && (
          <p role="alert" className="text-xs text-destructive">
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
