import { Args, Field, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import axios from 'axios';

@ObjectType()
class RefundGql {
  @Field()
  id!: string;
  @Field()
  returnId!: string;
  @Field()
  provider!: string;
  @Field()
  amountCents!: number;
  @Field()
  currency!: string;
  @Field()
  status!: string;
  @Field({ nullable: true })
  externalRefundId?: string;
  @Field()
  createdAt!: string;
  @Field()
  updatedAt!: string;
}

@Resolver()
export class RefundsResolver {
  private ordersBase = process.env.ORDERS_URL || 'http://127.0.0.1:4002';

  @Mutation(() => RefundGql)
  async refundReturn(
    @Args('returnId') returnId: string,
    @Args('amountCents', { nullable: true }) amountCents?: number,
    @Args('reason', { nullable: true }) reason?: string,
    @Args('provider', { nullable: true }) provider?: string,
  ): Promise<RefundGql> {
    const res = await axios.post(
      `${this.ordersBase}/v1/returns/${returnId}/refund`,
      { amountCents, reason, provider },
      { validateStatus: () => true },
    );
    if (res.status >= 400) throw mapHttpToGqlError('REFUND_CREATE_FAILED', res.status, res.data);
    const r = res.data;
    return {
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    };
  }

  @Query(() => RefundGql, { nullable: true })
  async refundByReturn(@Args('returnId') returnId: string): Promise<RefundGql | null> {
    const res = await axios.get(`${this.ordersBase}/v1/returns/${returnId}/refund`, {
      validateStatus: () => true,
    });
    if (res.status === 404) return null;
    if (res.status >= 400) throw mapHttpToGqlError('REFUND_FETCH_FAILED', res.status, res.data);
    const r = res.data;
    return {
      ...r,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    };
  }
}

function mapHttpToGqlError(code: string, status: number, data: any): Error {
  const message = data?.message || data?.error || 'Request failed';
  const err = new Error(message);
  (err as any).extensions = { code, httpStatus: status, details: data };
  return err;
}
