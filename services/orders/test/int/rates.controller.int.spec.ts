import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RatesController } from '../../src/rates.controller';

describe('RatesController (int, mocked Prisma)', () => {
  const prismaMock: any = {
    return: { findUnique: jest.fn() },
    carrierCredential: { findFirst: jest.fn() },
  };

  beforeEach(() => jest.resetAllMocks());

  it('returns rate items', async () => {
    const module = await Test.createTestingModule({
      controllers: [RatesController],
      providers: [
        { provide: (await import('../../src/prisma.service')).PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    (prismaMock.return.findUnique as any).mockResolvedValue({
      id: 'r1',
      tenantId: 't1',
      orderId: 'o1',
    });
    (prismaMock.carrierCredential.findFirst as any).mockResolvedValue(null);
    const res = await request(app.getHttpServer()).get('/v1/returns/r1/rates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.items)).toBe(true);
    await app.close();
  });
});
