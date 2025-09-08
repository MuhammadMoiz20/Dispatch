import { Args, Field, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import axios from 'axios';

function mapHttpToGqlError(code: string, status: number, data: any): Error {
  const message = data?.message || data?.error || 'Request failed';
  const err = new Error(message);
  (err as any).extensions = { code, httpStatus: status, details: data };
  return err;
}

@ObjectType()
class LabelGql {
  @Field()
  id!: string;
  @Field()
  returnId!: string;
  @Field()
  carrier!: string;
  @Field()
  service!: string;
  @Field()
  currency!: string;
  @Field()
  downloadUrl!: string;
  @Field()
  createdAt!: string;
  @Field()
  costCents!: number;
}

@Resolver()
export class LabelsResolver {
  private ordersBase = process.env.ORDERS_URL || 'http://127.0.0.1:4002';

  @Mutation(() => LabelGql)
  async generateReturnLabel(
    @Args('returnId') returnId: string,
    @Args('carrier', { nullable: true }) carrier?: string,
    @Args('service', { nullable: true }) service?: string,
  ): Promise<LabelGql> {
    const res = await axios.post(
      `${this.ordersBase}/v1/returns/${returnId}/label`,
      carrier || service ? { carrier, service } : undefined,
      { validateStatus: () => true },
    );
    if (res.status >= 400) throw mapHttpToGqlError('LABEL_CREATE_FAILED', res.status, res.data);
    const l = res.data;
    return { ...l, createdAt: new Date(l.createdAt).toISOString() };
  }

  @Query(() => LabelGql, { nullable: true })
  async returnLabel(@Args('id') id: string): Promise<LabelGql | null> {
    const res = await axios.get(`${this.ordersBase}/v1/returns/${id}/label`, { validateStatus: () => true });
    if (res.status === 404) return null;
    if (res.status >= 400) throw mapHttpToGqlError('LABEL_FETCH_FAILED', res.status, res.data);
    const l = res.data;
    return { ...l, createdAt: new Date(l.createdAt).toISOString() };
  }

  @Query(() => LabelGql, { nullable: true })
  async labelByReturn(@Args('returnId') returnId: string): Promise<LabelGql | null> {
    return this.returnLabel(returnId);
  }
}

