export interface ShareOrDownloadOptions {
  title?: string;
  text?: string;
  preferShare?: boolean;
}

/**
 * Mengecek apakah browser mendukung Web Share API Level 2 dengan lampiran berkas.
 */
export function canUseWebShareForFiles(): boolean {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function' ||
    typeof File === 'undefined'
  ) {
    return false;
  }

  try {
    const probe = new File([''], 'probe.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function triggerAnchorDownload(blob: Blob, filename: string): 'downloaded' {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return 'downloaded';
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1500);

  return 'downloaded';
}

/**
 * Membagikan berkas hasil ekspor lewat Web Share API (mis. ke WhatsApp di HP)
 * bila `preferShare` aktif dan didukung browser, atau jatuh kembali ke
 * unduhan langsung via anchor `<a download>`.
 */
export async function shareOrDownloadBlob(
  blob: Blob,
  filename: string,
  options?: ShareOrDownloadOptions,
): Promise<'shared' | 'downloaded'> {
  if (options?.preferShare && canUseWebShareForFiles()) {
    try {
      const file = new File([blob], filename, {
        type: blob.type || 'application/octet-stream',
      });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: options.title,
          text: options.text,
        });
        return 'shared';
      }
    } catch (err) {
      // Jika pengguna menutup sheet bagikan sendiri, jangan paksa mengunduh ulang
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared';
      }
      // Error izin / ketidakcocokan browser -> fallback ke unduhan standar
    }
  }

  return triggerAnchorDownload(blob, filename);
}
