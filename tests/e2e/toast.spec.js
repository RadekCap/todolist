import { test, expect } from './fixtures.js'

const unique = () => `Toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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

test.describe('Toast Notifications', () => {
    test('toast appears after deleting a todo', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Toast should appear
        const toast = authedPage.locator('.toast')
        await expect(toast.first()).toBeVisible({ timeout: 5000 })
    })

    test('toast has an undo button', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Toast undo button should be visible
        const undoBtn = authedPage.locator('.toast-undo-btn')
        await expect(undoBtn.first()).toBeVisible({ timeout: 5000 })
    })

    test('toast can be dismissed with close button', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete to trigger toast
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Wait for toast to appear
        const toast = authedPage.locator('.toast').first()
        await expect(toast).toBeVisible({ timeout: 5000 })

        // Click close button
        await toast.locator('.toast-close-btn').click()

        // Toast should disappear
        await expect(toast).not.toBeVisible({ timeout: 3000 })
    })

    test('toast auto-dismisses after timeout', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete to trigger toast
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Toast appears
        const toast = authedPage.locator('.toast').first()
        await expect(toast).toBeVisible({ timeout: 5000 })

        // Wait for auto-dismiss (5 seconds + animation buffer)
        await expect(toast).not.toBeVisible({ timeout: 8000 })
    })
})
