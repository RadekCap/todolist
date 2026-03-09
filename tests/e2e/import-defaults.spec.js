import { test, expect } from './fixtures.js'

const unique = () => `ID-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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

test.describe('Import with Default Fields', () => {
    test('import modal shows all default field selects', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Verify all default field selects are visible
        await expect(authedPage.locator('#importGtdStatusSelect')).toBeVisible()
        await expect(authedPage.locator('#importProjectSelect')).toBeVisible()
        await expect(authedPage.locator('#importDueDateInput')).toBeVisible()

        // Close modal
        await authedPage.click('#cancelImportModal')
        await expect(authedPage.locator('#importModal')).not.toBeVisible()
    })

    test('import with GTD status default applies to all imported todos', async ({ authedPage }) => {
        const todo1 = unique()
        const todo2 = unique()

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Set GTD status to "Next Action"
        await authedPage.selectOption('#importGtdStatusSelect', 'next_action')

        // Enter todos
        await authedPage.fill('#importTextarea', `${todo1}\n${todo2}`)

        // Submit
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Todos should appear in the "Next" tab
        await switchGtdTab(authedPage, 'next_action')
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
    })

    test('import with project default assigns todos to project', async ({ authedPage }) => {
        const projName = unique()
        const todoName = unique()

        // Create a project first
        await addProject(authedPage, projName)

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Select the project as default
        await authedPage.selectOption('#importProjectSelect', { label: projName })

        // Enter todo
        await authedPage.fill('#importTextarea', todoName)

        // Submit
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Click on the project in the sidebar to filter
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.click()
        await authedPage.waitForTimeout(500)

        // Imported todo should be visible under this project
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Go back to inbox
        await switchGtdTab(authedPage, 'inbox')

        // Cleanup
        await deleteTodo(authedPage, todoName)
        await deleteProject(authedPage, projName)
    })

    test('import with due date default sets date on all todos', async ({ authedPage }) => {
        const todoName = unique()
        const dueDate = '2099-12-31'

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Set due date default
        await authedPage.fill('#importDueDateInput', dueDate)

        // Enter todo
        await authedPage.fill('#importTextarea', todoName)

        // Submit
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Todo with due date should appear in Scheduled
        await switchGtdTab(authedPage, 'scheduled')
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Verify date badge is shown
        await expect(todoItem(authedPage, todoName).locator('.todo-date')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })

    test('import pre-selects current GTD status', async ({ authedPage }) => {
        // Switch to "Waiting" tab
        await switchGtdTab(authedPage, 'waiting_for')

        // Open import modal — should pre-select "waiting_for" as GTD status
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        const selectedValue = await authedPage.locator('#importGtdStatusSelect').inputValue()
        expect(selectedValue).toBe('waiting_for')

        // Close
        await authedPage.click('#cancelImportModal')
        await expect(authedPage.locator('#importModal')).not.toBeVisible()

        // Return to inbox
        await switchGtdTab(authedPage, 'inbox')
    })
})
