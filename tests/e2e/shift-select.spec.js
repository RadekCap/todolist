import { test, expect } from './fixtures.js'

const unique = () => `SS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: create multiple todos and return their names.
 */
async function createTodos(page, count) {
    const names = []
    for (let i = 0; i < count; i++) {
        const name = unique()
        await addTodo(page, name)
        await expect(todoItem(page, name)).toBeVisible({ timeout: 5000 })
        names.push(name)
    }
    return names
}

/**
 * Helper: cleanup multiple todos.
 */
async function cleanupTodos(page, names) {
    for (const name of names) {
        await deleteTodo(page, name)
    }
}

test.describe('Shift+Click Range Select', () => {
    test('shift+click selects a range of todos', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 4)

        // Click first todo's checkbox (normal click)
        await todoItem(authedPage, names[0]).locator('.todo-select-checkbox').click()

        // Selection bar should appear with 1 selected
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)
        await expect(authedPage.locator('#selectionCount')).toContainText('1 selected')

        // Shift+click the third todo's checkbox to select range [0, 1, 2]
        await todoItem(authedPage, names[2]).locator('.todo-select-checkbox').click({ modifiers: ['Shift'] })

        // Should have 3 selected (range from first to third)
        await expect(authedPage.locator('#selectionCount')).toContainText('3 selected', { timeout: 5000 })

        // Verify all three are checked
        await expect(todoItem(authedPage, names[0]).locator('.todo-select-checkbox')).toBeChecked()
        await expect(todoItem(authedPage, names[1]).locator('.todo-select-checkbox')).toBeChecked()
        await expect(todoItem(authedPage, names[2]).locator('.todo-select-checkbox')).toBeChecked()

        // Fourth should NOT be checked
        await expect(todoItem(authedPage, names[3]).locator('.todo-select-checkbox')).not.toBeChecked()

        // Cleanup
        await authedPage.click('#clearSelectionBtn')
        await cleanupTodos(authedPage, names)
    })

    test('shift+click without prior selection selects single item', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 3)

        // Shift+click on second todo without any prior selection
        await todoItem(authedPage, names[1]).locator('.todo-select-checkbox').click({ modifiers: ['Shift'] })

        // Should select at least the clicked item
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)
        await expect(todoItem(authedPage, names[1]).locator('.todo-select-checkbox')).toBeChecked()

        // Cleanup
        await authedPage.click('#clearSelectionBtn')
        await cleanupTodos(authedPage, names)
    })
})
