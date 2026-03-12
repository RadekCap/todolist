import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo } from './helpers/todos.js'

/**
 * Helper: select a todo's selection checkbox.
 */
async function selectTodo(page, text) {
    const item = todoItem(page, text)
    await item.locator('.todo-select-checkbox').check()
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
        const names = await createTodos(authedPage, 3)

        // Select one todo first to make the selection bar visible
        await selectTodo(authedPage, names[0])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Click Select All
        await authedPage.click('#selectAllBtn')

        // Verify selection count shows 3
        await expect(authedPage.locator('#selectionCount')).toContainText('3 selected', { timeout: 5000 })

        // Verify selection bar is visible
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Verify all checkboxes are checked
        for (const name of names) {
            await expect(todoItem(authedPage, name).locator('.todo-select-checkbox')).toBeChecked()
        }

        // Cleanup
        await authedPage.click('#clearSelectionBtn')
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

        // Verify checkboxes are unchecked
        for (const name of names) {
            await expect(todoItem(authedPage, name).locator('.todo-select-checkbox')).not.toBeChecked()
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

    test('Clicking a todo checkbox toggles its selection', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 1)
        const checkbox = todoItem(authedPage, names[0]).locator('.todo-select-checkbox')

        // Click to select
        await checkbox.check()
        await expect(checkbox).toBeChecked()
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)
        await expect(authedPage.locator('#selectionCount')).toContainText('1 selected')

        // Click to deselect
        await checkbox.uncheck()
        await expect(checkbox).not.toBeChecked()
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/)

        // Cleanup
        await cleanupTodos(authedPage, names)
    })
})
