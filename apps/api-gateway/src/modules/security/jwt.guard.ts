import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    // Allow unauthenticated for auth mutations
    const info = gqlCtx.getInfo();
    const fieldName = info?.fieldName;
    const parentType = info?.parentType?.name;
    if (parentType === 'Mutation' && (fieldName === 'login' || fieldName === 'signup')) return true;
    // Fast-path if context already has a verified user
    if (ctx?.user?.tenantId && ctx?.user?.userId) return true;

    // Fall back: if any Bearer token is present, allow and let downstream services enforce JWT
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    if (!auth) return false;
    const [scheme, token] = auth.split(' ');
    if ((scheme || '').toLowerCase() !== 'bearer' || !token) return false;
    // Optionally try to decode to populate ctx.user, but do not block if verify fails
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
      const userId = decoded?.userId || decoded?.sub;
      const tenantId = decoded?.tenantId;
      if (userId && tenantId) ctx.user = { userId, tenantId, email: decoded?.email };
    } catch {}
    return true;
  }
}
