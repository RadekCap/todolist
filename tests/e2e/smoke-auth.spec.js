import { test, expect } from './fixtures.js'

test.describe('Authenticated Smoke Test', () => {
    test('app loads in authenticated state', async ({ authedPage }) => {
        // App container should be active
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/)

        // Body should have fullscreen mode
        await expect(authedPage.locator('body')).toHaveClass(/fullscreen-mode/)

        // Auth container should not be active
        await expect(authedPage.locator('#authContainer')).not.toHaveClass(/active/)
    })

    test('sidebar is visible', async ({ authedPage }) => {
        await expect(authedPage.locator('.sidebar')).toBeVisible()
    })

    test('GTD tab bar is visible', async ({ authedPage }) => {
        await expect(authedPage.locator('.gtd-tab-bar')).toBeVisible()
    })

    test('todo list container exists', async ({ authedPage }) => {
        await expect(authedPage.locator('#todoList')).toBeAttached()
    })
})
