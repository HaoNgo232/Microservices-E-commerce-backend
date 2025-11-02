import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@product-app/prisma/prisma.service';
import { CategoryMapper } from './mappers/category.mapper';
import { CategoryValidator } from './validators/category.validator';
import { CategoryQueryBuilder } from './builders/category-query.builder';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;
  let mapper: CategoryMapper;
  let validator: CategoryValidator;
  let queryBuilder: CategoryQueryBuilder;

  const mockPrismaService = {
    category: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCategoryMapper = {
    mapToCategoryResponse: jest.fn(),
    mapToCategoryWithRelations: jest.fn(),
    mapManyToCategoryResponse: jest.fn(),
  };

  const mockCategoryValidator = {
    validateSlugUnique: jest.fn(),
    validateSlugForUpdate: jest.fn(),
    validateParentExists: jest.fn(),
    validateParentUpdate: jest.fn(),
    validateCanDelete: jest.fn(),
  };

  const mockCategoryQueryBuilder = {
    buildWhereClause: jest.fn(),
    getPaginationParams: jest.fn(),
    getPaginationMetadata: jest.fn(),
  };

  const mockCategory = {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices',
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    parent: null,
    children: [],
  };

  const mockChildCategory = {
    id: 'cat-2',
    name: 'Smartphones',
    slug: 'smartphones',
    description: 'Mobile phones',
    parentId: 'cat-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    parent: mockCategory,
    children: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CategoryMapper,
          useValue: mockCategoryMapper,
        },
        {
          provide: CategoryValidator,
          useValue: mockCategoryValidator,
        },
        {
          provide: CategoryQueryBuilder,
          useValue: mockCategoryQueryBuilder,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);
    mapper = module.get<CategoryMapper>(CategoryMapper);
    validator = module.get<CategoryValidator>(CategoryValidator);
    queryBuilder = module.get<CategoryQueryBuilder>(CategoryQueryBuilder);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getById', () => {
    it('should return a category when found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockCategoryMapper.mapToCategoryWithRelations.mockReturnValue(mockCategory);

      const result = await service.getById({ id: 'cat-1' });

      expect(result).toBeDefined();
      expect(result.id).toBe('cat-1');
      expect(result.name).toBe('Electronics');
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        include: {
          parent: true,
          children: true,
        },
      });
      expect(mapper.mapToCategoryWithRelations).toHaveBeenCalledWith(mockCategory);
    });

    it('should throw RpcException when category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.getById({ id: 'non-existent' })).rejects.toThrow(RpcException);
      try {
        await service.getById({ id: 'non-existent' });
      } catch (error) {
        expect(error).toBeInstanceOf(RpcException);
        expect((error as RpcException).getError()).toMatchObject({
          statusCode: 404,
          message: 'Category with ID non-existent not found',
        });
      }
    });

    it('should throw RpcException on database error', async () => {
      mockPrismaService.category.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(service.getById({ id: 'cat-1' })).rejects.toThrow(RpcException);
    });
  });

  describe('getBySlug', () => {
    it('should return a category when found by slug', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockCategoryMapper.mapToCategoryWithRelations.mockReturnValue(mockCategory);

      const result = await service.getBySlug({ slug: 'electronics' });

      expect(result).toBeDefined();
      expect(result.slug).toBe('electronics');
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'electronics' },
        include: {
          parent: true,
          children: true,
        },
      });
      expect(mapper.mapToCategoryWithRelations).toHaveBeenCalledWith(mockCategory);
    });

    it('should throw RpcException when category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.getBySlug({ slug: 'non-existent' })).rejects.toThrow(RpcException);
    });
  });

  describe('list', () => {
    it('should return paginated categories', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([mockCategory]);
      mockPrismaService.category.count.mockResolvedValue(1);
      mockCategoryQueryBuilder.getPaginationParams.mockReturnValue({ skip: 0, take: 20 });
      mockCategoryQueryBuilder.buildWhereClause.mockResolvedValue({});
      mockCategoryQueryBuilder.getPaginationMetadata.mockReturnValue({
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      mockCategoryMapper.mapManyToCategoryResponse.mockReturnValue([mockCategory]);

      const result = await service.list({ page: 1, pageSize: 20 });

      expect(result).toBeDefined();
      expect(result.categories).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply search filter', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([]);
      mockPrismaService.category.count.mockResolvedValue(0);
      mockCategoryQueryBuilder.getPaginationParams.mockReturnValue({ skip: 0, take: 20 });
      mockCategoryQueryBuilder.buildWhereClause.mockResolvedValue({
        OR: expect.any(Array),
      });
      mockCategoryQueryBuilder.getPaginationMetadata.mockReturnValue({
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
      mockCategoryMapper.mapManyToCategoryResponse.mockReturnValue([]);

      await service.list({ q: 'search term', page: 1, pageSize: 20 });

      expect(queryBuilder.buildWhereClause).toHaveBeenCalled();
    });

    it('should filter by parent slug', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([mockChildCategory]);
      mockPrismaService.category.count.mockResolvedValue(1);
      mockCategoryQueryBuilder.getPaginationParams.mockReturnValue({ skip: 0, take: 20 });
      mockCategoryQueryBuilder.buildWhereClause.mockResolvedValue({
        parentId: 'cat-1',
      });
      mockCategoryQueryBuilder.getPaginationMetadata.mockReturnValue({
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      mockCategoryMapper.mapManyToCategoryResponse.mockReturnValue([mockChildCategory]);

      const result = await service.list({ parentSlug: 'electronics' });

      expect(result.categories).toHaveLength(1);
    });

    it('should return empty results if parent not found', async () => {
      mockCategoryQueryBuilder.getPaginationParams.mockReturnValue({ skip: 0, take: 20 });
      mockCategoryQueryBuilder.buildWhereClause.mockResolvedValue({
        id: { equals: 'PARENT_NOT_FOUND' },
      });
      mockCategoryMapper.mapManyToCategoryResponse.mockReturnValue([]);

      const result = await service.list({ parentSlug: 'non-existent' });

      expect(result.categories).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'New Category',
      slug: 'new-category',
      description: 'A new category',
      parentId: undefined,
    };

    it('should create a new category successfully', async () => {
      mockCategoryValidator.validateSlugUnique.mockResolvedValue(undefined);
      mockPrismaService.category.create.mockResolvedValue({
        ...mockCategory,
        name: 'New Category',
        slug: 'new-category',
      });
      mockCategoryMapper.mapToCategoryResponse.mockReturnValue({
        ...mockCategory,
        name: 'New Category',
        slug: 'new-category',
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Category');
      expect(validator.validateSlugUnique).toHaveBeenCalledWith('new-category');
      expect(prisma.category.create).toHaveBeenCalled();
    });

    it('should throw RpcException if slug already exists', async () => {
      mockCategoryValidator.validateSlugUnique.mockRejectedValue(
        new RpcException({
          statusCode: 409,
          message: "Category with slug 'new-category' already exists",
        }),
      );

      await expect(service.create(createDto)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException if parent not found', async () => {
      mockCategoryValidator.validateSlugUnique.mockResolvedValue(undefined);
      mockCategoryValidator.validateParentExists.mockRejectedValue(
        new RpcException({
          statusCode: 400,
          message: 'Parent category with ID non-existent not found',
        }),
      );

      await expect(service.create({ ...createDto, parentId: 'non-existent' })).rejects.toThrow(RpcException);
    });

    it('should create child category with valid parent', async () => {
      mockCategoryValidator.validateSlugUnique.mockResolvedValue(undefined);
      mockCategoryValidator.validateParentExists.mockResolvedValue(undefined);
      mockPrismaService.category.create.mockResolvedValue(mockChildCategory);
      mockCategoryMapper.mapToCategoryResponse.mockReturnValue(mockChildCategory);

      const result = await service.create({
        ...createDto,
        parentId: 'cat-1',
      });

      expect(result).toBeDefined();
      expect(result.parentId).toBe('cat-1');
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Category',
      description: 'Updated description',
    };

    it('should update a category successfully', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockCategoryValidator.validateSlugForUpdate.mockResolvedValue(undefined);
      mockCategoryValidator.validateParentUpdate.mockResolvedValue(undefined);
      mockPrismaService.category.update.mockResolvedValue({
        ...mockCategory,
        ...updateDto,
      });
      mockCategoryMapper.mapToCategoryResponse.mockReturnValue({
        ...mockCategory,
        ...updateDto,
      });

      const result = await service.update('cat-1', updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Category');
      expect(prisma.category.update).toHaveBeenCalled();
    });

    it('should throw RpcException if category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(RpcException);
    });

    it('should throw RpcException if new slug already exists', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockCategoryValidator.validateSlugForUpdate.mockRejectedValue(
        new RpcException({
          statusCode: 409,
          message: "Category with slug 'existing-slug' already exists",
        }),
      );

      await expect(service.update('cat-1', { slug: 'existing-slug' })).rejects.toThrow(RpcException);
    });

    it('should throw RpcException if trying to set self as parent', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockCategoryValidator.validateSlugForUpdate.mockResolvedValue(undefined);
      mockCategoryValidator.validateParentUpdate.mockRejectedValue(
        new RpcException({
          statusCode: 400,
          message: 'Category cannot be its own parent',
        }),
      );

      await expect(service.update('cat-1', { parentId: 'cat-1' })).rejects.toThrow(RpcException);
    });

    it('should throw RpcException for circular reference', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockCategoryValidator.validateSlugForUpdate.mockResolvedValue(undefined);
      mockCategoryValidator.validateParentUpdate.mockRejectedValue(
        new RpcException({
          statusCode: 400,
          message: 'Cannot create circular reference: the new parent is a descendant of this category',
        }),
      );

      await expect(service.update('cat-1', { parentId: 'cat-2' })).rejects.toThrow(RpcException);
    });

    it('should throw RpcException for deep circular reference (grandchild)', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockCategoryValidator.validateSlugForUpdate.mockResolvedValue(undefined);
      mockCategoryValidator.validateParentUpdate.mockRejectedValue(
        new RpcException({
          statusCode: 400,
          message: 'Cannot create circular reference: the new parent is a descendant of this category',
        }),
      );

      await expect(service.update('cat-1', { parentId: 'cat-3' })).rejects.toThrow(RpcException);
    });
  });

  describe('delete', () => {
    it('should delete a category successfully', async () => {
      mockCategoryValidator.validateCanDelete.mockResolvedValue({
        childrenCount: 0,
        productCount: 0,
      });
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await service.delete('cat-1');

      expect(result).toEqual({ success: true, id: 'cat-1' });
      expect(validator.validateCanDelete).toHaveBeenCalledWith('cat-1');
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
    });

    it('should throw RpcException if category not found', async () => {
      mockCategoryValidator.validateCanDelete.mockResolvedValue({
        childrenCount: 0,
        productCount: 0,
      });
      mockPrismaService.category.delete.mockRejectedValue(new Error('Record to delete does not exist'));

      await expect(service.delete('non-existent')).rejects.toThrow(RpcException);
    });

    it('should throw RpcException if category has children', async () => {
      mockCategoryValidator.validateCanDelete.mockRejectedValue(
        new RpcException({
          statusCode: 400,
          message: 'Cannot delete category with child categories. Delete or reassign children first.',
        }),
      );

      await expect(service.delete('cat-1')).rejects.toThrow(RpcException);
    });

    it('should throw RpcException if category has products', async () => {
      mockCategoryValidator.validateCanDelete.mockRejectedValue(
        new RpcException({
          statusCode: 400,
          message: 'Cannot delete category with products. Reassign products first.',
        }),
      );

      await expect(service.delete('cat-1')).rejects.toThrow(RpcException);
    });
  });
});
