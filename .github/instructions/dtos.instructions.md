---
applyTo: 'libs/shared/dto/**/*.dto.ts,apps/*/src/**/*.dto.ts'
---

# DTO Validation Standards

## 🚨 MANDATORY: ALL FIELDS MUST BE VALIDATED

**NO field should exist without decorators.**

### Basic Validation Template

```typescript
export class CreateEntityDto {
  @IsNotEmpty()
  @IsString()
  requiredField: string;

  @IsOptional()
  @IsString()
  optionalField?: string;
}
```

---

## VALIDATION CHECKLIST

When user creates/modifies DTO, **AI MUST CHECK:**

Required fields have `@IsNotEmpty()`  
 Strings have `@IsString()`  
 Numbers have `@IsNumber()` + `@IsPositive()` or `@Min()`  
 Emails have `@IsEmail()`  
 Arrays have `@IsArray()`  
 Nested objects have `@ValidateNested()` + `@Type()`  
 Enums have `@IsEnum()`

---

## 🚫 COMMON MISTAKES TO FLAG

### Missing Validation

```typescript
//  WRONG - FLAG IMMEDIATELY
export class CreateUserDto {
  email: string; // No validation!
  password: string; // No validation!
}

//  CORRECT
export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
}
```

### Missing @Type() for Numbers

```typescript
//  WRONG
export class ProductDto {
  @IsNumber()
  price: number; // Query params come as strings!
}

//  CORRECT
export class ProductDto {
  @IsNumber()
  @Type(() => Number) // Transform string to number
  @IsPositive()
  price: number;
}
```

---

## 💰 SPECIAL: PRICE HANDLING

**ALWAYS store prices as integers (cents):**

```typescript
export class ProductDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  priceInt: number; //  1999 = $19.99
}

//  NEVER use:
// price: number;  // Floating point errors!
```

---

## 🎯 IMMEDIATE FEEDBACK

When user writes DTO without validation:

```
🚨 VALIDATION MISSING

Found unvalidated fields:
- email
- password

💡 Add decorators:
@IsNotEmpty()
@IsEmail()
email: string;

@IsNotEmpty()
@IsString()
password: string;
```
