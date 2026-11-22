import { describe, expect, it } from 'vitest';
import {
  PHOTO_MAX_INPUT_BYTES,
  PHOTO_MAX_UPLOAD_BYTES,
  getExtensionForMime,
  getPhotoPublicUrl,
  sniffImageType,
  validatePhotoFile,
} from '../photo';

describe('getPhotoPublicUrl', () => {
  it('returns null for empty or whitespace paths', () => {
    expect(getPhotoPublicUrl(null, { baseUrl: 'https://abc.supabase.co' })).toBeNull();
    expect(getPhotoPublicUrl(undefined, { baseUrl: 'https://abc.supabase.co' })).toBeNull();
    expect(getPhotoPublicUrl('   ', { baseUrl: 'https://abc.supabase.co' })).toBeNull();
  });

  it('builds Supabase public object URL from key, baseUrl, and bucket', () => {
    expect(
      getPhotoPublicUrl('persons/123/1700000.webp', {
        baseUrl: 'https://xyz.supabase.co/',
        bucket: 'person-photos',
      }),
    ).toBe('https://xyz.supabase.co/storage/v1/object/public/person-photos/persons/123/1700000.webp');
  });

  it('strips leading slashes on key and returns full URLs unchanged', () => {
    expect(
      getPhotoPublicUrl('/persons/123/avatar.jpg', {
        baseUrl: 'https://xyz.supabase.co',
        bucket: 'person-photos',
      }),
    ).toBe('https://xyz.supabase.co/storage/v1/object/public/person-photos/persons/123/avatar.jpg');

    expect(getPhotoPublicUrl('https://cdn.example.com/a.webp')).toBe(
      'https://cdn.example.com/a.webp',
    );
  });

  it('returns null when baseUrl is missing', () => {
    expect(
      getPhotoPublicUrl('persons/123/avatar.webp', {
        baseUrl: '',
        bucket: 'person-photos',
      }),
    ).toBeNull();
  });
});

describe('validatePhotoFile', () => {
  it('accepts valid JPEG, PNG, and WebP files within limit', () => {
    expect(
      validatePhotoFile({ type: 'image/jpeg', size: 200_000 }, PHOTO_MAX_INPUT_BYTES),
    ).toBeNull();
    expect(
      validatePhotoFile({ type: 'image/png', size: 500_000 }, PHOTO_MAX_UPLOAD_BYTES),
    ).toBeNull();
    expect(
      validatePhotoFile({ type: 'image/webp', size: 50_000 }, PHOTO_MAX_UPLOAD_BYTES),
    ).toBeNull();
  });

  it('rejects unsupported MIME types', () => {
    expect(validatePhotoFile({ type: 'image/gif', size: 10_000 })).toContain(
      'JPG, PNG, atau WebP',
    );
    expect(validatePhotoFile({ type: 'text/plain', size: 1_000 })).toContain(
      'JPG, PNG, atau WebP',
    );
  });

  it('rejects empty or oversized files', () => {
    expect(validatePhotoFile({ type: 'image/webp', size: 0 })).toContain('kosong');
    expect(
      validatePhotoFile({ type: 'image/webp', size: PHOTO_MAX_UPLOAD_BYTES + 1 }, PHOTO_MAX_UPLOAD_BYTES),
    ).toContain('1 MB');
    expect(
      validatePhotoFile({ type: 'image/jpeg', size: PHOTO_MAX_INPUT_BYTES + 1 }, PHOTO_MAX_INPUT_BYTES),
    ).toContain('10 MB');
  });
});

describe('sniffImageType', () => {
  it('detects JPEG, PNG, and WebP magic bytes', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);

    expect(sniffImageType(jpeg)).toBe('image/jpeg');
    expect(sniffImageType(png)).toBe('image/png');
    expect(sniffImageType(webp)).toBe('image/webp');
  });

  it('rejects non-image or truncated bytes', () => {
    const textBytes = new TextEncoder().encode('hello world not an image');
    expect(sniffImageType(textBytes)).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe('getExtensionForMime', () => {
  it('maps accepted MIME types to extensions', () => {
    expect(getExtensionForMime('image/jpeg')).toBe('jpg');
    expect(getExtensionForMime('image/png')).toBe('png');
    expect(getExtensionForMime('image/webp')).toBe('webp');
  });
});
