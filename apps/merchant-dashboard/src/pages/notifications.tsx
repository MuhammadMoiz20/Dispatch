import { useEffect, useState } from 'react';
import { gqlAuth } from '../lib/graphql';

type Template = {
  id: string;
  tenantId: string;
  name: string;
  event: string;
  channel: string;
  subject?: string;
  body: string;
};
// Preference type reserved for future usage

export default function Notifications() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [event, setEvent] = useState('return.approved');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [name, setName] = useState('Default');
  const [subject, setSubject] = useState('Your return was approved');
  const [body, setBody] = useState(
    'Hello {{customerName}}, your return {{returnId}} was approved.',
  );
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefSms, setPrefSms] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    (async () => {
      if (!token) return;
      // In this MVP, tenantId is decoded from token if it uses standard claims
      try {
        const [, jwt] = (token || '').split(' ');
        const raw = (token || '').startsWith('Bearer ') ? jwt : token;
        const b64 = (raw || '').split('.')[1] || '';
        const json =
          typeof window !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
        const payload = JSON.parse(json || '{}');
        if (payload?.tenantId) setTenantId(payload.tenantId);
      } catch (e) {
        console.error(e);
      }
      const query = `query Tpls($event: String, $channel: String) { notificationTemplates(event: $event, channel: $channel) { items { id tenantId name event channel subject body } } }`;
      const data = await gqlAuth<{ notificationTemplates: { items: Template[] } }>(query, token!, {
        event,
        channel,
      });
      setTemplates(data.notificationTemplates.items);
    })();
  }, [token, channel, event]);

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !tenantId) return;
    const mutation = `mutation CreateTpl($tenantId: String!, $name: String!, $event: String!, $channel: String!, $body: String!, $subject: String) { createNotificationTemplate(tenantId: $tenantId, name: $name, event: $event, channel: $channel, body: $body, subject: $subject) { id name event channel } }`;
    await gqlAuth(mutation, token, { tenantId, name, event, channel, body, subject });
    const query = `query Tpls($event: String, $channel: String) { notificationTemplates(event: $event, channel: $channel) { items { id tenantId name event channel subject body } } }`;
    const data = await gqlAuth<{ notificationTemplates: { items: Template[] } }>(query, token!, {
      event,
      channel,
    });
    setTemplates(data.notificationTemplates.items);
  }

  async function savePrefs() {
    if (!token || !tenantId) return;
    const mutation = `mutation UpsertPref($tenantId: String!, $event: String!, $emailEnabled: Boolean, $smsEnabled: Boolean) { upsertNotificationPreference(tenantId: $tenantId, event: $event, emailEnabled: $emailEnabled, smsEnabled: $smsEnabled) { id event emailEnabled smsEnabled } }`;
    await gqlAuth(mutation, token, {
      tenantId,
      event,
      emailEnabled: prefEmail,
      smsEnabled: prefSms,
    });
    alert('Preferences saved');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Notifications</h1>
      <section className="card">
        <div className="card-header">Templates</div>
        <div className="card-body">
          <form onSubmit={createTemplate} className="grid gap-3 max-w-2xl">
            <label className="text-sm">
              <span className="text-gray-600 dark:text-gray-300">Event</span>
              <input
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-600 dark:text-gray-300">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              >
                <option value="email">email</option>
                <option value="sms">sms</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-gray-600 dark:text-gray-300">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              />
            </label>
            {channel === 'email' && (
              <label className="text-sm">
                <span className="text-gray-600 dark:text-gray-300">Subject</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                />
              </label>
            )}
            <label className="text-sm">
              <span className="text-gray-600 dark:text-gray-300">Body (Handlebars)</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 font-mono"
              />
            </label>
            <div>
              <button type="submit" className="btn-primary">
                Create Template
              </button>
            </div>
          </form>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Existing</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {templates.map((t) => (
                <li key={t.id} className="flex gap-2">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    — {t.event} — {t.channel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-header">Preferences</div>
        <div className="card-body space-y-3">
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Event</span>
            <input
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              className="mt-1 w-full max-w-md rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefEmail}
              onChange={(e) => setPrefEmail(e.target.checked)}
            />
            <span className="text-gray-600 dark:text-gray-300">Email Enabled</span>
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={prefSms}
              onChange={(e) => setPrefSms(e.target.checked)}
            />
            <span className="text-gray-600 dark:text-gray-300">SMS Enabled</span>
          </label>
          <div>
            <button onClick={savePrefs} className="btn-primary">
              Save Preferences
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
