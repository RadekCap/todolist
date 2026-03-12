import { expect } from '@playwright/test'

/**
 * Generate a unique string for test data isolation.
 * @param {string} [prefix='Test'] - Prefix for the unique string.
 */
export function unique(prefix = 'Test') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Add a todo via the modal.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 * @param {object} [opts]
 */
export async function addTodo(page, text, opts = {}) {
    await page.click('#openAddTodoModal')
    await expect(page.locator('#addTodoModal')).toBeVisible()
    await page.fill('#modalTodoInput', text)

    if (opts.comment) {
        await page.fill('#modalCommentInput', opts.comment)
    }
    if (opts.dueDate) {
        await page.fill('#modalDueDateInput', opts.dueDate)
    }
    if (opts.project) {
        await page.selectOption('#modalProjectSelect', { label: opts.project })
    }
    if (opts.category) {
        await page.selectOption('#modalCategorySelect', { label: opts.category })
    }
    if (opts.context) {
        await page.selectOption('#modalContextSelect', { label: opts.context })
    }
    if (opts.priority) {
        await page.selectOption('#modalPrioritySelect', { label: opts.priority })
    }

    await page.click('#addTodoForm button[type="submit"]')
    await expect(page.locator('#addTodoModal')).not.toBeVisible({ timeout: 5000 })
}

/**
 * Find a todo item by its text content.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
export function todoItem(page, text) {
    return page.locator('.todo-item', { has: page.locator('.todo-text', { hasText: text }) })
}

/**
 * Delete a todo by text and wait for removal.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
export async function deleteTodo(page, text) {
    const item = todoItem(page, text)
    if (await item.count() > 0) {
        await item.locator('.delete-btn').click()
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

/**
 * Add a project via the sidebar input.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Delete a project from the sidebar by name.
 * Handles the confirm dialog automatically.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
export async function deleteProject(page, name) {
    const item = page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
    if (await item.count() === 0) return

    page.once('dialog', dialog => dialog.accept())
    await item.locator('.project-delete').click()
    await expect(item).not.toBeAttached({ timeout: 5000 })
}

/**
 * Wait for app to be fully ready after page load/reload.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForApp(page) {
    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 30000 })
    await expect(page.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 10000 })
}
