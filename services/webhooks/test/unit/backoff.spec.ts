import { WebhooksService } from '../../src/webhooks.service';

describe('WebhooksService backoff', () => {
  const svc = new WebhooksService({} as any);

  it('computes exponential backoff with cap', () => {
    expect(svc.computeBackoffMs(1)).toBe(5000);
    expect(svc.computeBackoffMs(2)).toBe(10000);
    expect(svc.computeBackoffMs(3)).toBe(20000);
    expect(svc.computeBackoffMs(4)).toBe(40000);
    expect(svc.computeBackoffMs(5)).toBe(60000);
    expect(svc.computeBackoffMs(6)).toBe(60000);
  });
});

