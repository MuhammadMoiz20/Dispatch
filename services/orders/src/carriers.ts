export type RateQuote = {
  carrier: string;
  service: string;
  costCents: number;
  currency: string;
  etaDays?: number;
};

export type ReturnContext = {
  id: string;
  tenantId: string;
  orderId: string;
};

export interface CarrierAdapter {
  getRates(ctx: ReturnContext): Promise<RateQuote[]>;
}

class MockCarrier implements CarrierAdapter {
  async getRates(_ctx: ReturnContext): Promise<RateQuote[]> {
    // Deterministic but varied mock rates
    return [
      { carrier: 'mock-carrier', service: 'ground', costCents: 900, currency: 'USD', etaDays: 5 },
      { carrier: 'mock-carrier', service: 'express', costCents: 1800, currency: 'USD', etaDays: 2 },
      { carrier: 'usps', service: 'priority', costCents: 1200, currency: 'USD', etaDays: 3 },
    ];
  }
}

// Future: real adapters using EasyPost/Shippo APIs
class EasyPostAdapter implements CarrierAdapter {
  constructor(private apiKey: string) {}
  async getRates(ctx: ReturnContext): Promise<RateQuote[]> {
    // Placeholder: integrate with EasyPost Shipment/Rates using apiKey
    // For now, fall back to mock but annotate carrier
    const mock = await new MockCarrier().getRates(ctx);
    return mock.map((r) => (r.carrier === 'mock-carrier' ? { ...r, carrier: 'easypost' } : r));
  }
}

class ShippoAdapter implements CarrierAdapter {
  constructor(private apiKey: string) {}
  async getRates(ctx: ReturnContext): Promise<RateQuote[]> {
    const mock = await new MockCarrier().getRates(ctx);
    return mock.map((r) => (r.carrier === 'mock-carrier' ? { ...r, carrier: 'shippo' } : r));
  }
}

export function getCarrierAdapter(provider: string, apiKey?: string): CarrierAdapter {
  switch ((provider || '').toLowerCase()) {
    case 'easypost':
      return new EasyPostAdapter(apiKey || process.env.EASYPOST_API_KEY || '');
    case 'shippo':
      return new ShippoAdapter(apiKey || process.env.SHIPPO_API_KEY || '');
    default:
      return new MockCarrier();
  }
}
