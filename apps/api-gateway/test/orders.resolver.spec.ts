import { OrdersResolver } from '../src/modules/orders.resolver';
import axios from 'axios';

jest.mock('axios');

describe('OrdersResolver', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => jest.resetAllMocks());

  it('forwards filters/pagination and normalizes createdAt; includes Authorization header', async () => {
    const resolver = new OrdersResolver();
    const ctx: any = { req: { headers: { authorization: 'Bearer test-token' } } };

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        items: [
          { id: 'o1', channel: 'shopify', externalId: 'E1', status: 'created', createdAt: '2020-01-01', itemsCount: 2 },
        ],
        page: 2,
        pageSize: 10,
        total: 1,
      },
    } as any);

    const out = await resolver.orders(2, 10, 'created', 'shopify', ctx);
    expect(out.page).toBe(2);
    expect(out.items[0].createdAt).toBe(new Date('2020-01-01').toISOString());
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/orders$/), {
      params: { page: 2, pageSize: 10, status: 'created', channel: 'shopify' },
      headers: { Authorization: 'Bearer test-token' },
      validateStatus: expect.any(Function),
    });
  });
});

