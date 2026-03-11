import { test, expect } from './fixtures.js'

/**
 * Helper: open the settings modal.
 */
async function openSettings(page) {
    await page.click('#toolbarUserBtn')
    await page.click('#settingsBtn')
    await expect(page.locator('#settingsModal')).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: close the settings modal.
 */
async function closeSettings(page) {
    await page.click('#closeSettingsModal')
    await expect(page.locator('#settingsModal')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Helper: wait for app to be ready after reload.
 */
async function waitForApp(page) {
    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 30000 })
    await expect(page.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 10000 })
    await page.waitForTimeout(2000)
}

test.describe('Notification Settings', () => {
    test('enable notifications shows time and timezone fields', async ({ authedPage }) => {
        await openSettings(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')
        const detailsSection = authedPage.locator('#notificationSettingsDetails')

        // Ensure notifications are disabled first
        if (await checkbox.isChecked()) {
            await checkbox.uncheck()
            await authedPage.waitForTimeout(500)
        }

        // Details should be hidden
        await expect(detailsSection).not.toBeVisible()

        // Enable notifications
        await checkbox.check()
        await authedPage.waitForTimeout(500)

        // Time and timezone fields should appear
        await expect(detailsSection).toBeVisible({ timeout: 3000 })
        await expect(authedPage.locator('#notificationTime')).toBeVisible()
        await expect(authedPage.locator('#timezoneSelect')).toBeVisible()

        // Cleanup — disable notifications
        await checkbox.uncheck()
        await closeSettings(authedPage)
    })

    test('disable notifications hides time and timezone fields', async ({ authedPage }) => {
        await openSettings(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')

        // Enable first
        if (!await checkbox.isChecked()) {
            await checkbox.check()
            await authedPage.waitForTimeout(500)
        }

        // Verify details visible
        await expect(authedPage.locator('#notificationSettingsDetails')).toBeVisible()

        // Disable notifications
        await checkbox.uncheck()
        await authedPage.waitForTimeout(500)

        // Details should be hidden
        await expect(authedPage.locator('#notificationSettingsDetails')).not.toBeVisible()

        await closeSettings(authedPage)
    })

    test('notification time selection persists after reload', async ({ authedPage }) => {
        await openSettings(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')

        // Enable notifications
        if (!await checkbox.isChecked()) {
            await checkbox.check()
            await authedPage.waitForTimeout(500)
        }

        // Select a specific time
        const timeSelect = authedPage.locator('#notificationTime')
        await timeSelect.selectOption('09:00:00')
        const selectedTime = await timeSelect.inputValue()
        expect(selectedTime).toBe('09:00:00')

        await closeSettings(authedPage)

        // Reload
        await authedPage.reload()
        await waitForApp(authedPage)

        // Reopen settings and verify
        await openSettings(authedPage)
        const timeAfterReload = await authedPage.locator('#notificationTime').inputValue()
        expect(timeAfterReload).toBe('09:00:00')

        // Cleanup — disable notifications
        await authedPage.locator('#emailNotificationsEnabled').uncheck()
        await closeSettings(authedPage)
    })

    test('timezone selection persists after reload', async ({ authedPage }) => {
        await openSettings(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')

        // Enable notifications
        if (!await checkbox.isChecked()) {
            await checkbox.check()
            await authedPage.waitForTimeout(500)
        }

        // Select a timezone
        const tzSelect = authedPage.locator('#timezoneSelect')
        const options = tzSelect.locator('option')
        const optionCount = await options.count()

        // Pick a non-default timezone (use the 3rd option if available)
        let targetValue
        if (optionCount > 2) {
            targetValue = await options.nth(2).getAttribute('value')
            await tzSelect.selectOption(targetValue)
        } else {
            targetValue = await tzSelect.inputValue()
        }

        await closeSettings(authedPage)

        // Reload
        await authedPage.reload()
        await waitForApp(authedPage)

        // Reopen settings and verify
        await openSettings(authedPage)
        const tzAfterReload = await authedPage.locator('#timezoneSelect').inputValue()
        expect(tzAfterReload).toBe(targetValue)

        // Cleanup — disable notifications
        await authedPage.locator('#emailNotificationsEnabled').uncheck()
        await closeSettings(authedPage)
    })
})
