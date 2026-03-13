import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo } from './helpers/todos.js'

/**
 * Helper: read download content as a UTF-8 string.
 */
async function readDownload(download) {
    const stream = await download.createReadStream()
    return new Promise(resolve => {
        let data = ''
        stream.on('data', chunk => data += chunk)
        stream.on('end', () => resolve(data))
    })
}

test.describe('Export Content Validation', () => {
    test('export modal shows format options', async ({ authedPage }) => {
        // Open export modal
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()

        // Verify format select has all four options
        const options = authedPage.locator('#exportFormatSelect option')
        await expect(options).toHaveCount(4)
        await expect(options.nth(0)).toHaveText('Plain Text (.txt)')
        await expect(options.nth(1)).toHaveText('JSON (.json)')
        await expect(options.nth(2)).toHaveText('CSV (.csv)')
        await expect(options.nth(3)).toHaveText('XML (.xml)')

        // Close modal
        await authedPage.click('#cancelExportModal')
        await expect(authedPage.locator('#exportModal')).not.toBeVisible()
    })

    test('export as Text contains todo text', async ({ authedPage }) => {
        const name = unique('EX')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open export modal and select Text format
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()
        await authedPage.selectOption('#exportFormatSelect', 'text')

        // Intercept the download
        const downloadPromise = authedPage.waitForEvent('download')
        await authedPage.click('#confirmExportBtn')
        const download = await downloadPromise

        // Verify filename ends with .txt
        expect(download.suggestedFilename()).toMatch(/\.txt$/)

        // Verify content contains the todo text and export header
        const content = await readDownload(download)
        expect(content).toContain(name)
        expect(content).toContain('TodoList Export')

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('export as JSON has valid structure', async ({ authedPage }) => {
        const name = unique('EX')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open export modal and select JSON format
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()
        await authedPage.selectOption('#exportFormatSelect', 'json')

        // Intercept the download
        const downloadPromise = authedPage.waitForEvent('download')
        await authedPage.click('#confirmExportBtn')
        const download = await downloadPromise

        // Verify filename ends with .json
        expect(download.suggestedFilename()).toMatch(/\.json$/)

        // Verify content is valid JSON with expected structure
        const content = await readDownload(download)
        const parsed = JSON.parse(content)

        // Verify metadata object exists with expected fields
        expect(parsed.metadata).toBeDefined()
        expect(parsed.metadata).toHaveProperty('view')
        expect(parsed.metadata).toHaveProperty('exportedAt')
        expect(parsed.metadata).toHaveProperty('totalCount')
        expect(parsed.metadata).toHaveProperty('completedCount')

        // Verify todos array exists and contains our todo
        expect(parsed.todos).toBeInstanceOf(Array)
        expect(parsed.todos.length).toBeGreaterThanOrEqual(1)
        const exportedTodo = parsed.todos.find(t => t.text === name)
        expect(exportedTodo).toBeDefined()
        expect(exportedTodo).toHaveProperty('id')
        expect(exportedTodo).toHaveProperty('text')
        expect(exportedTodo).toHaveProperty('completed')
        expect(exportedTodo).toHaveProperty('gtdStatus')

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('export as CSV has headers', async ({ authedPage }) => {
        const name = unique('EX')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open export modal and select CSV format
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()
        await authedPage.selectOption('#exportFormatSelect', 'csv')

        // Intercept the download
        const downloadPromise = authedPage.waitForEvent('download')
        await authedPage.click('#confirmExportBtn')
        const download = await downloadPromise

        // Verify filename ends with .csv
        expect(download.suggestedFilename()).toMatch(/\.csv$/)

        // Verify content has CSV headers on the first line
        const content = await readDownload(download)
        const lines = content.split('\n')
        expect(lines[0]).toContain('ID')
        expect(lines[0]).toContain('Text')
        expect(lines[0]).toContain('Completed')
        expect(lines[0]).toContain('GTD Status')
        expect(lines[0]).toContain('Due Date')
        expect(lines[0]).toContain('Category')
        expect(lines[0]).toContain('Project')
        expect(lines[0]).toContain('Context')
        expect(lines[0]).toContain('Priority')
        expect(lines[0]).toContain('Comment')
        expect(lines[0]).toContain('Created At')

        // Verify the todo text appears in a data row
        expect(content).toContain(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('export as XML has valid structure', async ({ authedPage }) => {
        const name = unique('EX')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open export modal and select XML format
        await authedPage.click('#exportBtn')
        await expect(authedPage.locator('#exportModal')).toBeVisible()
        await authedPage.selectOption('#exportFormatSelect', 'xml')

        // Intercept the download
        const downloadPromise = authedPage.waitForEvent('download')
        await authedPage.click('#confirmExportBtn')
        const download = await downloadPromise

        // Verify filename ends with .xml
        expect(download.suggestedFilename()).toMatch(/\.xml$/)

        // Verify content has valid XML structure
        const content = await readDownload(download)
        expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>')
        expect(content).toContain('<todolist>')
        expect(content).toContain('</todolist>')
        expect(content).toContain('<metadata>')
        expect(content).toContain('</metadata>')
        expect(content).toContain('<todos>')
        expect(content).toContain('</todos>')
        expect(content).toContain('<todo>')
        expect(content).toContain('</todo>')

        // Verify the todo text appears in the XML
        expect(content).toContain(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
