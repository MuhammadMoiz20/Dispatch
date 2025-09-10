import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { LabelsController } from '../../src/labels.controller';
import { PrismaService } from '../../src/prisma.service';
import * as storage from '../../src/storage';

jest.mock('../../src/storage');

describe('LabelsController (int, mocked Prisma + storage)', () => {
  let app: INestApplication;
  const prismaMock: any = {
    return: { findUnique: jest.fn(), update: jest.fn() },
    label: { findUnique: jest.fn(), create: jest.fn() },
  };

  beforeAll(async () => {
    // Ensure mocked implementations are set on the actual imported module
    (storage.putLabelObject as unknown as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined) as any;
    (storage.getLabelDownloadUrl as unknown as jest.Mock) = jest
      .fn()
      .mockResolvedValue('http://localhost:9000/dispatch-labels/test.txt') as any;
    const moduleRef = await Test.createTestingModule({
      controllers: [LabelsController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Preserve mock implementations across tests; only clear call history
    jest.clearAllMocks();
    // Ensure storage mocks keep returning expected values after clear
    (storage.putLabelObject as unknown as jest.Mock).mockResolvedValue(undefined);
    (storage.getLabelDownloadUrl as unknown as jest.Mock).mockResolvedValue(
      'http://localhost:9000/dispatch-labels/test.txt',
    );
  });

  it('creates label (201) and returns metadata with URL', async () => {
    (prismaMock.return.findUnique as any).mockResolvedValue({
      id: 'r1',
      tenantId: 't1',
      state: 'initiated',
    });
    (prismaMock.label.findUnique as any).mockResolvedValue(null);
    (prismaMock.label.create as any).mockResolvedValue({
      id: 'l1',
      returnId: 'r1',
      carrier: 'mock-carrier',
      service: 'ground',
      costCents: 900,
      currency: 'USD',
      objectKey: 'k',
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer()).post('/v1/returns/r1/label').send({});
    expect(res.status).toBe(201);
    expect(res.body?.id).toBe('l1');
    expect(res.body?.downloadUrl).toContain('http://localhost:9000');
  });

  it('returns 404 when return not found', async () => {
    (prismaMock.return.findUnique as any).mockResolvedValue(null);
    const res = await request(app.getHttpServer()).post('/v1/returns/x/label').send({});
    expect(res.status).toBe(404);
  });

  it('get existing label (200)', async () => {
    (prismaMock.label.findUnique as any).mockResolvedValue({
      id: 'l1',
      returnId: 'r1',
      carrier: 'mock',
      service: 'ground',
      costCents: 900,
      currency: 'USD',
      objectKey: 'k',
      createdAt: new Date(),
    });
    const res = await request(app.getHttpServer()).get('/v1/returns/r1/label');
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe('l1');
  });
});
