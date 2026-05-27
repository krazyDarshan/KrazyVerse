import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { ApiError } from '../utils/http';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
      : undefined,
});

export async function uploadToCloudinary(filePath: string, folder = 'krazyverse') {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new ApiError(503, 'Cloudinary is not configured', 'STORAGE_NOT_CONFIGURED');
  }
  return cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: 'auto',
    overwrite: false,
  });
}

export async function backupToS3(key: string, body: Buffer | string) {
  if (!env.AWS_S3_BACKUP_BUCKET) {
    throw new ApiError(503, 'AWS S3 backup bucket is not configured', 'BACKUP_NOT_CONFIGURED');
  }
  await s3.send(new PutObjectCommand({ Bucket: env.AWS_S3_BACKUP_BUCKET, Key: key, Body: body }));
}
