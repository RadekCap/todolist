import { test, expect } from './fixtures.js'

const unique = () => `SC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.comment) {
        await page.fill('#modalCommentInput', opts.comment)
    }

    await page.click('#addTodoForm button[type="submit"]')
    await expect(page.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
}

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
 * Helper: type into the search input and wait for debounce.
 */
async function search(page, query) {
    await page.fill('#searchInput', query)
    await page.waitForTimeout(600)
}

/**
 * Helper: clear the search input.
 */
async function clearSearch(page) {
    await page.fill('#searchInput', '')
    await page.waitForTimeout(600)
}

test.describe('Search in Comments', () => {
    test('search matches text in todo comments', async ({ authedPage }) => {
        const todoName = unique()
        const commentText = `UniqueComment-${Date.now()}`

        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, todoName, { comment: commentText })
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Search for the comment text (not the todo title)
        await search(authedPage, commentText)

        // Todo should be found via its comment
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Clear search
        await clearSearch(authedPage)

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })

    test('search in comments is case-insensitive', async ({ authedPage }) => {
        const todoName = unique()
        const commentText = `CaseSensitiveComment-${Date.now()}`

        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, todoName, { comment: commentText })
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Search with uppercase version of comment
        await search(authedPage, commentText.toUpperCase())

        // Should still find the todo
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Clear search
        await clearSearch(authedPage)

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })

    test('search does not match when comment does not contain query', async ({ authedPage }) => {
        const todoName = unique()
        const commentText = `KnownComment-${Date.now()}`

        await switchGtdTab(authedPage, 'inbox')
        await addTodo(authedPage, todoName, { comment: commentText })
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Search for something not in title or comment
        await search(authedPage, 'zzz-no-match-anywhere-zzz')

        // Todo should NOT be found
        await expect(todoItem(authedPage, todoName)).not.toBeAttached({ timeout: 5000 })

        // Clear search
        await clearSearch(authedPage)

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })
})
