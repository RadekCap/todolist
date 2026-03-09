import { test, expect } from './fixtures.js'

const unique = () => `RecAdv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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

/**
 * Helper: add a recurring todo via the modal with advanced options.
 */
async function addRecurringTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.dueDate) {
        await page.fill('#modalDueDateInput', opts.dueDate)
    }

    if (opts.recurrence) {
        await page.click('.modal-tab[data-tab="repeat"]')
        await expect(page.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })

        await page.selectOption('#modalRepeatSelect', opts.recurrence)
        await page.waitForTimeout(300)

        // Monthly-specific options
        if (opts.ordinal) {
            await page.selectOption('#recurrenceOrdinal', opts.ordinal)
        }
        if (opts.dayType) {
            await page.selectOption('#recurrenceDayType', opts.dayType)
        }
        if (opts.weekday) {
            await page.selectOption('#recurrenceWeekday', opts.weekday)
        }

        // Yearly-specific options
        if (opts.month) {
            await page.selectOption('#recurrenceMonth', opts.month)
        }

        // End conditions
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
    }

    await page.click('#addTodoForm button[type="submit"]')
    await expect(page.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
}

test.describe('Advanced Recurring Tasks', () => {
    test('create a monthly recurring task', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'monthly'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Verify recurrence icon is shown
        await expect(item.locator('.recurrence-icon')).toBeVisible()

        // Open edit modal and verify recurrence settings
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })

        await expect(authedPage.locator('#modalRepeatSelect')).toHaveValue('monthly')

        // Monthly options should be visible
        await expect(authedPage.locator('#monthlyOptions')).toBeVisible()

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('create a yearly recurring task', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'yearly'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Verify recurrence icon
        await expect(item.locator('.recurrence-icon')).toBeVisible()

        // Open edit modal and verify
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })

        await expect(authedPage.locator('#modalRepeatSelect')).toHaveValue('yearly')

        // Yearly-specific options should be visible
        await expect(authedPage.locator('#yearlyOptions')).toBeVisible()
        await expect(authedPage.locator('#monthlyOptions')).toBeVisible()

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('monthly recurrence with ordinal day type', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        // Create "2nd weekday of every month"
        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'monthly',
            ordinal: '2',
            dayType: 'weekday'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Verify recurrence icon
        await expect(item.locator('.recurrence-icon')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('recurrence end after N occurrences', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily',
            endType: 'after_count',
            endCount: 3
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Open edit modal and verify end condition
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })

        await expect(authedPage.locator('#recurrenceEndType')).toHaveValue('after_count')
        await expect(authedPage.locator('#recurrenceEndCount')).toHaveValue('3')

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('convert a non-recurring todo to recurring', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        // Create a normal (non-recurring) todo with a due date
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.fill('#modalTodoInput', name)
        await authedPage.fill('#modalDueDateInput', dueDate)
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // It should appear in Scheduled
        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Should NOT have recurrence icon
        await expect(item.locator('.recurrence-icon')).not.toBeVisible()

        // Edit todo and add recurrence
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })

        await authedPage.selectOption('#modalRepeatSelect', 'weekly')
        await authedPage.waitForTimeout(300)

        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Now it should have a recurrence icon
        await expect(item.locator('.recurrence-icon')).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('recurrence preview shows upcoming dates', async ({ authedPage }) => {
        const dueDate = getTomorrowDate()

        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.fill('#modalTodoInput', 'preview-test')
        await authedPage.fill('#modalDueDateInput', dueDate)

        // Switch to Repeat tab
        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })

        // Select daily recurrence
        await authedPage.selectOption('#modalRepeatSelect', 'daily')
        await authedPage.waitForTimeout(500)

        // Preview list should show upcoming dates
        const previewItems = authedPage.locator('#recurrencePreviewList li')
        const count = await previewItems.count()
        expect(count).toBeGreaterThan(0)

        // Close without saving
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('weekday recurrence pattern', async ({ authedPage }) => {
        const name = unique()
        const dueDate = getTomorrowDate()

        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'weekdays'
        })

        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Open edit and verify weekdays pattern
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })

        await expect(authedPage.locator('#modalRepeatSelect')).toHaveValue('weekdays')

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
