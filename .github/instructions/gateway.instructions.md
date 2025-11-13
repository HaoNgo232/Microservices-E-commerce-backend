---
applyTo: 'apps/gateway/**/*.ts'
---

# Gateway-Specific Instructions

## Gateway Role

Gateway là single entry point cho toàn bộ hệ thống:

- Nhận HTTP/REST requests từ client
- Verify JWT authentication
- Forward requests qua NATS đến microservices
- Convert NATS responses thành HTTP responses

## Controller Pattern

Gateway controllers PHẢI:

Sử dụng REST decorators (`@Get`, `@Post`, `@Put`, `@Delete`)
Có `@UseGuards(AuthGuard)` cho protected endpoints
Inject NATS clients qua `@Inject('SERVICE_NAME')`
Sử dụng `firstValueFrom` với `timeout` và `retry`
Handle errors và convert thành HTTP exceptions

```typescript
@Controller('users')
export class UsersController {
  constructor(@Inject('USER_SERVICE') private readonly userClient: ClientProxy) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async getProfile(@Request() req) {
    return firstValueFrom(
      this.userClient
        .send(EVENTS.USER.FIND_ONE, {
          userId: req.user.userId,
        })
        .pipe(
          timeout(5000),
          retry({ count: 1, delay: 1000 }),
          catchError(error => {
            throw new HttpException(
              error.message || 'Service unavailable',
              error.statusCode || HttpStatus.SERVICE_UNAVAILABLE,
            );
          }),
        ),
    );
  }
}
```

## Authentication Flow

1. Client gửi JWT trong Authorization header
2. AuthGuard verify JWT với RSA public key
3. Extract userId, email, role từ token payload
4. Attach vào `req.user` object
5. Forward userId trong NATS message payload

```typescript
// AuthGuard extracts user info
request.user = {
  userId: payload.sub,
  email: payload.email,
  role: payload.role,
};

// Controller uses it
this.userClient.send(EVENTS.USER.FIND_ONE, {
  userId: req.user.userId,
});
```

## Error Handling

Convert RPC exceptions sang HTTP exceptions:

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

catchError(error => {
  const statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
  const message = error.message || 'Internal server error';

  throw new HttpException(message, statusCode);
});
```

## NATS Client Configuration

Clients được configure trong `GatewayClientsModule`:

```typescript
ClientsModule.register([
  {
    name: 'USER_SERVICE',
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL || 'nats://localhost:4222'],
    },
  },
]);
```

## Best Practices

- Gateway KHÔNG chứa business logic
- Gateway chỉ routing và authentication
- Timeout mặc định: 5000ms (5 seconds)
- Retry count: 1 lần với delay 1000ms
- Luôn log communication errors
- Use BaseController nếu có shared logic

## Authorization

Nếu cần role-based authorization:

```typescript
@Get('admin/users')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async getAllUsers() {
  // Only admin can access
}
```

## Health Checks

Gateway có health endpoints:

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
