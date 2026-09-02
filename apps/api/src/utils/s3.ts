import path from "path";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { backendEnv } from "@webcampus/common/env";
import { logger } from "@webcampus/common/logger";
import { v4 as uuidv4 } from "uuid";

// MinIO / S3-compatible configuration — validated via Zod at startup

const {
  MINIO_ENDPOINT: ENDPOINT,
  MINIO_BUCKET_NAME: BUCKET,
  MINIO_REGION: REGION,
  MINIO_ACCESS_KEY_ID,
  MINIO_SECRET_ACCESS_KEY,
} = backendEnv();

const s3Client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  forcePathStyle: true, // Required for MinIO
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY_ID,
    secretAccessKey: MINIO_SECRET_ACCESS_KEY,
  },
});

// Bucket auto-creation
let bucketReady = false;
let bucketReadyPromise: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
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
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
        } catch (createErr: unknown) {
          const createCode =
            createErr &&
            typeof createErr === "object" &&
            "$metadata" in createErr
              ? (createErr as { $metadata: { httpStatusCode?: number } })
                  .$metadata.httpStatusCode
              : undefined;
          // 409 = BucketAlreadyOwnedByYou / BucketAlreadyExists — safe to ignore
          if (createCode !== 409) throw createErr;
        }
        logger.info(`[MinIO] Created bucket "${BUCKET}"`);
        bucketReady = true;
      } else {
        throw error;
      }
    }
  })();

  await bucketReadyPromise;
}

// Helpers

export const sanitizeForS3 = (str: string) => {
  return str.replace(/[^a-z0-9]/gi, "").toLowerCase();
};

export const generateFileName = (originalName: string, prefix: string) => {
  const extension = path.extname(originalName);
  const uuid = uuidv4();

  // Support prefixes with pre-existing slashes (e.g., support/ticket/message/)
  if (prefix.includes("/")) {
    return `${prefix}${uuid}${extension}`;
  }

  // Split the prefix to extract entity information
  // Example: department_computerscience_ -> ["department", "computerscience"]
  const parts = prefix.split("_").filter(Boolean);
  const category = parts[0];

  if (category === "department") {
    const name = parts[1] || "unknown";
    return `department/${name}_${uuid}${extension}`;
  } else if (category === "faculty") {
    const deptName = parts[1] || "unknown";
    const facultyName = parts[2] || "unknown";
    return `faculty/${deptName}/${facultyName}_${uuid}${extension}`;
  } else if (category && ["admission", "accounts", "coe"].includes(category)) {
    const name = parts[1] || "unknown";
    // Group user types into a parent "users" directory
    return `users/${category}/${name}_${uuid}${extension}`;
  }

  // Fallback for any unknown prefixes
  let folder = "others";
  if (category === "student") folder = "students";

  return `${folder}/${prefix}${uuid}${extension}`;
};

/**
 * Extracts the object key from a MinIO/S3 URL.
 * Supports both MinIO path-style and legacy AWS virtual-hosted-style URLs.
 */
function extractKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);

    // Support the internal API proxy format: /files/<key>
    if (segments[0] === "files" && segments.length >= 2) {
      return segments.slice(1).join("/");
    }

    // MinIO path-style: http://localhost:9000/bucket/key → pathname = /bucket/key
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

    // Return the proxy route URL instead of the direct MinIO URL
    const backendUrl = backendEnv().BETTER_AUTH_URL;
    const url = `${backendUrl}/files/${fileName}`;

    // Old MinIO path-style URL (commented out for reference):
    // const url = `${ENDPOINT}/${BUCKET}/${fileName}`;

    return { success: true, url };
  } catch (error) {
    logger.error("S3 Upload Error:", error as Record<string, unknown>);
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
    logger.error("S3 Upload Error:", error as Record<string, unknown>);
    return { success: false, key: null };
  }
};

export const createSignedViewUrl = async (
  key: string,
  expiresInSeconds = 3600
): Promise<string> => {
  return getSignedUrl(
    s3Client as unknown as Parameters<typeof getSignedUrl>[0],
    new GetObjectCommand({
      Bucket: BUCKET, // was: process.env.AWS_S3_BUCKET_NAME
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
};

export const createSignedDownloadUrl = async (
  key: string,
  fileName: string,
  expiresInSeconds = 3600
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
    logger.error("S3 Delete Error:", error as Record<string, unknown>);
    return { success: false };
  }
};
