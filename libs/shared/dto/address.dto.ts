import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddressCreateDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  street: string;

  @IsNotEmpty()
  @IsString()
  ward: string;

  @IsNotEmpty()
  @IsString()
  district: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class AddressUpdateDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class AddressListByUserDto {
  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class AddressSetDefaultDto {
  @IsNotEmpty()
  @IsString()
  addressId: string;

  @IsNotEmpty()
  @IsString()
  userId: string;
}
