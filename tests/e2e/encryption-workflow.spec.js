import { test, expect } from './fixtures.js'

const unique = () => `EW-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: delete a project.
 */
async function deleteProject(page, name) {
    const item = page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
    if (await item.count() > 0) {
        page.once('dialog', dialog => dialog.accept())
        await item.locator('.project-delete').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

/**
 * Helper: wait for app to be fully ready after page load/reload.
 */
async function waitForApp(page) {
    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 30000 })
    await expect(page.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 10000 })
    // Wait for data to load from Supabase
    await page.waitForTimeout(2000)
}

test.describe('Encryption Workflow', () => {
    test('todo text is readable after creation', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)

        // Text should be displayed correctly (encrypted/decrypted roundtrip)
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo text persists correctly after page reload', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Reload the page
        await authedPage.reload()
        await waitForApp(authedPage)

        // Todo should still be readable
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 15000 })
        await expect(todoItem(authedPage, name).locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('project names survive encryption roundtrip after reload', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Reload
        await authedPage.reload()
        await waitForApp(authedPage)

        // Project name should still be readable in sidebar
        const projItem = authedPage.locator('#projectList .project-item .project-name', { hasText: projName })
        await expect(projItem).toBeVisible({ timeout: 15000 })

        // Cleanup
        await deleteProject(authedPage, projName)
    })
})
