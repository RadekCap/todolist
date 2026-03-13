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
        // Capture browser console for diagnostics
        const consoleLogs = []
        authedPage.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`))
        authedPage.on('pageerror', err => consoleLogs.push(`[PAGE_ERROR] ${err.message}`))

        // Create a todo to ensure we have test data
        const name = unique('EW')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Reload the page
        await authedPage.reload()
        await waitForApp(authedPage)

        // Diagnostic: capture page state
        const diag = await authedPage.evaluate(() => {
            const items = document.querySelectorAll('.todo-item')
            const texts = Array.from(items).map(i => i.querySelector('.todo-text')?.textContent || '').slice(0, 10)
            const activeTab = document.querySelector('.gtd-tab.active')?.textContent || 'none'
            const authVisible = document.getElementById('authContainer')?.classList.contains('active')
            const unlockVisible = document.getElementById('unlockModal')?.classList.contains('active')
            return { itemCount: items.length, texts, activeTab, authVisible, unlockVisible }
        })
        console.log(`[DIAG] After reload: ${JSON.stringify(diag)}`)
        console.log(`[DIAG] Looking for: "${name}"`)
        console.log(`[DIAG] Browser errors: ${JSON.stringify(consoleLogs.filter(l => l.includes('rror')))}`)

        // Todo should still be readable after reload (tests decrypt-on-load path)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 15000 })
        await expect(todoItem(authedPage, name).locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo text is readable after lock and unlock', async ({ authedPage }) => {
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

        // Todo should still be readable after key re-derivation
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 15000 })
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
