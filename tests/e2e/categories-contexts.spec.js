import { test, expect } from './fixtures.js'

const unique = () => `CC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: get the first real option (not the placeholder) from a select.
 * Returns { value, label } or null if no options available.
 */
async function getFirstOption(page, selectId) {
    const options = page.locator(`${selectId} option`)
    const count = await options.count()
    // First option is the placeholder ("No Category" / "No Context"), skip it
    if (count < 2) return null
    const value = await options.nth(1).getAttribute('value')
    const label = await options.nth(1).textContent()
    return { value, label }
}

/**
 * Helper: get a second option from a select (for testing category/context changes).
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
 * Helper: open the add todo modal and check available options.
 * Closes the modal afterwards.
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

test.describe('Categories', () => {
    test('add a todo with a category and verify badge appears', async ({ authedPage }) => {
        const { first: category } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!category, 'No categories available for test user')

        const name = unique()
        await addTodo(authedPage, name, { category: category.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Category badge should display with the category name
        const badge = item.locator('.todo-category-badge')
        await expect(badge).toBeVisible()
        await expect(badge).toContainText(category.label)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('category badge has background color styling', async ({ authedPage }) => {
        const { first: category } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!category, 'No categories available for test user')

        const name = unique()
        await addTodo(authedPage, name, { category: category.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Badge should have a background-color style set
        const badge = item.locator('.todo-category-badge')
        const bgColor = await badge.evaluate(el => getComputedStyle(el).backgroundColor)
        // Background color should not be transparent/empty
        expect(bgColor).not.toBe('')
        expect(bgColor).not.toBe('transparent')
        expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('category sets left border color on todo item', async ({ authedPage }) => {
        const { first: category } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!category, 'No categories available for test user')

        const name = unique()
        await addTodo(authedPage, name, { category: category.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // The todo item should have a left border color matching the category
        const borderColor = await item.evaluate(el => el.style.borderLeftColor)
        expect(borderColor).not.toBe('')

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit a todo to change its category', async ({ authedPage }) => {
        const { first: cat1, second: cat2 } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!cat1 || !cat2, 'Need at least 2 categories for this test')

        const name = unique()
        await addTodo(authedPage, name, { category: cat1.label })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Verify initial badge shows cat1
        await expect(todoItem(authedPage, name).locator('.todo-category-badge')).toContainText(cat1.label, { timeout: 5000 })

        // Open edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Verify current category is pre-selected
        await expect(authedPage.locator('#modalCategorySelect')).toHaveValue(cat1.value)

        // Change to second category
        await authedPage.selectOption('#modalCategorySelect', cat2.value)
        await expect(authedPage.locator('#modalCategorySelect')).toHaveValue(cat2.value)
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Debug: check store state after edit
        const storeState = await authedPage.evaluate((todoName) => {
            const mod = window.__testStore || {}
            try {
                // Dynamically import store
                return import('./src/core/store.js').then(({ store }) => {
                    const todos = store.get('todos')
                    const todo = todos.find(t => t.text && t.text.includes(todoName))
                    const categories = store.get('categories')
                    return {
                        todoCategoryId: todo ? todo.category_id : 'TODO_NOT_FOUND',
                        categoryIds: categories.map(c => c.id),
                        categoryNames: categories.map(c => c.name)
                    }
                })
            } catch (e) {
                return { error: e.message }
            }
        }, name)
        console.log('Store state after edit:', JSON.stringify(storeState))

        // Badge should now show the second category
        const badge = todoItem(authedPage, name).locator('.todo-category-badge')
        await expect(badge).toContainText(cat2.label, { timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit a todo to remove its category', async ({ authedPage }) => {
        const { first: category } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        test.skip(!category, 'No categories available for test user')

        const name = unique()
        await addTodo(authedPage, name, { category: category.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-category-badge')).toBeVisible()

        // Open edit modal and remove category
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalCategorySelect', '')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Badge should no longer be present
        await expect(todoItem(authedPage, name).locator('.todo-category-badge')).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo without category shows no category badge', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // No category badge should be present
        await expect(item.locator('.todo-category-badge')).not.toBeAttached()

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Contexts', () => {
    test('add a todo with a context and verify badge appears', async ({ authedPage }) => {
        const { first: context } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!context, 'No contexts available for test user')

        const name = unique()
        await addTodo(authedPage, name, { context: context.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Context badge should display with the context name
        const badge = item.locator('.todo-context-badge')
        await expect(badge).toBeVisible()
        await expect(badge).toContainText(context.label)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit a todo to change its context', async ({ authedPage }) => {
        const { first: ctx1, second: ctx2 } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!ctx1 || !ctx2, 'Need at least 2 contexts for this test')

        const name = unique()
        await addTodo(authedPage, name, { context: ctx1.label })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Verify current context is pre-selected
        await expect(authedPage.locator('#modalContextSelect')).toHaveValue(ctx1.value)

        // Change to second context (use value to avoid label/textContent mismatch)
        await authedPage.selectOption('#modalContextSelect', ctx2.value)
        await expect(authedPage.locator('#modalContextSelect')).toHaveValue(ctx2.value)
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Badge should now show the second context
        const badge = todoItem(authedPage, name).locator('.todo-context-badge')
        await expect(badge).toContainText(ctx2.label, { timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit a todo to remove its context', async ({ authedPage }) => {
        const { first: context } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!context, 'No contexts available for test user')

        const name = unique()
        await addTodo(authedPage, name, { context: context.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-context-badge')).toBeVisible()

        // Open edit modal and remove context
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalContextSelect', '')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Badge should no longer be present
        await expect(todoItem(authedPage, name).locator('.todo-context-badge')).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo without context shows no context badge', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // No context badge should be present
        await expect(item.locator('.todo-context-badge')).not.toBeAttached()

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Categories and Contexts combined', () => {
    test('add a todo with both category and context', async ({ authedPage }) => {
        const { first: category } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        const { first: context } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!category || !context, 'Need both categories and contexts for this test')

        const name = unique()
        await addTodo(authedPage, name, { category: category.label, context: context.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Both badges should appear
        await expect(item.locator('.todo-category-badge')).toContainText(category.label)
        await expect(item.locator('.todo-context-badge')).toContainText(context.label)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit modal preserves both category and context values', async ({ authedPage }) => {
        const { first: category } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        const { first: context } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!category || !context, 'Need both categories and contexts for this test')

        const name = unique()
        await addTodo(authedPage, name, { category: category.label, context: context.label })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open edit modal and verify both values are pre-selected
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        await expect(authedPage.locator('#modalCategorySelect')).toHaveValue(category.value)
        await expect(authedPage.locator('#modalContextSelect')).toHaveValue(context.value)

        // Close without saving
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('category and context persist after page reload', async ({ authedPage }) => {
        const { first: category } = await getAvailableOptions(authedPage, '#modalCategorySelect')
        const { first: context } = await getAvailableOptions(authedPage, '#modalContextSelect')
        test.skip(!category || !context, 'Need both categories and contexts for this test')

        const name = unique()
        await addTodo(authedPage, name, { category: category.label, context: context.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-category-badge')).toContainText(category.label)

        // Reload the page
        await authedPage.reload()
        await authedPage.waitForSelector('.todo-item', { timeout: 15000 })

        // Badges should still be present after reload
        const reloadedItem = todoItem(authedPage, name)
        await expect(reloadedItem).toBeVisible({ timeout: 10000 })
        await expect(reloadedItem.locator('.todo-category-badge')).toContainText(category.label)
        await expect(reloadedItem.locator('.todo-context-badge')).toContainText(context.label)

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
