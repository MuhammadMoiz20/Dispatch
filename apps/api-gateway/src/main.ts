import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './modules/app.module';
import { loadConfig } from '@dispatch/config';

async function bootstrap() {
  const config = loadConfig({ SERVICE_NAME: 'api-gateway' });
  const app = await NestFactory.create(AppModule, { cors: true });
  await app.listen(config.PORT);
  Logger.log(`api-gateway listening on :${config.PORT}`);
}

bootstrap();

