import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    const shutdown = async () => {
      try {
        await this.$disconnect();
      } finally {
        await app.close();
      }
    };
    process.on('SIGINT', async () => {
      await shutdown();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await shutdown();
      process.exit(0);
    });
  }

  async runWithTenant<T>(
    tenantId: string,
    fn: (
      tx: Omit<
        PrismaClient,
        | '$on'
        | '$connect'
        | '$disconnect'
        | '$use'
        | '$executeRaw'
        | '$executeRawUnsafe'
        | '$queryRaw'
        | '$queryRawUnsafe'
        | '$transaction'
        | '$extends'
      >,
    ) => Promise<T>,
  ) {
    return this.$transaction(async (tx: Prisma.TransactionClient) => {
      // Set RLS context. This assumes a Postgres function app.current_tenant exists.
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
      return fn(tx as any);
    });
  }
}
