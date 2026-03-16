import { test, expect } from './fixtures.js'
import { waitForApp } from './helpers/todos.js'

/**
 * Helper: wait for the async loadThemeFromDatabase / loadDensityFromDatabase
 * calls to finish. These fire without await after login (app.js line 704-705),
 * so the theme/density can be overwritten after the test starts interacting.
 * Waiting for networkidle ensures Supabase responses have arrived.
 */
async function waitForSettingsLoaded(page) {
    await page.waitForLoadState('networkidle')
}

/**
 * Helper: change theme and wait for the Supabase save to complete.
 * We start listening for the response BEFORE triggering the change,
 * because the save is a fire-and-forget async call inside the change
 * event handler — networkidle can fire before the request even starts.
 */
async function changeTheme(page, theme) {
    const saved = page.waitForResponse(
        resp => resp.url().includes('user_settings') && resp.request().method() !== 'GET'
    )
    await page.selectOption('#themeSelect', theme)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await saved
}

/**
 * Helper: change density and wait for the Supabase save to complete.
 */
async function changeDensity(page, density) {
    const saved = page.waitForResponse(
        resp => resp.url().includes('user_settings') && resp.request().method() !== 'GET'
    )
    await page.selectOption('#densitySelect', density)
    await expect(page.locator('html')).toHaveAttribute('data-density', density)
    await saved
}

test.describe('Settings - Theme', () => {
    test('change theme to Dark and verify it applies', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        await changeTheme(authedPage, 'dark')
        await expect(authedPage.locator('#themeSelect')).toHaveValue('dark')

        // Restore default
        await changeTheme(authedPage, 'glass')
    })

    test('change theme to Clear and verify it applies', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        await changeTheme(authedPage, 'clear')
        await expect(authedPage.locator('#themeSelect')).toHaveValue('clear')

        // Restore default
        await changeTheme(authedPage, 'glass')
    })

    test('change theme to Glass and verify it applies', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        // First switch away from Glass
        await changeTheme(authedPage, 'dark')

        // Switch back to Glass
        await changeTheme(authedPage, 'glass')
    })

    test('theme persists after page reload', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        // Change to Dark theme and wait for save
        await changeTheme(authedPage, 'dark')

        // Reload the page and wait for app to fully initialize
        await authedPage.reload()
        await waitForApp(authedPage)

        // Theme should still be dark after reload
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 15000 })

        // Restore default
        await changeTheme(authedPage, 'glass')
    })
})

test.describe('Settings - Density', () => {
    test('change density to Compact and verify it applies', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        await changeDensity(authedPage, 'compact')
        await expect(authedPage.locator('#densitySelect')).toHaveValue('compact')

        // Restore default
        await changeDensity(authedPage, 'comfortable')
    })

    test('change density to Comfortable and verify it applies', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        // First switch to compact
        await changeDensity(authedPage, 'compact')

        // Switch back to comfortable
        await changeDensity(authedPage, 'comfortable')
    })

    test('density persists after page reload', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        // Change to Compact density and wait for save
        await changeDensity(authedPage, 'compact')

        // Reload the page and wait for app to fully initialize
        await authedPage.reload()
        await waitForApp(authedPage)

        // Density should still be compact after reload
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'compact', { timeout: 15000 })

        // Restore default
        await changeDensity(authedPage, 'comfortable')
    })
})

test.describe('Settings - Saved per user', () => {
    test('settings are stored in Supabase for the authenticated user', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        // Change both theme and density and wait for saves
        await changeTheme(authedPage, 'clear')
        await changeDensity(authedPage, 'compact')

        // Clear localStorage to prove settings come from the database
        await authedPage.evaluate(() => {
            localStorage.removeItem('colorTheme')
            localStorage.removeItem('densityMode')
        })

        // Reload — settings should be restored from Supabase
        await authedPage.reload()
        await waitForApp(authedPage)

        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'clear', { timeout: 15000 })
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'compact', { timeout: 15000 })

        // Restore defaults
        await changeTheme(authedPage, 'glass')
        await changeDensity(authedPage, 'comfortable')
    })
})
