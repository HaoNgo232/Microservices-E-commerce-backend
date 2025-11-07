/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Seed script cho toàn bộ microservices
 * - Yêu cầu: đã chạy docker compose up -d (Postgres + MinIO)
 * - Yêu cầu: đã export ENV cho Prisma (DATABASE_URL_USER, ...); xem docker-compose.yml để lấy cổng/credentials
 * - Chạy: pnpm run clean:dbseed
 *
 * Lưu ý:
 * - Script chỉ dùng prisma db push (không migrate) theo yêu cầu
 * - Ảnh được upload lên MinIO server local, lưu URL vào DB
 */

import bcrypt from 'bcryptjs';
import * as path from 'path';

// Prisma clients (đã generate qua: pnpm run db:gen:all)
import { PrismaClient as UserDB, $Enums as UserEnums } from '../apps/user-app/prisma/generated/client';
import { PrismaClient as ProductDB } from '../apps/product-app/prisma/generated/client';
import { PrismaClient as CartDB } from '../apps/cart-app/prisma/generated/client';
import { PrismaClient as OrderDB, $Enums as OrderEnums } from '../apps/order-app/prisma/generated/client';
import { PrismaClient as PaymentDB, $Enums as PaymentEnums } from '../apps/payment-app/prisma/generated/client';
import { PrismaClient as ARDB } from '../apps/ar-app/prisma/generated/client';
import { PrismaClient as ReportDB } from '../apps/report-app/prisma/generated/client';

// Import helpers
import { initMinIOBucket, uploadAllImages } from './lib/minio-helper';
import { createProducts } from './seed-data/product-data';

const userDb = new UserDB();
const productDb = new ProductDB();
const cartDb = new CartDB();
const orderDb = new OrderDB();
const paymentDb = new PaymentDB();
const arDb = new ARDB();
const reportDb = new ReportDB();

const IMAGES_DIR = path.join(__dirname, 'seed-data', 'images');

async function seedUsers() {
  console.log('→ Seeding user-app ...');

  await userDb.address.deleteMany({});
  await userDb.user.deleteMany({});

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Admin accounts
  const admin = await userDb.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash,
      fullName: 'Admin User',
      role: UserEnums.UserRole.ADMIN,
      isActive: true,
    },
  });

  const admin2 = await userDb.user.create({
    data: {
      email: 'haongo@admin.com',
      passwordHash,
      fullName: 'Hao Ngo',
      role: UserEnums.UserRole.ADMIN,
      isActive: true,
    },
  });

  // Customer accounts
  const customer1 = await userDb.user.create({
    data: {
      email: 'customer1@example.com',
      passwordHash,
      fullName: 'Nguyễn Văn A',
      role: UserEnums.UserRole.CUSTOMER,
      isActive: true,
    },
  });

  const customer2 = await userDb.user.create({
    data: {
      email: 'customer2@example.com',
      passwordHash,
      fullName: 'Trần Thị B',
      role: UserEnums.UserRole.CUSTOMER,
      isActive: true,
    },
  });

  // Addresses for customers
  const addr1 = await userDb.address.create({
    data: {
      userId: customer1.id,
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      street: '123 Nguyễn Huệ',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      city: 'TP.HCM',
      isDefault: true,
    },
  });

  const addr2 = await userDb.address.create({
    data: {
      userId: customer2.id,
      fullName: 'Trần Thị B',
      phone: '0987654321',
      street: '456 Lê Lợi',
      ward: 'Phường 3',
      district: 'Quận 3',
      city: 'TP.HCM',
      isDefault: true,
    },
  });

  console.log('  ✓ admins:', { admin1: admin.email, admin2: admin2.email });
  console.log('  ✓ customers:', { customer1: customer1.email, customer2: customer2.email });
  console.log('  ✓ addresses:', { addr1: addr1.id, addr2: addr2.id });

  return { admin, admin2, customer1, customer2, addr1, addr2 };
}

async function seedProducts() {
  console.log('→ Seeding product-app ...');

  await productDb.product.deleteMany({});
  await productDb.category.deleteMany({});

  // Upload images to MinIO first
  const imageUrls = await uploadAllImages(IMAGES_DIR);

  // Create categories
  const catSunglasses = await productDb.category.create({
    data: { name: 'Kính mát', slug: 'kinh-mat', description: 'Kính mát thời trang, chống tia UV' },
  });
  const catEyeglasses = await productDb.category.create({
    data: { name: 'Gọng kính', slug: 'gong-kinh', description: 'Gọng kính cận, viễn, loạn' },
  });
  const catSportsGlasses = await productDb.category.create({
    data: { name: 'Kính thể thao', slug: 'kinh-the-thao', description: 'Kính thể thao, leo núi, chạy bộ' },
  });
  const catAccessories = await productDb.category.create({
    data: { name: 'Phụ kiện', slug: 'phu-kien', description: 'Hộp đựng, khăn lau, dây đeo kính' },
  });

  // Create 30 products with MinIO images
  const products = await createProducts(productDb, imageUrls, {
    catSunglasses,
    catEyeglasses,
    catSportsGlasses,
    catAccessories,
  });

  console.log('  ✓ categories:', 4);
  console.log('  ✓ products:', products.length);

  return { products, imageUrls };
}

async function seedOrders(
  userIds: { userId: string; addressId?: string },
  products: Array<{ id: string; priceInt: number }>,
) {
  console.log('→ Seeding order-app ...');

  await orderDb.orderItem.deleteMany({});
  await orderDb.order.deleteMany({});

  const sampleItems = [
    { productId: products[0].id, quantity: 1, priceInt: products[0].priceInt },
    { productId: products[2].id, quantity: 2, priceInt: products[2].priceInt },
  ];
  const totalInt = sampleItems.reduce((s, it) => s + it.quantity * it.priceInt, 0);

  const order = await orderDb.order.create({
    data: {
      userId: userIds.userId,
      addressId: userIds.addressId ?? null,
      status: OrderEnums.OrderStatus.PENDING,
      paymentStatus: OrderEnums.PaymentStatus.UNPAID,
      totalInt,
      items: {
        create: sampleItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          priceInt: i.priceInt,
        })),
      },
    },
    include: { items: true },
  });

  console.log('  ✓ order:', { id: order.id, totalInt, items: order.items.length });
  return order;
}

async function seedPayments(order: { id: string; totalInt: number }) {
  console.log('→ Seeding payment-app ...');

  await paymentDb.transaction.deleteMany({});
  await paymentDb.payment.deleteMany({});

  const payment = await paymentDb.payment.create({
    data: {
      orderId: order.id,
      method: PaymentEnums.PaymentMethod.COD,
      amountInt: order.totalInt,
      status: PaymentEnums.PaymentStatus.UNPAID,
    },
  });

  console.log('  ✓ payment (COD, UNPAID):', payment.id);
  return payment;
}

async function seedAR(userId: string | null, productId: string, imageUrls: Map<string, string>) {
  console.log('→ Seeding ar-app ...');

  await arDb.aRSnapshot.deleteMany({});

  // Use first image from MinIO as AR demo
  const demoImageUrl = Array.from(imageUrls.values())[0] || 'https://via.placeholder.com/800';

  const snap = await arDb.aRSnapshot.create({
    data: {
      userId,
      productId,
      imageUrl: demoImageUrl,
      metadata: {
        rotation: 30,
        position: { x: 0, y: 0, z: 0 },
        lighting: 'studio',
      } as never,
    },
  });

  console.log('  ✓ ar snapshot:', snap.id);
  return snap;
}

async function seedReport() {
  console.log('→ Seeding report-app ...');

  await reportDb.reportEntry.deleteMany({});

  await reportDb.reportEntry.create({
    data: {
      type: 'SEED_INFO',
      payload: { note: 'Initial seed completed with MinIO images' } as never,
      fromAt: new Date(),
      toAt: new Date(),
    },
  });

  console.log('  ✓ report entry created');
}

async function seedCart() {
  console.log('→ Seeding cart-app (bỏ qua dữ liệu mặc định)');
  // Không cần seed cart mặc định; để trống cho đơn giản
  await cartDb.cartItem.deleteMany({});
  await cartDb.cart.deleteMany({});
}

async function main() {
  try {
    console.log('=== SEED START ===\n');

    // 0) Initialize MinIO bucket
    await initMinIOBucket();

    // 1) Users + Address
    const { customer1, addr1 } = await seedUsers();

    // 2) Products + Categories (with MinIO images)
    const { products, imageUrls } = await seedProducts();

    // 3) Orders (cho customer1)
    const order = await seedOrders({ userId: customer1.id, addressId: addr1.id }, products);

    // 4) Payments (tạo bản ghi COD UNPAID cho order)
    await seedPayments(order);

    // 5) AR Snapshots (liên kết user + 1 sản phẩm)
    await seedAR(customer1.id, products[0].id, imageUrls);

    // 6) Cart (clear để sạch sẽ)
    await seedCart();

    // 7) Report (tạo 1 entry lưu dấu seed)
    await seedReport();

    console.log('\n=== SEED DONE ===');
    console.log('\n��� SUMMARY:');
    console.log('��� Users:', 4, '(2 admins, 2 customers)');
    console.log('���️  Products:', products.length, '(Kính mát, Gọng kính, Kính thể thao, Phụ kiện)');
    console.log('���️  Categories:', 4, '(Kính mát, Gọng kính, Kính thể thao, Phụ kiện)');
    console.log('���️  Images:', imageUrls.size, '(uploaded to MinIO)');
    console.log('��� Orders:', 1);
    console.log('��� Payments:', 1);
    console.log('��� AR Snapshots:', 1);
    console.log('\n��� LOGIN CREDENTIALS:');
    console.log('  Admin 1:   admin@example.com / Password123!');
    console.log('  Admin 2:   haongo@admin.com / Password123!');
    console.log('  Customer1: customer1@example.com / Password123!');
    console.log('  Customer2: customer2@example.com / Password123!');
    console.log('\n��� MINIO CONSOLE:');
    console.log('  URL:      http://localhost:9001');
    console.log('  Username: minio');
    console.log('  Password: supersecret');
    console.log('  Bucket:   web-ban-kinh');
    console.log('\n��� Prisma Studio URLs:');
    console.log('  User DB:    npx prisma studio --schema=apps/user-app/prisma/schema.prisma');
    console.log('  Product DB: npx prisma studio --schema=apps/product-app/prisma/schema.prisma');
    console.log('  Order DB:   npx prisma studio --schema=apps/order-app/prisma/schema.prisma');
    console.log('  Payment DB: npx prisma studio --schema=apps/payment-app/prisma/schema.prisma');
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([
      userDb.$disconnect(),
      productDb.$disconnect(),
      cartDb.$disconnect(),
      orderDb.$disconnect(),
      paymentDb.$disconnect(),
      arDb.$disconnect(),
      reportDb.$disconnect(),
    ]);
  }
}

void main();
