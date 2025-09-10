import { Args, Field, Int, ObjectType, Resolver, Subscription } from '@nestjs/graphql';
import { SubscriptionsService } from './subscriptions.service';
import type { AuthContext } from './security/jwt.context';

@ObjectType()
class ReturnEventGql {
  @Field()
  returnId!: string;
  @Field()
  state!: string;
  @Field()
  at!: string;
}

@ObjectType()
class OrderCreatedEventGql {
  @Field()
  orderId!: string;
  @Field()
  channel!: string;
  @Field()
  externalId!: string;
  @Field()
  at!: string;
}

@ObjectType()
class WebhookDeliveryEventGql {
  @Field()
  deliveryId!: string;
  @Field()
  status!: string;
  @Field(() => Int)
  attempts!: number;
  @Field(() => Int, { nullable: true })
  responseStatus?: number | null;
  @Field()
  at!: string;
}

@Resolver()
export class SubscriptionsResolver {
  constructor(private subs: SubscriptionsService) {}

  @Subscription(() => OrderCreatedEventGql, {
    resolve: (payload: any) => payload.orderCreated,
    filter: (payload: any, _vars: any, ctx: AuthContext) => {
      const tenantId = ctx?.user?.tenantId;
      return !!tenantId && payload?.orderCreated?.tenantId === tenantId;
    },
  })
  orderCreated() {
    return this.subs.asyncIterator('order.created');
  }

  @Subscription(() => WebhookDeliveryEventGql, {
    resolve: (payload: any) => payload.webhookDeliveryUpdated,
    filter: (payload: any, _vars: any, ctx: AuthContext) => {
      const tenantId = ctx?.user?.tenantId;
      return !!tenantId && payload?.webhookDeliveryUpdated?.tenantId === tenantId;
    },
  })
  webhookDeliveryUpdated() {
    return this.subs.asyncIterator('webhook.delivery_updated');
  }

  // Public subscription scoped by returnId
  @Subscription(() => ReturnEventGql, {
    resolve: (payload: any) => payload.returnUpdated,
    filter: (payload: any, variables: { returnId: string }) => {
      return payload?.returnUpdated?.returnId === variables?.returnId;
    },
  })
  returnUpdated(@Args('returnId') _returnId: string) {
    return this.subs.asyncIterator('return.updated');
  }
}
