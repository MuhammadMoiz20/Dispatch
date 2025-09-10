import { useEffect, useMemo, useState } from 'react';
import { Stepper } from '@dispatch/ui';

type Return = { id: string; orderId: string; state: string; reason: string; createdAt: string };
type Label = {
  id: string;
  returnId: string;
  carrier: string;
  service: string;
  costCents: number;
  currency: string;
  downloadUrl: string;
  createdAt: string;
};
type Rate = {
  carrier: string;
  service: string;
  costCents: number;
  currency: string;
  etaDays?: number;
};
type Refund = {
  id: string;
  returnId: string;
  provider: string;
  amountCents: number;
  currency: string;
  status: string;
  externalRefundId?: string;
  createdAt: string;
  updatedAt: string;
};

export default function ReturnsPage() {
  const apiUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql',
    [],
  );
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [returnIdInput, setReturnIdInput] = useState('');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [initiateReason, setInitiateReason] = useState('customer_changed_mind');
  const [data, setData] = useState<Return | null>(null);
  const [label, setLabel] = useState<Label | null>(null);
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [selectedRate, setSelectedRate] = useState<string | null>(null);
  const [refund, setRefund] = useState<Refund | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setToken(localStorage.getItem('token'));
    } catch (e) {
      console.error(e);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!token && typeof window !== 'undefined') {
      const next = encodeURIComponent('/returns');
      window.location.href = `/login?next=${next}`;
    }
  }, [ready, token]);

  async function fetchReturn(id: string) {
    setLoading(true);
    setError(null);
    try {
      const query = `query ReturnById($id: String!) { returnById(id: $id) { id orderId state reason createdAt } }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ query, variables: { id } }),
      });
      const json = await res.json();
      const r = json?.data?.returnById as Return | undefined;
      if (!r) throw new Error(json?.errors?.[0]?.message || 'Not found');
      setData(r);
      await Promise.all([fetchLabel(id), fetchRates(id), fetchRefund(id)]);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
      setData(null);
      setLabel(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLabel(id: string) {
    const query = `query LabelByReturn($id: String!) { labelByReturn(returnId: $id) { id returnId carrier service costCents currency downloadUrl createdAt } }`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ query, variables: { id } }),
    });
    const json = await res.json();
    setLabel(json?.data?.labelByReturn || null);
  }

  async function fetchRates(id: string) {
    const query = `query Rates($returnId: String!) { returnRates(returnId: $returnId) { carrier service costCents currency etaDays } }`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ query, variables: { returnId: id } }),
    });
    const json = await res.json();
    setRates(json?.data?.returnRates || null);
  }

  async function fetchRefund(id: string) {
    const query = `query RefundByReturn($returnId: String!) { refundByReturn(returnId: $returnId) { id returnId provider amountCents currency status externalRefundId createdAt updatedAt } }`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ query, variables: { returnId: id } }),
    });
    const json = await res.json();
    setRefund(json?.data?.refundByReturn || null);
  }

  async function createLabel() {
    if (!data?.id) return;
    setLoading(true);
    setError(null);
    try {
      const mutation = `mutation Gen($returnId: String!, $carrier: String, $service: String) { generateReturnLabel(returnId: $returnId, carrier: $carrier, service: $service) { id returnId carrier service costCents currency downloadUrl createdAt } }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            returnId: data.id,
            ...(selectedRate
              ? { carrier: selectedRate.split(':')[0], service: selectedRate.split(':')[1] }
              : {}),
          },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Failed to create');
      setLabel(json.data.generateReturnLabel);
    } catch (e: any) {
      setError(e.message || 'Failed to create label');
    } finally {
      setLoading(false);
    }
  }

  async function initiate(orderId: string, reason: string) {
    setLoading(true);
    setError(null);
    try {
      const mutation = `mutation Init($orderId: String!, $reason: String!) { initiateReturn(orderId: $orderId, reason: $reason) { id state } }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ query: mutation, variables: { orderId, reason } }),
      });
      const json = await res.json();
      if (json.errors?.length)
        throw new Error(json.errors[0]?.message || 'Failed to initiate return');
      const retId: string | undefined = json?.data?.initiateReturn?.id;
      if (retId) {
        setReturnIdInput(retId);
        await fetchReturn(retId);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to initiate return');
    } finally {
      setLoading(false);
    }
  }

  async function createRefund() {
    if (!data?.id) return;
    setLoading(true);
    setError(null);
    try {
      const amountCents = refundAmount ? parseInt(refundAmount, 10) : undefined;
      const mutation = `mutation Refund($returnId: String!, $amountCents: Int) { refundReturn(returnId: $returnId, amountCents: $amountCents) { id returnId provider amountCents currency status externalRefundId createdAt updatedAt } }`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ query: mutation, variables: { returnId: data.id, amountCents } }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Failed to refund');
      setRefund(json.data.refundReturn);
    } catch (e: any) {
      setError(e.message || 'Failed to refund');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Returns</h1>
      {error && (
        <div className="card">
          <div className="card-body text-red-600">{error}</div>
        </div>
      )}
      <div className="card">
        <div className="card-body flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Return ID</span>
            <input
              className="mt-1 ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
              placeholder="e.g. return UUID"
              value={returnIdInput}
              onChange={(e) => setReturnIdInput(e.target.value)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={!returnIdInput || loading}
            onClick={() => fetchReturn(returnIdInput)}
          >
            Load
          </button>
        </div>
      </div>
      <div className="card">
        <div className="card-header">Or initiate a return by Order ID</div>
        <div className="card-body grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Order ID</span>
            <input
              className="mt-1 ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
              placeholder="order UUID"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-600 dark:text-gray-300">Reason</span>
            <input
              className="mt-1 ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
              placeholder="reason"
              value={initiateReason}
              onChange={(e) => setInitiateReason(e.target.value)}
            />
          </label>
          <div>
            <button
              className="btn-primary"
              disabled={!orderIdInput || loading}
              onClick={() => initiate(orderIdInput, initiateReason)}
            >
              Initiate Return
            </button>
          </div>
        </div>
      </div>
      {data && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-body">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium text-gray-900 dark:text-gray-100">Return:</span>{' '}
                {data.id}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium text-gray-900 dark:text-gray-100">State:</span>{' '}
                {data.state}
              </div>
              <div className="mt-3">
                <Stepper
                  steps={[
                    {
                      key: 'initiated',
                      label: 'Initiated',
                      status: [
                        'initiated',
                        'in_transit',
                        'received',
                        'refunded',
                        'completed',
                      ].includes(data.state)
                        ? data.state === 'initiated'
                          ? 'active'
                          : 'complete'
                        : 'pending',
                    },
                    {
                      key: 'in_transit',
                      label: 'In‑Transit',
                      status: ['in_transit', 'received', 'refunded', 'completed'].includes(
                        data.state,
                      )
                        ? data.state === 'in_transit'
                          ? 'active'
                          : 'complete'
                        : 'pending',
                    },
                    {
                      key: 'received',
                      label: 'Received',
                      status: ['received', 'refunded', 'completed'].includes(data.state)
                        ? data.state === 'received'
                          ? 'active'
                          : 'complete'
                        : 'pending',
                    },
                    {
                      key: 'disposition',
                      label: 'Disposition',
                      status: ['refunded', 'completed'].includes(data.state)
                        ? 'complete'
                        : 'pending',
                    },
                    {
                      key: 'refund',
                      label: 'Refund',
                      status: ['refunded', 'completed'].includes(data.state)
                        ? data.state === 'refunded'
                          ? 'active'
                          : 'complete'
                        : 'pending',
                    },
                  ]}
                />
              </div>
            </div>
          </div>

          {!label && rates && (
            <div className="card">
              <div className="card-header">Rate Options</div>
              <div className="card-body space-y-1">
                {rates.map((r) => {
                  const key = `${r.carrier}:${r.service}`;
                  return (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="rate"
                        value={key}
                        checked={selectedRate === key}
                        onChange={() => setSelectedRate(key)}
                      />
                      <span className="font-medium">
                        {r.carrier} {r.service}
                      </span>
                      <span className="text-gray-600 dark:text-gray-300">
                        — {(r.costCents / 100).toFixed(2)} {r.currency}{' '}
                        {r.etaDays ? `(~${r.etaDays} days)` : ''}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body">
              {label ? (
                <p className="text-sm">
                  <span className="font-medium">Label:</span>{' '}
                  <a
                    className="text-brand-700 dark:text-brand-300 underline"
                    href={label.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>{' '}
                  ({label.carrier} {label.service}, {(label.costCents / 100).toFixed(2)}{' '}
                  {label.currency})
                </p>
              ) : (
                <button className="btn-primary" onClick={createLabel} disabled={loading}>
                  Create Return Label
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Refund</div>
            <div className="card-body">
              {refund ? (
                <p className="text-sm">
                  <span className="font-medium">Status:</span> {refund.status}{' '}
                  {refund.externalRefundId ? `(${refund.externalRefundId})` : ''} —{' '}
                  {(refund.amountCents / 100).toFixed(2)} {refund.currency}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-sm">
                    Amount (cents)
                    <input
                      className="ml-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                  </label>
                  <button
                    className="btn-primary"
                    onClick={createRefund}
                    disabled={loading || !data?.id}
                  >
                    Refund
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
