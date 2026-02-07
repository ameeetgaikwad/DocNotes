import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";

const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const S3_BUCKET = process.env.S3_BUCKET || "docnotes-documents";
const S3_ENDPOINT = process.env.S3_ENDPOINT || undefined;

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: AWS_REGION,
      ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
    });
  }
  return _client;
}

export function generateS3Key(patientId: string, fileName: string): string {
  const random = randomBytes(8).toString("hex");
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "";
  return `patients/${patientId}/${random}${ext ? `.${ext}` : ""}`;
}

export async function createPresignedUploadUrl(
  s3Key: string,
  mimeType: string,
  sizeBytes: number,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 600 }); // 10 min
}

export async function createPresignedDownloadUrl(
  s3Key: string,
  fileName: string,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 3600 }); // 1 hour
}

export async function deleteS3Object(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  });
  await getClient().send(command);
}
