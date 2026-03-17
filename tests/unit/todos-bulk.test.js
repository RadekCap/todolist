import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Supabase chainable mock ─────────────────────────────────────────────────

// vi.hoisted ensures mockSupabase is available when vi.mock factory runs (hoisted)
const { mockSupabase } = vi.hoisted(() => {
    let result = { data: null, error: null }
    const chain = {
        from: vi.fn(() => chain),
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        single: vi.fn(() => chain),
        then: vi.fn((resolve) => resolve(result)),
        _setResult(data, error = null) {
            result = { data, error }
        },
        _setError(error) {
            result = { data: null, error }
        }
    }
    return { mockSupabase: chain }
})

vi.mock('../../src/core/supabase.js', () => ({
    supabase: mockSupabase
}))

vi.mock('../../src/services/auth.js', () => ({
    encrypt: vi.fn(v => Promise.resolve(v)),
    decrypt: vi.fn(v => Promise.resolve(v))
}))

vi.mock('../../src/services/undo.js', () => ({
    pushUndo: vi.fn()
}))

import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'
import { pushUndo } from '../../src/services/undo.js'
import {
    bulkDeleteTodos,
    bulkUpdateTodosStatus,
    bulkUpdateTodosProject,
    bulkUpdateTodosPriority
} from '../../src/services/todos-bulk.js'

describe('todos-bulk', () => {
    beforeEach(() => {
        store.reset()
        mockSupabase._setResult(null)
        vi.clearAllMocks()

        store.set('todos', [
            { id: 't1', text: 'Todo 1', completed: false, gtd_status: 'inbox', project_id: 'p1', priority_id: null, user_id: 'user-1' },
            { id: 't2', text: 'Todo 2', completed: false, gtd_status: 'next', project_id: null, priority_id: 'pri-1', user_id: 'user-1' },
            { id: 't3', text: 'Todo 3', completed: true, gtd_status: 'done', project_id: 'p1', priority_id: 'pri-2', user_id: 'user-1' },
        ])
        store.set('selectedTodoIds', new Set(['t1', 't2']))
        store.set('lastSelectedTodoId', 't2')
    })

    // ─── bulkDeleteTodos ──────────────────────────────────────────────────────

    describe('bulkDeleteTodos', () => {
        it('returns early if todoIds is null', async () => {
            await bulkDeleteTodos(null)

            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('returns early if todoIds is empty', async () => {
            await bulkDeleteTodos([])

            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('calls supabase delete with the correct IDs', async () => {
            await bulkDeleteTodos(['t1', 't2'])

            expect(mockSupabase.from).toHaveBeenCalledWith('todos')
            expect(mockSupabase.delete).toHaveBeenCalled()
            expect(mockSupabase.in).toHaveBeenCalledWith('id', ['t1', 't2'])
        })

        it('removes deleted todos from store', async () => {
            await bulkDeleteTodos(['t1', 't2'])

            const todos = store.get('todos')
            expect(todos).toHaveLength(1)
            expect(todos[0].id).toBe('t3')
        })

        it('clears selectedTodoIds to empty Set', async () => {
            await bulkDeleteTodos(['t1'])

            const selected = store.get('selectedTodoIds')
            expect(selected.size).toBe(0)
        })

        it('sets lastSelectedTodoId to null', async () => {
            await bulkDeleteTodos(['t1'])

            expect(store.get('lastSelectedTodoId')).toBeNull()
        })

        it('emits TODOS_UPDATED event', async () => {
            const listener = vi.fn()
            events.on(Events.TODOS_UPDATED, listener)

            await bulkDeleteTodos(['t1'])

            expect(listener).toHaveBeenCalledTimes(1)
            const emittedTodos = listener.mock.calls[0][0]
            expect(emittedTodos).toHaveLength(2)
        })

        it('calls pushUndo with correct message', async () => {
            await bulkDeleteTodos(['t1', 't2'])

            expect(pushUndo).toHaveBeenCalledTimes(1)
            expect(pushUndo).toHaveBeenCalledWith(
                'Deleted 2 item(s)',
                expect.any(Function)
            )
        })

        it('does not call pushUndo when no todos match the IDs', async () => {
            await bulkDeleteTodos(['nonexistent'])

            expect(pushUndo).not.toHaveBeenCalled()
        })

        it('throws on supabase error', async () => {
            mockSupabase._setError({ message: 'DB error' })

            await expect(bulkDeleteTodos(['t1'])).rejects.toEqual({ message: 'DB error' })
        })

        it('does not modify store on supabase error', async () => {
            mockSupabase._setError({ message: 'DB error' })

            try { await bulkDeleteTodos(['t1']) } catch {}

            const todos = store.get('todos')
            expect(todos).toHaveLength(3)
        })

        it('undo callback restores deleted todos via supabase insert', async () => {
            await bulkDeleteTodos(['t1'])

            const undoCallback = pushUndo.mock.calls[0][1]

            // Set up mock for the restore insert + select chain
            mockSupabase._setResult([
                { id: 't1-new', text: 'Todo 1', completed: false, gtd_status: 'inbox', project_id: 'p1', priority_id: null, user_id: 'user-1' }
            ])

            await undoCallback()

            expect(mockSupabase.insert).toHaveBeenCalled()
            expect(mockSupabase.select).toHaveBeenCalled()
            // Restored todo should be added to the store
            const todos = store.get('todos')
            expect(todos.some(t => t.id === 't1-new')).toBe(true)
        })

        it('undo callback throws on Supabase error during restore', async () => {
            await bulkDeleteTodos(['t1'])

            const undoCallback = pushUndo.mock.calls[0][1]

            mockSupabase._setError({ message: 'Restore insert failed' })

            await expect(undoCallback()).rejects.toEqual({ message: 'Restore insert failed' })
        })
    })

    // ─── bulkUpdateTodosStatus ────────────────────────────────────────────────

    describe('bulkUpdateTodosStatus', () => {
        it('returns early if todoIds is null', async () => {
            await bulkUpdateTodosStatus(null, 'next')

            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('returns early if todoIds is empty', async () => {
            await bulkUpdateTodosStatus([], 'next')

            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('sets completed=true when gtdStatus is done', async () => {
            await bulkUpdateTodosStatus(['t1', 't2'], 'done')

            expect(mockSupabase.update).toHaveBeenCalledWith({
                gtd_status: 'done',
                completed: true
            })
        })

        it('sets completed=false for non-done statuses', async () => {
            await bulkUpdateTodosStatus(['t1', 't2'], 'next')

            expect(mockSupabase.update).toHaveBeenCalledWith({
                gtd_status: 'next',
                completed: false
            })
        })

        it('updates todos in store with new gtd_status and completed', async () => {
            await bulkUpdateTodosStatus(['t1', 't2'], 'waiting')

            const todos = store.get('todos')
            const t1 = todos.find(t => t.id === 't1')
            const t2 = todos.find(t => t.id === 't2')

            expect(t1.gtd_status).toBe('waiting')
            expect(t1.completed).toBe(false)
            expect(t2.gtd_status).toBe('waiting')
            expect(t2.completed).toBe(false)
        })

        it('does not modify todos not in the list', async () => {
            await bulkUpdateTodosStatus(['t1'], 'next')

            const todos = store.get('todos')
            const t2 = todos.find(t => t.id === 't2')
            const t3 = todos.find(t => t.id === 't3')

            expect(t2.gtd_status).toBe('next')
            expect(t3.gtd_status).toBe('done')
            expect(t3.completed).toBe(true)
        })

        it('clears selection', async () => {
            await bulkUpdateTodosStatus(['t1'], 'next')

            expect(store.get('selectedTodoIds').size).toBe(0)
            expect(store.get('lastSelectedTodoId')).toBeNull()
        })

        it('emits TODOS_UPDATED event', async () => {
            const listener = vi.fn()
            events.on(Events.TODOS_UPDATED, listener)

            await bulkUpdateTodosStatus(['t1'], 'next')

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('calls pushUndo with correct message for status change', async () => {
            await bulkUpdateTodosStatus(['t1', 't2'], 'someday')

            expect(pushUndo).toHaveBeenCalledWith(
                'Moved 2 item(s) to someday',
                expect.any(Function)
            )
        })

        it('captures previous states for undo', async () => {
            await bulkUpdateTodosStatus(['t1', 't2'], 'done')

            expect(pushUndo).toHaveBeenCalledTimes(1)
        })

        it('throws on supabase error', async () => {
            mockSupabase._setError({ message: 'Update failed' })

            await expect(bulkUpdateTodosStatus(['t1'], 'next'))
                .rejects.toEqual({ message: 'Update failed' })
        })

        it('undo callback restores previous gtd_status and completed', async () => {
            // t1 was inbox/false, t3 was done/true
            await bulkUpdateTodosStatus(['t1', 't3'], 'waiting')

            const undoCallback = pushUndo.mock.calls[0][1]

            // Reset mock for undo calls
            mockSupabase._setResult(null)

            await undoCallback()

            const todos = store.get('todos')
            const t1 = todos.find(t => t.id === 't1')
            const t3 = todos.find(t => t.id === 't3')

            expect(t1.gtd_status).toBe('inbox')
            expect(t1.completed).toBe(false)
            expect(t3.gtd_status).toBe('done')
            expect(t3.completed).toBe(true)
        })
    })

    // ─── bulkUpdateTodosProject ───────────────────────────────────────────────

    describe('bulkUpdateTodosProject', () => {
        it('returns early if todoIds is null', async () => {
            await bulkUpdateTodosProject(null, 'p2')

            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('returns early if todoIds is empty', async () => {
            await bulkUpdateTodosProject([], 'p2')

            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('calls supabase update with the correct project_id', async () => {
            await bulkUpdateTodosProject(['t1', 't2'], 'p2')

            expect(mockSupabase.update).toHaveBeenCalledWith({ project_id: 'p2' })
            expect(mockSupabase.in).toHaveBeenCalledWith('id', ['t1', 't2'])
        })

        it('sets project_id to null when projectId is empty string', async () => {
            await bulkUpdateTodosProject(['t1'], '')

            expect(mockSupabase.update).toHaveBeenCalledWith({ project_id: null })
        })

        it('sets project_id to null when projectId is null', async () => {
            await bulkUpdateTodosProject(['t1'], null)

            expect(mockSupabase.update).toHaveBeenCalledWith({ project_id: null })
        })

        it('updates project_id in store', async () => {
            await bulkUpdateTodosProject(['t1', 't2'], 'p2')

            const todos = store.get('todos')
            expect(todos.find(t => t.id === 't1').project_id).toBe('p2')
            expect(todos.find(t => t.id === 't2').project_id).toBe('p2')
        })

        it('does not modify todos not in the list', async () => {
            await bulkUpdateTodosProject(['t1'], 'p2')

            const t3 = store.get('todos').find(t => t.id === 't3')
            expect(t3.project_id).toBe('p1')
        })

        it('clears selection', async () => {
            await bulkUpdateTodosProject(['t1'], 'p2')

            expect(store.get('selectedTodoIds').size).toBe(0)
            expect(store.get('lastSelectedTodoId')).toBeNull()
        })

        it('emits TODOS_UPDATED event', async () => {
            const listener = vi.fn()
            events.on(Events.TODOS_UPDATED, listener)

            await bulkUpdateTodosProject(['t1'], 'p2')

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('calls pushUndo with correct message', async () => {
            await bulkUpdateTodosProject(['t1', 't2'], 'p2')

            expect(pushUndo).toHaveBeenCalledWith(
                'Changed project for 2 item(s)',
                expect.any(Function)
            )
        })

        it('throws on supabase error', async () => {
            mockSupabase._setError({ message: 'Project update failed' })

            await expect(bulkUpdateTodosProject(['t1'], 'p2'))
                .rejects.toEqual({ message: 'Project update failed' })
        })

        it('undo callback restores previous project_id values', async () => {
            // t1 had project_id 'p1', t2 had null
            await bulkUpdateTodosProject(['t1', 't2'], 'p2')

            const undoCallback = pushUndo.mock.calls[0][1]
            mockSupabase._setResult(null)

            await undoCallback()

            const todos = store.get('todos')
            expect(todos.find(t => t.id === 't1').project_id).toBe('p1')
            expect(todos.find(t => t.id === 't2').project_id).toBeNull()
        })
    })

    // ─── bulkUpdateTodosPriority ──────────────────────────────────────────────

    describe('bulkUpdateTodosPriority', () => {
        it('returns early if todoIds is null', async () => {
            await bulkUpdateTodosPriority(null, 'pri-1')

            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('returns early if todoIds is empty', async () => {
            await bulkUpdateTodosPriority([], 'pri-1')

            expect(mockSupabase.from).not.toHaveBeenCalled()
        })

        it('calls supabase update with the correct priority_id', async () => {
            await bulkUpdateTodosPriority(['t1', 't2'], 'pri-3')

            expect(mockSupabase.update).toHaveBeenCalledWith({ priority_id: 'pri-3' })
            expect(mockSupabase.in).toHaveBeenCalledWith('id', ['t1', 't2'])
        })

        it('sets priority_id to null when priorityId is empty string', async () => {
            await bulkUpdateTodosPriority(['t1'], '')

            expect(mockSupabase.update).toHaveBeenCalledWith({ priority_id: null })
        })

        it('sets priority_id to null when priorityId is null', async () => {
            await bulkUpdateTodosPriority(['t1'], null)

            expect(mockSupabase.update).toHaveBeenCalledWith({ priority_id: null })
        })

        it('updates priority_id in store', async () => {
            await bulkUpdateTodosPriority(['t1', 't2'], 'pri-3')

            const todos = store.get('todos')
            expect(todos.find(t => t.id === 't1').priority_id).toBe('pri-3')
            expect(todos.find(t => t.id === 't2').priority_id).toBe('pri-3')
        })

        it('does not modify todos not in the list', async () => {
            await bulkUpdateTodosPriority(['t1'], 'pri-3')

            const t3 = store.get('todos').find(t => t.id === 't3')
            expect(t3.priority_id).toBe('pri-2')
        })

        it('clears selection', async () => {
            await bulkUpdateTodosPriority(['t1'], 'pri-3')

            expect(store.get('selectedTodoIds').size).toBe(0)
            expect(store.get('lastSelectedTodoId')).toBeNull()
        })

        it('emits TODOS_UPDATED event', async () => {
            const listener = vi.fn()
            events.on(Events.TODOS_UPDATED, listener)

            await bulkUpdateTodosPriority(['t1'], 'pri-3')

            expect(listener).toHaveBeenCalledTimes(1)
        })

        it('calls pushUndo with correct message', async () => {
            await bulkUpdateTodosPriority(['t1', 't2'], 'pri-3')

            expect(pushUndo).toHaveBeenCalledWith(
                'Changed priority for 2 item(s)',
                expect.any(Function)
            )
        })

        it('throws on supabase error', async () => {
            mockSupabase._setError({ message: 'Priority update failed' })

            await expect(bulkUpdateTodosPriority(['t1'], 'pri-3'))
                .rejects.toEqual({ message: 'Priority update failed' })
        })

        it('undo callback restores previous priority_id values', async () => {
            // t1 had priority_id null, t2 had 'pri-1'
            await bulkUpdateTodosPriority(['t1', 't2'], 'pri-3')

            const undoCallback = pushUndo.mock.calls[0][1]
            mockSupabase._setResult(null)

            await undoCallback()

            const todos = store.get('todos')
            expect(todos.find(t => t.id === 't1').priority_id).toBeNull()
            expect(todos.find(t => t.id === 't2').priority_id).toBe('pri-1')
        })
    })
})
