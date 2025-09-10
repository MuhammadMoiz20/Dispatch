import axios from 'axios';

export type EmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tenantId: string;
  event: string;
};
export type SmsParams = { to: string; body: string; tenantId: string; event: string };

export interface EmailProvider {
  sendEmail(
    params: EmailParams,
  ): Promise<{ ok: boolean; id?: string; response?: any; error?: string }>;
}

export interface SmsProvider {
  sendSms(params: SmsParams): Promise<{ ok: boolean; id?: string; response?: any; error?: string }>;
}

export function createEmailProvider(): EmailProvider {
  const provider = (process.env.EMAIL_PROVIDER || 'noop').toLowerCase();
  if (provider === 'postmark' && process.env.POSTMARK_TOKEN)
    return new PostmarkProvider(process.env.POSTMARK_TOKEN!);
  if (provider === 'sendgrid' && process.env.SENDGRID_API_KEY)
    return new SendGridProvider(process.env.SENDGRID_API_KEY!);
  return new NoopEmailProvider();
}

export function createSmsProvider(): SmsProvider {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (sid && token && from) return new TwilioProvider(sid, token, from);
  return new NoopSmsProvider();
}

class NoopEmailProvider implements EmailProvider {
  async sendEmail(params: EmailParams) {
    // eslint-disable-next-line no-console
    console.log('[notifications] NoopEmailProvider', {
      to: params.to,
      subject: params.subject,
      tenantId: params.tenantId,
      event: params.event,
    });
    return { ok: true, id: 'noop' };
  }
}

class NoopSmsProvider implements SmsProvider {
  async sendSms(params: SmsParams) {
    // eslint-disable-next-line no-console
    console.log('[notifications] NoopSmsProvider', {
      to: params.to,
      body: params.body.slice(0, 40),
      tenantId: params.tenantId,
      event: params.event,
    });
    return { ok: true, id: 'noop' };
  }
}

class PostmarkProvider implements EmailProvider {
  constructor(private token: string) {}
  async sendEmail({ to, subject, html, text }: EmailParams) {
    const res = await axios.post(
      'https://api.postmarkapp.com/email',
      {
        From: process.env.EMAIL_FROM || 'no-reply@example.com',
        To: to,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
      },
      { headers: { 'X-Postmark-Server-Token': this.token }, validateStatus: () => true },
    );
    if (res.status >= 400)
      return { ok: false, error: res.data?.Message || 'postmark_error', response: res.data };
    return { ok: true, id: res.data?.MessageID, response: res.data };
  }
}

class SendGridProvider implements EmailProvider {
  constructor(private apiKey: string) {}
  async sendEmail({ to, subject, html, text }: EmailParams) {
    const res = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.EMAIL_FROM || 'no-reply@example.com' },
        subject,
        content: [
          ...(text ? [{ type: 'text/plain', value: text }] : []),
          { type: 'text/html', value: html },
        ],
      },
      { headers: { Authorization: `Bearer ${this.apiKey}` }, validateStatus: () => true },
    );
    if (res.status >= 400)
      return { ok: false, error: res.data || 'sendgrid_error', response: res.data };
    return { ok: true, id: res.headers['x-message-id'], response: { status: res.status } };
  }
}

class TwilioProvider implements SmsProvider {
  constructor(
    private sid: string,
    private token: string,
    private from: string,
  ) {}
  async sendSms({ to, body }: SmsParams) {
    const auth = Buffer.from(`${this.sid}:${this.token}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', this.from);
    params.append('Body', body);
    const res = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`,
      params,
      {
        headers: { Authorization: `Basic ${auth}` },
        validateStatus: () => true,
      },
    );
    if (res.status >= 400)
      return { ok: false, error: res.data || 'twilio_error', response: res.data };
    return { ok: true, id: res.data?.sid, response: res.data };
  }
}
