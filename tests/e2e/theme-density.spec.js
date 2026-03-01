import { test, expect } from '@playwright/test'

test.describe('Theme', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage to start fresh
        await page.goto('/')
        await page.evaluate(() => localStorage.clear())
        await page.reload()
    })

    test('default theme is glass', async ({ page }) => {
        const html = page.locator('html')
        await expect(html).toHaveAttribute('data-theme', 'glass')
    })

    test('theme is applied from localStorage', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('colorTheme', 'dark'))
        await page.reload()
        const html = page.locator('html')
        await expect(html).toHaveAttribute('data-theme', 'dark')
    })

    test('invalid theme falls back to glass', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('colorTheme', 'nonexistent'))
        await page.reload()
        const html = page.locator('html')
        await expect(html).toHaveAttribute('data-theme', 'glass')
    })
})

test.describe('Density', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/')
        await page.evaluate(() => localStorage.clear())
        await page.reload()
    })

    test('default density is comfortable', async ({ page }) => {
        const html = page.locator('html')
        await expect(html).toHaveAttribute('data-density', 'comfortable')
    })

    test('density is applied from localStorage', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('densityMode', 'compact'))
        await page.reload()
        const html = page.locator('html')
        await expect(html).toHaveAttribute('data-density', 'compact')
    })

    test('invalid density falls back to comfortable', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('densityMode', 'invalid'))
        await page.reload()
        const html = page.locator('html')
        await expect(html).toHaveAttribute('data-density', 'comfortable')
    })
})
