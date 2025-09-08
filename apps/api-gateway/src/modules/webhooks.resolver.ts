import { Args, Field, Int, ObjectType, Query, Resolver, Mutation, Context } from '@nestjs/graphql';
import axios from 'axios';
import type { AuthContext } from './security/jwt.context';

function mapHttpToGqlError(code: string, status: number, data: any): Error {
  const message = data?.message || data?.error || 'Request failed';
  const err = new Error(message);
  (err as any).extensions = { code, httpStatus: status, details: data };
  return err;
}

@ObjectType()
class DeliveryGql {
  @Field()
  id!: string;
  @Field()
  endpointId!: string;
  @Field()
  eventType!: string;
  @Field()
  status!: string;
  @Field(() => Int)
  attempts!: number;
  @Field(() => Int, { nullable: true })
  responseStatus?: number | null;
  @Field(() => String, { nullable: true })
  lastError?: string | null;
  @Field()
  createdAt!: string;
  @Field()
  updatedAt!: string;
  @Field(() => String, { nullable: true })
  nextAttemptAt?: string | null;
}

@ObjectType()
class DeliveriesPageGql {
  @Field(() => [DeliveryGql])
  items!: DeliveryGql[];
  @Field(() => Int)
  page!: number;
  @Field(() => Int)
  pageSize!: number;
  @Field(() => Int)
  total!: number;
}

@Resolver()
export class WebhooksResolver {
  private webhooksBase = process.env.WEBHOOKS_URL || 'http://127.0.0.1:4003';

  @Query(() => DeliveriesPageGql)
  async deliveries(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Int, defaultValue: 20 }) pageSize: number,
    @Args('status', { nullable: true }) status?: string,
    @Args('endpointId', { nullable: true }) endpointId?: string,
    @Context() ctx?: AuthContext,
  ): Promise<DeliveriesPageGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.get(`${this.webhooksBase}/v1/deliveries`, {
      params: { page, pageSize, status, endpointId },
      headers: auth ? { Authorization: auth } : undefined,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw mapHttpToGqlError('DELIVERIES_FETCH_FAILED', res.status, res.data);
    const items = (res.data.items || []).map((d: any) => ({
      ...d,
      createdAt: new Date(d.createdAt).toISOString(),
      updatedAt: new Date(d.updatedAt).toISOString(),
      nextAttemptAt: d.nextAttemptAt ? new Date(d.nextAttemptAt).toISOString() : null,
    }));
    return { ...res.data, items };
  }

  @Mutation(() => Boolean)
  async replayDelivery(@Args('id') id: string, @Context() ctx?: AuthContext): Promise<boolean> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.post(`${this.webhooksBase}/v1/deliveries/${id}/replay`, undefined, {
      headers: auth ? { Authorization: auth } : undefined,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw mapHttpToGqlError('DELIVERY_REPLAY_FAILED', res.status, res.data);
    return true;
  }
}
