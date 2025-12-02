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

    // Note: CORS cần được set thủ công qua MinIO Console hoặc mc CLI
    // MinIO Console: http://localhost:9001 > Buckets > web-ban-kinh > Settings > CORS
    // Hoặc dùng mc CLI:
    //   mc alias set local http://127.0.0.1:9000 minio supersecret
    //   echo '{"CORSRules":[{"AllowedOrigins":["http://localhost:3000","http://localhost:3001"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"]}]}' > cors.json
    //   mc cors set cors.json local/web-ban-kinh
  } catch (error) {
    console.error('  ✗ MinIO initialization error:', error);
    throw error;
  }
}

/**
 * Upload ảnh lên MinIO và trả về URL
 */
export async function uploadImageToMinIO(
  filePath: string,
  fileName: string,
  contentType: string = 'image/jpeg',
): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileStream = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);

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
 * Upload tất cả ảnh PNG try-on từ thư mục 3dmodel
 * Mỗi thư mục glasses-XX chứa file glasses_XX.png
 */
export async function uploadTryOnImages(tryOnDir: string): Promise<Map<string, string>> {
  console.log('→ Uploading try-on images (PNG) to MinIO...');

  const tryOnUrls = new Map<string, string>();
  const dirs = fs.readdirSync(tryOnDir, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory() || !dir.name.startsWith('glasses-')) {
      continue;
    }

    const dirPath = path.join(tryOnDir, dir.name);
    const files = fs.readdirSync(dirPath);

    // Tìm file PNG trong thư mục (glasses_XX.png)
    const pngFile = files.find(f => f.endsWith('.png') && f.startsWith('glasses_'));
    if (!pngFile) {
      console.log(`  ⚠ Skipping ${dir.name}: no PNG file found`);
      continue;
    }

    try {
      const filePath = path.join(dirPath, pngFile);
      // Tạo tên file trên MinIO: try-on/glasses_XX.png
      const minioFileName = `try-on/${pngFile}`;
      const url = await uploadImageToMinIO(filePath, minioFileName, 'image/png');
      tryOnUrls.set(dir.name, url); // Key: glasses-01, Value: URL
      console.log(`  ✓ Uploaded: ${pngFile} (from ${dir.name})`);
    } catch (error) {
      console.error(`  ✗ Failed to upload ${pngFile} from ${dir.name}:`, error);
    }
  }

  console.log(`  ✓ Total try-on images uploaded: ${tryOnUrls.size}`);
  return tryOnUrls;
}
