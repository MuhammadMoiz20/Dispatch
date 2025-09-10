import { signJwt, verifyJwt } from '../../src/jwt';

describe('JWT utils', () => {
  it('signs and verifies claims', () => {
    const token = signJwt(
      { sub: 'u1', tenantId: 't1', role: 'owner' },
      { secret: 's', expiresIn: '1h' },
    );
    const decoded = verifyJwt(token, 's');
    expect(decoded.sub).toBe('u1');
    expect(decoded.tenantId).toBe('t1');
    expect(decoded.role).toBe('owner');
  });
});
