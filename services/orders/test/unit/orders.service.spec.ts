import { OrdersService } from '../../src/orders.service';

describe('OrdersService', () => {
  const prisma: any = {
    $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.resolve(arg))),
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => jest.resetAllMocks());

  it('ingest returns created true when new', async () => {
    const svc = new OrdersService(prisma);
    (prisma.order.create as any).mockResolvedValue({ id: 'o1' });
    const res = await svc.ingest('t1', { channel: 'shopify', externalId: 'e1', items: [{ sku: 's1', quantity: 1 }] });
    expect(res).toEqual({ created: true, orderId: 'o1' });
  });

  it('ingest returns created false when duplicate (P2002)', async () => {
    const svc = new OrdersService(prisma);
    (prisma.order.create as any).mockRejectedValue({ code: 'P2002' });
    (prisma.order.findUnique as any).mockResolvedValue({ id: 'o1' });
    const res = await svc.ingest('t1', { channel: 'shopify', externalId: 'e1', items: [{ sku: 's1', quantity: 1 }] });
    expect(res).toEqual({ created: false, orderId: 'o1' });
  });

  it('list maps items and pagination', async () => {
    const svc = new OrdersService(prisma);
    (prisma.$transaction as any).mockImplementation((ops: any[]) => Promise.all(ops.map((op) => op)));
    (prisma.order.count as any).mockResolvedValue(42);
    (prisma.order.findMany as any).mockResolvedValue([
      { id: 'o1', channel: 'c', externalId: 'e', status: 'created', createdAt: new Date('2020-01-01'), _count: { items: 3 } },
    ]);
    const res = await svc.list('t1', { page: 2, pageSize: 20 });
    expect(res.total).toBe(42);
    expect(res.items[0]).toMatchObject({ id: 'o1', itemsCount: 3 });
  });
});

