import { test, expect } from './fixtures.js'

const unique = () => `IE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: delete a project from the sidebar.
 */
async function deleteProject(page, name) {
    const item = page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
    if (await item.count() > 0) {
        page.once('dialog', dialog => dialog.accept())
        await item.locator('.project-delete').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

test.describe('Import Edge Cases', () => {
    test('import with special characters', async ({ authedPage }) => {
        const prefix = unique()
        const specialText = `${prefix} with "quotes" & <brackets>`

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Enter todo with special characters
        await authedPage.fill('#importTextarea', specialText)

        // Submit import
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Verify the todo appears with correct text (escaped properly)
        const item = todoItem(authedPage, prefix)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-text')).toContainText('"quotes"')
        await expect(item.locator('.todo-text')).toContainText('& <brackets>')

        // Cleanup
        await deleteTodo(authedPage, prefix)
    })

    test('import skips empty lines', async ({ authedPage }) => {
        const todo1 = unique()
        const todo2 = unique()

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Enter text with empty lines between todos
        await authedPage.fill('#importTextarea', `${todo1}\n\n\n${todo2}`)

        // Submit import
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Verify exactly 2 todos created
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).toBeVisible({ timeout: 5000 })

        // Verify no extra todos were created from empty lines
        // Count all todo items containing our unique prefix
        const allItems = authedPage.locator('.todo-item', { has: authedPage.locator('.todo-text', { hasText: 'IE-' }) })
        const count = await allItems.count()
        // We should have at most our 2 todos (there may be other IE- todos from other tests)
        await expect(todoItem(authedPage, todo1)).toHaveCount(1)
        await expect(todoItem(authedPage, todo2)).toHaveCount(1)

        // Cleanup
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
    })

    test('import skips whitespace-only lines', async ({ authedPage }) => {
        const todo1 = unique()
        const todo2 = unique()

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Enter text with whitespace-only lines between todos
        await authedPage.fill('#importTextarea', `${todo1}\n   \n${todo2}`)

        // Submit import
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Verify exactly 2 todos created
        await expect(todoItem(authedPage, todo1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, todo2)).toBeVisible({ timeout: 5000 })

        // Verify each todo appears exactly once (no extra whitespace-only todos)
        await expect(todoItem(authedPage, todo1)).toHaveCount(1)
        await expect(todoItem(authedPage, todo2)).toHaveCount(1)

        // Cleanup
        await deleteTodo(authedPage, todo1)
        await deleteTodo(authedPage, todo2)
    })

    test('import multiple todos at once', async ({ authedPage }) => {
        const todos = Array.from({ length: 5 }, () => unique())

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Enter 5 todos, one per line
        await authedPage.fill('#importTextarea', todos.join('\n'))

        // Submit import
        await authedPage.click('#importBtn')
        await expect(authedPage.locator('#importModal')).not.toBeVisible({ timeout: 5000 })

        // Verify all 5 todos appear in the list
        for (const todo of todos) {
            await expect(todoItem(authedPage, todo)).toBeVisible({ timeout: 5000 })
        }

        // Cleanup
        for (const todo of todos) {
            await deleteTodo(authedPage, todo)
        }
    })

    test('import preserves current project selection', async ({ authedPage }) => {
        const projName = unique()

        // Create a project
        await addProject(authedPage, projName)

        // Select the project in the sidebar
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.click()
        await expect(projItem).toHaveClass(/active/, { timeout: 3000 })

        // Open import modal
        await authedPage.click('#openImportModal')
        await expect(authedPage.locator('#importModal')).toBeVisible()

        // Wait for the project option to be populated in the dropdown
        await expect(authedPage.locator('#importProjectSelect option', { hasText: projName })).toBeAttached({ timeout: 5000 })

        // Verify the project dropdown has the created project pre-selected
        const selectedOption = authedPage.locator('#importProjectSelect option:checked')
        await expect(selectedOption).toHaveText(new RegExp(projName))

        // Close modal
        await authedPage.click('#cancelImportModal')
        await expect(authedPage.locator('#importModal')).not.toBeVisible()

        // Go back to inbox before cleanup
        await authedPage.click('.gtd-tab.inbox')
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 3000 })

        // Cleanup
        await deleteProject(authedPage, projName)
    })
})
