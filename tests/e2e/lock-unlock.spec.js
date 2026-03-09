import { test, expect } from './fixtures.js'

const unique = () => `LK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: find a todo item by its text content.
 */
function todoItem(page, text) {
    return page.locator('.todo-item', { has: page.locator('.todo-text', { hasText: text }) })
}

/**
 * Helper: delete a todo by text.
 */
async function deleteTodo(page, text) {
    const item = todoItem(page, text)
    if (await item.count() > 0) {
        await item.locator('.delete-btn').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

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
        const name = unique()

        // Create a todo before locking
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.fill('#modalTodoInput', name)
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Lock the app
        await lockApp(authedPage)
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // Unlock with correct password
        const password = process.env.TEST_USER_PASSWORD
        await authedPage.fill('#unlockPassword', password)
        await authedPage.click('#unlockBtn')

        // App should be restored
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })
        await expect(authedPage.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 5000 })

        // Todo created before lock should still be visible
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

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
        await expect(authedPage.locator('#authContainer')).toBeVisible({ timeout: 10000 })
        await expect(authedPage.locator('#unlockModal')).not.toHaveClass(/active/, { timeout: 5000 })
    })
})
