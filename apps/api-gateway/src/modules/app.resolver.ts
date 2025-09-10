import { Args, Context, Field, ObjectType, Query, Resolver, Mutation } from '@nestjs/graphql';
import { Roles } from './security/roles.decorator';

const tenantThemes = new Map<string, string>();
import type { AuthContext } from './security/jwt.context';

@ObjectType()
export class WhoAmI {
  @Field(() => String, { nullable: true })
  userId?: string | null;
  @Field(() => String, { nullable: true })
  tenantId?: string | null;
  @Field(() => String, { nullable: true })
  role?: string | null;
  @Field(() => String, { nullable: true })
  theme?: string | null;
}

@Resolver()
export class AppResolver {
  @Query(() => String)
  health(): string {
    return 'ok';
  }

  @Query(() => WhoAmI, { description: 'Returns the authenticated user info if available' })
  whoami(@Context() ctx: AuthContext): WhoAmI {
    const tid = ctx?.user?.tenantId ?? null;
    const theme = tid ? tenantThemes.get(tid) || null : null;
    return {
      userId: ctx?.user?.userId ?? null,
      tenantId: tid,
      role: ctx?.user?.role ?? null,
      theme,
    };
  }

  @Mutation(() => Boolean, { description: 'Set tenant theme (brand), admin only' })
  @Roles('owner', 'admin')
  setTenantTheme(@Args('theme') theme: string, @Context() ctx: AuthContext): boolean {
    const tid = ctx?.user?.tenantId;
    if (!tid) return false;
    tenantThemes.set(tid, theme);
    return true;
  }
}
