import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo } from './helpers/todos.js'

/**
 * Helper: select a todo via Ctrl+click.
 */
async function selectTodo(page, text) {
    const item = todoItem(page, text)
    await item.click({ modifiers: ['Control'] })
}

/**
 * Helper: create multiple todos and return their names.
 */
async function createTodos(page, count, prefix = 'SL') {
    const names = []
    for (let i = 0; i < count; i++) {
        const name = unique(prefix)
        await addTodo(page, name)
        await expect(todoItem(page, name)).toBeVisible({ timeout: 5000 })
        names.push(name)
    }
    return names
}

/**
 * Helper: cleanup multiple todos.
 */
async function cleanupTodos(page, names) {
    for (const name of names) {
        await deleteTodo(page, name)
    }
}

test.describe('Todo Selection Logic', () => {
    test('Select All button selects all visible todos', async ({ authedPage }) => {
        // Use a unique prefix and search filter to isolate test todos
        const prefix = unique('SLAll')
        const names = []
        for (let i = 0; i < 3; i++) {
            const name = `${prefix}-${i}`
            await addTodo(authedPage, name)
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })
            names.push(name)
        }

        // Filter to only show our test todos
        await authedPage.fill('#searchInput', prefix)
        for (const name of names) {
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })
        }

        // Select one todo first to make the selection bar visible
        await selectTodo(authedPage, names[0])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Click Select All
        await authedPage.click('#selectAllBtn')

        // Verify selection count shows 3
        await expect(authedPage.locator('#selectionCount')).toContainText('3 selected', { timeout: 5000 })

        // Verify selection bar is visible
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Verify all items are selected
        for (const name of names) {
            await expect(todoItem(authedPage, name)).toHaveClass(/selected/)
        }

        // Cleanup
        await authedPage.click('#clearSelectionBtn')
        await authedPage.fill('#searchInput', '')
        await cleanupTodos(authedPage, names)
    })

    test('Select All with search filter selects only filtered results', async ({ authedPage }) => {
        // Create todos with two different prefixes
        const matchPrefix = unique('SLMatch')
        const noMatchPrefix = unique('SLOther')

        const matchNames = []
        for (let i = 0; i < 2; i++) {
            const name = `${matchPrefix}-${i}`
            await addTodo(authedPage, name)
            await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })
            matchNames.push(name)
        }

        const noMatchName = noMatchPrefix
        await addTodo(authedPage, noMatchName)
        await expect(todoItem(authedPage, noMatchName)).toBeVisible({ timeout: 5000 })

        // Search for the matching prefix to filter
        await authedPage.fill('#searchInput', matchPrefix)

        // Wait for the non-matching todo to be hidden
        await expect(todoItem(authedPage, noMatchName)).not.toBeVisible({ timeout: 5000 })

        // Verify matching todos are still visible
        for (const name of matchNames) {
            await expect(todoItem(authedPage, name)).toBeVisible()
        }

        // Select one to make the selection bar visible
        await selectTodo(authedPage, matchNames[0])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Click Select All
        await authedPage.click('#selectAllBtn')

        // Verify only matching todos are selected (count = 2)
        await expect(authedPage.locator('#selectionCount')).toContainText('2 selected', { timeout: 5000 })

        // Cleanup: clear search and selection, then delete
        await authedPage.click('#clearSelectionBtn')
        await authedPage.fill('#searchInput', '')
        await expect(todoItem(authedPage, noMatchName)).toBeVisible({ timeout: 5000 })
        await cleanupTodos(authedPage, [...matchNames, noMatchName])
    })

    test('Clear selection button deselects all', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both todos
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)
        await expect(authedPage.locator('#selectionCount')).toContainText('2 selected')

        // Click Clear Selection
        await authedPage.click('#clearSelectionBtn')

        // Verify selection bar hides
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/)

        // Verify items are not selected
        for (const name of names) {
            await expect(todoItem(authedPage, name)).not.toHaveClass(/selected/)
        }

        // Cleanup
        await cleanupTodos(authedPage, names)
    })

    test('Selection count badge updates correctly', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 3)

        // Click checkbox on first todo
        await selectTodo(authedPage, names[0])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)
        await expect(authedPage.locator('#selectionCount')).toContainText('1 selected')

        // Click checkbox on second todo
        await selectTodo(authedPage, names[1])
        await expect(authedPage.locator('#selectionCount')).toContainText('2 selected')

        // Click checkbox on third todo
        await selectTodo(authedPage, names[2])
        await expect(authedPage.locator('#selectionCount')).toContainText('3 selected')

        // Cleanup
        await authedPage.click('#clearSelectionBtn')
        await cleanupTodos(authedPage, names)
    })

    test('Ctrl+clicking a todo toggles its selection', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 1)
        const item = todoItem(authedPage, names[0])

        // Ctrl+click to select
        await item.click({ modifiers: ['Control'] })
        await expect(item).toHaveClass(/selected/)
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)
        await expect(authedPage.locator('#selectionCount')).toContainText('1 selected')

        // Ctrl+click to deselect
        await item.click({ modifiers: ['Control'] })
        await expect(item).not.toHaveClass(/selected/)
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/)

        // Cleanup
        await cleanupTodos(authedPage, names)
    })
})
