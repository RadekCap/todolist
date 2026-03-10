import { test, expect } from './fixtures.js'

const unique = () => `NAV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: add a project via the sidebar.
 */
async function addProject(page, name) {
    await page.fill('#newProjectInput', name)
    await page.click('#addProjectBtn')
    await expect(page.locator('#projectList .project-item .project-name', { hasText: name })).toBeVisible({ timeout: 5000 })
}

/**
 * Helper: navigate to a URL and wait for the app to be ready.
 */
async function navigateTo(page, path) {
    await page.goto(path)
    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })
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

test.describe('URL Navigation - GTD Deep Linking', () => {
    test('?gtd=next_action selects the Next tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=next_action')
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('?gtd=scheduled selects the Scheduled tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=scheduled')
        await expect(authedPage.locator('.gtd-tab.scheduled')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('?gtd=waiting_for selects the Waiting tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=waiting_for')
        await expect(authedPage.locator('.gtd-tab.waiting_for')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('?gtd=someday_maybe selects the Someday tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=someday_maybe')
        await expect(authedPage.locator('.gtd-tab.someday_maybe')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('?gtd=done selects the Done tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=done')
        await expect(authedPage.locator('.gtd-tab.done')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('?gtd=all selects the All tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=all')
        await expect(authedPage.locator('.gtd-tab.all')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('invalid ?gtd= value defaults to Inbox', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?gtd=invalid_status')
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('no query params defaults to Inbox', async ({ authedPage }) => {
        await navigateTo(authedPage, '/')
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/, { timeout: 5000 })
    })
})

test.describe('URL Navigation - View Deep Linking', () => {
    test('?view=projects shows the All Projects view', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?view=projects')
        await expect(authedPage.locator('.project-card').first()).toBeVisible({ timeout: 5000 })
    })

    test('?view=today selects Scheduled tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?view=today')
        await expect(authedPage.locator('.gtd-tab.scheduled')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('?view=tomorrow selects Scheduled tab', async ({ authedPage }) => {
        await navigateTo(authedPage, '/?view=tomorrow')
        await expect(authedPage.locator('.gtd-tab.scheduled')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('?project=<id> selects that project', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Get the project ID from the sidebar item's data attribute
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        const projectId = await projItem.getAttribute('data-project-id')

        // Navigate with project param
        await navigateTo(authedPage, `/?project=${projectId}`)
        await authedPage.waitForTimeout(1000)

        // The project should be selected (highlighted in sidebar)
        await expect(projItem).toHaveClass(/active/, { timeout: 5000 })

        // Go back to inbox for cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteProject(authedPage, projName)
    })
})

test.describe('URL Navigation - URL Sync on Interaction', () => {
    test('switching GTD tab updates URL query param', async ({ authedPage }) => {
        await switchGtdTab(authedPage, 'next_action')

        const url = authedPage.url()
        expect(url).toContain('gtd=next_action')

        // Switch back to inbox
        await switchGtdTab(authedPage, 'inbox')
    })

    test('selecting a project updates URL with ?project=', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Click the project in the sidebar
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)

        const url = authedPage.url()
        expect(url).toContain('project=')

        // Go back to inbox for cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteProject(authedPage, projName)
    })

    test('switching from project view to GTD tab updates URL correctly', async ({ authedPage }) => {
        const projName = unique()
        await addProject(authedPage, projName)

        // Select the project
        const projItem = authedPage.locator('#projectList .project-item', { has: authedPage.locator('.project-name', { hasText: projName }) })
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)
        expect(authedPage.url()).toContain('project=')

        // Switch to a GTD tab
        await switchGtdTab(authedPage, 'next_action')

        const url = authedPage.url()
        expect(url).toContain('gtd=next_action')
        expect(url).not.toContain('project=')

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteProject(authedPage, projName)
    })
})

test.describe('URL Navigation - Browser History', () => {
    test('browser back button restores previous GTD state', async ({ authedPage }) => {
        // Start on Inbox (default)
        await expect(authedPage.locator('.gtd-tab.inbox')).toHaveClass(/active/)

        // Navigate to Next
        await switchGtdTab(authedPage, 'next_action')
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/)

        // Navigate to Scheduled
        await switchGtdTab(authedPage, 'scheduled')
        await expect(authedPage.locator('.gtd-tab.scheduled')).toHaveClass(/active/)

        // Press browser back
        await authedPage.goBack()
        await authedPage.waitForTimeout(500)
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 5000 })
    })

    test('browser forward button restores forward GTD state', async ({ authedPage }) => {
        // Navigate to Next, then Scheduled
        await switchGtdTab(authedPage, 'next_action')
        await switchGtdTab(authedPage, 'scheduled')

        // Go back to Next
        await authedPage.goBack()
        await authedPage.waitForTimeout(500)
        await expect(authedPage.locator('.gtd-tab.next_action')).toHaveClass(/active/, { timeout: 5000 })

        // Go forward to Scheduled
        await authedPage.goForward()
        await authedPage.waitForTimeout(500)
        await expect(authedPage.locator('.gtd-tab.scheduled')).toHaveClass(/active/, { timeout: 5000 })

        // Return to inbox
        await switchGtdTab(authedPage, 'inbox')
    })
})
