import { Args, Field, ObjectType, Query, Resolver, Mutation, Context } from '@nestjs/graphql';
import axios from 'axios';
import type { AuthContext } from './security/jwt.context';
import { Roles } from './security/roles.decorator';

@ObjectType()
class UserGql {
  @Field()
  id!: string;
  @Field()
  email!: string;
  @Field()
  role!: string;
  @Field()
  createdAt!: string;
}

@ObjectType()
class UsersListGql {
  @Field(() => [UserGql])
  items!: UserGql[];
}

@Resolver()
export class UsersResolver {
  private usersBase = process.env.USERS_URL || 'http://127.0.0.1:4001';

  @Query(() => UsersListGql)
  @Roles('owner', 'admin')
  async users(@Context() ctx: AuthContext): Promise<UsersListGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.get(`${this.usersBase}/v1/users`, {
      headers: auth ? { Authorization: auth } : undefined,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to list users');
    return res.data as UsersListGql;
  }

  @Mutation(() => Boolean)
  @Roles('owner', 'admin')
  async setUserRole(
    @Args('id') id: string,
    @Args('role') role: string,
    @Context() ctx: AuthContext,
  ): Promise<boolean> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.put(
      `${this.usersBase}/v1/users/${id}/role`,
      { role },
      { headers: auth ? { Authorization: auth } : undefined, validateStatus: () => true },
    );
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to set role');
    try {
      await axios.post(
        `${this.usersBase}/v1/audit`,
        { action: 'user.role_set', resource: 'user', resourceId: id, metadata: { role } },
        { headers: auth ? { Authorization: auth } : undefined },
      );
    } catch (err) {
      // Audit logging is best-effort; ignore failures
    }
    return true;
  }
}
