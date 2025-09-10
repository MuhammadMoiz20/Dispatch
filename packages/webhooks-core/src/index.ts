import axios from 'axios';
import crypto from 'crypto';

export type Delivery = {
  url: string;
  secret: string;
  payload: object;
  timestamp?: number;
};

export async function deliverWebhook({ url, secret, payload, timestamp }: Delivery) {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Dispatch-Timestamp': ts,
      'X-Dispatch-Signature': sig,
    },
    timeout: 5000,
    validateStatus: () => true,
  });
}
