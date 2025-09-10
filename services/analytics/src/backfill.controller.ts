import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BackfillService } from './backfill.service';

@Controller('/backfill')
export class BackfillController {
  constructor(private svc: BackfillService) {}

  @Get()
  async run(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tenantId') tenantId: string | undefined,
    @Res() res: Response,
  ) {
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });
    }
    await this.svc.backfill({ from, to, tenantId });
    return res.json({ ok: true });
  }
}
