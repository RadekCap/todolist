import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    retries: 0,
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
