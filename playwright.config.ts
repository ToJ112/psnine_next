import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.smoke.spec.ts',
  timeout: 30000,
  use: {
    headless: true,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] }, // 390px viewport, WebKit
    },
    {
      name: 'chromium-touch-menu',
      testMatch: '**/trophy-menu.smoke.spec.ts',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
});
