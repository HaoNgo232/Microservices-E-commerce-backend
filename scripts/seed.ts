/* eslint-disable no-console */

/**
 * Seed script cho toàn bộ microservices
 * - Yêu cầu: đã chạy docker compose up -d (Postgres các service)
 * - Yêu cầu: đã export ENV cho Prisma (DATABASE_URL_USER, ...); xem docker-compose.yml để lấy cổng/credentials
 * - Chạy: pnpm run clean:dbseed
 *
 * Lưu ý:
 * - Script chỉ dùng prisma db push (không migrate) theo yêu cầu
 * - Ảnh dùng URL từ Unsplash, lưu trực tiếp URL vào DB
 */

import bcrypt from 'bcryptjs';

// Prisma clients (đã generate qua: pnpm run db:gen:all)
import { PrismaClient as UserDB, $Enums as UserEnums } from '../apps/user-app/prisma/generated/client';
import { PrismaClient as ProductDB } from '../apps/product-app/prisma/generated/client';
import { PrismaClient as CartDB } from '../apps/cart-app/prisma/generated/client';
import { PrismaClient as OrderDB, $Enums as OrderEnums } from '../apps/order-app/prisma/generated/client';
import { PrismaClient as PaymentDB, $Enums as PaymentEnums } from '../apps/payment-app/prisma/generated/client';
import { PrismaClient as ARDB } from '../apps/ar-app/prisma/generated/client';
import { PrismaClient as ReportDB } from '../apps/report-app/prisma/generated/client';

const userDb = new UserDB();
const productDb = new ProductDB();
const cartDb = new CartDB();
const orderDb = new OrderDB();
const paymentDb = new PaymentDB();
const arDb = new ARDB();
const reportDb = new ReportDB();

const unsplash = (id: string, w = 1200, q = 80) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=${q}`;

async function seedUsers() {
  console.log('→ Seeding user-app ...');

  await userDb.address.deleteMany({});
  await userDb.user.deleteMany({});

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await userDb.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash,
      fullName: 'Admin',
      role: UserEnums.UserRole.ADMIN,
      isActive: true,
    },
  });

  const customer1 = await userDb.user.create({
    data: {
      email: 'customer1@example.com',
      passwordHash,
      fullName: 'Customer One',
      role: UserEnums.UserRole.CUSTOMER,
      isActive: true,
    },
  });

  const customer2 = await userDb.user.create({
    data: {
      email: 'customer2@example.com',
      passwordHash,
      fullName: 'Customer Two',
      role: UserEnums.UserRole.CUSTOMER,
      isActive: true,
    },
  });

  const addr1 = await userDb.address.create({
    data: {
      userId: customer1.id,
      fullName: 'Customer One',
      phone: '0912345678',
      street: '123 Nguyễn Huệ',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      city: 'TP.HCM',
      isDefault: true,
    },
  });

  console.log('  ✓ users:', { admin: admin.email, customer1: customer1.email, customer2: customer2.email });
  console.log('  ✓ default address for customer1:', addr1.id);

  return { admin, customer1, customer2, addr1 };
}

async function seedProducts() {
  console.log('→ Seeding product-app ...');

  await productDb.product.deleteMany({});
  await productDb.category.deleteMany({});

  const catElectronics = await productDb.category.create({
    data: { name: 'Điện tử', slug: 'dien-tu', description: 'Thiết bị điện tử' },
  });
  const catFurniture = await productDb.category.create({
    data: { name: 'Nội thất', slug: 'noi-that', description: 'Đồ nội thất' },
  });

  const products = await Promise.all([
    productDb.product.create({
      data: {
        sku: 'IP15-BL',
        name: 'iPhone 15',
        slug: 'iphone-15',
        priceInt: 23990000,
        stock: 50,
        description: 'Điện thoại thông minh cao cấp',
        imageUrls: [
          unsplash('photo-1511707171634-5f897ff02aa9'),
          unsplash('photo-1517336714731-489689fd1ca8')
        ],
        categoryId: catElectronics.id,
        attributes: { brand: 'Apple', color: 'Blue', storage: '128GB' } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'MBP14-2023',
        name: 'MacBook Pro 14"',
        slug: 'macbook-pro-14-2023',
        priceInt: 47990000,
        stock: 35,
        description: 'Laptop hiệu năng cao cho lập trình/thiết kế',
        imageUrls: [unsplash('photo-1517336714731-489689fd1ca8')],
        categoryId: catElectronics.id,
        attributes: { brand: 'Apple', ram: '16GB', cpu: 'M3 Pro' } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'HERMES-CHAIR',
        name: 'Ghế lounge hiện đại',
        slug: 'ghe-lounge-hien-dai',
        priceInt: 5990000,
        stock: 120,
        description: 'Ghế lounge êm ái cho phòng khách',
        imageUrls: [
          unsplash('photo-1519710164239-da123dc03ef4'),
          unsplash('photo-1586023492125-27b2c045efd7')
        ],
        categoryId: catFurniture.id,
        attributes: { material: 'Vải', color: 'Be' } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'SONY-WH1000XM5',
        name: 'Tai nghe chống ồn Sony WH-1000XM5',
        slug: 'sony-wh-1000xm5',
        priceInt: 7990000,
        stock: 80,
        description: 'Tai nghe chống ồn hàng đầu',
        imageUrls: [unsplash('photo-1512499617640-c2f999018b72')],
        categoryId: catElectronics.id,
        attributes: { brand: 'Sony', type: 'Over-ear', anc: true } as never,
        model3dUrl: null,
      },
    }),
  ]);

  console.log('  ✓ categories:', [catElectronics.slug, catFurniture.slug]);
  console.log('  ✓ products:', products.map(p => `${p.name} (${p.id})`));

  return { categories: { catElectronics, catFurniture }, products };
}

async function seedOrders(userIds: { userId: string; addressId?: string }, products: Array<{ id: string; priceInt: number }>) {
  console.log('→ Seeding order-app ...');

  await orderDb.orderItem.deleteMany({});
  await orderDb.order.deleteMany({});

  const sampleItems = [
    { productId: products[0]!.id, quantity: 1, priceInt: products[0]!.priceInt },
    { productId: products[2]!.id, quantity: 2, priceInt: products[2]!.priceInt },
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
      payload: null,
    },
  });

  console.log('  ✓ payment (COD, UNPAID):', payment.id);
  return payment;
}

async function seedAR(userId: string | null, productId: string) {
  console.log('→ Seeding ar-app ...');

  await arDb.aRSnapshot.deleteMany({});

  const snap = await arDb.aRSnapshot.create({
    data: {
      userId,
      productId,
      imageUrl: unsplash('photo-1526170375885-4d8ecf77b99f'), // ảnh demo
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
      payload: { note: 'Initial seed completed' } as never,
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
    console.log('=== SEED START ===');

    // 1) Users + Address
    const { admin, customer1, addr1 } = await seedUsers();

    // 2) Products + Categories
    const { products } = await seedProducts();

    // 3) Orders (cho customer1)
    const order = await seedOrders({ userId: customer1.id, addressId: addr1.id }, products);

    // 4) Payments (tạo bản ghi COD UNPAID cho order)
    await seedPayments(order);

    // 5) AR Snapshots (liên kết user + 1 sản phẩm)
    await seedAR(customer1.id, products[0]!.id);

    // 6) Cart (clear để sạch sẽ)
    await seedCart();

    // 7) Report (tạo 1 entry lưu dấu seed)
    await seedReport();

    console.log('=== SEED DONE ===');
  } catch (err) {
    console.error('Seed failed:', err);
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