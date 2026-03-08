import { test, expect } from './fixtures.js'

const unique = () => `GTD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.gtdStatus) {
        await page.selectOption('#modalGtdStatusSelect', opts.gtdStatus)
    }
    if (opts.dueDate) {
        await page.fill('#modalDueDateInput', opts.dueDate)
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
 * Helper: get the badge count text for a GTD tab.
 */
function gtdBadge(page, status) {
    return page.locator(`.gtd-tab.${status} .gtd-tab-badge`)
}

test.describe('GTD Workflow', () => {
    test('GTD tab bar shows all statuses', async ({ authedPage }) => {
        const tabs = authedPage.locator('.gtd-tab-bar .gtd-tab')
        await expect(tabs).toHaveCount(7)

        // Verify each status tab exists
        await expect(authedPage.locator('.gtd-tab.inbox')).toBeVisible()
        await expect(authedPage.locator('.gtd-tab.next_action')).toBeVisible()
        await expect(authedPage.locator('.gtd-tab.scheduled')).toBeVisible()
        await expect(authedPage.locator('.gtd-tab.waiting_for')).toBeVisible()
        await expect(authedPage.locator('.gtd-tab.someday_maybe')).toBeVisible()
        await expect(authedPage.locator('.gtd-tab.done')).toBeVisible()
        await expect(authedPage.locator('.gtd-tab.all')).toBeVisible()
    })

    test('clicking a GTD tab filters todos by that status', async ({ authedPage }) => {
        const inboxTodo = unique()
        const nextTodo = unique()

        // Create an inbox todo (default)
        await addTodo(authedPage, inboxTodo)
        await expect(todoItem(authedPage, inboxTodo)).toBeVisible({ timeout: 5000 })

        // Create a "Next Action" todo
        await addTodo(authedPage, nextTodo, { gtdStatus: 'next_action' })

        // Switch to Next tab — only nextTodo should be visible
        await switchGtdTab(authedPage, 'next_action')
        await expect(todoItem(authedPage, nextTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, inboxTodo)).not.toBeAttached({ timeout: 5000 })

        // Switch to Inbox — only inboxTodo should be visible
        await switchGtdTab(authedPage, 'inbox')
        await expect(todoItem(authedPage, inboxTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, nextTodo)).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, inboxTodo)
        await switchGtdTab(authedPage, 'next_action')
        await deleteTodo(authedPage, nextTodo)
    })

    test('GTD badge counts are accurate', async ({ authedPage }) => {
        const name = unique()

        // Record initial inbox badge
        const inboxBadge = gtdBadge(authedPage, 'inbox')
        const initialCount = await inboxBadge.isVisible() ? parseInt(await inboxBadge.textContent()) : 0

        // Add a todo (defaults to inbox)
        await addTodo(authedPage, name)

        // Badge count should increase by 1
        await expect(inboxBadge).toHaveText(String(initialCount + 1), { timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('new todos default to Inbox status', async ({ authedPage }) => {
        const name = unique()

        // Ensure we're on Inbox tab
        await switchGtdTab(authedPage, 'inbox')

        // Add todo without specifying GTD status
        await addTodo(authedPage, name)

        // Todo should appear in Inbox
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Should NOT appear in Next Action
        await switchGtdTab(authedPage, 'next_action')
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Back to Inbox for cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, name)
    })

    test('change a todo GTD status via the edit modal', async ({ authedPage }) => {
        const name = unique()

        // Start on Inbox
        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open edit modal by clicking the todo text
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Change GTD status to "Waiting For"
        await authedPage.selectOption('#modalGtdStatusSelect', 'waiting_for')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should disappear from Inbox
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Should appear in Waiting tab
        await switchGtdTab(authedPage, 'waiting_for')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('undo a GTD status change', async ({ authedPage }) => {
        const name = unique()

        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Change status via edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalGtdStatusSelect', 'someday_maybe')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should be gone from Inbox
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Undo via Ctrl+Z
        await authedPage.keyboard.press('Control+z')

        // Todo should reappear in Inbox
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('All view shows todos across all statuses', async ({ authedPage }) => {
        const inboxTodo = unique()
        const waitingTodo = unique()

        // Create todos in different statuses
        await addTodo(authedPage, inboxTodo)
        await addTodo(authedPage, waitingTodo, { gtdStatus: 'waiting_for' })

        // Switch to All — both should be visible
        await switchGtdTab(authedPage, 'all')
        await expect(todoItem(authedPage, inboxTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, waitingTodo)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, inboxTodo)
        await deleteTodo(authedPage, waitingTodo)
    })

    test('completing a todo moves it to Done', async ({ authedPage }) => {
        const name = unique()

        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, name)
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Check the completion checkbox
        await item.locator('.todo-checkbox').check()

        // Todo should disappear from Inbox
        await expect(item).not.toBeAttached({ timeout: 5000 })

        // Should appear in Done tab as completed
        await switchGtdTab(authedPage, 'done')
        const doneItem = todoItem(authedPage, name)
        await expect(doneItem).toBeVisible({ timeout: 5000 })
        await expect(doneItem).toHaveClass(/completed/)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('Done view shows completed todos', async ({ authedPage }) => {
        const name = unique()

        // Create a todo and complete it
        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, name)
        await todoItem(authedPage, name).locator('.todo-checkbox').check()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Switch to Done
        await switchGtdTab(authedPage, 'done')
        const doneItem = todoItem(authedPage, name)
        await expect(doneItem).toBeVisible({ timeout: 5000 })
        await expect(doneItem).toHaveClass(/completed/)

        // Uncheck to restore — moves back from Done
        await doneItem.locator('.todo-checkbox').uncheck()
        await expect(doneItem).not.toBeAttached({ timeout: 5000 })

        // Verify it's back in Inbox
        await switchGtdTab(authedPage, 'inbox')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
