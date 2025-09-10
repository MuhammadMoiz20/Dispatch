import 'reflect-metadata';
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('http://minio:9000/dispatch-labels/x'),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({})),
  PutObjectCommand: jest.fn(),
  CreateBucketCommand: jest.fn(),
  HeadBucketCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

describe('storage URL rewriting', () => {
  it('rewrites signed URL host to public URL when provided', async () => {
    process.env.S3_PUBLIC_URL = 'http://localhost:9000';
    const { getLabelDownloadUrl } = await import('../../src/storage');
    const url = await getLabelDownloadUrl('x');
    expect(url.startsWith('http://localhost:9000/')).toBe(true);
  });
});
