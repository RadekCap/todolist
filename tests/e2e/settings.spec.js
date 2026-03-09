import { test, expect } from './fixtures.js'

test.describe('Settings - Theme', () => {
    test('change theme to Dark and verify it applies', async ({ authedPage }) => {
        // Change to Dark theme
        await authedPage.selectOption('#themeSelect', 'dark')

        // Verify data-theme attribute is set on <html>
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'dark')

        // Verify the select shows the correct value
        await expect(authedPage.locator('#themeSelect')).toHaveValue('dark')
    })

    test('change theme to Clear and verify it applies', async ({ authedPage }) => {
        await authedPage.selectOption('#themeSelect', 'clear')
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'clear')
        await expect(authedPage.locator('#themeSelect')).toHaveValue('clear')
    })

    test('change theme to Glass and verify it applies', async ({ authedPage }) => {
        // First switch away from Glass (default)
        await authedPage.selectOption('#themeSelect', 'dark')
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'dark')

        // Switch back to Glass
        await authedPage.selectOption('#themeSelect', 'glass')
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'glass')
    })

    test('theme persists after page reload', async ({ authedPage }) => {
        // Change to Dark theme
        await authedPage.selectOption('#themeSelect', 'dark')
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'dark')

        // Wait for the setting to be saved to Supabase
        await authedPage.waitForTimeout(1000)

        // Reload the page
        await authedPage.reload()
        await authedPage.waitForLoadState('networkidle')

        // Theme should still be dark after reload
        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 10000 })
        await expect(authedPage.locator('#themeSelect')).toHaveValue('dark', { timeout: 10000 })

        // Restore to default (glass) for other tests
        await authedPage.selectOption('#themeSelect', 'glass')
        await authedPage.waitForTimeout(1000)
    })
})

test.describe('Settings - Density', () => {
    test('change density to Compact and verify it applies', async ({ authedPage }) => {
        await authedPage.selectOption('#densitySelect', 'compact')
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'compact')
        await expect(authedPage.locator('#densitySelect')).toHaveValue('compact')
    })

    test('change density to Comfortable and verify it applies', async ({ authedPage }) => {
        // First switch to compact
        await authedPage.selectOption('#densitySelect', 'compact')
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'compact')

        // Switch back to comfortable
        await authedPage.selectOption('#densitySelect', 'comfortable')
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'comfortable')
    })

    test('density persists after page reload', async ({ authedPage }) => {
        // Change to Compact density
        await authedPage.selectOption('#densitySelect', 'compact')
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'compact')

        // Wait for the setting to be saved to Supabase
        await authedPage.waitForTimeout(1000)

        // Reload the page
        await authedPage.reload()
        await authedPage.waitForLoadState('networkidle')

        // Density should still be compact after reload
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'compact', { timeout: 10000 })
        await expect(authedPage.locator('#densitySelect')).toHaveValue('compact', { timeout: 10000 })

        // Restore to default (comfortable) for other tests
        await authedPage.selectOption('#densitySelect', 'comfortable')
        await authedPage.waitForTimeout(1000)
    })
})

test.describe('Settings - Saved per user', () => {
    test('settings are stored in Supabase for the authenticated user', async ({ authedPage }) => {
        // Change both theme and density
        await authedPage.selectOption('#themeSelect', 'clear')
        await authedPage.selectOption('#densitySelect', 'compact')

        // Wait for settings to save to Supabase
        await authedPage.waitForTimeout(1000)

        // Clear localStorage to prove settings come from the database
        await authedPage.evaluate(() => {
            localStorage.removeItem('colorTheme')
            localStorage.removeItem('densityMode')
        })

        // Reload — settings should be restored from Supabase
        await authedPage.reload()
        await authedPage.waitForLoadState('networkidle')

        await expect(authedPage.locator('html')).toHaveAttribute('data-theme', 'clear', { timeout: 10000 })
        await expect(authedPage.locator('html')).toHaveAttribute('data-density', 'compact', { timeout: 10000 })

        // Restore defaults
        await authedPage.selectOption('#themeSelect', 'glass')
        await authedPage.selectOption('#densitySelect', 'comfortable')
        await authedPage.waitForTimeout(1000)
    })
})
