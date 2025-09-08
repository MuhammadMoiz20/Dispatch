import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.LABELS_BUCKET || process.env.S3_BUCKET || 'dispatch-labels';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || 'minio';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || 'minio123';
const S3_FORCE_PATH_STYLE = (process.env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false';
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL; // optional host override for signed URLs

export const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    } catch {
      // ignore if already exists or cannot be created; later ops will fail explicitly
    }
  }
}

export async function putLabelObject(key: string, body: Uint8Array | Buffer | string, contentType = 'application/octet-stream') {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: typeof body === 'string' ? Buffer.from(body) : body,
      ContentType: contentType,
    }),
  );
}

export async function getLabelDownloadUrl(key: string, expiresSeconds = 900): Promise<string> {
  const cmd = new (require('@aws-sdk/client-s3').GetObjectCommand)({ Bucket: S3_BUCKET, Key: key });
  const url: string = await getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
  if (!S3_PUBLIC_URL) return url;
  try {
    const u = new URL(url);
    const pub = new URL(S3_PUBLIC_URL);
    u.host = pub.host;
    u.protocol = pub.protocol as any;
    return u.toString();
  } catch {
    return url;
  }
}

export function getBucket(): string {
  return S3_BUCKET;
}

