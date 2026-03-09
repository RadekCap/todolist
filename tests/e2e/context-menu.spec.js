import { test, expect } from './fixtures.js'

const unique = () => `CM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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

test.describe('Project Context Menu', () => {
    test('right-click on project shows context menu', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Right-click on the project
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.click({ button: 'right' })

        // Context menu should appear
        const contextMenu = authedPage.locator('.project-context-menu')
        await expect(contextMenu).toBeVisible({ timeout: 3000 })

        // Should have menu items
        await expect(contextMenu.locator('.context-menu-item').first()).toBeVisible()

        // Close by clicking elsewhere
        await authedPage.locator('body').click()
        await expect(contextMenu).not.toBeVisible({ timeout: 3000 })

        // Cleanup
        await deleteProject(authedPage, projName)
    })

    test('context menu has "Add subproject" option', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Right-click on the project
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.click({ button: 'right' })

        const contextMenu = authedPage.locator('.project-context-menu')
        await expect(contextMenu).toBeVisible({ timeout: 3000 })

        // Should have "Add subproject" option
        await expect(contextMenu.locator('.context-menu-item', { hasText: 'subproject' })).toBeVisible()

        // Close menu
        await authedPage.locator('body').click()

        // Cleanup
        await deleteProject(authedPage, projName)
    })

    test('context menu has "Delete" option', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Right-click
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.click({ button: 'right' })

        const contextMenu = authedPage.locator('.project-context-menu')
        await expect(contextMenu).toBeVisible({ timeout: 3000 })

        // Should have "Delete" option with danger styling
        await expect(contextMenu.locator('.context-menu-item-danger')).toBeVisible()

        // Close menu
        await authedPage.locator('body').click()

        // Cleanup
        await deleteProject(authedPage, projName)
    })

    test('add subproject via context menu', async ({ authedPage }) => {
        const projName = unique()
        const subProjName = `Sub-${unique()}`
        await addProject(authedPage, projName)

        // Right-click on the project
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.click({ button: 'right' })

        const contextMenu = authedPage.locator('.project-context-menu')
        await expect(contextMenu).toBeVisible({ timeout: 3000 })

        // Handle the prompt dialog for subproject name
        authedPage.once('dialog', dialog => dialog.accept(subProjName))

        // Click "Add subproject"
        await contextMenu.locator('.context-menu-item', { hasText: 'subproject' }).click()

        // Subproject should appear in the list
        await expect(authedPage.locator('#projectList .project-item .project-name', { hasText: subProjName })).toBeVisible({ timeout: 5000 })

        // Cleanup — delete parent (will delete subproject too)
        // Delete subproject first
        await deleteProject(authedPage, subProjName)
        await deleteProject(authedPage, projName)
    })
})
