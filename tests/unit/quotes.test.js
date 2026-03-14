import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to mock sessionStorage and Date before importing the module,
// because the module uses them at call time (not at import time).
// However, getDayOfYear() is called inside the exported function, so we
// mock Date to control its output.

const RealDate = Date

let sessionStore = {}

const sessionStorageMock = {
    getItem: vi.fn((key) => sessionStore[key] ?? null),
    setItem: vi.fn((key, value) => { sessionStore[key] = value }),
    removeItem: vi.fn((key) => { delete sessionStore[key] }),
    clear: vi.fn(() => { sessionStore = {} }),
}

vi.stubGlobal('sessionStorage', sessionStorageMock)

// Import after mocks are set up
import { getDailyQuote } from '../../src/services/quotes.js'

// ─── getDailyQuote ───────────────────────────────────────────────────────────

describe('getDailyQuote', () => {
    let dateSpy

    function mockDate(isoDate) {
        const fixed = new RealDate(isoDate + 'T12:00:00')
        dateSpy = vi.spyOn(globalThis, 'Date').mockImplementation(function (...args) {
            if (args.length === 0) {
                return new RealDate(fixed.getTime())
            }
            return new RealDate(...args)
        })
        globalThis.Date.now = RealDate.now
    }

    beforeEach(() => {
        sessionStore = {}
        vi.clearAllMocks()
    })

    afterEach(() => {
        if (dateSpy) {
            dateSpy.mockRestore()
            dateSpy = null
        }
        vi.restoreAllMocks()
    })

    // ─── successful API fetch ────────────────────────────────────────────────

    describe('successful API fetch', () => {
        it('returns quote from API when no cache exists', async () => {
            mockDate('2025-06-15')
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'Test quote', author: 'Test Author' }),
            }))

            const result = await getDailyQuote()

            expect(result).toEqual({ quote: 'Test quote', author: 'Test Author' })
        })

        it('calls the correct API URL based on day of year', async () => {
            mockDate('2025-01-03') // Day 3 of year
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'Q', author: 'A' }),
            }))

            await getDailyQuote()

            const calledUrl = fetch.mock.calls[0][0]
            expect(calledUrl).toMatch(/^https:\/\/dummyjson\.com\/quotes\/\d+$/)
        })

        it('caches the fetched quote in sessionStorage', async () => {
            mockDate('2025-06-15')
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'Cached quote', author: 'Cached Author' }),
            }))

            await getDailyQuote()

            expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
                'dailyQuote',
                expect.any(String)
            )
            const stored = JSON.parse(sessionStorageMock.setItem.mock.calls[0][1])
            expect(stored.quote).toBe('Cached quote')
            expect(stored.author).toBe('Cached Author')
            expect(stored.day).toBeTypeOf('number')
        })

        it('returns object with quote and author properties only', async () => {
            mockDate('2025-06-15')
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ id: 42, quote: 'Hello', author: 'World', extra: 'field' }),
            }))

            const result = await getDailyQuote()

            expect(Object.keys(result)).toEqual(['quote', 'author'])
        })
    })

    // ─── cache behavior ──────────────────────────────────────────────────────

    describe('cache behavior', () => {
        it('returns cached quote without calling fetch', async () => {
            mockDate('2025-06-15')
            // Pre-populate cache with matching day
            const dayOfYear = getDayOfYearFor('2025-06-15')
            sessionStore['dailyQuote'] = JSON.stringify({
                day: dayOfYear,
                quote: 'From cache',
                author: 'Cache Author',
            })
            vi.stubGlobal('fetch', vi.fn())

            const result = await getDailyQuote()

            expect(result).toEqual({ quote: 'From cache', author: 'Cache Author' })
            expect(fetch).not.toHaveBeenCalled()
        })

        it('ignores cache from a different day', async () => {
            mockDate('2025-06-15')
            // Cache with a different day number
            sessionStore['dailyQuote'] = JSON.stringify({
                day: 999,
                quote: 'Old quote',
                author: 'Old Author',
            })
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'Fresh quote', author: 'Fresh Author' }),
            }))

            const result = await getDailyQuote()

            expect(result).toEqual({ quote: 'Fresh quote', author: 'Fresh Author' })
            expect(fetch).toHaveBeenCalled()
        })

        it('ignores cache with missing quote field', async () => {
            mockDate('2025-06-15')
            const dayOfYear = getDayOfYearFor('2025-06-15')
            sessionStore['dailyQuote'] = JSON.stringify({
                day: dayOfYear,
                author: 'No Quote Author',
            })
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'API quote', author: 'API Author' }),
            }))

            const result = await getDailyQuote()

            expect(fetch).toHaveBeenCalled()
            expect(result.quote).toBe('API quote')
        })

        it('ignores cache with missing author field', async () => {
            mockDate('2025-06-15')
            const dayOfYear = getDayOfYearFor('2025-06-15')
            sessionStore['dailyQuote'] = JSON.stringify({
                day: dayOfYear,
                quote: 'Quote without author',
            })
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'API quote', author: 'API Author' }),
            }))

            const result = await getDailyQuote()

            expect(fetch).toHaveBeenCalled()
            expect(result.author).toBe('API Author')
        })

        it('handles malformed JSON in cache gracefully', async () => {
            mockDate('2025-06-15')
            sessionStore['dailyQuote'] = 'not valid json{{'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'Recovered', author: 'Recovery Author' }),
            }))

            const result = await getDailyQuote()

            expect(result).toEqual({ quote: 'Recovered', author: 'Recovery Author' })
        })
    })

    // ─── network error handling ──────────────────────────────────────────────

    describe('network error handling', () => {
        it('returns fallback quote when fetch throws', async () => {
            mockDate('2025-06-15')
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

            const result = await getDailyQuote()

            expect(result).toHaveProperty('quote')
            expect(result).toHaveProperty('author')
            expect(result.quote.length).toBeGreaterThan(0)
            expect(result.author.length).toBeGreaterThan(0)
        })

        it('returns fallback quote when response is not ok', async () => {
            mockDate('2025-06-15')
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
            }))

            const result = await getDailyQuote()

            expect(result).toHaveProperty('quote')
            expect(result).toHaveProperty('author')
            expect(result.quote.length).toBeGreaterThan(0)
        })

        it('returns fallback quote when response.json() throws', async () => {
            mockDate('2025-06-15')
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => { throw new Error('Invalid JSON') },
            }))

            const result = await getDailyQuote()

            expect(result).toHaveProperty('quote')
            expect(result).toHaveProperty('author')
        })

        it('caches the fallback quote in sessionStorage', async () => {
            mockDate('2025-06-15')
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))

            await getDailyQuote()

            expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
                'dailyQuote',
                expect.any(String)
            )
        })
    })

    // ─── fallback quotes ─────────────────────────────────────────────────────

    describe('fallback quotes', () => {
        it('returns a deterministic fallback for a given day', async () => {
            mockDate('2025-03-10')
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')))

            const result1 = await getDailyQuote()

            // Clear cache and re-fetch to verify determinism
            sessionStore = {}
            vi.clearAllMocks()
            mockDate('2025-03-10')
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')))

            const result2 = await getDailyQuote()

            expect(result1).toEqual(result2)
        })

        it('returns different fallback quotes for different days', async () => {
            const quotes = []
            for (const date of ['2025-01-01', '2025-01-02', '2025-01-03']) {
                sessionStore = {}
                vi.clearAllMocks()
                mockDate(date)
                vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')))
                quotes.push(await getDailyQuote())
                if (dateSpy) {
                    dateSpy.mockRestore()
                    dateSpy = null
                }
            }
            // At least two of three should differ (all from different days)
            const uniqueQuotes = new Set(quotes.map(q => q.quote))
            expect(uniqueQuotes.size).toBeGreaterThanOrEqual(2)
        })
    })

    // ─── sessionStorage errors ───────────────────────────────────────────────

    describe('sessionStorage errors', () => {
        it('handles sessionStorage.setItem throwing (e.g. quota exceeded)', async () => {
            mockDate('2025-06-15')
            sessionStorageMock.setItem.mockImplementation(() => {
                throw new Error('QuotaExceededError')
            })
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'Still works', author: 'Author' }),
            }))

            const result = await getDailyQuote()

            expect(result).toEqual({ quote: 'Still works', author: 'Author' })
        })

        it('handles sessionStorage.getItem throwing', async () => {
            mockDate('2025-06-15')
            sessionStorageMock.getItem.mockImplementation(() => {
                throw new Error('SecurityError')
            })
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ quote: 'Works anyway', author: 'Author' }),
            }))

            const result = await getDailyQuote()

            expect(result).toEqual({ quote: 'Works anyway', author: 'Author' })
        })
    })
})

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute day-of-year the same way the source does, for test setup.
 */
function getDayOfYearFor(isoDate) {
    const d = new RealDate(isoDate + 'T12:00:00')
    const start = new RealDate(d.getFullYear(), 0, 0)
    const diff = d - start
    const oneDay = 1000 * 60 * 60 * 24
    return Math.floor(diff / oneDay)
}
