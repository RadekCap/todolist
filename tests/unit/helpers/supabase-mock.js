import { vi } from 'vitest'

/**
 * Creates a chainable Supabase client mock with a result queue.
 *
 * The mock supports all common Supabase query-builder methods (from, select,
 * insert, update, delete, upsert, eq, neq, in, order, range, single) and
 * resolves via a custom `.then()` that pops results from an internal queue.
 *
 * Usage:
 *   import { createSupabaseMock } from '../helpers/supabase-mock.js'
 *
 *   const mockSupabase = createSupabaseMock()
 *
 *   vi.mock('../../src/core/supabase.js', () => ({
 *       supabase: mockSupabase
 *   }))
 *
 *   // In beforeEach:
 *   mockSupabase._reset()
 *
 *   // Before each supabase call in a test, queue the expected result:
 *   mockSupabase._queueResult([{ id: '1', text: 'Hello' }])        // success
 *   mockSupabase._queueResult(null, { message: 'DB error' })       // error
 *
 * @returns {object} A chainable mock object with `_queueResult()` and `_reset()` helpers.
 */
export function createSupabaseMock() {
    const results = []
    let callIndex = 0

    const chain = {
        from: vi.fn(() => chain),
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        upsert: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        neq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        range: vi.fn(() => chain),
        single: vi.fn(() => chain),
        then: vi.fn((resolve) => {
            const result = results[callIndex] || { data: null, error: null }
            callIndex++
            resolve(result)
        }),

        /**
         * Enqueue a result that the next awaited Supabase call will resolve with.
         * @param {*} data - The data property of the response.
         * @param {object|null} [error=null] - The error property of the response.
         */
        _queueResult(data, error = null) {
            results.push({ data, error })
        },

        /** Clear all queued results and reset the call index. */
        _reset() {
            results.length = 0
            callIndex = 0
        }
    }

    return chain
}
