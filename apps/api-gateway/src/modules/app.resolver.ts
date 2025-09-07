import { Context, Field, ObjectType, Query, Resolver } from '@nestjs/graphql';
import type { AuthContext } from './security/jwt.context';

@ObjectType()
export class WhoAmI {
  @Field(() => String, { nullable: true })
  userId?: string | null;
  @Field(() => String, { nullable: true })
  tenantId?: string | null;
}

@Resolver()
export class AppResolver {
  @Query(() => String)
  health(): string {
    return 'ok';
  }

  @Query(() => WhoAmI, { description: 'Returns the authenticated user info if available' })
  whoami(@Context() ctx: AuthContext): WhoAmI {
    return { userId: ctx?.user?.userId ?? null, tenantId: ctx?.user?.tenantId ?? null };
  }
}
