import { test, expect } from './fixtures.js'

const unique = () => `PD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: find a project in the sidebar.
 */
function sidebarProject(page, name) {
    return page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
}

/**
 * Helper: delete a project.
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
 * Helper: find a project in the Manage Projects modal.
 */
function manageProject(page, name) {
    return page.locator('.manage-projects-item', { has: page.locator('.manage-projects-name', { hasText: name }) })
}

test.describe('Project Color', () => {
    test('project has a color picker in manage modal', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        await openManageModal(authedPage)

        const colorInput = manageProject(authedPage, name).locator('.manage-projects-color')
        await expect(colorInput).toBeVisible()
        await expect(colorInput).toHaveAttribute('type', 'color')

        await closeManageModal(authedPage)
        await deleteProject(authedPage, name)
    })

    test('changing project color updates the color picker value', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        await openManageModal(authedPage)

        const colorInput = manageProject(authedPage, name).locator('.manage-projects-color')
        await colorInput.fill('#ff0000')
        await expect(colorInput).toHaveValue('#ff0000')

        await closeManageModal(authedPage)
        await deleteProject(authedPage, name)
    })

    test('project color shows in sidebar', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        // Change color to red in manage modal
        await openManageModal(authedPage)
        const colorInput = manageProject(authedPage, name).locator('.manage-projects-color')
        await colorInput.fill('#ff0000')

        // Trigger change event (fill alone may not fire it)
        await colorInput.dispatchEvent('change')
        await authedPage.waitForTimeout(1000)

        await closeManageModal(authedPage)

        // Sidebar project should have a color dot with the correct color
        const colorDot = sidebarProject(authedPage, name).locator('.project-color')
        await expect(colorDot).toBeAttached({ timeout: 5000 })

        // Verify it has the red background color set
        const bgColor = await colorDot.evaluate(el => getComputedStyle(el).backgroundColor)
        // rgb(255, 0, 0) = #ff0000
        expect(bgColor).toBe('rgb(255, 0, 0)')

        await deleteProject(authedPage, name)
    })

    test('project color persists after closing and reopening manage modal', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        // Set color
        await openManageModal(authedPage)
        const colorInput = manageProject(authedPage, name).locator('.manage-projects-color')
        await colorInput.fill('#00ff00')
        await colorInput.dispatchEvent('change')
        await authedPage.waitForTimeout(500)
        await closeManageModal(authedPage)

        // Reopen and verify color
        await openManageModal(authedPage)
        const colorInput2 = manageProject(authedPage, name).locator('.manage-projects-color')
        await expect(colorInput2).toHaveValue('#00ff00')

        await closeManageModal(authedPage)
        await deleteProject(authedPage, name)
    })
})

test.describe('Project Description', () => {
    test('project shows "No description" placeholder in manage modal', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        await openManageModal(authedPage)

        const desc = manageProject(authedPage, name).locator('.manage-projects-description')
        await expect(desc).toBeVisible()
        await expect(desc).toContainText('No description')

        await closeManageModal(authedPage)
        await deleteProject(authedPage, name)
    })

    test('edit project to add a description', async ({ authedPage }) => {
        const name = unique()
        const description = `Desc-${Date.now()}`
        await addProject(authedPage, name)

        await openManageModal(authedPage)

        // Click edit
        await manageProject(authedPage, name).locator('.manage-projects-edit').click()

        // Description input should appear
        const descInput = authedPage.locator('.manage-projects-description-input')
        await expect(descInput).toBeVisible({ timeout: 3000 })

        // Fill in description
        await descInput.fill(description)

        // Save by pressing Enter on the name input
        const nameInput = authedPage.locator('.manage-projects-name-input')
        await nameInput.press('Enter')
        await authedPage.waitForTimeout(500)

        await closeManageModal(authedPage)

        // Reopen to verify description was saved
        await openManageModal(authedPage)
        const desc = manageProject(authedPage, name).locator('.manage-projects-description')
        await expect(desc).toContainText(description)

        await closeManageModal(authedPage)
        await deleteProject(authedPage, name)
    })

    test('project description persists after page reload', async ({ authedPage }) => {
        const name = unique()
        const description = `Persist-${Date.now()}`
        await addProject(authedPage, name)

        await openManageModal(authedPage)
        await manageProject(authedPage, name).locator('.manage-projects-edit').click()

        const descInput = authedPage.locator('.manage-projects-description-input')
        await expect(descInput).toBeVisible({ timeout: 3000 })
        await descInput.fill(description)

        const nameInput = authedPage.locator('.manage-projects-name-input')
        await nameInput.press('Enter')
        await authedPage.waitForTimeout(500)
        await closeManageModal(authedPage)

        // Reload
        await authedPage.reload()
        await authedPage.waitForLoadState('networkidle')
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })

        // Verify description survived reload
        await openManageModal(authedPage)
        const desc = manageProject(authedPage, name).locator('.manage-projects-description')
        await expect(desc).toContainText(description)

        await closeManageModal(authedPage)
        await deleteProject(authedPage, name)
    })

    test('project description shows in project filtered view', async ({ authedPage }) => {
        const name = unique()
        const description = `ViewDesc-${Date.now()}`
        await addProject(authedPage, name)

        // Set description
        await openManageModal(authedPage)
        await manageProject(authedPage, name).locator('.manage-projects-edit').click()

        const descInput = authedPage.locator('.manage-projects-description-input')
        await expect(descInput).toBeVisible({ timeout: 3000 })
        await descInput.fill(description)

        const nameInput = authedPage.locator('.manage-projects-name-input')
        await nameInput.press('Enter')
        await authedPage.waitForTimeout(500)
        await closeManageModal(authedPage)

        // Click on the project to see its filtered view with title header
        await sidebarProject(authedPage, name).click()
        await authedPage.waitForTimeout(500)

        // The project title header should show the project name
        await expect(authedPage.locator('.project-title-header')).toBeVisible({ timeout: 5000 })

        // The description should appear in the title header
        await expect(authedPage.locator('.project-title-description')).toContainText(description)

        // Go back to inbox
        await authedPage.click('.gtd-tab.inbox')

        await deleteProject(authedPage, name)
    })
})

test.describe('Project Drag and Drop Reorder', () => {
    test('projects have drag handles in the sidebar', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        const dragHandle = sidebarProject(authedPage, name).locator('.project-drag-handle')
        await expect(dragHandle).toBeVisible()

        await deleteProject(authedPage, name)
    })

    test('projects have drag handles in manage modal', async ({ authedPage }) => {
        const name = unique()
        await addProject(authedPage, name)

        await openManageModal(authedPage)

        const dragHandle = manageProject(authedPage, name).locator('.manage-projects-drag-handle')
        await expect(dragHandle).toBeVisible()

        await closeManageModal(authedPage)
        await deleteProject(authedPage, name)
    })

    test('project order is maintained after page reload', async ({ authedPage }) => {
        const name1 = `${unique()}-A`
        const name2 = `${unique()}-B`

        await addProject(authedPage, name1)
        await addProject(authedPage, name2)

        // Get initial order of project names in the sidebar
        const projectNames = authedPage.locator('#projectList .project-item .project-name')
        const allNames = await projectNames.allTextContents()

        // Find positions of our test projects
        const idx1 = allNames.findIndex(n => n.includes(name1.split('-').pop()))
        const idx2 = allNames.findIndex(n => n.includes(name2.split('-').pop()))
        expect(idx1).toBeGreaterThanOrEqual(0)
        expect(idx2).toBeGreaterThanOrEqual(0)

        // Reload and verify order is preserved
        await authedPage.reload()
        await authedPage.waitForLoadState('networkidle')
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })

        const projectNamesAfter = authedPage.locator('#projectList .project-item .project-name')
        const allNamesAfter = await projectNamesAfter.allTextContents()

        const idx1After = allNamesAfter.findIndex(n => n.includes(name1.split('-').pop()))
        const idx2After = allNamesAfter.findIndex(n => n.includes(name2.split('-').pop()))

        // Order should be the same
        expect(idx1After < idx2After).toBe(idx1 < idx2)

        // Cleanup
        await deleteProject(authedPage, name1)
        await deleteProject(authedPage, name2)
    })
})
