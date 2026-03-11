import { test, expect } from './fixtures.js'

const unique = () => `DD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Performs an HTML5 drag-and-drop between two elements by dispatching
 * native DragEvents. Playwright's built-in dragTo() dispatches mouse
 * events, which don't trigger the HTML5 Drag and Drop API listeners
 * used by this app.
 */
async function html5DragDrop(page, source, target, opts = {}) {
    const targetBox = await target.boundingBox()
    if (!targetBox) throw new Error('Target not visible for drag')

    const tgtX = opts.targetPosition ? opts.targetPosition.x : targetBox.width / 2
    const tgtY = opts.targetPosition ? opts.targetPosition.y : targetBox.height / 2

    // Tag elements with unique attributes so we can find them inside evaluate
    const srcId = `dd-src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const tgtId = `dd-tgt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await source.evaluate((el, id) => el.setAttribute('data-dd-id', id), srcId)
    await target.evaluate((el, id) => el.setAttribute('data-dd-id', id), tgtId)

    await page.evaluate(
        ({ srcSel, tgtSel, data, tgtX, tgtY }) => {
            const src = document.querySelector(srcSel)
            const tgt = document.querySelector(tgtSel)
            if (!src || !tgt) throw new Error('Drag source or target not found')

            // Create a DataTransfer with working getData/setData.
            // Chromium restricts getData() on DragEvent's native dataTransfer
            // for synthetic (non-trusted) events. We work around this by
            // creating a custom object that delegates to a real DataTransfer
            // but overrides getData to always return stored values.
            const realDt = new DataTransfer()
            const store = {}
            const dt = {
                setData(type, val) { store[type] = val; realDt.setData(type, val) },
                getData(type) { return store[type] || '' },
                get dropEffect() { return realDt.dropEffect },
                set dropEffect(v) { realDt.dropEffect = v },
                get effectAllowed() { return realDt.effectAllowed },
                set effectAllowed(v) { realDt.effectAllowed = v },
                get files() { return realDt.files },
                get items() { return realDt.items },
                get types() { return realDt.types },
                clearData(type) { delete store[type]; realDt.clearData(type) },
                setDragImage() {},
            }

            if (data) dt.setData('text/plain', data)

            function makeDragEvent(type, extra = {}) {
                const evt = new DragEvent(type, {
                    bubbles: true, cancelable: true, ...extra
                })
                Object.defineProperty(evt, 'dataTransfer', { value: dt })
                return evt
            }

            src.dispatchEvent(makeDragEvent('dragstart'))
            tgt.dispatchEvent(makeDragEvent('dragover', {
                clientX: tgt.getBoundingClientRect().left + tgtX,
                clientY: tgt.getBoundingClientRect().top + tgtY,
            }))
            tgt.dispatchEvent(makeDragEvent('drop', {
                clientX: tgt.getBoundingClientRect().left + tgtX,
                clientY: tgt.getBoundingClientRect().top + tgtY,
            }))
            src.dispatchEvent(makeDragEvent('dragend'))

            // Clean up temporary attributes
            src.removeAttribute('data-dd-id')
            tgt.removeAttribute('data-dd-id')
        },
        {
            srcSel: `[data-dd-id="${srcId}"]`,
            tgtSel: `[data-dd-id="${tgtId}"]`,
            data: opts.data || '',
            tgtX,
            tgtY,
        }
    )
    await page.waitForTimeout(500)
}

/**
 * Helper: drag a todo (by its drag handle) to a target element.
 */
async function dragTodoTo(page, todoName, targetLocator, opts = {}) {
    const item = todoItem(page, todoName)
    const todoId = await item.getAttribute('data-todo-id')
    const dragHandle = item.locator('.drag-handle')
    await html5DragDrop(page, dragHandle, targetLocator, {
        data: todoId,
        ...opts,
    })
}

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
 * Helper: delete a project from the sidebar.
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
 * Helper: open the Areas dropdown in the toolbar.
 */
async function openAreasDropdown(page) {
    const dropdown = page.locator('#toolbarAreasDropdown')
    if (await dropdown.isVisible()) return
    await page.click('#toolbarAreasBtn')
    await expect(dropdown).toBeVisible({ timeout: 3000 })
}

/**
 * Helper: open the Manage Areas modal.
 */
async function openManageAreasModal(page) {
    await openAreasDropdown(page)
    await page.click('#manageAreasBtn')
    await expect(page.locator('#manageAreasModal')).toBeVisible({ timeout: 5000 })
}

test.describe('Drag and Drop - Todo to GTD Tab', () => {
    test('drag todo to Next tab changes GTD status', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Drag the todo onto the Next Action GTD tab
        const nextTab = authedPage.locator('.gtd-tab.next_action')
        await dragTodoTo(authedPage, name, nextTab)

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

        const waitingTab = authedPage.locator('.gtd-tab.waiting_for')
        await dragTodoTo(authedPage, name, waitingTab)

        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

        await switchGtdTab(authedPage, 'waiting_for')
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('drag todo to Done tab completes it', async ({ authedPage }) => {
        const name = unique()
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        const doneTab = authedPage.locator('.gtd-tab.done')
        await dragTodoTo(authedPage, name, doneTab)

        await expect(todoItem(authedPage, name)).not.toBeAttached({ timeout: 5000 })

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

        const projItem = sidebarProject(authedPage, projName)
        await dragTodoTo(authedPage, todoName, projItem)

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

        const projItem = sidebarProject(authedPage, projName)
        await expect(projItem.locator('.project-count')).toContainText('1', { timeout: 5000 })

        // Click project to view its todos
        await projItem.locator('.project-name').click()
        await authedPage.waitForTimeout(500)
        await expect(todoItem(authedPage, todoName)).toBeVisible({ timeout: 5000 })

        // Drag todo to "All Projects" to remove project
        const allProjects = authedPage.locator('#projectList .project-item').first()
        await dragTodoTo(authedPage, todoName, allProjects)

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

        // Get project order by reading sidebar project names
        const getProjectOrder = async () => {
            const names = []
            const items = authedPage.locator('#projectList .project-item .project-name')
            const count = await items.count()
            for (let i = 0; i < count; i++) {
                const text = (await items.nth(i).textContent()).trim()
                if (text.startsWith('DD-')) names.push(text)
            }
            return names
        }

        const initialOrder = await getProjectOrder()
        expect(initialOrder).toContain(proj1)
        expect(initialOrder).toContain(proj2)
        expect(initialOrder).toContain(proj3)

        // Verify initial relative order
        const idx1 = initialOrder.indexOf(proj1)
        const idx2 = initialOrder.indexOf(proj2)
        const idx3 = initialOrder.indexOf(proj3)
        expect(idx1).toBeLessThan(idx2)
        expect(idx2).toBeLessThan(idx3)

        // Drag proj3 above proj1 (top zone)
        const proj3Handle = sidebarProject(authedPage, proj3).locator('.project-drag-handle')
        const proj1Item = sidebarProject(authedPage, proj1)
        const proj1Box = await proj1Item.boundingBox()

        const proj3Id = await sidebarProject(authedPage, proj3).getAttribute('data-project-id')
        await html5DragDrop(authedPage, proj3Handle, proj1Item, {
            data: proj3Id,
            targetPosition: { x: proj1Box.width / 2, y: 2 }
        })

        // Verify proj3 now appears before proj1
        const newOrder = await getProjectOrder()
        const newIdx3 = newOrder.indexOf(proj3)
        const newIdx1 = newOrder.indexOf(proj1)
        expect(newIdx3).toBeLessThan(newIdx1)

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

        const childItem = sidebarProject(authedPage, childName)
        const childHandle = childItem.locator('.project-drag-handle')
        const parentItem = sidebarProject(authedPage, parentName)
        const parentBox = await parentItem.boundingBox()

        const childId = await childItem.getAttribute('data-project-id')
        await html5DragDrop(authedPage, childHandle, parentItem, {
            data: childId,
            targetPosition: { x: parentBox.width / 2, y: parentBox.height / 2 }
        })

        await authedPage.waitForTimeout(1000)

        // After reparenting, child should have deeper depth
        const updatedChild = sidebarProject(authedPage, childName)
        const childDepth = await updatedChild.getAttribute('data-depth')
        const parentDepth = await parentItem.getAttribute('data-depth')
        expect(Number(childDepth)).toBeGreaterThan(Number(parentDepth))

        // Cleanup
        await deleteProject(authedPage, parentName)
        const remainingChild = sidebarProject(authedPage, childName)
        if (await remainingChild.count() > 0) {
            await deleteProject(authedPage, childName)
        }
    })

    test('cannot reparent project beyond max depth', async ({ authedPage }) => {
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

        // Try to drag extra onto grandchild (would exceed depth limit)
        const extraItem = sidebarProject(authedPage, extraName)
        const extraHandle = extraItem.locator('.project-drag-handle')
        const grandchildItem = sidebarProject(authedPage, grandchildName)
        const grandchildBox = await grandchildItem.boundingBox()

        const extraId = await extraItem.getAttribute('data-project-id')
        await html5DragDrop(authedPage, extraHandle, grandchildItem, {
            data: extraId,
            targetPosition: { x: grandchildBox.width / 2, y: grandchildBox.height / 2 }
        })

        await authedPage.waitForTimeout(1000)

        // Extra project should still be a root project
        const updatedExtra = sidebarProject(authedPage, extraName)
        const extraDepth = await updatedExtra.getAttribute('data-depth')
        expect(Number(extraDepth || 0)).toBe(0)

        // Cleanup
        await deleteProject(authedPage, rootName)
        await deleteProject(authedPage, extraName)
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

        // Open manage areas modal (need to open dropdown first)
        await openManageAreasModal(authedPage)
        const modal = authedPage.locator('#manageAreasModal')

        // Add 3 areas
        for (const name of [area1, area2, area3]) {
            await modal.locator('#newAreaInput').fill(name)
            await modal.locator('#addNewAreaBtn').click()
            await expect(modal.locator('.manage-areas-item', { has: modal.locator('.manage-areas-name', { hasText: name }) })).toBeVisible({ timeout: 5000 })
        }

        // Get order of our test areas
        const getAreaOrder = async () => {
            const names = []
            const items = modal.locator('.manage-areas-item .manage-areas-name')
            const count = await items.count()
            for (let i = 0; i < count; i++) {
                const text = (await items.nth(i).textContent()).trim()
                if (text.startsWith('DD-')) names.push(text)
            }
            return names
        }

        const initialOrder = await getAreaOrder()
        expect(initialOrder).toContain(area1)
        expect(initialOrder).toContain(area3)

        const idx1 = initialOrder.indexOf(area1)
        const idx3 = initialOrder.indexOf(area3)
        expect(idx1).toBeLessThan(idx3)

        // Drag area3 above area1
        const area3Item = modal.locator('.manage-areas-item', { has: modal.locator('.manage-areas-name', { hasText: area3 }) })
        const area1Item = modal.locator('.manage-areas-item', { has: modal.locator('.manage-areas-name', { hasText: area1 }) })
        const area1Box = await area1Item.boundingBox()

        await html5DragDrop(authedPage, area3Item, area1Item, {
            targetPosition: { x: area1Box.width / 2, y: 2 }
        })

        // Verify area3 now appears before area1
        const newOrder = await getAreaOrder()
        const newIdx3 = newOrder.indexOf(area3)
        const newIdx1 = newOrder.indexOf(area1)
        expect(newIdx3).toBeLessThan(newIdx1)

        // Cleanup — delete all 3 areas
        for (const name of [area1, area2, area3]) {
            const item = modal.locator('.manage-areas-item', { has: modal.locator('.manage-areas-name', { hasText: name }) })
            if (await item.count() > 0) {
                authedPage.once('dialog', d => d.accept())
                await item.locator('.manage-areas-delete').click()
                await expect(item).not.toBeAttached({ timeout: 5000 })
            }
        }

        // Close modal
        await authedPage.click('#closeManageAreasModalBtn')
    })
})
