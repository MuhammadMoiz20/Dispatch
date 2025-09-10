import {
  Args,
  Field,
  InputType,
  ObjectType,
  Query,
  Resolver,
  Context,
  Float,
} from '@nestjs/graphql';
import type { AuthContext } from './security/jwt.context';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { pgQuery } from './pg';

@ObjectType()
class TimeSeriesPoint {
  @Field()
  t!: string;
  @Field()
  v!: number;
}

@ObjectType()
class KPISet {
  @Field()
  returnRatePct!: number;
  @Field()
  returnsCount!: number;
  @Field()
  refundsAmountCents!: number;
  @Field(() => Float, { nullable: true })
  avgApprovalMs?: number | null;
  @Field(() => Float, { nullable: true })
  avgRefundMs?: number | null;
}

@ObjectType()
class BreakdownItem {
  @Field()
  key!: string;
  @Field()
  value!: number;
}

@ObjectType()
class ReturnsOverview {
  @Field(() => KPISet)
  kpis!: KPISet;
  @Field(() => [TimeSeriesPoint])
  returnsByDay!: TimeSeriesPoint[];
  @Field(() => [BreakdownItem])
  reasons!: BreakdownItem[];
  @Field(() => [BreakdownItem])
  channels!: BreakdownItem[];
}

@ObjectType()
class RefundsOverview {
  @Field(() => [TimeSeriesPoint])
  amountByDay!: TimeSeriesPoint[];
  @Field(() => [TimeSeriesPoint])
  successRateByDay!: TimeSeriesPoint[];
  @Field(() => [BreakdownItem])
  providers!: BreakdownItem[];
}

@ObjectType()
class LabelsOverview {
  @Field(() => [TimeSeriesPoint])
  costByDay!: TimeSeriesPoint[];
  @Field(() => [BreakdownItem])
  carrierMix!: BreakdownItem[];
}

@ObjectType()
class OrdersOverview {
  @Field(() => [TimeSeriesPoint])
  ordersByDay!: TimeSeriesPoint[];
  @Field(() => [BreakdownItem])
  channels!: BreakdownItem[];
}

@ObjectType()
class WebhooksOverview {
  @Field(() => [TimeSeriesPoint])
  successRateByDay!: TimeSeriesPoint[];
  @Field(() => [BreakdownItem])
  deliveriesByStatus!: BreakdownItem[];
}

@InputType()
class AnalyticsRange {
  @Field()
  from!: string;
  @Field()
  to!: string;
  @Field({ defaultValue: 'day' })
  interval?: string;
}

@InputType()
class AnalyticsFilters {
  @Field({ nullable: true })
  channel?: string;
  @Field({ nullable: true })
  sku?: string;
  @Field({ nullable: true })
  reason?: string;
}

function getCH(): ClickHouseClient {
  return createClient({
    host: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  });
}

@Resolver()
export class AnalyticsResolver {
  @Query(() => ReturnsOverview)
  async analyticsReturns(
    @Args('range') range: AnalyticsRange,
    @Args('filters', { nullable: true }) filters?: AnalyticsFilters,
    @Context() ctx?: AuthContext,
  ): Promise<ReturnsOverview> {
    const tenantId = ctx?.user?.tenantId || '';
    const ch = getCH();
    const whereParts = [`tenant_id = {tenantId:String}`];
    if (filters?.channel) whereParts.push(`channel = {channel:String}`);
    if (filters?.reason) whereParts.push(`reason = {reason:String}`);
    const where = whereParts.join(' AND ');
    const params: any = { tenantId, channel: filters?.channel, reason: filters?.reason };

    let rows: { d: string; returns: number }[] = [];
    let orders: { d: string; orders: number }[] = [];
    let reasons: BreakdownItem[] = [] as any;
    let channels: BreakdownItem[] = [] as any;
    try {
      rows = await (
        await ch.query({
          query: `
            SELECT d, sum(initiated) AS returns
            FROM analytics.agg_returns_by_day
            WHERE ${where} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
            GROUP BY d ORDER BY d`,
          format: 'JSONEachRow',
          query_params: { ...params, from: range.from, to: range.to },
        })
      ).json<{ d: string; returns: number }>();

      orders = await (
        await ch.query({
          query: `
            SELECT d, sum(orders) AS orders
            FROM analytics.agg_orders_by_day
            WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
            GROUP BY d ORDER BY d`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<{ d: string; orders: number }>();

      reasons = (await (
        await ch.query({
          query: `
            SELECT reason AS key, sum(initiated) AS value
            FROM analytics.agg_returns_by_day
            WHERE ${where} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
            GROUP BY reason ORDER BY value DESC LIMIT 10`,
          format: 'JSONEachRow',
          query_params: { ...params, from: range.from, to: range.to },
        })
      ).json<BreakdownItem>()) as any;

      channels = (await (
        await ch.query({
          query: `
            SELECT channel AS key, sum(initiated) AS value
            FROM analytics.agg_returns_by_day
            WHERE ${where} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
            GROUP BY channel ORDER BY value DESC`,
          format: 'JSONEachRow',
          query_params: { ...params, from: range.from, to: range.to },
        })
      ).json<BreakdownItem>()) as any;
    } catch {
      // ignore, will fallback below
    }

    // Fallback to Postgres if ClickHouse has no data (or errored)
    if (!rows.length && !orders.length) {
      const pgFrom = `${range.from}T00:00:00.000Z`;
      const pgTo = `${range.to}T23:59:59.999Z`;
      const whereChan = filters?.channel ? 'AND o."channel" = $4' : '';
      const paramsOrders = filters?.channel
        ? [tenantId, pgFrom, pgTo, filters.channel]
        : [tenantId, pgFrom, pgTo];
      const paramsReturns = paramsOrders;

      const ordersSql = `
        SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, count(*)::int AS orders
        FROM orders."Order" o
        WHERE o."tenantId" = $1 AND o."createdAt" BETWEEN $2 AND $3 ${whereChan}
        GROUP BY 1 ORDER BY 1`;
      const returnsSql = `
        SELECT to_char(date_trunc('day', r."createdAt"), 'YYYY-MM-DD') AS d, count(*)::int AS returns
        FROM orders."Return" r
        JOIN orders."Order" o ON o."id" = r."orderId"
        WHERE r."tenantId" = $1 AND r."createdAt" BETWEEN $2 AND $3 ${whereChan}
        GROUP BY 1 ORDER BY 1`;
      const reasonsSql = `
        SELECT coalesce(r."reason", '') AS key, count(*)::int AS value
        FROM orders."Return" r
        JOIN orders."Order" o ON o."id" = r."orderId"
        WHERE r."tenantId" = $1 AND r."createdAt" BETWEEN $2 AND $3 ${whereChan}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`;
      const channelsSql = `
        SELECT coalesce(o."channel", '') AS key, count(*)::int AS value
        FROM orders."Return" r
        JOIN orders."Order" o ON o."id" = r."orderId"
        WHERE r."tenantId" = $1 AND r."createdAt" BETWEEN $2 AND $3 ${whereChan}
        GROUP BY 1 ORDER BY 2 DESC`;

      orders = await pgQuery<{ d: string; orders: number }>(ordersSql, paramsOrders as any);
      rows = await pgQuery<{ d: string; returns: number }>(returnsSql, paramsReturns as any);
      reasons = await pgQuery<BreakdownItem>(reasonsSql, paramsReturns as any);
      channels = await pgQuery<BreakdownItem>(channelsSql, paramsReturns as any);
    }

    const returnsByDay: TimeSeriesPoint[] = rows.map((r) => ({
      t: r.d,
      v: Number.isFinite(r.returns) ? r.returns : 0,
    }));
    const totalReturns = rows.reduce(
      (acc, curr) => acc + (Number.isFinite(curr.returns) ? curr.returns : 0),
      0,
    );
    const totalOrders = orders.reduce(
      (acc, curr) => acc + (Number.isFinite(curr.orders) ? curr.orders : 0),
      0,
    );
    const returnRatePct = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;

    // Latencies and refund $ from returns agg and refunds agg
    let lat: {
      sum_approval_ms: number;
      approvals: number;
      sum_refund_ms: number;
      refunds: number;
    }[] = [];
    let refunds: { amount: number }[] = [];
    try {
      lat = await (
        await ch.query({
          query: `
            SELECT sum(sum_approval_ms) AS sum_approval_ms, sum(approvals) AS approvals, sum(sum_refund_ms) AS sum_refund_ms, sum(refunds) AS refunds
            FROM analytics.agg_returns_by_day WHERE ${where} AND d BETWEEN toDate({from:String}) AND toDate({to:String})`,
          format: 'JSONEachRow',
          query_params: { ...params, from: range.from, to: range.to },
        })
      ).json<{
        sum_approval_ms: number;
        approvals: number;
        sum_refund_ms: number;
        refunds: number;
      }>();

      refunds = await (
        await ch.query({
          query: `SELECT sum(amount_cents_sum) AS amount FROM analytics.agg_refunds_by_day WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String})`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<{ amount: number }>();
    } catch {
      // Fallback to PG for latencies and refunds amount
      const pgFrom = `${range.from}T00:00:00.000Z`;
      const pgTo = `${range.to}T23:59:59.999Z`;
      const whereChan = filters?.channel ? 'AND o."channel" = $4' : '';
      const params = filters?.channel
        ? [tenantId, pgFrom, pgTo, filters.channel]
        : [tenantId, pgFrom, pgTo];
      const approvalSql = `
        SELECT coalesce(sum(EXTRACT(EPOCH FROM (l."createdAt" - r."createdAt"))*1000)::bigint,0) as sum_approval_ms,
               count(l."id")::int as approvals,
               0::bigint as sum_refund_ms,
               0::int as refunds
        FROM orders."Return" r
        JOIN orders."Order" o ON o."id" = r."orderId"
        JOIN orders."Label" l ON l."returnId" = r."id"
        WHERE r."tenantId" = $1 AND r."createdAt" BETWEEN $2 AND $3 ${whereChan}`;
      const refundLatSql = `
        SELECT coalesce(sum(EXTRACT(EPOCH FROM (f."updatedAt" - r."createdAt"))*1000)::bigint,0) as sum_refund_ms,
               count(f."id")::int as refunds
        FROM orders."Refund" f
        JOIN orders."Return" r ON r."id" = f."returnId"
        JOIN orders."Order" o ON o."id" = r."orderId"
        WHERE f."tenantId" = $1 AND f."status" = 'succeeded' AND f."updatedAt" BETWEEN $2 AND $3 ${whereChan}`;
      const amtSql = `
        SELECT coalesce(sum(f."amountCents")::bigint,0) as amount
        FROM orders."Refund" f
        WHERE f."tenantId" = $1 AND f."updatedAt" BETWEEN $2 AND $3`;
      const a = await pgQuery<any>(approvalSql, params as any);
      const rlat = await pgQuery<any>(refundLatSql, params as any);
      const am = await pgQuery<any>(amtSql, [tenantId, pgFrom, pgTo] as any);
      lat = [
        {
          sum_approval_ms: Number(a[0]?.sum_approval_ms || 0),
          approvals: Number(a[0]?.approvals || 0),
          sum_refund_ms: Number(rlat[0]?.sum_refund_ms || 0),
          refunds: Number(rlat[0]?.refunds || 0),
        },
      ];
      refunds = [{ amount: Number(am[0]?.amount || 0) }];
    }

    const avgApprovalMsCalc = lat[0]?.approvals
      ? (lat[0].sum_approval_ms as any) / (lat[0].approvals as any)
      : null;
    const avgRefundMsCalc = lat[0]?.refunds
      ? (lat[0].sum_refund_ms as any) / (lat[0].refunds as any)
      : null;
    const avgApprovalMs = Number.isFinite(avgApprovalMsCalc as any)
      ? (avgApprovalMsCalc as number)
      : null;
    const avgRefundMs = Number.isFinite(avgRefundMsCalc as any)
      ? (avgRefundMsCalc as number)
      : null;
    const refundsAmountCents = refunds[0]?.amount || 0;

    const safeReasons: BreakdownItem[] = (reasons as any[]).map((r) => ({
      key: (r.key ?? '') as string,
      value: Number.isFinite(r.value) ? (r.value as number) : 0,
    }));
    const safeChannels: BreakdownItem[] = (channels as any[]).map((r) => ({
      key: (r.key ?? '') as string,
      value: Number.isFinite(r.value) ? (r.value as number) : 0,
    }));

    return {
      kpis: {
        returnRatePct: Number.isFinite(returnRatePct) ? returnRatePct : 0,
        returnsCount: Number.isFinite(totalReturns) ? totalReturns : 0,
        refundsAmountCents: Number.isFinite(refundsAmountCents) ? refundsAmountCents : 0,
        avgApprovalMs: avgApprovalMs ?? null,
        avgRefundMs: avgRefundMs ?? null,
      },
      returnsByDay,
      reasons: safeReasons,
      channels: safeChannels,
    };
  }

  @Query(() => OrdersOverview)
  async analyticsOrders(
    @Args('range') range: AnalyticsRange,
    @Args('filters', { nullable: true }) filters?: AnalyticsFilters,
    @Context() ctx?: AuthContext,
  ): Promise<OrdersOverview> {
    const tenantId = ctx?.user?.tenantId || '';
    const ch = getCH();
    const whereParts = [`tenant_id = {tenantId:String}`];
    if (filters?.channel) whereParts.push(`channel = {channel:String}`);
    const where = whereParts.join(' AND ');
    const params: any = { tenantId, channel: filters?.channel };

    let byDay: { d: string; orders: number }[] = [];
    let byChannel: BreakdownItem[] = [] as any;
    try {
      byDay = await (
        await ch.query({
          query: `
            SELECT d, sum(orders) AS orders
            FROM analytics.agg_orders_by_day
            WHERE ${where} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
            GROUP BY d ORDER BY d`,
          format: 'JSONEachRow',
          query_params: { ...params, from: range.from, to: range.to },
        })
      ).json<{ d: string; orders: number }>();

      byChannel = (await (
        await ch.query({
          query: `
            SELECT channel AS key, sum(orders) AS value
            FROM analytics.agg_orders_by_day
            WHERE ${where} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
            GROUP BY channel ORDER BY value DESC`,
          format: 'JSONEachRow',
          query_params: { ...params, from: range.from, to: range.to },
        })
      ).json<BreakdownItem>()) as any;
    } catch {
      // ignore errors and fallback
    }

    if (!byDay.length) {
      const pgFrom = `${range.from}T00:00:00.000Z`;
      const pgTo = `${range.to}T23:59:59.999Z`;
      const whereChan = filters?.channel ? 'AND o."channel" = $4' : '';
      const paramsList = filters?.channel
        ? [tenantId, pgFrom, pgTo, filters.channel]
        : [tenantId, pgFrom, pgTo];
      const byDaySql = `
        SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, count(*)::int AS orders
        FROM orders."Order" o
        WHERE o."tenantId" = $1 AND o."createdAt" BETWEEN $2 AND $3 ${whereChan}
        GROUP BY 1 ORDER BY 1`;
      const byChanSql = `
        SELECT coalesce(o."channel", '') AS key, count(*)::int AS value
        FROM orders."Order" o
        WHERE o."tenantId" = $1 AND o."createdAt" BETWEEN $2 AND $3 ${whereChan}
        GROUP BY 1 ORDER BY 2 DESC`;
      byDay = await pgQuery<{ d: string; orders: number }>(byDaySql, paramsList as any);
      byChannel = await pgQuery<BreakdownItem>(byChanSql, paramsList as any);
    }

    const ordersByDay: TimeSeriesPoint[] = byDay.map((r) => ({
      t: r.d,
      v: Number.isFinite(r.orders) ? r.orders : 0,
    }));
    const channels: BreakdownItem[] = (byChannel as any[]).map((r) => ({
      key: (r.key ?? '') as string,
      value: Number.isFinite(r.value) ? (r.value as number) : 0,
    }));

    return { ordersByDay, channels };
  }

  @Query(() => RefundsOverview)
  async analyticsRefunds(
    @Args('range') range: AnalyticsRange,
    @Context() ctx?: AuthContext,
  ): Promise<RefundsOverview> {
    const tenantId = ctx?.user?.tenantId || '';
    const ch = getCH();
    let amountRows: { d: string; amt: number }[] = [];
    let succRows: { d: string; succ: number; total: number }[] = [];
    let providers: BreakdownItem[] = [] as any;
    try {
      amountRows = await (
        await ch.query({
          query: `SELECT d, sum(amount_cents_sum) AS amt FROM analytics.agg_refunds_by_day WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String}) GROUP BY d ORDER BY d`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<{ d: string; amt: number }>();
      succRows = await (
        await ch.query({
          query: `SELECT d, sumIf(count, status='succeeded') AS succ, sum(count) AS total FROM analytics.agg_refunds_by_day WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String}) GROUP BY d ORDER BY d`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<{ d: string; succ: number; total: number }>();
      providers = (await (
        await ch.query({
          query: `SELECT provider AS key, sum(count) AS value FROM analytics.agg_refunds_by_day WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String}) GROUP BY provider ORDER BY value DESC`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<BreakdownItem>()) as any;
    } catch {
      const pgFrom = `${range.from}T00:00:00.000Z`;
      const pgTo = `${range.to}T23:59:59.999Z`;
      const amountSql = `
        SELECT to_char(date_trunc('day', f."updatedAt"), 'YYYY-MM-DD') AS d, coalesce(sum(f."amountCents")::bigint,0) AS amt
        FROM orders."Refund" f
        WHERE f."tenantId" = $1 AND f."updatedAt" BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 1`;
      const succSql = `
        SELECT to_char(date_trunc('day', f."updatedAt"), 'YYYY-MM-DD') AS d,
               count(*) FILTER (WHERE f."status" = 'succeeded')::int AS succ,
               count(*)::int AS total
        FROM orders."Refund" f
        WHERE f."tenantId" = $1 AND f."updatedAt" BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 1`;
      const provSql = `
        SELECT coalesce(f."provider", '') AS key, count(*)::int AS value
        FROM orders."Refund" f
        WHERE f."tenantId" = $1 AND f."updatedAt" BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 2 DESC`;
      amountRows = await pgQuery(amountSql, [tenantId, pgFrom, pgTo] as any);
      succRows = await pgQuery(succSql, [tenantId, pgFrom, pgTo] as any);
      providers = await pgQuery(provSql, [tenantId, pgFrom, pgTo] as any);
    }
    const amountByDay = amountRows.map((r) => ({ t: r.d, v: Number.isFinite(r.amt) ? r.amt : 0 }));
    const successRateByDay = succRows.map((r) => {
      const delivered = Number.isFinite(r.succ) ? r.succ : 0;
      const total = Number.isFinite(r.total) ? r.total : 0;
      const v = total > 0 ? (delivered / total) * 100 : 0;
      return { t: r.d, v: Number.isFinite(v) ? v : 0 };
    });
    const safeProviders: BreakdownItem[] = (providers as any[]).map((p) => ({
      key: (p.key ?? '') as string,
      value: Number.isFinite(p.value) ? (p.value as number) : 0,
    }));
    return {
      amountByDay,
      successRateByDay,
      providers: safeProviders,
    };
  }

  @Query(() => LabelsOverview)
  async analyticsLabels(
    @Args('range') range: AnalyticsRange,
    @Context() ctx?: AuthContext,
  ): Promise<LabelsOverview> {
    const tenantId = ctx?.user?.tenantId || '';
    const ch = getCH();
    let costRows: { d: string; cost: number }[] = [];
    let mix: BreakdownItem[] = [] as any;
    try {
      costRows = await (
        await ch.query({
          query: `SELECT d, sum(total_cost_cents) AS cost FROM analytics.agg_label_costs_by_day WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String}) GROUP BY d ORDER BY d`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<{ d: string; cost: number }>();
      mix = (await (
        await ch.query({
          query: `SELECT concat(carrier, ' ', service) AS key, sum(labels) AS value FROM analytics.agg_label_costs_by_day WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String}) GROUP BY carrier, service ORDER BY value DESC`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<BreakdownItem>()) as any;
    } catch {
      const pgFrom = `${range.from}T00:00:00.000Z`;
      const pgTo = `${range.to}T23:59:59.999Z`;
      const costSql = `
        SELECT to_char(date_trunc('day', l."createdAt"), 'YYYY-MM-DD') AS d, coalesce(sum(l."costCents")::bigint,0) AS cost
        FROM orders."Label" l
        WHERE l."tenantId" = $1 AND l."createdAt" BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 1`;
      const mixSql = `
        SELECT (l."carrier" || ' ' || l."service") AS key, count(*)::int AS value
        FROM orders."Label" l
        WHERE l."tenantId" = $1 AND l."createdAt" BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 2 DESC`;
      costRows = await pgQuery(costSql, [tenantId, pgFrom, pgTo] as any);
      mix = await pgQuery(mixSql, [tenantId, pgFrom, pgTo] as any);
    }
    const costByDay = costRows.map((r) => ({ t: r.d, v: Number.isFinite(r.cost) ? r.cost : 0 }));
    const carrierMix: BreakdownItem[] = (mix as any[]).map((m) => ({
      key: (m.key ?? '') as string,
      value: Number.isFinite(m.value) ? (m.value as number) : 0,
    }));
    return {
      costByDay,
      carrierMix,
    };
  }

  @Query(() => WebhooksOverview)
  async analyticsWebhooks(
    @Args('range') range: AnalyticsRange,
    @Context() ctx?: AuthContext,
  ): Promise<WebhooksOverview> {
    const tenantId = ctx?.user?.tenantId || '';
    const ch = getCH();
    let succ: { d: string; delivered: number; total: number }[] = [];
    let breakdown: BreakdownItem[] = [] as any;
    try {
      succ = await (
        await ch.query({
          query: `SELECT d, sumIf(deliveries, status='delivered') AS delivered, sum(deliveries) AS total FROM analytics.agg_webhooks_by_day WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String}) GROUP BY d ORDER BY d`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<{ d: string; delivered: number; total: number }>();
      breakdown = (await (
        await ch.query({
          query: `SELECT status AS key, sum(deliveries) AS value FROM analytics.agg_webhooks_by_day WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String}) GROUP BY status ORDER BY value DESC`,
          format: 'JSONEachRow',
          query_params: { tenantId, from: range.from, to: range.to },
        })
      ).json<BreakdownItem>()) as any;
    } catch {
      const pgFrom = `${range.from}T00:00:00.000Z`;
      const pgTo = `${range.to}T23:59:59.999Z`;
      const succSql = `
        SELECT to_char(date_trunc('day', d."updatedAt"), 'YYYY-MM-DD') AS d,
               count(*) FILTER (WHERE d."status" = 'delivered')::int AS delivered,
               count(*)::int AS total
        FROM webhooks."Delivery" d
        WHERE d."tenantId" = $1 AND d."updatedAt" BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 1`;
      const brSql = `
        SELECT coalesce(d."status", '') AS key, count(*)::int AS value
        FROM webhooks."Delivery" d
        WHERE d."tenantId" = $1 AND d."updatedAt" BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 2 DESC`;
      succ = await pgQuery(succSql, [tenantId, pgFrom, pgTo] as any);
      breakdown = await pgQuery(brSql, [tenantId, pgFrom, pgTo] as any);
    }
    const successRateByDay = succ.map((r) => {
      const delivered = Number.isFinite(r.delivered) ? r.delivered : 0;
      const total = Number.isFinite(r.total) ? r.total : 0;
      const v = total > 0 ? (delivered / total) * 100 : 0;
      return { t: r.d, v: Number.isFinite(v) ? v : 0 };
    });
    const deliveriesByStatus: BreakdownItem[] = (breakdown as any[]).map((b) => ({
      key: (b.key ?? '') as string,
      value: Number.isFinite(b.value) ? (b.value as number) : 0,
    }));
    return {
      successRateByDay,
      deliveriesByStatus,
    };
  }
}
