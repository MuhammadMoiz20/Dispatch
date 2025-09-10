import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { createRabbitMQ } from '@dispatch/messaging';

export type OrderCreatedEvent = {
  tenantId: string;
  orderId: string;
  channel: string;
  externalId: string;
  at: string;
};

export type ReturnUpdatedEvent = {
  tenantId?: string;
  returnId: string;
  state: string;
  at: string;
};

export type WebhookDeliveryUpdatedEvent = {
  tenantId: string;
  deliveryId: string;
  status: string;
  attempts: number;
  responseStatus?: number | null;
  at: string;
};

@Injectable()
export class SubscriptionsService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(SubscriptionsService.name);
  private pubsub = new PubSub();
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);

  async onModuleInit() {
    // Bridge RMQ -> PubSub topics
    try {
      await this.mq.subscribe<OrderCreatedEvent>(
        'order.created',
        async (msg: OrderCreatedEvent) => {
          await this.pubsub.publish('order.created', { orderCreated: msg });
        },
      );
    } catch (e) {
      this.logger.error(`Failed to subscribe to order.created: ${(e as any)?.message || e}`);
    }
    try {
      await this.mq.subscribe<ReturnUpdatedEvent>(
        'return.state_changed',
        async (msg: ReturnUpdatedEvent) => {
          await this.pubsub.publish('return.updated', { returnUpdated: msg });
        },
      );
    } catch (e) {
      this.logger.error(`Failed to subscribe to return.state_changed: ${(e as any)?.message || e}`);
    }
    try {
      await this.mq.subscribe<any>('return.label_generated', async (msg: any) => {
        const event: ReturnUpdatedEvent = {
          returnId: msg.returnId,
          state: 'label_generated',
          at: msg.at,
          tenantId: msg.tenantId,
        };
        await this.pubsub.publish('return.updated', { returnUpdated: event });
      });
    } catch (e) {
      this.logger.error(
        `Failed to subscribe to return.label_generated: ${(e as any)?.message || e}`,
      );
    }
    try {
      await this.mq.subscribe<WebhookDeliveryUpdatedEvent>(
        'webhook.delivery_updated',
        async (msg: WebhookDeliveryUpdatedEvent) => {
          await this.pubsub.publish('webhook.delivery_updated', { webhookDeliveryUpdated: msg });
        },
      );
    } catch (e) {
      this.logger.error(
        `Failed to subscribe to webhook.delivery_updated: ${(e as any)?.message || e}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.mq.close();
  }

  asyncIterator<T = any>(trigger: string) {
    return this.pubsub.asyncIterator<T>(trigger);
  }
}
