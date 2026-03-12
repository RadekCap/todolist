import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo, switchGtdTab } from './helpers/todos.js'

test.describe('Empty States', () => {
    test('switching to a GTD tab renders without errors', async ({ authedPage }) => {
        // Switch to Someday tab and verify it activates
        await switchGtdTab(authedPage, 'someday_maybe')
        await expect(authedPage.locator('.gtd-tab.someday_maybe')).toHaveClass(/active/)

        // The todo list container should be present (renders either items or empty state)
        await expect(authedPage.locator('#todoList')).toBeVisible()

        // Return to Inbox
        await switchGtdTab(authedPage, 'inbox')
    })

    test('search with no results shows empty state', async ({ authedPage }) => {
        const nonsense = `ZZZZZ-${Date.now()}-nonexistent`

        // Type a search query that matches nothing
        await authedPage.fill('#searchInput', nonsense)

        // No todo items should be visible
        await expect(authedPage.locator('.todo-item')).toHaveCount(0, { timeout: 5000 })

        // Clear search
        await authedPage.fill('#searchInput', '')
    })

    test('search with GTD filter shows empty state', async ({ authedPage }) => {
        // Switch to Waiting tab
        await switchGtdTab(authedPage, 'waiting_for')

        // Search for nonsense
        const nonsense = `ZZZZZ-${Date.now()}-nonexistent`
        await authedPage.fill('#searchInput', nonsense)

        // No results
        await expect(authedPage.locator('.todo-item')).toHaveCount(0, { timeout: 5000 })

        // Clear search and return to Inbox
        await authedPage.fill('#searchInput', '')
        await switchGtdTab(authedPage, 'inbox')
    })

    test('adding and deleting a todo restores original count', async ({ authedPage }) => {
        // Switch to Someday tab
        await switchGtdTab(authedPage, 'someday_maybe')

        // Count existing items
        const countBefore = await authedPage.locator('.todo-item').count()

        // Add a todo directly to Someday
        const name = unique('ES')
        await addTodo(authedPage, name, { gtdStatus: 'someday_maybe' })

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
