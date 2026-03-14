import { describe, it, expect, beforeEach } from 'vitest'
import { store } from '../../src/core/store.js'
import {
    toggleTodoSelection,
    selectTodoRange,
    selectAllTodos,
    clearTodoSelection
} from '../../src/services/todos-selection.js'

describe('todos-selection', () => {
    beforeEach(() => {
        store.reset()
    })

    // ─── toggleTodoSelection ─────────────────────────────────────────────────

    describe('toggleTodoSelection', () => {
        it('selects a todo when not already selected', () => {
            toggleTodoSelection('todo-1')

            const selected = store.get('selectedTodoIds')
            expect(selected.has('todo-1')).toBe(true)
            expect(selected.size).toBe(1)
        })

        it('deselects a todo when already selected', () => {
            toggleTodoSelection('todo-1')
            toggleTodoSelection('todo-1')

            const selected = store.get('selectedTodoIds')
            expect(selected.has('todo-1')).toBe(false)
            expect(selected.size).toBe(0)
        })

        it('sets lastSelectedTodoId to the toggled todo', () => {
            toggleTodoSelection('todo-1')
            expect(store.get('lastSelectedTodoId')).toBe('todo-1')
        })

        it('sets lastSelectedTodoId even when deselecting', () => {
            toggleTodoSelection('todo-1')
            toggleTodoSelection('todo-1')
            expect(store.get('lastSelectedTodoId')).toBe('todo-1')
        })

        it('can select multiple todos independently', () => {
            toggleTodoSelection('todo-1')
            toggleTodoSelection('todo-2')
            toggleTodoSelection('todo-3')

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(3)
            expect(selected.has('todo-1')).toBe(true)
            expect(selected.has('todo-2')).toBe(true)
            expect(selected.has('todo-3')).toBe(true)
        })

        it('deselects only the specified todo from a multi-selection', () => {
            toggleTodoSelection('todo-1')
            toggleTodoSelection('todo-2')
            toggleTodoSelection('todo-3')
            toggleTodoSelection('todo-2')

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(2)
            expect(selected.has('todo-1')).toBe(true)
            expect(selected.has('todo-2')).toBe(false)
            expect(selected.has('todo-3')).toBe(true)
        })

        it('updates lastSelectedTodoId on each toggle call', () => {
            toggleTodoSelection('todo-1')
            expect(store.get('lastSelectedTodoId')).toBe('todo-1')

            toggleTodoSelection('todo-2')
            expect(store.get('lastSelectedTodoId')).toBe('todo-2')

            toggleTodoSelection('todo-3')
            expect(store.get('lastSelectedTodoId')).toBe('todo-3')
        })

        it('handles toggling with empty string id', () => {
            toggleTodoSelection('')

            const selected = store.get('selectedTodoIds')
            expect(selected.has('')).toBe(true)
            expect(selected.size).toBe(1)
        })
    })

    // ─── selectTodoRange ─────────────────────────────────────────────────────

    describe('selectTodoRange', () => {
        const visibleIds = ['todo-1', 'todo-2', 'todo-3', 'todo-4', 'todo-5']

        it('selects only the clicked todo when no previous selection exists', () => {
            selectTodoRange('todo-3', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(1)
            expect(selected.has('todo-3')).toBe(true)
        })

        it('sets lastSelectedTodoId when no previous selection exists', () => {
            selectTodoRange('todo-3', visibleIds)
            expect(store.get('lastSelectedTodoId')).toBe('todo-3')
        })

        it('selects a forward range from lastSelectedTodoId to clicked todo', () => {
            store.set('lastSelectedTodoId', 'todo-2')

            selectTodoRange('todo-4', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.has('todo-2')).toBe(true)
            expect(selected.has('todo-3')).toBe(true)
            expect(selected.has('todo-4')).toBe(true)
            expect(selected.size).toBe(3)
        })

        it('selects a backward range from lastSelectedTodoId to clicked todo', () => {
            store.set('lastSelectedTodoId', 'todo-4')

            selectTodoRange('todo-2', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.has('todo-2')).toBe(true)
            expect(selected.has('todo-3')).toBe(true)
            expect(selected.has('todo-4')).toBe(true)
            expect(selected.size).toBe(3)
        })

        it('selects a single item when range start equals range end', () => {
            store.set('lastSelectedTodoId', 'todo-3')

            selectTodoRange('todo-3', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.has('todo-3')).toBe(true)
            expect(selected.size).toBe(1)
        })

        it('adds range to existing selection without removing previous items', () => {
            store.set('selectedTodoIds', new Set(['todo-1']))
            store.set('lastSelectedTodoId', 'todo-3')

            selectTodoRange('todo-5', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.has('todo-1')).toBe(true)
            expect(selected.has('todo-3')).toBe(true)
            expect(selected.has('todo-4')).toBe(true)
            expect(selected.has('todo-5')).toBe(true)
            expect(selected.size).toBe(4)
        })

        it('falls back to single selection when lastSelectedTodoId is not in visibleTodoIds', () => {
            store.set('lastSelectedTodoId', 'non-visible-todo')

            selectTodoRange('todo-3', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(1)
            expect(selected.has('todo-3')).toBe(true)
            expect(store.get('lastSelectedTodoId')).toBe('todo-3')
        })

        it('falls back to single selection when clicked todo is not in visibleTodoIds', () => {
            store.set('lastSelectedTodoId', 'todo-2')

            selectTodoRange('non-visible-todo', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(1)
            expect(selected.has('non-visible-todo')).toBe(true)
            expect(store.get('lastSelectedTodoId')).toBe('non-visible-todo')
        })

        it('does not update lastSelectedTodoId on a successful range selection', () => {
            store.set('lastSelectedTodoId', 'todo-2')

            selectTodoRange('todo-4', visibleIds)

            // lastSelectedTodoId should remain at the anchor, not change
            expect(store.get('lastSelectedTodoId')).toBe('todo-2')
        })

        it('handles range with empty visibleTodoIds array', () => {
            store.set('lastSelectedTodoId', 'todo-1')

            selectTodoRange('todo-3', [])

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(1)
            expect(selected.has('todo-3')).toBe(true)
        })

        it('handles range covering all visible todos', () => {
            store.set('lastSelectedTodoId', 'todo-1')

            selectTodoRange('todo-5', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(5)
            visibleIds.forEach(id => {
                expect(selected.has(id)).toBe(true)
            })
        })

        it('handles duplicate ids in existing selection gracefully', () => {
            store.set('selectedTodoIds', new Set(['todo-2', 'todo-3']))
            store.set('lastSelectedTodoId', 'todo-2')

            selectTodoRange('todo-4', visibleIds)

            const selected = store.get('selectedTodoIds')
            // todo-2 and todo-3 were already in selection, range adds todo-2..todo-4
            expect(selected.has('todo-2')).toBe(true)
            expect(selected.has('todo-3')).toBe(true)
            expect(selected.has('todo-4')).toBe(true)
            expect(selected.size).toBe(3)
        })
    })

    // ─── selectAllTodos ──────────────────────────────────────────────────────

    describe('selectAllTodos', () => {
        it('selects all visible todos', () => {
            const visibleIds = ['todo-1', 'todo-2', 'todo-3']

            selectAllTodos(visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(3)
            expect(selected.has('todo-1')).toBe(true)
            expect(selected.has('todo-2')).toBe(true)
            expect(selected.has('todo-3')).toBe(true)
        })

        it('sets lastSelectedTodoId to the last visible todo', () => {
            selectAllTodos(['todo-1', 'todo-2', 'todo-3'])
            expect(store.get('lastSelectedTodoId')).toBe('todo-3')
        })

        it('handles empty array without error', () => {
            selectAllTodos([])

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(0)
        })

        it('does not set lastSelectedTodoId for empty array', () => {
            store.set('lastSelectedTodoId', 'existing-id')

            selectAllTodos([])

            // lastSelectedTodoId is not updated when array is empty
            expect(store.get('lastSelectedTodoId')).toBe('existing-id')
        })

        it('replaces any existing selection', () => {
            store.set('selectedTodoIds', new Set(['old-todo-1', 'old-todo-2']))

            selectAllTodos(['new-todo-1', 'new-todo-2'])

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(2)
            expect(selected.has('old-todo-1')).toBe(false)
            expect(selected.has('new-todo-1')).toBe(true)
            expect(selected.has('new-todo-2')).toBe(true)
        })

        it('handles a single visible todo', () => {
            selectAllTodos(['todo-1'])

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(1)
            expect(selected.has('todo-1')).toBe(true)
            expect(store.get('lastSelectedTodoId')).toBe('todo-1')
        })
    })

    // ─── clearTodoSelection ──────────────────────────────────────────────────

    describe('clearTodoSelection', () => {
        it('clears all selected todo ids', () => {
            store.set('selectedTodoIds', new Set(['todo-1', 'todo-2', 'todo-3']))

            clearTodoSelection()

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(0)
        })

        it('sets lastSelectedTodoId to null', () => {
            store.set('lastSelectedTodoId', 'todo-1')

            clearTodoSelection()

            expect(store.get('lastSelectedTodoId')).toBeNull()
        })

        it('can be called on already empty selection without error', () => {
            expect(() => clearTodoSelection()).not.toThrow()

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(0)
            expect(store.get('lastSelectedTodoId')).toBeNull()
        })

        it('allows new selections after clearing', () => {
            toggleTodoSelection('todo-1')
            clearTodoSelection()
            toggleTodoSelection('todo-2')

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(1)
            expect(selected.has('todo-2')).toBe(true)
        })
    })

    // ─── integration scenarios ───────────────────────────────────────────────

    describe('integration scenarios', () => {
        it('toggle then range extends selection correctly', () => {
            const visibleIds = ['todo-1', 'todo-2', 'todo-3', 'todo-4']

            toggleTodoSelection('todo-1')
            selectTodoRange('todo-3', visibleIds)

            const selected = store.get('selectedTodoIds')
            expect(selected.has('todo-1')).toBe(true)
            expect(selected.has('todo-2')).toBe(true)
            expect(selected.has('todo-3')).toBe(true)
        })

        it('selectAll then clear results in empty selection', () => {
            selectAllTodos(['todo-1', 'todo-2', 'todo-3'])
            clearTodoSelection()

            expect(store.get('selectedTodoIds').size).toBe(0)
            expect(store.get('lastSelectedTodoId')).toBeNull()
        })

        it('toggle, clear, toggle starts fresh', () => {
            toggleTodoSelection('todo-1')
            toggleTodoSelection('todo-2')
            clearTodoSelection()
            toggleTodoSelection('todo-3')

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(1)
            expect(selected.has('todo-3')).toBe(true)
            expect(store.get('lastSelectedTodoId')).toBe('todo-3')
        })
    })
})
