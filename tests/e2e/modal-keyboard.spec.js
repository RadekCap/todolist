import { test, expect } from './fixtures.js'
import { unique, todoItem, deleteTodo } from './helpers/todos.js'

test.describe('Modal Keyboard Interactions', () => {
    test('Ctrl+Enter submits todo modal', async ({ authedPage }) => {
        const name = unique('MK')

        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        await authedPage.fill('#modalTodoInput', name)

        // Submit via Ctrl+Enter
        await authedPage.keyboard.press('Control+Enter')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify the todo was created
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('Meta+Enter submits todo modal', async ({ authedPage }) => {
        const name = unique('MK')

        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        await authedPage.fill('#modalTodoInput', name)

        // Submit via Meta+Enter (Cmd+Enter on Mac)
        await authedPage.keyboard.press('Meta+Enter')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify the todo was created
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('Escape closes modal without saving', async ({ authedPage }) => {
        const name = unique('MK')

        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Type a todo name but do not submit
        await authedPage.fill('#modalTodoInput', name)

        // Close via Escape
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify no todo was created with that text
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 3000 })
    })

    test('opening todo modal focuses the text input', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // The text input should receive focus automatically
        await expect(authedPage.locator('#modalTodoInput')).toBeFocused({ timeout: 2000 })

        // Cleanup — close modal
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('Tab navigates through modal fields', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Verify initial focus is on the text input
        await expect(authedPage.locator('#modalTodoInput')).toBeFocused({ timeout: 2000 })

        // First Tab: focus moves to the comment textarea
        await authedPage.keyboard.press('Tab')
        await expect(authedPage.locator('#modalCommentInput')).toBeFocused({ timeout: 2000 })

        // Second Tab: focus moves away from the comment field
        await authedPage.keyboard.press('Tab')
        await expect(authedPage.locator('#modalCommentInput')).not.toBeFocused({ timeout: 2000 })
        // Verify focus is still inside the modal
        const insideModal = await authedPage.evaluate(() => document.activeElement?.closest('#addTodoModal') !== null)
        expect(insideModal).toBe(true)

        // Cleanup — close modal
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    })
})
