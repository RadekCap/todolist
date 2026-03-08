import { test, expect } from './fixtures.js'

const unique = () => `Proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a project via the sidebar input.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: find a project item in the sidebar by name.
 */
function sidebarProject(page, name) {
    return page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
}

/**
 * Helper: open the Manage Projects modal.
 */
async function openManageModal(page) {
    await page.click('#manageProjectsBtn')
    await expect(page.locator('#manageProjectsModal')).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: close the Manage Projects modal.
 */
async function closeManageModal(page) {
    await page.click('#closeManageProjectsModalBtn')
    await expect(page.locator('#manageProjectsModal')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Helper: find a project item in the Manage Projects modal by name.
 */
function manageProject(page, name) {
    return page.locator('.manage-projects-item', { has: page.locator('.manage-projects-name', { hasText: name }) })
}

/**
 * Helper: delete a project from the sidebar (for cleanup).
 * Handles both confirm dialog (no todos) and custom dialog (has todos).
 */
async function deleteProjectFromSidebar(page, name) {
    const item = sidebarProject(page, name)
    if (await item.count() === 0) return

    // Use dialog handler for window.confirm (project with no todos)
    page.once('dialog', dialog => dialog.accept())
    await item.locator('.project-delete').click()
    await expect(item).not.toBeAttached({ timeout: 5000 })
}

/**
 * Helper: add a todo and assign it to a project via the modal.
 */
async function addTodoToProject(page, todoText, projectName) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', todoText)
    await page.selectOption('#modalProjectSelect', { label: projectName })
    await page.click('#addTodoForm button[type="submit"]')
    await expect(page.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Helper: find a todo item by text.
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

test.describe('Projects', () => {
    test('add a new project via sidebar', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        // Project should appear in sidebar
        await expect(sidebarProject(authedPage, name)).toBeVisible()

        // Cleanup
        await deleteProjectFromSidebar(authedPage, name)
    })

    test('add a project via Manage Projects modal', async ({ authedPage }) => {
        const name = unique()
        await openManageModal(authedPage)

        await authedPage.fill('#newProjectModalInput', name)
        await authedPage.click('#addNewProjectBtn')

        // Project should appear in the manage list
        await expect(manageProject(authedPage, name)).toBeVisible({ timeout: 5000 })

        await closeManageModal(authedPage)

        // Also appears in sidebar
        await expect(sidebarProject(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteProjectFromSidebar(authedPage, name)
    })

    test('rename a project via Manage Projects modal', async ({ authedPage }) => {
        const name = unique()
        const newName = `${name}-renamed`
        await addProject(authedPage, name)

        await openManageModal(authedPage)

        // Click edit button on the project
        await manageProject(authedPage, name).locator('.manage-projects-edit').click()

        // Inline edit input should appear
        const nameInput = authedPage.locator('.manage-projects-name-input')
        await expect(nameInput).toBeVisible({ timeout: 3000 })

        // Clear and type new name
        await nameInput.fill(newName)
        await nameInput.press('Enter')

        // Verify renamed in modal
        await expect(manageProject(authedPage, newName)).toBeVisible({ timeout: 5000 })

        await closeManageModal(authedPage)

        // Verify renamed in sidebar
        await expect(sidebarProject(authedPage, newName)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteProjectFromSidebar(authedPage, newName)
    })

    test('delete a project with no todos', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        // Accept the confirm dialog
        authedPage.once('dialog', dialog => dialog.accept())
        await sidebarProject(authedPage, name).locator('.project-delete').click()

        // Project should be removed
        await expect(sidebarProject(authedPage, name)).not.toBeAttached({ timeout: 5000 })
    })

    test('delete a project with todos - remove from project', async ({ authedPage }) => {
        const projName = unique()
        const todoName = `Todo-${projName}`
        await addProject(authedPage, projName)
        await addTodoToProject(authedPage, todoName, projName)

        // Delete project — custom dialog should appear
        await sidebarProject(authedPage, projName).locator('.project-delete').click()

        // Wait for the custom delete dialog
        const dialog = authedPage.locator('.delete-project-dialog-overlay')
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Click "Remove from project" (keep tasks)
        await dialog.locator('[data-action="keep"]').click()

        // Project should be gone
        await expect(sidebarProject(authedPage, projName)).not.toBeAttached({ timeout: 5000 })

        // Todo should still exist (now projectless)
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })

    test('delete a project with todos - delete tasks', async ({ authedPage }) => {
        const projName = unique()
        const todoName = `Todo-${projName}`
        await addProject(authedPage, projName)
        await addTodoToProject(authedPage, todoName, projName)

        // Select the project to see its todos
        await sidebarProject(authedPage, projName).click()
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Delete project — custom dialog should appear
        await sidebarProject(authedPage, projName).locator('.project-delete').click()
        const dialog = authedPage.locator('.delete-project-dialog-overlay')
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Click "Delete tasks"
        await dialog.locator('[data-action="delete"]').click()

        // Project and todo should both be gone
        await expect(sidebarProject(authedPage, projName)).not.toBeAttached({ timeout: 5000 })
        // Switch to All Projects to check todo is gone
        await authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: 'All Projects' }) }).click()
        await expect(todoItem(authedPage, todoName)).not.toBeAttached({ timeout: 5000 })
    })

    test('select a project to filter todos', async ({ authedPage }) => {
        const projName = unique()
        const todoName = `Todo-${projName}`
        const otherTodoName = `Other-${projName}`

        await addProject(authedPage, projName)
        await addTodoToProject(authedPage, todoName, projName)

        // Add a todo without project
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.fill('#modalTodoInput', otherTodoName)
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Select project to filter
        await sidebarProject(authedPage, projName).click()

        // Only the project's todo should be visible
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, otherTodoName)).not.toBeAttached({ timeout: 5000 })

        // Switch back to All Projects
        await authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: 'All Projects' }) }).click()

        // Both should be visible now
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, otherTodoName)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, todoName)
        await deleteTodo(authedPage, otherTodoName)
        await deleteProjectFromSidebar(authedPage, projName)
    })

    test('project todo count badge is accurate', async ({ authedPage }) => {
        const projName = unique()
        const todoName = `Todo-${projName}`
        await addProject(authedPage, projName)

        // Initially no badge (0 count shows empty)
        const countBadge = sidebarProject(authedPage, projName).locator('.project-count')
        await expect(countBadge).toHaveText('')

        // Add a todo to the project
        await addTodoToProject(authedPage, todoName, projName)

        // Count should update to 1
        await expect(countBadge).toHaveText('1', { timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, todoName)
        await deleteProjectFromSidebar(authedPage, projName)
    })

    test('add a subproject under a parent', async ({ authedPage }) => {
        const parentName = unique()
        const childName = `Sub-${parentName}`
        await addProject(authedPage, parentName)

        // Right-click parent to open context menu
        await sidebarProject(authedPage, parentName).click({ button: 'right' })
        const contextMenu = authedPage.locator('.project-context-menu')
        await expect(contextMenu).toBeVisible({ timeout: 3000 })

        // "Add subproject" triggers a prompt() dialog
        authedPage.once('dialog', async dialog => {
            await dialog.accept(childName)
        })
        await contextMenu.locator('.context-menu-item', { hasText: 'Add subproject' }).click()

        // Subproject should appear in sidebar
        await expect(sidebarProject(authedPage, childName)).toBeVisible({ timeout: 5000 })

        // Cleanup — delete parent (takes children with it)
        authedPage.once('dialog', dialog => dialog.accept())
        await sidebarProject(authedPage, parentName).locator('.project-delete').click()
        await expect(sidebarProject(authedPage, parentName)).not.toBeAttached({ timeout: 5000 })
    })

    test('undo project deletion', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        // Delete the project
        authedPage.once('dialog', dialog => dialog.accept())
        await sidebarProject(authedPage, name).locator('.project-delete').click()
        await expect(sidebarProject(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Undo via toast button
        const undoBtn = authedPage.locator('.toast-undo-btn')
        await expect(undoBtn).toBeVisible({ timeout: 5000 })
        await undoBtn.click()

        // Project should reappear
        await expect(sidebarProject(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteProjectFromSidebar(authedPage, name)
    })

    test('area dropdown is disabled for subprojects in manage modal', async ({ authedPage }) => {
        const parentName = unique()
        const childName = `Sub-${parentName}`

        // Create parent project
        await addProject(authedPage, parentName)

        // Add subproject via context menu
        await sidebarProject(authedPage, parentName).click({ button: 'right' })
        const contextMenu = authedPage.locator('.project-context-menu')
        await expect(contextMenu).toBeVisible({ timeout: 3000 })
        authedPage.once('dialog', async dialog => {
            await dialog.accept(childName)
        })
        await contextMenu.locator('.context-menu-item', { hasText: 'Add subproject' }).click()
        await expect(sidebarProject(authedPage, childName)).toBeVisible({ timeout: 5000 })

        // Open manage modal
        await openManageModal(authedPage)

        // Parent's area dropdown should be enabled
        const parentArea = manageProject(authedPage, parentName).locator('.manage-projects-area')
        await expect(parentArea).toBeEnabled()

        // Child's area dropdown should be disabled
        const childArea = manageProject(authedPage, childName).locator('.manage-projects-area')
        await expect(childArea).toBeDisabled()

        await closeManageModal(authedPage)

        // Cleanup
        authedPage.once('dialog', dialog => dialog.accept())
        await sidebarProject(authedPage, parentName).locator('.project-delete').click()
        await expect(sidebarProject(authedPage, parentName)).not.toBeAttached({ timeout: 5000 })
    })
})
