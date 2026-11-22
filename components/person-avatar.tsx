'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/format';

const SIZE_STYLES = {
  sm: {
    container: 'size-8 text-xs',
    dot: 'size-2 right-0 bottom-0 ring-[1.5px]',
    sizes: '32px',
  },
  md: {
    container: 'size-10 text-sm',
    dot: 'size-2.5 right-0 bottom-0 ring-2',
    sizes: '40px',
  },
  lg: {
    container: 'size-14 text-lg',
    dot: 'size-3 right-0.5 bottom-0.5 ring-2',
    sizes: '56px',
  },
  xl: {
    container: 'size-20 text-2xl',
    dot: 'size-3.5 right-1 bottom-1 ring-2',
    sizes: '80px',
  },
} as const;

export function PersonAvatar({
  fullName,
  gender,
  isDeceased = false,
  photoUrl,
  size = 'md',
  imageSizes,
  className,
  onImageError,
}: {
  fullName: string;
  gender: 'L' | 'P';
  isDeceased?: boolean;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  imageSizes?: string;
  className?: string;
  onImageError?: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = getInitials(fullName);
  const styles = SIZE_STYLES[size];
  const normalizedUrl = photoUrl?.trim() || null;
  const showImage = Boolean(normalizedUrl && failedUrl !== normalizedUrl);
  const isLocalPreview = Boolean(
    normalizedUrl &&
      (normalizedUrl.startsWith('blob:') || normalizedUrl.startsWith('data:')),
  );

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full border-2 font-semibold tracking-tight select-none shadow-xs',
        gender === 'L'
          ? 'border-[#cbb4a3] bg-[#efe5dc] text-[#5c3d2e]'
          : 'border-[#dfc48f] bg-[#f8edd6] text-[#7a541a]',
        styles.container,
        className,
      )}
      aria-label={`${fullName} (${gender === 'L' ? 'Laki-laki' : 'Perempuan'}, ${isDeceased ? 'Almarhum/Wafat' : 'Masih Hidup'})`}
    >
      <span className="relative flex size-full items-center justify-center overflow-hidden rounded-full">
        {showImage && normalizedUrl ? (
          <Image
            src={normalizedUrl}
            alt={fullName}
            fill
            sizes={imageSizes ?? styles.sizes}
            unoptimized={isLocalPreview}
            onError={() => {
              setFailedUrl(normalizedUrl);
              onImageError?.();
            }}
            className="object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </span>
      <span
        title={isDeceased ? 'Almarhum / Wafat' : 'Masih Hidup'}
        className={cn(
          'absolute rounded-full ring-card',
          isDeceased ? 'bg-[#ba1a1a]' : 'bg-[#2d4030]',
          styles.dot,
        )}
      />
    </div>
  );
}
