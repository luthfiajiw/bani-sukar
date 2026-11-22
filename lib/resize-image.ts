'use client';

import { PHOTO_SIZE } from './photo';

export interface ResizedPhotoResult {
  blob: Blob;
  contentType: 'image/webp' | 'image/jpeg';
  fileName: string;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function loadImageSource(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

/**
 * Memotong gambar menjadi persegi di bagian tengah dan mengecilkannya ke `size x size` WebP
 * (dengan fallback JPEG jika browser tidak mendukung encode WebP).
 */
export async function resizeImageToSquareWebp(
  file: File,
  size: number = PHOTO_SIZE,
  quality: number = 0.85,
): Promise<ResizedPhotoResult> {
  const loaded = await loadImageSource(file);

  try {
    const minSide = Math.min(loaded.width, loaded.height);
    if (minSide <= 0) {
      throw new Error('Dimensi gambar tidak valid.');
    }

    const sx = (loaded.width - minSide) / 2;
    const sy = (loaded.height - minSide) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser tidak mendukung pemrosesan gambar Canvas.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(loaded.source, sx, sy, minSide, minSide, 0, 0, size, size);

    const webpBlob = await canvasToBlob(canvas, 'image/webp', quality);
    if (webpBlob && webpBlob.type === 'image/webp') {
      return {
        blob: webpBlob,
        contentType: 'image/webp',
        fileName: 'photo.webp',
      };
    }

    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!jpegBlob) {
      throw new Error('Gagal mengompresi gambar.');
    }

    return {
      blob: jpegBlob,
      contentType: 'image/jpeg',
      fileName: 'photo.jpg',
    };
  } finally {
    loaded.cleanup();
  }
}
