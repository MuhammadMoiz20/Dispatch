import { ProviderWebhooksController } from '../../src/provider-webhooks.controller';
import { PrismaService } from '../../src/prisma.service';

describe('ProviderWebhooksController', () => {
  it('records Postmark events', async () => {
    const prisma = new PrismaService();
    (prisma as any).notificationAttempt = { create: jest.fn(async (_: any) => ({})) };
    const ctrl = new ProviderWebhooksController(prisma);
    const body = {
      RecordType: 'Delivery',
      Email: 'a@b.com',
      Metadata: { tenantId: 't1', event: 'return.approved' },
    };
    const res = await ctrl.postmark(body);
    expect(res).toEqual({ ok: true });
    expect((prisma as any).notificationAttempt.create).toHaveBeenCalled();
  });

  it('records Twilio events', async () => {
    const prisma = new PrismaService();
    (prisma as any).notificationAttempt = { create: jest.fn(async (_: any) => ({})) };
    const ctrl = new ProviderWebhooksController(prisma);
    const body = {
      MessageStatus: 'delivered',
      To: '+11234567890',
      tenantId: 't1',
      event: 'return.approved',
    };
    const res = await ctrl.twilio(body);
    expect(res).toEqual({ ok: true });
    expect((prisma as any).notificationAttempt.create).toHaveBeenCalled();
  });
});
