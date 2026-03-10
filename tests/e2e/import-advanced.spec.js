import { test, expect } from './fixtures.js'

const unique = () => `IA-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: get the first available option (non-empty value) from a select.
 */
async function getFirstOption(page, selectId) {
    const options = page.locator(`#${selectId} option`)
    const count = await options.count()
    for (let i = 0; i < count; i++) {
        const value = await options.nth(i).getAttribute('value')
        if (value && value !== '') {
            const label = await options.nth(i).textContent()
            return { value, label }
        }
    }
    return null
}

test.describe('Import with Category, Context, and Priority Defaults', () => {
    test('import modal shows category, context, and priority selects', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        await expect(authedPage.locator('#importCategorySelect')).toBeVisible()
        await expect(authedPage.locator('#importContextSelect')).toBeVisible()
        await expect(authedPage.locator('#importPrioritySelect')).toBeVisible()

        await authedPage.click('#cancelImportModal')
        await expect(authedPage.locator('#importModal')).not.toBeVisible()
    })

    test('import with category default assigns category to imported todos', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        const category = await getFirstOption(authedPage, 'importCategorySelect')
        if (!category) {
            await authedPage.click('#cancelImportModal')
            test.skip('No categories available')
            return
        }

        const todoName = unique()
        await authedPage.selectOption('#importCategorySelect', category.value)
        await authedPage.fill('#importTextarea', todoName)
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should appear with a category badge
        const item = todoItem(authedPage, todoName)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-category-badge')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })

    test('import with context default assigns context to imported todos', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        const context = await getFirstOption(authedPage, 'importContextSelect')
        if (!context) {
            await authedPage.click('#cancelImportModal')
            test.skip('No contexts available')
            return
        }

        const todoName = unique()
        await authedPage.selectOption('#importContextSelect', context.value)
        await authedPage.fill('#importTextarea', todoName)
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should appear with a context badge
        const item = todoItem(authedPage, todoName)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-context-badge')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })

    test('import with priority default assigns priority to imported todos', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        const priority = await getFirstOption(authedPage, 'importPrioritySelect')
        if (!priority) {
            await authedPage.click('#cancelImportModal')
            test.skip('No priorities available')
            return
        }

        const todoName = unique()
        await authedPage.selectOption('#importPrioritySelect', priority.value)
        await authedPage.fill('#importTextarea', todoName)
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should appear with a priority badge
        const item = todoItem(authedPage, todoName)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-priority-badge')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })

    test('import with multiple defaults applies all at once', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        const category = await getFirstOption(authedPage, 'importCategorySelect')
        const context = await getFirstOption(authedPage, 'importContextSelect')

        if (!category || !context) {
            await authedPage.click('#cancelImportModal')
            test.skip('Need both categories and contexts available')
            return
        }

        const todoName = unique()
        await authedPage.selectOption('#importCategorySelect', category.value)
        await authedPage.selectOption('#importContextSelect', context.value)
        await authedPage.selectOption('#importGtdStatusSelect', 'next_action')
        await authedPage.fill('#importTextarea', todoName)
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Switch to Next tab where the todo should appear
        await authedPage.click('.gtd-tab.next_action')
        await authedPage.waitForTimeout(500)

        const item = todoItem(authedPage, todoName)
        await expect(item).toBeVisible({ timeout: 5000 })

        // Should have both category and context badges
        await expect(item.locator('.todo-category-badge')).toBeVisible()
        await expect(item.locator('.todo-context-badge')).toBeVisible()

        // Cleanup
        await deleteTodo(authedPage, todoName)
    })

    test('import defaults reset when modal is reopened', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        const category = await getFirstOption(authedPage, 'importCategorySelect')
        if (category) {
            await authedPage.selectOption('#importCategorySelect', category.value)
        }

        // Close without importing
        await authedPage.click('#cancelImportModal')
        await expect(authedPage.locator('#importModal')).not.toBeVisible()

        // Reopen — selects should be reset to empty
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        const categoryValue = await authedPage.locator('#importCategorySelect').inputValue()
        expect(categoryValue).toBe('')

        const contextValue = await authedPage.locator('#importContextSelect').inputValue()
        expect(contextValue).toBe('')

        const priorityValue = await authedPage.locator('#importPrioritySelect').inputValue()
        expect(priorityValue).toBe('')

        await authedPage.click('#cancelImportModal')
        await expect(authedPage.locator('#importModal')).not.toBeVisible()
    })
})

test.describe('Version Number', () => {
    test('version number is displayed in the app', async ({ authedPage }) => {
        const versionEl = authedPage.locator('#versionNumber')
        await expect(versionEl).toBeAttached()

        const versionText = await versionEl.textContent()
        // Version should match semver pattern (e.g. 2.2.58)
        expect(versionText).toMatch(/^\d+\.\d+\.\d+$/)
    })
})
