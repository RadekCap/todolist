import { test, expect } from '@playwright/test'

test.describe('Auth UI', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/')
        // Wait for the auth container to appear (app initializes and shows auth)
        await expect(page.locator('#authContainer')).toBeVisible({ timeout: 10000 })
    })

    test('auth container is visible when not logged in', async ({ page }) => {
        const authContainer = page.locator('#authContainer')
        await expect(authContainer).toHaveClass(/active/)
    })

    test('login form is visible by default', async ({ page }) => {
        const loginForm = page.locator('#loginForm')
        await expect(loginForm).toHaveClass(/active/)
    })

    test('signup form is hidden by default', async ({ page }) => {
        const signupForm = page.locator('#signupForm')
        await expect(signupForm).not.toHaveClass(/active/)
    })

    test('login tab is active by default', async ({ page }) => {
        const loginTab = page.locator('.auth-tab[data-tab="login"]')
        await expect(loginTab).toHaveClass(/active/)
    })

    test('switching to signup tab shows signup form', async ({ page }) => {
        const signupTab = page.locator('.auth-tab[data-tab="signup"]')
        await signupTab.click()

        const signupForm = page.locator('#signupForm')
        await expect(signupForm).toHaveClass(/active/)

        const loginForm = page.locator('#loginForm')
        await expect(loginForm).not.toHaveClass(/active/)
    })

    test('switching back to login tab shows login form', async ({ page }) => {
        // Switch to signup first
        await page.locator('.auth-tab[data-tab="signup"]').click()
        // Switch back to login
        await page.locator('.auth-tab[data-tab="login"]').click()

        const loginForm = page.locator('#loginForm')
        await expect(loginForm).toHaveClass(/active/)
    })

    test('login form has email and password fields', async ({ page }) => {
        await expect(page.locator('#loginEmail')).toBeAttached()
        await expect(page.locator('#loginPassword')).toBeAttached()
    })

    test('signup form has email, password, and confirm password fields', async ({ page }) => {
        await expect(page.locator('#signupEmail')).toBeAttached()
        await expect(page.locator('#signupPassword')).toBeAttached()
        await expect(page.locator('#signupPasswordConfirm')).toBeAttached()
    })

    test('login form email field has correct type', async ({ page }) => {
        await expect(page.locator('#loginEmail')).toHaveAttribute('type', 'email')
    })

    test('login form password field has correct type', async ({ page }) => {
        await expect(page.locator('#loginPassword')).toHaveAttribute('type', 'password')
    })

    test('signup password has minlength of 6', async ({ page }) => {
        await expect(page.locator('#signupPassword')).toHaveAttribute('minlength', '6')
    })
})
