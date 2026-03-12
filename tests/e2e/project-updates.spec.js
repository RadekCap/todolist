import { test, expect } from './fixtures.js'
import { unique } from './helpers/todos.js'

/**
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: get project item locator in the sidebar.
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
    if (await item.count() === 0) return

    page.once('dialog', dialog => dialog.accept())
    await item.locator('.project-delete').click()
    await expect(item).not.toBeAttached({ timeout: 5000 })
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
 * Helper: get manage modal project item by name.
 */
function manageProject(page, name) {
    return page.locator('.manage-projects-item', {
        has: page.locator('.manage-projects-name', { hasText: name })
    })
}

test.describe('Project Updates & Hierarchy Edge Cases', () => {
    test('rename project via manage modal', async ({ authedPage }) => {
        const name = unique('PU')
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
        await deleteProject(authedPage, newName)
    })

    test('update project color', async ({ authedPage }) => {
        const name = unique('PU')
        await addProject(authedPage, name)

        await openManageModal(authedPage)

        const projectItem = manageProject(authedPage, name)
        const colorInput = projectItem.locator('.manage-projects-color')

        // Get the initial color value
        const initialColor = await colorInput.inputValue()

        // Change color to a distinct value
        const newColor = '#ff0000'
        await colorInput.evaluate((el, color) => {
            // Programmatically set value and dispatch change event
            el.value = color
            el.dispatchEvent(new Event('change', { bubbles: true }))
        }, newColor)

        // Verify the color input value has changed
        await expect(colorInput).toHaveValue(newColor, { timeout: 5000 })

        await closeManageModal(authedPage)

        // Reopen modal to verify persistence
        await openManageModal(authedPage)

        const updatedColorInput = manageProject(authedPage, name).locator('.manage-projects-color')
        await expect(updatedColorInput).toHaveValue(newColor, { timeout: 5000 })

        await closeManageModal(authedPage)

        // Cleanup
        await deleteProject(authedPage, name)
    })

    test('update project description', async ({ authedPage }) => {
        const name = unique('PU')
        const description = `Description for ${name}`
        await addProject(authedPage, name)

        await openManageModal(authedPage)

        // Click edit button on the project
        await manageProject(authedPage, name).locator('.manage-projects-edit').click()

        // Both name and description inputs should appear
        const nameInput = authedPage.locator('.manage-projects-name-input')
        const descInput = authedPage.locator('.manage-projects-description-input')
        await expect(nameInput).toBeVisible({ timeout: 3000 })
        await expect(descInput).toBeVisible({ timeout: 3000 })

        // Add description
        await descInput.fill(description)
        await descInput.press('Enter')

        // Verify description is shown in the modal
        const descriptionSpan = manageProject(authedPage, name).locator('.manage-projects-description')
        await expect(descriptionSpan).toContainText(description, { timeout: 5000 })

        await closeManageModal(authedPage)

        // Reopen modal to verify persistence
        await openManageModal(authedPage)

        const persistedDescription = manageProject(authedPage, name).locator('.manage-projects-description')
        await expect(persistedDescription).toContainText(description, { timeout: 5000 })

        await closeManageModal(authedPage)

        // Cleanup
        await deleteProject(authedPage, name)
    })

    test('max depth enforcement - cannot add subproject beyond 3 levels', async ({ authedPage }) => {
        const p1 = unique('PU')
        const p2 = `L2-${unique('PU')}`
        const p3 = `L3-${unique('PU')}`

        await addProject(authedPage, p1)
        await addSubproject(authedPage, p1, p2)
        await addSubproject(authedPage, p2, p3)

        // Right-click on the depth-2 project (p3) - "Add subproject" should not be available
        await sidebarProject(authedPage, p3).click({ button: 'right' })
        const contextMenu = authedPage.locator('.project-context-menu')
        await expect(contextMenu).toBeVisible({ timeout: 3000 })

        const addSubOption = contextMenu.locator('.context-menu-item', { hasText: 'subproject' })
        await expect(addSubOption).not.toBeAttached()

        // Close context menu by clicking elsewhere
        await authedPage.locator('#todoList').click({ position: { x: 5, y: 5 } })

        // Cleanup - delete from deepest to shallowest
        await deleteProject(authedPage, p3)
        await deleteProject(authedPage, p2)
        await deleteProject(authedPage, p1)
    })

    test('deleting parent project cascades to children', async ({ authedPage }) => {
        const parent = unique('PU')
        const child = `Sub-${unique('PU')}`

        await addProject(authedPage, parent)
        await addSubproject(authedPage, parent, child)

        // Both should be visible
        await expect(sidebarProject(authedPage, parent)).toBeVisible()
        await expect(sidebarProject(authedPage, child)).toBeVisible()

        // Delete parent - confirmation dialog mentions subprojects
        authedPage.once('dialog', async dialog => {
            await dialog.accept()
        })
        await sidebarProject(authedPage, parent).locator('.project-delete').click()

        // Both parent and child should be gone
        await expect(sidebarProject(authedPage, parent)).not.toBeAttached({ timeout: 5000 })
        await expect(sidebarProject(authedPage, child)).not.toBeAttached({ timeout: 5000 })
    })
})
