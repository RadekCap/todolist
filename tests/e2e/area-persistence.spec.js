import { test, expect } from './fixtures.js'

const unique = () => `AP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: open the Areas dropdown in the toolbar.
 */
async function openAreasDropdown(page) {
    const dropdown = page.locator('#toolbarAreasDropdown')
    if (await dropdown.isVisible()) return
    await page.click('#toolbarAreasBtn')
    await expect(dropdown).toBeVisible({ timeout: 3000 })
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
 * Helper: create an area via the manage areas modal.
 */
async function createArea(page, name) {
    await openManageAreasModal(page)
    await page.fill('#newAreaInput', name)
    await page.click('#addNewAreaBtn')
    await expect(page.locator('.manage-areas-item', {
        has: page.locator('.manage-areas-name', { hasText: name })
    })).toBeVisible({ timeout: 5000 })
    await closeManageAreasModal(page)
}

/**
 * Helper: delete an area via the manage areas modal.
 */
async function deleteArea(page, name) {
    await openManageAreasModal(page)
    const item = page.locator('.manage-areas-item', {
        has: page.locator('.manage-areas-name', { hasText: name })
    })
    if (await item.count() > 0) {
        page.once('dialog', d => d.accept())
        await item.locator('.manage-areas-delete').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
    await closeManageAreasModal(page)
}

/**
 * Helper: select an area from the toolbar dropdown.
 */
async function selectArea(page, name) {
    await openAreasDropdown(page)
    const dropdown = page.locator('#toolbarAreasDropdown')
    await dropdown.locator('.toolbar-areas-item', { hasText: name }).click()
    await page.waitForTimeout(500)
}

/**
 * Helper: get the current area label text.
 */
async function getCurrentAreaLabel(page) {
    return (await page.locator('#toolbarAreasLabel').textContent()).trim()
}

/**
 * Helper: wait for app to be fully ready after reload.
 */
async function waitForApp(page) {
    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 30000 })
    await expect(page.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 10000 })
    await page.waitForTimeout(2000)
}

test.describe('Area Selection Persistence', () => {
    test('area selection persists after page reload', async ({ authedPage }) => {
        const areaName = unique()
        await createArea(authedPage, areaName)

        // Select the area
        await selectArea(authedPage, areaName)

        // Verify it's selected
        const label = await getCurrentAreaLabel(authedPage)
        expect(label).toContain(areaName)

        // Reload page
        await authedPage.reload()
        await waitForApp(authedPage)

        // Area should still be selected
        const labelAfterReload = await getCurrentAreaLabel(authedPage)
        expect(labelAfterReload).toContain(areaName)

        // Reset to All Areas and cleanup
        await openAreasDropdown(authedPage)
        await authedPage.locator('#toolbarAreasDropdown [data-area-id="all"]').click()
        await deleteArea(authedPage, areaName)
    })

    test('deleting selected area resets to All Areas', async ({ authedPage }) => {
        const areaName = unique()
        await createArea(authedPage, areaName)

        // Select the area
        await selectArea(authedPage, areaName)
        const label = await getCurrentAreaLabel(authedPage)
        expect(label).toContain(areaName)

        // Delete the area
        await deleteArea(authedPage, areaName)
        await authedPage.waitForTimeout(500)

        // Should reset to All Areas
        const labelAfter = await getCurrentAreaLabel(authedPage)
        expect(labelAfter.toLowerCase()).toContain('all')
    })

    test('Shift+0 resets to All Areas', async ({ authedPage }) => {
        const areaName = unique()
        await createArea(authedPage, areaName)

        // Select the area
        await selectArea(authedPage, areaName)
        const label = await getCurrentAreaLabel(authedPage)
        expect(label).toContain(areaName)

        // Press Shift+0 to reset
        await authedPage.keyboard.press('Shift+0')
        await authedPage.waitForTimeout(500)

        // Should show All Areas
        const labelAfter = await getCurrentAreaLabel(authedPage)
        expect(labelAfter.toLowerCase()).toContain('all')

        // Cleanup
        await deleteArea(authedPage, areaName)
    })
})
