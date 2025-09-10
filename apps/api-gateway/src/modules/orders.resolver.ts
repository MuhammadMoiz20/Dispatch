import { Args, Field, Int, ObjectType, Query, Resolver, Context } from '@nestjs/graphql';
import axios from 'axios';
import type { AuthContext } from './security/jwt.context';

@ObjectType()
class OrderGql {
  @Field()
  id!: string;
  @Field()
  channel!: string;
  @Field()
  externalId!: string;
  @Field()
  status!: string;
  @Field()
  createdAt!: string;
  @Field(() => Int)
  itemsCount!: number;
}

@ObjectType()
class OrdersPageGql {
  @Field(() => [OrderGql])
  items!: OrderGql[];
  @Field(() => Int)
  page!: number;
  @Field(() => Int)
  pageSize!: number;
  @Field(() => Int)
  total!: number;
}

function mapHttpToGqlError(code: string, status: number, data: any): Error {
  const message = data?.message || data?.error || 'Request failed';
  const err = new Error(message);
  (err as any).extensions = { code, httpStatus: status, details: data };
  return err;
}

// Add returns operations to the same resolver so AppModule provider registration remains valid.
@Resolver()
export class OrdersResolver {
  private ordersBase = process.env.ORDERS_URL || 'http://127.0.0.1:4002';

  @Query(() => OrdersPageGql)
  async orders(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Int, defaultValue: 20 }) pageSize: number,
    @Args('status', { nullable: true }) status?: string,
    @Args('channel', { nullable: true }) channel?: string,
    @Context() ctx?: AuthContext,
  ): Promise<OrdersPageGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.get(`${this.ordersBase}/v1/orders`, {
      params: { page, pageSize, status, channel },
      headers: auth ? { Authorization: auth } : undefined,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw mapHttpToGqlError('ORDERS_FETCH_FAILED', res.status, res.data);
    // Normalize createdAt to ISO string
    const items = (res.data.items || []).map((o: any) => ({
      ...o,
      createdAt: new Date(o.createdAt).toISOString(),
    }));
    return { ...res.data, items };
  }
}
