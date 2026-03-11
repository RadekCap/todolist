import { test, expect } from './fixtures.js'

const unique = () => `PH-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: get project item locator.
 */
function sidebarProject(page, name) {
    return page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
}

/**
 * Helper: add a subproject via context menu.
 */
async function addSubproject(page, parentName, childName) {
    await sidebarProject(page, parentName).click({ button: 'right' })
    const contextMenu = page.locator('.project-context-menu')
    await expect(contextMenu).toBeVisible({ timeout: 3000 })

    page.once('dialog', dialog => dialog.accept(childName))
    await contextMenu.locator('.context-menu-item', { hasText: 'subproject' }).click()
    await expect(sidebarProject(page, childName)).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: delete a project from the sidebar.
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
 * Helper: click a GTD tab.
 */
async function switchGtdTab(page, status) {
    await page.click(`.gtd-tab.${status}`)
    await page.waitForTimeout(500)
}

/**
 * Helper: open the manage projects modal.
 */
async function openManageModal(page) {
    await page.click('#manageProjectsBtn')
    await expect(page.locator('#manageProjectsModal')).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: close the manage projects modal.
 */
async function closeManageModal(page) {
    await page.click('#closeManageProjectsModalBtn')
    await expect(page.locator('#manageProjectsModal')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Helper: get manage modal project item.
 */
function manageProject(page, name) {
    return page.locator('.manage-projects-item', {
        has: page.locator('.manage-projects-name', { hasText: name })
    })
}

test.describe('Project Hierarchy - Sidebar Indentation', () => {
    test('child project is indented deeper than parent', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        // Compare padding-left — child should have greater indentation
        const parentPadding = await sidebarProject(authedPage, parent).evaluate(el =>
            parseInt(getComputedStyle(el).paddingLeft, 10)
        )
        const childPadding = await sidebarProject(authedPage, child).evaluate(el =>
            parseInt(getComputedStyle(el).paddingLeft, 10)
        )
        expect(childPadding).toBeGreaterThan(parentPadding)

        // Cleanup
        await deleteProject(authedPage, child)
        await deleteProject(authedPage, parent)
    })

    test('grandchild project has three levels of indentation', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub1-${unique()}`
        const grandchild = `Sub2-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)
        await addSubproject(authedPage, child, grandchild)

        const parentPadding = await sidebarProject(authedPage, parent).evaluate(el =>
            parseInt(getComputedStyle(el).paddingLeft, 10)
        )
        const childPadding = await sidebarProject(authedPage, child).evaluate(el =>
            parseInt(getComputedStyle(el).paddingLeft, 10)
        )
        const grandchildPadding = await sidebarProject(authedPage, grandchild).evaluate(el =>
            parseInt(getComputedStyle(el).paddingLeft, 10)
        )

        expect(childPadding).toBeGreaterThan(parentPadding)
        expect(grandchildPadding).toBeGreaterThan(childPadding)

        // Cleanup
        await deleteProject(authedPage, grandchild)
        await deleteProject(authedPage, child)
        await deleteProject(authedPage, parent)
    })

    test('sidebar stores depth data attribute on project items', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        const parentDepth = await sidebarProject(authedPage, parent).getAttribute('data-depth')
        const childDepth = await sidebarProject(authedPage, child).getAttribute('data-depth')

        expect(parentDepth).toBe('0')
        expect(childDepth).toBe('1')

        // Cleanup
        await deleteProject(authedPage, child)
        await deleteProject(authedPage, parent)
    })
})

test.describe('Project Hierarchy - Collapse/Expand', () => {
    test('parent with children shows expand/collapse chevron', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        // Parent should have a chevron
        const chevron = sidebarProject(authedPage, parent).locator('.project-expand')
        await expect(chevron).toBeVisible()

        // Cleanup
        await deleteProject(authedPage, child)
        await deleteProject(authedPage, parent)
    })

    test('collapsing parent hides children', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        // Child should be visible initially
        await expect(sidebarProject(authedPage, child)).toBeVisible()

        // Click the chevron to collapse
        await sidebarProject(authedPage, parent).locator('.project-expand').click()
        await authedPage.waitForTimeout(300)

        // Child should be hidden
        await expect(sidebarProject(authedPage, child)).not.toBeAttached({ timeout: 3000 })

        // Click again to expand
        await sidebarProject(authedPage, parent).locator('.project-expand').click()
        await authedPage.waitForTimeout(300)

        // Child should reappear
        await expect(sidebarProject(authedPage, child)).toBeVisible({ timeout: 3000 })

        // Cleanup
        await deleteProject(authedPage, child)
        await deleteProject(authedPage, parent)
    })

    test('project without children has no chevron', async ({ authedPage }) => {
        const leaf = unique()
        await addProject(authedPage, leaf)

        // Should have spacer, not expand button
        const chevron = sidebarProject(authedPage, leaf).locator('.project-expand')
        await expect(chevron).not.toBeAttached()
        const spacer = sidebarProject(authedPage, leaf).locator('.project-expand-spacer')
        await expect(spacer).toBeVisible()

        // Cleanup
        await deleteProject(authedPage, leaf)
    })
})

test.describe('Project Hierarchy - Max Depth', () => {
    test('cannot add subproject beyond max depth (3 levels)', async ({ authedPage }) => {
        const p1 = unique()
        const p2 = `L2-${unique()}`
        const p3 = `L3-${unique()}`

        await addProject(authedPage, p1)
        await addSubproject(authedPage, p1, p2)
        await addSubproject(authedPage, p2, p3)

        // Right-click on the depth-2 project — "Add subproject" should not be available
        await sidebarProject(authedPage, p3).click({ button: 'right' })
        const contextMenu = authedPage.locator('.project-context-menu')
        await expect(contextMenu).toBeVisible({ timeout: 3000 })

        const addSubOption = contextMenu.locator('.context-menu-item', { hasText: 'subproject' })
        await expect(addSubOption).not.toBeAttached()

        // Close menu
        await authedPage.locator('#todoList').click({ position: { x: 5, y: 5 } })

        // Cleanup
        await deleteProject(authedPage, p3)
        await deleteProject(authedPage, p2)
        await deleteProject(authedPage, p1)
    })
})

test.describe('Project Hierarchy - Todo Counts', () => {
    test('parent project count includes child project todos', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub-${unique()}`
        const todoName = `Todo-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        // Add a todo to the child project
        await addTodo(authedPage, todoName, { project: child })

        // Parent project count should include child's todo
        const parentCount = sidebarProject(authedPage, parent).locator('.project-count')
        await expect(parentCount).toContainText('1', { timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todoName)
        await deleteProject(authedPage, child)
        await deleteProject(authedPage, parent)
    })
})

test.describe('Project Hierarchy - Manage Modal', () => {
    test('manage modal shows hierarchy with indentation', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        await openManageModal(authedPage)

        // Both should be visible in the modal
        await expect(manageProject(authedPage, parent)).toBeVisible()
        await expect(manageProject(authedPage, child)).toBeVisible()

        // Child should have greater padding (indentation)
        const parentPadding = await manageProject(authedPage, parent).evaluate(el =>
            parseInt(el.style.paddingLeft, 10)
        )
        const childPadding = await manageProject(authedPage, child).evaluate(el =>
            parseInt(el.style.paddingLeft, 10)
        )
        expect(childPadding).toBeGreaterThan(parentPadding)

        await closeManageModal(authedPage)

        // Cleanup
        await deleteProject(authedPage, child)
        await deleteProject(authedPage, parent)
    })

    test('deleting parent project also removes its children', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        // Both visible
        await expect(sidebarProject(authedPage, parent)).toBeVisible()
        await expect(sidebarProject(authedPage, child)).toBeVisible()

        // Delete parent — confirmation dialog mentions subprojects
        const dialogPromise = authedPage.waitForEvent('dialog')
        await sidebarProject(authedPage, parent).locator('.project-delete').click()
        const dialog = await dialogPromise
        expect(dialog.message()).toContain('subproject')
        await dialog.accept()

        // Both should be gone
        await expect(sidebarProject(authedPage, parent)).not.toBeAttached({ timeout: 5000 })
        await expect(sidebarProject(authedPage, child)).not.toBeAttached({ timeout: 5000 })
    })

    test('project select in todo modal shows hierarchical indentation', async ({ authedPage }) => {
        const parent = unique()
        const child = `Sub-${unique()}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        // Open add todo modal
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // The child option text should start with non-breaking spaces (indentation)
        const childOption = authedPage.locator('#modalProjectSelect option', { hasText: child })
        const optionText = await childOption.textContent()
        // Child should be indented with non-breaking spaces (\u00A0\u00A0)
        expect(optionText).toMatch(/^\u00A0/)

        // Parent option should NOT start with non-breaking spaces
        const parentOption = authedPage.locator('#modalProjectSelect option', { hasText: parent })
        const parentText = await parentOption.textContent()
        expect(parentText).not.toMatch(/^\u00A0/)

        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteProject(authedPage, child)
        await deleteProject(authedPage, parent)
    })
})
