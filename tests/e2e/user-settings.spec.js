import { test, expect } from './fixtures.js'

/**
 * Helper: open the user menu and click Settings.
 */
async function openSettingsModal(page) {
    await page.click('#toolbarUserBtn')
    await expect(page.locator('#toolbarDropdown')).toBeVisible({ timeout: 3000 })
    await page.click('#settingsBtn')
    await expect(page.locator('#settingsModal')).toHaveClass(/active/, { timeout: 5000 })
}

/**
 * Helper: save and close the settings modal.
 */
async function saveSettings(page) {
    const saved = page.waitForResponse(
        resp => resp.url().includes('user_settings') && resp.request().method() !== 'GET'
    )
    await page.click('#saveSettingsBtn')
    await saved
    await expect(page.locator('#settingsModal')).not.toHaveClass(/active/, { timeout: 5000 })
}

/**
 * Helper: close settings modal without saving.
 */
async function cancelSettings(page) {
    await page.click('#cancelSettingsModal')
    await expect(page.locator('#settingsModal')).not.toHaveClass(/active/, { timeout: 5000 })
}

test.describe('User Settings - Display Name', () => {
    test('settings modal opens from user menu', async ({ authedPage }) => {
        await openSettingsModal(authedPage)

        // Modal should have correct title
        await expect(authedPage.locator('#settingsModalTitle')).toContainText('User Settings')

        // Username input should be visible
        await expect(authedPage.locator('#usernameInput')).toBeVisible()

        // Close modal
        await cancelSettings(authedPage)
    })

    test('set display name and verify it shows in toolbar', async ({ authedPage }) => {
        const displayName = `TestUser-${Date.now()}`

        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', displayName)
        await saveSettings(authedPage)

        // Toolbar should show the display name
        await expect(authedPage.locator('#toolbarUsername')).toContainText(displayName, { timeout: 5000 })

        // Restore: clear display name so email shows again
        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', '')
        await saveSettings(authedPage)
    })

    test('display name persists after page reload', async ({ authedPage }) => {
        const displayName = `Persist-${Date.now()}`

        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', displayName)
        await saveSettings(authedPage)

        await expect(authedPage.locator('#toolbarUsername')).toContainText(displayName, { timeout: 5000 })

        // Reload
        await authedPage.reload()
        await authedPage.waitForLoadState('networkidle')
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })

        // Display name should still show
        await expect(authedPage.locator('#toolbarUsername')).toContainText(displayName, { timeout: 10000 })

        // Restore
        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', '')
        await saveSettings(authedPage)
    })

    test('clearing display name shows email in toolbar', async ({ authedPage }) => {
        const email = process.env.TEST_USER_EMAIL
        const displayName = `Temp-${Date.now()}`

        // Set a display name
        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', displayName)
        await saveSettings(authedPage)
        await expect(authedPage.locator('#toolbarUsername')).toContainText(displayName, { timeout: 5000 })

        // Clear the display name
        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', '')
        await saveSettings(authedPage)

        // Toolbar should show email
        await expect(authedPage.locator('#toolbarUsername')).toContainText(email, { timeout: 5000 })
    })

    test('cancel does not save changes', async ({ authedPage }) => {
        const email = process.env.TEST_USER_EMAIL

        // Ensure no display name is set
        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', '')
        await saveSettings(authedPage)

        // Open settings, type a name, then cancel
        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', 'ShouldNotSave')
        await cancelSettings(authedPage)

        // Toolbar should still show email (not the cancelled name)
        await expect(authedPage.locator('#toolbarUsername')).toContainText(email, { timeout: 5000 })
    })

    test('settings modal pre-fills current display name on open', async ({ authedPage }) => {
        const displayName = `Prefill-${Date.now()}`

        // Set a display name first
        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', displayName)
        await saveSettings(authedPage)

        // Re-open modal — should pre-fill the current name
        await openSettingsModal(authedPage)
        await expect(authedPage.locator('#usernameInput')).toHaveValue(displayName)
        await cancelSettings(authedPage)

        // Restore
        await openSettingsModal(authedPage)
        await authedPage.fill('#usernameInput', '')
        await saveSettings(authedPage)
    })
})

test.describe('User Settings - Notifications', () => {
    test('notification checkbox toggles details section', async ({ authedPage }) => {
        await openSettingsModal(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')
        const details = authedPage.locator('#notificationSettingsDetails')

        // Initially details should be hidden (unless previously enabled)
        const initiallyChecked = await checkbox.isChecked()

        if (!initiallyChecked) {
            // Details should be hidden
            await expect(details).not.toBeVisible()

            // Enable notifications — details should appear
            await checkbox.check()
            await expect(details).toBeVisible()

            // Disable — details should hide
            await checkbox.uncheck()
            await expect(details).not.toBeVisible()
        } else {
            // Details should be visible
            await expect(details).toBeVisible()

            // Disable — details should hide
            await checkbox.uncheck()
            await expect(details).not.toBeVisible()

            // Re-enable — details should appear
            await checkbox.check()
            await expect(details).toBeVisible()
        }

        await cancelSettings(authedPage)
    })

    test('notification time select is available when enabled', async ({ authedPage }) => {
        await openSettingsModal(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')
        if (!await checkbox.isChecked()) {
            await checkbox.check()
        }

        // Time select should be visible and have options
        const timeSelect = authedPage.locator('#notificationTime')
        await expect(timeSelect).toBeVisible()

        const optionCount = await timeSelect.locator('option').count()
        expect(optionCount).toBe(24) // 24 hours

        await cancelSettings(authedPage)
    })

    test('timezone select is available when notifications are enabled', async ({ authedPage }) => {
        await openSettingsModal(authedPage)

        const checkbox = authedPage.locator('#emailNotificationsEnabled')
        if (!await checkbox.isChecked()) {
            await checkbox.check()
        }

        // Timezone select should be visible with options
        const tzSelect = authedPage.locator('#timezoneSelect')
        await expect(tzSelect).toBeVisible()

        const optionCount = await tzSelect.locator('option').count()
        expect(optionCount).toBeGreaterThan(100) // IANA has 400+ timezones

        await cancelSettings(authedPage)
    })
})
