import { AuthService } from '../../src/auth.service';
import { PrismaService } from '../../src/prisma.service';

const mockPrisma = () => ({
  user: { findUnique: jest.fn(), create: jest.fn() },
  tenant: { create: jest.fn() },
  authCredential: { create: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mock as any)),
});

const mock = mockPrisma();

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    (mock.$transaction as any).mockImplementation((fn: any) => fn(mock));
    service = new AuthService((mock as unknown) as PrismaService);
  });

  it('signup creates tenant, user, cred and returns token payload', async () => {
    (mock.user.findUnique as any).mockResolvedValue(null);
    (mock.tenant.create as any).mockResolvedValue({ id: 't1', name: 'Acme' });
    (mock.user.create as any).mockResolvedValue({ id: 'u1', tenantId: 't1', email: 'a@b.com', role: 'owner' });
    (mock.authCredential.create as any).mockResolvedValue({ id: 'c1' });

    const res = await service.signup({ email: 'a@b.com', password: 'password123', tenantName: 'Acme' });
    expect(res.userId).toBe('u1');
    expect(res.tenantId).toBe('t1');
    expect(res.token).toBeTruthy();
  });

  it('login returns token when credentials valid', async () => {
    (mock.user.findUnique as any).mockResolvedValue({ id: 'u1', tenantId: 't1', email: 'a@b.com', role: 'owner' });
    // bcrypt hash for 'password123' with salt rounds 10
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('password123', 10);
    (mock.authCredential.findUnique as any).mockResolvedValue({ userId: 'u1', passwordHash: hash });

    const res = await service.login({ email: 'a@b.com', password: 'password123' });
    expect(res.userId).toBe('u1');
    expect(res.tenantId).toBe('t1');
    expect(res.token).toBeTruthy();
  });
});

