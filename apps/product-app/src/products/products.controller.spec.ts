import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    getById: jest.fn(),
    getByIds: jest.fn(),
    getBySlug: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    decrementStock: jest.fn(),
    incrementStock: jest.fn(),
    adminCreate: jest.fn(),
    adminUpdate: jest.fn(),
    adminDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getById', () => {
    it('should call service.getById with correct dto', async () => {
      const dto = { id: 'prod-1' };
      const mockProduct = { id: 'prod-1', name: 'Test Product' };
      mockProductsService.getById.mockResolvedValue(mockProduct);

      const result = await controller.getById(dto);

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.getById).toHaveBeenCalledWith(dto);
      expect(mockProductsService.getById).toHaveBeenCalledTimes(1);
    });
  });

  describe('getByIds', () => {
    it('should call service.getByIds with correct dto', async () => {
      const dto = { ids: ['prod-1', 'prod-2'] };
      const mockProducts = [
        { id: 'prod-1', name: 'Product 1' },
        { id: 'prod-2', name: 'Product 2' },
      ];
      mockProductsService.getByIds.mockResolvedValue(mockProducts);

      const result = await controller.getByIds(dto);

      expect(result).toEqual(mockProducts);
      expect(mockProductsService.getByIds).toHaveBeenCalledWith(dto);
      expect(mockProductsService.getByIds).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBySlug', () => {
    it('should call service.getBySlug with correct dto', async () => {
      const dto = { slug: 'test-product' };
      const mockProduct = { id: 'prod-1', slug: 'test-product', name: 'Test Product' };
      mockProductsService.getBySlug.mockResolvedValue(mockProduct);

      const result = await controller.getBySlug(dto);

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.getBySlug).toHaveBeenCalledWith(dto);
      expect(mockProductsService.getBySlug).toHaveBeenCalledTimes(1);
    });
  });

  describe('list', () => {
    it('should call service.list with correct query', async () => {
      const query = { page: 1, pageSize: 20 };
      const mockResponse = {
        products: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      mockProductsService.list.mockResolvedValue(mockResponse);

      const result = await controller.list(query);

      expect(result).toEqual(mockResponse);
      expect(mockProductsService.list).toHaveBeenCalledWith(query);
      expect(mockProductsService.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('should call service.create with correct dto', async () => {
      const dto = {
        sku: 'SKU-001',
        name: 'New Product',
        slug: 'new-product',
        priceInt: 1000,
        categoryId: 'cat-1',
      };
      const mockProduct = { id: 'prod-1', ...dto };
      mockProductsService.create.mockResolvedValue(mockProduct);

      const result = await controller.create(dto);

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.create).toHaveBeenCalledWith(dto);
      expect(mockProductsService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should call service.update with correct payload', async () => {
      const payload = {
        id: 'prod-1',
        dto: { name: 'Updated Product', priceInt: 2000 },
      };
      const mockProduct = { id: 'prod-1', name: 'Updated Product', priceInt: 2000 };
      mockProductsService.update.mockResolvedValue(mockProduct);

      const result = await controller.update(payload);

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.update).toHaveBeenCalledWith(payload.id, payload.dto);
      expect(mockProductsService.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('should call service.delete with correct id', async () => {
      const id = 'prod-1';
      const mockResponse = { success: true, id: 'prod-1' };
      mockProductsService.delete.mockResolvedValue(mockResponse);

      const result = await controller.delete(id);

      expect(result).toEqual(mockResponse);
      expect(mockProductsService.delete).toHaveBeenCalledWith(id);
      expect(mockProductsService.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('decrementStock', () => {
    it('should call service.decrementStock with correct payload', async () => {
      const payload = { productId: 'prod-1', quantity: 2 };
      const mockProduct = { id: 'prod-1', stock: 8 };
      mockProductsService.decrementStock.mockResolvedValue(mockProduct);

      const result = await controller.decrementStock(payload);

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.decrementStock).toHaveBeenCalledWith(payload.productId, payload.quantity);
      expect(mockProductsService.decrementStock).toHaveBeenCalledTimes(1);
    });
  });

  describe('incrementStock', () => {
    it('should call service.incrementStock with correct payload', async () => {
      const payload = { productId: 'prod-1', quantity: 2 };
      const mockProduct = { id: 'prod-1', stock: 12 };
      mockProductsService.incrementStock.mockResolvedValue(mockProduct);

      const result = await controller.incrementStock(payload);

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.incrementStock).toHaveBeenCalledWith(payload.productId, payload.quantity);
      expect(mockProductsService.incrementStock).toHaveBeenCalledTimes(1);
    });
  });

  describe('adminCreate', () => {
    it('should call service.adminCreate with correct dto', async () => {
      const dto = {
        name: 'Admin Product',
        priceInt: 5000,
        categoryId: 'cat-1',
        sku: 'SKU-ADMIN',
        slug: 'admin-product',
      };
      const mockProduct = { id: 'prod-1', ...dto };
      mockProductsService.adminCreate.mockResolvedValue(mockProduct);

      const result = await controller.adminCreate(dto);

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.adminCreate).toHaveBeenCalledWith(dto);
      expect(mockProductsService.adminCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('adminUpdate', () => {
    it('should call service.adminUpdate with correct payload', async () => {
      const payload = {
        id: 'prod-1',
        dto: { name: 'Updated Admin Product', priceInt: 7000 },
      };
      const mockProduct = { id: 'prod-1', name: 'Updated Admin Product', priceInt: 7000 };
      mockProductsService.adminUpdate.mockResolvedValue(mockProduct);

      const result = await controller.adminUpdate(payload);

      expect(result).toEqual(mockProduct);
      expect(mockProductsService.adminUpdate).toHaveBeenCalledWith(payload.id, payload.dto);
      expect(mockProductsService.adminUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('adminDelete', () => {
    it('should call service.adminDelete with correct id', async () => {
      const id = 'prod-1';
      const mockResponse = { success: true, id: 'prod-1' };
      mockProductsService.adminDelete.mockResolvedValue(mockResponse);

      const result = await controller.adminDelete(id);

      expect(result).toEqual(mockResponse);
      expect(mockProductsService.adminDelete).toHaveBeenCalledWith(id);
      expect(mockProductsService.adminDelete).toHaveBeenCalledTimes(1);
    });
  });
});
