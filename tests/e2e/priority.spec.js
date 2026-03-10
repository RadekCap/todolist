import { test, expect } from './fixtures.js'

const unique = () => `Prio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.priority) {
        await page.selectOption('#modalPrioritySelect', { label: opts.priority })
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
 * Helper: get available priority options from the modal.
 * Returns { first, second } where each is { value, label } or null.
 */
async function getAvailablePriorities(page) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()

    const options = page.locator('#modalPrioritySelect option')
    const count = await options.count()

    let first = null
    let second = null

    // First option is "No Priority" placeholder, skip it
    if (count >= 2) {
        first = {
            value: await options.nth(1).getAttribute('value'),
            label: await options.nth(1).textContent()
        }
    }
    if (count >= 3) {
        second = {
            value: await options.nth(2).getAttribute('value'),
            label: await options.nth(2).textContent()
        }
    }

    await page.click('#cancelModal')
    await expect(page.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    return { first, second }
}

test.describe('Priority - individual todo', () => {
    test('add a todo with a priority and verify badge appears', async ({ authedPage }) => {
        const { first: priority } = await getAvailablePriorities(authedPage)
        test.skip(!priority, 'No priorities available for test user')

        const name = unique()
        await addTodo(authedPage, name, { priority: priority.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        const badge = item.locator('.todo-priority-badge')
        await expect(badge).toBeVisible()
        await expect(badge).toContainText(priority.label)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('priority badge has background color styling', async ({ authedPage }) => {
        const { first: priority } = await getAvailablePriorities(authedPage)
        test.skip(!priority, 'No priorities available for test user')

        const name = unique()
        await addTodo(authedPage, name, { priority: priority.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        const badge = item.locator('.todo-priority-badge')
        const bgColor = await badge.evaluate(el => getComputedStyle(el).backgroundColor)
        expect(bgColor).not.toBe('')
        expect(bgColor).not.toBe('transparent')
        expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo without priority shows no priority badge', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-priority-badge')).not.toBeAttached()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit a todo to change its priority', async ({ authedPage }) => {
        const { first: prio1, second: prio2 } = await getAvailablePriorities(authedPage)
        test.skip(!prio1 || !prio2, 'Need at least 2 priorities for this test')

        const name = unique()
        await addTodo(authedPage, name, { priority: prio1.label })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Verify current priority is pre-selected
        await expect(authedPage.locator('#modalPrioritySelect')).toHaveValue(prio1.value)

        // Change to second priority
        await authedPage.selectOption('#modalPrioritySelect', { label: prio2.label })
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Badge should show the second priority
        const badge = todoItem(authedPage, name).locator('.todo-priority-badge')
        await expect(badge).toContainText(prio2.label, { timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit a todo to remove its priority', async ({ authedPage }) => {
        const { first: priority } = await getAvailablePriorities(authedPage)
        test.skip(!priority, 'No priorities available for test user')

        const name = unique()
        await addTodo(authedPage, name, { priority: priority.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-priority-badge')).toBeVisible()

        // Open edit modal and remove priority
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalPrioritySelect', '')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Badge should no longer be present
        await expect(todoItem(authedPage, name).locator('.todo-priority-badge')).not.toBeAttached({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Priority - star toggle', () => {
    test('clicking priority star activates it and selects first priority', async ({ authedPage }) => {
        const { first: priority } = await getAvailablePriorities(authedPage)
        test.skip(!priority, 'No priorities available for test user')

        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Star should not be active initially
        const star = authedPage.locator('#modalPriorityToggle')
        await expect(star).not.toHaveClass(/active/)

        // Priority select should be empty
        await expect(authedPage.locator('#modalPrioritySelect')).toHaveValue('')

        // Click star to activate
        await star.click()
        await expect(star).toHaveClass(/active/)

        // Priority select should now have the first priority selected
        await expect(authedPage.locator('#modalPrioritySelect')).toHaveValue(priority.value)

        // Close modal
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('clicking priority star again deactivates and clears priority', async ({ authedPage }) => {
        const { first: priority } = await getAvailablePriorities(authedPage)
        test.skip(!priority, 'No priorities available for test user')

        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        const star = authedPage.locator('#modalPriorityToggle')

        // Activate star
        await star.click()
        await expect(star).toHaveClass(/active/)
        await expect(authedPage.locator('#modalPrioritySelect')).toHaveValue(priority.value)

        // Deactivate star
        await star.click()
        await expect(star).not.toHaveClass(/active/)
        await expect(authedPage.locator('#modalPrioritySelect')).toHaveValue('')

        // Close modal
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('add a todo using priority star toggle', async ({ authedPage }) => {
        const { first: priority } = await getAvailablePriorities(authedPage)
        test.skip(!priority, 'No priorities available for test user')

        const name = unique()
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        await authedPage.fill('#modalTodoInput', name)
        await authedPage.locator('#modalPriorityToggle').click()

        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should have the first priority badge
        const badge = todoItem(authedPage, name).locator('.todo-priority-badge')
        await expect(badge).toBeVisible({ timeout: 5000 })
        await expect(badge).toContainText(priority.label)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit modal shows active star when todo has priority', async ({ authedPage }) => {
        const { first: priority } = await getAvailablePriorities(authedPage)
        test.skip(!priority, 'No priorities available for test user')

        const name = unique()
        await addTodo(authedPage, name, { priority: priority.label })
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Star should be active
        await expect(authedPage.locator('#modalPriorityToggle')).toHaveClass(/active/)

        // Close modal
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('edit modal shows inactive star when todo has no priority', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Star should not be active
        await expect(authedPage.locator('#modalPriorityToggle')).not.toHaveClass(/active/)

        // Close modal
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Priority - persistence', () => {
    test('priority persists after page reload', async ({ authedPage }) => {
        const { first: priority } = await getAvailablePriorities(authedPage)
        test.skip(!priority, 'No priorities available for test user')

        const name = unique()
        await addTodo(authedPage, name, { priority: priority.label })

        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-priority-badge')).toContainText(priority.label)

        // Reload page
        await authedPage.reload()
        await authedPage.waitForSelector('.todo-item', { timeout: 15000 })

        // Badge should still be present
        const reloadedItem = todoItem(authedPage, name)
        await expect(reloadedItem).toBeVisible({ timeout: 10000 })
        await expect(reloadedItem.locator('.todo-priority-badge')).toContainText(priority.label)

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
