/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { UserAppModule } from '../src/user-app.module';
import { PrismaService } from '@user-app/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import { CreateUserDto, UpdateUserDto, UserRole } from '@shared/dto/user.dto';
import { firstValueFrom } from 'rxjs';

describe('UsersController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;

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
        queue: 'user-app-test',
      },
    });

    await app.listen();
    client = moduleFixture.get('USER_SERVICE_CLIENT');
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await client.connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({});
    await client.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database trước mỗi test để đảm bảo tính độc lập
    await prisma.user.deleteMany({});
  });

  describe('User CRUD Operations', () => {
    it('should create a new user', async () => {
      const createDto: CreateUserDto = {
        email: `test-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Test User',
        phone: '0123456789',
        role: UserRole.CUSTOMER,
      };

      const result = await firstValueFrom(client.send(EVENTS.USER.CREATE, createDto));

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBe(createDto.email);
      expect(result.fullName).toBe(createDto.fullName);
      expect(result.role).toBe(UserRole.CUSTOMER);
      expect(result.passwordHash).toBeUndefined(); // Không trả về password
    });

    it('should throw error when creating user with duplicate email', async () => {
      const createDto: CreateUserDto = {
        email: 'duplicate@example.com',
        password: 'Test@123456',
        fullName: 'Test User',
        role: UserRole.CUSTOMER,
      };

      // Tạo user đầu tiên
      await firstValueFrom(client.send(EVENTS.USER.CREATE, createDto));

      // Thử tạo user với email trùng - expect error
      try {
        await firstValueFrom(client.send(EVENTS.USER.CREATE, createDto));
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Email already exists');
      }
    });

    it('should find user by ID', async () => {
      // Tạo user trước
      const createDto: CreateUserDto = {
        email: `find-by-id-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Find By ID Test',
        role: UserRole.CUSTOMER,
      };
      const created = await firstValueFrom(client.send(EVENTS.USER.CREATE, createDto));

      const result = await firstValueFrom(client.send(EVENTS.USER.FIND_BY_ID, created.id));

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.email).toBeDefined();
      expect(result.passwordHash).toBeUndefined();
    });

    it('should throw NotFoundException when user ID not found', async () => {
      try {
        await firstValueFrom(client.send(EVENTS.USER.FIND_BY_ID, 'non-existent-id'));
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should find user by email', async () => {
      const createDto: CreateUserDto = {
        email: `find-by-email-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Find By Email Test',
        role: UserRole.CUSTOMER,
      };
      const created = await firstValueFrom(client.send(EVENTS.USER.CREATE, createDto));

      const result = await firstValueFrom(client.send(EVENTS.USER.FIND_BY_EMAIL, created.email));

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.email).toBe(created.email);
    });

    it('should throw NotFoundException when email not found', async () => {
      try {
        await firstValueFrom(client.send(EVENTS.USER.FIND_BY_EMAIL, 'nonexistent@example.com'));
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should update user', async () => {
      const createDto: CreateUserDto = {
        email: `update-test-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Original Name',
        phone: '0123456789',
        role: UserRole.CUSTOMER,
      };
      const created = await firstValueFrom(client.send(EVENTS.USER.CREATE, createDto));

      const updateDto: UpdateUserDto = {
        fullName: 'Updated User Name',
        phone: '0987654321',
      };

      const result = await firstValueFrom(client.send(EVENTS.USER.UPDATE, { id: created.id, dto: updateDto }));

      expect(result).toBeDefined();
      expect(result.fullName).toBe(updateDto.fullName);
      expect(result.phone).toBe(updateDto.phone);
      expect(result.email).toBe(created.email); // Email không đổi
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      const updateDto: UpdateUserDto = {
        fullName: 'Updated Name',
      };

      try {
        await firstValueFrom(client.send(EVENTS.USER.UPDATE, { id: 'non-existent-id', dto: updateDto }));
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should list users with pagination', async () => {
      // Tạo nhiều users để test pagination
      await prisma.user.createMany({
        data: [
          {
            email: 'list-user1@example.com',
            passwordHash: 'hashed_password',
            fullName: 'List User 1',
            role: 'CUSTOMER',
          },
          {
            email: 'list-user2@example.com',
            passwordHash: 'hashed_password',
            fullName: 'List User 2',
            role: 'CUSTOMER',
          },
          {
            email: 'list-admin@example.com',
            passwordHash: 'hashed_password',
            fullName: 'List Admin',
            role: 'ADMIN',
          },
        ],
      });

      const result = await firstValueFrom(client.send(EVENTS.USER.LIST, { page: 1, pageSize: 10 }));

      expect(result).toBeDefined();
      expect(result.users).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.page).toBe(1);
    });

    it('should deactivate user', async () => {
      const createDto: CreateUserDto = {
        email: `deactivate-test-${Date.now()}@example.com`,
        password: 'Test@123456',
        fullName: 'Deactivate Test',
        role: UserRole.CUSTOMER,
      };
      const created = await firstValueFrom(client.send(EVENTS.USER.CREATE, createDto));

      const result = await firstValueFrom(client.send(EVENTS.USER.DEACTIVATE, created.id));

      expect(result).toBeDefined();
      expect(result.message).toContain('deactivated');

      // Verify trong database
      const dbUser = await prisma.user.findUnique({
        where: { id: created.id },
      });
      expect(dbUser?.isActive).toBe(false);
    });

    it('should throw NotFoundException when deactivating non-existent user', async () => {
      try {
        await firstValueFrom(client.send(EVENTS.USER.DEACTIVATE, 'non-existent-id'));
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });
  });
});
