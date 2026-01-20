import { escapeHtml } from './security.js'

/**
 * Format a date string into a badge HTML string with relative display
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} HTML string for the date badge
 */
export function formatDateBadge(dateString) {
    // Parse dateString as YYYY-MM-DD in a timezone-agnostic way
    const [year, month, day] = dateString.split('-')
    const dueDate = new Date(year, month - 1, day)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const diffTime = dueDate - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    let className = 'todo-date'
    let label = ''

    if (diffDays < 0) {
        className += ' overdue'
        label = diffDays === -1 ? 'Yesterday' : `${Math.abs(diffDays)} days ago`
    } else if (diffDays === 0) {
        className += ' today'
        label = 'Today'
    } else if (diffDays === 1) {
        label = 'Tomorrow'
    } else if (diffDays <= 7) {
        label = `In ${diffDays} days`
    } else {
        // Format as readable date with consistent format
        const monthName = dueDate.toLocaleDateString('en-US', { month: 'short' })
        const dayNum = dueDate.getDate()
        label = `${monthName} ${dayNum}`
    }

    return `<span class="${className}">${escapeHtml(label)}</span>`
}

/**
 * Get date group for Scheduled view section headers
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Group identifier: 'overdue', 'today', 'tomorrow', 'this-week', 'next-week', or 'later'
 */
export function getDateGroup(dateString) {
    const [year, month, day] = dateString.split('-')
    const dueDate = new Date(year, month - 1, day)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const diffTime = dueDate - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Calculate end of this week (Sunday)
    const dayOfWeek = today.getDay()
    const daysUntilEndOfWeek = 7 - dayOfWeek

    if (diffDays < 0) {
        return 'overdue'
    } else if (diffDays === 0) {
        return 'today'
    } else if (diffDays === 1) {
        return 'tomorrow'
    } else if (diffDays <= daysUntilEndOfWeek) {
        return 'this-week'
    } else if (diffDays <= daysUntilEndOfWeek + 7) {
        return 'next-week'
    } else {
        return 'later'
    }
}

/**
 * Get human-readable label for a date group
 * @param {string} group - Group identifier
 * @returns {string} Human-readable label
 */
export function getDateGroupLabel(group) {
    const labels = {
        'overdue': 'Overdue',
        'today': 'Today',
        'tomorrow': 'Tomorrow',
        'this-week': 'This Week',
        'next-week': 'Next Week',
        'later': 'Later'
    }
    return labels[group] || group
}
