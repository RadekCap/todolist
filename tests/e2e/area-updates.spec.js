import { test, expect } from './fixtures.js'
import { unique, addProject, deleteProject } from './helpers/todos.js'
import {
    createArea,
    deleteArea,
    selectArea,
    getCurrentAreaLabel,
    openAreasDropdown,
    openManageAreasModal,
    closeManageAreasModal
} from './helpers/areas.js'

test.describe('Area Updates & Keyboard Shortcuts', () => {
    test('rename area via manage modal', async ({ authedPage }) => {
        const name = unique('AU')
        const newName = unique('AU-Ren')
        await createArea(authedPage, name)

        // Open manage areas modal and find the area item
        await openManageAreasModal(authedPage)
        const item = authedPage.locator('.manage-areas-item', {
            has: authedPage.locator('.manage-areas-name', { hasText: name })
        })

        // Click edit button to start inline editing
        await item.locator('.manage-areas-edit').click()

        // Input should appear
        const nameInput = authedPage.locator('.manage-areas-name-input')
        await expect(nameInput).toBeVisible({ timeout: 3000 })

        // Set new name value directly to avoid fill() being interrupted by blur race
        await nameInput.evaluate((el, val) => {
            el.value = val
            el.dispatchEvent(new Event('input', { bubbles: true }))
        }, newName)

        // Trigger blur to invoke saveEdit
        await nameInput.evaluate(el => el.blur())

        // Wait for the async rename to complete (input disappears after re-render)
        await expect(nameInput).not.toBeAttached({ timeout: 10000 })

        // Close and re-open modal to get a fresh render from the store
        await closeManageAreasModal(authedPage)
        await openManageAreasModal(authedPage)

        // Verify renamed in manage modal
        const renamedItem = authedPage.locator('.manage-areas-item', {
            has: authedPage.locator('.manage-areas-name', { hasText: newName })
        })
        await expect(renamedItem).toBeVisible({ timeout: 5000 })

        await closeManageAreasModal(authedPage)

        // Verify renamed in toolbar dropdown
        await openAreasDropdown(authedPage)
        const dropdownItem = authedPage.locator('#toolbarAreasDropdown .toolbar-areas-item', {
            has: authedPage.locator('.areas-item-label', { hasText: newName })
        })
        await expect(dropdownItem).toBeVisible({ timeout: 3000 })

        // Cleanup
        await deleteArea(authedPage, newName)
    })

    test('Shift+1 selects first area', async ({ authedPage }) => {
        const name = unique('AU')
        await createArea(authedPage, name)

        // Press Shift+1 to select first area
        await authedPage.keyboard.press('Shift+1')

        // The toolbar label should update to show an area name (the first one by sort order)
        const label = authedPage.locator('#toolbarAreasLabel')
        // Wait for the label to no longer show "All Areas"
        await expect(label).not.toContainText('All Areas', { timeout: 3000 })

        // Reset to All Areas for cleanup
        await authedPage.keyboard.press('Shift+0')
        await expect(label).toContainText('All Areas', { timeout: 3000 })

        // Cleanup
        await deleteArea(authedPage, name)
    })

    test('Shift+0 resets to All Areas', async ({ authedPage }) => {
        const name = unique('AU')
        await createArea(authedPage, name)

        // Select the area via dropdown
        await selectArea(authedPage, name)

        // Verify it is selected
        const label = await getCurrentAreaLabel(authedPage)
        expect(label).toContain(name)

        // Press Shift+0 to reset
        await authedPage.keyboard.press('Shift+0')

        // Should show All Areas
        await expect(authedPage.locator('#toolbarAreasLabel')).toContainText('All Areas', { timeout: 3000 })

        // Cleanup
        await deleteArea(authedPage, name)
    })

    test('area filtering shows only assigned projects', async ({ authedPage }) => {
        const areaName = unique('AU')
        const projInArea = unique('AU-PIn')
        const projNoArea = unique('AU-POut')

        // Create area and two projects
        await createArea(authedPage, areaName)
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
        await selectArea(authedPage, areaName)

        // Only the area's project should be visible in sidebar
        const projInSidebar = authedPage.locator('#projectList .project-item', {
            has: authedPage.locator('.project-name', { hasText: projInArea })
        })
        const projOutSidebar = authedPage.locator('#projectList .project-item', {
            has: authedPage.locator('.project-name', { hasText: projNoArea })
        })
        await expect(projInSidebar).toBeVisible({ timeout: 5000 })
        await expect(projOutSidebar).not.toBeAttached({ timeout: 5000 })

        // Switch back to All Areas
        await openAreasDropdown(authedPage)
        await authedPage.locator('#toolbarAreasDropdown [data-area-id="all"]').click()

        // Cleanup
        await deleteProject(authedPage, projInArea)
        await deleteProject(authedPage, projNoArea)
        await deleteArea(authedPage, areaName)
    })
})
