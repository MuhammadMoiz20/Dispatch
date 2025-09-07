import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, Module, Controller, Get, Post, Body } from '@nestjs/common';
import { loadConfig } from '@dispatch/config';
import { httpLogger } from '@dispatch/logger';
import { idempotencyMiddleware } from '@dispatch/idempotency';
import { returnsMachine } from '@dispatch/workflows/src/returns.machine';

@Controller('/health')
class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'orders' };
  }
}

@Controller('/v1/returns')
class ReturnsController {
  @Post('/initiate')
  initiate(@Body() body: any) {
    // placeholder using returnsMachine for visibility
    const state = returnsMachine.initialState.value;
    return { ok: true, state, input: body };
  }
}

@Module({ controllers: [HealthController, ReturnsController] })
class AppModule {}

async function bootstrap() {
  const config = loadConfig({ SERVICE_NAME: 'orders' });
  const app = await NestFactory.create(AppModule);
  app.use(httpLogger());
  app.use(idempotencyMiddleware());

  await app.listen(process.env.PORT || config.PORT || 4002);
  Logger.log(`orders service listening on :${process.env.PORT || config.PORT || 4002}`);
}

bootstrap();

