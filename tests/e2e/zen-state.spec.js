import { test, expect } from './fixtures.js'

const unique = () => `Zen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: find a todo item by its text content.
 */
function todoItem(page, text) {
    return page.locator('.todo-item', { has: page.locator('.todo-text', { hasText: text }) })
}

/**
 * Helper: click a GTD tab.
 */
async function switchGtdTab(page, status) {
    await page.click(`.gtd-tab.${status}`)
    await page.waitForTimeout(500)
}

/**
 * Helper: delete a todo by text.
 */
async function deleteTodo(page, text) {
    const item = todoItem(page, text)
    if (await item.count() > 0) {
        await item.locator('.delete-btn').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

/**
 * Helper: delete all visible todos with the given prefix.
 */
async function clearInboxTodos(page, prefix) {
    const items = page.locator('.todo-item', { has: page.locator('.todo-text', { hasText: prefix }) })
    let count = await items.count()
    while (count > 0) {
        await items.first().locator('.delete-btn').click()
        await page.waitForTimeout(500)
        count = await items.count()
    }
}

test.describe('Empty Inbox Zen State', () => {
    test('zen state appears when inbox is empty', async ({ authedPage }) => {
        await switchGtdTab(authedPage, 'inbox')

        // Check if inbox has todos — if so, we can't easily test this
        const todoCount = await authedPage.locator('.todo-item').count()
        if (todoCount > 0) {
            test.skip('Inbox is not empty — cannot test zen state without clearing all todos')
            return
        }

        // Zen state should be visible
        await expect(authedPage.locator('.inbox-zen-state')).toBeVisible({ timeout: 5000 })
        await expect(authedPage.locator('.zen-title')).toContainText('Inbox Zero')
        await expect(authedPage.locator('.zen-message')).toBeVisible()
    })

    test('zen state disappears when a todo is added', async ({ authedPage }) => {
        await switchGtdTab(authedPage, 'inbox')

        const todoCount = await authedPage.locator('.todo-item').count()
        if (todoCount > 0) {
            test.skip('Inbox is not empty — cannot test zen state transition')
            return
        }

        // Zen state should be visible initially
        await expect(authedPage.locator('.inbox-zen-state')).toBeVisible({ timeout: 5000 })

        // Add a todo
        const name = unique()
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.fill('#modalTodoInput', name)
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Zen state should disappear
        await expect(authedPage.locator('.inbox-zen-state')).not.toBeVisible({ timeout: 5000 })

        // Todo should be visible
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('zen state shows daily quote', async ({ authedPage }) => {
        await switchGtdTab(authedPage, 'inbox')

        const todoCount = await authedPage.locator('.todo-item').count()
        if (todoCount > 0) {
            test.skip('Inbox is not empty — cannot test zen quote')
            return
        }

        // Wait for quote to load (async)
        await expect(authedPage.locator('#zenQuoteContainer')).toBeVisible({ timeout: 5000 })
        await expect(authedPage.locator('#zenQuoteContainer')).toHaveClass(/loaded/, { timeout: 10000 })

        // Quote text and author should be present
        await expect(authedPage.locator('.zen-quote-text')).toBeVisible()
        await expect(authedPage.locator('.zen-quote-author')).toBeVisible()
    })
})
