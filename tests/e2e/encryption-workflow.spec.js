import { test, expect } from './fixtures.js'
import { unique, addTodo, todoItem, deleteTodo, addProject, deleteProject, waitForApp } from './helpers/todos.js'

test.describe('Encryption Workflow', () => {
    test('todo text is readable after creation', async ({ authedPage }) => {
        const name = unique('EW')
        await addTodo(authedPage, name)

        // Text should be displayed correctly (encrypted/decrypted roundtrip)
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 5000 })
        await expect(item.locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo text persists correctly after page reload', async ({ authedPage }) => {
        // Create a todo so the test is self-contained
        const name = unique('EW')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Reload the page
        await authedPage.reload()
        await waitForApp(authedPage)

        // The created todo should still be readable after reload (tests decrypt-on-load path)
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 15000 })
        await expect(item.locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('todo text is readable after lock and unlock', async ({ authedPage }) => {
        // Create a todo so the test is self-contained
        const name = unique('EW')
        await addTodo(authedPage, name)
        await expect(todoItem(authedPage, name)).toBeVisible({ timeout: 5000 })

        // Lock the app
        await authedPage.click('#toolbarUserBtn')
        await expect(authedPage.locator('#toolbarUserMenu')).toHaveClass(/open/, { timeout: 3000 })
        await authedPage.click('#lockBtn')
        await expect(authedPage.locator('#unlockModal')).toHaveClass(/active/, { timeout: 5000 })

        // Unlock with correct password (re-derives encryption key)
        const password = process.env.TEST_USER_PASSWORD
        await authedPage.fill('#unlockPassword', password)
        await authedPage.click('#unlockBtn')
        await waitForApp(authedPage)

        // The todo should still be readable after key re-derivation
        const item = todoItem(authedPage, name)
        await expect(item).toBeVisible({ timeout: 15000 })
        await expect(item.locator('.todo-text')).toContainText(name)

        // Cleanup
        await deleteTodo(authedPage, name)
    })

    test('project names survive encryption roundtrip after reload', async ({ authedPage }) => {
        // Create a project so the test is self-contained
        const name = unique('EWProj')
        await addProject(authedPage, name)

        // Reload
        await authedPage.reload()
        await waitForApp(authedPage)

        // Project name should still be readable after reload
        const projectName = authedPage.locator('#projectList .project-item .project-name', { hasText: name })
        await expect(projectName).toBeVisible({ timeout: 15000 })
        await expect(projectName).toContainText(name)

        // Cleanup
        await deleteProject(authedPage, name)
    })
})
