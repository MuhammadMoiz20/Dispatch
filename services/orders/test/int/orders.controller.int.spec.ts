import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { OrdersController } from '../../src/orders.controller';
import { OrdersService } from '../../src/orders.service';
import { PrismaService } from '../../src/prisma.service';
// Import JS build of idempotency middleware directly to avoid package dist resolution
import { idempotencyMiddleware } from '../../../../packages/idempotency/src/index.js';

// Mock messaging to avoid RabbitMQ
jest.mock('@dispatch/messaging', () => ({
  createRabbitMQ: () => ({ publish: jest.fn().mockResolvedValue(undefined) }),
}));

// Mock ioredis used by idempotency middleware with an in-memory store
jest.mock('ioredis', () => {
  const store = new Map<string, string>();
  return class RedisMock {
    url: string;
    constructor(url?: string) {
      this.url = url || 'redis://mock';
    }
    async get(key: string) {
      return store.get(key) || null;
    }
    async set(key: string, value: string) {
      store.set(key, value);
    }
  } as any;
});

describe('OrdersController + Idempotency (int)', () => {
  let app: INestApplication;
  const prismaMock: any = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };
  prismaMock.$transaction = jest.fn((arg: any) => {
    if (typeof arg === 'function') {
      // Execute callback with prismaMock to mimic Prisma
      return arg(prismaMock);
    }
    if (Array.isArray(arg)) {
      // Array form should resolve each promise/callable
      return Promise.all(arg);
    }
    return Promise.resolve(arg);
  });

  const token = jwt.sign({ userId: 'u1', tenantId: 't1', email: 'a@b.com' }, process.env.JWT_SECRET || 'dev-secret');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [OrdersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    // Attach idempotency middleware like in main.ts
    app.use(idempotencyMiddleware());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.resetAllMocks());

  it('POST /v1/orders/ingest with same Idempotency-Key replays with 200 and same body', async () => {
    // Ensure any call path inside mocked transaction returns a created order
    (prismaMock.order.create as any).mockImplementation(async () => ({ id: 'o1', items: [] }));

    const payload = { channel: 'shopify', externalId: `E-${Date.now()}`, items: [{ sku: 's1', quantity: 1 }] };
    const key = 'idem-123';

    const r1 = await request(app.getHttpServer())
      .post('/v1/orders/ingest')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);
    if (![200, 201].includes(r1.status)) console.error('[int] r1 failed', r1.status, r1.body);
    expect([200, 201]).toContain(r1.status);
    expect(r1.body).toMatchObject({ created: true, orderId: 'o1' });

    const r2 = await request(app.getHttpServer())
      .post('/v1/orders/ingest')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);
    if (r2.status !== 200) console.error('[int] r2 failed', r2.status, r2.body);
    expect(r2.status).toBe(200); // replay normalized to 200
    expect(r2.headers['idempotency-replayed']).toBe('true');
    expect(r2.body).toEqual(r1.body);
  });

  it('POST /v1/orders/ingest with same Idempotency-Key but mismatched payload returns 409', async () => {
    (prismaMock.order.create as any).mockImplementation(async () => ({ id: 'o2', items: [] }));
    const baseKey = 'idem-456';
    const p1 = { channel: 'shopify', externalId: `E-${Date.now()}-A`, items: [{ sku: 's1', quantity: 1 }] };
    const p2 = { ...p1, items: [{ sku: 's1', quantity: 2 }] }; // mismatched

    const r1 = await request(app.getHttpServer())
      .post('/v1/orders/ingest')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', baseKey)
      .send(p1);
    if (![200, 201].includes(r1.status)) console.error('[int] r1b failed', r1.status, r1.body);
    expect([200, 201]).toContain(r1.status);

    const r2 = await request(app.getHttpServer())
      .post('/v1/orders/ingest')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', baseKey)
      .send(p2);
    expect(r2.status).toBe(409);
    expect(r2.body?.error).toMatch(/Idempotency key re-use/i);
  });

  it('GET /v1/orders applies pagination and filters', async () => {
    (prismaMock.order.count as any).mockResolvedValue(3);
    (prismaMock.order.findMany as any).mockResolvedValue([
      { id: 'o9', channel: 'shopify', externalId: 'E-9', status: 'created', createdAt: new Date(), _count: { items: 2 } },
    ]);

    const r = await request(app.getHttpServer())
      .get('/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 2, pageSize: 1, status: 'created', channel: 'shopify' });

    expect(r.status).toBe(200);
    expect(r.body.page).toBe(2);
    expect(prismaMock.order.count).toHaveBeenCalledWith({ where: { tenantId: 't1', status: 'created', channel: 'shopify' } });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1', status: 'created', channel: 'shopify' },
        skip: 1,
        take: 1,
      }),
    );
  });
});
import 'reflect-metadata';
