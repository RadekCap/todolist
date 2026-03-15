import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/auth.js', () => ({
    encrypt: vi.fn(v => Promise.resolve(`enc:${v}`)),
    decrypt: vi.fn(v => Promise.resolve(v?.startsWith?.('enc:') ? v.slice(4) : v))
}))

vi.mock('../../src/services/undo.js', () => ({
    pushUndo: vi.fn()
}))

vi.mock('../../src/services/todos-recurrence.js', () => ({
    checkPendingRecurrences: vi.fn(() => Promise.resolve()),
    generateNextRecurrence: vi.fn(() => Promise.resolve())
}))

// Stub re-exported modules so the dynamic import doesn't pull them in
vi.mock('../../src/services/todos-filters.js', () => ({}))
vi.mock('../../src/services/todos-selection.js', () => ({}))
vi.mock('../../src/services/todos-bulk.js', () => ({}))

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
const {
    loadTodos, addTodo, batchAddTodos, updateTodo,
    toggleTodo, deleteTodo,
    updateTodoCategory, updateTodoContext, updateTodoGtdStatus, updateTodoProject
} = await import('../../src/services/todos.js')

const { pushUndo } = await import('../../src/services/undo.js')
const { checkPendingRecurrences, generateNextRecurrence } = await import('../../src/services/todos-recurrence.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('todos', () => {
    beforeEach(() => {
        store.reset()
        mockSupabase._reset()
        vi.clearAllMocks()

        store.set('currentUser', { id: 'user-1' })
        store.set('todos', [
            { id: 'todo-1', text: 'Buy milk', completed: false, gtd_status: 'inbox', user_id: 'user-1', category_id: null, project_id: null, priority_id: null, context_id: null, due_date: null, comment: null },
            { id: 'todo-2', text: 'Write tests', completed: true, gtd_status: 'done', user_id: 'user-1', category_id: 'cat-1', project_id: 'proj-1', priority_id: null, context_id: null, due_date: '2026-03-15', comment: 'Important' }
        ])
        store.set('templates', [])
    })

    // ─── loadTodos ────────────────────────────────────────────────────────────

    describe('loadTodos', () => {
        it('returns decrypted non-template todos', async () => {
            mockSupabase._queueResult([
                { id: 't1', text: 'enc:Hello', is_template: false, comment: null },
                { id: 't2', text: 'enc:World', is_template: false, comment: 'enc:Note' }
            ])

            const result = await loadTodos()

            expect(result).toHaveLength(2)
            expect(result[0].text).toBe('Hello')
            expect(result[1].text).toBe('World')
            expect(result[1].comment).toBe('Note')
        })

        it('filters out template todos', async () => {
            mockSupabase._queueResult([
                { id: 't1', text: 'enc:Visible', is_template: false, comment: null },
                { id: 'tmpl-1', text: 'enc:Template', is_template: true, comment: null }
            ])

            const result = await loadTodos()

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('t1')
        })

        it('stores templates separately in store', async () => {
            mockSupabase._queueResult([
                { id: 't1', text: 'enc:Visible', is_template: false, comment: null },
                { id: 'tmpl-1', text: 'enc:Template', is_template: true, comment: null }
            ])

            await loadTodos()

            const templates = store.get('templates')
            expect(templates).toHaveLength(1)
            expect(templates[0].id).toBe('tmpl-1')
        })

        it('sets todos in store and emits TODOS_LOADED', async () => {
            const handler = vi.fn()
            events.on(Events.TODOS_LOADED, handler)
            mockSupabase._queueResult([
                { id: 't1', text: 'enc:Task', is_template: false, comment: null }
            ])

            await loadTodos()

            expect(store.get('todos')).toHaveLength(1)
            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODOS_LOADED)
        })

        it('calls checkPendingRecurrences after loading', async () => {
            mockSupabase._queueResult([])

            await loadTodos()

            expect(checkPendingRecurrences).toHaveBeenCalledTimes(1)
        })

        it('handles pagination across multiple pages', async () => {
            // First page: exactly 1000 items (PAGE_SIZE), triggers another fetch
            const page1 = Array.from({ length: 1000 }, (_, i) => ({
                id: `t-${i}`, text: `enc:Item ${i}`, is_template: false, comment: null
            }))
            // Second page: fewer than 1000, ends the loop
            const page2 = [
                { id: 't-1000', text: 'enc:Last', is_template: false, comment: null }
            ]
            mockSupabase._queueResult(page1)
            mockSupabase._queueResult(page2)

            const result = await loadTodos()

            expect(result).toHaveLength(1001)
            // range() should have been called twice: (0, 999) and (1000, 1999)
            expect(mockSupabase.range).toHaveBeenCalledTimes(2)
            expect(mockSupabase.range).toHaveBeenCalledWith(0, 999)
            expect(mockSupabase.range).toHaveBeenCalledWith(1000, 1999)
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'DB error' })

            await expect(loadTodos()).rejects.toEqual({ message: 'DB error' })
        })

        it('keeps null comments as null', async () => {
            mockSupabase._queueResult([
                { id: 't1', text: 'enc:Task', is_template: false, comment: null }
            ])

            const result = await loadTodos()

            expect(result[0].comment).toBeNull()
        })
    })

    // ─── addTodo ──────────────────────────────────────────────────────────────

    describe('addTodo', () => {
        it('encrypts text and inserts to Supabase', async () => {
            mockSupabase._queueResult([{ id: 'new-1', text: 'enc:New task' }])

            await addTodo({ text: 'New task' })

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                text: 'enc:New task',
                user_id: 'user-1'
            }))
        })

        it('sets completed=true when gtdStatus is done', async () => {
            mockSupabase._queueResult([{ id: 'new-1', text: 'enc:Done task' }])

            await addTodo({ text: 'Done task', gtdStatus: 'done' })

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                completed: true,
                gtd_status: 'done'
            }))
        })

        it('defaults gtdStatus to inbox when not provided', async () => {
            mockSupabase._queueResult([{ id: 'new-1', text: 'enc:Task' }])

            await addTodo({ text: 'Task' })

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                gtd_status: 'inbox',
                completed: false
            }))
        })

        it('adds todo to store with decrypted text', async () => {
            mockSupabase._queueResult([{ id: 'new-1', text: 'enc:Task' }])

            const result = await addTodo({ text: 'Task' })

            expect(result.text).toBe('Task')
            const todos = store.get('todos')
            expect(todos.find(t => t.id === 'new-1').text).toBe('Task')
        })

        it('emits TODO_ADDED event', async () => {
            const handler = vi.fn()
            events.on(Events.TODO_ADDED, handler)
            mockSupabase._queueResult([{ id: 'new-1', text: 'enc:Task' }])

            await addTodo({ text: 'Task' })

            expect(handler).toHaveBeenCalledTimes(1)
            expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-1' }))
            events.off(Events.TODO_ADDED)
        })

        it('handles null optional fields', async () => {
            mockSupabase._queueResult([{ id: 'new-1', text: 'enc:Task' }])

            await addTodo({ text: 'Task' })

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                category_id: null,
                project_id: null,
                priority_id: null,
                context_id: null,
                due_date: null,
                comment: null
            }))
        })

        it('encrypts comment when provided', async () => {
            mockSupabase._queueResult([{ id: 'new-1', text: 'enc:Task' }])

            await addTodo({ text: 'Task', comment: 'My note' })

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                comment: 'enc:My note'
            }))
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'insert error' })

            await expect(addTodo({ text: 'Task' })).rejects.toEqual({ message: 'insert error' })
        })
    })

    // ─── batchAddTodos ────────────────────────────────────────────────────────

    describe('batchAddTodos', () => {
        it('inserts multiple todos at once', async () => {
            mockSupabase._queueResult([
                { id: 'b1', text: 'enc:First' },
                { id: 'b2', text: 'enc:Second' }
            ])

            const result = await batchAddTodos([
                { text: 'First' },
                { text: 'Second' }
            ])

            expect(result).toHaveLength(2)
            expect(mockSupabase.insert).toHaveBeenCalledTimes(1)
        })

        it('updates store once with all new todos', async () => {
            const setSpy = vi.spyOn(store, 'set')
            mockSupabase._queueResult([
                { id: 'b1', text: 'enc:First' },
                { id: 'b2', text: 'enc:Second' }
            ])

            await batchAddTodos([{ text: 'First' }, { text: 'Second' }])

            // store.set('todos', ...) should be called once for the batch
            const todoCalls = setSpy.mock.calls.filter(c => c[0] === 'todos')
            expect(todoCalls).toHaveLength(1)
            setSpy.mockRestore()
        })

        it('emits TODOS_LOADED event', async () => {
            const handler = vi.fn()
            events.on(Events.TODOS_LOADED, handler)
            mockSupabase._queueResult([{ id: 'b1', text: 'enc:First' }])

            await batchAddTodos([{ text: 'First' }])

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODOS_LOADED)
        })

        it('preserves original text in local state', async () => {
            mockSupabase._queueResult([
                { id: 'b1', text: 'enc:Original' }
            ])

            const result = await batchAddTodos([{ text: 'Original' }])

            expect(result[0].text).toBe('Original')
        })

        it('strips internal _originalText/_originalComment from Supabase insert', async () => {
            mockSupabase._queueResult([{ id: 'b1', text: 'enc:Task' }])

            await batchAddTodos([{ text: 'Task', comment: 'Note' }])

            const insertArg = mockSupabase.insert.mock.calls[0][0]
            expect(insertArg[0]).not.toHaveProperty('_originalText')
            expect(insertArg[0]).not.toHaveProperty('_originalComment')
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'batch error' })

            await expect(batchAddTodos([{ text: 'Task' }])).rejects.toEqual({ message: 'batch error' })
        })
    })

    // ─── updateTodo ───────────────────────────────────────────────────────────

    describe('updateTodo', () => {
        it('updates Supabase with encrypted text', async () => {
            mockSupabase._queueResult(null)

            await updateTodo('todo-1', { text: 'Updated', gtdStatus: 'inbox' })

            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
                text: 'enc:Updated'
            }))
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'todo-1')
        })

        it('updates local store by finding todo index', async () => {
            mockSupabase._queueResult(null)

            await updateTodo('todo-1', { text: 'Updated milk', gtdStatus: 'next' })

            const todos = store.get('todos')
            const updated = todos.find(t => t.id === 'todo-1')
            expect(updated.text).toBe('Updated milk')
            expect(updated.gtd_status).toBe('next')
        })

        it('emits TODO_UPDATED event', async () => {
            const handler = vi.fn()
            events.on(Events.TODO_UPDATED, handler)
            mockSupabase._queueResult(null)

            await updateTodo('todo-1', { text: 'Updated', gtdStatus: 'inbox' })

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODO_UPDATED)
        })

        it('sets completed=true when gtdStatus is done', async () => {
            mockSupabase._queueResult(null)

            await updateTodo('todo-1', { text: 'Done now', gtdStatus: 'done' })

            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
                completed: true,
                gtd_status: 'done'
            }))
            const todo = store.get('todos').find(t => t.id === 'todo-1')
            expect(todo.completed).toBe(true)
        })

        it('handles todo not found in local store gracefully', async () => {
            mockSupabase._queueResult(null)

            // Should not throw even if todo isn't in store
            await updateTodo('nonexistent', { text: 'Ghost', gtdStatus: 'inbox' })

            // Event should still emit (with undefined, but no crash)
            expect(mockSupabase.update).toHaveBeenCalled()
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'update error' })

            await expect(updateTodo('todo-1', { text: 'Fail', gtdStatus: 'inbox' }))
                .rejects.toEqual({ message: 'update error' })
        })

        it('encrypts comment when provided', async () => {
            mockSupabase._queueResult(null)

            await updateTodo('todo-1', { text: 'Task', gtdStatus: 'inbox', comment: 'My note' })

            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
                comment: 'enc:My note'
            }))
        })

        it('sets comment to null when not provided', async () => {
            mockSupabase._queueResult(null)

            await updateTodo('todo-1', { text: 'Task', gtdStatus: 'inbox' })

            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
                comment: null
            }))
        })
    })

    // ─── toggleTodo ───────────────────────────────────────────────────────────

    describe('toggleTodo', () => {
        it('toggles inbox todo to done', async () => {
            mockSupabase._queueResult(null)

            const result = await toggleTodo('todo-1')

            expect(result.completed).toBe(true)
            expect(result.gtd_status).toBe('done')
            expect(mockSupabase.update).toHaveBeenCalledWith({
                completed: true, gtd_status: 'done'
            })
        })

        it('toggles done todo back to inbox', async () => {
            mockSupabase._queueResult(null)

            const result = await toggleTodo('todo-2')

            expect(result.completed).toBe(false)
            expect(result.gtd_status).toBe('inbox')
        })

        it('updates local store', async () => {
            mockSupabase._queueResult(null)

            await toggleTodo('todo-1')

            const todo = store.get('todos').find(t => t.id === 'todo-1')
            expect(todo.completed).toBe(true)
            expect(todo.gtd_status).toBe('done')
        })

        it('emits TODO_UPDATED event', async () => {
            const handler = vi.fn()
            events.on(Events.TODO_UPDATED, handler)
            mockSupabase._queueResult(null)

            await toggleTodo('todo-1')

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODO_UPDATED)
        })

        it('pushes undo action with Completed label', async () => {
            mockSupabase._queueResult(null)

            await toggleTodo('todo-1')

            expect(pushUndo).toHaveBeenCalledTimes(1)
            expect(pushUndo.mock.calls[0][0]).toContain('Completed')
        })

        it('pushes undo action with Uncompleted label', async () => {
            mockSupabase._queueResult(null)

            await toggleTodo('todo-2')

            expect(pushUndo).toHaveBeenCalledTimes(1)
            expect(pushUndo.mock.calls[0][0]).toContain('Uncompleted')
        })

        it('calls generateNextRecurrence when completing a recurring instance', async () => {
            store.set('todos', [
                { id: 'rec-1', text: 'Recurring', completed: false, gtd_status: 'next', template_id: 'tmpl-1', due_date: '2026-03-15' }
            ])
            mockSupabase._queueResult(null)

            await toggleTodo('rec-1')

            expect(generateNextRecurrence).toHaveBeenCalledWith('tmpl-1', '2026-03-15')
        })

        it('does NOT call generateNextRecurrence when uncompleting', async () => {
            store.set('todos', [
                { id: 'rec-1', text: 'Recurring', completed: true, gtd_status: 'done', template_id: 'tmpl-1', due_date: '2026-03-15' }
            ])
            mockSupabase._queueResult(null)

            await toggleTodo('rec-1')

            expect(generateNextRecurrence).not.toHaveBeenCalled()
        })

        it('does NOT call generateNextRecurrence for non-recurring todos', async () => {
            mockSupabase._queueResult(null)

            await toggleTodo('todo-1')

            expect(generateNextRecurrence).not.toHaveBeenCalled()
        })

        it('throws when todo not found', async () => {
            await expect(toggleTodo('nonexistent')).rejects.toThrow('Todo not found')
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'toggle error' })

            await expect(toggleTodo('todo-1')).rejects.toEqual({ message: 'toggle error' })
        })
    })

    // ─── deleteTodo ───────────────────────────────────────────────────────────

    describe('deleteTodo', () => {
        it('deletes from Supabase', async () => {
            mockSupabase._queueResult(null)

            await deleteTodo('todo-1')

            expect(mockSupabase.delete).toHaveBeenCalled()
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'todo-1')
        })

        it('removes todo from store', async () => {
            mockSupabase._queueResult(null)

            await deleteTodo('todo-1')

            const todos = store.get('todos')
            expect(todos.find(t => t.id === 'todo-1')).toBeUndefined()
            expect(todos).toHaveLength(1)
        })

        it('emits TODO_DELETED with todoId', async () => {
            const handler = vi.fn()
            events.on(Events.TODO_DELETED, handler)
            mockSupabase._queueResult(null)

            await deleteTodo('todo-1')

            expect(handler).toHaveBeenCalledWith('todo-1')
            events.off(Events.TODO_DELETED)
        })

        it('pushes undo with restore callback', async () => {
            mockSupabase._queueResult(null)

            await deleteTodo('todo-1')

            expect(pushUndo).toHaveBeenCalledTimes(1)
            expect(pushUndo.mock.calls[0][0]).toContain('Deleted')
            expect(typeof pushUndo.mock.calls[0][1]).toBe('function')
        })

        it('undo callback restores deleted todo', async () => {
            mockSupabase._queueResult(null) // delete

            await deleteTodo('todo-1')

            const undoCallback = pushUndo.mock.calls[0][1]

            // Queue results for the restore (restoreTodo inserts + selects)
            mockSupabase._reset()
            mockSupabase._queueResult([{
                id: 'todo-1-restored', text: 'enc:Buy milk', user_id: 'user-1',
                completed: false, gtd_status: 'inbox', category_id: null,
                project_id: null, priority_id: null, context_id: null,
                due_date: null, comment: null
            }])

            await undoCallback()

            const todos = store.get('todos')
            expect(todos.some(t => t.id === 'todo-1-restored')).toBe(true)
        })

        it('does not push undo when todo not found in store', async () => {
            mockSupabase._queueResult(null)

            await deleteTodo('nonexistent')

            expect(pushUndo).not.toHaveBeenCalled()
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'delete error' })

            await expect(deleteTodo('todo-1')).rejects.toEqual({ message: 'delete error' })
        })
    })

    // ─── updateTodoCategory ───────────────────────────────────────────────────

    describe('updateTodoCategory', () => {
        it('updates category_id in Supabase', async () => {
            mockSupabase._queueResult(null)

            await updateTodoCategory('todo-1', 'cat-2')

            expect(mockSupabase.update).toHaveBeenCalledWith({ category_id: 'cat-2' })
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'todo-1')
        })

        it('updates local store', async () => {
            mockSupabase._queueResult(null)

            await updateTodoCategory('todo-1', 'cat-2')

            const todo = store.get('todos').find(t => t.id === 'todo-1')
            expect(todo.category_id).toBe('cat-2')
        })

        it('emits TODO_UPDATED event', async () => {
            const handler = vi.fn()
            events.on(Events.TODO_UPDATED, handler)
            mockSupabase._queueResult(null)

            await updateTodoCategory('todo-1', 'cat-2')

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODO_UPDATED)
        })

        it('logs warning when todo not found in store', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
            mockSupabase._queueResult(null)

            await updateTodoCategory('nonexistent', 'cat-2')

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'))
            warnSpy.mockRestore()
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'category error' })

            await expect(updateTodoCategory('todo-1', 'cat-2'))
                .rejects.toEqual({ message: 'category error' })
        })
    })

    // ─── updateTodoContext ────────────────────────────────────────────────────

    describe('updateTodoContext', () => {
        it('updates context_id in Supabase', async () => {
            mockSupabase._queueResult(null)

            await updateTodoContext('todo-1', 'ctx-1')

            expect(mockSupabase.update).toHaveBeenCalledWith({ context_id: 'ctx-1' })
        })

        it('updates local store', async () => {
            mockSupabase._queueResult(null)

            await updateTodoContext('todo-1', 'ctx-1')

            expect(store.get('todos').find(t => t.id === 'todo-1').context_id).toBe('ctx-1')
        })

        it('emits TODO_UPDATED event', async () => {
            const handler = vi.fn()
            events.on(Events.TODO_UPDATED, handler)
            mockSupabase._queueResult(null)

            await updateTodoContext('todo-1', 'ctx-1')

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODO_UPDATED)
        })

        it('logs warning when todo not found', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
            mockSupabase._queueResult(null)

            await updateTodoContext('ghost', 'ctx-1')

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ghost'))
            warnSpy.mockRestore()
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'context error' })

            await expect(updateTodoContext('todo-1', 'ctx-1'))
                .rejects.toEqual({ message: 'context error' })
        })
    })

    // ─── updateTodoGtdStatus ──────────────────────────────────────────────────

    describe('updateTodoGtdStatus', () => {
        it('updates gtd_status and completed in Supabase', async () => {
            mockSupabase._queueResult(null)

            await updateTodoGtdStatus('todo-1', 'next')

            expect(mockSupabase.update).toHaveBeenCalledWith({
                gtd_status: 'next', completed: false
            })
        })

        it('sets completed=true when status is done', async () => {
            mockSupabase._queueResult(null)

            await updateTodoGtdStatus('todo-1', 'done')

            expect(mockSupabase.update).toHaveBeenCalledWith({
                gtd_status: 'done', completed: true
            })
        })

        it('updates local store', async () => {
            mockSupabase._queueResult(null)

            await updateTodoGtdStatus('todo-1', 'waiting')

            const todo = store.get('todos').find(t => t.id === 'todo-1')
            expect(todo.gtd_status).toBe('waiting')
            expect(todo.completed).toBe(false)
        })

        it('emits TODO_UPDATED event', async () => {
            const handler = vi.fn()
            events.on(Events.TODO_UPDATED, handler)
            mockSupabase._queueResult(null)

            await updateTodoGtdStatus('todo-1', 'next')

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODO_UPDATED)
        })

        it('pushes undo when status changes', async () => {
            mockSupabase._queueResult(null)

            await updateTodoGtdStatus('todo-1', 'next')

            expect(pushUndo).toHaveBeenCalledTimes(1)
            expect(pushUndo.mock.calls[0][0]).toContain('next')
        })

        it('does NOT push undo when status is the same', async () => {
            mockSupabase._queueResult(null)

            await updateTodoGtdStatus('todo-1', 'inbox') // same as current

            expect(pushUndo).not.toHaveBeenCalled()
        })

        it('logs warning when todo not found', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
            mockSupabase._queueResult(null)

            await updateTodoGtdStatus('ghost', 'next')

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ghost'))
            warnSpy.mockRestore()
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'status error' })

            await expect(updateTodoGtdStatus('todo-1', 'next'))
                .rejects.toEqual({ message: 'status error' })
        })
    })

    // ─── updateTodoProject ────────────────────────────────────────────────────

    describe('updateTodoProject', () => {
        it('updates project_id in Supabase', async () => {
            mockSupabase._queueResult(null)

            await updateTodoProject('todo-1', 'proj-2')

            expect(mockSupabase.update).toHaveBeenCalledWith({ project_id: 'proj-2' })
        })

        it('updates local store', async () => {
            mockSupabase._queueResult(null)

            await updateTodoProject('todo-1', 'proj-2')

            expect(store.get('todos').find(t => t.id === 'todo-1').project_id).toBe('proj-2')
        })

        it('emits TODO_UPDATED event', async () => {
            const handler = vi.fn()
            events.on(Events.TODO_UPDATED, handler)
            mockSupabase._queueResult(null)

            await updateTodoProject('todo-1', 'proj-2')

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODO_UPDATED)
        })

        it('logs warning when todo not found', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
            mockSupabase._queueResult(null)

            await updateTodoProject('ghost', 'proj-2')

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ghost'))
            warnSpy.mockRestore()
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'project error' })

            await expect(updateTodoProject('todo-1', 'proj-2'))
                .rejects.toEqual({ message: 'project error' })
        })
    })
})
