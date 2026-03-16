import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo, clearInboxViaApi, restoreInboxViaApi } from './helpers/todos.js'

/**
 * Helper: ensure the inbox zen state is visible, retrying the clear if parallel
 * tests added inbox items between the clear and the UI check.
 */
async function ensureZenState(page, movedIds) {
    for (let attempt = 0; attempt < 3; attempt++) {
        await expect(page.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })
        const zenVisible = await page.locator('.inbox-zen-state').isVisible()
        if (zenVisible) return movedIds
        // Parallel test may have added inbox items — clear again
        const extraIds = await clearInboxViaApi(page)
        movedIds.push(...extraIds)
    }
    // Final assertion — let it fail if still not visible
    await expect(page.locator('.inbox-zen-state')).toBeVisible({ timeout: 15000 })
    return movedIds
}

test.describe('Daily Quotes (Empty Inbox)', () => {
    test('empty Inbox shows a motivational quote', async ({ authedPage }) => {
        test.slow() // clearInboxViaApi with retries can exceed default timeout
        const page = authedPage

        // clearInboxViaApi retries until inbox is truly empty (handles parallel test interference)
        let movedIds = await clearInboxViaApi(page)

        // Ensure zen state is visible, retrying clear if parallel tests interfered
        movedIds = await ensureZenState(page, movedIds)

        // The zen state with quote should now be visible
        await expect(page.locator('.inbox-zen-state')).toBeVisible({ timeout: 15000 })

        // Wait for the quote to load asynchronously (container gets .loaded class)
        const quoteContainer = page.locator('#zenQuoteContainer')
        await expect(quoteContainer).toHaveClass(/loaded/, { timeout: 10000 })

        // The blockquote with quote text should be visible
        const quoteText = page.locator('.zen-quote-text')
        await expect(quoteText).toBeVisible()

        // Restore inbox todos
        await restoreInboxViaApi(page, movedIds)
    })

    test('quote is visible text (not empty)', async ({ authedPage }) => {
        test.slow() // clearInboxViaApi with retries can exceed default timeout
        const page = authedPage

        let movedIds = await clearInboxViaApi(page)
        movedIds = await ensureZenState(page, movedIds)

        // Wait for zen state and quote to load
        await expect(page.locator('.inbox-zen-state')).toBeVisible({ timeout: 10000 })
        await expect(page.locator('#zenQuoteContainer')).toHaveClass(/loaded/, { timeout: 10000 })

        // Verify quote text is non-empty and looks like readable text (not raw HTML)
        const quoteText = page.locator('.zen-quote-text')
        const textContent = await quoteText.textContent()
        expect(textContent.length).toBeGreaterThan(0)
        // Should not contain raw HTML tags
        expect(textContent).not.toMatch(/<[^>]+>/)

        // Verify author is also present and non-empty
        const authorText = page.locator('.zen-quote-author')
        const authorContent = await authorText.textContent()
        expect(authorContent.length).toBeGreaterThan(0)
        expect(authorContent).not.toMatch(/<[^>]+>/)

        // Restore inbox todos
        await restoreInboxViaApi(page, movedIds)
    })

    test('adding a todo hides the quote', async ({ authedPage }) => {
        test.slow() // clearInboxViaApi with retries can exceed default timeout
        const page = authedPage

        let movedIds = await clearInboxViaApi(page)
        movedIds = await ensureZenState(page, movedIds)

        // Verify zen state with quote is visible
        await expect(page.locator('.inbox-zen-state')).toBeVisible({ timeout: 15000 })
        await expect(page.locator('#zenQuoteContainer')).toHaveClass(/loaded/, { timeout: 10000 })

        // Add a todo to the Inbox
        const todoName = unique('DQ')
        await addTodo(page, todoName, { gtdStatus: 'inbox' })

        // The todo should appear
        await expect(todoItem(page, todoName)).toBeVisible({ timeout: 5000 })

        // The zen state (and quote) should no longer be visible
        await expect(page.locator('.inbox-zen-state')).not.toBeVisible()

        // Cleanup: delete the todo and restore inbox
        await deleteTodo(page, todoName)
        await restoreInboxViaApi(page, movedIds)
    })

    test('deleting last todo shows the quote again', async ({ authedPage }) => {
        test.slow() // clearInboxViaApi with retries can exceed default timeout
        const page = authedPage

        let movedIds = await clearInboxViaApi(page)
        movedIds = await ensureZenState(page, movedIds)

        // Verify zen state is visible initially (empty inbox)
        await expect(page.locator('.inbox-zen-state')).toBeVisible({ timeout: 15000 })

        // Add a todo — quote should disappear
        const todoName = unique('DQ')
        await addTodo(page, todoName, { gtdStatus: 'inbox' })
        await expect(todoItem(page, todoName)).toBeVisible({ timeout: 5000 })
        await expect(page.locator('.inbox-zen-state')).not.toBeVisible()

        // Delete the todo — quote should reappear
        await deleteTodo(page, todoName)

        // The zen state with the quote should be visible again
        await expect(page.locator('.inbox-zen-state')).toBeVisible({ timeout: 10000 })
        await expect(page.locator('#zenQuoteContainer')).toHaveClass(/loaded/, { timeout: 10000 })
        await expect(page.locator('.zen-quote-text')).toBeVisible()

        // Restore inbox todos
        await restoreInboxViaApi(page, movedIds)
    })
})
