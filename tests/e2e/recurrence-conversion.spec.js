import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo, switchGtdTab } from './helpers/todos.js'

/**
 * Helper: get tomorrow's date as YYYY-MM-DD.
 */
function getTomorrowDate() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
}

/**
 * Helper: add a recurring todo via the modal.
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

        // Wait for the recurrence options to become visible
        await expect(page.locator('#recurrenceOptions')).toBeVisible({ timeout: 3000 })

        if (opts.endType) {
            await page.selectOption('#recurrenceEndType', opts.endType)
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

test.describe('Recurring Todo Conversion', () => {
    test('convert existing regular todo to recurring', async ({ authedPage }) => {
        const name = unique('RC')
        const dueDate = getTomorrowDate()

        // Create a regular (non-recurring) todo with a due date
        await addTodo(authedPage, name, { dueDate })

        // Todo with due date appears in the Scheduled tab
        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Verify it does NOT have a recurrence icon yet
        await expect(item.locator('.recurring-icon')).not.toBeVisible()

        // Open edit modal by clicking the todo text
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Switch to the Repeat tab
        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })

        // Set daily recurrence
        await authedPage.selectOption('#modalRepeatSelect', 'daily')
        await expect(authedPage.locator('#recurrenceOptions')).toBeVisible({ timeout: 3000 })

        // Save changes
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify the todo now shows a recurrence icon
        await expect(item.locator('.recurring-icon')).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('completing a recurring instance generates next occurrence', async ({ authedPage }) => {
        const name = unique('RC')
        const dueDate = getTomorrowDate()

        // Create a recurring daily todo
        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily'
        })

        // Navigate to Scheduled tab where recurring todos appear
        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Complete the recurring task by checking its checkbox
        await item.locator('.todo-checkbox').check()

        // A new instance with the same name should appear in Scheduled
        // (the completed one moved to Done, the new one stays in Scheduled)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup: delete the new occurrence from Scheduled
        await deleteTodo(authedPage, name)

        // Also clean up the completed instance from Done tab
        await switchGtdTab(authedPage, 'done')
        await deleteTodo(authedPage, name)
    })

    test('update recurrence rule on existing recurring todo', async ({ authedPage }) => {
        const name = unique('RC')
        const dueDate = getTomorrowDate()

        // Create a recurring daily todo
        await addRecurringTodo(authedPage, name, {
            dueDate,
            recurrence: 'daily'
        })

        // Navigate to Scheduled tab
        await switchGtdTab(authedPage, 'scheduled')
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Open edit modal
        await item.locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Switch to the Repeat tab and change recurrence to weekly
        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })
        await authedPage.selectOption('#modalRepeatSelect', 'weekly')
        await expect(authedPage.locator('#recurrenceOptions')).toBeVisible({ timeout: 3000 })

        // Save changes
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Verify the todo still exists
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Reopen edit modal to verify the change persisted
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        // Switch to Repeat tab and verify weekly is selected
        await authedPage.click('.modal-tab[data-tab="repeat"]')
        await expect(authedPage.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })
        await expect(authedPage.locator('#modalRepeatSelect')).toHaveValue('weekly')

        // Close the modal
        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
