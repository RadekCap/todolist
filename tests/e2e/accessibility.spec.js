import { test, expect } from '@playwright/test'

test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/')
    })

    test('html has lang attribute', async ({ page }) => {
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    })

    test('page has a viewport meta tag', async ({ page }) => {
        const viewport = page.locator('meta[name="viewport"]')
        await expect(viewport).toBeAttached()
    })

    test('all form inputs have labels', async ({ page }) => {
        // Login form labels
        await expect(page.locator('label[for="loginEmail"]')).toBeAttached()
        await expect(page.locator('label[for="loginPassword"]')).toBeAttached()

        // Signup form labels
        await expect(page.locator('label[for="signupEmail"]')).toBeAttached()
        await expect(page.locator('label[for="signupPassword"]')).toBeAttached()
        await expect(page.locator('label[for="signupPasswordConfirm"]')).toBeAttached()
    })

    test('sidebar sections have ARIA attributes', async ({ page }) => {
        const gtdHeader = page.locator('#gtdSection .sidebar-section-header')
        await expect(gtdHeader).toHaveAttribute('role', 'button')
        await expect(gtdHeader).toHaveAttribute('aria-expanded')

        const projectsHeader = page.locator('#projectsSection .sidebar-section-header')
        await expect(projectsHeader).toHaveAttribute('role', 'button')
        await expect(projectsHeader).toHaveAttribute('aria-expanded')
    })

    test('modals have correct ARIA roles', async ({ page }) => {
        // role="dialog" and aria-modal are on the inner .modal div, not the overlay
        const addTodoModal = page.locator('#addTodoModal .modal')
        await expect(addTodoModal).toHaveAttribute('role', 'dialog')
        await expect(addTodoModal).toHaveAttribute('aria-modal', 'true')

        const settingsModal = page.locator('#settingsModal .modal')
        await expect(settingsModal).toHaveAttribute('role', 'dialog')
        await expect(settingsModal).toHaveAttribute('aria-modal', 'true')
    })
})
