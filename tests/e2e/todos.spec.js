import { test, expect } from './fixtures.js'

const unique = () => `Test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal and return its name.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.comment) {
        await page.fill('#modalCommentInput', opts.comment)
    }
    if (opts.dueDate) {
        await page.fill('#modalDueDateInput', opts.dueDate)
    }
    if (opts.project) {
        await page.selectOption('#modalProjectSelect', { label: opts.project })
    }
    if (opts.category) {
        await page.selectOption('#modalCategorySelect', { label: opts.category })
    }
    if (opts.context) {
        await page.selectOption('#modalContextSelect', { label: opts.context })
    }
    if (opts.priority) {
        await page.selectOption('#modalPrioritySelect', { label: opts.priority })
    }

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
 * Helper: click a GTD tab in the sidebar.
 */
async function switchGtdTab(page, status) {
    await page.click(`.gtd-tab.${status}`)
    await page.waitForTimeout(500)
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

test.describe('Todo CRUD', () => {
    test('add a new todo via the modal', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)

        // New todo should appear in the list
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit a todo text and comment', async ({ authedPage }) => {
        const name = unique()
        const updatedName = `${name}-edited`
        await addTodo(authedPage, name)

        // Click on todo text to open edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Edit text
        await authedPage.fill('#modalTodoInput', updatedName)
        await authedPage.fill('#modalCommentInput', 'Updated comment')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify updated text
        await expect(todoItem(authedPage, updatedName)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, updatedName)
    })

    test('delete a todo', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo
        await todoItem(authedPage, name).locator('.delete-btn').click()

        // Todo should be removed from the list
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })
    })

    test('toggle todo completion via checkbox', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Check the completion checkbox — this moves todo to "Done" GTD tab
        await item.locator('.todo-checkbox').check()

        // Todo should disappear from Inbox (moved to Done)
        await expect(item).not.toBeAttached({ timeout: 5000 })

        // Switch to Done tab to verify the todo is there
        await switchGtdTab(authedPage, 'done')
        const doneItem = todoItem(authedPage, name)
        await expect(doneItem).toBeVisible({ timeout: 5000 })
        await expect(doneItem).toHaveClass(/completed/)

        // Uncheck to restore — moves back to Inbox
        await doneItem.locator('.todo-checkbox').uncheck()
        await expect(doneItem).not.toBeAttached({ timeout: 5000 })

        // Switch back to Inbox and verify it's there
        await switchGtdTab(authedPage, 'inbox')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('undo deleted todo via Ctrl+Z', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Undo with Ctrl+Z
        await authedPage.keyboard.press('Control+z')

        // Todo should reappear
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('undo deleted todo via toast button', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Click undo on the toast notification
        const undoBtn = authedPage.locator('.toast-undo-btn')
        await expect(undoBtn).toBeVisible({ timeout: 5000 })
        await undoBtn.click()

        // Todo should reappear
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('set a due date on a todo', async ({ authedPage }) => {
        const name = unique()
        const dueDate = '2099-12-31'
        await addTodo(authedPage, name, { dueDate })

        // Setting a due date auto-changes GTD status to "scheduled"
        await switchGtdTab(authedPage, 'scheduled')

        // Todo should show the due date badge
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-date')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('add a todo with a comment', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name, { comment: 'My test comment' })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Comment should be visible on the todo item
        await expect(item.locator('.todo-comment')).toContainText('My test comment')

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit a todo due date', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)

        // Open edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Set due date (this auto-changes GTD status to "scheduled")
        await authedPage.fill('#modalDueDateInput', '2099-06-15')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Switch to Scheduled tab where the todo moved
        await switchGtdTab(authedPage, 'scheduled')

        // Verify date badge appears
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-date')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
