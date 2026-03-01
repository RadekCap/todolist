import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'

/**
 * Bulk delete multiple todos
 * @param {Array<string>} todoIds - Array of todo IDs to delete
 */
export async function bulkDeleteTodos(todoIds) {
    if (!todoIds || todoIds.length === 0) return

    const { error } = await supabase
        .from('todos')
        .delete()
        .in('id', todoIds)

    if (error) {
        console.error('Error bulk deleting todos:', error)
        throw error
    }

    const todos = store.get('todos').filter(t => !todoIds.includes(t.id))
    store.set('todos', todos)

    // Clear selection
    store.set('selectedTodoIds', new Set())
    store.set('lastSelectedTodoId', null)

    events.emit(Events.TODOS_UPDATED, todos)
}

/**
 * Bulk update GTD status for multiple todos
 * @param {Array<string>} todoIds - Array of todo IDs
 * @param {string} gtdStatus - New GTD status
 */
export async function bulkUpdateTodosStatus(todoIds, gtdStatus) {
    if (!todoIds || todoIds.length === 0) return

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
    const todos = store.get('todos').map(t => {
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
}

/**
 * Bulk update project for multiple todos
 * @param {Array<string>} todoIds - Array of todo IDs
 * @param {string|null} projectId - New project ID or null
 */
export async function bulkUpdateTodosProject(todoIds, projectId) {
    if (!todoIds || todoIds.length === 0) return

    const { error } = await supabase
        .from('todos')
        .update({ project_id: projectId || null })
        .in('id', todoIds)

    if (error) {
        console.error('Error bulk updating todo project:', error)
        throw error
    }

    // Update local state
    const todos = store.get('todos').map(t => {
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
}

/**
 * Bulk update priority for multiple todos
 * @param {Array<string>} todoIds - Array of todo IDs
 * @param {string|null} priorityId - New priority ID or null
 */
export async function bulkUpdateTodosPriority(todoIds, priorityId) {
    if (!todoIds || todoIds.length === 0) return

    const { error } = await supabase
        .from('todos')
        .update({ priority_id: priorityId || null })
        .in('id', todoIds)

    if (error) {
        console.error('Error bulk updating todo priority:', error)
        throw error
    }

    // Update local state
    const todos = store.get('todos').map(t => {
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
}
