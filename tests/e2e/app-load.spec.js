import { test, expect } from '@playwright/test'

test.describe('App Loading', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/')
    })

    test('page loads with correct title', async ({ page }) => {
        await expect(page).toHaveTitle('TodoList')
    })

    test('loading screen is shown initially', async ({ page }) => {
        const loadingScreen = page.locator('#loadingScreen')
        await expect(loadingScreen).toBeVisible()
    })

    test('main container exists', async ({ page }) => {
        const mainContainer = page.locator('#mainContainer')
        await expect(mainContainer).toBeAttached()
    })

    test('stylesheet is loaded', async ({ page }) => {
        const stylesheet = page.locator('link[rel="stylesheet"][href="styles.css"]')
        await expect(stylesheet).toBeAttached()
    })

    test('app module script is loaded', async ({ page }) => {
        const script = page.locator('script[type="module"][src="app.js"]')
        await expect(script).toBeAttached()
    })
})
