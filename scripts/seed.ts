/* eslint-disable @typescript-eslint/explicit-function-return-type */
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

  // Categories cho mắt kính
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

  // Products - Kính mát
  const products = await Promise.all([
    productDb.product.create({
      data: {
        sku: 'RB-AVIATOR-001',
        name: 'Ray-Ban Aviator Classic',
        slug: 'ray-ban-aviator-classic',
        priceInt: 4990000,
        stock: 45,
        description: 'Kính mát phi công kinh điển, gọng kim loại vàng, tròng thủy tinh G-15',
        imageUrls: [unsplash('photo-1511499767150-a48a237f0083'), unsplash('photo-1577803645773-f96470509666')],
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Ray-Ban',
          frameMaterial: 'Kim loại',
          lensMaterial: 'Thủy tinh',
          uvProtection: 'UV400',
          frameShape: 'Aviator',
          color: 'Vàng-Xanh lá',
        } as never,
        model3dUrl: 'https://example.com/models/rayban-aviator.glb',
      },
    }),
    productDb.product.create({
      data: {
        sku: 'RB-WAYFARER-002',
        name: 'Ray-Ban Wayfarer',
        slug: 'ray-ban-wayfarer',
        priceInt: 5290000,
        stock: 60,
        description: 'Kính mát vuông cổ điển, phong cách retro, gọng nhựa acetate',
        imageUrls: [unsplash('photo-1572635196237-14b3f281503f'), unsplash('photo-1509695507497-903c140c43b0')],
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Ray-Ban',
          frameMaterial: 'Acetate',
          lensMaterial: 'Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Wayfarer',
          color: 'Đen-Xanh',
        } as never,
        model3dUrl: 'https://example.com/models/rayban-wayfarer.glb',
      },
    }),
    productDb.product.create({
      data: {
        sku: 'GUCCI-GG001',
        name: 'Gucci GG0061S',
        slug: 'gucci-gg0061s',
        priceInt: 8990000,
        stock: 30,
        description: 'Kính mát thời trang cao cấp, logo Gucci đặc trưng, gọng kim loại vàng',
        imageUrls: [unsplash('photo-1574258495973-f010dfbb5371'), unsplash('photo-1556306535-0f09a537f0a3')],
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Gucci',
          frameMaterial: 'Kim loại + Acetate',
          lensMaterial: 'Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Cat-eye',
          color: 'Vàng-Nâu',
          gender: 'Nữ',
        } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'POLICE-SPL001',
        name: 'Police SPL919',
        slug: 'police-spl919',
        priceInt: 3790000,
        stock: 55,
        description: 'Kính mát thể thao nam, thiết kế mạnh mẽ, gọng nhựa TR90',
        imageUrls: [unsplash('photo-1583394838336-acd977736f90'), unsplash('photo-1584036561566-baf8f5f1b144')],
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Police',
          frameMaterial: 'TR90',
          lensMaterial: 'TAC Polarized',
          uvProtection: 'UV400',
          frameShape: 'Pilot',
          color: 'Đen bóng',
          gender: 'Nam',
        } as never,
        model3dUrl: null,
      },
    }),

    // Products - Gọng kính
    productDb.product.create({
      data: {
        sku: 'OAKLEY-OX8156',
        name: 'Oakley OX8156 Crosslink',
        slug: 'oakley-ox8156-crosslink',
        priceInt: 4590000,
        stock: 40,
        description: 'Gọng kính cận thể thao, chất liệu nhẹ, thiết kế linh hoạt',
        imageUrls: [unsplash('photo-1622445275463-afa2ab738c34'), unsplash('photo-1614715838608-dd527c46231d')],
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Oakley',
          frameMaterial: 'O-Matter',
          frameShape: 'Rectangle',
          color: 'Đen-Xanh',
          gender: 'Nam',
          suitable: 'Cận, Viễn',
        } as never,
        model3dUrl: 'https://example.com/models/oakley-crosslink.glb',
      },
    }),
    productDb.product.create({
      data: {
        sku: 'VERSACE-VE3270',
        name: 'Versace VE3270',
        slug: 'versace-ve3270',
        priceInt: 7290000,
        stock: 25,
        description: 'Gọng kính sang trọng, logo Medusa đặc trưng, viền kim loại mạ vàng',
        imageUrls: [unsplash('photo-1577803645773-f96470509666'), unsplash('photo-1574258495973-f010dfbb5371')],
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Versace',
          frameMaterial: 'Acetate + Kim loại',
          frameShape: 'Cat-eye',
          color: 'Nâu-Vàng',
          gender: 'Nữ',
          suitable: 'Cận, Viễn, Loạn',
        } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'MOLSION-MS7120',
        name: 'Molsion MS7120',
        slug: 'molsion-ms7120',
        priceInt: 2490000,
        stock: 70,
        description: 'Gọng kính titanium siêu nhẹ, chống dị ứng, thiết kế tối giản',
        imageUrls: [unsplash('photo-1574258495973-f010dfbb5371'), unsplash('photo-1622445275463-afa2ab738c34')],
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Molsion',
          frameMaterial: 'Titanium',
          frameShape: 'Oval',
          color: 'Bạc',
          gender: 'Unisex',
          suitable: 'Cận, Viễn, Đa tròng',
          weight: '15g',
        } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'PARIM-PR8801',
        name: 'Parim PR8801',
        slug: 'parim-pr8801',
        priceInt: 1990000,
        stock: 85,
        description: 'Gọng kính nhựa TR90, thiết kế Hàn Quốc, nhiều màu sắc',
        imageUrls: [unsplash('photo-1609778308763-afe5cc0f4e24'), unsplash('photo-1614715838608-dd527c46231d')],
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Parim',
          frameMaterial: 'TR90',
          frameShape: 'Round',
          color: 'Xanh trong suốt',
          gender: 'Nữ',
          suitable: 'Cận, Viễn',
          style: 'Hàn Quốc',
        } as never,
        model3dUrl: null,
      },
    }),

    // Products - Kính thể thao
    productDb.product.create({
      data: {
        sku: 'OAKLEY-RADAR-EV',
        name: 'Oakley Radar EV Path',
        slug: 'oakley-radar-ev-path',
        priceInt: 6990000,
        stock: 35,
        description: 'Kính thể thao chuyên nghiệp, tròng Prizm, chống tia UV và ánh sáng xanh',
        imageUrls: [unsplash('photo-1622445275463-afa2ab738c34'), unsplash('photo-1614715838608-dd527c46231d')],
        categoryId: catSportsGlasses.id,
        attributes: {
          brand: 'Oakley',
          frameMaterial: 'O-Matter',
          lensMaterial: 'Plutonite',
          lensType: 'Prizm Road',
          uvProtection: 'UV400',
          sport: 'Đạp xe, Chạy bộ',
          features: 'Chống bám mồ hôi, Chống trầy',
        } as never,
        model3dUrl: 'https://example.com/models/oakley-radar.glb',
      },
    }),
    productDb.product.create({
      data: {
        sku: 'JULBO-SHIELD',
        name: 'Julbo Shield Alti Arc 4',
        slug: 'julbo-shield-alti-arc-4',
        priceInt: 5490000,
        stock: 20,
        description: 'Kính leo núi chuyên dụng, tròng photochromic tự điều chỉnh, chống tuyết',
        imageUrls: [unsplash('photo-1583394838336-acd977736f90'), unsplash('photo-1584036561566-baf8f5f1b144')],
        categoryId: catSportsGlasses.id,
        attributes: {
          brand: 'Julbo',
          frameMaterial: 'Grilamid',
          lensMaterial: 'NXT',
          lensType: 'Photochromic',
          uvProtection: 'UV400',
          sport: 'Leo núi, Trượt tuyết',
          features: 'Chống sương mù, Chống trầy, Tự động điều chỉnh',
        } as never,
        model3dUrl: null,
      },
    }),

    // Products - Phụ kiện
    productDb.product.create({
      data: {
        sku: 'CASE-HARD-001',
        name: 'Hộp đựng kính cứng cao cấp',
        slug: 'hop-dung-kinh-cung',
        priceInt: 199000,
        stock: 200,
        description: 'Hộp đựng kính cứng, chống va đập, lót nhung mềm',
        imageUrls: [unsplash('photo-1580979259381-e91bf183fd02')],
        categoryId: catAccessories.id,
        attributes: {
          type: 'Hộp đựng',
          material: 'Nhựa cứng + Nhung',
          color: 'Đen',
          size: '16x6x6cm',
        } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'CLOTH-MICRO-001',
        name: 'Khăn lau kính microfiber (Bộ 3)',
        slug: 'khan-lau-kinh-microfiber-bo-3',
        priceInt: 79000,
        stock: 500,
        description: 'Khăn lau kính siêu mềm, không trầy xước, hút bụi tốt',
        imageUrls: [unsplash('photo-1627483262769-36cb1e508278')],
        categoryId: catAccessories.id,
        attributes: {
          type: 'Khăn lau',
          material: 'Microfiber',
          quantity: '3 chiếc',
          size: '15x15cm',
          colors: 'Xám, Xanh, Hồng',
        } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'STRAP-SPORT-001',
        name: 'Dây đeo kính thể thao',
        slug: 'day-deo-kinh-the-thao',
        priceInt: 149000,
        stock: 150,
        description: 'Dây đeo kính chống trượt, co giãn, phù hợp với hoạt động thể thao',
        imageUrls: [unsplash('photo-1606933248010-ef2c83c31ca1')],
        categoryId: catAccessories.id,
        attributes: {
          type: 'Dây đeo',
          material: 'Nylon + Silicon',
          adjustable: true,
          color: 'Đen',
          suitable: 'Thể thao, Du lịch',
        } as never,
        model3dUrl: null,
      },
    }),
    productDb.product.create({
      data: {
        sku: 'SPRAY-CLEAN-001',
        name: 'Xịt rửa kính chuyên dụng 50ml',
        slug: 'xit-rua-kinh-50ml',
        priceInt: 129000,
        stock: 300,
        description: 'Dung dịch rửa kính an toàn, không gây hại cho tròng phủ đa lớp',
        imageUrls: [unsplash('photo-1619451334792-150fd785ee74')],
        categoryId: catAccessories.id,
        attributes: {
          type: 'Dung dịch vệ sinh',
          volume: '50ml',
          features: 'Không cồn, Không mùi, An toàn với tròng phủ',
          origin: 'Đức',
        } as never,
        model3dUrl: null,
      },
    }),
  ]);

  console.log('  ✓ categories:', [catSunglasses.slug, catEyeglasses.slug, catSportsGlasses.slug, catAccessories.slug]);
  console.log('  ✓ products:', products.length, 'items created');
  console.log('    - Kính mát:', products.slice(0, 4).length);
  console.log('    - Gọng kính:', products.slice(4, 8).length);
  console.log('    - Kính thể thao:', products.slice(8, 10).length);
  console.log('    - Phụ kiện:', products.slice(10, 14).length);

  return {
    categories: { catSunglasses, catEyeglasses, catSportsGlasses, catAccessories },
    products,
  };
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
    console.log('=== SEED START ===\n');

    // 1) Users + Address
    const { customer1, addr1 } = await seedUsers();

    // 2) Products + Categories
    const { products } = await seedProducts();

    // 3) Orders (cho customer1)
    const order = await seedOrders({ userId: customer1.id, addressId: addr1.id }, products);

    // 4) Payments (tạo bản ghi COD UNPAID cho order)
    await seedPayments(order);

    // 5) AR Snapshots (liên kết user + 1 sản phẩm)
    await seedAR(customer1.id, products[0].id);

    // 6) Cart (clear để sạch sẽ)
    await seedCart();

    // 7) Report (tạo 1 entry lưu dấu seed)
    await seedReport();

    console.log('\n=== SEED DONE ===');
    console.log('\n📊 SUMMARY:');
    console.log('👤 Users:', 4, '(2 admins, 2 customers)');
    console.log('� Products:', products.length, '(Kính mát, Gọng kính, Kính thể thao, Phụ kiện)');
    console.log('🏷️  Categories:', 4, '(Kính mát, Gọng kính, Kính thể thao, Phụ kiện)');
    console.log('🛒 Orders:', 1);
    console.log('💳 Payments:', 1);
    console.log('📸 AR Snapshots:', 1);
    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('  Admin 1:   admin@example.com / Password123!');
    console.log('  Admin 2:   haongo@admin.com / Password123!');
    console.log('  Customer1: customer1@example.com / Password123!');
    console.log('  Customer2: customer2@example.com / Password123!');
    console.log('\n🌐 Prisma Studio URLs:');
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
