import http from 'http';
import crypto from 'crypto';
import { deliverWebhook } from '@dispatch/webhooks-core';

describe('Webhook signing (HMAC SHA256)', () => {
  it('sends expected signature header', async () => {
    const secret = 'test_secret';
    const payload = { hello: 'world' };
    const ts = 1710000000;
    const body = JSON.stringify(payload);
    const expectedSig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');

    const srv = http.createServer((req, res) => {
      const sig = req.headers['x-dispatch-signature'];
      const tss = req.headers['x-dispatch-timestamp'];
      try {
        expect(tss).toBe(String(ts));
        expect(sig).toBe(expectedSig);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (e as any)?.message || 'assert failed' }));
      }
    });
    await new Promise<void>((resolve) => srv.listen(0, resolve));
    const addr = srv.address();
    const port = typeof addr === 'object' && addr && 'port' in addr ? (addr as any).port : 0;
    const url = `http://127.0.0.1:${port}`;

    const res = await deliverWebhook({ url, secret, payload, timestamp: ts });
    expect(res.status).toBe(200);
    srv.close();
  });
});
