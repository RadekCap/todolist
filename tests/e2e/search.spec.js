import { test, expect } from './fixtures.js'

const unique = () => `Search-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.project) {
        await page.selectOption('#modalProjectSelect', { label: opts.project })
    }
    if (opts.gtdStatus) {
        await page.selectOption('#modalGtdStatusSelect', opts.gtdStatus)
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
 * Helper: type into the search input and wait for debounce.
 */
async function search(page, query) {
    await page.fill('#searchInput', query)
    await page.waitForTimeout(600) // debounce is ~setTimeout
}

/**
 * Helper: clear the search input.
 */
async function clearSearch(page) {
    await page.fill('#searchInput', '')
    await page.waitForTimeout(600)
}

/**
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: delete a project from the sidebar.
 */
async function deleteProject(page, name) {
    const item = page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
    if (await item.count() > 0) {
        page.once('dialog', dialog => dialog.accept())
        await item.locator('.project-delete').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

test.describe('Search and Filtering', () => {
    test('search input filters todos by text', async ({ authedPage }) => {
        const matchTodo = unique()
        const noMatchTodo = unique()

        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, matchTodo)
        await addTodo(authedPage, noMatchTodo)

        // Search for the first todo's unique suffix
        await search(authedPage, matchTodo)

        // Only matching todo should be visible
        await expect(todoItem(authedPage, matchTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, noMatchTodo)).not.toBeAttached({ timeout: 5000 })

        // Clear search
        await clearSearch(authedPage)

        // Cleanup
        await deleteTodo(authedPage, matchTodo)
        await deleteTodo(authedPage, noMatchTodo)
    })

    test('search is case-insensitive', async ({ authedPage }) => {
        const name = unique()

        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, name)

        // Search with uppercase version
        await search(authedPage, name.toUpperCase())

        // Todo should still be found
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Search with lowercase version
        await search(authedPage, name.toLowerCase())
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Clear search
        await clearSearch(authedPage)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('clearing search shows all todos again', async ({ authedPage }) => {
        const todo1 = unique()
        const todo2 = unique()

        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, todo1)
        await addTodo(authedPage, todo2)

        // Search for first todo only
        await search(authedPage, todo1)
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).not.toBeAttached({ timeout: 5000 })

        // Clear search — both should be visible again
        await clearSearch(authedPage)
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
    })

    test('search works across different GTD statuses', async ({ authedPage }) => {
        const inboxTodo = unique()
        const waitingTodo = unique()

        await addTodo(authedPage, inboxTodo)
        await addTodo(authedPage, waitingTodo, { gtdStatus: 'waiting_for' })

        // Switch to All to see all statuses
        await switchGtdTab(authedPage, 'all')

        // Search for the waiting todo
        await search(authedPage, waitingTodo)

        // Only waiting todo should be visible
        await expect(todoItem(authedPage, waitingTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, inboxTodo)).not.toBeAttached({ timeout: 5000 })

        // Clear search
        await clearSearch(authedPage)

        // Cleanup
        await deleteTodo(authedPage, inboxTodo)
        await deleteTodo(authedPage, waitingTodo)
    })

    test('search combined with project filter', async ({ authedPage }) => {
        const projName = `Proj-${Date.now()}`
        const projTodo = unique()
        const otherTodo = unique()

        // Create project and todos
        await addProject(authedPage, projName)
        await addTodo(authedPage, projTodo, { project: projName })
        await addTodo(authedPage, otherTodo)

        // Select project to filter
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.click()

        // Only project's todo should be visible
        await expect(todoItem(authedPage, projTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, otherTodo)).not.toBeAttached({ timeout: 5000 })

        // Search within the project-filtered view
        await search(authedPage, projTodo)
        await expect(todoItem(authedPage, projTodo)).toBeVisible({ timeout: 5000 })

        // Search for something not in the project — should show empty
        await search(authedPage, 'zzz-nonexistent-zzz')
        await expect(todoItem(authedPage, projTodo)).not.toBeAttached({ timeout: 5000 })

        // Clear search and exit project view
        await clearSearch(authedPage)
        await switchGtdTab(authedPage, 'inbox')

        // Cleanup
        await deleteTodo(authedPage, projTodo)
        await deleteTodo(authedPage, otherTodo)
        await deleteProject(authedPage, projName)
    })

    test('empty search results show appropriate message', async ({ authedPage }) => {
        // Use "All" tab since Inbox shows a special zen state when empty
        await switchGtdTab(authedPage, 'all')

        // Search for something that doesn't exist
        await search(authedPage, 'zzz-absolutely-no-match-zzz')

        // Should show empty state message
        await expect(authedPage.locator('.empty-state')).toContainText('No todos match your search', { timeout: 5000 })

        // Clear search
        await clearSearch(authedPage)
    })
})
