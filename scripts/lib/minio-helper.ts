import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';

// MinIO Configuration
export const MINIO_CONFIG = {
  endPoint: '127.0.0.1',
  port: 9000,
  useSSL: false,
  accessKey: 'minio', // Root user từ docker-compose.yml
  secretKey: 'supersecret', // Root password từ docker-compose.yml
};

export const BUCKET_NAME = 'web-ban-kinh';

// Initialize MinIO client
const minioClient = new Minio.Client(MINIO_CONFIG);

/**
 * Tạo bucket nếu chưa tồn tại và set public read policy
 */
export async function initMinIOBucket(): Promise<void> {
  console.log('→ Initializing MinIO bucket...');

  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`  ✓ Created bucket: ${BUCKET_NAME}`);

      // Set public read policy cho bucket
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log('  ✓ Set public read policy');
    } else {
      console.log(`  ✓ Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (error) {
    console.error('  ✗ MinIO initialization error:', error);
    throw error;
  }
}

/**
 * Upload ảnh lên MinIO và trả về URL
 */
export async function uploadImageToMinIO(filePath: string, fileName: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);
  const contentType = 'image/jpeg';

  // Upload file
  await minioClient.putObject(BUCKET_NAME, fileName, fileStream, stats.size, {
    'Content-Type': contentType,
  });

  // Return public URL
  return `http://${MINIO_CONFIG.endPoint}:${MINIO_CONFIG.port}/${BUCKET_NAME}/${fileName}`;
}

/**
 * Upload tất cả ảnh trong thư mục và trả về map fileName -> URL
 */
export async function uploadAllImages(imagesDir: string): Promise<Map<string, string>> {
  console.log('→ Uploading images to MinIO...');

  const imageUrls = new Map<string, string>();
  const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.jpg'));

  for (const file of files) {
    try {
      const filePath = path.join(imagesDir, file);
      const url = await uploadImageToMinIO(filePath, file);
      imageUrls.set(file, url);
      console.log(`  ✓ Uploaded: ${file}`);
    } catch (error) {
      console.error(`  ✗ Failed to upload ${file}:`, error);
    }
  }

  console.log(`  ✓ Total uploaded: ${imageUrls.size} images`);
  return imageUrls;
}
