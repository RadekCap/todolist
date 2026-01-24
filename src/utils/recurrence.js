/**
 * Recurrence calculation utilities for recurring todos
 *
 * Recurrence Rule Schema:
 * {
 *   type: 'daily' | 'weekly' | 'monthly' | 'yearly',
 *   interval: number,           // Every X days/weeks/months/years
 *   weekdays?: number[],        // For weekly: [0-6] (Sun-Sat)
 *   dayType?: 'day_of_month' | 'weekday' | 'last_day',  // For monthly/yearly
 *   dayOfMonth?: number,        // 1-31
 *   weekdayOrdinal?: number,    // 1=first, 2=second, -1=last
 *   weekday?: number,           // 0-6 for specific weekday
 *   month?: number,             // 1-12 for yearly
 *   startDate: string           // ISO date YYYY-MM-DD
 * }
 */

/**
 * Parse a date string (YYYY-MM-DD) into a Date object at midnight local time
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Date}
 */
function parseDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
}

/**
 * Format a Date object as YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string}
 */
function formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Get the last day of a month
 * @param {number} year
 * @param {number} month - 0-indexed (0 = January)
 * @returns {number}
 */
function getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate()
}

/**
 * Find the nth weekday of a month (e.g., 2nd Tuesday)
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {number} weekday - 0-6 (Sun-Sat)
 * @param {number} ordinal - 1-5 for first through fifth, -1 for last
 * @returns {Date|null}
 */
function getNthWeekdayOfMonth(year, month, weekday, ordinal) {
    if (ordinal === -1) {
        // Find last occurrence
        const lastDay = getLastDayOfMonth(year, month)
        for (let day = lastDay; day >= 1; day--) {
            const date = new Date(year, month, day)
            if (date.getDay() === weekday) {
                return date
            }
        }
        return null
    }

    // Find nth occurrence
    let count = 0
    for (let day = 1; day <= 31; day++) {
        const date = new Date(year, month, day)
        // Stop if we've gone past this month
        if (date.getMonth() !== month) break

        if (date.getDay() === weekday) {
            count++
            if (count === ordinal) {
                return date
            }
        }
    }
    return null
}

/**
 * Calculate the next occurrence date from a given date based on recurrence rule
 * @param {Object} rule - Recurrence rule object
 * @param {string} fromDate - Start date in YYYY-MM-DD format
 * @returns {string|null} Next occurrence date in YYYY-MM-DD format, or null if invalid
 */
export function calculateNextOccurrence(rule, fromDate) {
    if (!rule || !rule.type || !fromDate) return null

    const current = parseDate(fromDate)
    const interval = rule.interval || 1

    switch (rule.type) {
        case 'daily': {
            const next = new Date(current)
            next.setDate(next.getDate() + interval)
            return formatDate(next)
        }

        case 'weekly': {
            const weekdays = rule.weekdays || [current.getDay()]
            if (weekdays.length === 0) return null

            // Sort weekdays for easier calculation
            const sortedWeekdays = [...weekdays].sort((a, b) => a - b)
            const currentDay = current.getDay()

            // Find next weekday in the current week
            let next = new Date(current)
            for (const wd of sortedWeekdays) {
                if (wd > currentDay) {
                    next.setDate(current.getDate() + (wd - currentDay))
                    return formatDate(next)
                }
            }

            // Move to first weekday of next interval week
            const daysUntilNextWeek = 7 - currentDay + sortedWeekdays[0]
            next.setDate(current.getDate() + daysUntilNextWeek + (interval - 1) * 7)
            return formatDate(next)
        }

        case 'monthly': {
            const dayType = rule.dayType || 'day_of_month'
            let next = new Date(current)

            // Move to next interval month
            next.setMonth(next.getMonth() + interval)

            if (dayType === 'day_of_month') {
                const targetDay = rule.dayOfMonth || current.getDate()
                const lastDay = getLastDayOfMonth(next.getFullYear(), next.getMonth())
                next.setDate(Math.min(targetDay, lastDay))
            } else if (dayType === 'weekday') {
                const targetWeekday = rule.weekday ?? current.getDay()
                const ordinal = rule.weekdayOrdinal || 1
                const result = getNthWeekdayOfMonth(next.getFullYear(), next.getMonth(), targetWeekday, ordinal)
                if (result) next = result
            } else if (dayType === 'last_day') {
                next.setDate(getLastDayOfMonth(next.getFullYear(), next.getMonth()))
            }

            return formatDate(next)
        }

        case 'yearly': {
            const dayType = rule.dayType || 'day_of_month'
            let next = new Date(current)

            // Move to next interval year
            next.setFullYear(next.getFullYear() + interval)

            // Set month if specified
            if (rule.month !== undefined) {
                next.setMonth(rule.month - 1) // month is 1-indexed in rule
            }

            if (dayType === 'day_of_month') {
                const targetDay = rule.dayOfMonth || current.getDate()
                const lastDay = getLastDayOfMonth(next.getFullYear(), next.getMonth())
                next.setDate(Math.min(targetDay, lastDay))
            } else if (dayType === 'weekday') {
                const targetWeekday = rule.weekday ?? current.getDay()
                const ordinal = rule.weekdayOrdinal || 1
                const result = getNthWeekdayOfMonth(next.getFullYear(), next.getMonth(), targetWeekday, ordinal)
                if (result) next = result
            } else if (dayType === 'last_day') {
                next.setDate(getLastDayOfMonth(next.getFullYear(), next.getMonth()))
            }

            return formatDate(next)
        }

        default:
            return null
    }
}

/**
 * Get the next N occurrences for preview display
 * @param {Object} rule - Recurrence rule object
 * @param {number} n - Number of occurrences to generate
 * @param {string} startDate - Start date in YYYY-MM-DD format (optional, defaults to today)
 * @returns {string[]} Array of dates in YYYY-MM-DD format
 */
export function getNextNOccurrences(rule, n, startDate) {
    if (!rule || !rule.type || n <= 0) return []

    const start = startDate || formatDate(new Date())
    const occurrences = []
    let current = start

    for (let i = 0; i < n && i < 10; i++) { // Cap at 10 for safety
        const next = calculateNextOccurrence(rule, current)
        if (!next) break
        occurrences.push(next)
        current = next
    }

    return occurrences
}

/**
 * Format a recurrence rule as human-readable text
 * @param {Object} rule - Recurrence rule object
 * @returns {string} Human-readable description
 */
export function formatRecurrenceSummary(rule) {
    if (!rule || !rule.type) return 'No recurrence'

    const interval = rule.interval || 1
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December']
    const ordinalNames = ['first', 'second', 'third', 'fourth', 'fifth', 'last']

    switch (rule.type) {
        case 'daily': {
            if (interval === 1) return 'Every day'
            return `Every ${interval} days`
        }

        case 'weekly': {
            const weekdays = rule.weekdays || []
            const dayList = weekdays.map(d => dayNames[d]).join(', ')
            if (interval === 1) {
                return weekdays.length > 0 ? `Every week on ${dayList}` : 'Every week'
            }
            return weekdays.length > 0
                ? `Every ${interval} weeks on ${dayList}`
                : `Every ${interval} weeks`
        }

        case 'monthly': {
            const dayType = rule.dayType || 'day_of_month'
            let dayDesc = ''

            if (dayType === 'day_of_month') {
                dayDesc = `day ${rule.dayOfMonth || 1}`
            } else if (dayType === 'weekday') {
                const ordinal = rule.weekdayOrdinal === -1 ? 'last' : ordinalNames[(rule.weekdayOrdinal || 1) - 1]
                dayDesc = `${ordinal} ${dayNames[rule.weekday ?? 0]}`
            } else if (dayType === 'last_day') {
                dayDesc = 'last day'
            }

            if (interval === 1) return `Every month on the ${dayDesc}`
            return `Every ${interval} months on the ${dayDesc}`
        }

        case 'yearly': {
            const dayType = rule.dayType || 'day_of_month'
            const month = monthNames[(rule.month || 1) - 1]
            let dayDesc = ''

            if (dayType === 'day_of_month') {
                dayDesc = `${rule.dayOfMonth || 1}`
            } else if (dayType === 'weekday') {
                const ordinal = rule.weekdayOrdinal === -1 ? 'last' : ordinalNames[(rule.weekdayOrdinal || 1) - 1]
                dayDesc = `${ordinal} ${dayNames[rule.weekday ?? 0]}`
            } else if (dayType === 'last_day') {
                dayDesc = 'last day'
            }

            if (interval === 1) return `Every year on ${month} ${dayDesc}`
            return `Every ${interval} years on ${month} ${dayDesc}`
        }

        default:
            return 'Custom recurrence'
    }
}

/**
 * Check if a recurrence has reached its end condition
 * @param {Object} template - Template todo object with recurrence settings
 * @returns {boolean} True if recurrence has ended
 */
export function isRecurrenceEnded(template) {
    if (!template) return true

    const endType = template.recurrence_end_type

    if (!endType || endType === 'never') return false

    if (endType === 'on_date' && template.recurrence_end_date) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const endDate = parseDate(template.recurrence_end_date)
        return today > endDate
    }

    if (endType === 'after_count' && template.recurrence_end_count) {
        return (template.recurrence_count || 0) >= template.recurrence_end_count
    }

    return false
}

/**
 * Validate a recurrence rule object
 * @param {Object} rule - Recurrence rule to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateRecurrenceRule(rule) {
    if (!rule) return { valid: false, error: 'Rule is required' }

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(rule.type)) {
        return { valid: false, error: 'Invalid recurrence type' }
    }

    if (!rule.interval || rule.interval < 1 || rule.interval > 365) {
        return { valid: false, error: 'Interval must be between 1 and 365' }
    }

    if (rule.type === 'weekly') {
        if (rule.weekdays && (!Array.isArray(rule.weekdays) || rule.weekdays.length === 0)) {
            return { valid: false, error: 'At least one weekday must be selected for weekly recurrence' }
        }
        if (rule.weekdays && rule.weekdays.some(d => d < 0 || d > 6)) {
            return { valid: false, error: 'Weekdays must be between 0 (Sun) and 6 (Sat)' }
        }
    }

    if (rule.type === 'monthly' || rule.type === 'yearly') {
        if (rule.dayType && !['day_of_month', 'weekday', 'last_day'].includes(rule.dayType)) {
            return { valid: false, error: 'Invalid day type' }
        }
        if (rule.dayOfMonth && (rule.dayOfMonth < 1 || rule.dayOfMonth > 31)) {
            return { valid: false, error: 'Day of month must be between 1 and 31' }
        }
        if (rule.weekday !== undefined && (rule.weekday < 0 || rule.weekday > 6)) {
            return { valid: false, error: 'Weekday must be between 0 (Sun) and 6 (Sat)' }
        }
        if (rule.weekdayOrdinal && ![1, 2, 3, 4, 5, -1].includes(rule.weekdayOrdinal)) {
            return { valid: false, error: 'Ordinal must be 1-5 or -1 (last)' }
        }
    }

    if (rule.type === 'yearly') {
        if (rule.month && (rule.month < 1 || rule.month > 12)) {
            return { valid: false, error: 'Month must be between 1 and 12' }
        }
    }

    return { valid: true }
}

/**
 * Build a recurrence rule from form values
 * @param {Object} formValues - Form values
 * @returns {Object|null} Recurrence rule or null if no recurrence
 */
export function buildRecurrenceRule(formValues) {
    if (!formValues.type || formValues.type === 'none') return null

    const rule = {
        type: formValues.type,
        interval: parseInt(formValues.interval, 10) || 1,
        startDate: formValues.startDate || formatDate(new Date())
    }

    if (formValues.type === 'weekly' && formValues.weekdays) {
        rule.weekdays = formValues.weekdays
    }

    if (formValues.type === 'monthly' || formValues.type === 'yearly') {
        rule.dayType = formValues.dayType || 'day_of_month'

        if (rule.dayType === 'day_of_month') {
            rule.dayOfMonth = parseInt(formValues.dayOfMonth, 10) || 1
        } else if (rule.dayType === 'weekday') {
            rule.weekdayOrdinal = parseInt(formValues.weekdayOrdinal, 10) || 1
            rule.weekday = parseInt(formValues.weekday, 10) || 0
        }
    }

    if (formValues.type === 'yearly' && formValues.month) {
        rule.month = parseInt(formValues.month, 10)
    }

    return rule
}

/**
 * Format a date for preview display
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatPreviewDate(dateString) {
    const date = parseDate(dateString)
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    })
}
