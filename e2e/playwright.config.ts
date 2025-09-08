import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @dispatch/merchant-dashboard dev -p 3001',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql',
      },
    },
    {
      command: 'pnpm --filter @dispatch/returns-portal dev -p 3002',
      url: 'http://localhost:3002',
      reuseExistingServer: true,
      env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql',
        NEXT_PUBLIC_ORDERS_URL: process.env.NEXT_PUBLIC_ORDERS_URL || 'http://localhost:14002',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
