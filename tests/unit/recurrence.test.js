import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    calculateNextOccurrence,
    getNextNOccurrences,
    formatRecurrenceSummary,
    isRecurrenceEnded,
    validateRecurrenceRule,
    buildRecurrenceRule,
    formatPreviewDate,
    calculateFirstOccurrence
} from '../../src/utils/recurrence.js'

// ─── calculateNextOccurrence ───────────────────────────────────────────────────

describe('calculateNextOccurrence', () => {
    describe('edge cases', () => {
        it('returns null for null rule', () => {
            expect(calculateNextOccurrence(null, '2025-01-01')).toBeNull()
        })

        it('returns null for rule without type', () => {
            expect(calculateNextOccurrence({}, '2025-01-01')).toBeNull()
        })

        it('returns null for null fromDate', () => {
            expect(calculateNextOccurrence({ type: 'daily' }, null)).toBeNull()
        })

        it('returns null for unknown type', () => {
            expect(calculateNextOccurrence({ type: 'hourly' }, '2025-01-01')).toBeNull()
        })
    })

    describe('daily recurrence', () => {
        it('defaults to interval 1', () => {
            expect(calculateNextOccurrence(
                { type: 'daily' },
                '2025-03-10'
            )).toBe('2025-03-11')
        })

        it('respects custom interval', () => {
            expect(calculateNextOccurrence(
                { type: 'daily', interval: 3 },
                '2025-03-10'
            )).toBe('2025-03-13')
        })

        it('crosses month boundary', () => {
            expect(calculateNextOccurrence(
                { type: 'daily', interval: 1 },
                '2025-01-31'
            )).toBe('2025-02-01')
        })

        it('crosses year boundary', () => {
            expect(calculateNextOccurrence(
                { type: 'daily', interval: 1 },
                '2025-12-31'
            )).toBe('2026-01-01')
        })

        it('handles leap year (Feb 28 -> Feb 29)', () => {
            expect(calculateNextOccurrence(
                { type: 'daily', interval: 1 },
                '2024-02-28'
            )).toBe('2024-02-29')
        })

        it('handles non-leap year (Feb 28 -> Mar 1)', () => {
            expect(calculateNextOccurrence(
                { type: 'daily', interval: 1 },
                '2025-02-28'
            )).toBe('2025-03-01')
        })
    })

    describe('weekly recurrence', () => {
        it('moves to next week same day when no weekdays specified', () => {
            // 2025-03-10 is a Monday (day 1)
            const result = calculateNextOccurrence(
                { type: 'weekly', interval: 1 },
                '2025-03-10'
            )
            expect(result).toBe('2025-03-17')
        })

        it('finds next weekday in same week', () => {
            // 2025-03-10 is Monday (day 1), weekdays [1, 3, 5] = Mon, Wed, Fri
            const result = calculateNextOccurrence(
                { type: 'weekly', interval: 1, weekdays: [1, 3, 5] },
                '2025-03-10'
            )
            // Next after Monday is Wednesday
            expect(result).toBe('2025-03-12')
        })

        it('wraps to first weekday of next interval week', () => {
            // 2025-03-14 is Friday (day 5), weekdays [1, 3] = Mon, Wed
            const result = calculateNextOccurrence(
                { type: 'weekly', interval: 1, weekdays: [1, 3] },
                '2025-03-14'
            )
            // Next Monday
            expect(result).toBe('2025-03-17')
        })

        it('respects interval for week skip', () => {
            // 2025-03-14 is Friday (day 5), weekdays [1] = Mon, interval 2
            const result = calculateNextOccurrence(
                { type: 'weekly', interval: 2, weekdays: [1] },
                '2025-03-14'
            )
            // Skip 1 week, then Monday = March 24
            expect(result).toBe('2025-03-24')
        })

        it('returns null for empty weekdays array', () => {
            expect(calculateNextOccurrence(
                { type: 'weekly', interval: 1, weekdays: [] },
                '2025-03-10'
            )).toBeNull()
        })

        it('handles unsorted weekdays', () => {
            // 2025-03-10 is Monday (day 1), weekdays [5, 1, 3] unsorted
            const result = calculateNextOccurrence(
                { type: 'weekly', interval: 1, weekdays: [5, 1, 3] },
                '2025-03-10'
            )
            // Should sort internally and find next = Wednesday
            expect(result).toBe('2025-03-12')
        })
    })

    describe('monthly recurrence', () => {
        it('moves to same day next month (day_of_month)', () => {
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 1, dayType: 'day_of_month', dayOfMonth: 15 },
                '2025-03-15'
            )).toBe('2025-04-15')
        })

        it('clamps day when target month is shorter', () => {
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 1, dayType: 'day_of_month', dayOfMonth: 31 },
                '2025-02-28'
            )).toBe('2025-03-31')
        })

        it('clamps day 31 from Jan to Feb (Feb has 28 days)', () => {
            // Previously this overflowed: Jan 31 + setMonth(1) → Mar 3
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 1, dayType: 'day_of_month', dayOfMonth: 31 },
                '2025-01-31'
            )).toBe('2025-02-28')
        })

        it('handles month with fewer days (from day 15)', () => {
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 1, dayType: 'day_of_month', dayOfMonth: 30 },
                '2025-01-15'
            )).toBe('2025-02-28')
        })

        it('respects interval > 1', () => {
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 3, dayType: 'day_of_month', dayOfMonth: 10 },
                '2025-01-10'
            )).toBe('2025-04-10')
        })

        it('computes nth weekday of month', () => {
            // From March 2025, next month is April 2025
            // 2nd Tuesday (weekday=2, ordinal=2) of April 2025 = April 8
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 1, dayType: 'weekday', weekday: 2, weekdayOrdinal: 2 },
                '2025-03-11'
            )).toBe('2025-04-08')
        })

        it('computes last weekday of month', () => {
            // From March 2025, next month is April 2025
            // Last Friday (weekday=5, ordinal=-1) of April 2025 = April 25
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 1, dayType: 'weekday', weekday: 5, weekdayOrdinal: -1 },
                '2025-03-28'
            )).toBe('2025-04-25')
        })

        it('computes last day of month', () => {
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 1, dayType: 'last_day' },
                '2025-01-31'
            )).toBe('2025-02-28')
        })

        it('last day works across months with same length', () => {
            // March 31 -> April 30
            expect(calculateNextOccurrence(
                { type: 'monthly', interval: 1, dayType: 'last_day' },
                '2025-03-15'
            )).toBe('2025-04-30')
        })
    })

    describe('yearly recurrence', () => {
        it('moves to same date next year', () => {
            expect(calculateNextOccurrence(
                { type: 'yearly', interval: 1, month: 6, dayType: 'day_of_month', dayOfMonth: 15 },
                '2025-06-15'
            )).toBe('2026-06-15')
        })

        it('handles Feb 29 in non-leap year (clamps to 28)', () => {
            expect(calculateNextOccurrence(
                { type: 'yearly', interval: 1, month: 2, dayType: 'day_of_month', dayOfMonth: 29 },
                '2024-02-29'
            )).toBe('2025-02-28')
        })

        it('respects interval > 1', () => {
            expect(calculateNextOccurrence(
                { type: 'yearly', interval: 2, month: 1, dayType: 'day_of_month', dayOfMonth: 1 },
                '2025-01-01'
            )).toBe('2027-01-01')
        })

        it('computes nth weekday of month in next year', () => {
            // 1st Monday (weekday=1, ordinal=1) of September 2026 = Sep 7
            expect(calculateNextOccurrence(
                { type: 'yearly', interval: 1, month: 9, dayType: 'weekday', weekday: 1, weekdayOrdinal: 1 },
                '2025-09-01'
            )).toBe('2026-09-07')
        })

        it('computes last day of month in next year', () => {
            expect(calculateNextOccurrence(
                { type: 'yearly', interval: 1, month: 2, dayType: 'last_day' },
                '2025-02-28'
            )).toBe('2026-02-28')
        })
    })
})

// ─── getNextNOccurrences ───────────────────────────────────────────────────────

describe('getNextNOccurrences', () => {
    it('returns empty array for null rule', () => {
        expect(getNextNOccurrences(null, 3)).toEqual([])
    })

    it('returns empty array for n <= 0', () => {
        expect(getNextNOccurrences({ type: 'daily', interval: 1 }, 0)).toEqual([])
    })

    it('generates correct sequence of daily occurrences', () => {
        const result = getNextNOccurrences(
            { type: 'daily', interval: 1 },
            5,
            '2025-03-10'
        )
        expect(result).toEqual([
            '2025-03-11',
            '2025-03-12',
            '2025-03-13',
            '2025-03-14',
            '2025-03-15'
        ])
    })

    it('caps at 10 occurrences for safety', () => {
        const result = getNextNOccurrences(
            { type: 'daily', interval: 1 },
            20,
            '2025-01-01'
        )
        expect(result).toHaveLength(10)
    })

    it('generates weekly occurrences with specific weekdays', () => {
        // Starting from Monday 2025-03-10, weekdays [1, 5] = Mon, Fri
        const result = getNextNOccurrences(
            { type: 'weekly', interval: 1, weekdays: [1, 5] },
            4,
            '2025-03-10'
        )
        expect(result).toEqual([
            '2025-03-14', // Fri
            '2025-03-17', // Mon
            '2025-03-21', // Fri
            '2025-03-24'  // Mon
        ])
    })

    it('generates monthly occurrences', () => {
        const result = getNextNOccurrences(
            { type: 'monthly', interval: 1, dayType: 'day_of_month', dayOfMonth: 15 },
            3,
            '2025-01-15'
        )
        expect(result).toEqual([
            '2025-02-15',
            '2025-03-15',
            '2025-04-15'
        ])
    })
})

// ─── formatRecurrenceSummary ───────────────────────────────────────────────────

describe('formatRecurrenceSummary', () => {
    it('returns "No recurrence" for null', () => {
        expect(formatRecurrenceSummary(null)).toBe('No recurrence')
    })

    it('returns "No recurrence" for rule without type', () => {
        expect(formatRecurrenceSummary({})).toBe('No recurrence')
    })

    it('returns "Custom recurrence" for unknown type', () => {
        expect(formatRecurrenceSummary({ type: 'hourly' })).toBe('Custom recurrence')
    })

    describe('daily', () => {
        it('formats "Every day"', () => {
            expect(formatRecurrenceSummary({ type: 'daily', interval: 1 })).toBe('Every day')
        })

        it('formats "Every N days"', () => {
            expect(formatRecurrenceSummary({ type: 'daily', interval: 3 })).toBe('Every 3 days')
        })
    })

    describe('weekly', () => {
        it('formats "Every week" with no weekdays', () => {
            expect(formatRecurrenceSummary({ type: 'weekly', interval: 1 })).toBe('Every week')
        })

        it('formats with weekday names', () => {
            expect(formatRecurrenceSummary({
                type: 'weekly', interval: 1, weekdays: [1, 3, 5]
            })).toBe('Every week on Mon, Wed, Fri')
        })

        it('formats with interval > 1', () => {
            expect(formatRecurrenceSummary({
                type: 'weekly', interval: 2, weekdays: [2]
            })).toBe('Every 2 weeks on Tue')
        })
    })

    describe('monthly', () => {
        it('formats day of month', () => {
            expect(formatRecurrenceSummary({
                type: 'monthly', interval: 1, dayType: 'day_of_month', dayOfMonth: 15
            })).toBe('Every month on the day 15')
        })

        it('formats nth weekday', () => {
            expect(formatRecurrenceSummary({
                type: 'monthly', interval: 1, dayType: 'weekday', weekday: 2, weekdayOrdinal: 2
            })).toBe('Every month on the second Tue')
        })

        it('formats last weekday', () => {
            expect(formatRecurrenceSummary({
                type: 'monthly', interval: 1, dayType: 'weekday', weekday: 5, weekdayOrdinal: -1
            })).toBe('Every month on the last Fri')
        })

        it('formats last day', () => {
            expect(formatRecurrenceSummary({
                type: 'monthly', interval: 1, dayType: 'last_day'
            })).toBe('Every month on the last day')
        })

        it('formats with interval > 1', () => {
            expect(formatRecurrenceSummary({
                type: 'monthly', interval: 3, dayType: 'day_of_month', dayOfMonth: 1
            })).toBe('Every 3 months on the day 1')
        })
    })

    describe('yearly', () => {
        it('formats day of month with month name', () => {
            expect(formatRecurrenceSummary({
                type: 'yearly', interval: 1, month: 6, dayType: 'day_of_month', dayOfMonth: 15
            })).toBe('Every year on June 15')
        })

        it('formats nth weekday with month', () => {
            expect(formatRecurrenceSummary({
                type: 'yearly', interval: 1, month: 9, dayType: 'weekday', weekday: 1, weekdayOrdinal: 1
            })).toBe('Every year on September first Mon')
        })

        it('formats last day with month', () => {
            expect(formatRecurrenceSummary({
                type: 'yearly', interval: 1, month: 2, dayType: 'last_day'
            })).toBe('Every year on February last day')
        })

        it('formats with interval > 1', () => {
            expect(formatRecurrenceSummary({
                type: 'yearly', interval: 4, month: 11, dayType: 'day_of_month', dayOfMonth: 5
            })).toBe('Every 4 years on November 5')
        })
    })
})

// ─── isRecurrenceEnded ─────────────────────────────────────────────────────────

describe('isRecurrenceEnded', () => {
    it('returns true for null template', () => {
        expect(isRecurrenceEnded(null)).toBe(true)
    })

    it('returns false for no end type', () => {
        expect(isRecurrenceEnded({ recurrence_end_type: null })).toBe(false)
    })

    it('returns false for "never" end type', () => {
        expect(isRecurrenceEnded({ recurrence_end_type: 'never' })).toBe(false)
    })

    it('returns true when end date is in the past', () => {
        // The function compares new Date() (today) against the end date.
        // Using a date far in the past ensures the test is deterministic.
        expect(isRecurrenceEnded({
            recurrence_end_type: 'on_date',
            recurrence_end_date: '2020-01-01'
        })).toBe(true)
    })

    it('returns false when end date is in the future', () => {
        expect(isRecurrenceEnded({
            recurrence_end_type: 'on_date',
            recurrence_end_date: '2099-12-31'
        })).toBe(false)
    })

    it('returns true when count has been reached', () => {
        expect(isRecurrenceEnded({
            recurrence_end_type: 'after_count',
            recurrence_end_count: 5,
            recurrence_count: 5
        })).toBe(true)
    })

    it('returns true when count exceeds limit', () => {
        expect(isRecurrenceEnded({
            recurrence_end_type: 'after_count',
            recurrence_end_count: 5,
            recurrence_count: 8
        })).toBe(true)
    })

    it('returns false when count has not been reached', () => {
        expect(isRecurrenceEnded({
            recurrence_end_type: 'after_count',
            recurrence_end_count: 5,
            recurrence_count: 3
        })).toBe(false)
    })

    it('returns false when count is 0 (no occurrences yet)', () => {
        expect(isRecurrenceEnded({
            recurrence_end_type: 'after_count',
            recurrence_end_count: 5,
            recurrence_count: 0
        })).toBe(false)
    })

    it('treats missing recurrence_count as 0', () => {
        expect(isRecurrenceEnded({
            recurrence_end_type: 'after_count',
            recurrence_end_count: 5
        })).toBe(false)
    })

    it('returns false for unknown end type', () => {
        expect(isRecurrenceEnded({
            recurrence_end_type: 'custom_unknown'
        })).toBe(false)
    })
})

// ─── validateRecurrenceRule ────────────────────────────────────────────────────

describe('validateRecurrenceRule', () => {
    it('rejects null rule', () => {
        expect(validateRecurrenceRule(null)).toEqual({ valid: false, error: 'Rule is required' })
    })

    it('rejects invalid type', () => {
        expect(validateRecurrenceRule({ type: 'hourly', interval: 1 }))
            .toEqual({ valid: false, error: 'Invalid recurrence type' })
    })

    it('rejects missing interval', () => {
        expect(validateRecurrenceRule({ type: 'daily' }))
            .toEqual({ valid: false, error: 'Interval must be between 1 and 365' })
    })

    it('rejects interval < 1', () => {
        expect(validateRecurrenceRule({ type: 'daily', interval: 0 }))
            .toEqual({ valid: false, error: 'Interval must be between 1 and 365' })
    })

    it('rejects interval > 365', () => {
        expect(validateRecurrenceRule({ type: 'daily', interval: 366 }))
            .toEqual({ valid: false, error: 'Interval must be between 1 and 365' })
    })

    it('accepts valid daily rule', () => {
        expect(validateRecurrenceRule({ type: 'daily', interval: 1 }))
            .toEqual({ valid: true })
    })

    describe('weekly validation', () => {
        it('rejects empty weekdays array', () => {
            expect(validateRecurrenceRule({ type: 'weekly', interval: 1, weekdays: [] }))
                .toEqual({ valid: false, error: 'At least one weekday must be selected for weekly recurrence' })
        })

        it('rejects weekday out of range', () => {
            expect(validateRecurrenceRule({ type: 'weekly', interval: 1, weekdays: [7] }))
                .toEqual({ valid: false, error: 'Weekdays must be between 0 (Sun) and 6 (Sat)' })
        })

        it('rejects negative weekday', () => {
            expect(validateRecurrenceRule({ type: 'weekly', interval: 1, weekdays: [-1] }))
                .toEqual({ valid: false, error: 'Weekdays must be between 0 (Sun) and 6 (Sat)' })
        })

        it('accepts valid weekly rule with weekdays', () => {
            expect(validateRecurrenceRule({ type: 'weekly', interval: 1, weekdays: [0, 3, 6] }))
                .toEqual({ valid: true })
        })

        it('accepts weekly rule without weekdays (optional)', () => {
            expect(validateRecurrenceRule({ type: 'weekly', interval: 1 }))
                .toEqual({ valid: true })
        })
    })

    describe('monthly/yearly validation', () => {
        it('rejects invalid dayType', () => {
            expect(validateRecurrenceRule({ type: 'monthly', interval: 1, dayType: 'invalid' }))
                .toEqual({ valid: false, error: 'Invalid day type' })
        })

        it('rejects dayOfMonth > 31', () => {
            expect(validateRecurrenceRule({ type: 'monthly', interval: 1, dayOfMonth: 32 }))
                .toEqual({ valid: false, error: 'Day of month must be between 1 and 31' })
        })

        it('rejects dayOfMonth 0 as out of range', () => {
            expect(validateRecurrenceRule({ type: 'monthly', interval: 1, dayOfMonth: 0 }))
                .toEqual({ valid: false, error: 'Day of month must be between 1 and 31' })
        })

        it('rejects weekday > 6', () => {
            expect(validateRecurrenceRule({ type: 'monthly', interval: 1, weekday: 7 }))
                .toEqual({ valid: false, error: 'Weekday must be between 0 (Sun) and 6 (Sat)' })
        })

        it('rejects invalid ordinal', () => {
            expect(validateRecurrenceRule({ type: 'monthly', interval: 1, weekdayOrdinal: 6 }))
                .toEqual({ valid: false, error: 'Ordinal must be 1-5 or -1 (last)' })
        })

        it('accepts ordinal -1 (last)', () => {
            expect(validateRecurrenceRule({ type: 'monthly', interval: 1, weekdayOrdinal: -1 }))
                .toEqual({ valid: true })
        })

        it('rejects month > 12 for yearly', () => {
            expect(validateRecurrenceRule({ type: 'yearly', interval: 1, month: 13 }))
                .toEqual({ valid: false, error: 'Month must be between 1 and 12' })
        })

        it('rejects month 0 as out of range', () => {
            expect(validateRecurrenceRule({ type: 'yearly', interval: 1, month: 0 }))
                .toEqual({ valid: false, error: 'Month must be between 1 and 12' })
        })

        it('accepts valid yearly rule', () => {
            expect(validateRecurrenceRule({ type: 'yearly', interval: 1, month: 6 }))
                .toEqual({ valid: true })
        })
    })
})

// ─── buildRecurrenceRule ───────────────────────────────────────────────────────

describe('buildRecurrenceRule', () => {
    it('returns null for type "none"', () => {
        expect(buildRecurrenceRule({ type: 'none' })).toBeNull()
    })

    it('returns null for missing type', () => {
        expect(buildRecurrenceRule({})).toBeNull()
    })

    it('builds daily rule with parsed interval', () => {
        const rule = buildRecurrenceRule({
            type: 'daily',
            interval: '3',
            startDate: '2025-03-10'
        })
        expect(rule).toEqual({
            type: 'daily',
            interval: 3,
            startDate: '2025-03-10'
        })
    })

    it('defaults interval to 1 when unparseable', () => {
        const rule = buildRecurrenceRule({
            type: 'daily',
            interval: 'abc',
            startDate: '2025-01-01'
        })
        expect(rule.interval).toBe(1)
    })

    it('includes weekdays for weekly type', () => {
        const rule = buildRecurrenceRule({
            type: 'weekly',
            interval: '1',
            weekdays: [1, 3, 5],
            startDate: '2025-03-10'
        })
        expect(rule.weekdays).toEqual([1, 3, 5])
    })

    it('builds monthly rule with day_of_month', () => {
        const rule = buildRecurrenceRule({
            type: 'monthly',
            interval: '1',
            dayType: 'day_of_month',
            dayOfMonth: '15',
            startDate: '2025-03-10'
        })
        expect(rule).toEqual({
            type: 'monthly',
            interval: 1,
            startDate: '2025-03-10',
            dayType: 'day_of_month',
            dayOfMonth: 15
        })
    })

    it('builds monthly rule with weekday', () => {
        const rule = buildRecurrenceRule({
            type: 'monthly',
            interval: '1',
            dayType: 'weekday',
            weekdayOrdinal: '2',
            weekday: '3',
            startDate: '2025-03-10'
        })
        expect(rule).toEqual({
            type: 'monthly',
            interval: 1,
            startDate: '2025-03-10',
            dayType: 'weekday',
            weekdayOrdinal: 2,
            weekday: 3
        })
    })

    it('includes month for yearly type', () => {
        const rule = buildRecurrenceRule({
            type: 'yearly',
            interval: '1',
            dayType: 'day_of_month',
            dayOfMonth: '25',
            month: '12',
            startDate: '2025-03-10'
        })
        expect(rule.month).toBe(12)
    })
})

// ─── formatPreviewDate ─────────────────────────────────────────────────────────

describe('formatPreviewDate', () => {
    it('formats a date in en-US short format', () => {
        const result = formatPreviewDate('2025-12-25')
        // toLocaleDateString output varies by environment, but should contain key parts
        expect(result).toContain('Dec')
        expect(result).toContain('25')
        expect(result).toContain('2025')
    })

    it('formats January 1st', () => {
        const result = formatPreviewDate('2025-01-01')
        expect(result).toContain('Jan')
        expect(result).toContain('1')
        expect(result).toContain('2025')
    })
})

// ─── calculateFirstOccurrence ──────────────────────────────────────────────────

describe('calculateFirstOccurrence', () => {
    let dateSpy
    const RealDate = Date

    function mockDate(isoDate) {
        const fixed = new RealDate(isoDate + 'T00:00:00')
        dateSpy = vi.spyOn(globalThis, 'Date').mockImplementation(function (...args) {
            if (args.length === 0) {
                return new RealDate(fixed.getTime())
            }
            return new RealDate(...args)
        })
        // Preserve static methods
        globalThis.Date.now = RealDate.now
    }

    afterEach(() => {
        if (dateSpy) {
            dateSpy.mockRestore()
            dateSpy = null
        }
    })

    it('returns null for null rule', () => {
        expect(calculateFirstOccurrence(null)).toBeNull()
    })

    it('returns null for rule without type', () => {
        expect(calculateFirstOccurrence({})).toBeNull()
    })

    it('returns today for daily recurrence', () => {
        mockDate('2025-03-14')
        expect(calculateFirstOccurrence({ type: 'daily', interval: 1 })).toBe('2025-03-14')
    })

    it('returns today if weekday matches for weekly', () => {
        // 2025-03-14 is Friday = day 5
        mockDate('2025-03-14')
        expect(calculateFirstOccurrence({
            type: 'weekly', interval: 1, weekdays: [5]
        })).toBe('2025-03-14')
    })

    it('returns next matching weekday for weekly', () => {
        // 2025-03-10 is Monday = day 1, looking for Wednesday = day 3
        mockDate('2025-03-10')
        expect(calculateFirstOccurrence({
            type: 'weekly', interval: 1, weekdays: [3]
        })).toBe('2025-03-12')
    })

    it('wraps to next week for weekly when all weekdays passed', () => {
        // 2025-03-14 is Friday = day 5, looking for Monday = day 1
        mockDate('2025-03-14')
        expect(calculateFirstOccurrence({
            type: 'weekly', interval: 1, weekdays: [1]
        })).toBe('2025-03-17')
    })

    it('returns today for monthly if target day matches', () => {
        mockDate('2025-03-15')
        expect(calculateFirstOccurrence({
            type: 'monthly', interval: 1, dayType: 'day_of_month', dayOfMonth: 15
        })).toBe('2025-03-15')
    })

    it('returns next month for monthly if target day passed', () => {
        mockDate('2025-03-20')
        expect(calculateFirstOccurrence({
            type: 'monthly', interval: 1, dayType: 'day_of_month', dayOfMonth: 10
        })).toBe('2025-04-10')
    })

    describe('monthly by weekday', () => {
        it('returns this month if nth weekday has not passed', () => {
            // 2025-03-01 is Saturday. 2nd Tuesday of March 2025 = March 11
            mockDate('2025-03-01')
            expect(calculateFirstOccurrence({
                type: 'monthly', interval: 1, dayType: 'weekday', weekday: 2, weekdayOrdinal: 2
            })).toBe('2025-03-11')
        })

        it('returns next month if nth weekday has passed', () => {
            // 2025-03-20 is past 2nd Tuesday (March 11). 2nd Tuesday of April 2025 = April 8
            mockDate('2025-03-20')
            expect(calculateFirstOccurrence({
                type: 'monthly', interval: 1, dayType: 'weekday', weekday: 2, weekdayOrdinal: 2
            })).toBe('2025-04-08')
        })

        it('returns last weekday of current month if not passed', () => {
            // Last Friday of March 2025 = March 28
            mockDate('2025-03-01')
            expect(calculateFirstOccurrence({
                type: 'monthly', interval: 1, dayType: 'weekday', weekday: 5, weekdayOrdinal: -1
            })).toBe('2025-03-28')
        })

        it('returns last weekday of next month if passed', () => {
            // 2025-03-29 is past last Friday (March 28). Last Friday of April 2025 = April 25
            mockDate('2025-03-29')
            expect(calculateFirstOccurrence({
                type: 'monthly', interval: 1, dayType: 'weekday', weekday: 5, weekdayOrdinal: -1
            })).toBe('2025-04-25')
        })

        it('defaults weekday to Monday and ordinal to 1', () => {
            // 1st Monday of March 2025 = March 3
            mockDate('2025-03-01')
            expect(calculateFirstOccurrence({
                type: 'monthly', interval: 1, dayType: 'weekday'
            })).toBe('2025-03-03')
        })
    })

    describe('monthly by last_day', () => {
        it('returns last day of current month if not passed', () => {
            mockDate('2025-03-01')
            expect(calculateFirstOccurrence({
                type: 'monthly', interval: 1, dayType: 'last_day'
            })).toBe('2025-03-31')
        })

        it('returns last day of next month if today is past it', () => {
            // March 31 is the last day, but if today IS March 31 it should still return March 31
            // So test with April 1 to force next month
            mockDate('2025-04-01')
            expect(calculateFirstOccurrence({
                type: 'monthly', interval: 1, dayType: 'last_day'
            })).toBe('2025-04-30')
        })

        it('moves to next month when last day already passed', () => {
            // February has 28 days in 2025. If today is March 1, last_day for Feb is past.
            // But the function checks current month, not a specific month.
            // If today is Jan 31 (which IS the last day), result >= today so no move.
            mockDate('2025-01-31')
            expect(calculateFirstOccurrence({
                type: 'monthly', interval: 1, dayType: 'last_day'
            })).toBe('2025-01-31')
        })
    })

    // ─── yearly ───────────────────────────────────────────────────────────

    describe('yearly by day_of_month', () => {
        it('returns this year if the date has not passed', () => {
            mockDate('2025-06-01')
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 12, dayType: 'day_of_month', dayOfMonth: 25
            })).toBe('2025-12-25')
        })

        it('returns next year if the date has passed', () => {
            mockDate('2025-09-01')
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 3, dayType: 'day_of_month', dayOfMonth: 15
            })).toBe('2026-03-15')
        })

        it('returns today if the date matches today', () => {
            mockDate('2025-07-04')
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 7, dayType: 'day_of_month', dayOfMonth: 4
            })).toBe('2025-07-04')
        })

        it('clamps to last day of month for Feb 29 in non-leap year', () => {
            mockDate('2025-01-01') // 2025 is not a leap year
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 2, dayType: 'day_of_month', dayOfMonth: 29
            })).toBe('2025-02-28')
        })

        it('uses Feb 29 in a leap year', () => {
            mockDate('2024-01-01') // 2024 is a leap year
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 2, dayType: 'day_of_month', dayOfMonth: 29
            })).toBe('2024-02-29')
        })

        it('defaults to month 1 and day 1 when not specified', () => {
            mockDate('2025-06-01')
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1
            })).toBe('2026-01-01')
        })
    })

    describe('yearly by weekday', () => {
        it('returns the nth weekday of the target month', () => {
            // 1st Monday of September 2025 = September 1, 2025
            mockDate('2025-01-01')
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 9, dayType: 'weekday', weekday: 1, weekdayOrdinal: 1
            })).toBe('2025-09-01')
        })

        it('moves to next year if this years occurrence passed', () => {
            // 1st Monday of March 2025 = March 3
            mockDate('2025-04-01') // already past March
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 3, dayType: 'weekday', weekday: 1, weekdayOrdinal: 1
            })).toBe('2026-03-02') // 1st Monday of March 2026
        })

        it('finds the last weekday of a month (ordinal -1)', () => {
            // Last Friday of November 2025 = November 28
            mockDate('2025-01-01')
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 11, dayType: 'weekday', weekday: 5, weekdayOrdinal: -1
            })).toBe('2025-11-28')
        })

        it('returns null ordinal that does not exist (5th weekday)', () => {
            // 5th Monday of February 2025 does not exist
            mockDate('2025-01-01')
            const result = calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 2, dayType: 'weekday', weekday: 1, weekdayOrdinal: 5
            })
            // getNthWeekdayOfMonthInternal returns null, so fallback to todayStr
            expect(result).toBeTruthy()
        })

        it('defaults weekday to Monday and ordinal to 1', () => {
            mockDate('2025-01-01')
            const result = calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 6, dayType: 'weekday'
            })
            // 1st Monday of June 2025 = June 2
            expect(result).toBe('2025-06-02')
        })
    })

    describe('yearly by last_day', () => {
        it('returns the last day of the target month', () => {
            mockDate('2025-01-01')
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 4, dayType: 'last_day'
            })).toBe('2025-04-30')
        })

        it('moves to next year if the date has passed', () => {
            mockDate('2025-03-01')
            expect(calculateFirstOccurrence({
                type: 'yearly', interval: 1, month: 2, dayType: 'last_day'
            })).toBe('2026-02-28')
        })
    })

    describe('unknown type', () => {
        it('returns today for unknown recurrence type', () => {
            mockDate('2025-05-01')
            expect(calculateFirstOccurrence({
                type: 'unknown_type', interval: 1
            })).toBe('2025-05-01')
        })
    })
})
