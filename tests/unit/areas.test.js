// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock modules with external dependencies before importing areas.js
vi.mock('../../src/core/supabase.js', () => ({
    supabase: {}
}))

vi.mock('../../src/services/auth.js', () => ({
    encrypt: vi.fn(),
    decrypt: vi.fn()
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
import { selectArea, restoreSelectedArea, selectAreaByShortcut } from '../../src/services/areas.js'

describe('areas', () => {
    beforeEach(() => {
        store.reset()
        localStorage.clear()
        store.set('areas', [
            { id: 'area-1', name: 'Work', color: '#667eea', sort_order: 0 },
            { id: 'area-2', name: 'Personal', color: '#764ba2', sort_order: 1 },
            { id: 'area-3', name: 'Side Projects', color: '#f093fb', sort_order: 2 },
        ])
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
})
