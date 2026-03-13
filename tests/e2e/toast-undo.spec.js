import { test, expect } from './fixtures.js'

const unique = () => `TU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: delete a todo by text and wait for removal.
 */
async function deleteTodo(page, text) {
    const item = todoItem(page, text)
    if (await item.count() > 0) {
        await item.locator('.delete-btn').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

test.describe('Toast Notifications & Undo', () => {
    test('deleting todo shows toast with undo button', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Toast should appear with an undo button
        const toast = authedPage.locator('.toast')
        await expect(toast.first()).toBeVisible({ timeout: 5000 })

        const undoBtn = authedPage.locator('.toast-undo-btn')
        await expect(undoBtn.first()).toBeVisible({ timeout: 5000 })
    })

    test('clicking undo restores the deleted todo', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Click undo in the toast
        const undoBtn = authedPage.locator('.toast-undo-btn')
        await expect(undoBtn.first()).toBeVisible({ timeout: 5000 })
        await undoBtn.first().click()

        // Todo should reappear in the list
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('toast auto-dismisses after timeout', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo to trigger toast
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Toast should appear
        const toast = authedPage.locator('.toast').first()
        await expect(toast).toBeVisible({ timeout: 5000 })

        // Wait for auto-dismiss (TOAST_DURATION is 5000ms + animation buffer)
        await expect(toast).not.toBeVisible({ timeout: 7000 })
    })

    test('toast close button dismisses toast', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo to trigger toast
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

    test('multiple toasts stack', async ({ authedPage }) => {
        const name1 = unique()
        const name2 = unique()
        await addTodo(authedPage, name1)
        await addTodo(authedPage, name2)
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        // Delete both todos quickly to trigger multiple toasts
        await todoItem(authedPage, name1).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name1)).not.toBeAttached({ timeout: 5000 })

        await todoItem(authedPage, name2).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name2)).not.toBeAttached({ timeout: 5000 })

        // Verify at least 2 toasts are visible
        const toasts = authedPage.locator('.toast')
        await expect(toasts.first()).toBeVisible({ timeout: 5000 })
        const count = await toasts.count()
        expect(count).toBeGreaterThanOrEqual(2)
    })
})
