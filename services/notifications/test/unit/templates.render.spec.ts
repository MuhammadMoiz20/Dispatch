import { TemplatesService } from '../../src/templates.service';
import { PrismaService } from '../../src/prisma.service';

describe('TemplatesService', () => {
  const prisma = new PrismaService();
  const service = new TemplatesService(prisma);

  beforeAll(async () => {
    // Seed a template in an in-memory-like fashion by mocking prisma
    (prisma as any).notificationTemplate = {
      findFirst: jest.fn(async () => ({
        subject: 'Hello {{name}}',
        body: 'Order {{orderId}} approved',
      })),
    };
  });

  it('renders handlebars subject and body', async () => {
    const res = await service.render('t1', 'return.approved', 'email', {
      name: 'Jane',
      orderId: 'o123',
    });
    expect(res.subject).toBe('Hello Jane');
    expect(res.body).toBe('Order o123 approved');
  });
});
