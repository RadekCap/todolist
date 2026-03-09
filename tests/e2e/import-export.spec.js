import { test, expect } from './fixtures.js'

const unique = () => `IE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal and return its name.
 */
async function addTodo(page, text) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)
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
 * Helper: delete a todo by text and wait for removal.
 */
async function deleteTodo(page, text) {
    const item = todoItem(page, text)
    if (await item.count() > 0) {
        await item.locator('.delete-btn').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

test.describe('Export', () => {
    test('export modal opens and shows format options', async ({ authedPage }) => {
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()

        // Verify format select has all four options
        const options = authedPage.locator('#exportFormatSelect option')
        await expect(options).toHaveCount(4)
        await expect(options.nth(0)).toHaveText('Plain Text (.txt)')
        await expect(options.nth(1)).toHaveText('JSON (.json)')
        await expect(options.nth(2)).toHaveText('CSV (.csv)')
        await expect(options.nth(3)).toHaveText('XML (.xml)')

        // Verify confirm and cancel buttons are present
        await expect(authedPage.locator('#confirmExportBtn')).toBeVisible()
        await expect(authedPage.locator('#cancelExportModal')).toBeVisible()

        // Close modal
        await authedPage.click('#cancelExportModal')
        await expect(authedPage.locator('#exportModal')).not.toBeVisible()
    })

    test('export as Text format', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open export modal and select Text format
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()
        await authedPage.selectOption('#exportFormatSelect', 'text')

        // Intercept download
        const downloadPromise = authedPage.waitForEvent('download')
        await authedPage.click('#confirmExportBtn')
        const download = await downloadPromise

        // Verify filename ends with .txt
        expect(download.suggestedFilename()).toMatch(/\.txt$/)

        // Verify content contains the todo text
        const content = await (await download.createReadStream()).toArray()
        const text = Buffer.concat(content).toString('utf-8')
        expect(text).toContain(name)
        expect(text).toContain('TodoList Export')

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('export as JSON format', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open export modal and select JSON format
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()
        await authedPage.selectOption('#exportFormatSelect', 'json')

        // Intercept download
        const downloadPromise = authedPage.waitForEvent('download')
        await authedPage.click('#confirmExportBtn')
        const download = await downloadPromise

        // Verify filename ends with .json
        expect(download.suggestedFilename()).toMatch(/\.json$/)

        // Verify content is valid JSON containing the todo
        const content = await (await download.createReadStream()).toArray()
        const text = Buffer.concat(content).toString('utf-8')
        const parsed = JSON.parse(text)
        expect(parsed.metadata).toBeDefined()
        expect(parsed.todos).toBeInstanceOf(Array)
        expect(parsed.todos.some(t => t.text === name)).toBe(true)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('export as CSV format', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open export modal and select CSV format
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()
        await authedPage.selectOption('#exportFormatSelect', 'csv')

        // Intercept download
        const downloadPromise = authedPage.waitForEvent('download')
        await authedPage.click('#confirmExportBtn')
        const download = await downloadPromise

        // Verify filename ends with .csv
        expect(download.suggestedFilename()).toMatch(/\.csv$/)

        // Verify content has CSV header and todo text
        const content = await (await download.createReadStream()).toArray()
        const text = Buffer.concat(content).toString('utf-8')
        expect(text).toContain('ID,Text,Completed,GTD Status')
        expect(text).toContain(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('export as XML format', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open export modal and select XML format
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()
        await authedPage.selectOption('#exportFormatSelect', 'xml')

        // Intercept download
        const downloadPromise = authedPage.waitForEvent('download')
        await authedPage.click('#confirmExportBtn')
        const download = await downloadPromise

        // Verify filename ends with .xml
        expect(download.suggestedFilename()).toMatch(/\.xml$/)

        // Verify content is XML with todo data
        const content = await (await download.createReadStream()).toArray()
        const text = Buffer.concat(content).toString('utf-8')
        expect(text).toContain('<?xml version="1.0"')
        expect(text).toContain('<todolist>')
        expect(text).toContain(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Import', () => {
    test('import modal opens and accepts text input', async ({ authedPage }) => {
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Verify textarea and submit button are present
        await expect(authedPage.locator('#importTextarea')).toBeVisible()
        await expect(authedPage.locator('#importBtn')).toBeVisible()

        // Close modal
        await authedPage.click('#cancelImportModal')
        await expect(authedPage.locator('#importModal')).not.toBeVisible()
    })

    test('import todos from text input', async ({ authedPage }) => {
        const todo1 = unique()
        const todo2 = unique()
        const todo3 = unique()

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Enter todos (one per line)
        await authedPage.fill('#importTextarea', `${todo1}\n${todo2}\n${todo3}`)

        // Submit import
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // All three todos should appear in the list
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo3)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
        await deleteTodo(authedPage, todo3)
    })

    test('imported todos appear in the list after import', async ({ authedPage }) => {
        const name = unique()

        // Open import modal and add a single todo
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()
        await authedPage.fill('#importTextarea', name)
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Verify the imported todo is visible and has correct text
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
