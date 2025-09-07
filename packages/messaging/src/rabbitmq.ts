import amqplib, { Channel, Options, ConsumeMessage, ChannelModel } from 'amqplib';

export function createRabbitMQ(url = process.env.RABBITMQ_URL || 'amqp://localhost:5672') {
  let conn: ChannelModel | null = null;
  let channel: Channel | null = null;

  async function ensure(): Promise<Channel> {
    if (!conn) {
      conn = await amqplib.connect(url);
    }
    if (!channel) {
      // conn is ensured above; use non-null assertion to satisfy TS
      channel = await conn!.createChannel();
    }
    return channel!;
  }

  return {
    async publish(queue: string, message: object, options?: Options.Publish) {
      const ch = await ensure();
      await ch.assertQueue(queue, { durable: true });
      ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        contentType: 'application/json',
        persistent: true,
        ...options,
      });
    },
    async subscribe<T>(queue: string, handler: (msg: T) => Promise<void> | void) {
      const ch = await ensure();
      await ch.assertQueue(queue, { durable: true });
      await ch.consume(queue, async (m: ConsumeMessage | null) => {
        if (!m) return;
        try {
          const content = JSON.parse(m.content.toString());
          await handler(content as T);
          ch.ack(m);
        } catch (err) {
          ch.nack(m, false, false); // dead-letter on failure
        }
      });
    },
    async close() {
      await channel?.close();
      await conn?.close();
      channel = null;
      conn = null;
    },
  };
}

