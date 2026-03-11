import { test, expect } from './fixtures.js'

const unique = () => `SF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
    if (opts.project) {
        await page.selectOption('#modalProjectSelect', { label: opts.project })
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
    await page.waitForTimeout(600)
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

test.describe('Search within GTD status', () => {
    test('search filters todos within the active GTD tab', async ({ authedPage }) => {
        const nextTodo1 = unique()
        const nextTodo2 = unique()

        await addTodo(authedPage, nextTodo1, { gtdStatus: 'next_action' })
        await addTodo(authedPage, nextTodo2, { gtdStatus: 'next_action' })

        // Switch to Next tab
        await switchGtdTab(authedPage, 'next_action')

        // Search for just the first todo
        await search(authedPage, nextTodo1)
        await expect(todoItem(authedPage, nextTodo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, nextTodo2)).not.toBeAttached({ timeout: 5000 })

        // Clear search — both should reappear in Next tab
        await clearSearch(authedPage)
        await expect(todoItem(authedPage, nextTodo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, nextTodo2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, nextTodo1)
        await deleteTodo(authedPage, nextTodo2)
        await switchGtdTab(authedPage, 'inbox')
    })

    test('search does not show todos from other GTD statuses', async ({ authedPage }) => {
        const inboxTodo = unique()
        const nextTodo = unique()

        await addTodo(authedPage, inboxTodo)
        await addTodo(authedPage, nextTodo, { gtdStatus: 'next_action' })

        // Stay on Inbox tab and search for the Next todo
        await switchGtdTab(authedPage, 'inbox')
        await search(authedPage, nextTodo)

        // Should not find it — it's in a different GTD status
        await expect(todoItem(authedPage, nextTodo)).not.toBeAttached({ timeout: 5000 })
        await expect(todoItem(authedPage, inboxTodo)).not.toBeAttached({ timeout: 5000 })

        // Clear and cleanup
        await clearSearch(authedPage)
        await deleteTodo(authedPage, inboxTodo)
        await switchGtdTab(authedPage, 'next_action')
        await deleteTodo(authedPage, nextTodo)
        await switchGtdTab(authedPage, 'inbox')
    })

    test('clearing search restores the correct GTD-filtered view', async ({ authedPage }) => {
        const waitingTodo = unique()
        const inboxTodo = unique()

        await addTodo(authedPage, inboxTodo)
        await addTodo(authedPage, waitingTodo, { gtdStatus: 'waiting_for' })

        // Switch to Waiting tab
        await switchGtdTab(authedPage, 'waiting_for')
        await expect(todoItem(authedPage, waitingTodo)).toBeVisible({ timeout: 5000 })

        // Search for something that doesn't exist
        await search(authedPage, 'zzz-no-match-zzz')
        await expect(todoItem(authedPage, waitingTodo)).not.toBeAttached({ timeout: 5000 })

        // Clear search — should restore Waiting view with its todo
        await clearSearch(authedPage)
        await expect(todoItem(authedPage, waitingTodo)).toBeVisible({ timeout: 5000 })
        // Inbox todo should NOT be visible (still on Waiting tab)
        await expect(todoItem(authedPage, inboxTodo)).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, waitingTodo)
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, inboxTodo)
    })
})

test.describe('Search combined with project and GTD filters', () => {
    test('search within a project view only shows matching project todos', async ({ authedPage }) => {
        const projName = `Proj-${Date.now()}`
        const projTodo1 = unique()
        const projTodo2 = unique()

        await addProject(authedPage, projName)
        await addTodo(authedPage, projTodo1, { project: projName })
        await addTodo(authedPage, projTodo2, { project: projName })

        // Click the project in the sidebar
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        // Both project todos visible
        await expect(todoItem(authedPage, projTodo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, projTodo2)).toBeVisible({ timeout: 5000 })

        // Search narrows down to one
        await search(authedPage, projTodo1)
        await expect(todoItem(authedPage, projTodo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, projTodo2)).not.toBeAttached({ timeout: 5000 })

        // Clear and cleanup
        await clearSearch(authedPage)
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, projTodo1)
        await deleteTodo(authedPage, projTodo2)
        await deleteProject(authedPage, projName)
    })

    test('switching GTD tab clears project filter and search still works', async ({ authedPage }) => {
        const projName = `Proj-${Date.now()}`
        const projTodo = unique()
        const inboxTodo = unique()

        await addProject(authedPage, projName)
        await addTodo(authedPage, projTodo, { project: projName })
        await addTodo(authedPage, inboxTodo)

        // Select project
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        // Switch to Inbox — should deselect project
        await switchGtdTab(authedPage, 'inbox')

        // Search for the inbox todo
        await search(authedPage, inboxTodo)
        await expect(todoItem(authedPage, inboxTodo)).toBeVisible({ timeout: 5000 })

        // Clear and cleanup
        await clearSearch(authedPage)
        await deleteTodo(authedPage, inboxTodo)
        await deleteTodo(authedPage, projTodo)
        await deleteProject(authedPage, projName)
    })
})
