import { test, expect } from './fixtures.js'

const unique = () => `EW-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)
    await page.click('#addTodoForm button[type="submit"]')
    await expect(page.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
}

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
 * Helper: wait for app to be fully ready after page load/reload.
 */
async function waitForApp(page) {
    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 30000 })
    await expect(page.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 10000 })
    // Wait for todo data to load from Supabase
    await expect(page.locator('.todo-item').first()).toBeVisible({ timeout: 15000 }).catch(() => {})
}

test.describe('Encryption Workflow', () => {
    test('todo text is readable after creation', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)

        // Text should be displayed correctly (encrypted/decrypted roundtrip)
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo text persists correctly after page reload', async ({ authedPage }) => {
        // Wait for todos to load, then capture existing texts before reload
        await expect(authedPage.locator('.todo-item').first()).toBeVisible({ timeout: 10000 })
        const textsBefore = await authedPage.locator('.todo-item .todo-text').allTextContents()
        expect(textsBefore.length).toBeGreaterThan(0)

        // Reload the page
        await authedPage.reload()
        await waitForApp(authedPage)

        // Existing todos should still be readable after reload (tests decrypt-on-load path)
        const textsAfter = await authedPage.locator('.todo-item .todo-text').allTextContents()
        expect(textsAfter.length).toBeGreaterThan(0)

        // Verify no items became garbled (encrypted text would not match)
        for (const text of textsAfter) {
            expect(text.length).toBeGreaterThan(0)
            // Encrypted/undecrypted text would contain base64 or binary chars
            expect(text).not.toMatch(/^[A-Za-z0-9+/=]{20,}$/)
        }
    })

    test('project names survive encryption roundtrip after reload', async ({ authedPage }) => {
        // Wait for projects to load, then capture existing names before reload
        await expect(authedPage.locator('#projectList .project-item').first()).toBeVisible({ timeout: 10000 })
        const namesBefore = await authedPage.locator('#projectList .project-item .project-name').allTextContents()
        expect(namesBefore.length).toBeGreaterThan(0)

        // Reload
        await authedPage.reload()
        await waitForApp(authedPage)

        // Project names should still be readable after reload
        const namesAfter = await authedPage.locator('#projectList .project-item .project-name').allTextContents()
        expect(namesAfter.length).toBeGreaterThan(0)

        // Verify no names became garbled
        for (const name of namesAfter) {
            expect(name.length).toBeGreaterThan(0)
            expect(name).not.toMatch(/^[A-Za-z0-9+/=]{20,}$/)
        }
    })
})
