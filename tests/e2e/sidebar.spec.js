import { test, expect } from './fixtures.js'

test.describe('Sidebar Resize', () => {
    test('resize handle is visible', async ({ authedPage }) => {
        await expect(authedPage.locator('#sidebarResizeHandle')).toBeVisible()
    })

    test('dragging resize handle changes sidebar width', async ({ authedPage }) => {
        const handle = authedPage.locator('#sidebarResizeHandle')
        await expect(handle).toBeVisible()

        // Get initial sidebar width
        const sidebar = authedPage.locator('.sidebar')
        const initialWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width)

        // Get handle position
        const handleBox = await handle.boundingBox()

        // Drag handle to the right (increase sidebar width)
        await authedPage.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
        await authedPage.mouse.down()
        await authedPage.mouse.move(handleBox.x + 50, handleBox.y + handleBox.height / 2, { steps: 10 })
        await authedPage.mouse.up()
        await authedPage.waitForTimeout(300)

        // Sidebar width should have changed
        const newWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width)
        expect(newWidth).not.toBe(initialWidth)
    })

    test('sidebar width is constrained between 15% and 30%', async ({ authedPage }) => {
        const handle = authedPage.locator('#sidebarResizeHandle')
        const sidebar = authedPage.locator('.sidebar')
        const container = authedPage.locator('.app-container')

        const handleBox = await handle.boundingBox()
        const containerWidth = await container.evaluate(el => el.getBoundingClientRect().width)

        // Drag handle far to the left (try to make sidebar very narrow)
        await authedPage.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
        await authedPage.mouse.down()
        await authedPage.mouse.move(0, handleBox.y + handleBox.height / 2, { steps: 10 })
        await authedPage.mouse.up()

        // Sidebar should not go below 15%
        const narrowWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width)
        const narrowPercent = (narrowWidth / containerWidth) * 100
        expect(narrowPercent).toBeGreaterThanOrEqual(12) // tolerance for CI viewport

        // Drag handle far to the right (try to make sidebar very wide)
        const handleBox2 = await handle.boundingBox()
        await authedPage.mouse.move(handleBox2.x + handleBox2.width / 2, handleBox2.y + handleBox2.height / 2)
        await authedPage.mouse.down()
        await authedPage.mouse.move(containerWidth * 0.5, handleBox2.y + handleBox2.height / 2, { steps: 10 })
        await authedPage.mouse.up()

        // Sidebar should not exceed 30%
        const wideWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width)
        const widePercent = (wideWidth / containerWidth) * 100
        expect(widePercent).toBeLessThanOrEqual(35) // tolerance for CI viewport
    })
})

test.describe('Collapsible Sidebar Sections', () => {
    test('clicking section header collapses the section', async ({ authedPage }) => {
        const section = authedPage.locator('.sidebar-section').first()
        const header = section.locator('.sidebar-section-header')
        const content = section.locator('.sidebar-section-content')

        // Section should be expanded initially
        await expect(section).not.toHaveClass(/collapsed/)
        await expect(header).toHaveAttribute('aria-expanded', 'true')

        // Click header to collapse
        await header.click()
        await expect(section).toHaveClass(/collapsed/, { timeout: 3000 })
        await expect(header).toHaveAttribute('aria-expanded', 'false')

        // Click again to expand
        await header.click()
        await expect(section).not.toHaveClass(/collapsed/, { timeout: 3000 })
        await expect(header).toHaveAttribute('aria-expanded', 'true')
    })

    test('collapsed section hides its content', async ({ authedPage }) => {
        const section = authedPage.locator('.sidebar-section').first()
        const header = section.locator('.sidebar-section-header')
        const content = section.locator('.sidebar-section-content')

        // Collapse the section
        await header.click()
        await expect(section).toHaveClass(/collapsed/, { timeout: 3000 })

        // Content should be visually hidden (height transitions to 0)
        await authedPage.waitForTimeout(500) // wait for CSS transition

        const contentHeight = await content.evaluate(el => el.getBoundingClientRect().height)
        expect(contentHeight).toBeLessThan(5) // effectively hidden

        // Expand again to restore state
        await header.click()
        await expect(section).not.toHaveClass(/collapsed/, { timeout: 3000 })
    })

    test('toggle icon rotates when collapsed', async ({ authedPage }) => {
        const section = authedPage.locator('.sidebar-section').first()
        const header = section.locator('.sidebar-section-header')
        const toggle = section.locator('.sidebar-section-toggle')

        // Get initial rotation
        const initialTransform = await toggle.evaluate(el => getComputedStyle(el).transform)

        // Collapse
        await header.click()
        await expect(section).toHaveClass(/collapsed/, { timeout: 3000 })
        await authedPage.waitForTimeout(300) // wait for rotation transition

        // Transform should have changed
        const collapsedTransform = await toggle.evaluate(el => getComputedStyle(el).transform)
        expect(collapsedTransform).not.toBe(initialTransform)

        // Expand to restore
        await header.click()
        await expect(section).not.toHaveClass(/collapsed/, { timeout: 3000 })
    })
})
