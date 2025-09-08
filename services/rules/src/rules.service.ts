import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import jwt from 'jsonwebtoken';
import { createRabbitMQ } from '@dispatch/messaging';
import axios from 'axios';
import { evaluate } from './evaluator';
import { ruleActionsTotal } from './metrics.controller';

const DEFAULT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export type RuleRecord = {
  id: string;
  tenantId: string;
  name: string;
  enabled: boolean;
  condition: any;
  actions: any[];
  priority: number;
  createdAt: Date;
};

@Injectable()
export class RulesService {
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  private ordersBase = process.env.ORDERS_URL || 'http://127.0.0.1:4002';
  constructor(private prisma: PrismaService) {}

  getTenantIdFromAuth(authHeader?: string): string {
    if (!authHeader) throw new UnauthorizedException('Missing Authorization');
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException('Invalid Authorization');
    try {
      const decoded = jwt.verify(token, DEFAULT_SECRET) as any;
      const tenantId = decoded?.tenantId;
      if (!tenantId) throw new UnauthorizedException('Invalid token');
      return tenantId;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async listRules(tenantId: string): Promise<RuleRecord[]> {
    const rows = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.rule.findMany({ where: { tenantId }, orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }] }),
    );
    return rows as any;
  }

  async getRule(tenantId: string, id: string): Promise<RuleRecord | null> {
    const r = await (this.prisma as any).rule.findUnique({ where: { id } });
    if (!r || r.tenantId !== tenantId) return null;
    return r as any;
  }

  async createRule(tenantId: string, input: { name: string; enabled?: boolean; condition: any; actions: any[]; priority?: number }) {
    const r = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.rule.create({
        data: { tenantId, name: input.name, enabled: input.enabled ?? true, condition: input.condition, actions: input.actions, priority: input.priority ?? 100 },
      }),
    );
    return r as any;
  }

  async updateRule(tenantId: string, id: string, input: Partial<{ name: string; enabled: boolean; condition: any; actions: any[]; priority: number }>) {
    const existing = await (this.prisma as any).rule.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) throw new UnauthorizedException('Not found');
    const r = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) => tx.rule.update({ where: { id }, data: input }));
    return r as any;
  }

  async deleteRule(tenantId: string, id: string) {
    const existing = await (this.prisma as any).rule.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) return { ok: false };
    await (this.prisma as any).runWithTenant(tenantId, async (tx: any) => tx.rule.delete({ where: { id } }));
    return { ok: true };
  }

  async evaluateAndAct(tenantId: string, context: any): Promise<{ triggered: RuleRecord[] }> {
    const rules = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.rule.findMany({ where: { tenantId, enabled: true }, orderBy: [{ priority: 'asc' }] }),
    );
    const triggered: RuleRecord[] = [];
    for (const rule of rules) {
      try {
        const ok = evaluate(rule.condition as any, context);
        if (ok) {
          triggered.push(rule as any);
          await this.publish('rule.triggered', { tenantId, ruleId: rule.id, name: rule.name, at: new Date().toISOString(), contextSummary: summarizeContext(context) });
          for (const action of (rule.actions as any[])) {
            await this.executeAction(action, { tenantId, context });
          }
        }
      } catch (e) {
        // ignore individual rule errors for now
      }
    }
    return { triggered };
  }

  private async executeAction(action: any, env: { tenantId: string; context: any }) {
    const type = typeof action === 'string' ? action : action?.type;
    if (!type) return;
    switch (type) {
      case 'approve_return':
        await this.retry(async () => {
          const id = env.context?.return?.id || action?.returnId;
          if (!id) throw new Error('approve_return requires context.return.id');
          await axios.post(`${this.ordersBase}/v1/returns/${id}/approve`);
        }, 3, 200);
        ruleActionsTotal.inc({ action: 'approve_return' });
        await this.publish('rule.action.executed', { action: 'approve_return', tenantId: env.tenantId, at: new Date().toISOString(), returnId: env.context?.return?.id });
        break;
      case 'issue_store_credit':
        // Stub: acknowledge action
        ruleActionsTotal.inc({ action: 'issue_store_credit' });
        await this.publish('rule.action.executed', { action: 'issue_store_credit', tenantId: env.tenantId, at: new Date().toISOString() });
        break;
      case 'notify':
        ruleActionsTotal.inc({ action: 'notify' });
        await this.publish('rule.action.executed', { action: 'notify', tenantId: env.tenantId, at: new Date().toISOString(), to: action?.to });
        break;
      default:
        // unknown actions are ignored for now
        break;
    }
  }

  private async retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 200): Promise<T> {
    let err: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        err = e;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
    throw err;
  }

  private async publish(queue: string, message: object) {
    try {
      await (this.prisma as any).outbox.create({ data: { tenantId: (message as any)?.tenantId, type: queue, payload: message } });
    } catch {}
  }
}

function summarizeContext(ctx: any) {
  return {
    return: ctx?.return ? { id: ctx.return.id, reason: ctx.return.reason, state: ctx.return.state } : undefined,
    customer: ctx?.customer ? { id: ctx.customer.id, order_count: ctx.customer.order_count } : undefined,
  };
}
