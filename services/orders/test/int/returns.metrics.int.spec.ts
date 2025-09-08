import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ReturnsController } from '../../src/returns.controller';
import { MetricsController } from '../../src/metrics.controller';
import { PrismaService } from '../../src/prisma.service';

describe('Returns metrics (int)', () => {
  let app: INestApplication;
  const prismaMock: any = {
    order: { findUnique: jest.fn() },
    return: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReturnsController, MetricsController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.resetAllMocks());

  it('increments returns_initiated_total when creating a return', async () => {
    (prismaMock.order.findUnique as any).mockResolvedValue({ id: 'o1', tenantId: 't1' });
    (prismaMock.return.findFirst as any).mockResolvedValue(null);
    (prismaMock.return.create as any).mockResolvedValue({ id: 'r1', state: 'initiated' });

    const create = await request(app.getHttpServer()).post('/v1/returns').send({ orderId: 'o1', reason: 'damaged' });
    expect(create.status).toBe(201);

    const metrics = await request(app.getHttpServer()).get('/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.text).toContain('returns_initiated_total');
  });
});

