// XSS prevention utilities

/**
 * Escape HTML entities to prevent XSS attacks
 * @param {string} text - The text to escape
 * @returns {string} The escaped text
 */
export function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

/**
 * Validate hex color format to prevent CSS injection
 * @param {string} color - The color to validate
 * @returns {string} The validated color or default fallback
 */
export function validateColor(color) {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
    return hexColorRegex.test(color) ? color : '#667eea'
}
