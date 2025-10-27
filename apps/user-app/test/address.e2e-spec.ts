import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { UserAppModule } from '../src/user-app.module';
import { PrismaService } from '@user-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import { AddressCreateDto, AddressUpdateDto, AddressSetDefaultDto } from '@shared/dto/address.dto';
import { RegisterDto } from '@shared/dto/auth.dto';
import { firstValueFrom } from 'rxjs';

// Helper function to assert NATS RpcException errors
const expectRpcError = async (
  promise: Promise<unknown>,
  expectedMessage?: string,
): Promise<void> => {
  try {
    await promise;
    throw new Error('Expected RpcException but got success');
  } catch (error: unknown) {
    expect(error).toBeDefined();
    if (expectedMessage) {
      const err = error as Record<string, unknown>;
      const msg =
        (typeof err.message === 'string' ? err.message : '') ||
        (typeof err.msg === 'string' ? err.msg : '') ||
        '';
      expect(msg).toContain(expectedMessage);
    }
  }
};

describe('AddressController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        UserAppModule,
        ClientsModule.register([
          {
            name: 'USER_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
            },
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL ?? 'nats://localhost:4223'],
        queue: 'address-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('USER_SERVICE_CLIENT');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await client.connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.address.deleteMany({});
    await prisma.user.deleteMany({});
    await client.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database trước mỗi test
    await prisma.address.deleteMany({});
    await prisma.user.deleteMany({});

    // Tạo test user cho mỗi test
    const registerDto: RegisterDto = {
      email: `address-test-${Date.now()}@example.com`,
      password: 'Test@123456',
      fullName: 'Address Test User',
    };

    const authResult = await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));
    testUserId = authResult.user.sub;
  });

  describe('ADDRESS.CREATE', () => {
    it('should create a new address successfully', async () => {
      const createDto: AddressCreateDto = {
        fullName: 'Nguyễn Văn A',
        phone: '0912345678',
        city: 'Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường Bến Nghé',
        street: '123 Nguyễn Huệ',
        isDefault: false,
      };

      const result = await firstValueFrom(
        client.send(EVENTS.ADDRESS.CREATE, { userId: testUserId, dto: createDto }),
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.fullName).toBe(createDto.fullName);
      expect(result.phone).toBe(createDto.phone);
      expect(result.city).toBe(createDto.city);
      // Địa chỉ đầu tiên tự động là default dù client set false
      expect(result.isDefault).toBe(true);
    });

    it('should set first address as default automatically', async () => {
      const createDto: AddressCreateDto = {
        fullName: 'First Address',
        phone: '0912345678',
        city: 'Hà Nội',
        district: 'Hoàn Kiếm',
        ward: 'Hàng Bài',
        street: '10 Phố Huế',
        isDefault: false,
      };

      const result = await firstValueFrom(
        client.send(EVENTS.ADDRESS.CREATE, { userId: testUserId, dto: createDto }),
      );

      // Địa chỉ đầu tiên sẽ tự động trở thành default
      expect(result.isDefault).toBe(true);
    });

    it('should throw error when userId not found', async () => {
      const createDto: AddressCreateDto = {
        fullName: 'Test Address',
        phone: '0912345678',
        city: 'Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường 1',
        street: 'Test Street',
        isDefault: false,
      };

      await expectRpcError(
        firstValueFrom(
          client.send(EVENTS.ADDRESS.CREATE, { userId: 'non-existent-user-id', dto: createDto }),
        ),
        'không tồn tại',
      );
    });
  });

  describe('ADDRESS.LIST_BY_USER', () => {
    beforeEach(async () => {
      // Tạo nhiều addresses cho test
      await prisma.address.createMany({
        data: [
          {
            userId: testUserId,
            fullName: 'Address 1',
            phone: '0912345678',
            city: 'Hồ Chí Minh',
            district: 'Quận 1',
            ward: 'Phường 1',
            street: 'Street 1',
            isDefault: true,
          },
          {
            userId: testUserId,
            fullName: 'Address 2',
            phone: '0912345679',
            city: 'Hà Nội',
            district: 'Hoàn Kiếm',
            ward: 'Hàng Bài',
            street: 'Street 2',
            isDefault: false,
          },
        ],
      });
    });

    it('should list all addresses for a user', async () => {
      const result = await firstValueFrom(
        client.send(EVENTS.ADDRESS.LIST_BY_USER, { userId: testUserId }),
      );

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2);
      expect(result[0].fullName).toBeDefined();
    });

    it('should return empty array for user with no addresses', async () => {
      // Tạo user mới không có addresses
      const newUserDto: RegisterDto = {
        email: `no-address-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'No Address User',
      };
      const newUser = await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, newUserDto));

      const result = await firstValueFrom(
        client.send(EVENTS.ADDRESS.LIST_BY_USER, { userId: newUser.user.sub }),
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(0);
    });
  });

  describe('ADDRESS.UPDATE', () => {
    let addressId: string;

    beforeEach(async () => {
      // Tạo address để test update
      const createDto: AddressCreateDto = {
        fullName: 'Original Name',
        phone: '0912345678',
        city: 'Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường 1',
        street: 'Original Street',
        isDefault: false,
      };

      const created = await firstValueFrom(
        client.send(EVENTS.ADDRESS.CREATE, { userId: testUserId, dto: createDto }),
      );
      addressId = created.id;
    });

    it('should update address successfully', async () => {
      const updateDto: AddressUpdateDto = {
        fullName: 'Updated Name',
        phone: '0987654321',
        street: 'Updated Street',
      };

      const result = await firstValueFrom(
        client.send(EVENTS.ADDRESS.UPDATE, { id: addressId, dto: updateDto }),
      );

      expect(result.fullName).toBe('Updated Name');
      expect(result.phone).toBe('0987654321');
      expect(result.street).toBe('Updated Street');
      expect(result.city).toBe('Hồ Chí Minh'); // Không đổi
    });

    it('should throw error when updating non-existent address', async () => {
      const updateDto: AddressUpdateDto = {
        fullName: 'Updated Name',
      };

      await expectRpcError(
        firstValueFrom(
          client.send(EVENTS.ADDRESS.UPDATE, { id: 'non-existent-id', dto: updateDto }),
        ),
        'không tồn tại',
      );
    });
  });

  describe('ADDRESS.SET_DEFAULT', () => {
    let address1Id: string;
    let address2Id: string;

    beforeEach(async () => {
      // Tạo 2 addresses
      const addr1 = await prisma.address.create({
        data: {
          userId: testUserId,
          fullName: 'Address 1',
          phone: '0912345678',
          city: 'HCM',
          district: 'Q1',
          ward: 'P1',
          street: 'St1',
          isDefault: true,
        },
      });

      const addr2 = await prisma.address.create({
        data: {
          userId: testUserId,
          fullName: 'Address 2',
          phone: '0912345679',
          city: 'HN',
          district: 'HK',
          ward: 'HB',
          street: 'St2',
          isDefault: false,
        },
      });

      address1Id = addr1.id;
      address2Id = addr2.id;
    });

    it('should set new default address and unset old default', async () => {
      const setDefaultDto: AddressSetDefaultDto = {
        userId: testUserId,
        addressId: address2Id,
      };

      const result = await firstValueFrom(client.send(EVENTS.ADDRESS.SET_DEFAULT, setDefaultDto));

      expect(result.id).toBe(address2Id);
      expect(result.isDefault).toBe(true);

      // Verify address 1 không còn là default
      const addr1 = await prisma.address.findUnique({
        where: { id: address1Id },
      });
      expect(addr1?.isDefault).toBe(false);
    });

    it('should throw error when setting default for non-existent address', async () => {
      const setDefaultDto: AddressSetDefaultDto = {
        userId: testUserId,
        addressId: 'non-existent-id',
      };

      await expectRpcError(
        firstValueFrom(client.send(EVENTS.ADDRESS.SET_DEFAULT, setDefaultDto)),
        'không tồn tại',
      );
    });
  });

  describe('ADDRESS.DELETE', () => {
    let addressId: string;
    let deleteTestUserId: string;

    beforeEach(async () => {
      // Clean database
      await prisma.address.deleteMany({});
      await prisma.user.deleteMany({});

      // Tạo user mới cho delete tests
      const registerDto: RegisterDto = {
        email: `delete-test-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Delete Test User',
      };
      const authResult = await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));
      deleteTestUserId = authResult.user.sub;

      // Tạo address để test delete
      const created = await prisma.address.create({
        data: {
          userId: deleteTestUserId,
          fullName: 'To Delete',
          phone: '0912345678',
          city: 'HCM',
          district: 'Q1',
          ward: 'P1',
          street: 'St1',
          isDefault: false,
        },
      });
      addressId = created.id;
    });

    it('should delete address successfully', async () => {
      const result = await firstValueFrom(client.send(EVENTS.ADDRESS.DELETE, addressId));

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain('xóa');

      // Verify trong database
      const deleted = await prisma.address.findUnique({
        where: { id: addressId },
      });
      expect(deleted).toBeNull();
    });

    it('should throw error when deleting non-existent address', async () => {
      await expectRpcError(
        firstValueFrom(client.send(EVENTS.ADDRESS.DELETE, 'non-existent-id')),
        'không tồn tại',
      );
    });

    it('should auto-assign new default when deleting default address with other addresses', async () => {
      // Tạo user mới cho test này
      const registerDto: RegisterDto = {
        email: `default-delete-test-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Default Delete Test User',
      };
      const authResult = await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));
      const userId = authResult.user.sub;

      // Tạo 2 addresses, 1 default
      const defaultAddr = await prisma.address.create({
        data: {
          userId,
          fullName: 'Default Address',
          phone: '0912345678',
          city: 'HCM',
          district: 'Q1',
          ward: 'P1',
          street: 'St1',
          isDefault: true,
        },
      });

      const nonDefaultAddr = await prisma.address.create({
        data: {
          userId,
          fullName: 'Non-default Address',
          phone: '0912345679',
          city: 'HN',
          district: 'HK',
          ward: 'HB',
          street: 'St2',
          isDefault: false,
        },
      });

      // Xóa địa chỉ default - should succeed and auto-assign new default
      const result = await firstValueFrom(client.send(EVENTS.ADDRESS.DELETE, defaultAddr.id));

      expect(result.success).toBe(true);

      // Verify địa chỉ còn lại trở thành default
      const remainingAddr = await prisma.address.findUnique({
        where: { id: nonDefaultAddr.id },
      });
      expect(remainingAddr?.isDefault).toBe(true);
    });
  });
});
