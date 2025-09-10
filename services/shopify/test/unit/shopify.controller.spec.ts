import { ShopifyController } from '../../src/shopify.controller';
import { PrismaService } from '../../src/prisma.service';

describe('ShopifyController', () => {
  let controller: ShopifyController;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    mockPrisma = {} as jest.Mocked<PrismaService>;
    controller = new ShopifyController(mockPrisma);
  });

  it('should return health status', () => {
    const result = controller.getHealth();
    expect(result).toEqual({ status: 'ok', service: 'shopify' });
  });
});
