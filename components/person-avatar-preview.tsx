'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PersonAvatar } from '@/components/person-avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PersonAvatarPreviewProps {
  fullName: string;
  gender: 'L' | 'P';
  isDeceased?: boolean;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  imageSizes?: string;
  className?: string;
}

export function PersonAvatarPreview({
  fullName,
  gender,
  isDeceased = false,
  photoUrl,
  size = 'xl',
  imageSizes,
  className,
}: PersonAvatarPreviewProps) {
  const [open, setOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const normalizedUrl = photoUrl?.trim() || null;
  const canPreview = Boolean(normalizedUrl && failedUrl !== normalizedUrl);
  const isLocalPreview = Boolean(
    normalizedUrl &&
      (normalizedUrl.startsWith('blob:') || normalizedUrl.startsWith('data:')),
  );

  if (!normalizedUrl || (!canPreview && !open)) {
    return (
      <PersonAvatar
        fullName={fullName}
        gender={gender}
        isDeceased={isDeceased}
        photoUrl={photoUrl}
        size={size}
        imageSizes={imageSizes}
        className={className}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Klik untuk memperbesar foto"
          aria-label={`Lihat foto profil ${fullName} lebih besar`}
          className={cn(
            'group relative inline-flex cursor-zoom-in rounded-full transition-all hover:scale-[1.03] hover:ring-2 hover:ring-primary/40 hover:ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
          )}
        >
          <PersonAvatar
            fullName={fullName}
            gender={gender}
            isDeceased={isDeceased}
            photoUrl={normalizedUrl}
            size={size}
            imageSizes={imageSizes}
            onImageError={() => setFailedUrl(normalizedUrl)}
          />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{fullName}</DialogTitle>
        </DialogHeader>

        {canPreview ? (
          <div className="relative mx-auto aspect-square w-full max-h-[70dvh] overflow-hidden rounded-lg border border-border bg-muted/40">
            <Image
              src={normalizedUrl}
              alt={`Foto profil ${fullName}`}
              fill
              sizes="(max-width: 640px) 90vw, 464px"
              unoptimized={isLocalPreview}
              onError={() => setFailedUrl(normalizedUrl)}
              className="object-contain"
            />
          </div>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Foto profil tidak dapat dimuat.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
