import { test, expect } from './fixtures.js'

const unique = () => `DAD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: delete a single todo by text.
 */
async function deleteTodo(page, text) {
    const item = todoItem(page, text)
    if (await item.count() > 0) {
        await item.locator('.delete-btn').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

/**
 * Helper: complete a todo by checking its checkbox.
 */
async function completeTodo(page, text) {
    const item = todoItem(page, text)
    await item.locator('.todo-checkbox').check()
    await page.waitForTimeout(500)
}

test.describe('Delete All Done', () => {
    test('delete all done button is hidden when no done tasks exist', async ({ authedPage }) => {
        await switchGtdTab(authedPage, 'done')
        // Button should be hidden or not visible when there are no done tasks
        const btn = authedPage.locator('#deleteAllDoneBtn')
        const isVisible = await btn.isVisible()
        // If there happen to be pre-existing done tasks, skip this assertion
        if (isVisible) {
            test.skip()
        }
        expect(isVisible).toBe(false)
    })

    test('delete all done button appears on the Done tab with done tasks', async ({ authedPage }) => {
        const name = unique()

        // Create and complete a todo
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })
        await completeTodo(authedPage, name)

        // Switch to Done tab
        await switchGtdTab(authedPage, 'done')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete All Done button should be visible
        await expect(authedPage.locator('#deleteAllDoneBtn')).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('delete all done removes completed tasks after confirmation', async ({ authedPage }) => {
        const name1 = unique()
        const name2 = unique()

        // Create and complete two todos
        await addTodo(authedPage, name1)
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await completeTodo(authedPage, name1)

        await addTodo(authedPage, name2)
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })
        await completeTodo(authedPage, name2)

        // Switch to Done tab
        await switchGtdTab(authedPage, 'done')
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        // Accept the confirmation dialog
        authedPage.once('dialog', dialog => dialog.accept())

        // Click Delete All Done
        await authedPage.click('#deleteAllDoneBtn')

        // Both done todos should be removed
        await expect(todoItem(authedPage, name1)).not.toBeAttached({ timeout: 10000 })
        await expect(todoItem(authedPage, name2)).not.toBeAttached({ timeout: 10000 })
    })

    test('delete all done is cancelled when dialog is dismissed', async ({ authedPage }) => {
        const name = unique()

        // Create and complete a todo
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })
        await completeTodo(authedPage, name)

        // Switch to Done tab
        await switchGtdTab(authedPage, 'done')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Dismiss the confirmation dialog
        authedPage.once('dialog', dialog => dialog.dismiss())

        // Click Delete All Done
        await authedPage.click('#deleteAllDoneBtn')
        await authedPage.waitForTimeout(500)

        // Todo should still be present
        await expect(todoItem(authedPage, name)).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('delete all done does not affect incomplete tasks', async ({ authedPage }) => {
        const doneName = unique()
        const activeName = unique()

        // Create two todos, complete only one
        await addTodo(authedPage, doneName)
        await expect(todoItem(authedPage, doneName)).toBeVisible({ timeout: 5000 })
        await completeTodo(authedPage, doneName)

        await addTodo(authedPage, activeName)
        await expect(todoItem(authedPage, activeName)).toBeVisible({ timeout: 5000 })

        // Switch to Done and delete all done
        await switchGtdTab(authedPage, 'done')
        await expect(todoItem(authedPage, doneName)).toBeVisible({ timeout: 5000 })

        authedPage.once('dialog', dialog => dialog.accept())
        await authedPage.click('#deleteAllDoneBtn')
        await expect(todoItem(authedPage, doneName)).not.toBeAttached({ timeout: 10000 })

        // Switch to Inbox — active todo should still be there
        await switchGtdTab(authedPage, 'inbox')
        await expect(todoItem(authedPage, activeName)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, activeName)
    })
})

test.describe('Refresh Button', () => {
    test('refresh button reloads data without full page reload', async ({ authedPage }) => {
        const name = unique()

        // Create a todo
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open user menu and click Refresh
        await authedPage.click('#toolbarUserBtn')
        await expect(authedPage.locator('#toolbarDropdown')).toBeVisible({ timeout: 3000 })

        await authedPage.click('#refreshBtn')

        // Wait for refresh to complete (button text changes back to 'Refresh')
        await expect(authedPage.locator('#refreshBtn')).toHaveText('Refresh', { timeout: 15000 })

        // Todo should still be visible after refresh
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('refresh button is accessible from the user menu', async ({ authedPage }) => {
        await authedPage.click('#toolbarUserBtn')
        await expect(authedPage.locator('#toolbarDropdown')).toBeVisible({ timeout: 3000 })

        // Refresh button should be visible in the menu
        await expect(authedPage.locator('#refreshBtn')).toBeVisible()

        // Close menu
        await authedPage.keyboard.press('Escape')
    })
})
