import { test, expect } from './fixtures.js'

const unique = () => `PV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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

/**
 * Helper: click "All Projects" in the sidebar.
 */
async function clickAllProjects(page) {
    const allProjectsItem = page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: 'All Projects' }) })
    await allProjectsItem.click()
    await page.waitForTimeout(500)
}

test.describe('All Projects View', () => {
    test('clicking All Projects shows project cards', async ({ authedPage }) => {
        const projName = unique()

        // Create a project with a todo
        await addProject(authedPage, projName)
        const todoName = unique()
        await addTodo(authedPage, todoName, { project: projName })

        // Click "All Projects"
        await clickAllProjects(authedPage)

        // Should see project cards
        const projectCard = authedPage.locator('.project-card', { has: authedPage.locator('.project-card-name', { hasText: projName }) })
        await expect(projectCard).toBeVisible({ timeout: 5000 })

        // Card should show item count
        await expect(projectCard.locator('.project-card-count')).toBeVisible()

        // Go back to inbox
        await switchGtdTab(authedPage, 'inbox')

        // Cleanup
        await deleteTodo(authedPage, todoName)
        await deleteProject(authedPage, projName)
    })

    test('project card shows correct item count', async ({ authedPage }) => {
        const projName = unique()

        await addProject(authedPage, projName)
        const todo1 = unique()
        const todo2 = unique()
        await addTodo(authedPage, todo1, { project: projName })
        await addTodo(authedPage, todo2, { project: projName })

        // Click "All Projects"
        await clickAllProjects(authedPage)

        // Project card should show "2 items"
        const projectCard = authedPage.locator('.project-card', { has: authedPage.locator('.project-card-name', { hasText: projName }) })
        await expect(projectCard).toBeVisible({ timeout: 5000 })
        await expect(projectCard.locator('.project-card-count')).toContainText('2')

        // Go back to inbox
        await switchGtdTab(authedPage, 'inbox')

        // Cleanup
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
        await deleteProject(authedPage, projName)
    })

    test('clicking a project card filters to that project', async ({ authedPage }) => {
        const projName = unique()

        await addProject(authedPage, projName)
        const todoName = unique()
        const otherTodo = unique()
        await addTodo(authedPage, todoName, { project: projName })
        await addTodo(authedPage, otherTodo)

        // Click "All Projects"
        await clickAllProjects(authedPage)

        // Click the project card
        const projectCard = authedPage.locator('.project-card', { has: authedPage.locator('.project-card-name', { hasText: projName }) })
        await expect(projectCard).toBeVisible({ timeout: 5000 })
        await projectCard.click()
        await authedPage.waitForTimeout(500)

        // Should see only the project's todo
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, otherTodo)).not.toBeAttached({ timeout: 5000 })

        // Go back to inbox
        await switchGtdTab(authedPage, 'inbox')

        // Cleanup
        await deleteTodo(authedPage, todoName)
        await deleteTodo(authedPage, otherTodo)
        await deleteProject(authedPage, projName)
    })
})
