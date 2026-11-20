'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deletePersonAction } from '@/features/family/actions';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface DeletePersonDialogProps {
  personId: string;
  personName: string;
  trigger?: ReactNode;
  redirectTo?: string;
  onDeleted?: () => void;
}

export function DeletePersonDialog({
  personId,
  personName,
  trigger,
  redirectTo,
  onDeleted,
}: DeletePersonDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const result = await deletePersonAction(personId);
      if (!result.ok) {
        setErrorMessage(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(`Data "${personName}" berhasil dihapus.`);
      setOpen(false);
      onDeleted?.();
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      const msg = 'Terjadi kesalahan saat menghapus data anggota.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isDeleting) {
          setOpen(next);
          if (!next) setErrorMessage(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            <span>Hapus</span>
          </Button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5 text-destructive">
            <span className="flex size-9 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-5" />
            </span>
            <AlertDialogTitle>Hapus Anggota Keluarga?</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Anda akan menghapus <strong className="text-foreground">{personName}</strong> dari direktori silsilah Bani Sukar. Tindakan ini tidak dapat dibatalkan. Anggota yang masih memiliki keturunan (anak) harus dilepas relasinya terlebih dahulu.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={handleConfirmDelete}
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                Ya, Hapus Permanen
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
