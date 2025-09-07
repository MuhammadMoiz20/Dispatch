import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppResolver } from './app.resolver';
import { AuthResolver } from './auth.resolver';
import { OrdersResolver } from './orders.resolver';
import { APP_GUARD } from '@nestjs/core';
import { GqlModuleOptions } from '@nestjs/graphql';
import { JwtAuthGuard } from './security/jwt.guard';
import { getContext } from './security/jwt.context';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig & GqlModuleOptions>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      context: getContext,
    }),
  ],
  providers: [
    AppResolver,
    AuthResolver,
    OrdersResolver,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}