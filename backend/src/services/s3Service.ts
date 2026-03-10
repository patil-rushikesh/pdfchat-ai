import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ---------------------------------------------------------------------------
// Client (lazy singleton)
// ---------------------------------------------------------------------------

let s3Client: S3Client | null = null;

const getClient = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}), // fall back to IAM role / env-level credentials in production
    });
  }
  return s3Client;
};

const getBucket = (): string => {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) throw new Error('S3_BUCKET_NAME environment variable is not set');
  return bucket;
};

// ---------------------------------------------------------------------------
// Key builder
// ---------------------------------------------------------------------------

/**
 * Build the S3 object key for a chat's PDF.
 *
 * Format: uploads/chatid_<number>/<filename>.pdf
 * Example: uploads/chatid_23/report.pdf
 *
 * The chat_id value already contains the "chat_" prefix (e.g. "chat_23").
 * We strip that prefix and reformat to match the spec.
 */
export const buildS3Key = (chatId: string, fileName: string): string => {
  // chatId is "chat_23" → we want "chatid_23"
  const numeric = chatId.replace(/^chat_/, '');
  // Sanitise filename: keep only safe characters
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `uploads/chatid_${numeric}/${safeName}`;
};

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface S3UploadResult {
  s3_key: string;
  s3_url: string;
}

/**
 * Upload a file buffer to S3 and return the key and public URL.
 *
 * @param chatId   - The chat session ID (e.g. "chat_23")
 * @param fileName - Original file name (e.g. "report.pdf")
 * @param buffer   - File contents
 * @param mimeType - MIME type (default: "application/pdf")
 */
export const uploadToS3 = async (
  chatId: string,
  fileName: string,
  buffer: Buffer,
  mimeType = 'application/pdf'
): Promise<S3UploadResult> => {
  const bucket = getBucket();
  const key    = buildS3Key(chatId, fileName);

  await getClient().send(
    new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
      // Server-side encryption at rest
      ServerSideEncryption: 'AES256',
      // Metadata stored alongside the object
      Metadata: {
        chat_id:   chatId,
        file_name: fileName,
      },
    })
  );

  // Build a standard S3 URL.  For private buckets use presigned URLs instead.
  const region = process.env.AWS_REGION || 'us-east-1';
  const s3_url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  return { s3_key: key, s3_url };
};

// ---------------------------------------------------------------------------
// Presigned download URL (for serving private files to the frontend)
// ---------------------------------------------------------------------------

/**
 * Generate a time-limited presigned GET URL for a private S3 object.
 *
 * @param s3Key     - The full S3 object key
 * @param expiresIn - Seconds until expiry (default: 1 hour)
 */
export const getPresignedUrl = async (
  s3Key: string,
  expiresIn = 3600
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key:    s3Key,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
};

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Permanently delete an S3 object.
 * Called when a document record is removed so the bucket stays clean.
 */
export const deleteFromS3 = async (s3Key: string): Promise<void> => {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key:    s3Key,
    })
  );
};

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export const isS3Configured = (): boolean =>
  Boolean(process.env.S3_BUCKET_NAME);
