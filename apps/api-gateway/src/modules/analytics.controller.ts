import { Controller, Get, Query, Res, Headers, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { createClient } from '@clickhouse/client';
import jwt from 'jsonwebtoken';

function getCH() {
  return createClient({
    host: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  });
}

@Controller('/v1/analytics')
export class AnalyticsController {
  private getTenantIdFromAuth(auth?: string): string {
    if (!auth) throw new UnauthorizedException('Missing Authorization');
    const [scheme, token] = auth.split(' ');
    if ((scheme || '').toLowerCase() !== 'bearer' || !token)
      throw new UnauthorizedException('Invalid Authorization');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
      const tenantId = decoded?.tenantId;
      if (!tenantId) throw new UnauthorizedException('Invalid token');
      return tenantId;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Get('/returns.csv')
  async returnsCsv(
    @Query() q: any,
    @Headers('authorization') auth: string | undefined,
    @Res() res: Response,
  ) {
    const tenantId = this.getTenantIdFromAuth(auth);
    const { from, to, channel, reason } = q;
    const ch = getCH();
    const whereParts = [`tenant_id = {tenantId:String}`];
    if (channel) whereParts.push(`channel = {channel:String}`);
    if (reason) whereParts.push(`reason = {reason:String}`);
    const where = whereParts.join(' AND ');
    const rsp = await ch.query({
      query: `
        SELECT d as date, channel, reason, initiated, label_generated, in_transit, delivered, inspected, refunded,
               if(approvals>0, sum_approval_ms/approvals, 0) as avg_approval_ms,
               if(refunds>0, sum_refund_ms/refunds, 0) as avg_refund_ms
        FROM analytics.agg_returns_by_day
        WHERE ${where} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
        ORDER BY d FORMAT CSVWithNames`,
      query_params: { tenantId, channel, reason, from, to },
    });
    res.setHeader('Content-Type', 'text/csv');
    res.send(await rsp.text());
  }

  @Get('/refunds.csv')
  async refundsCsv(
    @Query() q: any,
    @Headers('authorization') auth: string | undefined,
    @Res() res: Response,
  ) {
    const tenantId = this.getTenantIdFromAuth(auth);
    const { from, to } = q;
    const ch = getCH();
    const rsp = await ch.query({
      query: `
        SELECT d as date, provider, status, count, amount_cents_sum, if(count>0, sum_latency_ms/count, 0) as avg_latency_ms
        FROM analytics.agg_refunds_by_day
        WHERE tenant_id = {tenantId:String} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
        ORDER BY d FORMAT CSVWithNames`,
      query_params: { tenantId, from, to },
    });
    res.setHeader('Content-Type', 'text/csv');
    res.send(await rsp.text());
  }

  @Get('/labels.csv')
  async labelsCsv(
    @Query() q: any,
    @Headers('authorization') auth: string | undefined,
    @Res() res: Response,
  ) {
    const tenantId = this.getTenantIdFromAuth(auth);
    const { from, to, carrier, service } = q;
    const whereParts = [`tenant_id = {tenantId:String}`];
    if (carrier) whereParts.push(`carrier = {carrier:String}`);
    if (service) whereParts.push(`service = {service:String}`);
    const where = whereParts.join(' AND ');
    const ch = getCH();
    const rsp = await ch.query({
      query: `
        SELECT d as date, carrier, service, labels, total_cost_cents, if(labels>0, total_cost_cents/labels, 0) as avg_cost_cents
        FROM analytics.agg_label_costs_by_day
        WHERE ${where} AND d BETWEEN toDate({from:String}) AND toDate({to:String})
        ORDER BY d FORMAT CSVWithNames`,
      query_params: { tenantId, from, to, carrier, service },
    });
    res.setHeader('Content-Type', 'text/csv');
    res.send(await rsp.text());
  }
}
