import { test, expect } from './fixtures.js'

const unique = () => `DD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

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
 * Helper: find a project item in the sidebar.
 */
function sidebarProject(page, name) {
    return page.locator('#projectList .project-item', { has: page.locator('.project-name', { hasText: name }) })
}

/**
 * Helper: delete a project from the sidebar (handles both dialog types).
 */
async function deleteProject(page, name) {
    const item = sidebarProject(page, name)
    if (await item.count() > 0) {
        const deleteBtn = item.locator('.project-delete')
        if (await deleteBtn.count() > 0) {
            page.once('dialog', dialog => dialog.accept())
            await deleteBtn.click()
            await expect(item).not.toBeAttached({ timeout: 5000 })
        }
    }
}

/**
 * Helper: delete a project that has todos (uses custom dialog).
 */
async function deleteProjectWithTodos(page, name) {
    const item = sidebarProject(page, name)
    if (await item.count() > 0) {
        await item.locator('.project-delete').click()
        const dialog = page.locator('.delete-project-dialog-overlay')
        if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
            await dialog.locator('[data-action="delete"]').click()
            await expect(dialog).not.toBeVisible({ timeout: 5000 })
        } else {
            page.once('dialog', d => d.accept())
        }
        await expect(item).not.toBeAttached({ timeout: 5000 })
    }
}

test.describe('Drag and Drop - Todo to GTD Tab', () => {
    test('drag todo to Next tab changes GTD status', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Drag the todo's drag handle onto the Next Action GTD tab
        const dragHandle = todoItem(authedPage, name).locator('.drag-handle')
        const nextTab = authedPage.locator('.gtd-tab.next_action')
        await dragHandle.dragTo(nextTab)

        // Todo should disappear from Inbox
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Switch to Next tab — todo should be there
        await switchGtdTab(authedPage, 'next_action')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('drag todo to Waiting tab changes GTD status', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Drag to Waiting For tab
        const dragHandle = todoItem(authedPage, name).locator('.drag-handle')
        const waitingTab = authedPage.locator('.gtd-tab.waiting_for')
        await dragHandle.dragTo(waitingTab)

        // Should disappear from Inbox
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Switch to Waiting tab — todo should be there
        await switchGtdTab(authedPage, 'waiting_for')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('drag todo to Done tab completes it', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Drag to Done tab
        const dragHandle = todoItem(authedPage, name).locator('.drag-handle')
        const doneTab = authedPage.locator('.gtd-tab.done')
        await dragHandle.dragTo(doneTab)

        // Should disappear from Inbox
        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        // Switch to Done tab — todo should be completed
        await switchGtdTab(authedPage, 'done')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })
        await expect(todoItem(authedPage, name).locator('.todo-checkbox')).toBeChecked()

        // Cleanup
        await deleteTodo(authedPage, name)
    })
})

test.describe('Drag and Drop - Todo to Project', () => {
    test('drag todo to project assigns it', async ({ authedPage }) => {
        const projName = unique()
        const todoName = unique()
        await addProject(authedPage, projName)
        await addTodo(authedPage, todoName)
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Drag todo onto the project in sidebar
        const dragHandle = todoItem(authedPage, todoName).locator('.drag-handle')
        const projItem = sidebarProject(authedPage, projName)
        await dragHandle.dragTo(projItem)
        await authedPage.waitForTimeout(500)

        // Project count should update to 1
        await expect(projItem.locator('.project-count')).toContainText('1', { timeout: 5000 })

        // Click project to view its todos
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todoName)
        await deleteProject(authedPage, projName)
    })

    test('drag todo to All Projects removes project assignment', async ({ authedPage }) => {
        const projName = unique()
        const todoName = unique()
        await addProject(authedPage, projName)
        await addTodo(authedPage, todoName, { project: projName })

        // Verify project count
        const projItem = sidebarProject(authedPage, projName)
        await expect(projItem.locator('.project-count')).toContainText('1', { timeout: 5000 })

        // Click project to view its todos
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Drag todo to "All Projects" to remove project
        const dragHandle = todoItem(authedPage, todoName).locator('.drag-handle')
        const allProjects = authedPage.locator('#projectList .project-item').first()
        await dragHandle.dragTo(allProjects)
        await authedPage.waitForTimeout(500)

        // Project count should be 0 (empty)
        await expect(projItem.locator('.project-count')).toContainText('', { timeout: 5000 })

        // Cleanup
        await switchGtdTab(authedPage, 'inbox')
        await deleteTodo(authedPage, todoName)
        await deleteProject(authedPage, projName)
    })
})

test.describe('Drag and Drop - Project Reorder', () => {
    test('drag project to reorder in sidebar', async ({ authedPage }) => {
        const proj1 = unique()
        const proj2 = unique()
        const proj3 = unique()
        await addProject(authedPage, proj1)
        await addProject(authedPage, proj2)
        await addProject(authedPage, proj3)

        // Get project items — they should be in creation order
        const projectNames = authedPage.locator('#projectList .project-item .project-name')

        // Verify initial order (skip first which is "All Projects")
        // Projects appear after the "All Projects" entry
        const getProjectOrder = async () => {
            const names = []
            const items = authedPage.locator('#projectList .project-item .project-name')
            const count = await items.count()
            for (let i = 0; i < count; i++) {
                const text = await items.nth(i).textContent()
                if (text.startsWith('DD-')) names.push(text.trim())
            }
            return names
        }

        const initialOrder = await getProjectOrder()
        expect(initialOrder).toEqual([proj1, proj2, proj3])

        // Drag proj3 above proj1 using the drag handle
        // Target the top zone of proj1 (top 25%)
        const proj3Handle = sidebarProject(authedPage, proj3).locator('.project-drag-handle')
        const proj1Item = sidebarProject(authedPage, proj1)
        const proj1Box = await proj1Item.boundingBox()

        await proj3Handle.dragTo(proj1Item, {
            targetPosition: { x: proj1Box.width / 2, y: 2 }
        })
        await authedPage.waitForTimeout(500)

        // Verify new order: proj3, proj1, proj2
        const newOrder = await getProjectOrder()
        expect(newOrder).toEqual([proj3, proj1, proj2])

        // Cleanup
        await deleteProject(authedPage, proj1)
        await deleteProject(authedPage, proj2)
        await deleteProject(authedPage, proj3)
    })
})

test.describe('Drag and Drop - Project Reparent', () => {
    test('drag project onto another to reparent it', async ({ authedPage }) => {
        const parentName = unique()
        const childName = unique()
        await addProject(authedPage, parentName)
        await addProject(authedPage, childName)

        // Drag childName onto parentName's middle zone to reparent
        const childHandle = sidebarProject(authedPage, childName).locator('.project-drag-handle')
        const parentItem = sidebarProject(authedPage, parentName)
        const parentBox = await parentItem.boundingBox()

        await childHandle.dragTo(parentItem, {
            targetPosition: { x: parentBox.width / 2, y: parentBox.height / 2 }
        })
        await authedPage.waitForTimeout(1000)

        // After reparenting, child should be indented under parent
        // Check that child has deeper indentation (higher depth data attribute)
        const childItem = sidebarProject(authedPage, childName)
        const childDepth = await childItem.getAttribute('data-depth')
        const parentDepth = await parentItem.getAttribute('data-depth')

        expect(Number(childDepth)).toBeGreaterThan(Number(parentDepth))

        // Cleanup — delete parent (cascades to child)
        await deleteProject(authedPage, parentName)
        // If child survives, clean it too
        const remainingChild = sidebarProject(authedPage, childName)
        if (await remainingChild.count() > 0) {
            await deleteProject(authedPage, childName)
        }
    })

    test('cannot reparent project beyond max depth', async ({ authedPage }) => {
        // Create a 3-level hierarchy: root > child > grandchild
        const rootName = unique()
        const childName = unique()
        const grandchildName = unique()
        const extraName = unique()

        await addProject(authedPage, rootName)

        // Create child via context menu
        authedPage.once('dialog', async dialog => {
            await dialog.accept(childName)
        })
        await sidebarProject(authedPage, rootName).click({ button: 'right' })
        await authedPage.locator('.context-menu-item', { hasText: /add subproject/i }).click()
        await expect(sidebarProject(authedPage, childName)).toBeVisible({ timeout: 5000 })

        // Create grandchild via context menu
        authedPage.once('dialog', async dialog => {
            await dialog.accept(grandchildName)
        })
        await sidebarProject(authedPage, childName).click({ button: 'right' })
        await authedPage.locator('.context-menu-item', { hasText: /add subproject/i }).click()
        await expect(sidebarProject(authedPage, grandchildName)).toBeVisible({ timeout: 5000 })

        // Create an extra root project
        await addProject(authedPage, extraName)

        // Try to drag extra project onto grandchild (would exceed depth limit)
        const extraHandle = sidebarProject(authedPage, extraName).locator('.project-drag-handle')
        const grandchildItem = sidebarProject(authedPage, grandchildName)
        const grandchildBox = await grandchildItem.boundingBox()

        await extraHandle.dragTo(grandchildItem, {
            targetPosition: { x: grandchildBox.width / 2, y: grandchildBox.height / 2 }
        })
        await authedPage.waitForTimeout(1000)

        // Extra project should still be a root project (no depth change)
        const extraItem = sidebarProject(authedPage, extraName)
        const extraDepth = await extraItem.getAttribute('data-depth')
        expect(Number(extraDepth || 0)).toBe(0)

        // Cleanup
        await deleteProject(authedPage, rootName)
        await deleteProject(authedPage, extraName)
        // Clean up any remaining items
        for (const name of [childName, grandchildName]) {
            const item = sidebarProject(authedPage, name)
            if (await item.count() > 0) {
                await deleteProject(authedPage, name)
            }
        }
    })
})

test.describe('Drag and Drop - Area Reorder', () => {
    test('drag area to reorder in manage modal', async ({ authedPage }) => {
        const area1 = unique()
        const area2 = unique()
        const area3 = unique()

        // Create areas via the manage modal
        await authedPage.click('#manageAreasBtn')
        const modal = authedPage.locator('#manageAreasModal')
        await expect(modal).toBeVisible({ timeout: 5000 })

        // Add 3 areas
        for (const name of [area1, area2, area3]) {
            await modal.locator('#manageAreaInput').fill(name)
            await modal.locator('#addManagedAreaBtn').click()
            await expect(modal.locator('.manage-areas-item', { hasText: name })).toBeVisible({ timeout: 5000 })
        }

        // Get initial order of our test areas
        const getAreaOrder = async () => {
            const names = []
            const items = modal.locator('.manage-areas-item')
            const count = await items.count()
            for (let i = 0; i < count; i++) {
                const text = await items.nth(i).textContent()
                if (text.includes('DD-')) {
                    // Extract area name from item text
                    const match = text.match(/(DD-[^\s]+)/)
                    if (match) names.push(match[1])
                }
            }
            return names
        }

        const initialOrder = await getAreaOrder()
        expect(initialOrder).toEqual([area1, area2, area3])

        // Drag area3 above area1
        const area3Item = modal.locator('.manage-areas-item', { hasText: area3 })
        const area1Item = modal.locator('.manage-areas-item', { hasText: area1 })
        const area1Box = await area1Item.boundingBox()

        await area3Item.locator('.manage-areas-drag-handle').dragTo(area1Item, {
            targetPosition: { x: area1Box.width / 2, y: 2 }
        })
        await authedPage.waitForTimeout(500)

        // Verify new order
        const newOrder = await getAreaOrder()
        expect(newOrder).toEqual([area3, area1, area2])

        // Cleanup — delete all 3 areas
        for (const name of [area1, area2, area3]) {
            const item = modal.locator('.manage-areas-item', { hasText: name })
            if (await item.count() > 0) {
                authedPage.once('dialog', d => d.accept())
                await item.locator('.manage-areas-delete').click()
                await expect(item).not.toBeAttached({ timeout: 5000 })
            }
        }

        // Close modal
        await modal.locator('.modal-close-btn, #closeManageAreasModalBtn').first().click()
    })
})
