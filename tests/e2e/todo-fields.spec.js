import { test, expect } from './fixtures.js'

const unique = () => `TF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
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
    if (opts.priority) {
        await page.selectOption('#modalPrioritySelect', { label: opts.priority })
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
 * Helper: get available option labels from a select element (excluding empty/"No ..." options).
 */
async function getAvailableOptions(page, selectId) {
    const options = page.locator(`${selectId} option`)
    const count = await options.count()
    const labels = []
    for (let i = 0; i < count; i++) {
        const value = await options.nth(i).getAttribute('value')
        const text = await options.nth(i).textContent()
        if (value && value !== '') {
            labels.push(text.trim())
        }
    }
    return labels
}

test.describe('Todo Fields - Category', () => {
    test('assign a category to a new todo', async ({ authedPage }) => {
        // Check if categories are available
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const categories = await getAvailableOptions(authedPage, '#modalCategorySelect')
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        if (categories.length === 0) {
            test.skip('No categories available in test account')
            return
        }

        const name = unique()
        const categoryName = categories[0]

        await addTodo(authedPage, name, { category: categoryName })
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Open edit modal to verify category was saved
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        const selectedCategory = await authedPage.locator('#modalCategorySelect').inputValue()
        expect(selectedCategory).not.toBe('')

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('change category on an existing todo', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const categories = await getAvailableOptions(authedPage, '#modalCategorySelect')
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        if (categories.length < 2) {
            test.skip('Need at least 2 categories to test changing category')
            return
        }

        const name = unique()
        await addTodo(authedPage, name, { category: categories[0] })
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Edit todo and change category
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalCategorySelect', { label: categories[1] })
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify new category is saved
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const selectedText = await authedPage.locator('#modalCategorySelect option:checked').textContent()
        expect(selectedText.trim()).toBe(categories[1])

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Todo Fields - Context', () => {
    test('assign a context to a new todo', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const contexts = await getAvailableOptions(authedPage, '#modalContextSelect')
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        if (contexts.length === 0) {
            test.skip('No contexts available in test account')
            return
        }

        const name = unique()
        const contextName = contexts[0]

        await addTodo(authedPage, name, { context: contextName })
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Open edit modal to verify context was saved
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        const selectedContext = await authedPage.locator('#modalContextSelect').inputValue()
        expect(selectedContext).not.toBe('')

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('change context on an existing todo', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const contexts = await getAvailableOptions(authedPage, '#modalContextSelect')
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        if (contexts.length < 2) {
            test.skip('Need at least 2 contexts to test changing context')
            return
        }

        const name = unique()
        await addTodo(authedPage, name, { context: contexts[0] })
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Edit and change context
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalContextSelect', { label: contexts[1] })
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify new context is saved
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const selectedText = await authedPage.locator('#modalContextSelect option:checked').textContent()
        expect(selectedText.trim()).toBe(contexts[1])

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Todo Fields - Priority', () => {
    test('assign a priority to a new todo', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const priorities = await getAvailableOptions(authedPage, '#modalPrioritySelect')
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        if (priorities.length === 0) {
            test.skip('No priorities available in test account')
            return
        }

        const name = unique()
        const priorityName = priorities[0]

        await addTodo(authedPage, name, { priority: priorityName })
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Open edit modal to verify priority was saved
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        const selectedPriority = await authedPage.locator('#modalPrioritySelect').inputValue()
        expect(selectedPriority).not.toBe('')

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('change priority on an existing todo', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const priorities = await getAvailableOptions(authedPage, '#modalPrioritySelect')
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        if (priorities.length < 2) {
            test.skip('Need at least 2 priorities to test changing priority')
            return
        }

        const name = unique()
        await addTodo(authedPage, name, { priority: priorities[0] })
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Edit and change priority
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalPrioritySelect', { label: priorities[1] })
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify new priority is saved
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const selectedText = await authedPage.locator('#modalPrioritySelect option:checked').textContent()
        expect(selectedText.trim()).toBe(priorities[1])

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('remove priority from a todo', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const priorities = await getAvailableOptions(authedPage, '#modalPrioritySelect')
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        if (priorities.length === 0) {
            test.skip('No priorities available in test account')
            return
        }

        const name = unique()
        await addTodo(authedPage, name, { priority: priorities[0] })
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Edit and remove priority (select "No Priority")
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalPrioritySelect', '')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify priority was removed
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        const selectedPriority = await authedPage.locator('#modalPrioritySelect').inputValue()
        expect(selectedPriority).toBe('')

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
