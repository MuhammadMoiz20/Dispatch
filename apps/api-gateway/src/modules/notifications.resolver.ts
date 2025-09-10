import { Args, Field, ObjectType, Query, Resolver, Mutation, Context } from '@nestjs/graphql';
import { Roles } from './security/roles.decorator';
import axios from 'axios';
import type { AuthContext } from './security/jwt.context';

@ObjectType()
class TemplateGql {
  @Field()
  id!: string;
  @Field()
  tenantId!: string;
  @Field()
  name!: string;
  @Field()
  event!: string;
  @Field()
  channel!: string;
  @Field({ nullable: true })
  subject?: string;
  @Field()
  body!: string;
}

@ObjectType()
class TemplatesListGql {
  @Field(() => [TemplateGql])
  items!: TemplateGql[];
}

@ObjectType()
class PreferenceGql {
  @Field()
  id!: string;
  @Field()
  tenantId!: string;
  @Field({ nullable: true })
  userId?: string;
  @Field()
  event!: string;
  @Field()
  emailEnabled!: boolean;
  @Field()
  smsEnabled!: boolean;
  @Field({ nullable: true })
  emailTemplateId?: string;
  @Field({ nullable: true })
  smsTemplateId?: string;
}

@Resolver()
export class NotificationsResolver {
  private base = process.env.NOTIFICATIONS_URL || 'http://127.0.0.1:4006';

  @Query(() => TemplatesListGql)
  async notificationTemplates(
    @Args('event', { type: () => String, nullable: true }) event: string | undefined,
    @Args('channel', { type: () => String, nullable: true }) channel: string | undefined,
    @Context() ctx: AuthContext,
  ): Promise<TemplatesListGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const tenantId = ctx?.user?.tenantId;
    const res = await axios.get(`${this.base}/v1/templates`, {
      params: { tenantId, event, channel },
      headers: auth ? { Authorization: auth } : undefined,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to fetch templates');
    return res.data as TemplatesListGql;
  }

  @Mutation(() => TemplateGql)
  @Roles('owner', 'admin')
  async createNotificationTemplate(
    @Args('tenantId', { type: () => String }) tenantId: string,
    @Args('name', { type: () => String }) name: string,
    @Args('event', { type: () => String }) event: string,
    @Args('channel', { type: () => String }) channel: string,
    @Args('body', { type: () => String }) body: string,
    @Args('subject', { type: () => String, nullable: true }) subject?: string,
    @Context() ctx?: AuthContext,
  ): Promise<TemplateGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.post(
      `${this.base}/v1/templates`,
      { tenantId, name, event, channel, body, subject },
      { headers: auth ? { Authorization: auth } : undefined, validateStatus: () => true },
    );
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to create template');
    try {
      await axios.post(
        `${process.env.USERS_URL || 'http://127.0.0.1:4001'}/v1/audit`,
        {
          action: 'template.create',
          resource: 'notification_template',
          resourceId: (res.data as any).id,
        },
        {
          headers: ctx?.req?.headers?.authorization
            ? { Authorization: ctx!.req!.headers!.authorization }
            : undefined,
        },
      );
    } catch (err) {
      // Audit logging is best-effort; ignore failures
    }
    return res.data as TemplateGql;
  }

  @Mutation(() => PreferenceGql)
  @Roles('owner', 'admin')
  async upsertNotificationPreference(
    @Args('tenantId', { type: () => String }) tenantId: string,
    @Args('event', { type: () => String }) event: string,
    @Args('userId', { type: () => String, nullable: true }) userId?: string,
    @Args('emailEnabled', { type: () => Boolean, nullable: true }) emailEnabled?: boolean,
    @Args('smsEnabled', { type: () => Boolean, nullable: true }) smsEnabled?: boolean,
    @Args('emailTemplateId', { type: () => String, nullable: true }) emailTemplateId?: string,
    @Args('smsTemplateId', { type: () => String, nullable: true }) smsTemplateId?: string,
    @Context() ctx?: AuthContext,
  ): Promise<PreferenceGql> {
    const auth = ctx?.req?.headers?.authorization as string | undefined;
    const res = await axios.post(
      `${this.base}/v1/preferences`,
      {
        tenantId,
        event,
        userId: userId || null,
        emailEnabled,
        smsEnabled,
        emailTemplateId,
        smsTemplateId,
      },
      { headers: auth ? { Authorization: auth } : undefined, validateStatus: () => true },
    );
    if (res.status >= 400) throw new Error(res.data?.message || 'Failed to upsert preference');
    try {
      await axios.post(
        `${process.env.USERS_URL || 'http://127.0.0.1:4001'}/v1/audit`,
        {
          action: 'preference.upsert',
          resource: 'notification_preference',
          resourceId: (res.data as any).id,
        },
        {
          headers: ctx?.req?.headers?.authorization
            ? { Authorization: ctx!.req!.headers!.authorization }
            : undefined,
        },
      );
    } catch (err) {
      // Audit logging is best-effort; ignore failures
    }
    return res.data as PreferenceGql;
  }
}
