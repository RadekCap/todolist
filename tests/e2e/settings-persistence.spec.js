import { test, expect } from './fixtures.js'
import { waitForApp } from './helpers/todos.js'

/**
 * Helper: wait for the async loadThemeFromDatabase / loadDensityFromDatabase
 * calls to finish after login. Waiting for networkidle ensures Supabase
 * responses have arrived and settings are applied.
 */
async function waitForSettingsLoaded(page) {
    await page.waitForLoadState('networkidle')
}

/**
 * Helper: change theme via the toolbar select and wait for the Supabase
 * save to complete. We start listening for the response BEFORE triggering
 * the change, because the save is fire-and-forget.
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
 * Helper: change density via the toolbar select and wait for the Supabase
 * save to complete.
 */
async function changeDensity(page, density) {
    const saved = page.waitForResponse(
        resp => resp.url().includes('user_settings') && resp.request().method() !== 'GET'
    )
    await page.selectOption('#densitySelect', density)
    await expect(page.locator('html')).toHaveAttribute('data-density', density)
    await saved
}

test.describe('Settings Persistence', () => {
    test('theme selection persists after page reload', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        // Change theme to dark and wait for save
        await changeTheme(authedPage, 'dark')

        // Reload the page and wait for app to fully load
        await authedPage.reload()
        await waitForApp(authedPage)
        await waitForSettingsLoaded(authedPage)

        // Verify the theme select dropdown still shows "dark"
        await expect(authedPage.locator('#themeSelect')).toHaveValue('dark', { timeout: 15000 })

        // Verify the data-theme attribute on the document is "dark"
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'dark')

        // Restore default theme
        await changeTheme(authedPage, 'glass')
    })

    test('density mode persists after page reload', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        // Change density to compact and wait for save
        await changeDensity(authedPage, 'compact')

        // Reload the page and wait for app to fully load
        await authedPage.reload()
        await waitForApp(authedPage)
        await waitForSettingsLoaded(authedPage)

        // Verify the density select dropdown still shows "compact"
        await expect(authedPage.locator('#densitySelect')).toHaveValue('compact', { timeout: 15000 })

        // Verify the data-density attribute on the document is "compact"
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'compact')

        // Restore default density
        await changeDensity(authedPage, 'comfortable')
    })

    test('theme applies correct CSS attribute', async ({ authedPage }) => {
        await waitForSettingsLoaded(authedPage)

        // Change to glass theme
        await changeTheme(authedPage, 'glass')

        // Verify data-theme="glass" is set on the html element
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'glass')

        // Verify the theme select reflects the current value
        await expect(authedPage.locator('#themeSelect')).toHaveValue('glass')

        // Glass is the default, no restore needed
    })
})
