import { test, expect } from './fixtures.js'

/**
 * Helper: open the user menu dropdown.
 */
async function openUserMenu(page) {
    await page.click('#toolbarUserBtn')
    await expect(page.locator('#toolbarUserMenu')).toHaveClass(/open/, { timeout: 3000 })
}

/**
 * Helper: lock the app via user menu.
 */
async function lockApp(page) {
    await openUserMenu(page)
    await page.click('#lockBtn')
}

test.describe('Session Lock and Unlock', () => {
    test('lock button hides app and shows unlock modal', async ({ authedPage }) => {
        await lockApp(authedPage)

        // App container should no longer be active
        await expect(authedPage.locator('#appContainer')).not.toHaveClass(/active/, { timeout: 5000 })

        // Unlock modal should be visible
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // Email should be pre-filled
        const emailValue = await authedPage.locator('#unlockEmail').inputValue()
        expect(emailValue).not.toBe('')

        // Unlock to restore state for other tests
        const password = process.env.TEST_USER_PASSWORD
        await authedPage.fill('#unlockPassword', password)
        await authedPage.click('#unlockBtn')

        // App should reload
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })
    })

    test('unlock with correct password restores the app', async ({ authedPage }) => {
        // Lock the app
        await lockApp(authedPage)
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // App container should not be active while locked
        await expect(authedPage.locator('#appContainer')).not.toHaveClass(/active/)

        // Unlock with correct password
        const password = process.env.TEST_USER_PASSWORD
        await authedPage.fill('#unlockPassword', password)
        await authedPage.click('#unlockBtn')

        // App should be restored
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })
        await expect(authedPage.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 5000 })

        // Wait for data to finish loading (loading screen hides after all data loads)
        await expect(authedPage.locator('#loadingScreen')).toHaveClass(/hidden/, { timeout: 15000 })

        // Verify the todo list renders items (existing test data)
        await expect(authedPage.locator('.todo-item').first()).toBeVisible({ timeout: 10000 })

        // Verify the inbox tab is active
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/)
    })

    test('unlock with wrong password shows error', async ({ authedPage }) => {
        await lockApp(authedPage)
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // Try unlocking with wrong password
        await authedPage.fill('#unlockPassword', 'definitely-wrong-password-12345')
        await authedPage.click('#unlockBtn')

        // Error message should appear
        await expect(authedPage.locator('#unlockError')).toBeVisible({ timeout: 5000 })

        // App should still be locked
        await expect(authedPage.locator('#appContainer')).not.toHaveClass(/active/)

        // Now unlock with correct password to restore state
        const password = process.env.TEST_USER_PASSWORD
        await authedPage.fill('#unlockPassword', password)
        await authedPage.click('#unlockBtn')
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })
    })

    test('unlock with empty password does not submit', async ({ authedPage }) => {
        await lockApp(authedPage)
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // Try submitting with empty password — HTML5 required validation prevents submission
        await authedPage.click('#unlockBtn')
        await authedPage.waitForTimeout(500)

        // App should still be locked (form did not submit)
        await expect(authedPage.locator('#appContainer')).not.toHaveClass(/active/)
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/)

        // Password field should have validation state (required + empty = invalid)
        const isValid = await authedPage.locator('#unlockPassword').evaluate(el => el.checkValidity())
        expect(isValid).toBe(false)

        // Unlock to restore state
        const password = process.env.TEST_USER_PASSWORD
        await authedPage.fill('#unlockPassword', password)
        await authedPage.click('#unlockBtn')
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })
    })

    test('logout from unlock screen returns to auth form', async ({ authedPage }) => {
        await lockApp(authedPage)
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // Click logout button on unlock modal
        await authedPage.click('#unlockLogoutBtn')

        // Should return to the auth/login form
        await expect(authedPage.locator('#authContainer')).toBeVisible({ timeout: 10000 })
        await expect(authedPage.locator('#unlockModal')).not.toHaveClass(/active/, { timeout: 5000 })
    })
})
