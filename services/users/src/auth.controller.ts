import { Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto } from './auth.dto';
import { validateOrReject } from 'class-validator';
import { createLogger } from '@dispatch/logger';
import { authAttemptsTotal, authFailuresTotal, authSuccessTotal } from './metrics.controller';

const log = createLogger({ name: 'users-auth' });

@Controller('/v1/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('/signup')
  async signup(@Body() body: SignupDto) {
    await validateOrReject(Object.assign(new SignupDto(), body));
    const op = 'signup' as const;
    authAttemptsTotal.labels(op).inc();
    log.info({ event: 'auth_attempt', op, email: body.email, tenant_id: null }, 'Auth attempt');
    try {
      const result = await this.auth.signup(body);
      authSuccessTotal.labels(op).inc();
      log.info(
        { event: 'auth_success', op, email: body.email, user_id: result.userId, tenant_id: result.tenantId },
        'Auth success',
      );
      return result;
    } catch (e: any) {
      const reason = (e?.name || 'Error').toString().toLowerCase();
      authFailuresTotal.labels(op, reason).inc();
      log.warn({ event: 'auth_failure', op, email: body.email, tenant_id: null, reason }, 'Auth failure');
      throw e;
    }
  }

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    await validateOrReject(Object.assign(new LoginDto(), body));
    const op = 'login' as const;
    authAttemptsTotal.labels(op).inc();
    log.info({ event: 'auth_attempt', op, email: body.email, tenant_id: null }, 'Auth attempt');
    try {
      const result = await this.auth.login(body);
      authSuccessTotal.labels(op).inc();
      log.info(
        { event: 'auth_success', op, email: body.email, user_id: result.userId, tenant_id: result.tenantId },
        'Auth success',
      );
      return result;
    } catch (e: any) {
      const reason = (e?.name || 'Error').toString().toLowerCase();
      authFailuresTotal.labels(op, reason).inc();
      log.warn({ event: 'auth_failure', op, email: body.email, tenant_id: null, reason }, 'Auth failure');
      throw e;
    }
  }

  // Dev-only endpoint to set/reset a user's password
  @Post('/dev-set-password')
  async devSetPassword(@Body() body: { email: string; password: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Password reset is disabled');
    }
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException('email and password are required');
    }
    const result = await this.auth.devSetPassword(body.email, body.password);
    return result;
  }
}
