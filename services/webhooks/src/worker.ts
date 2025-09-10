import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createRabbitMQ } from '@dispatch/messaging';
import { WebhooksService } from './webhooks.service';

@Injectable()
export class WebhooksWorker implements OnModuleInit {
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  private logger = new Logger('WebhooksWorker');
  constructor(private svc: WebhooksService) {}

  async onModuleInit() {
    // Subscribe to order.created events to create deliveries
    try {
      await this.mq.subscribe<any>('order.created', async (msg) => {
        if (!msg?.tenantId) return;
        await this.svc.createDeliveriesForEvent({
          tenantId: msg.tenantId,
          type: 'order.created',
          payload: msg,
        });
      });
    } catch (e) {
      this.logger.warn(`Failed to subscribe to order.created: ${(e as any)?.message || e}`);
    }
    // Subscribe to return.label_generated events to create deliveries
    try {
      await this.mq.subscribe<any>('return.label_generated', async (msg) => {
        if (!msg?.tenantId) return;
        await this.svc.createDeliveriesForEvent({
          tenantId: msg.tenantId,
          type: 'return.label_generated',
          payload: msg,
        });
      });
    } catch (e) {
      this.logger.warn(
        `Failed to subscribe to return.label_generated: ${(e as any)?.message || e}`,
      );
    }
    // Subscribe to webhooks.deliver queue for processing
    await this.mq.subscribe<{ deliveryId: string }>('webhooks.deliver', async (msg) => {
      if (!msg?.deliveryId) return;
      await this.svc.processDelivery(msg.deliveryId);
    });
    // Periodic scheduler for due retries
    setInterval(() => {
      void this.svc
        .enqueueDueDeliveries()
        .catch((e) => this.logger.warn(`enqueueDueDeliveries: ${e?.message || e}`));
      void this.svc.updateDlqDepthGauge().catch(() => {});
    }, 5000);
  }
}
