import { test as base, expect } from '@playwright/test'

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
     * Provides a page that is already authenticated via saved storage state.
     * Navigates to '/' and waits for the app to be ready.
     */
    authedPage: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: 'tests/e2e/.auth/storage-state.json'
        })
        const page = await context.newPage()
        await page.goto('/')
        await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })
        await use(page)
        await context.close()
    }
})

export { expect }
