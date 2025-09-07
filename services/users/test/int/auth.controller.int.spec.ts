import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../../src/auth.controller';
import { AuthService } from '../../src/auth.service';
import { PrismaService } from '../../src/prisma.service';

describe('AuthController (int with mocked Prisma)', () => {
  let app: INestApplication;
  const prismaMock = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    tenant: { create: jest.fn() },
    authCredential: { create: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(prismaMock)),
  } as any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/auth/signup returns 201 payload', async () => {
    (prismaMock.user.findUnique as any).mockResolvedValueOnce(null);
    (prismaMock.tenant.create as any).mockResolvedValue({ id: 't1', name: 'Acme' });
    (prismaMock.user.create as any).mockResolvedValue({ id: 'u1', tenantId: 't1', email: 'a@b.com', role: 'owner' });
    (prismaMock.authCredential.create as any).mockResolvedValue({ id: 'c1' });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email: 'a@b.com', password: 'password123', tenantName: 'Acme' });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe('u1');
    expect(res.body.tenantId).toBe('t1');
    expect(typeof res.body.token).toBe('string');
  });

  it('POST /v1/auth/login returns 200 payload', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('password123', 10);
    (prismaMock.user.findUnique as any).mockResolvedValue({ id: 'u1', tenantId: 't1', email: 'a@b.com', role: 'owner' });
    (prismaMock.authCredential.findUnique as any).mockResolvedValue({ userId: 'u1', passwordHash: hash });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('u1');
    expect(res.body.tenantId).toBe('t1');
    expect(typeof res.body.token).toBe('string');
  });
});

