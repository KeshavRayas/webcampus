import path from "path";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// ── MinIO / S3-compatible configuration ─────────────────────────────────
const ENDPOINT = process.env.MINIO_ENDPOINT;
const BUCKET = process.env.MINIO_BUCKET_NAME;
const REGION = process.env.MINIO_REGION;

const s3Client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  forcePathStyle: true, // Required for MinIO (path-style: endpoint/bucket/key)
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY_ID!,
    secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY!,
  },
});

// ── Old AWS S3 configuration (commented out for reference) ──────────────
// const s3Client = new S3Client({
//   region: process.env.AWS_REGION || "ap-south-1",
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// });

// ── Bucket auto-creation ────────────────────────────────────────────────
let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    bucketReady = true;
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "$metadata" in error
        ? (error as { $metadata: { httpStatusCode?: number } }).$metadata
            .httpStatusCode
        : undefined;

    if (code === 404 || code === 403) {
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
      // Set public-read policy so the browser can load images directly
      const publicReadPolicy = JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${BUCKET}/*`],
          },
        ],
      });
      await s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: BUCKET,
          Policy: publicReadPolicy,
        })
      );
      console.log(`[MinIO] Created bucket "${BUCKET}" with public-read policy`);
      bucketReady = true;
    } else {
      throw error;
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

export const generateFileName = (originalName: string, prefix: string) => {
  const extension = path.extname(originalName);
  return `${prefix}${uuidv4()}${extension}`;
};

/**
 * Extracts the object key from a MinIO/S3 URL.
 * Supports both MinIO path-style and legacy AWS virtual-hosted-style URLs.
 */
function extractKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // MinIO path-style: http://localhost:9000/bucket/key → pathname = /bucket/key
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      // First segment is the bucket name, rest is the key
      return segments.slice(1).join("/");
    }
    return null;
  } catch {
    // Fallback: legacy AWS URL format (amazonaws.com)
    // e.g. https://bucket.s3.region.amazonaws.com/photo_abc123.png
    const awsKey = url.split(".amazonaws.com/")[1];
    return awsKey || null;
  }
}

// ── Upload / Download / Delete ──────────────────────────────────────────

export const uploadToS3 = async (
  fileBuffer: Buffer,
  fileName: string,
  mimetype: string
) => {
  try {
    await ensureBucket();

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimetype,
    });

    await s3Client.send(command);

    // MinIO path-style URL
    const url = `${ENDPOINT}/${BUCKET}/${fileName}`;

    // Old AWS virtual-hosted-style URL (commented out for reference):
    // const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return { success: true, url };
  } catch (error) {
    console.error("S3 Upload Error:", error);
    return { success: false, url: null };
  }
};

export const uploadBufferToS3 = async (
  fileBuffer: Buffer,
  fileName: string,
  mimetype: string
): Promise<{ success: boolean; key: string | null }> => {
  try {
    await ensureBucket();

    const command = new PutObjectCommand({
      Bucket: BUCKET, // was: process.env.AWS_S3_BUCKET_NAME
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimetype,
    });

    await s3Client.send(command);
    return { success: true, key: fileName };
  } catch (error) {
    console.error("S3 Upload Error:", error);
    return { success: false, key: null };
  }
};

export const createSignedDownloadUrl = async (
  key: string,
  fileName: string,
  expiresInSeconds = 300
): Promise<string> => {
  return getSignedUrl(
    // The presigner and client packages can resolve separate Smithy type copies
    // in Bun workspaces even when their runtime SDK versions are compatible.
    s3Client as unknown as Parameters<typeof getSignedUrl>[0],
    new GetObjectCommand({
      Bucket: BUCKET, // was: process.env.AWS_S3_BUCKET_NAME
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    }),
    { expiresIn: expiresInSeconds }
  );
};

export const deleteFromS3 = async (
  url: string
): Promise<{ success: boolean }> => {
  try {
    const key = extractKeyFromUrl(url);
    if (!key) return { success: false };

    const command = new DeleteObjectCommand({
      Bucket: BUCKET, // was: process.env.AWS_S3_BUCKET_NAME
      Key: key,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error("S3 Delete Error:", error);
    return { success: false };
  }
};
