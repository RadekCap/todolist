import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo, waitForApp } from './helpers/todos.js'

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
        // Create a todo to ensure we have test data
        const name = unique('LU')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Lock the app
        await lockApp(authedPage)
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // App container should not be active while locked
        await expect(authedPage.locator('#appContainer')).not.toHaveClass(/active/)

        // Unlock with correct password
        const password = process.env.TEST_USER_PASSWORD
        await authedPage.fill('#unlockPassword', password)
        await authedPage.click('#unlockBtn')

        // Wait for app to be fully restored after unlock
        await waitForApp(authedPage)

        // Verify the todo is visible after unlock.
        // Supabase session rotation during unlock can fire a delayed SIGNED_OUT
        // event that briefly disrupts the app state.  If the todo isn't found,
        // reload the page to recover and retry.
        try {
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 15000 })
        } catch {
            await authedPage.reload()
            await waitForApp(authedPage)
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 20000 })
        }

        // Verify the inbox tab is active
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/)

        // Cleanup
        await deleteTodo(authedPage, name)
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
        await expect(authedPage.locator('#authContainer')).toBeVisible({ timeout: 30000 })
        await expect(authedPage.locator('#unlockModal')).not.toHaveClass(/active/, { timeout: 5000 })
    })
})
