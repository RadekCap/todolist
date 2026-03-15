import { defineConfig } from '@playwright/test'

export default defineConfig({
    globalSetup: './tests/e2e/global-setup.js',
    testDir: './tests/e2e',
    timeout: 30000,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : [['html', { open: 'on-failure' }]],
    use: {
        baseURL: 'http://localhost:3000',
        headless: true,
        screenshot: 'only-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' }
        }
    ],
    webServer: {
        command: 'npx serve -l 3000 -s .',
        port: 3000,
        reuseExistingServer: !process.env.CI
    }
})
