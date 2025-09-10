import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let started = false;

describe('AuthController (integration with Postgres)', () => {
  let app: INestApplication;
  let container: any;
  // Loaded lazily after Prisma client generation to avoid stub client
  let AuthControllerCls: any;
  let AuthServiceCls: any;
  let PrismaServiceCls: any;

  const serviceCwd = path.resolve(__dirname, '../../');

  beforeAll(async () => {
    // Spin up a disposable Postgres using Testcontainers
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('users_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    const url = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}?schema=users`;
    process.env.DATABASE_URL = url;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';

    // Apply migrations and generate client.
    // Important: perform generate before importing any module that references @prisma/client
    execSync('npx prisma generate', {
      cwd: serviceCwd,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    });
    execSync('npx prisma migrate deploy', {
      cwd: serviceCwd,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    });

    // Lazily import classes after prisma client has been generated
    ({ AuthController: AuthControllerCls } = await import('../../src/auth.controller'));
    ({ AuthService: AuthServiceCls } = await import('../../src/auth.service'));
    ({ PrismaService: PrismaServiceCls } = await import('../../src/prisma.service'));

    @Module({ controllers: [AuthControllerCls], providers: [PrismaServiceCls, AuthServiceCls] })
    class TestAppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    started = true;
  }, 120000);

  afterAll(async () => {
    if (started) await app.close();
    if (container) await container.stop();
  });

  it('POST /v1/auth/signup then login', async () => {
    const email = `int-${Date.now()}@example.com`;
    const password = 'password123';
    const tenantName = `Acme ${Date.now()}`;

    const signup = await request(app.getHttpServer())
      .post('/v1/auth/signup')
      .send({ email, password, tenantName });
    expect(signup.status).toBe(201);
    expect(signup.body.userId).toBeTruthy();
    expect(signup.body.tenantId).toBeTruthy();
    expect(typeof signup.body.token).toBe('string');

    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.userId).toBe(signup.body.userId);
    expect(login.body.tenantId).toBe(signup.body.tenantId);
    expect(typeof login.body.token).toBe('string');
  });
});
