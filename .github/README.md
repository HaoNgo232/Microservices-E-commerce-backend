# GitHub Copilot Custom Instructions

Thư mục này chứa custom instructions cho GitHub Copilot để giúp AI hiểu rõ hơn về project và cung cấp suggestions chính xác hơn.

## Cấu Trúc

```
.github/
├── copilot-instructions.md        # Repository-wide instructions
├── instructions/                  # Path-specific instructions
│   ├── gateway.instructions.md
│   ├── microservices.instructions.md
│   ├── shared-library.instructions.md
│   └── tests.instructions.md
└── README.md                      # File này
```

## Các Loại Instructions

### 1. Repository-wide Instructions

**File**: `copilot-instructions.md`

Áp dụng cho **tất cả requests** trong repository này. Chứa:

- Project overview
- Architecture patterns
- Tech stack
- Coding standards
- Common conventions
- Security guidelines

### 2. Path-specific Instructions

**Location**: `instructions/*.instructions.md`

Áp dụng cho **các files cụ thể** dựa trên path pattern trong frontmatter.

#### `gateway.instructions.md`

- **Áp dụng cho**: `apps/gateway/**/*.ts`
- **Nội dung**: REST API patterns, AuthGuard usage, NATS client communication

#### `microservices.instructions.md`

- **Áp dụng cho**: Tất cả microservice apps
- **Nội dung**: MessagePattern usage, Prisma best practices, RPC exceptions

#### `shared-library.instructions.md`

- **Áp dụng cho**: `libs/shared/**/*.ts`
- **Nội dung**: DTO conventions, shared types, import aliases

#### `tests.instructions.md`

- **Áp dụng cho**: `**/*.spec.ts`, `**/*.e2e-spec.ts`
- **Nội dung**: Testing patterns, mocking, assertions

## Cách SửỤng

### Kích Hoạt Custom Instructions

Custom instructions được **tự động áp dụng** khi bạn sử dụng GitHub Copilot trong VS Code.

### Xác Minh Instructions Đang Hoạt Động

1. Mở Copilot Chat
2. Hỏi một câu hỏi về code
3. Kiểm tra "References" trong response
4. Nếu thấy `.github/copilot-instructions.md` → Instructions đang được sử dụng

### Tắt/Bật Custom Instructions

**Trong VS Code**:

1. Mở Settings (`Cmd/Ctrl + ,`)
2. Tìm "instruction file"
3. Toggle "Code Generation: Use Instruction Files"

## 📖 Ví Dụ Sử Dụng

### Scenario 1: Tạo Gateway Controller Mới

Khi bạn đang code trong `apps/gateway/src/`:

```typescript
// Copilot sẽ suggest với AuthGuard và NATS communication pattern
@Controller('products')
export class ProductsController {
  @Get()
  @UseGuards(AuthGuard) //  Copilot biết phải thêm guard
  async getProducts() {
    return firstValueFrom(
      this.productClient.send(EVENTS.PRODUCT.FIND_ALL, {}).pipe(
        timeout(5000), //  Copilot biết phải có timeout
        retry({ count: 1, delay: 1000 }),
      ),
    );
  }
}
```

### Scenario 2: Tạo Microservice Handler

Khi bạn đang code trong `apps/user-app/src/`:

```typescript
// Copilot sẽ suggest MessagePattern và NO guards
@Controller()
export class UsersController {
  @MessagePattern(EVENTS.USER.FIND_ONE) //  MessagePattern
  async findOne(@Payload() payload: { userId: string }) {
    //  No AuthGuard - Copilot biết microservices trust Gateway
    return this.usersService.findOne(payload.userId);
  }
}
```

### Scenario 3: Tạo DTO

Khi bạn đang code trong `libs/shared/dto/`:

```typescript
// Copilot sẽ suggest với validation decorators
export class CreateProductDto {
  @IsString() //  Copilot tự động thêm validation
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}
```

### Scenario 4: Viết Tests

Khi bạn đang code trong `*.spec.ts`:

```typescript
// Copilot sẽ suggest mocking patterns
describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService, //  Copilot biết phải mock Prisma
          useValue: {
            user: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();
    // ...
  });
});
```

## 🔧 Maintain Custom Instructions

### Khi Nào Cần Update?

Update instructions khi:

- Thêm conventions mới
- Thay đổi architecture patterns
- Update tech stack (libraries, versions)
- Thêm best practices mới
- Phát hiện Copilot đang suggest sai patterns

### Best Practices

1. **Ngắn gọn**: Instructions càng ngắn càng tốt, focus vào patterns quan trọng
2. **Cụ thể**: Đưa ra examples cụ thể thay vì lý thuyết chung chung
3. **Relevant**: Chỉ include info áp dụng cho phần lớn requests
4. **Updated**: Keep instructions sync với actual code

### Testing Instructions

Sau khi update instructions:

1.  Test bằng cách code một feature mới
2.  Verify Copilot suggestions follow conventions
3.  Adjust instructions nếu cần

## 📚 Resources

### Documentation

Xem thêm chi tiết trong:

- [`docs/AI-ASSISTANT-GUIDE.md`](../docs/AI-ASSISTANT-GUIDE.md) - Comprehensive guide
- [`docs/QUICK-REFERENCE.md`](../docs/QUICK-REFERENCE.md) - Quick reference
- [`.cursorrules`](../.cursorrules) - Rules for Cursor AI

### GitHub Copilot Docs

- [Custom Instructions Documentation](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions)
- [Copilot Best Practices](https://docs.github.com/en/copilot/best-practices)

## 🎯 Tips cho Developers

### Maximize Copilot Effectiveness

1. **Write Clear Comments**: Mô tả rõ ràng intent của code
2. **Use Type Annotations**: TypeScript types giúp Copilot hiểu context
3. **Follow Existing Patterns**: Copilot học từ existing code
4. **Ask Specific Questions**: Trong Copilot Chat, hỏi cụ thể thay vì chung chung

### Example Prompts

Good prompts cho Copilot Chat:

```
 "Create a new microservice controller for products with NATS MessagePattern"

 "Write a unit test for UsersService.findOne with Prisma mocking"

 "Generate a CreateProductDto with validation decorators"

 "Implement Gateway endpoint with AuthGuard and NATS communication"
```

Bad prompts:

```
 "Create a controller"  (too vague)

 "Write tests"  (không specific)

 "Add validation"  (thiếu context)
```

## 🤝 Contributing

Nếu bạn phát hiện:

- Copilot suggest patterns không phù hợp với project
- Instructions cần update/clarify
- New patterns cần thêm vào

→ Update files trong `.github/` và test thoroughly!

---

**Last Updated**: October 26, 2025  
**Maintained by**: Backend Team
