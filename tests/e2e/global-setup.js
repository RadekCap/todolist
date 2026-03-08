import { chromium } from '@playwright/test'
import { login } from './helpers/auth.js'

const STORAGE_STATE_PATH = 'tests/e2e/.auth/storage-state.json'

/**
 * Global setup: authenticates once and saves storage state for all tests.
 * Requires TEST_USER_EMAIL and TEST_USER_PASSWORD env vars.
 */
async function globalSetup(config) {
    const email = process.env.TEST_USER_EMAIL
    const password = process.env.TEST_USER_PASSWORD

    if (!email || !password) {
        console.log('Skipping auth setup: TEST_USER_EMAIL or TEST_USER_PASSWORD not set')
        return
    }

    const { baseURL } = config.projects[0].use
    const browser = await chromium.launch()
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()

    await login(page, email, password)

    // Save storage state (cookies + localStorage with Supabase session)
    await context.storageState({ path: STORAGE_STATE_PATH })

    await browser.close()
}

export default globalSetup
export { STORAGE_STATE_PATH }
