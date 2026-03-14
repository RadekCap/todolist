import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'

describe('Store', () => {
    beforeEach(() => {
        store.reset()
    })

    // ─── Initial state ────────────────────────────────────────────────────────

    describe('initial state', () => {
        it('has null currentUser', () => {
            expect(store.get('currentUser')).toBeNull()
        })

        it('has empty todos array', () => {
            expect(store.get('todos')).toEqual([])
        })

        it('has empty templates array', () => {
            expect(store.get('templates')).toEqual([])
        })

        it('has empty categories array', () => {
            expect(store.get('categories')).toEqual([])
        })

        it('has empty projects array', () => {
            expect(store.get('projects')).toEqual([])
        })

        it('has empty areas array', () => {
            expect(store.get('areas')).toEqual([])
        })

        it('has empty selectedCategoryIds Set', () => {
            expect(store.get('selectedCategoryIds')).toBeInstanceOf(Set)
            expect(store.get('selectedCategoryIds').size).toBe(0)
        })

        it('has empty selectedTodoIds Set', () => {
            expect(store.get('selectedTodoIds')).toBeInstanceOf(Set)
            expect(store.get('selectedTodoIds').size).toBe(0)
        })

        it('has default selectedGtdStatus "inbox"', () => {
            expect(store.get('selectedGtdStatus')).toBe('inbox')
        })

        it('has default selectedAreaId "all"', () => {
            expect(store.get('selectedAreaId')).toBe('all')
        })

        it('has showProjectsView false', () => {
            expect(store.get('showProjectsView')).toBe(false)
        })

        it('has empty searchQuery', () => {
            expect(store.get('searchQuery')).toBe('')
        })
    })

    // ─── get / set ────────────────────────────────────────────────────────────

    describe('get and set', () => {
        it('sets and retrieves a value', () => {
            store.set('currentUser', { id: '123', email: 'test@test.com' })
            expect(store.get('currentUser')).toEqual({ id: '123', email: 'test@test.com' })
        })

        it('overwrites previous value', () => {
            store.set('searchQuery', 'hello')
            store.set('searchQuery', 'world')
            expect(store.get('searchQuery')).toBe('world')
        })

        it('can set value to null', () => {
            store.set('currentUser', { id: '1' })
            store.set('currentUser', null)
            expect(store.get('currentUser')).toBeNull()
        })

        it('can set arrays', () => {
            const todos = [{ id: 1, text: 'Test' }, { id: 2, text: 'Test2' }]
            store.set('todos', todos)
            expect(store.get('todos')).toEqual(todos)
        })

        it('can set Set values', () => {
            const ids = new Set(['a', 'b', 'c'])
            store.set('selectedCategoryIds', ids)
            expect(store.get('selectedCategoryIds')).toEqual(ids)
        })

        it('returns undefined for non-existent keys', () => {
            expect(store.get('nonExistentKey')).toBeUndefined()
        })
    })

    // ─── state property ───────────────────────────────────────────────────────

    describe('state property', () => {
        it('provides access to full state object', () => {
            store.set('searchQuery', 'test')
            expect(store.state.searchQuery).toBe('test')
        })

        it('reflects changes immediately', () => {
            store.set('showProjectsView', true)
            expect(store.state.showProjectsView).toBe(true)
        })
    })

    // ─── update (batch) ───────────────────────────────────────────────────────

    describe('update (batch)', () => {
        it('updates multiple keys at once', () => {
            store.update({
                selectedGtdStatus: 'next_action',
                showProjectsView: true,
                searchQuery: 'find me'
            })
            expect(store.get('selectedGtdStatus')).toBe('next_action')
            expect(store.get('showProjectsView')).toBe(true)
            expect(store.get('searchQuery')).toBe('find me')
        })

        it('notifies each key listener individually', () => {
            const gtdListener = vi.fn()
            const searchListener = vi.fn()
            store.subscribe('selectedGtdStatus', gtdListener)
            store.subscribe('searchQuery', searchListener)

            store.update({
                selectedGtdStatus: 'done',
                searchQuery: 'hello'
            })

            expect(gtdListener).toHaveBeenCalledOnce()
            expect(gtdListener).toHaveBeenCalledWith('done', 'inbox')
            expect(searchListener).toHaveBeenCalledOnce()
            expect(searchListener).toHaveBeenCalledWith('hello', '')
        })
    })

    // ─── subscribe ────────────────────────────────────────────────────────────

    describe('subscribe', () => {
        it('calls listener when value changes', () => {
            const listener = vi.fn()
            store.subscribe('searchQuery', listener)

            store.set('searchQuery', 'new query')
            expect(listener).toHaveBeenCalledWith('new query', '')
        })

        it('passes both new and old values', () => {
            const listener = vi.fn()
            store.subscribe('selectedGtdStatus', listener)

            store.set('selectedGtdStatus', 'done')
            expect(listener).toHaveBeenCalledWith('done', 'inbox')
        })

        it('calls listener on every change', () => {
            const listener = vi.fn()
            store.subscribe('searchQuery', listener)

            store.set('searchQuery', 'first')
            store.set('searchQuery', 'second')
            store.set('searchQuery', 'third')

            expect(listener).toHaveBeenCalledTimes(3)
        })

        it('notifies even when value is set to same reference', () => {
            const listener = vi.fn()
            store.subscribe('searchQuery', listener)

            store.set('searchQuery', 'same')
            store.set('searchQuery', 'same')

            // Store doesn't do equality check, so both calls notify
            expect(listener).toHaveBeenCalledTimes(2)
        })

        it('supports multiple listeners on same key', () => {
            const listener1 = vi.fn()
            const listener2 = vi.fn()
            store.subscribe('searchQuery', listener1)
            store.subscribe('searchQuery', listener2)

            store.set('searchQuery', 'test')

            expect(listener1).toHaveBeenCalledOnce()
            expect(listener2).toHaveBeenCalledOnce()
        })

        it('does not notify listeners of other keys', () => {
            const searchListener = vi.fn()
            const gtdListener = vi.fn()
            store.subscribe('searchQuery', searchListener)
            store.subscribe('selectedGtdStatus', gtdListener)

            store.set('searchQuery', 'test')

            expect(searchListener).toHaveBeenCalledOnce()
            expect(gtdListener).not.toHaveBeenCalled()
        })
    })

    // ─── unsubscribe ──────────────────────────────────────────────────────────

    describe('unsubscribe', () => {
        it('returns an unsubscribe function', () => {
            const unsubscribe = store.subscribe('searchQuery', vi.fn())
            expect(typeof unsubscribe).toBe('function')
        })

        it('stops notifications after unsubscribe', () => {
            const listener = vi.fn()
            const unsubscribe = store.subscribe('searchQuery', listener)

            store.set('searchQuery', 'first')
            expect(listener).toHaveBeenCalledTimes(1)

            unsubscribe()

            store.set('searchQuery', 'second')
            expect(listener).toHaveBeenCalledTimes(1) // no additional call
        })

        it('only unsubscribes the specific listener', () => {
            const listener1 = vi.fn()
            const listener2 = vi.fn()
            const unsub1 = store.subscribe('searchQuery', listener1)
            store.subscribe('searchQuery', listener2)

            unsub1()
            store.set('searchQuery', 'test')

            expect(listener1).not.toHaveBeenCalled()
            expect(listener2).toHaveBeenCalledOnce()
        })

        it('handles double unsubscribe gracefully', () => {
            const listener = vi.fn()
            const unsubscribe = store.subscribe('searchQuery', listener)

            unsubscribe()
            expect(() => unsubscribe()).not.toThrow()
        })
    })

    // ─── error handling ───────────────────────────────────────────────────────

    describe('error handling in listeners', () => {
        it('continues notifying other listeners if one throws', () => {
            const errorListener = vi.fn(() => { throw new Error('boom') })
            const normalListener = vi.fn()

            // Suppress console.error from the store's error handler
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            store.subscribe('searchQuery', errorListener)
            store.subscribe('searchQuery', normalListener)

            store.set('searchQuery', 'test')

            expect(errorListener).toHaveBeenCalledOnce()
            expect(normalListener).toHaveBeenCalledOnce()

            consoleSpy.mockRestore()
        })

        it('logs error to console when listener throws', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            store.subscribe('searchQuery', () => { throw new Error('listener error') })
            store.set('searchQuery', 'test')

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('searchQuery'),
                expect.any(Error)
            )

            consoleSpy.mockRestore()
        })
    })

    // ─── reset ────────────────────────────────────────────────────────────────

    describe('reset', () => {
        it('clears all state back to defaults', () => {
            store.set('currentUser', { id: '1' })
            store.set('todos', [{ id: 1 }])
            store.set('searchQuery', 'hello')
            store.set('selectedGtdStatus', 'done')
            store.set('showProjectsView', true)

            store.reset()

            expect(store.get('currentUser')).toBeNull()
            expect(store.get('todos')).toEqual([])
            expect(store.get('searchQuery')).toBe('')
            expect(store.get('selectedGtdStatus')).toBe('inbox')
            expect(store.get('showProjectsView')).toBe(false)
        })

        it('resets Sets to empty', () => {
            store.get('selectedCategoryIds').add('cat1')
            store.get('selectedTodoIds').add('todo1')

            store.reset()

            expect(store.get('selectedCategoryIds').size).toBe(0)
            expect(store.get('selectedTodoIds').size).toBe(0)
        })

        it('preserves existing subscriptions (listeners still attached)', () => {
            const listener = vi.fn()
            store.subscribe('searchQuery', listener)

            store.reset()

            // Listener should still fire on the key after reset
            store.set('searchQuery', 'after reset')
            expect(listener).toHaveBeenCalledWith('after reset', '')
        })
    })
})
