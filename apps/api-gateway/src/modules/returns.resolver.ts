import { Args, Field, Mutation, ObjectType, Query, Resolver, Context } from '@nestjs/graphql';
import axios from 'axios';

@ObjectType()
class ReturnGql {
  @Field()
  id!: string;
  @Field()
  orderId!: string;
  @Field()
  state!: string;
  @Field()
  reason!: string;
  @Field()
  createdAt!: string;
}

@Resolver()
export class ReturnsResolver {
  private ordersBase = process.env.ORDERS_URL || 'http://127.0.0.1:4002';

  @Query(() => ReturnGql, { nullable: true })
  async returnById(@Args('id') id: string): Promise<ReturnGql | null> {
    const res = await axios.get(`${this.ordersBase}/v1/returns/${id}`, { validateStatus: () => true });
    if (res.status === 404) return null;
    if (res.status >= 400) throw mapHttpToGqlError('RETURN_FETCH_FAILED', res.status, res.data);
    const r = res.data;
    return { ...r, createdAt: new Date(r.createdAt).toISOString() };
  }

  @Mutation(() => ReturnId)
  async initiateReturn(
    @Args('orderId') orderId: string,
    @Args('reason') reason: string,
  ): Promise<ReturnId> {
    const headers = { 'Idempotency-Key': `gql-${orderId}` } as const;
    const res = await axios.post(
      `${this.ordersBase}/v1/returns`,
      { orderId, reason },
      { headers, validateStatus: () => true },
    );
    if (res.status >= 400) throw mapHttpToGqlError('RETURN_CREATE_FAILED', res.status, res.data);
    return res.data;
  }

  @Mutation(() => ReturnGql)
  async scanReturn(@Args('id') id: string, @Context() ctx?: any): Promise<ReturnGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.post(`${this.ordersBase}/v1/returns/${id}/scan`, undefined, {
      validateStatus: () => true,
      headers: auth ? { Authorization: auth } : undefined,
    });
    if (res.status >= 400) throw mapHttpToGqlError('RETURN_SCAN_FAILED', res.status, res.data);
    const r = await axios.get(`${this.ordersBase}/v1/returns/${id}`);
    const data = r.data;
    return { ...data, createdAt: new Date(data.createdAt).toISOString() };
  }
}

function mapHttpToGqlError(code: string, status: number, data: any): Error {
  const message = data?.message || data?.error || 'Request failed';
  const err = new Error(message);
  (err as any).extensions = { code, httpStatus: status, details: data };
  return err;
}

@ObjectType()
class ReturnId {
  @Field()
  id!: string;
  @Field()
  state!: string;
}
