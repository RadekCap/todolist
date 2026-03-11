import { test, expect } from './fixtures.js'

test.describe('GTD Tab Keyboard Navigation', () => {
    test('Arrow Right moves focus to next GTD tab', async ({ authedPage }) => {
        // Focus Inbox tab without clicking (click triggers re-render which removes focus)
        const inboxTab = authedPage.locator('.gtd-tab.inbox')
        await inboxTab.focus()
        await expect(inboxTab).toBeFocused({ timeout: 2000 })

        // Press ArrowRight — should move to Next Action tab
        await authedPage.keyboard.press('ArrowRight')
        const nextTab = authedPage.locator('.gtd-tab.next_action')
        await expect(nextTab).toBeFocused({ timeout: 2000 })
    })

    test('Arrow Left moves focus to previous GTD tab', async ({ authedPage }) => {
        // Focus Next Action tab
        const nextTab = authedPage.locator('.gtd-tab.next_action')
        await nextTab.focus()
        await expect(nextTab).toBeFocused({ timeout: 2000 })

        // Press ArrowLeft — should move to Inbox tab
        await authedPage.keyboard.press('ArrowLeft')
        const inboxTab = authedPage.locator('.gtd-tab.inbox')
        await expect(inboxTab).toBeFocused({ timeout: 2000 })
    })

    test('Home key jumps to first GTD tab', async ({ authedPage }) => {
        // Focus a middle tab (Waiting For)
        const waitingTab = authedPage.locator('.gtd-tab.waiting_for')
        await waitingTab.focus()
        await expect(waitingTab).toBeFocused({ timeout: 2000 })

        // Press Home — should jump to first tab (Inbox)
        await authedPage.keyboard.press('Home')
        const inboxTab = authedPage.locator('.gtd-tab.inbox')
        await expect(inboxTab).toBeFocused({ timeout: 2000 })
    })

    test('End key jumps to last GTD tab', async ({ authedPage }) => {
        // Focus Inbox tab
        const inboxTab = authedPage.locator('.gtd-tab.inbox')
        await inboxTab.focus()
        await expect(inboxTab).toBeFocused({ timeout: 2000 })

        // Press End — should jump to last tab (All)
        await authedPage.keyboard.press('End')
        const allTab = authedPage.locator('.gtd-tab.all')
        await expect(allTab).toBeFocused({ timeout: 2000 })
    })

    test('Arrow Right from last tab wraps to first', async ({ authedPage }) => {
        // Focus the last tab (All)
        const allTab = authedPage.locator('.gtd-tab.all')
        await allTab.focus()
        await expect(allTab).toBeFocused({ timeout: 2000 })

        // Press ArrowRight — should wrap to Inbox (first tab)
        await authedPage.keyboard.press('ArrowRight')
        const inboxTab = authedPage.locator('.gtd-tab.inbox')
        await expect(inboxTab).toBeFocused({ timeout: 2000 })
    })
})
