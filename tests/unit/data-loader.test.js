import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/auth.js', () => ({
    encrypt: vi.fn(v => Promise.resolve(`enc:${v}`)),
    decrypt: vi.fn(v => Promise.resolve(v?.startsWith?.('enc:') ? v.slice(4) : v))
}))

function createSupabaseMock() {
    const results = []
    let callIndex = 0

    const chain = {
        from: vi.fn(() => chain),
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        range: vi.fn(() => chain),
        then: vi.fn((resolve) => {
            const result = results[callIndex] || { data: null, error: null }
            callIndex++
            resolve(result)
        }),
        _queueResult(data, error = null) {
            results.push({ data, error })
        },
        _reset() {
            results.length = 0
            callIndex = 0
        }
    }
    return chain
}

const mockSupabase = createSupabaseMock()

vi.mock('../../src/core/supabase.js', () => ({
    supabase: mockSupabase
}))

// Import after mocks are set up
const { loadCollection, getById } = await import('../../src/services/data-loader.js')
const { decrypt } = await import('../../src/services/auth.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('data-loader', () => {
    beforeEach(() => {
        store.reset()
        mockSupabase._reset()
        vi.clearAllMocks()
    })

    // ─── loadCollection ───────────────────────────────────────────────────────

    describe('loadCollection', () => {

        // ─── happy path ───────────────────────────────────────────────────────

        describe('happy path', () => {
            it('loads data from Supabase with correct table, ordering, and ascending params', async () => {
                mockSupabase._queueResult([
                    { id: 'c1', name: 'enc:Work' }
                ])

                await loadCollection({
                    table: 'categories',
                    storeKey: 'categories',
                    event: Events.CATEGORIES_LOADED,
                    orderBy: 'created_at',
                    ascending: true,
                    decryptFields: ['name']
                })

                expect(mockSupabase.from).toHaveBeenCalledWith('categories')
                expect(mockSupabase.select).toHaveBeenCalledWith('*')
                expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: true })
            })

            it('passes ascending=false when specified', async () => {
                mockSupabase._queueResult([])

                await loadCollection({
                    table: 'priorities',
                    storeKey: 'priorities',
                    event: Events.PRIORITIES_LOADED,
                    orderBy: 'level',
                    ascending: false,
                    decryptFields: []
                })

                expect(mockSupabase.order).toHaveBeenCalledWith('level', { ascending: false })
            })

            it('defaults ascending to true when not specified', async () => {
                mockSupabase._queueResult([])

                await loadCollection({
                    table: 'contexts',
                    storeKey: 'contexts',
                    event: Events.CONTEXTS_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: true })
            })

            it('decrypts specified fields using the decrypt function', async () => {
                mockSupabase._queueResult([
                    { id: 'c1', name: 'enc:Work', color: '#ff0000' },
                    { id: 'c2', name: 'enc:Personal', color: '#00ff00' }
                ])

                const result = await loadCollection({
                    table: 'categories',
                    storeKey: 'categories',
                    event: Events.CATEGORIES_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                expect(decrypt).toHaveBeenCalledTimes(2)
                expect(decrypt).toHaveBeenCalledWith('enc:Work')
                expect(decrypt).toHaveBeenCalledWith('enc:Personal')
                expect(result[0].name).toBe('Work')
                expect(result[1].name).toBe('Personal')
                // Non-decrypt fields remain unchanged
                expect(result[0].color).toBe('#ff0000')
                expect(result[1].color).toBe('#00ff00')
            })

            it('decrypts multiple fields when specified', async () => {
                mockSupabase._queueResult([
                    { id: 'item-1', name: 'enc:Title', description: 'enc:Desc' }
                ])

                const result = await loadCollection({
                    table: 'some_table',
                    storeKey: 'items',
                    event: 'items:loaded',
                    orderBy: 'created_at',
                    decryptFields: ['name', 'description']
                })

                expect(decrypt).toHaveBeenCalledWith('enc:Title')
                expect(decrypt).toHaveBeenCalledWith('enc:Desc')
                expect(result[0].name).toBe('Title')
                expect(result[0].description).toBe('Desc')
            })

            it('skips decryption for null/undefined fields', async () => {
                mockSupabase._queueResult([
                    { id: 'c1', name: null }
                ])

                const result = await loadCollection({
                    table: 'categories',
                    storeKey: 'categories',
                    event: Events.CATEGORIES_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                expect(decrypt).not.toHaveBeenCalled()
                expect(result[0].name).toBeNull()
            })

            it('skips decryption entirely when decryptFields is empty', async () => {
                mockSupabase._queueResult([
                    { id: 'p1', name: 'High', level: 1 },
                    { id: 'p2', name: 'Low', level: 2 }
                ])

                const result = await loadCollection({
                    table: 'priorities',
                    storeKey: 'priorities',
                    event: Events.PRIORITIES_LOADED,
                    orderBy: 'level',
                    decryptFields: []
                })

                expect(decrypt).not.toHaveBeenCalled()
                expect(result[0].name).toBe('High')
                expect(result[1].name).toBe('Low')
            })

            it('stores loaded data in store under the specified storeKey', async () => {
                mockSupabase._queueResult([
                    { id: 'c1', name: 'enc:Work' },
                    { id: 'c2', name: 'enc:Personal' }
                ])

                await loadCollection({
                    table: 'categories',
                    storeKey: 'categories',
                    event: Events.CATEGORIES_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                const stored = store.get('categories')
                expect(stored).toHaveLength(2)
                expect(stored[0].name).toBe('Work')
                expect(stored[1].name).toBe('Personal')
            })

            it('emits the specified event after loading', async () => {
                const listener = vi.fn()
                events.on(Events.CATEGORIES_LOADED, listener)

                mockSupabase._queueResult([
                    { id: 'c1', name: 'enc:Work' }
                ])

                await loadCollection({
                    table: 'categories',
                    storeKey: 'categories',
                    event: Events.CATEGORIES_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                expect(listener).toHaveBeenCalledTimes(1)
                expect(listener).toHaveBeenCalledWith([
                    { id: 'c1', name: 'Work' }
                ])

                events.off(Events.CATEGORIES_LOADED, listener)
            })

            it('returns the loaded and decrypted items', async () => {
                mockSupabase._queueResult([
                    { id: 'c1', name: 'enc:Work' },
                    { id: 'c2', name: 'enc:Personal' }
                ])

                const result = await loadCollection({
                    table: 'categories',
                    storeKey: 'categories',
                    event: Events.CATEGORIES_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                expect(result).toHaveLength(2)
                expect(result[0]).toEqual({ id: 'c1', name: 'Work' })
                expect(result[1]).toEqual({ id: 'c2', name: 'Personal' })
            })
        })

        // ─── empty results ────────────────────────────────────────────────────

        describe('empty results', () => {
            it('handles empty data array from Supabase', async () => {
                mockSupabase._queueResult([])

                const result = await loadCollection({
                    table: 'categories',
                    storeKey: 'categories',
                    event: Events.CATEGORIES_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                expect(result).toEqual([])
                expect(store.get('categories')).toEqual([])
                expect(decrypt).not.toHaveBeenCalled()
            })

            it('emits event even for empty results', async () => {
                const listener = vi.fn()
                events.on(Events.CONTEXTS_LOADED, listener)

                mockSupabase._queueResult([])

                await loadCollection({
                    table: 'contexts',
                    storeKey: 'contexts',
                    event: Events.CONTEXTS_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                expect(listener).toHaveBeenCalledWith([])

                events.off(Events.CONTEXTS_LOADED, listener)
            })
        })

        // ─── error handling ───────────────────────────────────────────────────

        describe('error handling', () => {
            it('throws when Supabase returns an error', async () => {
                const supabaseError = { message: 'Permission denied', code: '42501' }
                mockSupabase._queueResult(null, supabaseError)

                await expect(loadCollection({
                    table: 'categories',
                    storeKey: 'categories',
                    event: Events.CATEGORIES_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })).rejects.toEqual(supabaseError)
            })

            it('does not update store when Supabase returns an error', async () => {
                store.set('categories', [{ id: 'existing', name: 'Existing' }])
                mockSupabase._queueResult(null, { message: 'Error' })

                try {
                    await loadCollection({
                        table: 'categories',
                        storeKey: 'categories',
                        event: Events.CATEGORIES_LOADED,
                        orderBy: 'created_at',
                        decryptFields: ['name']
                    })
                } catch {
                    // expected
                }

                // Store should still have the original data
                expect(store.get('categories')).toEqual([{ id: 'existing', name: 'Existing' }])
            })

            it('does not emit event when Supabase returns an error', async () => {
                const listener = vi.fn()
                events.on(Events.CATEGORIES_LOADED, listener)

                mockSupabase._queueResult(null, { message: 'Error' })

                try {
                    await loadCollection({
                        table: 'categories',
                        storeKey: 'categories',
                        event: Events.CATEGORIES_LOADED,
                        orderBy: 'created_at',
                        decryptFields: ['name']
                    })
                } catch {
                    // expected
                }

                expect(listener).not.toHaveBeenCalled()

                events.off(Events.CATEGORIES_LOADED, listener)
            })
        })

        // ─── different configurations ─────────────────────────────────────────

        describe('different configurations', () => {
            it('works with contexts table configuration', async () => {
                mockSupabase._queueResult([
                    { id: 'ctx-1', name: 'enc:Home' },
                    { id: 'ctx-2', name: 'enc:Office' }
                ])

                const result = await loadCollection({
                    table: 'contexts',
                    storeKey: 'contexts',
                    event: Events.CONTEXTS_LOADED,
                    orderBy: 'created_at',
                    decryptFields: ['name']
                })

                expect(mockSupabase.from).toHaveBeenCalledWith('contexts')
                expect(result[0].name).toBe('Home')
                expect(result[1].name).toBe('Office')
                expect(store.get('contexts')).toHaveLength(2)
            })

            it('works with priorities table configuration (no decryption)', async () => {
                mockSupabase._queueResult([
                    { id: 'pri-1', name: 'High', level: 1, color: '#ff0000' },
                    { id: 'pri-2', name: 'Medium', level: 2, color: '#ffaa00' },
                    { id: 'pri-3', name: 'Low', level: 3, color: '#00ff00' }
                ])

                const result = await loadCollection({
                    table: 'priorities',
                    storeKey: 'priorities',
                    event: Events.PRIORITIES_LOADED,
                    orderBy: 'level',
                    decryptFields: []
                })

                expect(mockSupabase.from).toHaveBeenCalledWith('priorities')
                expect(mockSupabase.order).toHaveBeenCalledWith('level', { ascending: true })
                expect(decrypt).not.toHaveBeenCalled()
                expect(result).toHaveLength(3)
                expect(result[0].name).toBe('High')
                expect(store.get('priorities')).toHaveLength(3)
            })

            it('works with a custom event name', async () => {
                const listener = vi.fn()
                events.on('custom:loaded', listener)

                mockSupabase._queueResult([{ id: '1', name: 'enc:Item' }])

                await loadCollection({
                    table: 'custom_table',
                    storeKey: 'customItems',
                    event: 'custom:loaded',
                    orderBy: 'name',
                    decryptFields: ['name']
                })

                expect(listener).toHaveBeenCalledTimes(1)
                expect(store.get('customItems')).toHaveLength(1)

                events.off('custom:loaded', listener)
            })
        })
    })

    // ─── getById ──────────────────────────────────────────────────────────────

    describe('getById', () => {

        // ─── happy path ───────────────────────────────────────────────────────

        describe('happy path', () => {
            it('returns the correct item from store by ID', () => {
                store.set('categories', [
                    { id: 'c1', name: 'Work' },
                    { id: 'c2', name: 'Personal' },
                    { id: 'c3', name: 'Hobby' }
                ])

                const result = getById('categories', 'c2')

                expect(result).toEqual({ id: 'c2', name: 'Personal' })
            })

            it('returns the first item when searching by its ID', () => {
                store.set('contexts', [
                    { id: 'ctx-1', name: 'Home' },
                    { id: 'ctx-2', name: 'Office' }
                ])

                const result = getById('contexts', 'ctx-1')

                expect(result).toEqual({ id: 'ctx-1', name: 'Home' })
            })

            it('returns the last item when searching by its ID', () => {
                store.set('priorities', [
                    { id: 'p1', name: 'High', level: 1 },
                    { id: 'p2', name: 'Medium', level: 2 },
                    { id: 'p3', name: 'Low', level: 3 }
                ])

                const result = getById('priorities', 'p3')

                expect(result).toEqual({ id: 'p3', name: 'Low', level: 3 })
            })
        })

        // ─── not found ───────────────────────────────────────────────────────

        describe('not found', () => {
            it('returns null for non-existent ID', () => {
                store.set('categories', [
                    { id: 'c1', name: 'Work' },
                    { id: 'c2', name: 'Personal' }
                ])

                const result = getById('categories', 'non-existent')

                expect(result).toBeNull()
            })

            it('returns null when store collection is empty', () => {
                store.set('categories', [])

                const result = getById('categories', 'c1')

                expect(result).toBeNull()
            })
        })

        // ─── various collection types ─────────────────────────────────────────

        describe('various collection types', () => {
            it('works with categories storeKey', () => {
                store.set('categories', [{ id: 'cat-1', name: 'Work' }])

                expect(getById('categories', 'cat-1')).toEqual({ id: 'cat-1', name: 'Work' })
            })

            it('works with contexts storeKey', () => {
                store.set('contexts', [{ id: 'ctx-1', name: 'Home' }])

                expect(getById('contexts', 'ctx-1')).toEqual({ id: 'ctx-1', name: 'Home' })
            })

            it('works with priorities storeKey', () => {
                store.set('priorities', [{ id: 'pri-1', name: 'High', level: 1 }])

                expect(getById('priorities', 'pri-1')).toEqual({ id: 'pri-1', name: 'High', level: 1 })
            })
        })
    })
})
