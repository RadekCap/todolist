import { test, expect } from './fixtures.js'

const unique = () => `Sched-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.dueDate) {
        await page.fill('#modalDueDateInput', opts.dueDate)
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
 * Helper: get a date string in YYYY-MM-DD format.
 */
function getDateOffset(daysFromNow) {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    return d.toISOString().split('T')[0]
}

test.describe('Scheduled View - Date Grouping', () => {
    test('today section header appears for todos due today', async ({ authedPage }) => {
        const name = unique()
        const today = getDateOffset(0)

        await addTodo(authedPage, name, { dueDate: today })

        await switchGtdTab(authedPage, 'scheduled')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // "Today" section header should be present
        await expect(authedPage.locator('li.scheduled-section-header.today')).toBeVisible()
        await expect(authedPage.locator('li.scheduled-section-header.today .section-header-text')).toContainText('Today')

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('tomorrow section header appears for todos due tomorrow', async ({ authedPage }) => {
        const name = unique()
        const tomorrow = getDateOffset(1)

        await addTodo(authedPage, name, { dueDate: tomorrow })

        await switchGtdTab(authedPage, 'scheduled')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // "Tomorrow" section header should be present
        await expect(authedPage.locator('li.scheduled-section-header.tomorrow')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('overdue section header appears for past due todos', async ({ authedPage }) => {
        const name = unique()
        const yesterday = getDateOffset(-1)

        await addTodo(authedPage, name, { dueDate: yesterday })

        await switchGtdTab(authedPage, 'scheduled')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // "Overdue" section header should be present
        await expect(authedPage.locator('li.scheduled-section-header.overdue')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('later section header appears for far future todos', async ({ authedPage }) => {
        const name = unique()
        const farFuture = getDateOffset(30)

        await addTodo(authedPage, name, { dueDate: farFuture })

        await switchGtdTab(authedPage, 'scheduled')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // "Later" or "Next Week" section header should be present (depends on day of week)
        const laterHeader = authedPage.locator('li.scheduled-section-header.later')
        const nextWeekHeader = authedPage.locator('li.scheduled-section-header.next-week')
        const hasLater = await laterHeader.count() > 0
        const hasNextWeek = await nextWeekHeader.count() > 0
        expect(hasLater || hasNextWeek).toBe(true)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('multiple date groups appear together', async ({ authedPage }) => {
        const todayName = unique()
        const tomorrowName = unique()
        const today = getDateOffset(0)
        const tomorrow = getDateOffset(1)

        await addTodo(authedPage, todayName, { dueDate: today })
        await addTodo(authedPage, tomorrowName, { dueDate: tomorrow })

        await switchGtdTab(authedPage, 'scheduled')
        await expect(todoItem(authedPage, todayName)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, tomorrowName)).toBeVisible({ timeout: 5000 })

        // Both section headers should be present
        await expect(authedPage.locator('li.scheduled-section-header.today')).toBeVisible()
        await expect(authedPage.locator('li.scheduled-section-header.tomorrow')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, todayName)
        await deleteTodo(authedPage, tomorrowName)
    })
})
