import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo, addProject, deleteProject, switchGtdTab } from './helpers/todos.js'

/**
 * Helper: click a project in the sidebar and wait for it to become active.
 */
async function selectProject(page, name) {
    const item = page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
    await item.locator('.project-name').click()
    await expect(item).toHaveClass(/active/, { timeout: 3000 })
}

test.describe('Combined Filter Interactions', () => {
    test('search within project view filters correctly', async ({ authedPage }) => {
        const projName = unique('CF')
        const todoAlpha = `alpha-${unique('CF')}`
        const todoBeta = `beta-${unique('CF')}`

        await addProject(authedPage, projName)
        await addTodo(authedPage, todoAlpha, { project: projName })
        await addTodo(authedPage, todoBeta, { project: projName })

        // Select project
        await selectProject(authedPage, projName)

        // Both should be visible
        await expect(todoItem(authedPage, todoAlpha)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todoBeta)).toBeVisible({ timeout: 5000 })

        // Search for "alpha" — only alpha should remain
        await authedPage.fill('#searchInput', 'alpha')
        await expect(todoItem(authedPage, todoAlpha)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todoBeta)).not.toBeVisible({ timeout: 3000 })

        // Clear search
        await authedPage.fill('#searchInput', '')

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

        // Switch to All tab
        await switchGtdTab(authedPage, 'all')

        // Search input should still have the query
        await expect(authedPage.locator('#searchInput')).toHaveValue(searchTerm)

        // Clear and return to inbox
        await authedPage.fill('#searchInput', '')
        await switchGtdTab(authedPage, 'inbox')
    })

    test('selecting project shows all non-done todos', async ({ authedPage }) => {
        const projName = unique('CF')
        const todoName = unique('CF')

        await addProject(authedPage, projName)
        await addTodo(authedPage, todoName, { project: projName })

        // Currently on Inbox — todo should be visible
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Click project in sidebar
        await selectProject(authedPage, projName)

        // Todo should still be visible (project view shows all non-done)
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todoName)
        await deleteProject(authedPage, projName)
    })

    test('clearing search restores project-filtered view', async ({ authedPage }) => {
        const projName = unique('CF')
        const todo1 = `aa-${unique('CF')}`
        const todo2 = `bb-${unique('CF')}`

        await addProject(authedPage, projName)
        await addTodo(authedPage, todo1, { project: projName })
        await addTodo(authedPage, todo2, { project: projName })

        // Select project
        await selectProject(authedPage, projName)

        // Search for todo1 — only todo1 visible
        await authedPage.fill('#searchInput', 'aa-')
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).not.toBeVisible({ timeout: 3000 })

        // Clear search — both project todos should reappear
        await authedPage.fill('#searchInput', '')
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
        await deleteProject(authedPage, projName)
    })
})
