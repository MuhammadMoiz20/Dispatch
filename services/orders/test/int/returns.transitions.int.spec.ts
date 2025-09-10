import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ReturnsController } from '../../src/returns.controller';
import { PrismaService } from '../../src/prisma.service';

describe('ReturnsController transitions (int, mocked Prisma)', () => {
  let app: INestApplication;
  const prismaMock: any = {
    return: { findUnique: jest.fn(), update: jest.fn() },
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

  it('approves an initiated return', async () => {
    (prismaMock.return.findUnique as any).mockResolvedValue({ id: 'r1', state: 'initiated' });
    (prismaMock.return.update as any).mockResolvedValue({ id: 'r1', state: 'label_generated' });
    const res = await request(app.getHttpServer()).post('/v1/returns/r1/approve');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'r1', state: 'label_generated' });
  });

  it('rejects invalid transitions with 400', async () => {
    (prismaMock.return.findUnique as any).mockResolvedValue({ id: 'r1', state: 'initiated' });
    const res = await request(app.getHttpServer()).post('/v1/returns/r1/scan');
    expect(res.status).toBe(400);
  });
});
