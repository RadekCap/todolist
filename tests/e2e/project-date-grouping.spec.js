import { test, expect } from './fixtures.js'

const unique = () => `PDG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.dueDate) {
        await page.fill('#modalDueDateInput', opts.dueDate)
    }
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
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: select a project in the sidebar.
 */
async function selectProject(page, name) {
    const projItem = page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
    await projItem.locator('.project-name').click()
    await page.waitForTimeout(500)
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
 * Helper: get a date string in YYYY-MM-DD format.
 */
function getDateOffset(daysFromNow) {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    return d.toISOString().split('T')[0]
}

test.describe('Project View - Date Grouping', () => {
    test('project view groups todos with due dates by date sections', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        const todayTodo = unique()
        const tomorrowTodo = unique()
        await addTodo(authedPage, todayTodo, { project: projName, dueDate: getDateOffset(0) })
        await addTodo(authedPage, tomorrowTodo, { project: projName, dueDate: getDateOffset(1) })

        await selectProject(authedPage, projName)

        // Both todos and their section headers should be visible
        await expect(todoItem(authedPage, todayTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, tomorrowTodo)).toBeVisible({ timeout: 5000 })
        await expect(authedPage.locator('li.scheduled-section-header.today')).toBeVisible()
        await expect(authedPage.locator('li.scheduled-section-header.tomorrow')).toBeVisible()

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todayTodo)
        await deleteTodo(authedPage, tomorrowTodo)
        await deleteProject(authedPage, projName)
    })

    test('project view shows No Date section for todos without due dates', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        const noDateTodo = unique()
        await addTodo(authedPage, noDateTodo, { project: projName })

        await selectProject(authedPage, projName)

        await expect(todoItem(authedPage, noDateTodo)).toBeVisible({ timeout: 5000 })
        await expect(authedPage.locator('li.scheduled-section-header.no-date')).toBeVisible()
        await expect(authedPage.locator('li.scheduled-section-header.no-date .section-header-text')).toContainText('No Date')

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, noDateTodo)
        await deleteProject(authedPage, projName)
    })

    test('project view shows Overdue section for past-due todos', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        const overdueTodo = unique()
        await addTodo(authedPage, overdueTodo, { project: projName, dueDate: getDateOffset(-2) })

        await selectProject(authedPage, projName)

        await expect(todoItem(authedPage, overdueTodo)).toBeVisible({ timeout: 5000 })
        await expect(authedPage.locator('li.scheduled-section-header.overdue')).toBeVisible()
        await expect(authedPage.locator('li.scheduled-section-header.overdue .section-header-text')).toContainText('Overdue')

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, overdueTodo)
        await deleteProject(authedPage, projName)
    })

    test('project view excludes done todos', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        const activeTodo = unique()
        const doneTodo = unique()
        await addTodo(authedPage, activeTodo, { project: projName, dueDate: getDateOffset(0) })
        await addTodo(authedPage, doneTodo, { project: projName, dueDate: getDateOffset(0), gtdStatus: 'done' })

        await selectProject(authedPage, projName)

        // Active todo should be visible, done todo should not
        await expect(todoItem(authedPage, activeTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, doneTodo)).not.toBeAttached({ timeout: 3000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, activeTodo)
        // Delete done todo from Done tab
        await switchGtdTab(authedPage, 'done')
        await deleteTodo(authedPage, doneTodo)
        await switchGtdTab(authedPage, 'inbox')
        await deleteProject(authedPage, projName)
    })

    test('project view sorts todos by due date ascending', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        const laterTodo = unique()
        const todayTodo = unique()
        // Add later todo first, today todo second — project view should sort by date
        await addTodo(authedPage, laterTodo, { project: projName, dueDate: getDateOffset(15) })
        await addTodo(authedPage, todayTodo, { project: projName, dueDate: getDateOffset(0) })

        await selectProject(authedPage, projName)

        await expect(todoItem(authedPage, todayTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, laterTodo)).toBeVisible({ timeout: 5000 })

        // Today's todo should appear before the later one in the DOM
        const todoItems = authedPage.locator('.todo-item')
        const allTexts = await todoItems.allTextContents()
        const todayIndex = allTexts.findIndex(t => t.includes(todayTodo))
        const laterIndex = allTexts.findIndex(t => t.includes(laterTodo))
        expect(todayIndex).toBeLessThan(laterIndex)

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, laterTodo)
        await deleteTodo(authedPage, todayTodo)
        await deleteProject(authedPage, projName)
    })
})
