import * as Minio from 'minio';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
    if (bucketExists) {
      console.log(`  ✓ Bucket ${BUCKET_NAME} already exists`);
    } else {
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

/**
 * Upload GLB/GLTF model file lên MinIO (glasses-models bucket)
 */
export async function uploadGlassesModelToMinIO(
  filePath: string,
  fileName: string,
  bucketName: string = 'glasses-models',
): Promise<{ url: string; filename: string }> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Ensure bucket exists
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    await minioClient.makeBucket(bucketName, 'us-east-1');
    console.log(`  ✓ Created bucket: ${bucketName}`);

    // Set public read policy
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log(`  ✓ Set public read policy for ${bucketName}`);
  }

  const fileStream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);

  // Determine content type based on extension
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.glb' ? 'model/gltf-binary' : 'model/gltf+json';

  // Upload file
  await minioClient.putObject(bucketName, fileName, fileStream, stats.size, {
    'Content-Type': contentType,
  });

  // Return public URL and filename
  const url = `http://${MINIO_CONFIG.endPoint}:${MINIO_CONFIG.port}/${bucketName}/${fileName}`;
  return { url, filename: fileName };
}

/**
 * Upload thumbnail image lên MinIO (glasses-models bucket)
 */
export async function uploadGlassesThumbnailToMinIO(
  filePath: string,
  fileName: string,
  bucketName: string = 'glasses-models',
): Promise<{ url: string; filename: string }> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Ensure bucket exists
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    await minioClient.makeBucket(bucketName, 'us-east-1');
    console.log(`  ✓ Created bucket: ${bucketName}`);

    // Set public read policy
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log(`  ✓ Set public read policy for ${bucketName}`);
  }

  const fileStream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);
  const contentType = 'image/png';

  // Upload file
  await minioClient.putObject(bucketName, fileName, fileStream, stats.size, {
    'Content-Type': contentType,
  });

  // Return public URL and filename
  const url = `http://${MINIO_CONFIG.endPoint}:${MINIO_CONFIG.port}/${bucketName}/${fileName}`;
  return { url, filename: fileName };
}
