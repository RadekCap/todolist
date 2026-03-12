import { test, expect } from './fixtures.js'

const unique = () => `DPM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: find a project item in the sidebar.
 */
function sidebarProject(page, name) {
    return page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
}

/**
 * Helper: delete a project (no todos).
 */
async function deleteProject(page, name) {
    const item = sidebarProject(page, name)
    if (await item.count() > 0) {
        page.once('dialog', dialog => dialog.accept())
        await item.locator('.project-delete').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

/**
 * Helper: delete a project with "move todos" option.
 * Clicks delete, waits for the custom dialog, selects target project, confirms.
 */
async function deleteProjectWithMove(page, projectName, targetProjectName) {
    const projItem = sidebarProject(page, projectName)
    await projItem.locator('.project-delete').click()

    const dialog = page.locator('.delete-project-dialog-overlay')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Select target project from the move dropdown
    await dialog.locator('.delete-project-dialog-select').selectOption({ label: targetProjectName })

    // Click "Move & Delete" confirm button
    await dialog.locator('[data-action="move-confirm"]').click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
}

test.describe('Delete Project - Move Todos to Another Project', () => {
    test('move todos to another project on delete', async ({ authedPage }) => {
        const projA = unique()
        const projB = unique()
        const todo1 = unique()
        const todo2 = unique()

        await addProject(authedPage, projA)
        await addProject(authedPage, projB)
        await addTodo(authedPage, todo1, { project: projA })
        await addTodo(authedPage, todo2, { project: projA })

        // Delete project A — move todos to project B
        await deleteProjectWithMove(authedPage, projA, projB)

        // Project A should be gone
        await expect(sidebarProject(authedPage, projA)).not.toBeAttached({ timeout: 5000 })

        // Click project B — both todos should be there
        const projBItem = sidebarProject(authedPage, projB)
        await projBItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
        await deleteProject(authedPage, projB)
    })

    test('target project count updates after move', async ({ authedPage }) => {
        const projA = unique()
        const projB = unique()
        const todo1 = unique()
        const todo2 = unique()

        await addProject(authedPage, projA)
        await addProject(authedPage, projB)
        await addTodo(authedPage, todo1, { project: projA })
        await addTodo(authedPage, todo2, { project: projA })

        // Verify initial counts
        const projAItem = sidebarProject(authedPage, projA)
        const projBItem = sidebarProject(authedPage, projB)
        await expect(projAItem.locator('.project-count')).toContainText('2', { timeout: 5000 })

        // Delete project A with move to B
        await deleteProjectWithMove(authedPage, projA, projB)

        // Project B count should now be 2
        await expect(projBItem.locator('.project-count')).toContainText('2', { timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
        await deleteProject(authedPage, projB)
    })

    test('moved todos appear alongside existing todos in target project', async ({ authedPage }) => {
        const projA = unique()
        const projB = unique()
        const todoA1 = unique()
        const todoA2 = unique()
        const todoB1 = unique()

        await addProject(authedPage, projA)
        await addProject(authedPage, projB)
        await addTodo(authedPage, todoA1, { project: projA })
        await addTodo(authedPage, todoA2, { project: projA })
        await addTodo(authedPage, todoB1, { project: projB })

        // Delete project A with move to B
        await deleteProjectWithMove(authedPage, projA, projB)

        // Click project B — should show all 3 todos
        const projBItem = sidebarProject(authedPage, projB)
        await projBItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        await expect(todoItem(authedPage, todoA1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todoA2)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todoB1)).toBeVisible({ timeout: 5000 })

        // Count badge should show 3
        await expect(projBItem.locator('.project-count')).toContainText('3', { timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todoA1)
        await deleteTodo(authedPage, todoA2)
        await deleteTodo(authedPage, todoB1)
        await deleteProject(authedPage, projB)
    })
})
