import type { Person } from './types';

export interface PreloadPhotosOptions {
  maxSizePx?: number;
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}

const DEFAULT_MAX_SIZE_PX = 96;
const CONCURRENCY_LIMIT = 6;

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Proses memuat foto dibatalkan', 'AbortError');
  }
  const err = new Error('Proses memuat foto dibatalkan');
  err.name = 'AbortError';
  return err;
}

async function decodeImageSource(
  blob: Blob,
): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) => {
        ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
      },
      cleanup: () => {
        if (typeof bitmap.close === 'function') {
          bitmap.close();
        }
      },
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal mendekode gambar foto'));
      el.src = objectUrl;
    });

    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) => {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      },
      cleanup: () => {
        URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

async function fetchAndDownscalePhoto(
  url: string,
  maxSizePx: number,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) {
    throw createAbortError();
  }

  if (typeof document === 'undefined' || typeof fetch !== 'function') {
    return null;
  }

  const response = await fetch(url, { mode: 'cors', signal });
  if (!response.ok) {
    return null;
  }

  const blob = await response.blob();
  if (signal?.aborted) {
    throw createAbortError();
  }

  if (!blob || blob.size === 0) {
    return null;
  }

  const decoded = await decodeImageSource(blob);
  try {
    if (decoded.width <= 0 || decoded.height <= 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = maxSizePx;
    canvas.height = maxSizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    // Crop persegi terpusat lalu masker lingkaran agar selaras dengan bingkai avatar
    const cropSize = Math.min(decoded.width, decoded.height);
    const sx = Math.max(0, (decoded.width - cropSize) / 2);
    const sy = Math.max(0, (decoded.height - cropSize) / 2);
    const radius = maxSizePx / 2;

    ctx.clearRect(0, 0, maxSizePx, maxSizePx);
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    decoded.draw(ctx, sx, sy, cropSize, cropSize, 0, 0, maxSizePx, maxSizePx);
    ctx.restore();

    return canvas.toDataURL('image/png');
  } finally {
    decoded.cleanup();
  }
}

/**
 * Memuat foto profil anggota secara paralel menjadi Data URL PNG beresolusi kecil.
 * Foto yang gagal dimuat atau terblokir CORS dilewati tanpa melempar error
 * sehingga kartu otomatis jatuh kembali ke avatar inisial.
 */
export async function preloadPhotosAsDataUrls(
  persons: Person[],
  options?: PreloadPhotosOptions,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (options?.signal?.aborted) {
    throw createAbortError();
  }

  const seenIds = new Set<string>();
  const targets: Array<{ id: string; url: string }> = [];
  for (const person of persons) {
    const url = person.photoUrl?.trim();
    if (!url || seenIds.has(person.id)) continue;
    seenIds.add(person.id);
    targets.push({ id: person.id, url });
  }

  const total = targets.length;
  if (total === 0) {
    return result;
  }

  // Di lingkungan non-browser (mis. SSR / unit test Node), langsung kembalikan Map kosong
  if (typeof document === 'undefined' || typeof fetch !== 'function') {
    options?.onProgress?.(total, total);
    return result;
  }

  const maxSizePx = Math.max(
    16,
    Math.round(options?.maxSizePx ?? DEFAULT_MAX_SIZE_PX),
  );
  let cursor = 0;
  let loaded = 0;

  async function worker(): Promise<void> {
    while (cursor < targets.length) {
      if (options?.signal?.aborted) {
        throw createAbortError();
      }
      const item = targets[cursor];
      cursor += 1;

      try {
        const dataUrl = await fetchAndDownscalePhoto(
          item.url,
          maxSizePx,
          options?.signal,
        );
        if (dataUrl) {
          result.set(item.id, dataUrl);
        }
      } catch (err) {
        if (
          options?.signal?.aborted ||
          (err instanceof Error && err.name === 'AbortError')
        ) {
          throw err;
        }
        // Lewati foto yang gagal / terblokir CORS secara halus agar fallback ke inisial
      } finally {
        loaded += 1;
        options?.onProgress?.(Math.min(loaded, total), total);
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY_LIMIT, targets.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return result;
}
