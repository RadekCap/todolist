import { test, expect } from './fixtures.js'

const unique = (prefix = 'CM') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: add a subproject via context menu on a parent project.
 */
async function addSubproject(page, parentName, subName) {
    const parentItem = page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: parentName }) })
    await parentItem.click({ button: 'right' })

    const contextMenu = page.locator('.project-context-menu')
    await expect(contextMenu).toBeVisible({ timeout: 3000 })

    page.once('dialog', dialog => dialog.accept(subName))
    await contextMenu.locator('.context-menu-item', { hasText: 'subproject' }).click()

    await expect(page.locator('#projectList .project-item .project-name', { hasText: subName })).toBeVisible({ timeout: 5000 })
}

test.describe('Context Menu Operations', () => {
    test('right-click project shows context menu', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        try {
            // Right-click on the project
            const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
            await projItem.click({ button: 'right' })

            // Context menu should appear with menu items
            const contextMenu = authedPage.locator('.project-context-menu')
            await expect(contextMenu).toBeVisible({ timeout: 3000 })
            await expect(contextMenu.locator('.context-menu-item').first()).toBeVisible()

            // Should have both "Add subproject" and "Delete project" options
            await expect(contextMenu.locator('.context-menu-item', { hasText: 'subproject' })).toBeVisible()
            await expect(contextMenu.locator('.context-menu-item-danger')).toBeVisible()

            // Close by clicking elsewhere
            await authedPage.locator('#todoList').click({ position: { x: 5, y: 5 } })
            await expect(contextMenu).not.toBeVisible({ timeout: 3000 })
        } finally {
            await deleteProject(authedPage, projName)
        }
    })

    test('context menu "Add subproject" creates subproject', async ({ authedPage }) => {
        const projName = unique()
        const subProjName = `Sub-${unique()}`
        await addProject(authedPage, projName)

        try {
            // Right-click on the project
            const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
            await projItem.click({ button: 'right' })

            const contextMenu = authedPage.locator('.project-context-menu')
            await expect(contextMenu).toBeVisible({ timeout: 3000 })

            // Handle the prompt dialog for subproject name
            authedPage.once('dialog', dialog => dialog.accept(subProjName))

            // Click "Add subproject"
            await contextMenu.locator('.context-menu-item', { hasText: 'subproject' }).click()

            // Subproject should appear in the sidebar
            await expect(authedPage.locator('#projectList .project-item .project-name', { hasText: subProjName })).toBeVisible({ timeout: 5000 })

            // Context menu should be closed after the action
            await expect(contextMenu).not.toBeVisible({ timeout: 3000 })
        } finally {
            // Cleanup: delete subproject first, then parent
            await deleteProject(authedPage, subProjName)
            await deleteProject(authedPage, projName)
        }
    })

    test('context menu closes when clicking outside', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        try {
            // Right-click to open context menu
            const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
            await projItem.click({ button: 'right' })

            const contextMenu = authedPage.locator('.project-context-menu')
            await expect(contextMenu).toBeVisible({ timeout: 3000 })

            // Click on a neutral area (the todo list) to dismiss
            await authedPage.locator('#todoList').click({ position: { x: 5, y: 5 } })

            // Context menu should disappear
            await expect(contextMenu).not.toBeVisible({ timeout: 3000 })
        } finally {
            await deleteProject(authedPage, projName)
        }
    })

    test('context menu "Add subproject" not available at max depth', async ({ authedPage }) => {
        const projName = unique()
        const subName = `Sub1-${unique()}`
        const subSubName = `Sub2-${unique()}`
        await addProject(authedPage, projName)

        try {
            // Create depth-1 subproject via context menu
            await addSubproject(authedPage, projName, subName)

            // Create depth-2 subproject via context menu
            await addSubproject(authedPage, subName, subSubName)

            // Right-click on the depth-2 project
            const depth2Item = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: subSubName }) })
            await depth2Item.click({ button: 'right' })

            const contextMenu = authedPage.locator('.project-context-menu')
            await expect(contextMenu).toBeVisible({ timeout: 3000 })

            // "Add subproject" should NOT be present (depth 2 is max)
            await expect(contextMenu.locator('.context-menu-item', { hasText: 'subproject' })).not.toBeVisible()

            // "Delete" option should still be present
            await expect(contextMenu.locator('.context-menu-item-danger')).toBeVisible()

            // Close menu
            await authedPage.locator('#todoList').click({ position: { x: 5, y: 5 } })
            await expect(contextMenu).not.toBeVisible({ timeout: 3000 })
        } finally {
            // Cleanup: delete from deepest to shallowest
            await deleteProject(authedPage, subSubName)
            await deleteProject(authedPage, subName)
            await deleteProject(authedPage, projName)
        }
    })
})
