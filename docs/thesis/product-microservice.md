# Tài Liệu Kỹ Thuật: Product Microservice

> Tài liệu luận văn tốt nghiệp - Hệ thống E-commerce Microservices  
> Service: Product App (`apps/product-app`)  
> Ngày phân tích: 31/10/2025  
> Phạm vi: Quản lý sản phẩm, danh mục, tìm kiếm/lọc, tích hợp NATS với Gateway

---

## 📋 Mục Lục

1. [Tổng Quan Microservice](#1-tổng-quan-microservice)
2. [Kiến Trúc và Thiết Kế](#2-kiến-trúc-và-thiết-kế)
3. [Cơ Sở Dữ Liệu](#3-cơ-sở-dữ-liệu)
4. [Products Module](#4-products-module)
5. [Categories Module](#5-categories-module)
6. [NATS Integration & Gateway](#6-nats-integration--gateway)
7. [Error Handling](#7-error-handling)
8. [Security Model](#8-security-model)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment & Configuration](#10-deployment--configuration)
11. [Hiệu Năng & Mở Rộng](#11-hiệu-năng--mở-rộng)
12. [Kết Luận](#12-kết-luận)

---

## 1. Tổng Quan Microservice

### 1.1. Mục Đích và Vai Trò

Product Microservice chịu trách nhiệm quản lý domain sản phẩm và danh mục của hệ thống:

- Product Management: CRUD sản phẩm, trường tùy biến (`attributes`), ảnh (`imageUrls`), 3D model (`model3dUrl`)
- Category Management: Danh mục phân cấp (self-relation parent/children)
- Product Listing & Search: Tìm kiếm theo tên/mô tả/SKU, lọc theo danh mục (slug), khoảng giá, phân trang
- Stock Field: Lưu trữ số lượng tồn kho; tích hợp giảm/tăng tồn kho từ Order Service (qua NATS)

### 1.2. Vị Trí Trong Kiến Trúc Microservices

```
Client (Web/Mobile)
   │ REST
   ▼
┌──────────────┐        NATS req/rep         ┌─────────────────┐
│  API Gateway │ ───────────────────────────▶ │  NATS Broker    │
└──────┬───────┘ ◀─────────────────────────── └───────┬─────────┘
       │                                              │
       │                                              ▼
       │                                        ┌──────────────┐
       │                                        │ PRODUCT APP  │
       │                                        │ (NestJS RPC) │
       │                                        └──────┬───────┘
       │                                               │
       │                                        PostgreSQL (product_db)
       ▼
Other Services: ORDER (validate stock), CART, PAYMENT, USER
```

### 1.3. Tech Stack

| Component          | Technology      | Version |
| ------------------ | --------------- | ------- |
| Framework          | NestJS          | v11.x   |
| Runtime            | Node.js         | v20+    |
| Language           | TypeScript      | v5.x    |
| Message Broker     | NATS            | v2.29   |
| Database           | PostgreSQL      | v16     |
| ORM                | Prisma          | v6.x    |
| Validation         | class-validator | -       |
| Testing            | Jest            | v30     |

### 1.4. Cấu Hình Kết Nối

```
NATS URL: nats://localhost:4222
Queue Group: product-app
Database: postgresql://product:***@localhost:5434/product_db
HTTP Port: N/A (microservice RPC qua NATS, không mở HTTP)
```

---

## 2. Kiến Trúc và Thiết Kế

### 2.1. Layered Architecture (RPC over NATS)

```
┌─────────────────────────────────────────────────────────┐
│                   NATS Transport Layer                   │
│                 (Message Pattern Handlers)               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Controller Layer                         │
│     ProductsController   •   CategoriesController        │
└────────────────────┬────────────────────────────────────┘
                     │ Delegates business logic
┌────────────────────▼────────────────────────────────────┐
│                  Service Layer                           │
│     ProductsService     •     CategoriesService          │
│  (validators • mappers • query builders)                 │
└────────────────────┬────────────────────────────────────┘
                     │ Prisma Client
┌────────────────────▼────────────────────────────────────┐
│               Data Access Layer (Prisma)                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                PostgreSQL Database (product_db)          │
└─────────────────────────────────────────────────────────┘
```

### 2.2. Bootstrap & Global Policies

Trích: `apps/product-app/src/main.ts`

```ts
const app = await NestFactory.createMicroservice<MicroserviceOptions>(ProductAppModule, {
  transport: Transport.NATS,
  options: { servers: [process.env.NATS_URL ?? 'nats://localhost:4222'], queue: 'product-app' },
});

app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
app.useGlobalFilters(new AllRpcExceptionsFilter());
await app.listen();
```

Quyết định thiết kế:

- Queue-based consumption cho horizontal scaling
- Validation pipe toàn cục đảm bảo payload hợp lệ
- Centralized error handling qua `AllRpcExceptionsFilter`
- Separation of concerns: mapper/validator/query-builder giảm độ phức tạp service

### 2.3. Module Structure

Trích: `apps/product-app/src/product-app.module.ts`

```ts
@Module({
  imports: [ProductsModule, CategoriesModule],
  providers: [PrismaService],
})
export class ProductAppModule {}
```

---

## 3. Cơ Sở Dữ Liệu

### 3.1. Prisma Schema (Trích yếu)

`apps/product-app/prisma/schema.prisma`

```prisma
model Category {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  parentId    String?
  children    Category[] @relation("CategoryToCategory")
  parent      Category?  @relation("CategoryToCategory", fields: [parentId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  products    Product[]
}

model Product {
  id         String   @id @default(cuid())
  sku        String   @unique
  name       String
  slug       String   @unique
  priceInt   Int
  stock      Int      @default(0)
  description String?
  imageUrls  String[]
  categoryId String?
  attributes Json?
  model3dUrl String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  category   Category? @relation(fields: [categoryId], references: [id])
}
```

### 3.2. Quan Hệ & Ràng Buộc

```mermaid
erDiagram
  Category ||--o{ Category : has_children
  Category ||--o{ Product  : contains

  Category {
    string id PK
    string name
    string slug UK
    string description
    string parentId FK
    datetime createdAt
    datetime updatedAt
  }

  Product {
    string id PK
    string sku UK
    string name
    string slug UK
    int    priceInt
    int    stock
    string description
    string[] imageUrls
    string categoryId FK
    json   attributes
    string model3dUrl
    datetime createdAt
    datetime updatedAt
  }
```

Nguyên tắc thiết kế:

- Database per service; dữ liệu tách biệt hoàn toàn
- Unique constraints: `Product.sku`, `Product.slug`, `Category.slug`
- Self-relation cho danh mục (parent/children), cấm vòng lặp

### 3.3. Mẫu Truy Vấn & Tối Ưu

- Product listing: tìm kiếm case-insensitive theo `name|description|sku`, lọc theo `categorySlug`, khoảng giá `minPriceInt..maxPriceInt` (query builder)
- Include quan hệ `category` khi cần hiển thị chi tiết
- Phân trang: `page`, `pageSize`, tính `totalPages`
- Khuyến nghị index: `Product.slug`, `Product.sku`, `Product.categoryId`, `Category.slug`

### 3.4. Migration

```bash
cd apps/product-app
npx prisma migrate dev --name add_new_fields
pnpm db:gen:all  # hoặc npx prisma generate
npx prisma migrate deploy  # production
```

---

## 4. Products Module

### 4.1. Event Patterns (NATS)

- `product.getById` `→` ProductIdDto → ProductResponse
- `product.getByIds` `→` ProductIdsDto → ProductResponse[]
- `product.getBySlug` `→` ProductSlugDto → ProductResponse
- `product.list` `→` ProductListQueryDto → PaginatedProductsResponse
- `product.create` `→` ProductCreateDto → ProductResponse
- `product.update` `→` `{ id, dto: ProductUpdateDto }` → ProductResponse
- `product.delete` `→` `string (id)` → `{ success, id }`

Lưu ý: Các pattern `product.incrementStock` và `product.decrementStock` đã được định nghĩa trong shared events để tích hợp với Order Service; hiện chưa được triển khai trong service này (đề xuất ở mục 11).

### 4.2. Business Logic Highlights

- Uniqueness: Kiểm tra trùng `sku`/`slug` khi tạo; khi cập nhật chỉ check `slug` nếu đổi giá trị
- Category validation: Xác minh `categoryId` tồn tại trước khi gán/đổi
- Mapper: Chuẩn hóa entity → API response (ẩn chi tiết nội bộ, ép kiểu `attributes` JSON)
- Query Builder: Gom logic filter (search, category, price range) và pagination

### 4.3. Code Trích Yếu

Tạo sản phẩm (`apps/product-app/src/products/products.service.ts`):

```ts
await this.validator.validateUniqueSKUAndSlug(dto.sku, dto.slug);
await this.validator.validateCategoryExists(dto.categoryId);
const product = await this.prisma.product.create({ data: { ... }, include: { category: true } });
return this.mapper.mapToProductResponse(product);
```

Liệt kê sản phẩm (search + lọc + phân trang):

```ts
const where = this.queryBuilder.buildWhereClause(query);
const { skip, take } = this.queryBuilder.getPaginationParams(query);
const [products, total] = await Promise.all([
  this.prisma.product.findMany({ where, include: { category: true }, skip, take, orderBy: { createdAt: 'desc' } }),
  this.prisma.product.count({ where }),
]);
```

---

## 5. Categories Module

### 5.1. Event Patterns (NATS)

- `category.getById` `→` CategoryIdDto → CategoryResponse (kèm parent/children)
- `category.getBySlug` `→` CategorySlugDto → CategoryResponse
- `category.list` `→` CategoryListQueryDto → PaginatedCategoriesResponse
- `category.create` `→` CategoryCreateDto → CategoryResponse
- `category.update` `→` `{ id, dto: CategoryUpdateDto }` → CategoryResponse
- `category.delete` `→` `string (id)` → `{ success, id }`

### 5.2. Business Rules

- Unique slug: `409 Conflict` nếu trùng slug
- Parent constraints: Cấm tự tham chiếu; cấm vòng lặp (kiểm tra chain parent); xác minh parent tồn tại
- Delete guard: Không cho xóa nếu còn children hoặc còn products gắn với category

### 5.3. Code Trích Yếu

Kiểm tra vòng lặp danh mục:

```ts
async validateParentUpdate(id: string, newParentId?: string) { /* ... */ }
private async checkCircularReference(potentialParentId: string, categoryId: string) { /* ... */ }
```

---

## 6. NATS Integration & Gateway

### 6.1. Mapping với API Gateway

Gateway routes (tham chiếu):

- `GET /products` → `product.list`
- `GET /products/slug/:slug` → `product.getBySlug` (ưu tiên trước `:id` để tránh conflict)
- `GET /products/:id` → `product.getById`
- `POST /products` (admin) → `product.create`
- `PUT /products/:id` (admin) → `product.update`
- `DELETE /products/:id` (admin) → `product.delete`
- `GET /categories` → `category.list`
- `GET /categories/slug/:slug` → `category.getBySlug`
- `GET /categories/:id` → `category.getById`
- `POST /categories` (admin) → `category.create`
- `PUT /categories/:id` (admin) → `category.update`
- `DELETE /categories/:id` (admin) → `category.delete`

### 6.2. Luồng Tìm Kiếm Sản Phẩm

```mermaid
sequenceDiagram
  participant Client
  participant Gateway
  participant NATS
  participant Product

  Client->>Gateway: GET /products?q=sofa&categorySlug=living&minPriceInt=100000
  Gateway->>NATS: product.list { search, categorySlug, minPriceInt, ... }
  NATS->>Product: product.list
  Product->>Product: buildWhereClause + pagination
  Product-->>NATS: { products, total, page, pageSize, totalPages }
  NATS-->>Gateway: PaginatedProductsResponse
  Gateway-->>Client: 200 OK + JSON
```

---

## 7. Error Handling

- Global `AllRpcExceptionsFilter` chuẩn hóa lỗi RPC (statusCode + message)
- Patterns phổ biến:
  - 404 Not Found: Sản phẩm/danh mục không tồn tại
  - 409 Conflict: Trùng `sku`/`slug`
  - 400 Bad Request: Vi phạm ràng buộc business (parent invalid, xóa category còn children/products, ...)
- Log lỗi chi tiết tại service và convert sang định dạng RPC cho Gateway ánh xạ → HTTP

---

## 8. Security Model

- Perimeter security tại Gateway (JWT verify + RBAC). Product service tin cậy payload từ Gateway, không tự verify JWT
- Không expose HTTP; chỉ lắng nghe NATS → giảm bề mặt tấn công trực tiếp

---

## 9. Testing Strategy

- E2E tests: `apps/product-app/test/products.e2e-spec.ts`, `apps/product-app/test/categories.e2e-spec.ts`
  - Tạo → Lấy theo ID/slug → Liệt kê (pagination) → Cập nhật → Xóa
  - Kiểm tra mapping `EVENTS.*` và payload
- Unit/integration cho service, validator, query builder, mapper

---

## 10. Deployment & Configuration

### 10.1. Biến Môi Trường (trích `.env.example`)

```
NATS_URL=nats://localhost:4222
DATABASE_URL_PRODUCT=postgresql://product:product_password@localhost:5434/product_db?schema=public
```

### 10.2. Chạy Service

```
pnpm run start:dev product-app   # phát triển (qua NATS)
pnpm run build product-app && pnpm run start:prod product-app
```

---

## 11. Hiệu Năng & Mở Rộng

- Indexing: `sku`, `slug`, `categoryId` cho truy vấn nhanh; cân nhắc GIN/Trigram cho tìm kiếm nâng cao
- Full-text search: Có thể tích hợp PostgreSQL full-text hoặc công cụ ngoài (Elastic/OpenSearch) nếu nhu cầu search phức tạp
- Caching: Cache danh mục/sản phẩm public (TTL) ở Gateway để giảm tải
- Stock events: Triển khai `product.incrementStock` và `product.decrementStock` để đồng bộ với Order Service (hiện mới định nghĩa ở shared events). Cần bảo đảm idempotency và xử lý cạnh tranh (concurrency) khi cập nhật tồn kho
- Ảnh & 3D model: Lưu trữ tách biệt (object storage), trường `model3dUrl` phục vụ AR features

---

## 12. Kết Luận

Product Microservice hiện thực hóa đầy đủ quản lý sản phẩm và danh mục với mô hình phân lớp rõ ràng, validation mạnh, và tích hợp NATS chuẩn với Gateway. Thiết kế tách mapper/validator/query-builder giúp codebase dễ bảo trì và mở rộng. Để production-ready ở quy mô lớn, nên bổ sung stock event handlers, search/caching nâng cao và chiến lược index phù hợp.

