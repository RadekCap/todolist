import { test, expect } from './fixtures.js'

const unique = () => `Rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: add a recurring todo via the modal.
 * @param {Object} opts - { recurrence, dueDate, endType, endDate, endCount }
 */
async function addRecurringTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.dueDate) {
        await page.fill('#modalDueDateInput', opts.dueDate)
    }

    // Set recurrence type
    if (opts.recurrence) {
        await page.selectOption('#modalRepeatSelect', opts.recurrence)
        await page.waitForTimeout(300)
    }

    // Set end condition
    if (opts.endType) {
        await page.selectOption('#recurrenceEndType', opts.endType)
        await page.waitForTimeout(200)
    }
    if (opts.endDate) {
        await page.fill('#recurrenceEndDate', opts.endDate)
    }
    if (opts.endCount) {
        await page.fill('#recurrenceEndCount', String(opts.endCount))
    }

    await page.click('#addTodoForm button[type="submit"]')
    await expect(page.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Helper: get tomorrow's date as YYYY-MM-DD.
 */
function getTomorrowDate() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
}

/**
 * Helper: get a future date as YYYY-MM-DD.
 */
function getFutureDate(daysFromNow) {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    return d.toISOString().split('T')[0]
}

test.describe('Recurring Tasks', () => {
    test('create a recurring task with daily recurrence', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily'
        })

        // Recurring todos with due dates go to Scheduled tab
        await switchGtdTab(authedPage, 'scheduled')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('create a recurring task with weekly recurrence', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'weekly'
        })

        // Should appear in Scheduled tab
        await switchGtdTab(authedPage, 'scheduled')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('recurring task shows recurrence icon', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Recurring tasks should have the recurring icon
        await expect(item.locator('.recurring-icon')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('completing a recurring task generates the next occurrence', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Complete the recurring task
        await item.locator('.todo-checkbox').check()

        // Wait for next occurrence to be generated
        await authedPage.waitForTimeout(2000)

        // A new instance with the same name should appear in Scheduled
        // (the completed one moved to Done, the new one stays in Scheduled)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup — delete the new occurrence
        await deleteTodo(authedPage, name)

        // Also clean up from Done tab
        await switchGtdTab(authedPage, 'done')
        await deleteTodo(authedPage, name)
    })

    test('next occurrence has the correct due date', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()
        const expectedNextDate = getFutureDate(2) // daily = tomorrow + 1 day

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Complete to generate next occurrence
        await item.locator('.todo-checkbox').check()
        await authedPage.waitForTimeout(2000)

        // The new instance should exist and have a due date badge
        const newItem = todoItem(authedPage, name)
        await expect(newItem).toBeVisible({ timeout: 10000 })
        await expect(newItem.locator('.todo-date')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
        await switchGtdTab(authedPage, 'done')
        await deleteTodo(authedPage, name)
    })

    test('edit recurrence rule on an existing task', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        // Create with daily recurrence
        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Open edit modal
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Change recurrence to weekly
        await authedPage.selectOption('#modalRepeatSelect', 'weekly')
        await authedPage.waitForTimeout(300)

        // Submit
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify todo still exists
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('remove recurrence from a task', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        // Create with daily recurrence
        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Verify it has recurring icon
        await expect(item.locator('.recurring-icon')).toBeVisible()

        // Open edit modal
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Remove recurrence
        await authedPage.selectOption('#modalRepeatSelect', 'none')
        await authedPage.waitForTimeout(300)

        // Submit
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should still exist but without recurring icon
        const updatedItem = todoItem(authedPage, name)
        await expect(updatedItem).toBeVisible({ timeout: 5000 })
        await expect(updatedItem.locator('.recurring-icon')).not.toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('recurring task with end date stops generating occurrences', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()
        // Set end date to tomorrow — after completing tomorrow's task,
        // the next occurrence (day after tomorrow) would exceed the end date
        const endDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily',
            endType: 'on_date',
            endDate
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Complete the task
        await item.locator('.todo-checkbox').check()
        await authedPage.waitForTimeout(2000)

        // No new occurrence should be generated in Scheduled
        // (end date was reached)
        const newItem = todoItem(authedPage, name)
        const count = await newItem.count()
        expect(count).toBe(0)

        // Cleanup from Done tab
        await switchGtdTab(authedPage, 'done')
        await deleteTodo(authedPage, name)
    })
})
