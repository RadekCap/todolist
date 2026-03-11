import { expect } from '@playwright/test'

/**
 * Log in to the app using email/password form.
 * Waits for the app container to become visible after login.
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
export async function login(page, email, password) {
    await page.goto('/')

    // Wait for auth form to be ready
    await page.waitForSelector('#loginForm', { state: 'visible' })

    await page.fill('#loginEmail', email)
    await page.fill('#loginPassword', password)

    // Click login and wait for the auth network response
    await Promise.all([
        page.waitForResponse(resp => resp.url().includes('supabase') && resp.url().includes('token'), { timeout: 30000 }),
        page.click('#loginForm .auth-btn')
    ])

    // Wait for app to load after login
    await expect(page.locator('#appContainer')).toHaveClass(/active/, { timeout: 30000 })
    await expect(page.locator('body')).toHaveClass(/fullscreen-mode/, { timeout: 10000 })
}
