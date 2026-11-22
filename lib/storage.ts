import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  type AcceptedPhotoMimeType,
  getDefaultStorageBucket,
  getExtensionForMime,
} from './photo';

interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function getStorageConfig(): S3StorageConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const endpoint = process.env.SUPABASE_S3_ENDPOINT?.trim();
  const region = process.env.SUPABASE_S3_REGION?.trim() || 'ap-southeast-1';
  const bucket = getDefaultStorageBucket();
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY?.trim();

  if (
    !supabaseUrl ||
    !endpoint ||
    !bucket ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    return null;
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

export function isStorageConfigured(): boolean {
  return getStorageConfig() !== null;
}

const globalForS3 = globalThis as unknown as {
  __baniSukarS3Client?: S3Client;
  __baniSukarS3ConfigKey?: string;
};

function getS3Client(config: S3StorageConfig): S3Client {
  const configKey = `${config.endpoint}|${config.region}|${config.accessKeyId}`;
  if (
    !globalForS3.__baniSukarS3Client ||
    globalForS3.__baniSukarS3ConfigKey !== configKey
  ) {
    globalForS3.__baniSukarS3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    globalForS3.__baniSukarS3ConfigKey = configKey;
  }
  return globalForS3.__baniSukarS3Client;
}

/**
 * Mengunggah foto profil anggota ke Supabase Storage melalui S3-compatible API.
 * Mengembalikan object key (mis. `persons/<id>/<timestamp>.webp`).
 */
export async function uploadPersonPhoto(
  personId: string,
  bytes: Uint8Array,
  contentType: AcceptedPhotoMimeType,
): Promise<string> {
  const config = getStorageConfig();
  if (!config) {
    throw new Error('Penyimpanan foto S3 Supabase belum dikonfigurasi.');
  }

  const ext = getExtensionForMime(contentType);
  const key = `persons/${personId}/${Date.now()}.${ext}`;
  const client = getS3Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return key;
}

/**
 * Menghapus objek foto dari Supabase Storage secara best-effort.
 */
export async function deleteStorageObject(
  key: string | null | undefined,
): Promise<void> {
  if (!key || !key.trim()) return;
  const config = getStorageConfig();
  if (!config) return;

  try {
    const client = getS3Client(config);
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key.trim(),
      }),
    );
  } catch (err) {
    console.warn('[storage] Gagal menghapus objek lama:', key, err);
  }
}
