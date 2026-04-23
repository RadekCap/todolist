import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'
import { pushUndo } from './undo.js'

/**
 * Bulk delete multiple todos
 * @param {Array<string>} todoIds - Array of todo IDs to delete
 */
export async function bulkDeleteTodos(todoIds) {
    if (!todoIds || todoIds.length === 0) return

    // Capture todos before deletion for undo
    const allTodos = store.get('todos')
    const deletedTodos = allTodos.filter(t => todoIds.includes(t.id))

    const { error } = await supabase
        .from('todos')
        .delete()
        .in('id', todoIds)

    if (error) {
        console.error('Error bulk deleting todos:', error)
        throw error
    }

    const todos = allTodos.filter(t => !todoIds.includes(t.id))
    store.set('todos', todos)

    // Clear selection
    store.set('selectedTodoIds', new Set())
    store.set('lastSelectedTodoId', null)

    events.emit(Events.TODOS_UPDATED, todos)

    // Push undo action
    if (deletedTodos.length > 0) {
        pushUndo(`Deleted ${deletedTodos.length} item(s)`, async () => {
            await bulkRestoreTodos(deletedTodos)
        })
    }
}

/**
 * Bulk update GTD status for multiple todos
 * @param {Array<string>} todoIds - Array of todo IDs
 * @param {string} gtdStatus - New GTD status
 */
export async function bulkUpdateTodosStatus(todoIds, gtdStatus) {
    if (!todoIds || todoIds.length === 0) return

    // Capture previous states for undo
    const allTodos = store.get('todos')
    const previousStates = todoIds.map(id => {
        const todo = allTodos.find(t => t.id === id)
        return { id, gtd_status: todo?.gtd_status, completed: todo?.completed }
    }).filter(s => s.gtd_status !== undefined)

    const isCompleted = gtdStatus === 'done'

    const { error } = await supabase
        .from('todos')
        .update({ gtd_status: gtdStatus, completed: isCompleted })
        .in('id', todoIds)

    if (error) {
        console.error('Error bulk updating todo status:', error)
        throw error
    }

    // Update local state
    const todos = allTodos.map(t => {
        if (todoIds.includes(t.id)) {
            return { ...t, gtd_status: gtdStatus, completed: isCompleted }
        }
        return t
    })
    store.set('todos', todos)

    // Clear selection
    store.set('selectedTodoIds', new Set())
    store.set('lastSelectedTodoId', null)

    events.emit(Events.TODOS_UPDATED, todos)

    // Push undo action
    if (previousStates.length > 0) {
        pushUndo(`Moved ${previousStates.length} item(s) to ${gtdStatus}`, async () => {
            await bulkRestorePreviousStates(previousStates, ['gtd_status', 'completed'])
        })
    }
}

/**
 * Bulk update project for multiple todos
 * @param {Array<string>} todoIds - Array of todo IDs
 * @param {string|null} projectId - New project ID or null
 */
export async function bulkUpdateTodosProject(todoIds, projectId) {
    if (!todoIds || todoIds.length === 0) return

    // Capture previous states for undo
    const allTodos = store.get('todos')
    const previousStates = todoIds.map(id => {
        const todo = allTodos.find(t => t.id === id)
        return { id, project_id: todo?.project_id }
    }).filter(s => s.project_id !== undefined)

    const { error } = await supabase
        .from('todos')
        .update({ project_id: projectId || null })
        .in('id', todoIds)

    if (error) {
        console.error('Error bulk updating todo project:', error)
        throw error
    }

    // Update local state
    const todos = allTodos.map(t => {
        if (todoIds.includes(t.id)) {
            return { ...t, project_id: projectId || null }
        }
        return t
    })
    store.set('todos', todos)

    // Clear selection
    store.set('selectedTodoIds', new Set())
    store.set('lastSelectedTodoId', null)

    events.emit(Events.TODOS_UPDATED, todos)

    // Push undo action
    if (previousStates.length > 0) {
        pushUndo(`Changed project for ${previousStates.length} item(s)`, async () => {
            await bulkRestorePreviousStates(previousStates, ['project_id'])
        })
    }
}

/**
 * Bulk update priority for multiple todos
 * @param {Array<string>} todoIds - Array of todo IDs
 * @param {string|null} priorityId - New priority ID or null
 */
export async function bulkUpdateTodosPriority(todoIds, priorityId) {
    if (!todoIds || todoIds.length === 0) return

    // Capture previous states for undo
    const allTodos = store.get('todos')
    const previousStates = todoIds.map(id => {
        const todo = allTodos.find(t => t.id === id)
        return { id, priority_id: todo?.priority_id }
    }).filter(s => s.priority_id !== undefined)

    const { error } = await supabase
        .from('todos')
        .update({ priority_id: priorityId || null })
        .in('id', todoIds)

    if (error) {
        console.error('Error bulk updating todo priority:', error)
        throw error
    }

    // Update local state
    const todos = allTodos.map(t => {
        if (todoIds.includes(t.id)) {
            return { ...t, priority_id: priorityId || null }
        }
        return t
    })
    store.set('todos', todos)

    // Clear selection
    store.set('selectedTodoIds', new Set())
    store.set('lastSelectedTodoId', null)

    events.emit(Events.TODOS_UPDATED, todos)

    // Push undo action
    if (previousStates.length > 0) {
        pushUndo(`Changed priority for ${previousStates.length} item(s)`, async () => {
            await bulkRestorePreviousStates(previousStates, ['priority_id'])
        })
    }
}

/**
 * Restore multiple previously deleted todos
 * @param {Array<Object>} todos - Array of todo data to restore
 */
async function bulkRestoreTodos(todos) {
    const insertData = await Promise.all(todos.map(async (todo) => ({
        user_id: todo.user_id,
        text: await encrypt(todo.text),
        completed: todo.completed,
        category_id: todo.category_id || null,
        project_id: todo.project_id || null,
        priority_id: todo.priority_id || null,
        gtd_status: todo.gtd_status || 'inbox',
        context_id: todo.context_id || null,
        due_date: todo.due_date || null,
        comment: todo.comment ? await encrypt(todo.comment) : null,
        _originalText: todo.text,
        _originalComment: todo.comment
    })))

    const { data, error } = await supabase
        .from('todos')
        .insert(insertData.map(({ _originalText, _originalComment, ...rest }) => rest))
        .select()

    if (error) {
        console.error('Error restoring todos:', error)
        throw error
    }

    const restoredTodos = data.map((dbTodo, index) => ({
        ...dbTodo,
        text: insertData[index]._originalText,
        comment: insertData[index]._originalComment
    }))

    const currentTodos = [...store.get('todos'), ...restoredTodos]
    store.set('todos', currentTodos)
    events.emit(Events.TODOS_UPDATED, currentTodos)
}

/**
 * Restore previous field values for multiple todos
 * @param {Array<Object>} previousStates - Array of { id, ...fields }
 * @param {Array<string>} fields - Field names to restore
 */
async function bulkRestorePreviousStates(previousStates, fields) {
    // Update each todo individually (different previous values)
    for (const prev of previousStates) {
        const updateData = {}
        for (const field of fields) {
            if (prev[field] !== undefined) {
                updateData[field] = prev[field]
            }
        }

        const { error } = await supabase
            .from('todos')
            .update(updateData)
            .eq('id', prev.id)

        if (error) {
            console.error('Error restoring previous todo state:', error)
            throw error
        }
    }

    // Update local state
    const todos = store.get('todos').map(t => {
        const prev = previousStates.find(p => p.id === t.id)
        if (prev) {
            const restored = { ...t }
            for (const field of fields) {
                if (prev[field] !== undefined) {
                    restored[field] = prev[field]
                }
            }
            return restored
        }
        return t
    })
    store.set('todos', todos)
    events.emit(Events.TODOS_UPDATED, todos)
}
