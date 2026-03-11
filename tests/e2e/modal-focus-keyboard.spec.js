import { test, expect } from './fixtures.js'

const unique = () => `MFK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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

test.describe('Modal Focus Management', () => {
    test('add todo modal auto-focuses text input on open', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // The text input should be focused after the modal opens
        await expect(authedPage.locator('#modalTodoInput')).toBeFocused({ timeout: 2000 })

        // Cleanup — close modal
        await authedPage.click('#cancelModal')
    })

    test('focus returns to trigger button after modal close', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Close via cancel
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Focus should return to the add todo button
        await expect(authedPage.locator('#openAddTodoModal')).toBeFocused({ timeout: 2000 })
    })

    test('focus returns to trigger after Escape close', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Close via Escape
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Focus should return to the add todo button
        await expect(authedPage.locator('#openAddTodoModal')).toBeFocused({ timeout: 2000 })
    })
})

test.describe('Modal Keyboard Shortcuts', () => {
    test('Ctrl+Enter submits todo modal', async ({ authedPage }) => {
        const name = unique()
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        await authedPage.fill('#modalTodoInput', name)

        // Submit via Ctrl+Enter
        await authedPage.keyboard.press('Control+Enter')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should be created
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('Tab navigates from text input to next field', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await expect(authedPage.locator('#modalTodoInput')).toBeFocused({ timeout: 2000 })

        // Press Tab — focus should move to the comment textarea
        await authedPage.keyboard.press('Tab')

        // Verify focus moved to the comment input
        await expect(authedPage.locator('#modalCommentInput')).toBeFocused({ timeout: 2000 })

        // Cleanup — close modal
        await authedPage.click('#cancelModal')
    })
})
