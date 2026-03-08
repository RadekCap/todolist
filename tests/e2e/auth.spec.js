import { test, expect } from './fixtures.js'
import { test as base, expect as baseExpect } from '@playwright/test'

/**
 * Authenticated tests — require TEST_USER_EMAIL / TEST_USER_PASSWORD
 */
test.describe('Auth - Authenticated flows', () => {
    test('successful login shows app container and hides auth form', async ({ authedPage }) => {
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/)
        await expect(authedPage.locator('#authContainer')).not.toHaveClass(/active/)
        await expect(authedPage.locator('body')).toHaveClass(/fullscreen-mode/)
    })

    test('session persists across page reload', async ({ authedPage }) => {
        // Reload the page
        await authedPage.reload()

        // App should still be in authenticated state
        await expect(authedPage.locator('#appContainer')).toHaveClass(/active/, { timeout: 15000 })
        await expect(authedPage.locator('body')).toHaveClass(/fullscreen-mode/)
    })

    test('logout returns to auth form', async ({ authedPage }) => {
        // Open user menu and click logout
        await authedPage.click('#toolbarUserBtn')
        await authedPage.click('#logoutBtn')

        // Should return to auth form
        await expect(authedPage.locator('#authContainer')).toBeVisible({ timeout: 10000 })
        await expect(authedPage.locator('#loginForm')).toHaveClass(/active/)
        await expect(authedPage.locator('body')).not.toHaveClass(/fullscreen-mode/)
    })
})

/**
 * Unauthenticated tests — no credentials needed
 */
base.describe('Auth - Failed login', () => {
    base.beforeEach(async ({ page }) => {
        await page.goto('/')
    })

    base('invalid credentials shows error message', async ({ page }) => {
        await page.waitForSelector('#loginForm', { state: 'visible' })
        await page.fill('#loginEmail', 'nonexistent@example.com')
        await page.fill('#loginPassword', 'wrongpassword123')
        await page.click('#loginForm .auth-btn')

        // Should show error message
        await expect(page.locator('#authMessage .error-message')).toBeVisible({ timeout: 10000 })

        // Should still be on auth form, not app
        await expect(page.locator('#appContainer')).not.toHaveClass(/active/)
    })
})

base.describe('Auth - Signup form validation', () => {
    base.beforeEach(async ({ page }) => {
        await page.goto('/')
        // Switch to signup tab
        await page.click('[data-tab="signup"]')
        await expect(page.locator('#signupForm')).toHaveClass(/active/)
    })

    base('password mismatch shows error', async ({ page }) => {
        await page.fill('#signupEmail', 'test@example.com')
        await page.fill('#signupPassword', 'password123')
        await page.fill('#signupPasswordConfirm', 'differentpassword')
        await page.click('#signupForm .auth-btn')

        // Should show password mismatch error
        await expect(page.locator('#authMessage .error-message')).toBeVisible()
        await expect(page.locator('#authMessage')).toContainText('Passwords do not match')
    })

    base('password minimum length is enforced', async ({ page }) => {
        const passwordInput = page.locator('#signupPassword')
        await expect(passwordInput).toHaveAttribute('minlength', '6')
    })
})
