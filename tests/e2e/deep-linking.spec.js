import { test, expect } from './fixtures.js'
import { switchGtdTab, waitForApp } from './helpers/todos.js'

/**
 * Helper: navigate to a URL and wait for the app to be ready.
 */
async function navigateTo(page, path) {
    await page.goto(path)
    await waitForApp(page)
}

test.describe('Navigation & Deep Linking', () => {
    test('?gtd=next_action opens Next Actions tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=next_action')
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('?gtd=someday_maybe opens Someday tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=someday_maybe')
        await expect(authedPage.locator('.gtd-tab.someday_maybe')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('Browser back button restores previous GTD tab', async ({ authedPage }) => {
        // Start on Inbox (default after login)
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })

        // Switch to Next Actions — pushes state to browser history
        await switchGtdTab(authedPage, 'next_action')
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 3000 })

        // Press browser back — should restore Inbox
        await authedPage.goBack()
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('Browser forward button navigates forward after back', async ({ authedPage }) => {
        // Start on Inbox
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })

        // Switch to Next Actions
        await switchGtdTab(authedPage, 'next_action')
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 3000 })

        // Go back — should return to Inbox
        await authedPage.goBack()
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })

        // Go forward — should return to Next Actions
        await authedPage.goForward()
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('Invalid ?gtd parameter falls back to inbox', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=invalid_value')
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('GTD tab change updates URL', async ({ authedPage }) => {
        // Start on Inbox
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })

        // Switch to Next Actions
        await switchGtdTab(authedPage, 'next_action')
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 3000 })

        // Verify URL contains the gtd parameter
        const url = authedPage.url()
        expect(url).toContain('gtd=next_action')

        // Return to inbox for cleanup
        await switchGtdTab(authedPage, 'inbox')
    })
})
