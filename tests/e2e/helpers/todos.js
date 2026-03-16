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
    if (opts.gtdStatus) {
        await page.selectOption('#modalGtdStatusSelect', opts.gtdStatus)
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
 * Switch to a GTD tab in the sidebar and wait for it to become active.
 * @param {import('@playwright/test').Page} page
 * @param {string} status - GTD tab class name (e.g. 'inbox', 'someday_maybe', 'waiting_for')
 */
export async function switchGtdTab(page, status) {
    await page.click(`.gtd-tab.${status}`)
    await expect(page.locator(`.gtd-tab.${status}`)).toHaveClass(/active/, { timeout: 3000 })
}

/**
 * Bulk-move all inbox todos to 'someday_maybe' via Supabase REST API,
 * then reload the app so the UI reflects the change.
 * Returns the IDs of moved todos so they can be restored later.
 *
 * Uses a tight API-only loop to clear and verify before reloading the page,
 * minimizing the race window with parallel test groups.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} IDs of todos that were moved
 */
export async function clearInboxViaApi(page) {
    // Clear and verify via API in a tight loop (no page reload in between).
    // This shrinks the race window from ~3s (reload) to ~50ms (API call).
    const allMovedIds = await page.evaluate(async () => {
        const SUPABASE_URL = 'https://rkvmujdayjmszmyzbhal.supabase.co'
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdm11amRheWptc3pteXpiaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc2MDcsImV4cCI6MjA3OTc2MzYwN30.55RoV1mmHeykVz9waU7Jz6-JSkrRqlNa-ABBE8SN-jA'

        const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        if (!storageKey) throw new Error('No Supabase auth session found in localStorage')
        const session = JSON.parse(localStorage.getItem(storageKey))
        const token = session?.access_token || session?.currentSession?.access_token

        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${token}`
        }

        const movedIds = []

        for (let attempt = 0; attempt < 5; attempt++) {
            // Fetch inbox todos
            const listResp = await fetch(
                `${SUPABASE_URL}/rest/v1/todos?gtd_status=eq.inbox&select=id`,
                { headers }
            )
            const inboxTodos = await listResp.json()
            if (!inboxTodos.length) break

            movedIds.push(...inboxTodos.map(t => t.id))

            // Move them out of inbox
            await fetch(
                `${SUPABASE_URL}/rest/v1/todos?gtd_status=eq.inbox`,
                {
                    method: 'PATCH',
                    headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ gtd_status: 'someday_maybe' })
                }
            )
        }

        return movedIds
    })

    // Reload and verify the inbox is visually empty.
    // Another parallel E2E group may add an inbox todo between the API clear
    // and the reload, so retry the full clear-reload cycle if needed.
    for (let uiAttempt = 0; uiAttempt < 3; uiAttempt++) {
        await page.reload()
        await waitForApp(page)

        await page.click('.gtd-tab.inbox')
        await expect(page.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 3000 })

        // Check if inbox is truly empty in the UI
        const todoCount = await page.locator('.todo-item').count()
        if (todoCount === 0) return allMovedIds

        // Inbox still has items — clear again via API then retry reload
        const extraIds = await page.evaluate(async () => {
            const SUPABASE_URL = 'https://rkvmujdayjmszmyzbhal.supabase.co'
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdm11amRheWptc3pteXpiaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc2MDcsImV4cCI6MjA3OTc2MzYwN30.55RoV1mmHeykVz9waU7Jz6-JSkrRqlNa-ABBE8SN-jA'
            const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
            const session = JSON.parse(localStorage.getItem(storageKey))
            const token = session?.access_token || session?.currentSession?.access_token
            const headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${token}`
            }
            const resp = await fetch(`${SUPABASE_URL}/rest/v1/todos?gtd_status=eq.inbox&select=id`, { headers })
            const todos = await resp.json()
            if (!todos.length) return []
            await fetch(`${SUPABASE_URL}/rest/v1/todos?gtd_status=eq.inbox`, {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({ gtd_status: 'someday_maybe' })
            })
            return todos.map(t => t.id)
        })
        allMovedIds.push(...extraIds)
    }

    return allMovedIds
}

/**
 * Restore previously moved todos back to inbox via Supabase REST API.
 * @param {import('@playwright/test').Page} page
 * @param {string[]} ids - Todo IDs to restore
 */
export async function restoreInboxViaApi(page, ids) {
    if (!ids.length) return
    await page.evaluate(async (todoIds) => {
        const SUPABASE_URL = 'https://rkvmujdayjmszmyzbhal.supabase.co'
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdm11amRheWptc3pteXpiaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc2MDcsImV4cCI6MjA3OTc2MzYwN30.55RoV1mmHeykVz9waU7Jz6-JSkrRqlNa-ABBE8SN-jA'

        const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        const session = JSON.parse(localStorage.getItem(storageKey))
        const token = session?.access_token || session?.currentSession?.access_token

        // Build filter for the specific IDs
        const idFilter = todoIds.map(id => `"${id}"`).join(',')
        await fetch(
            `${SUPABASE_URL}/rest/v1/todos?id=in.(${idFilter})`,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ gtd_status: 'inbox' })
            }
        )
    }, ids)
}

/**
 * Wait for app to be fully ready after page load/reload.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForApp(page) {
    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 30000 })
    await expect(page.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 10000 })
    // Wait for data to finish loading from Supabase
    await expect(page.locator('#loadingScreen')).toHaveClass(/hidden/, { timeout: 30000 })
    // Verify the GTD sidebar is rendered (confirms data loaded and UI is ready)
    await expect(page.locator('.gtd-tab.inbox')).toBeVisible({ timeout: 5000 })
}
