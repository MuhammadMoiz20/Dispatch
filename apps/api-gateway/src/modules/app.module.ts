import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppResolver } from './app.resolver';
import { AuthResolver } from './auth.resolver';
import { OrdersResolver } from './orders.resolver';
import { ReturnsResolver } from './returns.resolver';
import { WebhooksResolver } from './webhooks.resolver';
import { LabelsResolver } from './labels.resolver';
import { RatesResolver } from './rates.resolver';
import { RefundsResolver } from './refunds.resolver';
import { APP_GUARD } from '@nestjs/core';
import { GqlModuleOptions } from '@nestjs/graphql';
import { JwtAuthGuard } from './security/jwt.guard';
import { getContext } from './security/jwt.context';
import { RolesGuard } from './security/roles.guard';
import { SubscriptionsResolver } from './subscriptions.resolver';
import { NotificationsResolver } from './notifications.resolver';
import { UsersAdminResolver } from './users-admin.resolver';
import { UsersResolver } from './users.resolver';
import { AnalyticsResolver } from './analytics.resolver';
import { SubscriptionsService } from './subscriptions.service';
import { subscriptionClientsGauge, MetricsController } from './metrics.controller';
import { AnalyticsController } from './analytics.controller';

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
            try {
              subscriptionClientsGauge.inc();
            } catch (err) {
              // Ignore metrics failures
            }
          },
          onDisconnect: async (_ctx: any, _code: any) => {
            try {
              subscriptionClientsGauge.dec();
            } catch (err) {
              // Ignore metrics failures
            }
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
    RatesResolver,
    RefundsResolver,
    SubscriptionsResolver,
    NotificationsResolver,
    UsersAdminResolver,
    UsersResolver,
    AnalyticsResolver,
    SubscriptionsService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  controllers: [MetricsController, AnalyticsController],
})
export class AppModule {}
