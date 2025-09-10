import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from './prisma.service';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { ordersWebhooksReceived, connectionsGauge } from './metrics.controller';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
// Secret for signing our state during OAuth
const APP_STATE_SECRET =
  process.env.SHOPIFY_STATE_SECRET || process.env.SHOPIFY_APP_SECRET || 'dev-app-secret';
// Shopify App credentials
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_APP_SECRET || '';
// Public base URL where Shopify redirects back and posts webhooks
const APP_BASE_URL = (process.env.SHOPIFY_APP_URL || 'http://localhost:14005').replace(/\/$/, '');
// Requested scopes (minimum to receive orders webhooks = read_orders). Adjust as needed.
const SHOPIFY_SCOPES = (process.env.SHOPIFY_SCOPES || 'read_orders')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .join(',');
// Shopify Admin API version to use for webhook registration
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';
const ORDERS_URL = process.env.ORDERS_URL || 'http://localhost:4002';

@Controller('/v1')
export class ShopifyController {
  constructor(private prisma: PrismaService) {}

  private getTenantFromAuth(auth?: string): string {
    if (!auth) throw new UnauthorizedException('Missing Authorization');
    const [scheme, token] = auth.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token)
      throw new UnauthorizedException('Invalid Authorization');
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const tenantId = decoded?.tenantId;
      if (!tenantId) throw new Error('Invalid token');
      return tenantId;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Get('/health')
  getHealth() {
    return { status: 'ok', service: 'shopify' };
  }

  // Step 1: Start install -> returns URL to our install handler including signed state (tenant + shop)
  @Post('/shopify/install/start')
  @HttpCode(HttpStatus.OK)
  async startInstall(@Body() body: { shop: string }, @Headers('authorization') auth?: string) {
    const tenantId = this.getTenantFromAuth(auth);
    const shop = (body?.shop || '').toLowerCase();
    if (!shop || !shop.includes('.myshopify.com')) {
      return { error: 'Invalid shop domain. Expected *.myshopify.com' };
    }
    const state = jwt.sign({ tenantId, shop, t: Date.now() }, APP_STATE_SECRET, {
      expiresIn: '10m',
    });
    const url = `/v1/shopify/install?shop=${encodeURIComponent(shop)}&state=${encodeURIComponent(state)}`;
    return { redirectUrl: url };
  }

  // Step 2: Install/Callback handler:
  // - If no code present, redirect the browser to Shopify's authorize URL
  // - If code present, verify HMAC + state, exchange for access token, store connection, register webhooks
  @Get('/shopify/install')
  @HttpCode(HttpStatus.OK)
  async install(
    @Query('shop') shop: string,
    @Query('state') state: string,
    @Query('code') code: string,
    @Query('hmac') hmac: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const decoded: any = jwt.verify(state, APP_STATE_SECRET);
      const tenantId = decoded?.tenantId;
      const shopLc = (shop || '').toLowerCase();
      if (!tenantId || decoded?.shop !== shopLc) throw new Error('state mismatch');

      // If no code param, redirect to Shopify's authorize URL to start OAuth
      if (!code) {
        if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET)
          throw new Error('Shopify app credentials not configured');
        const redirectUri = `${APP_BASE_URL}/v1/shopify/install`;
        const authorizeUrl = `https://${shopLc}/admin/oauth/authorize?client_id=${encodeURIComponent(
          SHOPIFY_API_KEY,
        )}&scope=${encodeURIComponent(SHOPIFY_SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
        res.status(302).setHeader('Location', authorizeUrl).send('Redirecting to Shopify...');
        return;
      }

      // Verify Shopify callback HMAC
      if (!this.verifyCallbackHmac(req.query as Record<string, any>, hmac)) {
        throw new Error('Invalid HMAC');
      }

      // Exchange code for access token
      const tokenResp = await axios.post(
        `https://${shopLc}/admin/oauth/access_token`,
        {
          client_id: SHOPIFY_API_KEY,
          client_secret: SHOPIFY_API_SECRET,
          code,
        },
        { headers: { 'Content-Type': 'application/json' } },
      );
      const accessToken: string = tokenResp.data?.access_token;
      const scope: string = tokenResp.data?.scope || SHOPIFY_SCOPES;
      if (!accessToken) throw new Error('Failed to obtain access token');

      const conn = await this.prisma.shopifyConnection.upsert({
        where: { tenantId_shop: { tenantId, shop: shopLc } },
        update: { accessToken, scopes: scope, status: 'active' },
        create: { tenantId, shop: shopLc, accessToken, scopes: scope, status: 'active' },
      });

      // Register webhooks (best effort)
      await this.registerWebhooks(shopLc, accessToken);

      // Update gauge (best effort)
      try {
        const count = await this.prisma.shopifyConnection.count({ where: { status: 'active' } });
        connectionsGauge.set(count);
      } catch {}
      res
        .status(200)
        .send(
          `<html><body><h3>Shopify connected</h3><p>Shop: ${conn.shop}</p><p>Scopes: ${conn.scopes || ''}</p></body></html>`,
        );
    } catch (e: any) {
      res
        .status(400)
        .send(
          `<html><body><h3>Install failed</h3><pre>${e?.message || 'error'}</pre></body></html>`,
        );
    }
  }

  // List connections for tenant
  @Get('/shopify/connections')
  @HttpCode(HttpStatus.OK)
  async listConnections(@Headers('authorization') auth?: string) {
    const tenantId = this.getTenantFromAuth(auth);
    const items = await this.prisma.shopifyConnection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }

  // Webhook: orders/create -> verify HMAC, ingest into orders service
  @Post('/shopify/webhooks/orders-create')
  @HttpCode(HttpStatus.OK)
  async ordersCreate(
    @Req() req: Request,
    @Headers('x-shopify-shop-domain') shop?: string,
    @Headers('x-shopify-hmac-sha256') hmac?: string,
    @Headers('x-shopify-topic') _topic?: string,
  ) {
    const raw = req.body as unknown as Buffer;
    if (!this.verifyWebhookHmac(raw, hmac)) return { ok: true };
    const body = this.safeParseJson(raw);
    const shopDomain = (shop || '').toLowerCase();
    if (!shopDomain) return { ok: true };
    const conn = await this.prisma.shopifyConnection.findFirst({ where: { shop: shopDomain } });
    if (!conn) return { ok: true };

    // Map Shopify order to our ingest format
    const externalId = String(body?.id || body?.name || body?.order_number || Date.now());
    const items = Array.isArray(body?.line_items)
      ? body.line_items.map((li: any) => ({
          sku: String(li?.sku || li?.title || 'unknown'),
          quantity: Number(li?.quantity || 1),
        }))
      : [];

    // Generate a short-lived JWT for orders ingest
    const token = jwt.sign({ tenantId: conn.tenantId, userId: 'shopify-app' }, JWT_SECRET, {
      expiresIn: '5m',
    });
    try {
      await axios.post(
        `${ORDERS_URL}/v1/orders/ingest`,
        { channel: 'shopify', externalId, items },
        { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true },
      );
    } catch {}
    // Update health timestamp
    try {
      await this.prisma.shopifyConnection.update({
        where: { id: conn.id },
        data: { lastWebhookAt: new Date() },
      });
    } catch {}
    ordersWebhooksReceived.inc();
    return { ok: true };
  }

  // Webhook: app/uninstalled -> mark connection revoked
  @Post('/shopify/webhooks/app-uninstalled')
  @HttpCode(HttpStatus.OK)
  async appUninstalled(
    @Req() req: Request,
    @Headers('x-shopify-shop-domain') shop?: string,
    @Headers('x-shopify-hmac-sha256') hmac?: string,
  ) {
    const raw = req.body as unknown as Buffer;
    if (!this.verifyWebhookHmac(raw, hmac)) return { ok: true };
    const shopDomain = (shop || '').toLowerCase();
    if (!shopDomain) return { ok: true };
    try {
      const existing = await this.prisma.shopifyConnection.findFirst({
        where: { shop: shopDomain },
      });
      if (existing) {
        await this.prisma.shopifyConnection.update({
          where: { id: existing.id },
          data: { status: 'revoked' },
        });
      }
    } catch {}
    return { ok: true };
  }

  // Helpers
  private verifyCallbackHmac(query: Record<string, any>, hmac?: string): boolean {
    try {
      if (!hmac || !SHOPIFY_API_SECRET) return false;
      const { hmac: _h, signature: _s, ...rest } = query as any;
      const message = Object.keys(rest)
        .sort()
        .map((k) => `${k}=${Array.isArray(rest[k]) ? rest[k].join(',') : rest[k]}`)
        .join('&');
      const computed = crypto
        .createHmac('sha256', SHOPIFY_API_SECRET)
        .update(message)
        .digest('hex');
      return computed === hmac;
    } catch {
      return false;
    }
  }

  private verifyWebhookHmac(rawBody: Buffer, headerHmac?: string): boolean {
    try {
      if (!headerHmac || !SHOPIFY_API_SECRET) return false;
      const digest = crypto
        .createHmac('sha256', SHOPIFY_API_SECRET)
        .update(rawBody)
        .digest('base64');
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(headerHmac));
    } catch {
      return false;
    }
  }

  private safeParseJson(raw: Buffer): any {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      return {};
    }
  }

  private async registerWebhooks(shop: string, accessToken: string) {
    const base = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}`;
    const headers = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };
    const addr = (path: string) => `${APP_BASE_URL}${path}`;
    const webhooks = [
      { topic: 'orders/create', address: addr('/v1/shopify/webhooks/orders-create') },
      { topic: 'app/uninstalled', address: addr('/v1/shopify/webhooks/app-uninstalled') },
    ];
    await Promise.all(
      webhooks.map((w) =>
        axios
          .post(
            `${base}/webhooks.json`,
            { webhook: { topic: w.topic, address: w.address, format: 'json' } },
            { headers, validateStatus: () => true },
          )
          .catch(() => undefined),
      ),
    );
  }
}
