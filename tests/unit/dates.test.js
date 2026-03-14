// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    formatDateBadge,
    getDateGroup,
    getDateGroupLabel
} from '../../src/utils/dates.js'

// ─── getDateGroup ─────────────────────────────────────────────────────────────

describe('getDateGroup', () => {
    // Fixed date: 2025-03-14 (Friday, day 5)
    // daysUntilEndOfWeek = 7 - 5 = 2
    // So "this-week" covers diffDays 2 (i.e. Sunday 2025-03-16)
    // "next-week" covers diffDays 3..9 (Mon 2025-03-17 through Sun 2025-03-23)

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2025, 2, 14, 12, 0, 0)) // March 14, 2025, noon
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('overdue dates', () => {
        it('returns "overdue" for yesterday', () => {
            expect(getDateGroup('2025-03-13')).toBe('overdue')
        })

        it('returns "overdue" for a date far in the past', () => {
            expect(getDateGroup('2024-01-01')).toBe('overdue')
        })

        it('returns "overdue" for one day ago', () => {
            expect(getDateGroup('2025-03-13')).toBe('overdue')
        })
    })

    describe('today', () => {
        it('returns "today" for the current date', () => {
            expect(getDateGroup('2025-03-14')).toBe('today')
        })
    })

    describe('tomorrow', () => {
        it('returns "tomorrow" for the next day', () => {
            expect(getDateGroup('2025-03-15')).toBe('tomorrow')
        })
    })

    describe('this week', () => {
        it('returns "this-week" for Sunday (2 days from Friday)', () => {
            // diffDays = 2, daysUntilEndOfWeek = 2, so 2 <= 2 => this-week
            expect(getDateGroup('2025-03-16')).toBe('this-week')
        })
    })

    describe('next week', () => {
        it('returns "next-week" for Monday of next week', () => {
            // diffDays = 3, daysUntilEndOfWeek = 2, 3 > 2 but 3 <= 2+7=9 => next-week
            expect(getDateGroup('2025-03-17')).toBe('next-week')
        })

        it('returns "next-week" for Sunday of next week', () => {
            // diffDays = 9, 9 <= 9 => next-week
            expect(getDateGroup('2025-03-23')).toBe('next-week')
        })
    })

    describe('later', () => {
        it('returns "later" for a date beyond next week', () => {
            // diffDays = 10, 10 > 9 => later
            expect(getDateGroup('2025-03-24')).toBe('later')
        })

        it('returns "later" for a date far in the future', () => {
            expect(getDateGroup('2026-01-01')).toBe('later')
        })
    })

    describe('different day of week as base', () => {
        it('handles Monday as current day correctly', () => {
            // Set to Monday March 10, 2025
            vi.setSystemTime(new Date(2025, 2, 10, 12, 0, 0))
            // dayOfWeek = 1, daysUntilEndOfWeek = 6
            // Tuesday March 11 => diffDays = 1 => tomorrow
            expect(getDateGroup('2025-03-11')).toBe('tomorrow')
            // Sunday March 16 => diffDays = 6 => this-week (6 <= 6)
            expect(getDateGroup('2025-03-16')).toBe('this-week')
            // Monday March 17 => diffDays = 7 => next-week (7 <= 6+7=13)
            expect(getDateGroup('2025-03-17')).toBe('next-week')
        })

        it('handles Sunday as current day correctly', () => {
            // Set to Sunday March 16, 2025
            vi.setSystemTime(new Date(2025, 2, 16, 12, 0, 0))
            // dayOfWeek = 0, daysUntilEndOfWeek = 7
            // Saturday March 22 => diffDays = 6 => this-week (6 <= 7)
            expect(getDateGroup('2025-03-22')).toBe('this-week')
        })
    })
})

// ─── getDateGroupLabel ────────────────────────────────────────────────────────

describe('getDateGroupLabel', () => {
    it('returns "Overdue" for overdue group', () => {
        expect(getDateGroupLabel('overdue')).toBe('Overdue')
    })

    it('returns "Today" for today group', () => {
        expect(getDateGroupLabel('today')).toBe('Today')
    })

    it('returns "Tomorrow" for tomorrow group', () => {
        expect(getDateGroupLabel('tomorrow')).toBe('Tomorrow')
    })

    it('returns "This Week" for this-week group', () => {
        expect(getDateGroupLabel('this-week')).toBe('This Week')
    })

    it('returns "Next Week" for next-week group', () => {
        expect(getDateGroupLabel('next-week')).toBe('Next Week')
    })

    it('returns "Later" for later group', () => {
        expect(getDateGroupLabel('later')).toBe('Later')
    })

    it('returns "No Date" for no-date group', () => {
        expect(getDateGroupLabel('no-date')).toBe('No Date')
    })

    it('returns the group string itself for unknown groups', () => {
        expect(getDateGroupLabel('unknown-group')).toBe('unknown-group')
    })

    it('returns empty string for empty string input', () => {
        expect(getDateGroupLabel('')).toBe('')
    })
})

// ─── formatDateBadge ──────────────────────────────────────────────────────────

describe('formatDateBadge', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2025, 2, 14, 12, 0, 0)) // March 14, 2025, noon
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('overdue dates', () => {
        it('shows "Yesterday" for one day ago', () => {
            const result = formatDateBadge('2025-03-13')
            expect(result).toContain('Yesterday')
            expect(result).toContain('overdue')
        })

        it('shows "N days ago" for multiple days overdue', () => {
            const result = formatDateBadge('2025-03-11')
            expect(result).toContain('3 days ago')
            expect(result).toContain('overdue')
        })

        it('adds overdue class for past dates', () => {
            const result = formatDateBadge('2025-03-10')
            expect(result).toContain('class="todo-date overdue"')
        })
    })

    describe('today', () => {
        it('shows "Today" for the current date', () => {
            const result = formatDateBadge('2025-03-14')
            expect(result).toContain('Today')
            expect(result).toContain('class="todo-date today"')
        })
    })

    describe('tomorrow', () => {
        it('shows "Tomorrow" for the next day', () => {
            const result = formatDateBadge('2025-03-15')
            expect(result).toContain('Tomorrow')
        })

        it('does not add special class for tomorrow', () => {
            const result = formatDateBadge('2025-03-15')
            expect(result).toContain('class="todo-date"')
        })
    })

    describe('upcoming dates within a week', () => {
        it('shows "In 2 days" for two days ahead', () => {
            const result = formatDateBadge('2025-03-16')
            expect(result).toContain('In 2 days')
        })

        it('shows "In 7 days" for exactly one week', () => {
            const result = formatDateBadge('2025-03-21')
            expect(result).toContain('In 7 days')
        })

        it('shows "In 3 days" for three days ahead', () => {
            const result = formatDateBadge('2025-03-17')
            expect(result).toContain('In 3 days')
        })
    })

    describe('dates more than a week away', () => {
        it('shows formatted date with month and day', () => {
            const result = formatDateBadge('2025-03-22')
            expect(result).toContain('Mar')
            expect(result).toContain('22')
        })

        it('shows formatted date for a different month', () => {
            const result = formatDateBadge('2025-04-15')
            expect(result).toContain('Apr')
            expect(result).toContain('15')
        })

        it('shows formatted date for a far future date', () => {
            const result = formatDateBadge('2025-12-25')
            expect(result).toContain('Dec')
            expect(result).toContain('25')
        })
    })

    describe('HTML structure', () => {
        it('wraps output in a span element', () => {
            const result = formatDateBadge('2025-03-14')
            expect(result).toMatch(/^<span class="[^"]*">.*<\/span>$/)
        })

        it('escapes HTML in labels', () => {
            // The function uses escapeHtml, so the output should be safe
            // All labels are internally generated so they are safe, but verify the structure
            const result = formatDateBadge('2025-03-14')
            expect(result).toContain('<span')
            expect(result).toContain('</span>')
        })
    })

    describe('edge cases', () => {
        it('handles year boundary correctly', () => {
            vi.setSystemTime(new Date(2025, 11, 30, 12, 0, 0)) // Dec 30, 2025
            const result = formatDateBadge('2026-01-01')
            expect(result).toContain('In 2 days')
        })

        it('handles large overdue values', () => {
            const result = formatDateBadge('2025-01-14')
            // 59 days ago
            expect(result).toContain('59 days ago')
            expect(result).toContain('overdue')
        })
    })
})
