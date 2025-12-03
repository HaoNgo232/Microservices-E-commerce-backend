import { Test, TestingModule } from '@nestjs/testing';
import { ProductQueryBuilder } from './product-query.builder';
import { ProductListQueryDto } from '@shared/dto/product.dto';

describe('ProductQueryBuilder', () => {
  let builder: ProductQueryBuilder;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductQueryBuilder],
    }).compile();

    builder = module.get<ProductQueryBuilder>(ProductQueryBuilder);
  });

  describe('buildWhereClause', () => {
    it('should return empty where clause for empty query', () => {
      const query: ProductListQueryDto = {};
      const result = builder.buildWhereClause(query);

      expect(result).toEqual({});
    });

    it('should build search filter with OR conditions', () => {
      const query: ProductListQueryDto = {
        search: 'test product',
      };
      const result = builder.buildWhereClause(query);

      expect(result).toEqual({
        OR: [
          { name: { contains: 'test product', mode: 'insensitive' } },
          { description: { contains: 'test product', mode: 'insensitive' } },
          { sku: { contains: 'test product', mode: 'insensitive' } },
        ],
      });
    });

    it('should build category filter', () => {
      const query: ProductListQueryDto = {
        categorySlug: 'electronics',
      };
      const result = builder.buildWhereClause(query);

      expect(result).toEqual({
        category: {
          slug: 'electronics',
        },
      });
    });

    it('should build min price filter', () => {
      const query: ProductListQueryDto = {
        minPriceInt: 10000,
      };
      const result = builder.buildWhereClause(query);

      expect(result).toEqual({
        priceInt: {
          gte: 10000,
        },
      });
    });

    it('should build max price filter', () => {
      const query: ProductListQueryDto = {
        maxPriceInt: 50000,
      };
      const result = builder.buildWhereClause(query);

      expect(result).toEqual({
        priceInt: {
          lte: 50000,
        },
      });
    });

    it('should build price range filter with both min and max', () => {
      const query: ProductListQueryDto = {
        minPriceInt: 10000,
        maxPriceInt: 50000,
      };
      const result = builder.buildWhereClause(query);

      expect(result).toEqual({
        priceInt: {
          gte: 10000,
          lte: 50000,
        },
      });
    });

    it('should combine multiple filters', () => {
      const query: ProductListQueryDto = {
        search: 'laptop',
        categorySlug: 'electronics',
        minPriceInt: 10000,
        maxPriceInt: 50000,
      };
      const result = builder.buildWhereClause(query);

      expect(result).toEqual({
        OR: [
          { name: { contains: 'laptop', mode: 'insensitive' } },
          { description: { contains: 'laptop', mode: 'insensitive' } },
          { sku: { contains: 'laptop', mode: 'insensitive' } },
        ],
        category: {
          slug: 'electronics',
        },
        priceInt: {
          gte: 10000,
          lte: 50000,
        },
      });
    });

    it('should handle empty search string', () => {
      const query: ProductListQueryDto = {
        search: '',
      };
      const result = builder.buildWhereClause(query);

      // Empty string is falsy, so no OR filter should be added
      expect(result).toEqual({});
    });
  });

  describe('getPaginationParams', () => {
    it('should return default pagination params when not provided', () => {
      const query: ProductListQueryDto = {};
      const result = builder.getPaginationParams(query);

      expect(result).toEqual({
        skip: 0,
        take: 20,
      });
    });

    it('should return pagination params with custom page and pageSize', () => {
      const query: ProductListQueryDto = {
        page: 2,
        pageSize: 10,
      };
      const result = builder.getPaginationParams(query);

      expect(result).toEqual({
        skip: 10, // (2 - 1) * 10
        take: 10,
      });
    });

    it('should handle page 1 correctly', () => {
      const query: ProductListQueryDto = {
        page: 1,
        pageSize: 20,
      };
      const result = builder.getPaginationParams(query);

      expect(result).toEqual({
        skip: 0, // (1 - 1) * 20
        take: 20,
      });
    });

    it('should handle large page numbers', () => {
      const query: ProductListQueryDto = {
        page: 100,
        pageSize: 50,
      };
      const result = builder.getPaginationParams(query);

      expect(result).toEqual({
        skip: 4950, // (100 - 1) * 50
        take: 50,
      });
    });

    it('should use default page when only pageSize is provided', () => {
      const query: ProductListQueryDto = {
        pageSize: 15,
      };
      const result = builder.getPaginationParams(query);

      expect(result).toEqual({
        skip: 0, // (1 - 1) * 15
        take: 15,
      });
    });

    it('should use default pageSize when only page is provided', () => {
      const query: ProductListQueryDto = {
        page: 3,
      };
      const result = builder.getPaginationParams(query);

      expect(result).toEqual({
        skip: 40, // (3 - 1) * 20
        take: 20,
      });
    });
  });

  describe('getPaginationMetadata', () => {
    it('should calculate totalPages correctly', () => {
      const result = builder.getPaginationMetadata(1, 20, 100);

      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        totalPages: 5, // Math.ceil(100 / 20)
      });
    });

    it('should handle exact division', () => {
      const result = builder.getPaginationMetadata(1, 10, 100);

      expect(result).toEqual({
        page: 1,
        pageSize: 10,
        totalPages: 10, // Math.ceil(100 / 10)
      });
    });

    it('should round up totalPages when not exact division', () => {
      const result = builder.getPaginationMetadata(1, 20, 95);

      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        totalPages: 5, // Math.ceil(95 / 20) = 5
      });
    });

    it('should handle zero total', () => {
      const result = builder.getPaginationMetadata(1, 20, 0);

      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        totalPages: 0, // Math.ceil(0 / 20) = 0
      });
    });

    it('should handle total less than pageSize', () => {
      const result = builder.getPaginationMetadata(1, 20, 5);

      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        totalPages: 1, // Math.ceil(5 / 20) = 1
      });
    });

    it('should handle large numbers', () => {
      const result = builder.getPaginationMetadata(10, 50, 10000);

      expect(result).toEqual({
        page: 10,
        pageSize: 50,
        totalPages: 200, // Math.ceil(10000 / 50) = 200
      });
    });

    it('should return correct metadata for different page numbers', () => {
      const result1 = builder.getPaginationMetadata(1, 20, 100);
      const result2 = builder.getPaginationMetadata(2, 20, 100);
      const result3 = builder.getPaginationMetadata(3, 20, 100);

      expect(result1.page).toBe(1);
      expect(result2.page).toBe(2);
      expect(result3.page).toBe(3);
      expect(result1.totalPages).toBe(5);
      expect(result2.totalPages).toBe(5);
      expect(result3.totalPages).toBe(5);
    });
  });
});
