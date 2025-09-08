import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ReturnsController } from '../../src/returns.controller';
import { PrismaService } from '../../src/prisma.service';

describe('ReturnsController (int, mocked Prisma)', () => {
  let app: INestApplication;
  const prismaMock: any = {
    order: { findUnique: jest.fn() },
    return: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReturnsController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.resetAllMocks());

  it('creates a return (201) when order exists', async () => {
    (prismaMock.order.findUnique as any).mockResolvedValue({ id: 'o1', tenantId: 't1' });
    (prismaMock.return.findFirst as any).mockResolvedValue(null);
    (prismaMock.return.create as any).mockResolvedValue({ id: 'r1', state: 'initiated' });

    const res = await request(app.getHttpServer()).post('/v1/returns').send({ orderId: 'o1', reason: 'damaged' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'r1', state: 'initiated' });
  });

  it('returns 404 when order not found', async () => {
    (prismaMock.order.findUnique as any).mockResolvedValue(null);
    const res = await request(app.getHttpServer()).post('/v1/returns').send({ orderId: 'x', reason: 'damaged' });
    expect(res.status).toBe(404);
  });
});

