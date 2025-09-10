import { IngestWorker } from '../../src/ingest.worker';

describe('Ingest mapping', () => {
  it('handles order.created payload shape', async () => {
    const w = new (IngestWorker as any)();
    const msg = {
      tenantId: 't1',
      orderId: 'o1',
      channel: 'shopify',
      at: '2024-01-01T00:00:00.000Z',
    };
    const row = (w as any).toDateTime(msg.at);
    expect(row).toBeInstanceOf(Date);
  });
});
