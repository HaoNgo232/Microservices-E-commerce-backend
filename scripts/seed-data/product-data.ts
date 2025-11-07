import type { PrismaClient as ProductDB } from '../../apps/product-app/prisma/generated/client';

/**
 * Tạo 30 sản phẩm với ảnh từ MinIO
 */
export async function createProducts(
  productDb: ProductDB,
  imageUrls: Map<string, string>,
  categories: {
    catSunglasses: { id: string };
    catEyeglasses: { id: string };
    catSportsGlasses: { id: string };
    catAccessories: { id: string };
  },
): Promise<Array<{ id: string; priceInt: number }>> {
  const imageArray = Array.from(imageUrls.values());

  // Helper to get 2 images for each product
  const getImages = (index: number): string[] => {
    const img1 = imageArray[index] || imageArray[0];
    const img2 = imageArray[(index + 1) % imageArray.length];
    return [img1, img2];
  };

  const { catSunglasses, catEyeglasses, catSportsGlasses, catAccessories } = categories;

  const products = await Promise.all([
    // 1. Ray-Ban Aviator Classic
    productDb.product.create({
      data: {
        sku: 'RB-AVIATOR-001',
        name: 'Ray-Ban Aviator Classic',
        slug: 'ray-ban-aviator-classic',
        priceInt: 1000,
        stock: 45,
        description: 'Kính mát phi công kinh điển, gọng kim loại vàng, tròng thủy tinh G-15',
        imageUrls: getImages(0),
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

    // 2. Ray-Ban Wayfarer
    productDb.product.create({
      data: {
        sku: 'RB-WAYFARER-002',
        name: 'Ray-Ban Wayfarer',
        slug: 'ray-ban-wayfarer',
        priceInt: 1000,
        stock: 60,
        description: 'Kính mát vuông cổ điển, phong cách retro, gọng nhựa acetate',
        imageUrls: getImages(1),
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

    // 3. Gucci GG0061S
    productDb.product.create({
      data: {
        sku: 'GUCCI-GG001',
        name: 'Gucci GG0061S',
        slug: 'gucci-gg0061s',
        priceInt: 2000,
        stock: 30,
        description: 'Kính mát thời trang cao cấp, logo Gucci đặc trưng, gọng kim loại vàng',
        imageUrls: getImages(2),
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
      },
    }),

    // 4. Oakley Radar EV Path
    productDb.product.create({
      data: {
        sku: 'OAKLEY-SPORT-001',
        name: 'Oakley Radar EV Path',
        slug: 'oakley-radar-ev-path',
        priceInt: 1000,
        stock: 40,
        description: 'Kính thể thao chuyên nghiệp, tròng Prizm Road, gọng nhẹ O Matter',
        imageUrls: getImages(3),
        categoryId: catSportsGlasses.id,
        attributes: {
          brand: 'Oakley',
          frameMaterial: 'O Matter',
          lensMaterial: 'Plutonite Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Sport Wrap',
          color: 'Đen-Đỏ',
          prizm: true,
        } as never,
        model3dUrl: 'https://example.com/models/oakley-radar.glb',
      },
    }),

    // 5. Prada PR 17WS
    productDb.product.create({
      data: {
        sku: 'PRADA-PR001',
        name: 'Prada PR 17WS',
        slug: 'prada-pr-17ws',
        priceInt: 9990000,
        stock: 25,
        description: 'Kính mát sang trọng, gọng kim loại mạ vàng, logo Prada nổi bật',
        imageUrls: getImages(4),
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Prada',
          frameMaterial: 'Kim loại',
          lensMaterial: 'Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Pilot',
          color: 'Vàng-Nâu',
          gender: 'Nữ',
        } as never,
      },
    }),

    // 6. Gentle Monster MOMO
    productDb.product.create({
      data: {
        sku: 'GENTLE-MONSTER-001',
        name: 'Gentle Monster MOMO',
        slug: 'gentle-monster-momo',
        priceInt: 7990000,
        stock: 35,
        description: 'Kính mát Hàn Quốc thiết kế độc đáo, gọng tròn oversized',
        imageUrls: getImages(5),
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Gentle Monster',
          frameMaterial: 'Acetate + Kim loại',
          lensMaterial: 'Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Round Oversized',
          color: 'Đen-Đen',
        } as never,
      },
    }),

    // 7. Tom Ford FT0628
    productDb.product.create({
      data: {
        sku: 'TOMFORD-TF001',
        name: 'Tom Ford FT0628',
        slug: 'tom-ford-ft0628',
        priceInt: 11990000,
        stock: 20,
        description: 'Kính mát cao cấp, thiết kế vuông to bản, logo T kim loại sang trọng',
        imageUrls: getImages(6),
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Tom Ford',
          frameMaterial: 'Acetate + Kim loại',
          lensMaterial: 'Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Square Oversized',
          color: 'Nâu Havana',
          gender: 'Unisex',
        } as never,
      },
    }),

    // 8. Vintage Cat Eye Retro
    productDb.product.create({
      data: {
        sku: 'CATEYE-VINTAGE-001',
        name: 'Vintage Cat Eye Retro',
        slug: 'vintage-cat-eye-retro',
        priceInt: 1990000,
        stock: 80,
        description: 'Kính mát mắt mèo phong cách vintage, gọng nhựa nhiều màu sắc',
        imageUrls: getImages(7),
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Vintage Style',
          frameMaterial: 'Plastic',
          lensMaterial: 'Acrylic',
          uvProtection: 'UV400',
          frameShape: 'Cat Eye',
          color: 'Đa màu',
          gender: 'Nữ',
        } as never,
      },
    }),

    // 9. Polarized Driving Glasses
    productDb.product.create({
      data: {
        sku: 'POLARIZED-DRIVE-001',
        name: 'Polarized Driving Glasses',
        slug: 'polarized-driving-glasses',
        priceInt: 2490000,
        stock: 70,
        description: 'Kính lái xe phân cực, chống chói hiệu quả, gọng nhôm magiê nhẹ',
        imageUrls: getImages(8),
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Driver Pro',
          frameMaterial: 'Aluminum Magnesium',
          lensMaterial: 'Polarized TAC',
          uvProtection: 'UV400',
          frameShape: 'Rectangle',
          color: 'Xám-Đen',
          polarized: true,
        } as never,
      },
    }),

    // 10. Blue Light Blocking Glasses
    productDb.product.create({
      data: {
        sku: 'BLUE-LIGHT-001',
        name: 'Blue Light Blocking Glasses',
        slug: 'blue-light-blocking-glasses',
        priceInt: 890000,
        stock: 100,
        description: 'Gọng kính chống ánh sáng xanh, bảo vệ mắt khi dùng máy tính',
        imageUrls: getImages(9),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Eye Protect',
          frameMaterial: 'TR90',
          lensMaterial: 'Blue Light Filter',
          frameShape: 'Round',
          color: 'Đen',
          blueLight: true,
        } as never,
      },
    }),

    // 11. Reading Glasses +2.0
    productDb.product.create({
      data: {
        sku: 'READING-GLASS-001',
        name: 'Reading Glasses +2.0',
        slug: 'reading-glasses-plus-2',
        priceInt: 590000,
        stock: 120,
        description: 'Kính đọc sách độ +2.0, gọng nhựa nhẹ, nhiều màu sắc',
        imageUrls: getImages(10),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Reader',
          frameMaterial: 'Plastic',
          lensMaterial: 'Resin',
          frameShape: 'Rectangle',
          color: 'Đa màu',
          strength: '+2.0',
        } as never,
      },
    }),

    // 12. Cycling Sports Glasses
    productDb.product.create({
      data: {
        sku: 'SPORTS-CYCLING-001',
        name: 'Cycling Sports Glasses',
        slug: 'cycling-sports-glasses',
        priceInt: 3490000,
        stock: 50,
        description: 'Kính đạp xe chuyên dụng, tròng đổi màu theo ánh sáng, chống gió',
        imageUrls: getImages(11),
        categoryId: catSportsGlasses.id,
        attributes: {
          brand: 'Cycle Pro',
          frameMaterial: 'TR90',
          lensMaterial: 'Photochromic Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Sport Wrap',
          color: 'Trắng-Đỏ',
          photochromic: true,
        } as never,
      },
    }),

    // 13. Kids Safety Glasses
    productDb.product.create({
      data: {
        sku: 'KIDS-GLASS-001',
        name: 'Kids Safety Glasses',
        slug: 'kids-safety-glasses',
        priceInt: 790000,
        stock: 90,
        description: 'Kính trẻ em an toàn, gọng dẻo không gãy, nhiều màu vui nhộn',
        imageUrls: getImages(12),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Kids Vision',
          frameMaterial: 'Silicone Flex',
          lensMaterial: 'Impact Resistant',
          frameShape: 'Round',
          color: 'Đa màu',
          age: '5-12',
        } as never,
      },
    }),

    // 14. Classic Metal Frame
    productDb.product.create({
      data: {
        sku: 'METAL-FRAME-001',
        name: 'Classic Metal Frame',
        slug: 'classic-metal-frame',
        priceInt: 1490000,
        stock: 75,
        description: 'Gọng kính kim loại cổ điển, thanh lịch cho công sở',
        imageUrls: getImages(13),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Classic Style',
          frameMaterial: 'Stainless Steel',
          frameShape: 'Oval',
          color: 'Vàng/Bạc',
          gender: 'Unisex',
        } as never,
      },
    }),

    // 15. Clip-On Magnetic Sunglasses
    productDb.product.create({
      data: {
        sku: 'CLIP-ON-001',
        name: 'Clip-On Magnetic Sunglasses',
        slug: 'clip-on-magnetic-sunglasses',
        priceInt: 1990000,
        stock: 60,
        description: 'Gọng kính có clip-on kính mát nam châm, 2 trong 1 tiện lợi',
        imageUrls: getImages(14),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: '2 in 1',
          frameMaterial: 'Metal',
          lensMaterial: 'Magnetic Clip',
          uvProtection: 'UV400',
          frameShape: 'Rectangle',
          color: 'Đen',
        } as never,
      },
    }),

    // 16. Round Gold Vintage
    productDb.product.create({
      data: {
        sku: 'ROUND-GOLD-001',
        name: 'Round Gold Vintage',
        slug: 'round-gold-vintage',
        priceInt: 2290000,
        stock: 55,
        description: 'Gọng kính tròn vàng phong cách vintage, thanh mảnh sang trọng',
        imageUrls: getImages(15),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Vintage Gold',
          frameMaterial: 'Metal Alloy',
          frameShape: 'Round',
          color: 'Vàng',
          style: 'Vintage',
        } as never,
      },
    }),

    // 17. Hexagon Fashion Frame
    productDb.product.create({
      data: {
        sku: 'HEXAGON-FRAME-001',
        name: 'Hexagon Fashion Frame',
        slug: 'hexagon-fashion-frame',
        priceInt: 1790000,
        stock: 65,
        description: 'Gọng kính lục giác độc đáo, phong cách hiện đại',
        imageUrls: getImages(16),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Modern Style',
          frameMaterial: 'Metal',
          frameShape: 'Hexagon',
          color: 'Đen/Vàng',
        } as never,
      },
    }),

    // 18. Oversized Fashion Sunglasses
    productDb.product.create({
      data: {
        sku: 'OVERSIZED-SUN-001',
        name: 'Oversized Fashion Sunglasses',
        slug: 'oversized-fashion-sunglasses',
        priceInt: 2990000,
        stock: 45,
        description: 'Kính mát oversized thời trang, che phủ tốt, phong cách celebrities',
        imageUrls: getImages(17),
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Fashion Forward',
          frameMaterial: 'Acetate',
          lensMaterial: 'Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Oversized Square',
          color: 'Đen/Nâu',
          gender: 'Nữ',
        } as never,
      },
    }),

    // 19. Tortoise Shell Classic
    productDb.product.create({
      data: {
        sku: 'TORTOISE-SHELL-001',
        name: 'Tortoise Shell Classic',
        slug: 'tortoise-shell-classic',
        priceInt: 2490000,
        stock: 50,
        description: 'Gọng kính họa tiết mai rùa cổ điển, phong cách retro',
        imageUrls: getImages(18),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Retro Style',
          frameMaterial: 'Acetate',
          frameShape: 'Wayfarer',
          color: 'Tortoise Shell',
          style: 'Retro',
        } as never,
      },
    }),

    // 20. Natural Wood Frame
    productDb.product.create({
      data: {
        sku: 'WOOD-FRAME-001',
        name: 'Natural Wood Frame',
        slug: 'natural-wood-frame',
        priceInt: 3990000,
        stock: 30,
        description: 'Gọng kính gỗ tự nhiên, thân thiện môi trường, độc đáo',
        imageUrls: getImages(19),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Eco Friendly',
          frameMaterial: 'Bamboo Wood',
          frameShape: 'Rectangle',
          color: 'Natural Wood',
          eco: true,
        } as never,
      },
    }),

    // 21. Mirrored Aviator Sunglasses
    productDb.product.create({
      data: {
        sku: 'MIRRORED-SUN-001',
        name: 'Mirrored Aviator Sunglasses',
        slug: 'mirrored-aviator-sunglasses',
        priceInt: 3490000,
        stock: 40,
        description: 'Kính mát aviator tròng gương, phản chiếu ánh sáng tốt',
        imageUrls: getImages(20),
        categoryId: catSunglasses.id,
        attributes: {
          brand: 'Mirror Style',
          frameMaterial: 'Metal',
          lensMaterial: 'Mirrored Polycarbonate',
          uvProtection: 'UV400',
          frameShape: 'Aviator',
          color: 'Bạc-Xanh',
          mirrored: true,
        } as never,
      },
    }),

    // 22. Foldable Reading Glasses
    productDb.product.create({
      data: {
        sku: 'FOLDABLE-READ-001',
        name: 'Foldable Reading Glasses',
        slug: 'foldable-reading-glasses',
        priceInt: 690000,
        stock: 100,
        description: 'Kính đọc sách gấp gọn, kèm hộp bảo vệ, tiện mang theo',
        imageUrls: getImages(21),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Portable',
          frameMaterial: 'Plastic',
          frameShape: 'Rectangle',
          color: 'Đa màu',
          foldable: true,
        } as never,
      },
    }),

    // 23. Transition Lens Glasses
    productDb.product.create({
      data: {
        sku: 'TRANSITION-LENS-001',
        name: 'Transition Lens Glasses',
        slug: 'transition-lens-glasses',
        priceInt: 4490000,
        stock: 35,
        description: 'Kính đổi màu tự động theo ánh sáng, tiện lợi 2 trong 1',
        imageUrls: getImages(22),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'SmartLens',
          frameMaterial: 'TR90',
          lensMaterial: 'Photochromic',
          frameShape: 'Rectangle',
          color: 'Đen',
          photochromic: true,
        } as never,
      },
    }),

    // 24. Lightweight TR90 Frame
    productDb.product.create({
      data: {
        sku: 'LIGHTWEIGHT-TR90-001',
        name: 'Lightweight TR90 Frame',
        slug: 'lightweight-tr90-frame',
        priceInt: 1290000,
        stock: 85,
        description: 'Gọng kính TR90 siêu nhẹ, bền bỉ, không gây khó chịu',
        imageUrls: getImages(23),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Feather Light',
          frameMaterial: 'TR90',
          frameShape: 'Rectangle',
          color: 'Đen/Xanh',
          weight: 'Ultra Light',
        } as never,
      },
    }),

    // 25. Progressive Multifocal Glasses
    productDb.product.create({
      data: {
        sku: 'PROGRESSIVE-LENS-001',
        name: 'Progressive Multifocal Glasses',
        slug: 'progressive-multifocal-glasses',
        priceInt: 5990000,
        stock: 25,
        description: 'Kính đa tròng tiến triển, nhìn xa gần không cần thay kính',
        imageUrls: getImages(24),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Vision Plus',
          frameMaterial: 'Metal',
          lensMaterial: 'Progressive',
          frameShape: 'Rectangle',
          color: 'Đen',
          multifocal: true,
        } as never,
      },
    }),

    // 26. Rimless Minimalist Frame
    productDb.product.create({
      data: {
        sku: 'RIMLESS-GLASS-001',
        name: 'Rimless Minimalist Frame',
        slug: 'rimless-minimalist-frame',
        priceInt: 2790000,
        stock: 40,
        description: 'Gọng kính không viền tối giản, nhẹ nhàng, thanh lịch',
        imageUrls: getImages(25),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Minimal',
          frameMaterial: 'Rimless Titanium',
          frameShape: 'Oval',
          color: 'Trong suốt',
          style: 'Minimalist',
        } as never,
      },
    }),

    // 27. Clear Fashion Glasses
    productDb.product.create({
      data: {
        sku: 'FASHION-CLEAR-001',
        name: 'Clear Fashion Glasses',
        slug: 'clear-fashion-glasses',
        priceInt: 990000,
        stock: 95,
        description: 'Gọng kính trong suốt thời trang, phù hợp mọi outfit',
        imageUrls: getImages(26),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Fashion Clear',
          frameMaterial: 'Transparent Plastic',
          frameShape: 'Round/Square',
          color: 'Trong suốt',
        } as never,
      },
    }),

    // 28. Anti-Fatigue Computer Glasses
    productDb.product.create({
      data: {
        sku: 'ANTI-FATIGUE-001',
        name: 'Anti-Fatigue Computer Glasses',
        slug: 'anti-fatigue-computer-glasses',
        priceInt: 1190000,
        stock: 80,
        description: 'Kính chống mỏi mắt khi làm việc máy tính, tròng lọc ánh sáng xanh',
        imageUrls: getImages(27),
        categoryId: catEyeglasses.id,
        attributes: {
          brand: 'Eye Care',
          frameMaterial: 'TR90',
          lensMaterial: 'Blue Light + Anti-Fatigue',
          frameShape: 'Rectangle',
          color: 'Đen',
          blueLight: true,
        } as never,
      },
    }),

    // 29. Premium Leather Glasses Case
    productDb.product.create({
      data: {
        sku: 'ACCESSORY-CASE-001',
        name: 'Premium Leather Glasses Case',
        slug: 'premium-leather-glasses-case',
        priceInt: 490000,
        stock: 150,
        description: 'Hộp đựng kính da cao cấp, bảo vệ kính tốt, sang trọng',
        imageUrls: [imageArray[28] || imageArray[0]],
        categoryId: catAccessories.id,
        attributes: {
          material: 'Genuine Leather',
          color: 'Nâu/Đen',
          type: 'Hard Case',
        } as never,
      },
    }),

    // 30. Glasses Chain Strap
    productDb.product.create({
      data: {
        sku: 'ACCESSORY-CHAIN-001',
        name: 'Glasses Chain Strap',
        slug: 'glasses-chain-strap',
        priceInt: 290000,
        stock: 200,
        description: 'Dây đeo kính thời trang, nhiều mẫu mã, tiện lợi',
        imageUrls: [imageArray[29] || imageArray[0]],
        categoryId: catAccessories.id,
        attributes: {
          material: 'Metal Chain / Beads',
          color: 'Đa màu',
          type: 'Chain/Strap',
        } as never,
      },
    }),
  ]);

  return products;
}
