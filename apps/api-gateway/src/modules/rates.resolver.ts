import { Args, Field, ObjectType, Query, Resolver } from '@nestjs/graphql';
import axios from 'axios';

@ObjectType()
class RateQuoteGql {
  @Field()
  carrier!: string;
  @Field()
  service!: string;
  @Field()
  costCents!: number;
  @Field()
  currency!: string;
  @Field({ nullable: true })
  etaDays?: number;
}

@Resolver()
export class RatesResolver {
  private ordersBase = process.env.ORDERS_URL || 'http://127.0.0.1:4002';

  @Query(() => [RateQuoteGql])
  async returnRates(@Args('returnId') returnId: string): Promise<RateQuoteGql[]> {
    const res = await axios.get(`${this.ordersBase}/v1/returns/${returnId}/rates`, {
      validateStatus: () => true,
    });
    if (res.status >= 400) throw mapHttpToGqlError('RATES_FETCH_FAILED', res.status, res.data);
    return (res.data?.items || []) as RateQuoteGql[];
  }
}

function mapHttpToGqlError(code: string, status: number, data: any): Error {
  const message = data?.message || data?.error || 'Request failed';
  const err = new Error(message);
  (err as any).extensions = { code, httpStatus: status, details: data };
  return err;
}
