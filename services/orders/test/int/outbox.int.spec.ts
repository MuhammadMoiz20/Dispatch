import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { OutboxWorker } from '../../src/outbox.worker';
import { PrismaService } from '../../src/prisma.service';

describe('Orders OutboxWorker (int, mocked prisma)', () => {
  const prismaMock: any = {
    outbox: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NODE_ENV = 'test'; // stub RMQ client
  });

  it('publishes pending outbox items and marks them published', async () => {
    const items = [
      { id: '1', type: 'order.created', payload: { a: 1 }, attempts: 0 },
      { id: '2', type: 'return.state_changed', payload: { a: 2 }, attempts: 1 },
    ];
    prismaMock.outbox.findMany.mockResolvedValue(items);
    prismaMock.outbox.update.mockResolvedValue({});

    const moduleRef = await Test.createTestingModule({
      providers: [OutboxWorker, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    const worker = moduleRef.get(OutboxWorker);
    // @ts-ignore access private method for test
    await worker['drain'](50);

    expect(prismaMock.outbox.update).toHaveBeenCalledTimes(2);
    for (const it of items) {
      expect(prismaMock.outbox.update).toHaveBeenCalledWith({
        where: { id: it.id },
        data: expect.objectContaining({ status: 'published' }),
      });
    }
  });
});

