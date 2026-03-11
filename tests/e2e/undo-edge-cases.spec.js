import { test, expect } from './fixtures.js'

const unique = () => `UE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal and return its name.
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
 * Helper: click a GTD tab in the sidebar.
 */
async function switchGtdTab(page, status) {
    await page.click(`.gtd-tab.${status}`)
    await page.waitForTimeout(500)
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

/**
 * Helper: select a todo's checkbox for bulk operations.
 */
async function selectTodo(page, text) {
    const item = todoItem(page, text)
    await item.locator('.todo-select-checkbox').check()
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

/**
 * Helper: logout from the app.
 */
async function logout(page) {
    await page.click('#toolbarUserBtn')
    await page.click('#logoutBtn')
    await expect(page.locator('#authContainer')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('#loginForm')).toHaveClass(/active/)
}

/**
 * Helper: login via the auth form.
 */
async function loginViaForm(page) {
    const email = process.env.TEST_USER_EMAIL
    const password = process.env.TEST_USER_PASSWORD

    await page.fill('#loginEmail', email)
    await page.fill('#loginPassword', password)

    await Promise.all([
        page.waitForResponse(resp => resp.url().includes('supabase') && resp.url().includes('token'), { timeout: 30000 }),
        page.click('#loginForm .auth-btn')
    ])

    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 30000 })
    await expect(page.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 10000 })
}

test.describe('Undo Individual Operations', () => {
    test('undo individual todo completion', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Complete the todo via checkbox — moves it to Done
        await todoItem(authedPage, name).locator('.todo-checkbox').check()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Click undo on the toast notification
        const undoBtn = authedPage.locator('.toast-undo-btn')
        await expect(undoBtn).toBeVisible({ timeout: 5000 })
        await undoBtn.click()

        // Todo should reappear in Inbox with checkbox unchecked
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })
        const checkbox = todoItem(authedPage, name).locator('.todo-checkbox')
        await expect(checkbox).not.toBeChecked()

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('undo GTD status change', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open edit modal and change GTD status to "Waiting For"
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalGtdStatusSelect', 'waiting')
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Todo should disappear from Inbox (moved to Waiting)
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Undo via Ctrl+Z
        await authedPage.keyboard.press('Control+z')

        // Todo should reappear in Inbox
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('undo project assignment change', async ({ authedPage }) => {
        const projName = `Proj-${Date.now()}`
        const name = unique()

        await addProject(authedPage, projName)
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Open edit modal and assign a project
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await authedPage.selectOption('#modalProjectSelect', { label: projName })
        await authedPage.click('#addTodoForm button[type="submit"]')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Undo via Ctrl+Z
        await authedPage.keyboard.press('Control+z')
        await authedPage.waitForTimeout(1000)

        // Verify todo has no project by opening edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await expect(authedPage.locator('#modalProjectSelect')).toHaveValue('')
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
        await deleteProject(authedPage, projName)
    })

    test('undo priority change', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Select the todo and assign a priority via selection bar
        await selectTodo(authedPage, name)

        const priorityValue = await getFirstPriorityValue(authedPage)
        if (!priorityValue) {
            await authedPage.click('#clearSelectionBtn')
            await deleteTodo(authedPage, name)
            test.skip(true, 'No priorities available for test user')
            return
        }

        await authedPage.selectOption('#selectionPrioritySelect', priorityValue)
        await expect(authedPage.locator('#selectionBar')).not.toHaveClass(/visible/, { timeout: 5000 })

        // Undo via Ctrl+Z
        await authedPage.keyboard.press('Control+z')
        await authedPage.waitForTimeout(1000)

        // Verify priority is cleared by opening edit modal
        await todoItem(authedPage, name).locator('.todo-text').click()
        await expect(authedPage.locator('#addTodoModal')).toBeVisible()
        await expect(authedPage.locator('#modalPrioritySelect')).toHaveValue('')
        await authedPage.click('#cancelModal')
        await expect(authedPage.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Undo Stack Behavior', () => {
    test('multiple sequential undos', async ({ authedPage }) => {
        const name1 = unique()
        const name2 = unique()
        const name3 = unique()
        await addTodo(authedPage, name1)
        await addTodo(authedPage, name2)
        await addTodo(authedPage, name3)
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name3)).toBeVisible({ timeout: 5000 })

        // Delete all 3 todos sequentially
        await todoItem(authedPage, name1).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name1)).not.toBeAttached({ timeout: 5000 })

        // Wait for toast to disappear before next delete to avoid conflicts
        await authedPage.waitForTimeout(1000)

        await todoItem(authedPage, name2).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name2)).not.toBeAttached({ timeout: 5000 })

        await authedPage.waitForTimeout(1000)

        await todoItem(authedPage, name3).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name3)).not.toBeAttached({ timeout: 5000 })

        // Undo 3 times via Ctrl+Z
        await authedPage.keyboard.press('Control+z')
        await expect(todoItem(authedPage, name3)).toBeVisible({ timeout: 10000 })

        await authedPage.keyboard.press('Control+z')
        await expect(todoItem(authedPage, name2)).toBeVisible({ timeout: 10000 })

        await authedPage.keyboard.press('Control+z')
        await expect(todoItem(authedPage, name1)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name1)
        await deleteTodo(authedPage, name2)
        await deleteTodo(authedPage, name3)
    })

    test('undo not available after logout and login', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Wait for toast to disappear
        await authedPage.waitForTimeout(2000)

        // Logout
        await logout(authedPage)

        // Login again
        await loginViaForm(authedPage)

        // Ensure we are on Inbox
        await switchGtdTab(authedPage, 'inbox')

        // Try Ctrl+Z — should do nothing (undo stack cleared on logout)
        await authedPage.keyboard.press('Control+z')
        await authedPage.waitForTimeout(2000)

        // Todo should still not be present
        await expect(todoItem(authedPage, name)).not.toBeAttached()

        // No cleanup needed — todo was already deleted and undo did not restore it
    })
})

test.describe('Undo Edge Cases', () => {
    test('undo after tab switch preserves context', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Delete the todo from Inbox
        await todoItem(authedPage, name).locator('.delete-btn').click()
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Switch to Done tab
        await switchGtdTab(authedPage, 'done')

        // Undo via Ctrl+Z while on Done tab
        await authedPage.keyboard.press('Control+z')
        await authedPage.waitForTimeout(1000)

        // Switch back to Inbox — todo should be restored there
        await switchGtdTab(authedPage, 'inbox')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 10000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})
