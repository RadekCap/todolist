import { test, expect } from './fixtures.js'

const unique = () => `RUI-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: open add todo modal and switch to Repeat tab.
 */
async function openRepeatTab(page) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.click('.modal-tab[data-tab="repeat"]')
    await expect(page.locator('.modal-tab-panel[data-panel="repeat"]')).toHaveClass(/active/, { timeout: 3000 })
}

test.describe('Recurrence Interval', () => {
    test('interval input appears when recurrence is selected', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.selectOption('#modalRepeatSelect', 'daily')
        await authedPage.waitForTimeout(300)

        await expect(authedPage.locator('#recurrenceInterval')).toBeVisible()
        await expect(authedPage.locator('#recurrenceIntervalLabel')).toBeVisible()
        await expect(authedPage.locator('#recurrenceIntervalLabel')).toHaveText('day(s)')

        await authedPage.keyboard.press('Escape')
    })

    test('interval label changes based on recurrence type', async ({ authedPage }) => {
        await openRepeatTab(authedPage)

        // Daily
        await authedPage.selectOption('#modalRepeatSelect', 'daily')
        await authedPage.waitForTimeout(300)
        await expect(authedPage.locator('#recurrenceIntervalLabel')).toHaveText('day(s)')

        // Weekly
        await authedPage.selectOption('#modalRepeatSelect', 'weekly')
        await authedPage.waitForTimeout(300)
        await expect(authedPage.locator('#recurrenceIntervalLabel')).toHaveText('week(s)')

        // Monthly
        await authedPage.selectOption('#modalRepeatSelect', 'monthly')
        await authedPage.waitForTimeout(300)
        await expect(authedPage.locator('#recurrenceIntervalLabel')).toHaveText('month(s)')

        // Yearly
        await authedPage.selectOption('#modalRepeatSelect', 'yearly')
        await authedPage.waitForTimeout(300)
        await expect(authedPage.locator('#recurrenceIntervalLabel')).toHaveText('year(s)')

        await authedPage.keyboard.press('Escape')
    })

    test('custom interval value can be set', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.fill('#modalTodoInput', 'interval-test')
        await authedPage.fill('#modalDueDateInput', getTomorrowDate())
        await authedPage.selectOption('#modalRepeatSelect', 'daily')
        await authedPage.waitForTimeout(300)

        // Set interval to 3 (every 3 days)
        await authedPage.fill('#recurrenceInterval', '3')
        await expect(authedPage.locator('#recurrenceInterval')).toHaveValue('3')

        await authedPage.keyboard.press('Escape')
    })

    test('recurrence options hide when "none" is selected', async ({ authedPage }) => {
        await openRepeatTab(authedPage)

        // Select daily to show options
        await authedPage.selectOption('#modalRepeatSelect', 'daily')
        await authedPage.waitForTimeout(300)
        await expect(authedPage.locator('#recurrenceOptions')).toBeVisible()

        // Switch back to none
        await authedPage.selectOption('#modalRepeatSelect', 'none')
        await authedPage.waitForTimeout(300)
        await expect(authedPage.locator('#recurrenceOptions')).not.toBeVisible()

        await authedPage.keyboard.press('Escape')
    })
})

test.describe('Weekly Weekday Checkboxes', () => {
    test('weekday checkboxes appear for weekly recurrence', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.selectOption('#modalRepeatSelect', 'weekly')
        await authedPage.waitForTimeout(300)

        await expect(authedPage.locator('#weekdayOptions')).toBeVisible()
        // Should have 7 checkboxes (Mon-Sun)
        const checkboxes = authedPage.locator('input[name="weekday"]')
        await expect(checkboxes).toHaveCount(7)

        await authedPage.keyboard.press('Escape')
    })

    test('weekday checkboxes are hidden for daily recurrence', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.selectOption('#modalRepeatSelect', 'daily')
        await authedPage.waitForTimeout(300)

        await expect(authedPage.locator('#weekdayOptions')).not.toBeVisible()

        await authedPage.keyboard.press('Escape')
    })

    test('weekdays preset auto-selects Mon-Fri', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.selectOption('#modalRepeatSelect', 'weekdays')
        await authedPage.waitForTimeout(300)

        // Mon(1), Tue(2), Wed(3), Thu(4), Fri(5) should be checked
        for (const day of ['1', '2', '3', '4', '5']) {
            await expect(authedPage.locator(`input[name="weekday"][value="${day}"]`)).toBeChecked()
        }
        // Sat(6), Sun(0) should not be checked
        await expect(authedPage.locator('input[name="weekday"][value="6"]')).not.toBeChecked()
        await expect(authedPage.locator('input[name="weekday"][value="0"]')).not.toBeChecked()

        await authedPage.keyboard.press('Escape')
    })

    test('weekends preset auto-selects Sat-Sun', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.selectOption('#modalRepeatSelect', 'weekends')
        await authedPage.waitForTimeout(300)

        // Sat(6), Sun(0) should be checked
        await expect(authedPage.locator('input[name="weekday"][value="6"]')).toBeChecked()
        await expect(authedPage.locator('input[name="weekday"][value="0"]')).toBeChecked()

        // Weekdays should not be checked
        for (const day of ['1', '2', '3', '4', '5']) {
            await expect(authedPage.locator(`input[name="weekday"][value="${day}"]`)).not.toBeChecked()
        }

        await authedPage.keyboard.press('Escape')
    })

    test('individual weekday can be toggled', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.selectOption('#modalRepeatSelect', 'weekly')
        await authedPage.waitForTimeout(300)

        const mondayCheckbox = authedPage.locator('input[name="weekday"][value="1"]')

        // Toggle Monday on
        await mondayCheckbox.check()
        await expect(mondayCheckbox).toBeChecked()

        // Toggle Monday off
        await mondayCheckbox.uncheck()
        await expect(mondayCheckbox).not.toBeChecked()

        await authedPage.keyboard.press('Escape')
    })
})

test.describe('Monthly Options', () => {
    test('monthly options appear for monthly recurrence', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.selectOption('#modalRepeatSelect', 'monthly')
        await authedPage.waitForTimeout(300)

        await expect(authedPage.locator('#monthlyOptions')).toBeVisible()
        await expect(authedPage.locator('#recurrenceOrdinal')).toBeVisible()
        await expect(authedPage.locator('#recurrenceDayType')).toBeVisible()

        await authedPage.keyboard.press('Escape')
    })

    test('weekday select appears when day type is "weekday"', async ({ authedPage }) => {
        await openRepeatTab(authedPage)
        await authedPage.selectOption('#modalRepeatSelect', 'monthly')
        await authedPage.waitForTimeout(300)

        // Select "weekday" as day type
        await authedPage.selectOption('#recurrenceDayType', 'weekday')
        await authedPage.waitForTimeout(300)

        await expect(authedPage.locator('#weekdaySelect')).toBeVisible()
        await expect(authedPage.locator('#recurrenceWeekday')).toBeVisible()

        // Switch back to "day of month" — weekday select should hide
        await authedPage.selectOption('#recurrenceDayType', 'day_of_month')
        await authedPage.waitForTimeout(300)
        await expect(authedPage.locator('#weekdaySelect')).not.toBeVisible()

        await authedPage.keyboard.press('Escape')
    })
})

test.describe('GTD Guide Modal', () => {
    test('GTD guide opens from user menu and has content', async ({ authedPage }) => {
        await authedPage.click('#toolbarUserBtn')
        await expect(authedPage.locator('#toolbarDropdown')).toBeVisible({ timeout: 3000 })
        await authedPage.click('#gtdGuideBtn')

        await expect(authedPage.locator('#gtdGuideModal')).toHaveClass(/active/, { timeout: 5000 })

        // Should have title
        await expect(authedPage.locator('#gtdGuideModalTitle')).toBeVisible()

        // Should have content
        const content = authedPage.locator('#gtdGuideContent')
        await expect(content).toBeVisible()
        const text = await content.textContent()
        expect(text.length).toBeGreaterThan(50)

        // Close
        await authedPage.click('#closeGtdGuideModalBtn')
        await expect(authedPage.locator('#gtdGuideModal')).not.toHaveClass(/active/, { timeout: 5000 })
    })
})

test.describe('Modal Escape Handling', () => {
    test('Escape closes the add todo modal', async ({ authedPage }) => {
        await authedPage.click('#openAddTodoModal')
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('Escape closes the export modal', async ({ authedPage }) => {
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#exportModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('Escape closes the import modal', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('Escape closes the manage projects modal', async ({ authedPage }) => {
        await authedPage.click('#manageProjectsBtn')
        await expect(authedPage.locator('#manageProjectsModal')).toBeVisible({ timeout: 5000 })

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#manageProjectsModal')).not.toBeVisible({ timeout: 5000 })
    })

    test('Escape closes the settings modal', async ({ authedPage }) => {
        await authedPage.click('#toolbarUserBtn')
        await expect(authedPage.locator('#toolbarDropdown')).toBeVisible({ timeout: 3000 })
        await authedPage.click('#settingsBtn')
        await expect(authedPage.locator('#settingsModal')).toHaveClass(/active/, { timeout: 5000 })

        await authedPage.keyboard.press('Escape')
        await expect(authedPage.locator('#settingsModal')).not.toHaveClass(/active/, { timeout: 5000 })
    })
})
