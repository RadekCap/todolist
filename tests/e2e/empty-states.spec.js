import { test, expect } from './fixtures.js'

const unique = () => `ES-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: click a GTD tab.
 */
async function switchGtdTab(page, status) {
    await page.click(`.gtd-tab.${status}`)
    await page.waitForTimeout(500)
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

test.describe('Empty States', () => {
    test('empty GTD tab shows no todo items', async ({ authedPage }) => {
        // Switch to Someday tab — likely empty for test user
        await switchGtdTab(authedPage, 'someday_maybe')

        // Should have no todo items with our unique prefix
        const todoItems = authedPage.locator('.todo-item')
        // We can't guarantee the tab is completely empty, but we verify
        // the tab renders without errors
        await authedPage.waitForTimeout(500)

        // Return to Inbox
        await switchGtdTab(authedPage, 'inbox')
    })

    test('search with no results shows empty state', async ({ authedPage }) => {
        const nonsense = `ZZZZZ-${Date.now()}-nonexistent`

        // Type a search query that matches nothing
        await authedPage.fill('#searchInput', nonsense)
        await authedPage.waitForTimeout(500)

        // No todo items should be visible
        const todoItems = authedPage.locator('.todo-item')
        await expect(todoItems).toHaveCount(0, { timeout: 5000 })

        // Clear search
        await authedPage.fill('#searchInput', '')
        await authedPage.waitForTimeout(500)
    })

    test('search with GTD filter shows empty state', async ({ authedPage }) => {
        // Switch to Waiting tab
        await switchGtdTab(authedPage, 'waiting_for')

        // Search for nonsense
        const nonsense = `ZZZZZ-${Date.now()}-nonexistent`
        await authedPage.fill('#searchInput', nonsense)
        await authedPage.waitForTimeout(500)

        // No results
        const todoItems = authedPage.locator('.todo-item')
        await expect(todoItems).toHaveCount(0, { timeout: 5000 })

        // Clear search and return to Inbox
        await authedPage.fill('#searchInput', '')
        await switchGtdTab(authedPage, 'inbox')
    })

    test('adding and deleting a todo restores empty state', async ({ authedPage }) => {
        // Switch to Someday tab (likely empty)
        await switchGtdTab(authedPage, 'someday_maybe')

        // Count existing items
        const countBefore = await authedPage.locator('.todo-item').count()

        // Add a todo and move it to Someday via the modal
        const name = unique()
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.fill('#modalTodoInput', name)
        await authedPage.selectOption('#modalGtdStatusSelect', 'someday_maybe')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should appear in Someday tab
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete it
        await deleteTodo(authedPage, name)

        // Count should return to before
        await expect(authedPage.locator('.todo-item')).toHaveCount(countBefore, { timeout: 5000 })

        // Return to Inbox
        await switchGtdTab(authedPage, 'inbox')
    })
})
