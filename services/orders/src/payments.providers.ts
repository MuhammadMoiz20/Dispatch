export type RefundResult = {
  externalRefundId: string;
  status: 'succeeded' | 'failed';
  error?: string;
};

export interface PaymentProviderAdapter {
  refund(params: {
    tenantId: string;
    chargeId: string;
    amountCents: number;
    currency: string;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<RefundResult>;
}

class StripeAdapter implements PaymentProviderAdapter {
  constructor(private apiKey: string) {}
  async refund(params: {
    tenantId: string;
    chargeId: string;
    amountCents: number;
    currency: string;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<RefundResult> {
    // Placeholder: call Stripe refunds.create using apiKey
    // Simulate success and deterministic id
    const id = `re_str_${params.chargeId}_${params.amountCents}`;
    return { externalRefundId: id, status: 'succeeded' };
  }
}

class ShopifyPaymentsAdapter implements PaymentProviderAdapter {
  constructor(private apiKey: string) {}
  async refund(params: {
    tenantId: string;
    chargeId: string;
    amountCents: number;
    currency: string;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<RefundResult> {
    // Placeholder: call Shopify Admin refunds endpoint
    const id = `re_shop_${params.chargeId}_${params.amountCents}`;
    return { externalRefundId: id, status: 'succeeded' };
  }
}

class MockPaymentsAdapter implements PaymentProviderAdapter {
  async refund(params: {
    tenantId: string;
    chargeId: string;
    amountCents: number;
    currency: string;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<RefundResult> {
    const id = `re_mock_${params.chargeId}_${params.amountCents}`;
    return { externalRefundId: id, status: 'succeeded' };
  }
}

export function getPaymentAdapter(provider: string, apiKey?: string): PaymentProviderAdapter {
  switch ((provider || '').toLowerCase()) {
    case 'stripe':
      return new StripeAdapter(apiKey || process.env.STRIPE_API_KEY || '');
    case 'shopify_payments':
    case 'shopify-payments':
      return new ShopifyPaymentsAdapter(apiKey || process.env.SHOPIFY_PAYMENTS_API_KEY || '');
    default:
      return new MockPaymentsAdapter();
  }
}
