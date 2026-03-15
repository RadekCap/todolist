// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

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

const mockChain = createSupabaseMock()

vi.mock('../../src/core/supabase.js', () => ({
    supabase: mockChain
}))

// Provide a localStorage mock since jsdom may not supply one in all vitest versions
const localStorageMock = (() => {
    let storage = {}
    return {
        getItem: (key) => storage[key] ?? null,
        setItem: (key, value) => { storage[key] = String(value) },
        removeItem: (key) => { delete storage[key] },
        clear: () => { storage = {} }
    }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'

const {
    selectArea, restoreSelectedArea, selectAreaByShortcut,
    loadAreas, addArea, updateArea, renameArea, deleteArea, reorderAreas
} = await import('../../src/services/areas.js')

const { encrypt, decrypt } = await import('../../src/services/auth.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('areas', () => {
    beforeEach(() => {
        store.reset()
        mockChain._reset()
        vi.clearAllMocks()
        localStorage.clear()
        store.set('areas', [
            { id: 'area-1', name: 'Work', color: '#667eea', sort_order: 0 },
            { id: 'area-2', name: 'Personal', color: '#764ba2', sort_order: 1 },
            { id: 'area-3', name: 'Side Projects', color: '#f093fb', sort_order: 2 },
        ])
        store.set('currentUser', { id: 'user-1' })
    })

    // ─── selectArea ───────────────────────────────────────────────────────────

    describe('selectArea', () => {
        it('sets selectedAreaId in store', () => {
            selectArea('area-1')
            expect(store.get('selectedAreaId')).toBe('area-1')
        })

        it('saves areaId to localStorage', () => {
            selectArea('area-1')
            expect(localStorage.getItem('selectedAreaId')).toBe('area-1')
        })

        it('works with "all"', () => {
            selectArea('all')
            expect(store.get('selectedAreaId')).toBe('all')
            expect(localStorage.getItem('selectedAreaId')).toBe('all')
        })

        it('works with "unassigned"', () => {
            selectArea('unassigned')
            expect(store.get('selectedAreaId')).toBe('unassigned')
            expect(localStorage.getItem('selectedAreaId')).toBe('unassigned')
        })

        it('works with a specific area ID', () => {
            selectArea('area-2')
            expect(store.get('selectedAreaId')).toBe('area-2')
            expect(localStorage.getItem('selectedAreaId')).toBe('area-2')
        })

        it('emits VIEW_CHANGED event', () => {
            const listener = vi.fn()
            events.on(Events.VIEW_CHANGED, listener)

            selectArea('area-1')

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('overwrites previous selection in store and localStorage', () => {
            selectArea('area-1')
            selectArea('area-2')

            expect(store.get('selectedAreaId')).toBe('area-2')
            expect(localStorage.getItem('selectedAreaId')).toBe('area-2')
        })
    })

    // ─── restoreSelectedArea ──────────────────────────────────────────────────

    describe('restoreSelectedArea', () => {
        it('restores "all" from localStorage', () => {
            localStorage.setItem('selectedAreaId', 'all')

            restoreSelectedArea()

            expect(store.get('selectedAreaId')).toBe('all')
        })

        it('restores "unassigned" from localStorage', () => {
            localStorage.setItem('selectedAreaId', 'unassigned')

            restoreSelectedArea()

            expect(store.get('selectedAreaId')).toBe('unassigned')
        })

        it('restores a valid area ID from localStorage', () => {
            localStorage.setItem('selectedAreaId', 'area-2')

            restoreSelectedArea()

            expect(store.get('selectedAreaId')).toBe('area-2')
        })

        it('does nothing if no saved value in localStorage', () => {
            restoreSelectedArea()

            // selectedAreaId should remain at the default value from store.reset()
            expect(store.get('selectedAreaId')).toBe('all')
        })

        it('clears localStorage if saved area no longer exists', () => {
            localStorage.setItem('selectedAreaId', 'deleted-area-id')

            restoreSelectedArea()

            expect(localStorage.getItem('selectedAreaId')).toBeNull()
        })

        it('does not set store if saved area does not exist', () => {
            localStorage.setItem('selectedAreaId', 'deleted-area-id')

            restoreSelectedArea()

            // Should remain at the default value, not set to the deleted ID
            expect(store.get('selectedAreaId')).toBe('all')
        })

        it('restores the first area when it exists in the areas list', () => {
            localStorage.setItem('selectedAreaId', 'area-1')

            restoreSelectedArea()

            expect(store.get('selectedAreaId')).toBe('area-1')
        })

        it('restores the last area when it exists in the areas list', () => {
            localStorage.setItem('selectedAreaId', 'area-3')

            restoreSelectedArea()

            expect(store.get('selectedAreaId')).toBe('area-3')
        })
    })

    // ─── selectAreaByShortcut ─────────────────────────────────────────────────

    describe('selectAreaByShortcut', () => {
        it('digit 0 selects "all"', () => {
            selectAreaByShortcut(0)

            expect(store.get('selectedAreaId')).toBe('all')
        })

        it('digit 1 selects the first area', () => {
            selectAreaByShortcut(1)

            expect(store.get('selectedAreaId')).toBe('area-1')
        })

        it('digit 2 selects the second area', () => {
            selectAreaByShortcut(2)

            expect(store.get('selectedAreaId')).toBe('area-2')
        })

        it('digit 3 selects the third area', () => {
            selectAreaByShortcut(3)

            expect(store.get('selectedAreaId')).toBe('area-3')
        })

        it('digit beyond area count does nothing', () => {
            selectAreaByShortcut(4)

            // Should remain at the default
            expect(store.get('selectedAreaId')).toBe('all')
        })

        it('digit 9 with only 3 areas does nothing', () => {
            selectAreaByShortcut(9)

            expect(store.get('selectedAreaId')).toBe('all')
        })

        it('saves selection to localStorage via selectArea', () => {
            selectAreaByShortcut(2)

            expect(localStorage.getItem('selectedAreaId')).toBe('area-2')
        })

        it('emits VIEW_CHANGED when selecting "all" with digit 0', () => {
            const listener = vi.fn()
            events.on(Events.VIEW_CHANGED, listener)

            selectAreaByShortcut(0)

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('emits VIEW_CHANGED when selecting an area by digit', () => {
            const listener = vi.fn()
            events.on(Events.VIEW_CHANGED, listener)

            selectAreaByShortcut(1)

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('does not emit VIEW_CHANGED when digit is out of range', () => {
            const listener = vi.fn()
            events.on(Events.VIEW_CHANGED, listener)

            selectAreaByShortcut(5)

            expect(listener).not.toHaveBeenCalled()
        })
    })

    // ─── loadAreas ────────────────────────────────────────────────────────────

    describe('loadAreas', () => {
        it('loads areas from Supabase and decrypts names', async () => {
            mockChain._queueResult([
                { id: 'a1', name: 'enc:Work', color: '#667eea', sort_order: 0 },
                { id: 'a2', name: 'enc:Personal', color: '#764ba2', sort_order: 1 }
            ])

            const result = await loadAreas()

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe('Work')
            expect(result[1].name).toBe('Personal')
        })

        it('stores loaded areas in the store', async () => {
            mockChain._queueResult([
                { id: 'a1', name: 'enc:Home', color: '#111', sort_order: 0 }
            ])

            await loadAreas()

            const areas = store.get('areas')
            expect(areas).toHaveLength(1)
            expect(areas[0].name).toBe('Home')
        })

        it('emits AREAS_LOADED event', async () => {
            const listener = vi.fn()
            events.on(Events.AREAS_LOADED, listener)
            mockChain._queueResult([])

            await loadAreas()

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('calls supabase with correct table and order', async () => {
            mockChain._queueResult([])

            await loadAreas()

            expect(mockChain.from).toHaveBeenCalledWith('areas')
            expect(mockChain.select).toHaveBeenCalledWith('*')
            expect(mockChain.order).toHaveBeenCalledWith('sort_order', { ascending: true })
        })

        it('throws on Supabase error', async () => {
            mockChain._queueResult(null, { message: 'DB error' })

            await expect(loadAreas()).rejects.toEqual({ message: 'DB error' })
        })

        it('handles empty result', async () => {
            mockChain._queueResult([])

            const result = await loadAreas()

            expect(result).toEqual([])
            expect(store.get('areas')).toEqual([])
        })
    })

    // ─── addArea ──────────────────────────────────────────────────────────────

    describe('addArea', () => {
        it('encrypts the name and inserts into Supabase', async () => {
            mockChain._queueResult([{ id: 'new-1', name: 'enc:Finance', color: '#43e97b', sort_order: 3 }])

            await addArea('Finance', '#43e97b')

            expect(encrypt).toHaveBeenCalledWith('Finance')
            expect(mockChain.from).toHaveBeenCalledWith('areas')
            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'user-1',
                name: 'enc:Finance',
                color: '#43e97b',
                sort_order: 3
            }))
        })

        it('adds the new area to the store with decrypted name', async () => {
            mockChain._queueResult([{ id: 'new-1', name: 'enc:Finance', color: '#43e97b', sort_order: 3 }])

            await addArea('Finance', '#43e97b')

            const areas = store.get('areas')
            expect(areas).toHaveLength(4)
            expect(areas[3].name).toBe('Finance')
            expect(areas[3].id).toBe('new-1')
        })

        it('emits AREA_ADDED event', async () => {
            const listener = vi.fn()
            events.on(Events.AREA_ADDED, listener)
            mockChain._queueResult([{ id: 'new-1', name: 'enc:Finance', color: '#43e97b', sort_order: 3 }])

            await addArea('Finance', '#43e97b')

            expect(listener).toHaveBeenCalledTimes(1)
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-1', name: 'Finance' }))
        })

        it('returns the created area with decrypted name', async () => {
            mockChain._queueResult([{ id: 'new-1', name: 'enc:Finance', color: '#43e97b', sort_order: 3 }])

            const result = await addArea('Finance', '#43e97b')

            expect(result.id).toBe('new-1')
            expect(result.name).toBe('Finance')
        })

        it('calculates sort_order from existing areas', async () => {
            mockChain._queueResult([{ id: 'new-1', name: 'enc:Fourth', color: '#fff', sort_order: 3 }])

            await addArea('Fourth', '#fff')

            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                sort_order: 3
            }))
        })

        it('uses a random color when none is provided', async () => {
            mockChain._queueResult([{ id: 'new-1', name: 'enc:NoColor', color: '#667eea', sort_order: 3 }])

            await addArea('NoColor')

            const insertCall = mockChain.insert.mock.calls[0][0]
            expect(insertCall.color).toBeTruthy()
            expect(insertCall.color).toMatch(/^#/)
        })

        it('throws on Supabase error', async () => {
            mockChain._queueResult(null, { message: 'Insert failed' })

            await expect(addArea('Bad', '#000')).rejects.toEqual({ message: 'Insert failed' })
        })
    })

    // ─── updateArea ───────────────────────────────────────────────────────────

    describe('updateArea', () => {
        it('encrypts name when updating name', async () => {
            mockChain._queueResult(null)

            await updateArea('area-1', { name: 'New Name' })

            expect(encrypt).toHaveBeenCalledWith('New Name')
            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                name: 'enc:New Name'
            }))
        })

        it('updates color without encrypting', async () => {
            mockChain._queueResult(null)

            await updateArea('area-1', { color: '#ff0000' })

            expect(mockChain.update).toHaveBeenCalledWith({ color: '#ff0000' })
        })

        it('updates both name and color', async () => {
            mockChain._queueResult(null)

            await updateArea('area-1', { name: 'Updated', color: '#aabbcc' })

            expect(mockChain.update).toHaveBeenCalledWith({
                name: 'enc:Updated',
                color: '#aabbcc'
            })
        })

        it('updates local store state', async () => {
            mockChain._queueResult(null)

            await updateArea('area-1', { name: 'Renamed', color: '#123456' })

            const areas = store.get('areas')
            const updated = areas.find(a => a.id === 'area-1')
            expect(updated.name).toBe('Renamed')
            expect(updated.color).toBe('#123456')
        })

        it('emits AREA_UPDATED event', async () => {
            const listener = vi.fn()
            events.on(Events.AREA_UPDATED, listener)
            mockChain._queueResult(null)

            await updateArea('area-1', { name: 'Renamed' })

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('calls eq with the correct area ID', async () => {
            mockChain._queueResult(null)

            await updateArea('area-2', { color: '#999' })

            expect(mockChain.eq).toHaveBeenCalledWith('id', 'area-2')
        })

        it('throws on Supabase error', async () => {
            mockChain._queueResult(null, { message: 'Update failed' })

            await expect(updateArea('area-1', { name: 'Bad' })).rejects.toEqual({ message: 'Update failed' })
        })
    })

    // ─── renameArea ───────────────────────────────────────────────────────────

    describe('renameArea', () => {
        it('delegates to updateArea with name field', async () => {
            mockChain._queueResult(null)

            await renameArea('area-1', 'Brand New Name')

            expect(encrypt).toHaveBeenCalledWith('Brand New Name')
            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                name: 'enc:Brand New Name'
            }))
        })

        it('updates the store with the new name', async () => {
            mockChain._queueResult(null)

            await renameArea('area-2', 'Hobbies')

            const areas = store.get('areas')
            const renamed = areas.find(a => a.id === 'area-2')
            expect(renamed.name).toBe('Hobbies')
        })

        it('emits AREA_UPDATED event', async () => {
            const listener = vi.fn()
            events.on(Events.AREA_UPDATED, listener)
            mockChain._queueResult(null)

            await renameArea('area-1', 'Renamed')

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('throws on Supabase error', async () => {
            mockChain._queueResult(null, { message: 'Rename failed' })

            await expect(renameArea('area-1', 'Bad')).rejects.toEqual({ message: 'Rename failed' })
        })
    })

    // ─── deleteArea ───────────────────────────────────────────────────────────

    describe('deleteArea', () => {
        it('calls delete on Supabase with correct ID', async () => {
            mockChain._queueResult(null)

            await deleteArea('area-1')

            expect(mockChain.from).toHaveBeenCalledWith('areas')
            expect(mockChain.delete).toHaveBeenCalled()
            expect(mockChain.eq).toHaveBeenCalledWith('id', 'area-1')
        })

        it('removes the area from store', async () => {
            mockChain._queueResult(null)

            await deleteArea('area-1')

            const areas = store.get('areas')
            expect(areas).toHaveLength(2)
            expect(areas.find(a => a.id === 'area-1')).toBeUndefined()
        })

        it('resets selectedAreaId to "all" if deleted area was selected', async () => {
            store.set('selectedAreaId', 'area-2')
            mockChain._queueResult(null)

            await deleteArea('area-2')

            expect(store.get('selectedAreaId')).toBe('all')
        })

        it('does not change selectedAreaId if a different area was selected', async () => {
            store.set('selectedAreaId', 'area-3')
            mockChain._queueResult(null)

            await deleteArea('area-1')

            expect(store.get('selectedAreaId')).toBe('area-3')
        })

        it('emits AREA_DELETED event with the area ID', async () => {
            const listener = vi.fn()
            events.on(Events.AREA_DELETED, listener)
            mockChain._queueResult(null)

            await deleteArea('area-2')

            expect(listener).toHaveBeenCalledTimes(1)
            expect(listener).toHaveBeenCalledWith('area-2')
        })

        it('throws on Supabase error', async () => {
            mockChain._queueResult(null, { message: 'Delete failed' })

            await expect(deleteArea('area-1')).rejects.toEqual({ message: 'Delete failed' })
        })
    })

    // ─── reorderAreas ─────────────────────────────────────────────────────────

    describe('reorderAreas', () => {
        it('updates store with reordered areas', async () => {
            // Queue results for each update call (3 areas = 3 updates)
            mockChain._queueResult(null)
            mockChain._queueResult(null)
            mockChain._queueResult(null)

            await reorderAreas(['area-3', 'area-1', 'area-2'])

            const areas = store.get('areas')
            expect(areas[0].id).toBe('area-3')
            expect(areas[0].sort_order).toBe(0)
            expect(areas[1].id).toBe('area-1')
            expect(areas[1].sort_order).toBe(1)
            expect(areas[2].id).toBe('area-2')
            expect(areas[2].sort_order).toBe(2)
        })

        it('calls Supabase update for each area with correct sort_order', async () => {
            mockChain._queueResult(null)
            mockChain._queueResult(null)
            mockChain._queueResult(null)

            await reorderAreas(['area-3', 'area-1', 'area-2'])

            expect(mockChain.from).toHaveBeenCalledWith('areas')
            expect(mockChain.update).toHaveBeenCalledWith({ sort_order: 0 })
            expect(mockChain.update).toHaveBeenCalledWith({ sort_order: 1 })
            expect(mockChain.update).toHaveBeenCalledWith({ sort_order: 2 })
        })

        it('emits AREAS_LOADED event', async () => {
            const listener = vi.fn()
            events.on(Events.AREAS_LOADED, listener)
            mockChain._queueResult(null)
            mockChain._queueResult(null)
            mockChain._queueResult(null)

            await reorderAreas(['area-3', 'area-1', 'area-2'])

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('handles single area reorder', async () => {
            store.set('areas', [{ id: 'area-1', name: 'Only', color: '#111', sort_order: 0 }])
            mockChain._queueResult(null)

            await reorderAreas(['area-1'])

            const areas = store.get('areas')
            expect(areas).toHaveLength(1)
            expect(areas[0].sort_order).toBe(0)
        })

        it('handles empty array', async () => {
            await reorderAreas([])

            // Store should be set to empty reordered array
            expect(store.get('areas')).toEqual([])
        })
    })
})
