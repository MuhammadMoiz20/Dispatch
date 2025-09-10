import { Args, Field, ObjectType, Query, Resolver, Mutation, Context } from '@nestjs/graphql';
import axios from 'axios';
import type { AuthContext } from './security/jwt.context';
import { Roles } from './security/roles.decorator';

@ObjectType()
class ApiKeyGql {
  @Field()
  id!: string;
  @Field()
  name!: string;
  @Field()
  keyPrefix!: string;
  @Field()
  createdAt!: string;
  @Field({ nullable: true })
  lastUsedAt?: string;
  @Field({ nullable: true })
  key?: string; // only on create
}

@ObjectType()
class ApiKeysListGql {
  @Field(() => [ApiKeyGql])
  items!: ApiKeyGql[];
}

@ObjectType()
class AuditLogGql {
  @Field()
  id!: string;
  @Field()
  tenantId!: string;
  @Field()
  action!: string;
  @Field()
  resource!: string;
  @Field({ nullable: true })
  resourceId?: string;
  @Field({ nullable: true })
  ip?: string;
  @Field({ nullable: true })
  metadata?: string;
  @Field()
  createdAt!: string;
}

@ObjectType()
class AuditListGql {
  @Field(() => [AuditLogGql])
  items!: AuditLogGql[];
}

@Resolver()
export class UsersAdminResolver {
  private usersBase = process.env.USERS_URL || 'http://127.0.0.1:4001';

  @Query(() => ApiKeysListGql)
  @Roles('owner', 'admin')
  async apiKeys(@Context() ctx: AuthContext): Promise<ApiKeysListGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.get(`${this.usersBase}/v1/api-keys`, {
      headers: auth ? { Authorization: auth } : undefined,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to list keys');
    return res.data as ApiKeysListGql;
  }

  @Mutation(() => ApiKeyGql)
  @Roles('owner', 'admin')
  async createApiKey(@Args('name') name: string, @Context() ctx: AuthContext): Promise<ApiKeyGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.post(
      `${this.usersBase}/v1/api-keys`,
      { name },
      { headers: auth ? { Authorization: auth } : undefined, validateStatus: () => true },
    );
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to create key');
    try {
      await axios.post(
        `${this.usersBase}/v1/audit`,
        { action: 'api_key.create', resource: 'api_key', resourceId: (res.data as any).id },
        { headers: auth ? { Authorization: auth } : undefined },
      );
    } catch (err) {
      // Audit logging is best-effort; ignore failures
    }
    return res.data as ApiKeyGql;
  }

  @Mutation(() => Boolean)
  @Roles('owner', 'admin')
  async revokeApiKey(@Args('id') id: string, @Context() ctx: AuthContext): Promise<boolean> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.delete(`${this.usersBase}/v1/api-keys/${id}`, {
      headers: auth ? { Authorization: auth } : undefined,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to revoke key');
    try {
      await axios.post(
        `${this.usersBase}/v1/audit`,
        { action: 'api_key.revoke', resource: 'api_key', resourceId: id },
        { headers: auth ? { Authorization: auth } : undefined },
      );
    } catch (err) {
      // Audit logging is best-effort; ignore failures
    }
    return true;
  }

  @Query(() => AuditListGql)
  @Roles('owner', 'admin')
  async auditLogs(@Args('tenantId') tenantId: string): Promise<AuditListGql> {
    const res = await axios.get(`${this.usersBase}/v1/audit`, {
      params: { tenantId },
      validateStatus: () => true,
    });
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to list audit logs');
    return res.data as AuditListGql;
  }
}
