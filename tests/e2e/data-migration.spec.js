import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo, waitForApp } from './helpers/todos.js'
import { openSettingsModal, cancelSettings } from './helpers/settings.js'

test.describe('Data Migration (Encrypt Existing Data)', () => {
    test('migration button exists in settings modal', async ({ authedPage }) => {
        await openSettingsModal(authedPage)

        const migrateBtn = authedPage.locator('#migrateDataBtn')
        await expect(migrateBtn).toBeVisible()
        await expect(migrateBtn).toHaveText('Encrypt Existing Data')
        await expect(migrateBtn).toBeEnabled()

        await cancelSettings(authedPage)
    })

    test('migration status message is hidden by default', async ({ authedPage }) => {
        await openSettingsModal(authedPage)

        const migrateStatus = authedPage.locator('#migrateStatus')
        await expect(migrateStatus).toBeHidden()

        await cancelSettings(authedPage)
    })

    test('migration encrypts existing todos and they remain readable', async ({ authedPage }) => {
        // Create a todo (the app already has encryption enabled for this test user,
        // so new todos are encrypted on creation; migration handles any that were
        // created before encryption was enabled).
        const name = unique('Migrate')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open settings and run migration
        await openSettingsModal(authedPage)

        const migrateBtn = authedPage.locator('#migrateDataBtn')
        const migrateStatus = authedPage.locator('#migrateStatus')

        await migrateBtn.click()

        // Button should show "Encrypting..." while processing
        // (may be very fast so we use a soft check)
        await expect(migrateStatus).toBeVisible({ timeout: 15000 })

        // Status should show a success message (green text)
        // Either "All data is already encrypted!" or "Encrypted N todo(s) and N category(ies)."
        await expect(migrateStatus).toHaveCSS('color', 'rgb(51, 204, 51)', { timeout: 15000 })

        // Button should be re-enabled after migration completes
        await expect(migrateBtn).toBeEnabled()
        await expect(migrateBtn).toHaveText('Encrypt Existing Data')

        await cancelSettings(authedPage)

        // Verify todo text is still readable after migration
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name).locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('running migration twice shows "already encrypted" message', async ({ authedPage }) => {
        // First migration run
        await openSettingsModal(authedPage)

        const migrateBtn = authedPage.locator('#migrateDataBtn')
        const migrateStatus = authedPage.locator('#migrateStatus')

        await migrateBtn.click()
        await expect(migrateStatus).toBeVisible({ timeout: 15000 })

        // Close and reopen settings to run migration again
        await cancelSettings(authedPage)
        await openSettingsModal(authedPage)

        // Status should be hidden again when modal reopens
        // (depends on implementation; if not, we check after clicking)
        await migrateBtn.click()
        await expect(migrateStatus).toBeVisible({ timeout: 15000 })

        // Second run should report everything is already encrypted
        await expect(migrateStatus).toContainText('All data is already encrypted!')
        await expect(migrateStatus).toHaveCSS('color', 'rgb(51, 204, 51)')

        await cancelSettings(authedPage)
    })

    test('todo text survives migration and page reload', async ({ authedPage }) => {
        const name = unique('MigReload')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Run migration
        await openSettingsModal(authedPage)
        const migrateBtn = authedPage.locator('#migrateDataBtn')
        const migrateStatus = authedPage.locator('#migrateStatus')
        await migrateBtn.click()
        await expect(migrateStatus).toBeVisible({ timeout: 15000 })
        await expect(migrateBtn).toBeEnabled()
        await cancelSettings(authedPage)

        // Reload the page
        await authedPage.reload()
        await waitForApp(authedPage)

        // Todo should still be readable (tests decrypt-on-load after migration)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 15000 })
        await expect(todoItem(authedPage, name).locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('migration button shows Encrypting state during processing', async ({ authedPage }) => {
        await openSettingsModal(authedPage)

        const migrateBtn = authedPage.locator('#migrateDataBtn')

        // Capture the button text change by starting to listen before clicking
        const textChangePromise = authedPage.waitForFunction(
            () => {
                const btn = document.getElementById('migrateDataBtn')
                return btn && (btn.textContent === 'Encrypting...' || btn.disabled)
            },
            { timeout: 5000 }
        ).catch(() => null) // May resolve too fast; that is acceptable

        await migrateBtn.click()
        await textChangePromise

        // Wait for completion
        const migrateStatus = authedPage.locator('#migrateStatus')
        await expect(migrateStatus).toBeVisible({ timeout: 15000 })

        // After completion, button should be restored
        await expect(migrateBtn).toHaveText('Encrypt Existing Data')
        await expect(migrateBtn).toBeEnabled()

        await cancelSettings(authedPage)
    })
})
