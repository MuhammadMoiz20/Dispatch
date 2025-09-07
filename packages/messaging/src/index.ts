export type MessageHandler<T = unknown> = (msg: T) => Promise<void> | void;

export interface Messaging {
  publish(queue: string, message: object): Promise<void>;
  subscribe<T = unknown>(queue: string, handler: MessageHandler<T>): Promise<void>;
  close(): Promise<void>;
}

export { createRabbitMQ } from './rabbitmq';

