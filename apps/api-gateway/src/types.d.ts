declare module '@dispatch/telemetry' {
  export function initTelemetry(serviceName: string): void;
}

declare module '@dispatch/config' {
  export type AppConfig = {
    NODE_ENV?: 'development' | 'test' | 'production';
    PORT: number;
    POSTGRES_URL?: string;
    REDIS_URL?: string;
    RABBITMQ_URL?: string;
    SERVICE_NAME?: string;
  };
  export function loadConfig(overrides?: Partial<NodeJS.ProcessEnv>): AppConfig;
}

declare module '@dispatch/messaging' {
  export type MessageHandler<T = unknown> = (msg: T) => Promise<void> | void;
  export interface Messaging {
    publish(queue: string, message: object): Promise<void>;
    subscribe<T = unknown>(queue: string, handler: MessageHandler<T>): Promise<void>;
    close(): Promise<void>;
  }
  export function createRabbitMQ(url?: string): Messaging;
}
