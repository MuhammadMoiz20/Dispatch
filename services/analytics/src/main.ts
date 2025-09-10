import 'reflect-metadata';
import { Controller, Get, Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { IngestWorker } from './ingest.worker';
import { httpLogger } from '@dispatch/logger';
import { BackfillController } from './backfill.controller';
import { BackfillService } from './backfill.service';

@Controller('/health')
class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'analytics' };
  }
}

@Module({
  controllers: [HealthController, MetricsController, BackfillController],
  providers: [IngestWorker, BackfillService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  app.use(httpLogger());
  await app.listen(process.env.PORT || 4007);
  Logger.log(`analytics service listening on :${process.env.PORT || 4007}`);
}

bootstrap();
