export const PHOTO_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AcceptedPhotoMimeType = (typeof PHOTO_ACCEPTED_TYPES)[number];

export const PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB sebelum kompresi client
export const PHOTO_MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB setelah kompresi
export const PHOTO_SIZE = 512;

export function getDefaultStorageBucket(): string {
  return (
    process.env.SUPABASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET?.trim() ||
    'person-photos'
  );
}

/**
 * Mengubah object key storage (mis. `persons/<id>/<ts>.webp`) menjadi public URL Supabase.
 */
export function getPhotoPublicUrl(
  path: string | null | undefined,
  options?: { baseUrl?: string; bucket?: string },
): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }

  const baseUrl = (options?.baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!baseUrl) return null;

  const bucket = (options?.bucket ?? getDefaultStorageBucket()).trim();
  if (!bucket) return null;

  const normalizedKey = trimmed
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  if (!normalizedKey) return null;

  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${normalizedKey}`;
}

function formatByteLimit(maxBytes: number): string {
  if (maxBytes >= 1024 * 1024) {
    const mb = maxBytes / (1024 * 1024);
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
  }
  const kb = Math.round(maxBytes / 1024);
  return `${kb} KB`;
}

/**
 * Validasi tipe MIME dan ukuran file foto. Mengembalikan pesan error atau null jika valid.
 */
export function validatePhotoFile(
  file: { type: string; size: number },
  maxBytes: number = PHOTO_MAX_INPUT_BYTES,
): string | null {
  const mime = file.type.toLowerCase();
  if (!PHOTO_ACCEPTED_TYPES.includes(mime as AcceptedPhotoMimeType)) {
    return 'Format foto harus berupa JPG, PNG, atau WebP.';
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return 'File foto tidak valid atau kosong.';
  }

  if (file.size > maxBytes) {
    return `Ukuran foto maksimal ${formatByteLimit(maxBytes)}.`;
  }

  return null;
}

/**
 * Memeriksa magic bytes untuk memastikan isi file benar-benar gambar JPEG, PNG, atau WebP.
 */
export function sniffImageType(
  bytes: Uint8Array,
): AcceptedPhotoMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  return null;
}

export function getExtensionForMime(mime: AcceptedPhotoMimeType): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}
