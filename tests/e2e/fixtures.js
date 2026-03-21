import { test as base, expect } from '@playwright/test'
import { login } from './helpers/auth.js'
import { SUPABASE_URL, SUPABASE_KEY } from './helpers/supabase-config.js'

/**
 * Extended test fixture that provides an authenticated page context.
 * Import { test, expect } from this file instead of '@playwright/test'
 * for tests that require a logged-in user.
 *
 * Usage:
 *   import { test, expect } from '../fixtures.js'
 *   test('my authenticated test', async ({ authedPage }) => { ... })
 */
export const test = base.extend({
    /**
     * Provides a page that is already authenticated.
     * Logs in via the UI and waits for the app to be ready.
     */
    authedPage: async ({ page }, use) => {
        const email = process.env.TEST_USER_EMAIL
        const password = process.env.TEST_USER_PASSWORD

        if (!email || !password) {
            throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD env vars are required for authenticated tests')
        }

        // When SUPABASE_URL env var is set (CI with local Supabase), inject config
        // into the browser so the app connects to the local instance
        if (process.env.SUPABASE_URL) {
            await page.addInitScript(`window.__APP_CONFIG__ = ${JSON.stringify({ supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY })}`)
        }

        await login(page, email, password)
        await use(page)
    }
})

export { expect }
