import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppResolver } from './app.resolver';
import { AuthResolver } from './auth.resolver';
import { OrdersResolver } from './orders.resolver';
import { ReturnsResolver } from './returns.resolver';
import { WebhooksResolver } from './webhooks.resolver';
import { LabelsResolver } from './labels.resolver';
import { APP_GUARD } from '@nestjs/core';
import { GqlModuleOptions } from '@nestjs/graphql';
import { JwtAuthGuard } from './security/jwt.guard';
import { getContext } from './security/jwt.context';
import { SubscriptionsResolver } from './subscriptions.resolver';
import { SubscriptionsService } from './subscriptions.service';
import { subscriptionClientsGauge, MetricsController } from './metrics.controller';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig & GqlModuleOptions>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      context: getContext,
      subscriptions: {
        'graphql-ws': {
          path: '/graphql',
          onConnect: async (_ctx: any) => {
            try { subscriptionClientsGauge.inc(); } catch {}
          },
          onDisconnect: async (_ctx: any, _code: any) => {
            try { subscriptionClientsGauge.dec(); } catch {}
          },
        } as any,
      },
    }),
  ],
  providers: [
    AppResolver,
    AuthResolver,
    OrdersResolver,
    ReturnsResolver,
    WebhooksResolver,
    LabelsResolver,
    SubscriptionsResolver,
    SubscriptionsService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  controllers: [MetricsController],
})
export class AppModule {}
