import { OrdersService } from '../../src/orders.service';

jest.mock('@dispatch/messaging', () => ({
  createRabbitMQ: () => ({ publish: jest.fn().mockResolvedValue(undefined) }),
}));

describe('OrdersService', () => {
  const prisma: any = {
    $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
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

  it('list applies filters and pagination to prisma calls', async () => {
    const svc = new OrdersService(prisma);
    (prisma.$transaction as any).mockImplementation((ops: any[]) => Promise.all(ops.map((op) => op)));
    (prisma.order.count as any).mockResolvedValue(1);
    (prisma.order.findMany as any).mockResolvedValue([
      { id: 'o2', channel: 'shopify', externalId: 'e2', status: 'created', createdAt: new Date(), _count: { items: 1 } },
    ]);
    const res = await svc.list('tenant-1', { page: 3, pageSize: 5, status: 'created', channel: 'shopify' } as any);
    expect(res.page).toBe(3);
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', status: 'created', channel: 'shopify' } });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', status: 'created', channel: 'shopify' },
        skip: 10,
        take: 5,
      }),
    );
  });
});
