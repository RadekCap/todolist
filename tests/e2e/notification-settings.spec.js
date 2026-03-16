import { test, expect } from './fixtures.js'
import { waitForApp } from './helpers/todos.js'
import { openSettingsModal, saveSettings, cancelSettings } from './helpers/settings.js'

test.describe('Notification Settings Persistence', () => {
    test('notification time selection persists after reload', async ({ authedPage }) => {
        test.slow() // Settings save + reload + settings re-open can exceed default timeout
        await openSettingsModal(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')

        // Enable notifications if not already enabled
        if (!await checkbox.isChecked()) {
            await checkbox.click()
            await expect(authedPage.locator('#notificationSettingsDetails')).toBeVisible({ timeout: 3000 })
        }

        // Select a specific time
        const timeSelect = authedPage.locator('#notificationTime')
        await timeSelect.selectOption('09:00:00')
        expect(await timeSelect.inputValue()).toBe('09:00:00')

        // Save settings
        await saveSettings(authedPage)

        // Reload
        await authedPage.reload()
        await waitForApp(authedPage)

        // Reopen settings and verify time persisted
        await openSettingsModal(authedPage)
        expect(await authedPage.locator('#notificationTime').inputValue()).toBe('09:00:00')

        // Cleanup — disable notifications and save
        await authedPage.locator('#emailNotificationsEnabled').click()
        await expect(authedPage.locator('#notificationSettingsDetails')).not.toBeVisible({ timeout: 3000 })
        await saveSettings(authedPage)
    })

    test('timezone selection persists after reload', async ({ authedPage }) => {
        test.slow() // Settings save + reload + settings re-open can exceed default timeout
        await openSettingsModal(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')

        // Enable notifications if not already enabled
        if (!await checkbox.isChecked()) {
            await checkbox.click()
            await expect(authedPage.locator('#notificationSettingsDetails')).toBeVisible({ timeout: 3000 })
        }

        // Pick a non-default timezone (use the 3rd option if available)
        const tzSelect = authedPage.locator('#timezoneSelect')
        const options = tzSelect.locator('option')
        const optionCount = await options.count()

        let targetValue
        if (optionCount > 2) {
            targetValue = await options.nth(2).getAttribute('value')
            await tzSelect.selectOption(targetValue)
        } else {
            targetValue = await tzSelect.inputValue()
        }

        // Save settings
        await saveSettings(authedPage)

        // Reload
        await authedPage.reload()
        await waitForApp(authedPage)

        // Reopen settings and verify timezone persisted
        await openSettingsModal(authedPage)
        expect(await authedPage.locator('#timezoneSelect').inputValue()).toBe(targetValue)

        // Cleanup — disable notifications and save
        await authedPage.locator('#emailNotificationsEnabled').click()
        await expect(authedPage.locator('#notificationSettingsDetails')).not.toBeVisible({ timeout: 3000 })
        await saveSettings(authedPage)
    })
})
