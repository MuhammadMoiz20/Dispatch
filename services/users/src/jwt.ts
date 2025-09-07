import jwt, { SignOptions, Secret } from 'jsonwebtoken';

const DEFAULT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export type JwtClaims = {
  sub: string; // userId
  tenantId: string;
  role: string;
};

export function signJwt(
  claims: JwtClaims,
  opts?: { secret?: string; expiresIn?: SignOptions['expiresIn'] },
): string {
  const secret: Secret = (opts?.secret || DEFAULT_SECRET) as Secret;
  const options: SignOptions = { expiresIn: (opts?.expiresIn ?? '12h') as SignOptions['expiresIn'] };
  return jwt.sign(claims, secret, options);
}

export function verifyJwt<T = JwtClaims>(token: string, secret = DEFAULT_SECRET): T {
  return jwt.verify(token, secret) as T;
}

