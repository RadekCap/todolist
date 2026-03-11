import { test, expect } from './fixtures.js'

const unique = () => `BO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.project) {
        await page.selectOption('#modalProjectSelect', { label: opts.project })
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
 * Helper: select a todo's checkbox.
 */
async function selectTodo(page, text) {
    const item = todoItem(page, text)
    await item.locator('.todo-select-checkbox').check()
}

/**
 * Helper: create multiple todos and return their names.
 */
async function createTodos(page, count) {
    const names = []
    for (let i = 0; i < count; i++) {
        const name = unique()
        await addTodo(page, name)
        await expect(todoItem(page, name)).toBeVisible({ timeout: 5000 })
        names.push(name)
    }
    return names
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

/**
 * Helper: get first available priority value from the selection bar dropdown.
 */
async function getFirstPriorityValue(page) {
    const options = page.locator('#selectionPrioritySelect option')
    const count = await options.count()
    // Options: placeholder, "No Priority", then real priorities
    if (count < 3) return null
    return await options.nth(2).getAttribute('value')
}

test.describe('Bulk Operations - Complete and Undo', () => {
    test('undo bulk complete restores todos to Inbox', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both and complete
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])
        await authedPage.click('#completeSelectedBtn')

        // Both should disappear from Inbox
        await expect(todoItem(authedPage, names[0])).not.toBeAttached({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).not.toBeAttached({ timeout: 5000 })

        // Undo via toast
        const undoBtn = authedPage.locator('.toast-undo-btn')
        await expect(undoBtn).toBeVisible({ timeout: 5000 })
        await undoBtn.click()

        // Both should reappear in Inbox
        await expect(todoItem(authedPage, names[0])).toBeVisible({ timeout: 10000 })
        await expect(todoItem(authedPage, names[1])).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, names[0])
        await deleteTodo(authedPage, names[1])
    })
})

test.describe('Bulk Operations - Project Assignment', () => {
    test('bulk remove project from todos', async ({ authedPage }) => {
        const projName = `Proj-${Date.now()}`
        await addProject(authedPage, projName)

        // Create todos with project
        const name1 = unique()
        const name2 = unique()
        await addTodo(authedPage, name1, { project: projName })
        await addTodo(authedPage, name2, { project: projName })

        // Verify project count
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await expect(projItem.locator('.project-count')).toContainText('2', { timeout: 5000 })

        // Select project to see its todos
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })

        // Select both todos
        await selectTodo(authedPage, name1)
        await selectTodo(authedPage, name2)

        // Remove project by selecting the second option ("No Project")
        const noProjectOption = authedPage.locator('#selectionProjectSelect option').nth(1)
        const noProjectValue = await noProjectOption.getAttribute('value')
        await authedPage.selectOption('#selectionProjectSelect', noProjectValue)

        // Selection clears
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/, { timeout: 5000 })

        // Project count should be 0 now
        await switchGtdTab(authedPage, 'inbox')
        await expect(projItem.locator('.project-count')).toContainText('', { timeout: 5000 })

        // Todos should be in Inbox
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name1)
        await deleteTodo(authedPage, name2)
        await deleteProject(authedPage, projName)
    })
})

test.describe('Bulk Operations - Priority', () => {
    test('bulk remove priority from todos', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // First, assign a priority via bulk
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        const priorityValue = await getFirstPriorityValue(authedPage)
        if (!priorityValue) {
            // No priorities available — skip
            await authedPage.click('#clearSelectionBtn')
            await deleteTodo(authedPage, names[0])
            await deleteTodo(authedPage, names[1])
            test.skip(true, 'No priorities available for test user')
            return
        }

        await authedPage.selectOption('#selectionPrioritySelect', priorityValue)
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/, { timeout: 5000 })

        // Now select again and remove priority
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Select "No Priority" option (second option, value="")
        const noPriorityOption = authedPage.locator('#selectionPrioritySelect option').nth(1)
        const noPriorityValue = await noPriorityOption.getAttribute('value')
        await authedPage.selectOption('#selectionPrioritySelect', noPriorityValue)

        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/, { timeout: 5000 })

        // Verify priority badges are gone by opening edit modal
        await todoItem(authedPage, names[0]).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await expect(authedPage.locator('#modalPrioritySelect')).toHaveValue('')
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, names[0])
        await deleteTodo(authedPage, names[1])
    })
})

test.describe('Bulk Operations - Cancel and Edge Cases', () => {
    test('cancelling bulk delete keeps todos', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])

        // Decline the confirmation dialog
        authedPage.once('dialog', dialog => dialog.dismiss())
        await authedPage.click('#deleteSelectedBtn')
        await authedPage.waitForTimeout(500)

        // Both todos should still be present
        await expect(todoItem(authedPage, names[0])).toBeVisible()
        await expect(todoItem(authedPage, names[1])).toBeVisible()

        // Selection should still be active
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Cleanup
        await authedPage.click('#clearSelectionBtn')
        await deleteTodo(authedPage, names[0])
        await deleteTodo(authedPage, names[1])
    })

    test('bulk status change to Done marks todos as completed', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select both and move to Done via GTD status select
        await selectTodo(authedPage, names[0])
        await selectTodo(authedPage, names[1])
        await authedPage.selectOption('#selectionGtdStatusSelect', 'done')

        // Todos disappear from Inbox
        await expect(todoItem(authedPage, names[0])).not.toBeAttached({ timeout: 5000 })

        // Switch to Done tab — todos should be there with completed state
        await switchGtdTab(authedPage, 'done')
        await expect(todoItem(authedPage, names[0])).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, names[1])).toBeVisible({ timeout: 5000 })

        // Verify they have the completed checkbox checked
        const checkbox0 = todoItem(authedPage, names[0]).locator('.todo-checkbox')
        await expect(checkbox0).toBeChecked()

        // Cleanup
        await deleteTodo(authedPage, names[0])
        await deleteTodo(authedPage, names[1])
    })

    test('selection clears when switching GTD tabs', async ({ authedPage }) => {
        const names = await createTodos(authedPage, 2)

        // Select a todo
        await selectTodo(authedPage, names[0])
        await expect(authedPage.locator('#selectionBar')).toHaveClass(/visible/)

        // Switch to Next tab
        await switchGtdTab(authedPage, 'next_action')

        // Selection bar should be hidden (selection cleared on re-render)
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/, { timeout: 3000 })

        // Switch back to Inbox for cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, names[0])
        await deleteTodo(authedPage, names[1])
    })
})
