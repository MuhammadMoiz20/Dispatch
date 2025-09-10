import { RulesService } from '../../src/rules.service';
import { PrismaService } from '../../src/prisma.service';

jest.mock('axios', () => ({ post: jest.fn() }));
import axios from 'axios';

describe('RulesService actions', () => {
  const prisma = {
    rule: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  } as any as PrismaService;
  const svc = new (RulesService as any)(prisma);

  it('retries approve_return action up to attempts', async () => {
    let calls = 0;
    (axios.post as any).mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return { status: 200 };
    });
    const context = { return: { id: 'r1', reason: 'wrong size', state: 'initiated' } };
    await (svc as any).executeAction({ type: 'approve_return' }, { tenantId: 't1', context });
    expect(calls).toBe(3);
  });
});
