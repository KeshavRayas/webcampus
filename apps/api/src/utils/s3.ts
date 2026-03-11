import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
