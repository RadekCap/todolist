import { test, expect } from './fixtures.js'

const unique = () => `KB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: find a todo item by its text content.
 */
function todoItem(page, text) {
    return page.locator('.todo-item', { has: page.locator('.todo-text', { hasText: text }) })
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
 * Helper: click a GTD tab.
 */
async function switchGtdTab(page, status) {
    await page.click(`.gtd-tab.${status}`)
    await page.waitForTimeout(500)
}

test.describe('Keyboard Shortcuts', () => {
    test('pressing "n" opens the add todo modal', async ({ authedPage }) => {
        // Ensure no modal is open and no input is focused
        await authedPage.locator('body').click()
        await authedPage.waitForTimeout(300)

        await authedPage.keyboard.press('n')

        await expect(authedPage.locator('#addTodoModal')).toBeVisible({ timeout: 3000 })

        // Close modal
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('pressing "/" focuses the search input', async ({ authedPage }) => {
        await authedPage.locator('body').click()
        await authedPage.waitForTimeout(300)

        await authedPage.keyboard.press('/')

        // Search input should be focused
        await expect(authedPage.locator('#searchInput')).toBeFocused({ timeout: 3000 })

        // Unfocus
        await authedPage.keyboard.press('Escape')
    })

    test('number keys 0-6 switch GTD tabs', async ({ authedPage }) => {
        await authedPage.locator('body').click()
        await authedPage.waitForTimeout(300)

        // Press 1 → Inbox
        await authedPage.keyboard.press('1')
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 3000 })

        // Press 2 → Next
        await authedPage.keyboard.press('2')
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 3000 })

        // Press 3 → Scheduled
        await authedPage.keyboard.press('3')
        await expect(authedPage.locator('.gtd-tab.scheduled')).toHaveClass(/active/, { timeout: 3000 })

        // Press 4 → Waiting
        await authedPage.keyboard.press('4')
        await expect(authedPage.locator('.gtd-tab.waiting_for')).toHaveClass(/active/, { timeout: 3000 })

        // Press 5 → Someday
        await authedPage.keyboard.press('5')
        await expect(authedPage.locator('.gtd-tab.someday_maybe')).toHaveClass(/active/, { timeout: 3000 })

        // Press 6 → Done
        await authedPage.keyboard.press('6')
        await expect(authedPage.locator('.gtd-tab.done')).toHaveClass(/active/, { timeout: 3000 })

        // Press 0 → All
        await authedPage.keyboard.press('0')
        await expect(authedPage.locator('.gtd-tab.all')).toHaveClass(/active/, { timeout: 3000 })

        // Return to Inbox
        await authedPage.keyboard.press('1')
    })

    test('pressing "k" opens the keyboard shortcuts modal', async ({ authedPage }) => {
        await authedPage.locator('body').click()
        await authedPage.waitForTimeout(500)

        await authedPage.keyboard.press('k')

        await expect(authedPage.locator('#keyboardShortcutsModal')).toHaveClass(/active/, { timeout: 5000 })

        // Close with Escape
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#keyboardShortcutsModal')).not.toHaveClass(/active/, { timeout: 5000 })
    })

    test('pressing "?" also opens the keyboard shortcuts modal', async ({ authedPage }) => {
        await authedPage.locator('body').click()
        await authedPage.waitForTimeout(500)

        await authedPage.keyboard.press('?')

        await expect(authedPage.locator('#keyboardShortcutsModal')).toHaveClass(/active/, { timeout: 5000 })

        // Close
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#keyboardShortcutsModal')).not.toHaveClass(/active/, { timeout: 5000 })
    })

    test('pressing "g" opens the GTD guide modal', async ({ authedPage }) => {
        await authedPage.locator('body').click()
        await authedPage.waitForTimeout(500)

        await authedPage.keyboard.press('g')

        await expect(authedPage.locator('#gtdGuideModal')).toHaveClass(/active/, { timeout: 5000 })

        // Close
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#gtdGuideModal')).not.toHaveClass(/active/, { timeout: 5000 })
    })

    test('shortcuts are disabled while typing in an input', async ({ authedPage }) => {
        // Focus the search input
        await authedPage.locator('#searchInput').click()

        // Press 'n' — should NOT open the add todo modal (we're typing)
        await authedPage.keyboard.press('n')

        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible()

        // Unfocus
        await authedPage.keyboard.press('Escape')
    })

    test('shortcuts are disabled while a modal is open', async ({ authedPage }) => {
        // Open add todo modal
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Press 'k' — should NOT open keyboard shortcuts (modal already open)
        await authedPage.keyboard.press('k')
        await expect(authedPage.locator('#keyboardShortcutsModal')).not.toHaveClass(/active/)

        // Close the todo modal
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('Ctrl+Z undoes the last action', async ({ authedPage }) => {
        const name = unique()

        // Create a todo
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.fill('#modalTodoInput', name)
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete it
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Undo with Ctrl+Z
        await authedPage.keyboard.press('Control+z')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('Escape clears todo selection', async ({ authedPage }) => {
        const name = unique()

        // Create a todo
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.fill('#modalTodoInput', name)
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Select the todo
        await todoItem(authedPage, name).locator('.todo-select-checkbox').check()
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Press Escape to clear selection
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/, { timeout: 3000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
