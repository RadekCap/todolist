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
 * Helper: find a project item in the sidebar.
 */
function sidebarProject(page, name) {
    return page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
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

test.describe('Project Header Display in Hierarchy', () => {
    test('clicking a project shows its name in the main view', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Click project to view it
        const projItem = sidebarProject(authedPage, projName)
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        // Project name should appear in the main content header area
        const mainContent = authedPage.locator('#todoListContainer, #mainContent, .main-content')
        await expect(mainContent).toContainText(projName, { timeout: 5000 })

        // Cleanup
        await authedPage.locator('.gtd-tab.inbox').click()
        await deleteProject(authedPage, projName)
    })

    test('subproject shows hierarchy via indentation in sidebar', async ({ authedPage }) => {
        const parentName = unique()
        const childName = unique()

        await addProject(authedPage, parentName)

        // Create child via context menu
        authedPage.once('dialog', async dialog => {
            await dialog.accept(childName)
        })
        await sidebarProject(authedPage, parentName).click({ button: 'right' })
        await authedPage.locator('.context-menu-item', { hasText: /add subproject/i }).click()
        await expect(sidebarProject(authedPage, childName)).toBeVisible({ timeout: 5000 })

        // Child should have deeper indentation
        const parentDepth = await sidebarProject(authedPage, parentName).getAttribute('data-depth')
        const childDepth = await sidebarProject(authedPage, childName).getAttribute('data-depth')
        expect(Number(childDepth)).toBeGreaterThan(Number(parentDepth))

        // Click child project — main view should show child project name
        await sidebarProject(authedPage, childName).locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        const mainContent = authedPage.locator('#todoListContainer, #mainContent, .main-content')
        await expect(mainContent).toContainText(childName, { timeout: 5000 })

        // Cleanup
        await authedPage.locator('.gtd-tab.inbox').click()
        await deleteProject(authedPage, parentName)
        const remainingChild = sidebarProject(authedPage, childName)
        if (await remainingChild.count() > 0) {
            await deleteProject(authedPage, childName)
        }
    })

    test('clicking All Projects after viewing subproject resets view', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Click project
        await sidebarProject(authedPage, projName).locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        // Click "All Projects" to reset
        const allProjectsItem = authedPage.locator('#projectList .project-item').first()
        await allProjectsItem.click()
        await authedPage.waitForTimeout(500)

        // Should show project cards view
        const projectCards = authedPage.locator('.project-card')
        await expect(projectCards.first()).toBeVisible({ timeout: 5000 })

        // Cleanup
        await authedPage.locator('.gtd-tab.inbox').click()
        await deleteProject(authedPage, projName)
    })
})
