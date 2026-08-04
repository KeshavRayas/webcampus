import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// Ensure your AWS variables are in your apps/api/.env file!
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const generateFileName = (originalName: string, prefix: string) => {
  const extension = path.extname(originalName);
  return `${prefix}${uuidv4()}${extension}`;
};

export const uploadToS3 = async (
  fileBuffer: Buffer,
  fileName: string,
  mimetype: string
) => {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimetype,
    });

    await s3Client.send(command);

    // Construct the public URL
    const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
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
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
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
      Bucket: process.env.AWS_S3_BUCKET_NAME,
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
    // Extract the object key from the full S3 URL
    // e.g. https://bucket.s3.region.amazonaws.com/photo_abc123.png → photo_abc123.png
    const key = url.split(".amazonaws.com/")[1];
    if (!key) return { success: false };

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    console.error("S3 Delete Error:", error);
    return { success: false };
  }
};
