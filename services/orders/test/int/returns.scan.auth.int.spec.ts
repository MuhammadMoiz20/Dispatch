import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ReturnsController } from '../../src/returns.controller';
import { PrismaService } from '../../src/prisma.service';

const jwt = require('jsonwebtoken');

describe('Returns scan endpoint auth (int, mocked Prisma)', () => {
  let app: INestApplication;
  const prismaMock: any = {
    return: { findUnique: jest.fn(), update: jest.fn() },
    outbox: { create: jest.fn() },
    scanAudit: { create: jest.fn() },
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

  it('rejects scan without Authorization', async () => {
    (prismaMock.return.findUnique as any).mockResolvedValue({ id: 'r1', tenantId: 't1', state: 'label_generated' });
    const res = await request(app.getHttpServer()).post('/v1/returns/r1/scan');
    expect(res.status).toBe(401);
  });

  it('accepts scan with warehouse role', async () => {
    (prismaMock.return.findUnique as any).mockResolvedValue({ id: 'r1', tenantId: 't1', state: 'label_generated' });
    (prismaMock.return.update as any).mockResolvedValue({ id: 'r1', state: 'in_transit', tenantId: 't1' });
    const token = jwt.sign({ sub: 'u1', tenantId: 't1', role: 'warehouse' }, process.env.JWT_SECRET || 'dev-secret');
    const res = await request(app.getHttpServer()).post('/v1/returns/r1/scan').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'r1', state: 'in_transit' });
  });
});
