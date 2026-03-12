import { expect } from '@playwright/test'

/**
 * Open the settings modal and wait for settings data to load from Supabase.
 * @param {import('@playwright/test').Page} page
 */
export async function openSettingsModal(page) {
    const settingsLoaded = page.waitForResponse(
        resp => resp.url().includes('user_settings') && resp.request().method() === 'GET',
        { timeout: 10000 }
    )
    await page.click('#toolbarUserBtn')
    await expect(page.locator('#toolbarDropdown')).toBeVisible({ timeout: 3000 })
    await page.click('#settingsBtn')
    await expect(page.locator('#settingsModal')).toHaveClass(/active/, { timeout: 5000 })
    await settingsLoaded
    await page.waitForTimeout(300)
}

/**
 * Save and close the settings modal, waiting for the Supabase write to complete.
 * @param {import('@playwright/test').Page} page
 */
export async function saveSettings(page) {
    const saved = page.waitForResponse(
        resp => resp.url().includes('user_settings') && resp.request().method() !== 'GET'
    )
    await page.click('#saveSettingsBtn')
    await saved
    await expect(page.locator('#settingsModal')).not.toHaveClass(/active/, { timeout: 5000 })
}

/**
 * Close the settings modal without saving.
 * @param {import('@playwright/test').Page} page
 */
export async function cancelSettings(page) {
    await page.click('#cancelSettingsModal')
    await expect(page.locator('#settingsModal')).not.toHaveClass(/active/, { timeout: 5000 })
}
