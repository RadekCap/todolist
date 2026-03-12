import { expect } from '@playwright/test'

/**
 * Open the Areas dropdown in the toolbar.
 * No-op if already open.
 * @param {import('@playwright/test').Page} page
 */
export async function openAreasDropdown(page) {
    const dropdown = page.locator('#toolbarAreasDropdown')
    if (await dropdown.isVisible()) return
    await page.click('#toolbarAreasBtn')
    await expect(dropdown).toBeVisible({ timeout: 3000 })
}

/**
 * Open the Manage Areas modal (opens dropdown first if needed).
 * @param {import('@playwright/test').Page} page
 */
export async function openManageAreasModal(page) {
    await openAreasDropdown(page)
    await page.click('#manageAreasBtn')
    await expect(page.locator('#manageAreasModal')).toBeVisible({ timeout: 5000 })
}

/**
 * Close the Manage Areas modal.
 * @param {import('@playwright/test').Page} page
 */
export async function closeManageAreasModal(page) {
    await page.click('#closeManageAreasModalBtn')
    await expect(page.locator('#manageAreasModal')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Create an area via the Manage Areas modal.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function createArea(page, name) {
    await openManageAreasModal(page)
    await page.fill('#newAreaInput', name)
    await page.click('#addNewAreaBtn')
    await expect(page.locator('.manage-areas-item', {
        has: page.locator('.manage-areas-name', { hasText: name })
    })).toBeVisible({ timeout: 5000 })
    await closeManageAreasModal(page)
}

/**
 * Delete an area via the Manage Areas modal.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function deleteArea(page, name) {
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
 * Select an area from the toolbar dropdown and wait for label to update.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function selectArea(page, name) {
    await openAreasDropdown(page)
    await page.locator('#toolbarAreasDropdown .toolbar-areas-item', { hasText: name }).click()
    await expect(page.locator('#toolbarAreasLabel')).toContainText(name, { timeout: 3000 })
}

/**
 * Get the current area label text from the toolbar.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function getCurrentAreaLabel(page) {
    return (await page.locator('#toolbarAreasLabel').textContent()).trim()
}
