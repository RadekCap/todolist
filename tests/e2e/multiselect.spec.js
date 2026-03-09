import { test, expect } from './fixtures.js'

const unique = () => `MS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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

/**
 * Helper: select a todo's selection checkbox.
 */
async function selectTodo(page, text) {
    const item = todoItem(page, text)
    await item.locator('.todo-select-checkbox').check()
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

test.describe('Multi-select and Selection Bar', () => {
    test('select multiple todos via checkboxes', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 3)

        // Select two of the three
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Verify selection checkboxes are checked
        await expect(todoItem(authedPage, names[0]).locator('.todo-select-checkbox')).toBeChecked()
        await expect(todoItem(authedPage, names[1]).locator('.todo-select-checkbox')).toBeChecked()
        await expect(todoItem(authedPage, names[2]).locator('.todo-select-checkbox')).not.toBeChecked()

        // Cleanup
        await authedPage.click('#clearSelectionBtn')
        await cleanupTodos(authedPage, names)
    })

    test('selection bar appears with correct count', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Selection bar should not be visible initially
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/)

        // Select one todo
        await selectTodo(authedPage, names[0])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)
        await expect(authedPage.locator('#selectionCount')).toContainText('1 selected')

        // Select second todo
        await selectTodo(authedPage, names[1])
        await expect(authedPage.locator('#selectionCount')).toContainText('2 selected')

        // Cleanup
        await authedPage.click('#clearSelectionBtn')
        await cleanupTodos(authedPage, names)
    })

    test('deselect all clears selection bar', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Clear selection
        await authedPage.click('#clearSelectionBtn')

        // Selection bar should hide
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/)

        // Cleanup
        await cleanupTodos(authedPage, names)
    })

    test('select all / deselect all toggle', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 3)

        // Select one to make selection bar visible
        await selectTodo(authedPage, names[0])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Click Select All
        await authedPage.click('#selectAllBtn')

        // All checkboxes should be checked
        for (const name of names) {
            await expect(todoItem(authedPage, name).locator('.todo-select-checkbox')).toBeChecked()
        }

        // Click Clear to deselect all
        await authedPage.click('#clearSelectionBtn')
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/)

        // Cleanup
        await cleanupTodos(authedPage, names)
    })
})

test.describe('Bulk Operations', () => {
    test('bulk delete selected todos', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 3)

        // Select first two
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Accept the confirmation dialog
        authedPage.once('dialog', dialog => dialog.accept())
        await authedPage.click('#deleteSelectedBtn')

        // First two should be gone, third remains
        await expect(todoItem(authedPage, names[0])).not.toBeAttached({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).not.toBeAttached({ timeout: 5000 })
        await expect(todoItem(authedPage, names[2])).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, names[2])
    })

    test('undo bulk delete', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Delete
        authedPage.once('dialog', dialog => dialog.accept())
        await authedPage.click('#deleteSelectedBtn')

        // Both should be gone
        await expect(todoItem(authedPage, names[0])).not.toBeAttached({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).not.toBeAttached({ timeout: 5000 })

        // Undo via toast
        const undoBtn = authedPage.locator('.toast-undo-btn')
        await expect(undoBtn).toBeVisible({ timeout: 5000 })
        await undoBtn.click()

        // Both should reappear
        await expect(todoItem(authedPage, names[0])).toBeVisible({ timeout: 10000 })
        await expect(todoItem(authedPage, names[1])).toBeVisible({ timeout: 10000 })

        // Cleanup
        await cleanupTodos(authedPage, names)
    })

    test('bulk change GTD status', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Change status to "waiting_for" via the selection bar dropdown
        await authedPage.selectOption('#selectionGtdStatusSelect', 'waiting_for')

        // Todos should disappear from Inbox (moved to Waiting)
        await expect(todoItem(authedPage, names[0])).not.toBeAttached({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).not.toBeAttached({ timeout: 5000 })

        // Switch to Waiting tab and verify they're there
        await switchGtdTab(authedPage, 'waiting_for')
        await expect(todoItem(authedPage, names[0])).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).toBeVisible({ timeout: 5000 })

        // Cleanup
        await cleanupTodos(authedPage, names)
    })

    test('undo bulk status change', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both and move to Waiting
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])
        await authedPage.selectOption('#selectionGtdStatusSelect', 'waiting_for')

        // Todos disappear from Inbox
        await expect(todoItem(authedPage, names[0])).not.toBeAttached({ timeout: 5000 })

        // Undo via Ctrl+Z
        await authedPage.keyboard.press('Control+z')

        // Todos should reappear in Inbox
        await expect(todoItem(authedPage, names[0])).toBeVisible({ timeout: 10000 })
        await expect(todoItem(authedPage, names[1])).toBeVisible({ timeout: 10000 })

        // Cleanup
        await cleanupTodos(authedPage, names)
    })

    test('bulk change project assignment', async ({ authedPage }) => {
        const projName = `Proj-${Date.now()}`
        const names = await createTodos(authedPage, 2)

        // Create a project
        await authedPage.fill('#newProjectInput', projName)
        await authedPage.click('#addProjectBtn')
        await expect(authedPage.locator('#projectList .project-item .project-name', { hasText: projName })).toBeVisible({ timeout: 5000 })

        // Select both todos
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Assign to project via selection bar dropdown
        await authedPage.selectOption('#selectionProjectSelect', { label: projName })

        // Wait for operation to complete (selection clears after bulk op)
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/, { timeout: 5000 })

        // Click the project in sidebar to filter by it
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.click()

        // Both todos should be visible under this project
        await expect(todoItem(authedPage, names[0])).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).toBeVisible({ timeout: 5000 })

        // Go back to Inbox view
        await switchGtdTab(authedPage, 'inbox')

        // Cleanup
        await cleanupTodos(authedPage, names)
        // Delete project
        authedPage.once('dialog', dialog => dialog.accept())
        await projItem.locator('.project-delete').click()
        await expect(projItem).not.toBeAttached({ timeout: 5000 })
    })

    test('bulk change priority', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Get the first available priority option (skip the placeholder and "No Priority")
        const priorityOptions = authedPage.locator('#selectionPrioritySelect option')
        const optionCount = await priorityOptions.count()

        if (optionCount > 2) {
            // There are priority options available — select the first real one
            const firstPriorityValue = await priorityOptions.nth(2).getAttribute('value')
            await authedPage.selectOption('#selectionPrioritySelect', firstPriorityValue)

            // Selection should clear after bulk operation
            await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/, { timeout: 5000 })
        }

        // Cleanup
        await cleanupTodos(authedPage, names)
    })

    test('bulk complete selected todos', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 3)

        // Select first two
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Click Complete button in selection bar
        await authedPage.click('#completeSelectedBtn')

        // First two should disappear from Inbox (moved to Done)
        await expect(todoItem(authedPage, names[0])).not.toBeAttached({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).not.toBeAttached({ timeout: 5000 })

        // Third should remain
        await expect(todoItem(authedPage, names[2])).toBeVisible()

        // Switch to Done tab and verify completed todos are there
        await switchGtdTab(authedPage, 'done')
        await expect(todoItem(authedPage, names[0])).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).toBeVisible({ timeout: 5000 })

        // Cleanup from Done
        await deleteTodo(authedPage, names[0])
        await deleteTodo(authedPage, names[1])

        // Cleanup remaining from Inbox
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, names[2])
    })
})
