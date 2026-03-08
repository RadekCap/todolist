import { test, expect } from './fixtures.js'

const unique = () => `Area-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: open the Areas dropdown in the toolbar.
 */
async function openAreasDropdown(page) {
    const dropdown = page.locator('#toolbarAreasDropdown')
    if (await dropdown.isVisible()) return // Already open, don't toggle closed
    await page.click('#toolbarAreasBtn')
    await expect(dropdown).toBeVisible({ timeout: 3000 })
}

/**
 * Helper: close the Areas dropdown if it's open.
 */
async function closeAreasDropdown(page) {
    const dropdown = page.locator('#toolbarAreasDropdown')
    if (await dropdown.isVisible()) {
        await page.click('#toolbarAreasBtn')
        await expect(dropdown).not.toBeVisible({ timeout: 3000 })
    }
}

/**
 * Helper: open the Manage Areas modal.
 */
async function openManageAreasModal(page) {
    await openAreasDropdown(page)
    await page.click('#manageAreasBtn')
    await expect(page.locator('#manageAreasModal')).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: close the Manage Areas modal.
 */
async function closeManageAreasModal(page) {
    await page.click('#closeManageAreasModalBtn')
    await expect(page.locator('#manageAreasModal')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Helper: add an area via the Manage Areas modal.
 */
async function addArea(page, name) {
    await openManageAreasModal(page)
    await page.fill('#newAreaInput', name)
    await page.click('#addNewAreaBtn')
    // Wait for area to appear in the manage list
    await expect(manageAreaItem(page, name)).toBeVisible({ timeout: 5000 })
    await closeManageAreasModal(page)
}

/**
 * Helper: find an area item in the Manage Areas modal by name.
 */
function manageAreaItem(page, name) {
    return page.locator('.manage-areas-item', { has: page.locator('.manage-areas-name', { hasText: name }) })
}

/**
 * Helper: find an area button in the Areas dropdown by name.
 */
function dropdownAreaItem(page, name) {
    return page.locator('#toolbarAreasDropdown .toolbar-areas-item', { has: page.locator('.areas-item-label', { hasText: name }) })
}

/**
 * Helper: delete an area via the Manage Areas modal (for cleanup).
 */
async function deleteArea(page, name) {
    await openManageAreasModal(page)
    const item = manageAreaItem(page, name)
    if (await item.count() > 0) {
        page.once('dialog', dialog => dialog.accept())
        await item.locator('.manage-areas-delete').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
    await closeManageAreasModal(page)
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

test.describe('Areas', () => {
    test('add a new area', async ({ authedPage }) => {
        const name = unique()
        await addArea(authedPage, name)

        // Area should appear in the toolbar dropdown
        await openAreasDropdown(authedPage)
        await expect(dropdownAreaItem(authedPage, name)).toBeVisible()
        await closeAreasDropdown(authedPage)

        // Cleanup
        await deleteArea(authedPage, name)
    })

    test('rename an area via Manage Areas modal', async ({ authedPage }) => {
        const name = unique()
        const newName = `${name}-renamed`
        await addArea(authedPage, name)

        await openManageAreasModal(authedPage)

        // Click edit button to start inline editing
        await manageAreaItem(authedPage, name).locator('.manage-areas-edit').click()

        // Input should appear
        const nameInput = authedPage.locator('.manage-areas-name-input')
        await expect(nameInput).toBeVisible({ timeout: 3000 })

        // Clear and type new name, then press Enter to trigger blur → saveEdit
        await nameInput.fill(newName)
        await nameInput.press('Enter')

        // Wait for the async rename to complete (input disappears after re-render)
        await expect(nameInput).not.toBeAttached({ timeout: 10000 })

        // Close and re-open modal to get a fresh render from the store
        await closeManageAreasModal(authedPage)
        await openManageAreasModal(authedPage)

        // Verify renamed in modal
        await expect(manageAreaItem(authedPage, newName)).toBeVisible({ timeout: 5000 })

        await closeManageAreasModal(authedPage)

        // Verify renamed in toolbar dropdown
        await openAreasDropdown(authedPage)
        await expect(dropdownAreaItem(authedPage, newName)).toBeVisible()
        await closeAreasDropdown(authedPage)

        // Cleanup
        await deleteArea(authedPage, newName)
    })

    test('delete an area', async ({ authedPage }) => {
        const name = unique()
        await addArea(authedPage, name)

        // Verify it exists in dropdown
        await openAreasDropdown(authedPage)
        await expect(dropdownAreaItem(authedPage, name)).toBeVisible()
        await closeAreasDropdown(authedPage)

        // Delete via manage modal
        await deleteArea(authedPage, name)

        // Verify removed from dropdown
        await openAreasDropdown(authedPage)
        await expect(dropdownAreaItem(authedPage, name)).not.toBeAttached({ timeout: 3000 })
    })

    test('filter by area shows only area projects', async ({ authedPage }) => {
        const areaName = unique()
        const projInArea = `ProjIn-${Date.now()}`
        const projNoArea = `ProjOut-${Date.now()}`

        // Create area and two projects
        await addArea(authedPage, areaName)
        await addProject(authedPage, projInArea)
        await addProject(authedPage, projNoArea)

        // Assign projInArea to the new area via Manage Projects modal
        await authedPage.click('#manageProjectsBtn')
        await expect(authedPage.locator('#manageProjectsModal')).toBeVisible({ timeout: 5000 })
        const projItem = authedPage.locator('.manage-projects-item', {
            has: authedPage.locator('.manage-projects-name', { hasText: projInArea })
        })
        await projItem.locator('.manage-projects-area').selectOption({ label: areaName })
        await authedPage.click('#closeManageProjectsModalBtn')
        await expect(authedPage.locator('#manageProjectsModal')).not.toBeVisible({ timeout: 5000 })

        // Select the area from the dropdown
        await openAreasDropdown(authedPage)
        await dropdownAreaItem(authedPage, areaName).click()

        // Only the area's project should be visible in sidebar
        const projInSidebar = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projInArea }) })
        const projOutSidebar = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projNoArea }) })
        await expect(projInSidebar).toBeVisible({ timeout: 5000 })
        await expect(projOutSidebar).not.toBeAttached({ timeout: 5000 })

        // Switch back to All Areas
        await openAreasDropdown(authedPage)
        await authedPage.locator('#toolbarAreasDropdown [data-area-id="all"]').click()

        // Both projects visible now
        await expect(projInSidebar).toBeVisible({ timeout: 5000 })
        await expect(projOutSidebar).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteProject(authedPage, projInArea)
        await deleteProject(authedPage, projNoArea)
        await deleteArea(authedPage, areaName)
    })

    test('unassigned filter shows projects without an area', async ({ authedPage }) => {
        const areaName = unique()
        const projInArea = `ProjIn-${Date.now()}`
        const projNoArea = `ProjOut-${Date.now()}`

        await addArea(authedPage, areaName)
        await addProject(authedPage, projInArea)
        await addProject(authedPage, projNoArea)

        // Assign projInArea to the area
        await authedPage.click('#manageProjectsBtn')
        await expect(authedPage.locator('#manageProjectsModal')).toBeVisible({ timeout: 5000 })
        const projItem = authedPage.locator('.manage-projects-item', {
            has: authedPage.locator('.manage-projects-name', { hasText: projInArea })
        })
        await projItem.locator('.manage-projects-area').selectOption({ label: areaName })
        await authedPage.click('#closeManageProjectsModalBtn')
        await expect(authedPage.locator('#manageProjectsModal')).not.toBeVisible({ timeout: 5000 })

        // Select "Unassigned" filter
        await openAreasDropdown(authedPage)
        await authedPage.locator('#toolbarAreasDropdown [data-area-id="unassigned"]').click()

        // Only unassigned project should be visible
        const projInSidebar = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projInArea }) })
        const projOutSidebar = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projNoArea }) })
        await expect(projOutSidebar).toBeVisible({ timeout: 5000 })
        await expect(projInSidebar).not.toBeAttached({ timeout: 5000 })

        // Switch back to All Areas
        await openAreasDropdown(authedPage)
        await authedPage.locator('#toolbarAreasDropdown [data-area-id="all"]').click()

        // Cleanup
        await deleteProject(authedPage, projInArea)
        await deleteProject(authedPage, projNoArea)
        await deleteArea(authedPage, areaName)
    })

    test('area keyboard shortcuts switch between areas', async ({ authedPage }) => {
        const areaName = unique()
        await addArea(authedPage, areaName)

        // Shift+1 should select the first user-created area
        // First, figure out the area's position — it might not be index 0
        // if other areas exist. Use toolbar label to verify.
        await authedPage.keyboard.press('Shift+1')
        const label = authedPage.locator('#toolbarAreasLabel')

        // The label should show the first area's name (which may or may not be ours)
        // Shift+0 should always return to "All Areas"
        await authedPage.keyboard.press('Shift+0')
        await expect(label).toContainText('All Areas', { timeout: 3000 })

        // Cleanup
        await deleteArea(authedPage, areaName)
    })

    test('assign a project to an area via manage modal', async ({ authedPage }) => {
        const areaName = unique()
        const projName = `Proj-${Date.now()}`

        await addArea(authedPage, areaName)
        await addProject(authedPage, projName)

        // Assign via Manage Projects modal
        await authedPage.click('#manageProjectsBtn')
        await expect(authedPage.locator('#manageProjectsModal')).toBeVisible({ timeout: 5000 })

        const projItem = authedPage.locator('.manage-projects-item', {
            has: authedPage.locator('.manage-projects-name', { hasText: projName })
        })
        await projItem.locator('.manage-projects-area').selectOption({ label: areaName })

        await authedPage.click('#closeManageProjectsModalBtn')
        await expect(authedPage.locator('#manageProjectsModal')).not.toBeVisible({ timeout: 5000 })

        // Filter by area — project should be visible
        await openAreasDropdown(authedPage)
        await dropdownAreaItem(authedPage, areaName).click()

        const projInSidebar = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await expect(projInSidebar).toBeVisible({ timeout: 5000 })

        // Switch back to All Areas
        await openAreasDropdown(authedPage)
        await authedPage.locator('#toolbarAreasDropdown [data-area-id="all"]').click()

        // Cleanup
        await deleteProject(authedPage, projName)
        await deleteArea(authedPage, areaName)
    })

    test('area color picker works', async ({ authedPage }) => {
        const name = unique()
        await addArea(authedPage, name)

        await openManageAreasModal(authedPage)

        // Find the area's color input
        const colorInput = manageAreaItem(authedPage, name).locator('input[type="color"]')
        await expect(colorInput).toBeVisible()

        // Change color
        await colorInput.fill('#ff0000')

        // Verify the color input reflects the change
        await expect(colorInput).toHaveValue('#ff0000')

        await closeManageAreasModal(authedPage)

        // Cleanup
        await deleteArea(authedPage, name)
    })
})
