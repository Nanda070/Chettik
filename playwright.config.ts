import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    storageState: { cookies: [], origins: [] },
  },
  webServer: [
    {
      command: 'python -m uvicorn backend.main:app --host 127.0.0.1 --port 8787',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: false,
      env: {
        ...process.env,
        CHETTIK_DB: 'chettik.e2e.db',
        CHETTIK_RESET: '1',
        OTP_DEV_CODE: '123456',
        API_ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
      },
    },
    {
      command: 'npm run dev:web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_URL: 'http://127.0.0.1:8787/api',
      },
    },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
