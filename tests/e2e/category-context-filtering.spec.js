import { test, expect } from './fixtures.js'

const unique = () => `CF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal and return its name.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.category) {
        await page.selectOption('#modalCategorySelect', { label: opts.category })
    }
    if (opts.context) {
        await page.selectOption('#modalContextSelect', { label: opts.context })
    }
    if (opts.gtdStatus) {
        await page.selectOption('#modalGtdStatusSelect', opts.gtdStatus)
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
 * Helper: click a GTD tab in the sidebar.
 */
async function switchGtdTab(page, status) {
    await page.click(`.gtd-tab.${status}`)
    await page.waitForTimeout(500)
}

/**
 * Helper: get the first real option (not the placeholder) from a select.
 * Returns { value, label } or null if no options available.
 */
async function getFirstOption(page, selectId) {
    const options = page.locator(`${selectId} option`)
    const count = await options.count()
    if (count < 2) return null
    const value = await options.nth(1).getAttribute('value')
    const label = await options.nth(1).textContent()
    return { value, label }
}

/**
 * Helper: get a second option from a select.
 * Returns { value, label } or null if fewer than 2 real options available.
 */
async function getSecondOption(page, selectId) {
    const options = page.locator(`${selectId} option`)
    const count = await options.count()
    if (count < 3) return null
    const value = await options.nth(2).getAttribute('value')
    const label = await options.nth(2).textContent()
    return { value, label }
}

/**
 * Helper: open the add todo modal and check available options, then close.
 */
async function getAvailableOptions(page, selectId) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    const first = await getFirstOption(page, selectId)
    const second = await getSecondOption(page, selectId)
    await page.click('#cancelModal')
    await expect(page.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    return { first, second }
}

/**
 * Helper: apply a category filter by setting store state and triggering re-render.
 * The app's filtering pipeline reads selectedCategoryIds from the store
 * during rendering, so we set it and trigger a re-render via the todos key.
 */
async function setCategoryFilter(page, categoryIds) {
    await page.evaluate((ids) => {
        const { store } = window.__testHelpers || {}
        if (store) {
            store.set('selectedCategoryIds', new Set(ids))
            // Trigger re-render by re-setting todos
            store.set('todos', store.get('todos'))
        }
    }, categoryIds)
    await page.waitForTimeout(300)
}

/**
 * Helper: apply a context filter by setting store state and triggering re-render.
 */
async function setContextFilter(page, contextIds) {
    await page.evaluate((ids) => {
        const { store } = window.__testHelpers || {}
        if (store) {
            store.set('selectedContextIds', new Set(ids))
            store.set('todos', store.get('todos'))
        }
    }, contextIds)
    await page.waitForTimeout(300)
}

/**
 * Helper: clear all category and context filters.
 */
async function clearFilters(page) {
    await page.evaluate(() => {
        const { store } = window.__testHelpers || {}
        if (store) {
            store.set('selectedCategoryIds', new Set())
            store.set('selectedContextIds', new Set())
            store.set('todos', store.get('todos'))
        }
    })
    await page.waitForTimeout(300)
}

/**
 * Helper: expose the store on window for test access.
 * Must be called after the app is loaded and authenticated.
 */
async function exposeStore(page) {
    await page.evaluate(async () => {
        // Import the store module dynamically
        const mod = await import('./src/core/store.js')
        window.__testHelpers = { store: mod.store }
    })
}

/**
 * Helper: get the category_id for a todo by its text from the store.
 */
async function getTodoCategoryId(page, todoText) {
    return page.evaluate((text) => {
        const { store } = window.__testHelpers || {}
        if (!store) return null
        const todo = store.get('todos').find(t => t.text && t.text.includes(text))
        return todo ? todo.category_id : null
    }, todoText)
}

/**
 * Helper: get the context_id for a todo by its text from the store.
 */
async function getTodoContextId(page, todoText) {
    return page.evaluate((text) => {
        const { store } = window.__testHelpers || {}
        if (!store) return null
        const todo = store.get('todos').find(t => t.text && t.text.includes(text))
        return todo ? todo.context_id : null
    }, todoText)
}

test.describe('Category Sidebar Filtering', () => {
    test('select a category in sidebar filters todos', async ({ authedPage }) => {
        const { first: cat1, second: cat2 } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!cat1 || !cat2, 'Need at least 2 categories for this test')

        const name1 = unique()
        const name2 = unique()

        // Create two todos with different categories
        await addTodo(authedPage, name1, { category: cat1.label })
        await addTodo(authedPage, name2, { category: cat2.label })
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        // Expose store for programmatic filter access
        await exposeStore(authedPage)

        // Get the category_id for the first todo
        const catId1 = await getTodoCategoryId(authedPage, name1)
        expect(catId1).not.toBeNull()

        // Apply category filter for the first category only
        await setCategoryFilter(authedPage, [catId1])

        // Only the first todo should be visible
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await clearFilters(authedPage)
        await deleteTodo(authedPage, name1)
        await deleteTodo(authedPage, name2)
    })

    test('select multiple categories shows union of matches', async ({ authedPage }) => {
        const { first: cat1, second: cat2 } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!cat1 || !cat2, 'Need at least 2 categories for this test')

        const name1 = unique()
        const name2 = unique()

        await addTodo(authedPage, name1, { category: cat1.label })
        await addTodo(authedPage, name2, { category: cat2.label })
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        await exposeStore(authedPage)

        const catId1 = await getTodoCategoryId(authedPage, name1)
        const catId2 = await getTodoCategoryId(authedPage, name2)
        expect(catId1).not.toBeNull()
        expect(catId2).not.toBeNull()

        // Select both categories
        await setCategoryFilter(authedPage, [catId1, catId2])

        // Both todos should be visible
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await clearFilters(authedPage)
        await deleteTodo(authedPage, name1)
        await deleteTodo(authedPage, name2)
    })

    test('uncategorized filter shows todos without category', async ({ authedPage }) => {
        const { first: cat1 } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!cat1, 'Need at least 1 category for this test')

        const uncatName = unique()
        const catName = unique()

        // Create one todo without category and one with
        await addTodo(authedPage, uncatName)
        await addTodo(authedPage, catName, { category: cat1.label })
        await expect(todoItem(authedPage, uncatName)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, catName)).toBeVisible({ timeout: 5000 })

        await exposeStore(authedPage)

        // Apply 'uncategorized' filter
        await setCategoryFilter(authedPage, ['uncategorized'])

        // Only the uncategorized todo should be visible
        await expect(todoItem(authedPage, uncatName)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, catName)).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await clearFilters(authedPage)
        await deleteTodo(authedPage, uncatName)
        await deleteTodo(authedPage, catName)
    })

    test('deselect category restores full list', async ({ authedPage }) => {
        const { first: cat1 } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!cat1, 'Need at least 1 category for this test')

        const name1 = unique()
        const name2 = unique()

        await addTodo(authedPage, name1, { category: cat1.label })
        await addTodo(authedPage, name2)
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        await exposeStore(authedPage)

        const catId1 = await getTodoCategoryId(authedPage, name1)

        // Apply category filter — only categorized todo visible
        await setCategoryFilter(authedPage, [catId1])
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).not.toBeAttached({ timeout: 5000 })

        // Clear filter — all todos visible again
        await clearFilters(authedPage)
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name1)
        await deleteTodo(authedPage, name2)
    })
})

test.describe('Context Sidebar Filtering', () => {
    test('select a context in sidebar filters todos', async ({ authedPage }) => {
        const { first: ctx1, second: ctx2 } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!ctx1 || !ctx2, 'Need at least 2 contexts for this test')

        const name1 = unique()
        const name2 = unique()

        await addTodo(authedPage, name1, { context: ctx1.label })
        await addTodo(authedPage, name2, { context: ctx2.label })
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        await exposeStore(authedPage)

        const ctxId1 = await getTodoContextId(authedPage, name1)
        expect(ctxId1).not.toBeNull()

        // Apply context filter for the first context only
        await setContextFilter(authedPage, [ctxId1])

        // Only the first todo should be visible
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await clearFilters(authedPage)
        await deleteTodo(authedPage, name1)
        await deleteTodo(authedPage, name2)
    })

    test('combined category and context filter', async ({ authedPage }) => {
        const { first: cat1 } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        const { first: ctx1, second: ctx2 } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!cat1 || !ctx1 || !ctx2, 'Need at least 1 category and 2 contexts for this test')

        const matchBoth = unique()
        const matchCatOnly = unique()
        const matchCtxOnly = unique()

        // Create todos with different category/context combos
        await addTodo(authedPage, matchBoth, { category: cat1.label, context: ctx1.label })
        await addTodo(authedPage, matchCatOnly, { category: cat1.label, context: ctx2.label })
        await addTodo(authedPage, matchCtxOnly, { context: ctx1.label })

        await expect(todoItem(authedPage, matchBoth)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, matchCatOnly)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, matchCtxOnly)).toBeVisible({ timeout: 5000 })

        await exposeStore(authedPage)

        const catId = await getTodoCategoryId(authedPage, matchBoth)
        const ctxId = await getTodoContextId(authedPage, matchBoth)
        expect(catId).not.toBeNull()
        expect(ctxId).not.toBeNull()

        // Apply both category and context filters
        await page_setCategoryAndContextFilter(authedPage, [catId], [ctxId])

        // Only the todo matching both category AND context should be visible
        await expect(todoItem(authedPage, matchBoth)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, matchCatOnly)).not.toBeAttached({ timeout: 5000 })
        await expect(todoItem(authedPage, matchCtxOnly)).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await clearFilters(authedPage)
        await deleteTodo(authedPage, matchBoth)
        await deleteTodo(authedPage, matchCatOnly)
        await deleteTodo(authedPage, matchCtxOnly)
    })
})

/**
 * Helper: set both category and context filters at once.
 */
async function page_setCategoryAndContextFilter(page, categoryIds, contextIds) {
    await page.evaluate(({ catIds, ctxIds }) => {
        const { store } = window.__testHelpers || {}
        if (store) {
            store.set('selectedCategoryIds', new Set(catIds))
            store.set('selectedContextIds', new Set(ctxIds))
            store.set('todos', store.get('todos'))
        }
    }, { catIds: categoryIds, ctxIds: contextIds })
    await page.waitForTimeout(300)
}

test.describe('Filter Edge Cases', () => {
    test('category filter with GTD status combined', async ({ authedPage }) => {
        const { first: cat1 } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!cat1, 'Need at least 1 category for this test')

        const inboxTodo = unique()
        const nextTodo = unique()

        // Create one todo in inbox with category and one in next_action with same category
        await addTodo(authedPage, inboxTodo, { category: cat1.label })
        await addTodo(authedPage, nextTodo, { category: cat1.label, gtdStatus: 'next_action' })

        await expect(todoItem(authedPage, inboxTodo)).toBeVisible({ timeout: 5000 })

        await exposeStore(authedPage)

        const catId = await getTodoCategoryId(authedPage, inboxTodo)
        expect(catId).not.toBeNull()

        // Apply category filter while on Inbox tab
        await setCategoryFilter(authedPage, [catId])

        // Inbox todo should be visible (matches both GTD status and category)
        await expect(todoItem(authedPage, inboxTodo)).toBeVisible({ timeout: 5000 })

        // Next todo should NOT be visible (wrong GTD status)
        await expect(todoItem(authedPage, nextTodo)).not.toBeAttached({ timeout: 5000 })

        // Switch to Next tab — now the next todo should be visible
        await switchGtdTab(authedPage, 'next_action')
        await expect(todoItem(authedPage, nextTodo)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, inboxTodo)).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await clearFilters(authedPage)
        await deleteTodo(authedPage, nextTodo)
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, inboxTodo)
    })

    test('empty state for filtered results', async ({ authedPage }) => {
        const { first: cat1 } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        const { first: ctx1 } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!cat1 || !ctx1, 'Need at least 1 category and 1 context for this test')

        const name = unique()

        // Create a todo with a category but no context
        await addTodo(authedPage, name, { category: cat1.label })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        await exposeStore(authedPage)

        const catId = await getTodoCategoryId(authedPage, name)
        const ctxId = ctx1.value

        // Apply both category and context filter — the todo has the category but not the context
        // so the intersection should be empty
        await page_setCategoryAndContextFilter(authedPage, [catId], [ctxId])

        // No todos should be visible — empty state message should appear
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // The empty state message should be visible
        const emptyState = authedPage.locator('.empty-state')
        await expect(emptyState).toBeVisible({ timeout: 5000 })

        // Cleanup
        await clearFilters(authedPage)
        await deleteTodo(authedPage, name)
    })
})
