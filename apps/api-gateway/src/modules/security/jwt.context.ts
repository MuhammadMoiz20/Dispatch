import jwt from 'jsonwebtoken';

export type AuthContext = {
  req: any;
  res: any;
  user?: { userId: string; tenantId: string; email?: string; role?: string } | null;
};

export function getContext({ req, res }: any): AuthContext {
  const auth = req?.headers?.authorization as string | undefined;
  let user: AuthContext['user'] = null;
  if (auth) {
    const [scheme, token] = auth.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
        // Support tokens that use either `userId` or standard JWT `sub` claim
        const userId = decoded?.userId || decoded?.sub;
        const tenantId = decoded?.tenantId;
        const role = decoded?.role;
        if (userId && tenantId) user = { userId, tenantId, email: decoded.email, role };
      } catch (err) {
        // Ignore verification errors; user remains unauthenticated
      }
    }
  }
  return { req, res, user };
}
