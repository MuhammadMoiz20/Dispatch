import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RefundsController } from '../../src/refunds.controller';
import { MetricsController, registry } from '../../src/metrics.controller';

describe('RefundsController (int, mocked Prisma)', () => {
  const prismaMock: any = {
    return: { findUnique: jest.fn() },
    refund: { findFirst: jest.fn(), create: jest.fn() },
    payment: { findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a refund and returns 202', async () => {
    const module = await Test.createTestingModule({
      controllers: [RefundsController, MetricsController],
      providers: [
        { provide: (await import('../../src/prisma.service')).PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    (prismaMock.return.findUnique as any).mockResolvedValue({
      id: 'r1',
      orderId: 'o1',
      tenantId: 't1',
    });
    (prismaMock.payment.findFirst as any).mockResolvedValue({
      id: 'p1',
      provider: 'stripe',
      chargeId: 'ch_1',
      amountCents: 1000,
      currency: 'USD',
    });
    (prismaMock.refund.findFirst as any).mockResolvedValue(null);
    (prismaMock.refund.create as any).mockResolvedValue({
      id: 'rf1',
      returnId: 'r1',
      provider: 'stripe',
      amountCents: 1000,
      currency: 'USD',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/v1/returns/r1/refund')
      .send({})
      .set('Idempotency-Key', 'x');
    expect(res.status).toBe(202);
    expect(res.body?.id).toBe('rf1');
    const metrics = await request(app.getHttpServer()).get('/metrics');
    expect(metrics.text).toContain('refunds_total');
    await app.close();
  });

  it('returns existing refund idempotently', async () => {
    const module = await Test.createTestingModule({
      controllers: [RefundsController],
      providers: [
        { provide: (await import('../../src/prisma.service')).PrismaService, useValue: prismaMock },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    const existing = {
      id: 'rf1',
      returnId: 'r1',
      provider: 'stripe',
      amountCents: 1000,
      currency: 'USD',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prismaMock.return.findUnique as any).mockResolvedValue({
      id: 'r1',
      orderId: 'o1',
      tenantId: 't1',
    });
    (prismaMock.refund.findFirst as any).mockResolvedValue(existing);

    const res = await request(app.getHttpServer()).post('/v1/returns/r1/refund').send({});
    expect(res.status).toBe(202);
    expect(res.body?.id).toBe('rf1');
    await app.close();
  });
});
