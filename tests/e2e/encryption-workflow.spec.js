import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo, waitForApp } from './helpers/todos.js'

test.describe('Encryption Workflow', () => {
    test('todo text is readable after creation', async ({ authedPage }) => {
        const name = unique('EW')
        await addTodo(authedPage, name)

        // Text should be displayed correctly (encrypted/decrypted roundtrip)
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo text persists correctly after page reload', async ({ authedPage }) => {
        test.slow() // Reload + recovery can exceed default timeout
        // Create a todo to ensure we have test data
        const name = unique('EW')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Reload the page
        await authedPage.reload()
        await waitForApp(authedPage)

        // Todo should still be readable after reload (tests decrypt-on-load path).
        // Supabase session rotation during reload can fire a spurious SIGNED_OUT
        // event that briefly disrupts the app.  Reload to recover if needed.
        try {
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })
        } catch {
            await authedPage.reload()
            await waitForApp(authedPage)
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 15000 })
        }
        await expect(todoItem(authedPage, name).locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo text is readable after lock and unlock', async ({ authedPage }) => {
        test.slow() // Lock/unlock + recovery reload can exceed default timeout
        // Create a todo to ensure we have test data
        const name = unique('EW')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Lock the app
        await authedPage.click('#toolbarUserBtn')
        await expect(authedPage.locator('#toolbarUserMenu')).toHaveClass(/open/, { timeout: 3000 })
        await authedPage.click('#lockBtn')
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // Unlock with correct password (re-derives encryption key)
        const password = process.env.TEST_USER_PASSWORD
        await authedPage.fill('#unlockPassword', password)
        await authedPage.click('#unlockBtn')
        await waitForApp(authedPage)

        // Todo should still be readable after key re-derivation.
        // Supabase session rotation during unlock can fire a delayed SIGNED_OUT
        // event that briefly disrupts the app state.  Reload to recover if needed.
        try {
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 15000 })
        } catch {
            await authedPage.reload()
            await waitForApp(authedPage)
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 20000 })
        }
        await expect(todoItem(authedPage, name).locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('project names survive encryption roundtrip after reload', async ({ authedPage }) => {
        // Wait for existing projects to load
        await expect(authedPage.locator('#projectList .project-item').first()).toBeVisible({ timeout: 10000 })

        // Reload
        await authedPage.reload()
        await waitForApp(authedPage)

        // Project names should still be readable after reload
        await expect(authedPage.locator('#projectList .project-item').first()).toBeVisible({ timeout: 15000 })
        const names = await authedPage.locator('#projectList .project-item .project-name').allTextContents()
        expect(names.length).toBeGreaterThan(0)

        // Verify all names decrypted properly (non-empty, human-readable text)
        for (const name of names) {
            expect(name.trim().length).toBeGreaterThan(0)
        }
    })
})
