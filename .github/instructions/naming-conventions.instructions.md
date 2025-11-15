---
applyTo: '**/*.ts,**/*.prisma'
---

# Naming Conventions - Project-Wide Standards

## 🚨 MANDATORY: CONSISTENT NAMING

**Naming is documentation. Make it clear and consistent.**

---

## FILE NAMING

### TypeScript Files

```
 CORRECT
users.service.ts          // Service implementation
users.controller.ts       // Controller
users.service.spec.ts     // Unit tests
users.e2e-spec.ts         // E2E tests
user.dto.ts               // DTOs
user.types.ts             // Type definitions

 WRONG
UsersService.ts           // PascalCase filename
users-service.ts          // Inconsistent separator
user.service.test.ts      // Wrong test suffix
```

### Directories

```
 CORRECT
apps/user-app/            // Kebab-case
libs/shared/              // Kebab-case
apps/user-app/src/users/  // Feature folder

 WRONG
apps/UserApp/             // PascalCase
apps/user_app/            // Snake_case
```

---

## 🎯 TYPESCRIPT NAMING

### Classes

```typescript
//  CORRECT - PascalCase
export class UsersService {}
export class AuthGuard {}
export class PrismaService {}

//  WRONG
export class usersService {}
export class Users_Service {}
```

### Interfaces

```typescript
//  CORRECT - PascalCase with descriptive name
export interface PaymentGateway {}
export interface OrderRepository {}

//  OPTIONAL - I prefix (old convention)
export interface IPaymentGateway {}

//  WRONG
export interface paymentGateway {}
export interface Ipaymentgateway {}
```

### Types

```typescript
//  CORRECT - PascalCase with "Response", "Dto", "Payload" suffix
export type UserResponse = { ... };
export type CreateUserDto = { ... };
export type OrderPayload = { ... };

//  WRONG
export type user = { ... };
export type UserType = { ... };  // Redundant "Type"
```

### Enums

```typescript
//  CORRECT - PascalCase enum, UPPER_SNAKE_CASE values
export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
}

//  WRONG
export enum userRole { ... }
export enum UserRole {
  Admin = 'Admin',      // Not uppercase
  customer = 'customer', // Inconsistent
}
```

### Variables & Functions

```typescript
//  CORRECT - camelCase
const userName = 'John';
let totalAmount = 0;
function calculateTotal() {}
async function fetchUserData() {}

//  WRONG
const UserName = 'John'; // PascalCase
const user_name = 'John'; // Snake_case
function CalculateTotal() {} // PascalCase
```

### Constants

```typescript
//  CORRECT - UPPER_SNAKE_CASE for true constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 10;
const JWT_EXPIRY_SECONDS = 900;

//  CORRECT - camelCase for config objects
const config = {
  apiUrl: process.env.API_URL,
  timeout: 5000,
};

//  WRONG
const maxRetryAttempts = 3; // Should be uppercase
const APIURL = '...'; // Hard to read
```

---

## PRISMA NAMING

### Model Names

```prisma
 CORRECT - PascalCase, singular
model User { }
model Product { }
model OrderItem { }

 WRONG
model users { }          // Lowercase
model Products { }       // Plural
model order_items { }    // Snake_case
```

### Field Names

```prisma
 CORRECT - camelCase
model User {
  id            String
  fullName      String?
  createdAt     DateTime
  isActive      Boolean
  passwordHash  String
}

 WRONG
model User {
  Id           String    // PascalCase
  full_name    String?   // Snake_case
  CreatedAt    DateTime  // PascalCase
}
```

### Special Field Suffixes

```prisma
 CORRECT - Descriptive suffixes
model Product {
  priceInt      Int       // Money in cents
  imageUrls     String[]  // Array
  model3dUrl    String?   // URL
  attributes    Json?     // JSON data
}

model Payment {
  amountInt     Int       // Money
  payload       Json?     // Extended data
}
```

---

## 🎯 DTO NAMING

### DTO Classes

```typescript
//  CORRECT - Descriptive prefix + "Dto" suffix
export class CreateUserDto {}
export class UpdateUserDto {}
export class LoginDto {}
export class UserResponse {} // Response type (not DTO)

//  WRONG
export class UserDto {} // Too generic
export class User {} // Confusing with entity
export class CreateUserRequest {} // "Dto" is standard
```

### Query DTOs

```typescript
//  CORRECT - Descriptive query names
export class ListUsersDto {}
export class ProductListQueryDto {}
export class SearchProductsDto {}

//  WRONG
export class UsersQuery {}
export class GetUsersDto {} // Verb not needed
```

---

## SERVICE & CONTROLLER NAMING

### Services

```typescript
//  CORRECT - Plural entity + "Service"
export class UsersService {}
export class ProductsService {}
export class OrdersService {}

// Specialized services
export class AuthService {}
export class PaymentService {}

//  WRONG
export class UserService {} // Singular (unless specialized)
export class UsersServices {} // Double plural
export class UserBusinessLogic {} // Too verbose
```

### Controllers

```typescript
//  CORRECT - Match service name + "Controller"
export class UsersController {}
export class ProductsController {}
export class AuthController {}

//  WRONG
export class UserController {}
export class UsersControllers {}
```

---

## 🎯 METHOD NAMING

### CRUD Operations

```typescript
//  CORRECT - Standard CRUD names
class UsersService {
  async findById(id: string) { }
  async findByEmail(email: string) { }
  async create(dto: CreateUserDto) { }
  async update(id: string, dto: UpdateUserDto) { }
  async delete(id: string) { }
  async list(query: ListUsersDto) { }
}

//  WRONG
class UsersService {
  async getUserById(id: string) { }    // Redundant "get"
  async createNewUser(dto: ...) { }    // Redundant "New"
  async removeUser(id: string) { }     // Use "delete"
  async fetchUsers() { }               // Use "list"
}
```

### Boolean Methods

```typescript
//  CORRECT - Prefix with "is", "has", "can"
function isActive(user: User): boolean {}
function hasPermission(user: User, action: string): boolean {}
function canAccess(resource: string): boolean {}

//  WRONG
function active(user: User): boolean {} // Not clear
function permission(user: User): boolean {} // Not boolean-like
```

---

## 📊 EVENT NAMING

### NATS Events

```typescript
//  CORRECT - Domain.Action pattern
export const EVENTS = {
  USER: {
    FIND_BY_ID: 'user.findById',
    CREATE: 'user.create',
    UPDATE: 'user.update',
  },
  PRODUCT: {
    GET_BY_SLUG: 'product.getBySlug',
    LIST: 'product.list',
  },
};

//  WRONG
export const EVENTS = {
  USER: {
    GET_USER: 'getUser', // No domain prefix
    user_create: 'user_create', // Snake_case
    FIND: 'find', // Too generic
  },
};
```

---

## 🔧 ENVIRONMENT VARIABLES

```bash
 CORRECT - UPPER_SNAKE_CASE
DATABASE_URL_USER=postgresql://...
JWT_SECRET_KEY=...
JWT_EXPIRES_IN=15m
NATS_URL=nats://localhost:4222

 WRONG
databaseUrlUser=...     # camelCase
database-url-user=...   # Kebab-case
db_url=...              # Abbreviated
```

---

## PACKAGE & MODULE NAMING

### NPM Scripts

```json
{
  "scripts": {
    "dev": "...", //  Short, clear
    "dev:all": "...", //  Namespace with colon
    "test:e2e": "...", //  Test category
    "db:gen:all": "...", //  Multiple namespaces

    "development": "...", //  Too verbose
    "test_e2e": "..." //  Underscore separator
  }
}
```

---

## 🚫 ABBREVIATION RULES

### Acceptable Abbreviations

```typescript
 ALLOWED
dto, id, url, api, db, jwt, ar

 CORRECT USAGE
CreateUserDto
DATABASE_URL_USER
API_KEY
```

### Avoid Over-Abbreviation

```typescript
WRONG;
usr; // Use "user"
prod; // Use "product"
addr; // Use "address"
qty; // Use "quantity"

CORRECT;
(user, product, address, quantity);
```

---

## 📊 AI VALIDATION CHECKLIST

**When user creates files/classes/variables, AI MUST CHECK:**

□ Files are kebab-case
□ Classes are PascalCase
□ Variables/functions are camelCase
□ Constants are UPPER_SNAKE_CASE
□ DTOs end with "Dto" or "Response"
□ Services end with "Service"
□ Tests end with ".spec.ts" or ".e2e-spec.ts"
□ Prisma models are PascalCase singular
□ Events use domain.action pattern

**IMMEDIATE FEEDBACK:**

```
🚨 NAMING CONVENTION VIOLATION

File: UsersService.ts
 Should be: users.service.ts

Class: usersService
 Should be: UsersService

Variable: UserName
 Should be: userName

Enum value: Pending
 Should be: PENDING
```

---

## 🎓 THESIS DEFENSE POINTS

When asked about naming:

- "Consistent naming improves code readability and maintainability"
- "TypeScript conventions follow industry standards (Airbnb, Google)"
- "File naming matches NestJS framework conventions"
- "Descriptive names reduce need for comments"

---

**Remember**: Good names are documentation. Make them count!
