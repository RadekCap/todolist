import { test, expect } from './fixtures.js'
import { unique, waitForApp } from './helpers/todos.js'
import { createArea, deleteArea, selectArea, getCurrentAreaLabel, openAreasDropdown } from './helpers/areas.js'

test.describe('Area Selection Persistence', () => {
    test('area selection persists after page reload', async ({ authedPage }) => {
        const areaName = unique('AP')
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
        const areaName = unique('AP')
        await createArea(authedPage, areaName)

        // Select the area
        await selectArea(authedPage, areaName)
        const label = await getCurrentAreaLabel(authedPage)
        expect(label).toContain(areaName)

        // Delete the area
        await deleteArea(authedPage, areaName)

        // Should reset to All Areas
        await expect(authedPage.locator('#toolbarAreasLabel')).toContainText(/all/i, { timeout: 3000 })
    })

    test('Shift+0 resets to All Areas', async ({ authedPage }) => {
        const areaName = unique('AP')
        await createArea(authedPage, areaName)

        // Select the area
        await selectArea(authedPage, areaName)
        const label = await getCurrentAreaLabel(authedPage)
        expect(label).toContain(areaName)

        // Press Shift+0 to reset
        await authedPage.keyboard.press('Shift+0')

        // Should show All Areas
        await expect(authedPage.locator('#toolbarAreasLabel')).toContainText(/all/i, { timeout: 3000 })

        // Cleanup
        await deleteArea(authedPage, areaName)
    })
})
