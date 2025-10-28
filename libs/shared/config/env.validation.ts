/**
 * Xác thực biến môi trường bắt buộc trước khi ứng dụng khởi động.
 * - Kiểm tra sự tồn tại của các biến NATS và từng DATABASE_URL cho mỗi service
 * - Cảnh báo nếu JWT_SECRET_KEY quá ngắn (trong trường hợp hệ thống dùng shared secret)
 *
 * Lưu ý:
 * - Các microservice trong dự án này đang dùng RSA keys cho JWT (qua JwtService),
 *   nhưng vẫn kiểm tra JWT_SECRET_KEY để đảm bảo an toàn khi có service dùng HMAC.
 */
export function validateEnvironment(): void {
  const requiredEnvVars = [
    'NATS_URL',
    'JWT_SECRET_KEY',
    'DATABASE_URL_USER',
    'DATABASE_URL_PRODUCT',
    'DATABASE_URL_CART',
    'DATABASE_URL_ORDER',
    'DATABASE_URL_PAYMENT',
    'DATABASE_URL_AR',
    'DATABASE_URL_REPORT',
  ];

  const missingVars = requiredEnvVars.filter(key => !process.env[key]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missingVars.map(v => `  - ${v}`).join('\n')}\n\nPlease check your .env file.`,
    );
  }

  // Khuyến nghị độ dài tối thiểu cho secret khi dùng HMAC
  const jwtSecret = process.env.JWT_SECRET_KEY || '';
  if (jwtSecret.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET_KEY should be at least 32 characters for security');
  }

  console.log(' Environment variables validated successfully');
}

/**
 * Lấy URL kết nối database cho một service cụ thể.
 *
 * @param service Tên service cần lấy URL (user|product|cart|order|payment|ar|report)
 * @returns Chuỗi URL kết nối database cho service
 * @throws Error nếu không tìm thấy biến môi trường tương ứng
 */
export function getDatabaseUrl(
  service: 'user' | 'product' | 'cart' | 'order' | 'payment' | 'ar' | 'report',
): string {
  const envKey = `DATABASE_URL_${service.toUpperCase()}`;
  const url = process.env[envKey];

  if (!url) {
    throw new Error(`Database URL not found for service: ${service}`);
  }

  return url;
}
