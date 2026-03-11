import { test, expect } from './fixtures.js'

const unique = () => `CF2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: find a project in the sidebar.
 */
function sidebarProject(page, name) {
    return page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
}

/**
 * Helper: delete a project.
 */
async function deleteProject(page, name) {
    const item = sidebarProject(page, name)
    if (await item.count() > 0) {
        page.once('dialog', dialog => dialog.accept())
        await item.locator('.project-delete').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

test.describe('Combined Filter Interactions', () => {
    test('search within project view filters correctly', async ({ authedPage }) => {
        const projName = unique()
        const todoAlpha = `alpha-${unique()}`
        const todoBeta = `beta-${unique()}`

        await addProject(authedPage, projName)
        await addTodo(authedPage, todoAlpha, { project: projName })
        await addTodo(authedPage, todoBeta, { project: projName })

        // Select project
        await sidebarProject(authedPage, projName).locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        // Both should be visible
        await expect(todoItem(authedPage, todoAlpha)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todoBeta)).toBeVisible({ timeout: 5000 })

        // Search for "alpha"
        await authedPage.fill('#searchInput', 'alpha')
        await authedPage.waitForTimeout(500)

        // Only alpha should be visible
        await expect(todoItem(authedPage, todoAlpha)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todoBeta)).not.toBeVisible({ timeout: 3000 })

        // Clear search
        await authedPage.fill('#searchInput', '')
        await authedPage.waitForTimeout(500)

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todoAlpha)
        await deleteTodo(authedPage, todoBeta)
        await deleteProject(authedPage, projName)
    })

    test('switching GTD tab preserves search query', async ({ authedPage }) => {
        const searchTerm = `srch-${Date.now()}`

        // Enter search text
        await authedPage.fill('#searchInput', searchTerm)
        await authedPage.waitForTimeout(300)

        // Switch to All tab
        await switchGtdTab(authedPage, 'all')

        // Search input should still have the query
        const searchValue = await authedPage.locator('#searchInput').inputValue()
        expect(searchValue).toBe(searchTerm)

        // Clear and return to inbox
        await authedPage.fill('#searchInput', '')
        await switchGtdTab(authedPage, 'inbox')
    })

    test('selecting project shows all non-done todos', async ({ authedPage }) => {
        const projName = unique()
        const todoName = unique()

        await addProject(authedPage, projName)
        await addTodo(authedPage, todoName, { project: projName })

        // Currently on Inbox — todo should be visible
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Click project in sidebar
        await sidebarProject(authedPage, projName).locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        // Todo should still be visible (project view shows all non-done)
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todoName)
        await deleteProject(authedPage, projName)
    })

    test('clearing search restores project-filtered view', async ({ authedPage }) => {
        const projName = unique()
        const todo1 = `aa-${unique()}`
        const todo2 = `bb-${unique()}`

        await addProject(authedPage, projName)
        await addTodo(authedPage, todo1, { project: projName })
        await addTodo(authedPage, todo2, { project: projName })

        // Select project
        await sidebarProject(authedPage, projName).locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        // Search for todo1
        await authedPage.fill('#searchInput', 'aa-')
        await authedPage.waitForTimeout(500)
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).not.toBeVisible({ timeout: 3000 })

        // Clear search — both project todos should reappear
        await authedPage.fill('#searchInput', '')
        await authedPage.waitForTimeout(500)
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
        await deleteProject(authedPage, projName)
    })
})
