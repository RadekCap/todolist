import { test, expect } from '@playwright/test'

test.describe('App Loading', () => {
    test('page loads with correct title', async ({ page }) => {
        await page.goto('/')
        await expect(page).toHaveTitle('TodoList')
    })

    test('loading screen is shown initially', async ({ page }) => {
        await page.goto('/')
        const loadingScreen = page.locator('#loadingScreen')
        await expect(loadingScreen).toBeVisible()
    })

    test('main container exists', async ({ page }) => {
        await page.goto('/')
        const mainContainer = page.locator('#mainContainer')
        await expect(mainContainer).toBeAttached()
    })

    test('stylesheet is loaded', async ({ page }) => {
        await page.goto('/')
        const stylesheet = page.locator('link[rel="stylesheet"][href="styles.css"]')
        await expect(stylesheet).toBeAttached()
    })

    test('app module script is loaded', async ({ page }) => {
        await page.goto('/')
        const script = page.locator('script[type="module"][src="app.js"]')
        await expect(script).toBeAttached()
    })
})
