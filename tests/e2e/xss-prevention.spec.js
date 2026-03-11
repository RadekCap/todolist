import { test, expect } from './fixtures.js'

const unique = () => `XSS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Helper: add a todo via the modal.
 */
async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.comment) {
        await page.fill('#modalCommentInput', opts.comment)
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

        // Handle custom delete dialog (shown when project has todos)
        const customDialog = page.locator('.delete-project-dialog-overlay')
        if (await customDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
            await customDialog.locator('[data-action="delete"]').click()
        }

        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

test.describe('XSS Prevention', () => {
    test('todo with HTML tags displays escaped text', async ({ authedPage }) => {
        const payload = `${unique()} <b>bold</b> <i>italic</i>`
        await addTodo(authedPage, payload)

        const item = todoItem(authedPage, unique().split('-')[0]) // Match by prefix won't work; use full payload
        // The todo text should contain the literal HTML tags, not rendered bold/italic
        const todoText = authedPage.locator('.todo-item .todo-text', { hasText: '<b>bold</b>' })
        await expect(todoText).toBeVisible({ timeout: 5000 })

        // Verify no actual <b> element was rendered inside the todo text
        const boldElements = todoText.locator('b')
        await expect(boldElements).toHaveCount(0)

        // Cleanup
        await deleteTodo(authedPage, payload)
    })

    test('todo with script tag does not execute JavaScript', async ({ authedPage }) => {
        const marker = unique()
        const payload = `${marker} <script>window.__xss_test=true</script>`
        await addTodo(authedPage, payload)

        const todoText = authedPage.locator('.todo-item .todo-text', { hasText: marker })
        await expect(todoText).toBeVisible({ timeout: 5000 })

        // The text should show the literal <script> tag
        await expect(todoText).toContainText('<script>')

        // JavaScript should NOT have executed
        const xssExecuted = await authedPage.evaluate(() => window.__xss_test)
        expect(xssExecuted).toBeFalsy()

        // Cleanup
        await deleteTodo(authedPage, marker)
    })

    test('todo with special HTML characters displays them literally', async ({ authedPage }) => {
        const marker = unique()
        const payload = `${marker} & < > " '`
        await addTodo(authedPage, payload)

        const todoText = authedPage.locator('.todo-item .todo-text', { hasText: marker })
        await expect(todoText).toBeVisible({ timeout: 5000 })

        // All special characters should be displayed as text
        const textContent = await todoText.textContent()
        expect(textContent).toContain('& < > " \'')

        // Cleanup
        await deleteTodo(authedPage, marker)
    })

    test('comment with HTML tags displays escaped text', async ({ authedPage }) => {
        const marker = unique()
        const comment = '<div class="malicious"><a href="javascript:alert(1)">click me</a></div>'
        await addTodo(authedPage, marker, { comment })

        const todoComment = authedPage.locator('.todo-item .todo-comment', { hasText: '<div' })
        await expect(todoComment).toBeVisible({ timeout: 5000 })

        // Should show literal HTML, not render a link
        const links = todoComment.locator('a')
        await expect(links).toHaveCount(0)

        // The raw HTML tags should be visible as text
        const textContent = await todoComment.textContent()
        expect(textContent).toContain('<a href=')

        // Cleanup
        await deleteTodo(authedPage, marker)
    })

    test('project name with img onerror payload displays as text', async ({ authedPage }) => {
        const marker = unique()
        const payload = `${marker} <img src=x onerror=alert(1)>`
        await addProject(authedPage, payload)

        // The project name should show the literal text, not render an image
        const projectName = authedPage.locator('#projectList .project-item .project-name', { hasText: marker })
        await expect(projectName).toBeVisible({ timeout: 5000 })

        const textContent = await projectName.textContent()
        expect(textContent).toContain('<img')

        // No actual <img> should be rendered in the project name
        const images = projectName.locator('img')
        await expect(images).toHaveCount(0)

        // JavaScript should NOT have executed
        const xssExecuted = await authedPage.evaluate(() => window.__xss_test)
        expect(xssExecuted).toBeFalsy()

        // Cleanup
        await deleteProject(authedPage, marker)
    })
})
