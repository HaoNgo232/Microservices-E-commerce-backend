import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import {
  CategoryCreateDto,
  CategoryUpdateDto,
  CategoryListQueryDto,
  CategoryIdDto,
  CategorySlugDto,
} from '@shared/dto/category.dto';
import { CategoryResponse, CategoryWithRelations, PaginatedCategoriesResponse } from '@shared/types/product.types';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;

  const mockCategoriesService = {
    getById: jest.fn(),
    getBySlug: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCategoryResponse: CategoryResponse = {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices',
    parentId: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockCategoryWithRelations: CategoryWithRelations = {
    ...mockCategoryResponse,
    parent: null,
    children: [],
  };

  const mockPaginatedResponse: PaginatedCategoriesResponse = {
    categories: [mockCategoryResponse],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getById', () => {
    it('should call service.getById with correct dto', async () => {
      const dto: CategoryIdDto = { id: 'cat-1' };
      mockCategoriesService.getById.mockResolvedValue(mockCategoryWithRelations);

      const result = await controller.getById(dto);

      expect(result).toEqual(mockCategoryWithRelations);
      expect(service.getById).toHaveBeenCalledWith(dto);
      expect(service.getById).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from service', async () => {
      const dto: CategoryIdDto = { id: 'non-existent' };
      const error = new Error('Category not found');
      mockCategoriesService.getById.mockRejectedValue(error);

      await expect(controller.getById(dto)).rejects.toThrow('Category not found');
      expect(service.getById).toHaveBeenCalledWith(dto);
    });
  });

  describe('getBySlug', () => {
    it('should call service.getBySlug with correct dto', async () => {
      const dto: CategorySlugDto = { slug: 'electronics' };
      mockCategoriesService.getBySlug.mockResolvedValue(mockCategoryWithRelations);

      const result = await controller.getBySlug(dto);

      expect(result).toEqual(mockCategoryWithRelations);
      expect(service.getBySlug).toHaveBeenCalledWith(dto);
      expect(service.getBySlug).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from service', async () => {
      const dto: CategorySlugDto = { slug: 'non-existent' };
      const error = new Error('Category not found');
      mockCategoriesService.getBySlug.mockRejectedValue(error);

      await expect(controller.getBySlug(dto)).rejects.toThrow('Category not found');
      expect(service.getBySlug).toHaveBeenCalledWith(dto);
    });
  });

  describe('list', () => {
    it('should call service.list with correct query', async () => {
      const query: CategoryListQueryDto = { page: 1, pageSize: 20 };
      mockCategoriesService.list.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.list(query);

      expect(result).toEqual(mockPaginatedResponse);
      expect(service.list).toHaveBeenCalledWith(query);
      expect(service.list).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from service', async () => {
      const query: CategoryListQueryDto = { page: 1, pageSize: 20 };
      const error = new Error('Database error');
      mockCategoriesService.list.mockRejectedValue(error);

      await expect(controller.list(query)).rejects.toThrow('Database error');
      expect(service.list).toHaveBeenCalledWith(query);
    });
  });

  describe('create', () => {
    it('should call service.create with correct dto', async () => {
      const dto: CategoryCreateDto = {
        name: 'New Category',
        slug: 'new-category',
        description: 'A new category',
      };
      mockCategoriesService.create.mockResolvedValue(mockCategoryResponse);

      const result = await controller.create(dto);

      expect(result).toEqual(mockCategoryResponse);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from service', async () => {
      const dto: CategoryCreateDto = {
        name: 'New Category',
        slug: 'existing-slug',
        description: 'A new category',
      };
      const error = new Error('Slug already exists');
      mockCategoriesService.create.mockRejectedValue(error);

      await expect(controller.create(dto)).rejects.toThrow('Slug already exists');
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should call service.update with correct payload', async () => {
      const payload = {
        id: 'cat-1',
        dto: { name: 'Updated Category', description: 'Updated description' } as CategoryUpdateDto,
      };
      const updatedCategory = { ...mockCategoryResponse, name: 'Updated Category' };
      mockCategoriesService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update(payload);

      expect(result).toEqual(updatedCategory);
      expect(service.update).toHaveBeenCalledWith(payload.id, payload.dto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from service', async () => {
      const payload = {
        id: 'non-existent',
        dto: { name: 'Updated Category' } as CategoryUpdateDto,
      };
      const error = new Error('Category not found');
      mockCategoriesService.update.mockRejectedValue(error);

      await expect(controller.update(payload)).rejects.toThrow('Category not found');
      expect(service.update).toHaveBeenCalledWith(payload.id, payload.dto);
    });
  });

  describe('delete', () => {
    it('should call service.delete with correct id', async () => {
      const id = 'cat-1';
      const deleteResponse = { success: true, id: 'cat-1' };
      mockCategoriesService.delete.mockResolvedValue(deleteResponse);

      const result = await controller.delete(id);

      expect(result).toEqual(deleteResponse);
      expect(service.delete).toHaveBeenCalledWith(id);
      expect(service.delete).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from service', async () => {
      const id = 'non-existent';
      const error = new Error('Category not found');
      mockCategoriesService.delete.mockRejectedValue(error);

      await expect(controller.delete(id)).rejects.toThrow('Category not found');
      expect(service.delete).toHaveBeenCalledWith(id);
    });
  });
});
