import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'

/**
 * Load all todos for the current user
 * @returns {Promise<Array>} Array of decrypted todos
 */
export async function loadTodos() {
    const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error loading todos:', error)
        throw error
    }

    // Decrypt todo texts and comments
    const todos = await Promise.all(data.map(async (todo) => ({
        ...todo,
        text: await decrypt(todo.text),
        comment: todo.comment ? await decrypt(todo.comment) : null
    })))

    store.set('todos', todos)
    events.emit(Events.TODOS_LOADED, todos)
    return todos
}

/**
 * Add a new todo
 * @param {Object} todoData - Todo data
 * @returns {Promise<Object>} The created todo
 */
export async function addTodo(todoData) {
    const currentUser = store.get('currentUser')
    const { text, categoryId, projectId, priorityId, gtdStatus, contextId, dueDate, comment } = todoData

    // Encrypt todo text before storing
    const encryptedText = await encrypt(text)
    const encryptedComment = comment ? await encrypt(comment) : null

    // Sync completed with gtd_status (unified status)
    const isCompleted = gtdStatus === 'done'

    const { data, error } = await supabase
        .from('todos')
        .insert({
            user_id: currentUser.id,
            text: encryptedText,
            completed: isCompleted,
            category_id: categoryId || null,
            project_id: projectId || null,
            priority_id: priorityId || null,
            gtd_status: gtdStatus || 'inbox',
            context_id: contextId || null,
            due_date: dueDate || null,
            comment: encryptedComment
        })
        .select()

    if (error) {
        console.error('Error adding todo:', error)
        throw error
    }

    // Store decrypted text in local state for rendering
    const todo = { ...data[0], text, comment }
    const todos = [...store.get('todos'), todo]
    store.set('todos', todos)
    events.emit(Events.TODO_ADDED, todo)
    return todo
}

/**
 * Update an existing todo
 * @param {string} todoId - Todo ID
 * @param {Object} todoData - Todo data to update
 * @returns {Promise<Object>} The updated todo
 */
export async function updateTodo(todoId, todoData) {
    const { text, categoryId, projectId, priorityId, gtdStatus, contextId, dueDate, comment } = todoData

    // Encrypt todo text before storing
    const encryptedText = await encrypt(text)
    const encryptedComment = comment ? await encrypt(comment) : null

    // Sync completed with gtd_status (unified status)
    const isCompleted = gtdStatus === 'done'

    const { error } = await supabase
        .from('todos')
        .update({
            text: encryptedText,
            category_id: categoryId || null,
            project_id: projectId || null,
            priority_id: priorityId || null,
            gtd_status: gtdStatus || 'inbox',
            completed: isCompleted,
            context_id: contextId || null,
            due_date: dueDate || null,
            comment: encryptedComment
        })
        .eq('id', todoId)

    if (error) {
        console.error('Error updating todo:', error)
        throw error
    }

    // Update local state
    const todos = store.get('todos')
    const todoIndex = todos.findIndex(t => t.id === todoId)
    if (todoIndex !== -1) {
        todos[todoIndex] = {
            ...todos[todoIndex],
            text,
            category_id: categoryId || null,
            project_id: projectId || null,
            priority_id: priorityId || null,
            gtd_status: gtdStatus || 'inbox',
            completed: isCompleted,
            context_id: contextId || null,
            due_date: dueDate || null,
            comment: comment || null
        }
        store.set('todos', [...todos])
    }

    events.emit(Events.TODOS_UPDATED)
    return todos[todoIndex]
}

/**
 * Toggle todo completion status
 * @param {string} todoId - Todo ID
 * @returns {Promise<Object>} The updated todo
 */
export async function toggleTodo(todoId) {
    const todos = store.get('todos')
    const todo = todos.find(t => t.id === todoId)
    if (!todo) throw new Error('Todo not found')

    // Unify completed and gtd_status: checking marks as 'done', unchecking restores to 'inbox'
    const isDone = todo.gtd_status === 'done'
    const newGtdStatus = isDone ? 'inbox' : 'done'
    const newCompleted = !isDone

    const { error } = await supabase
        .from('todos')
        .update({ completed: newCompleted, gtd_status: newGtdStatus })
        .eq('id', todoId)

    if (error) {
        console.error('Error updating todo:', error)
        throw error
    }

    todo.completed = newCompleted
    todo.gtd_status = newGtdStatus
    store.set('todos', [...todos])
    events.emit(Events.TODOS_UPDATED)
    return todo
}

/**
 * Delete a todo
 * @param {string} todoId - Todo ID
 */
export async function deleteTodo(todoId) {
    const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todoId)

    if (error) {
        console.error('Error deleting todo:', error)
        throw error
    }

    const todos = store.get('todos').filter(t => t.id !== todoId)
    store.set('todos', todos)
    events.emit(Events.TODO_DELETED, todoId)
}

/**
 * Update todo category
 * @param {string} todoId - Todo ID
 * @param {string|null} categoryId - Category ID or null
 */
export async function updateTodoCategory(todoId, categoryId) {
    const { error } = await supabase
        .from('todos')
        .update({ category_id: categoryId })
        .eq('id', todoId)

    if (error) {
        console.error('Error updating todo category:', error)
        throw error
    }

    await loadTodos()
}

/**
 * Update todo context
 * @param {string} todoId - Todo ID
 * @param {string|null} contextId - Context ID or null
 */
export async function updateTodoContext(todoId, contextId) {
    const { error } = await supabase
        .from('todos')
        .update({ context_id: contextId })
        .eq('id', todoId)

    if (error) {
        console.error('Error updating todo context:', error)
        throw error
    }

    await loadTodos()
}

/**
 * Update todo GTD status
 * @param {string} todoId - Todo ID
 * @param {string} gtdStatus - GTD status
 */
export async function updateTodoGtdStatus(todoId, gtdStatus) {
    // Sync completed with gtd_status (unified status)
    const isCompleted = gtdStatus === 'done'

    const { error } = await supabase
        .from('todos')
        .update({ gtd_status: gtdStatus, completed: isCompleted })
        .eq('id', todoId)

    if (error) {
        console.error('Error updating todo GTD status:', error)
        throw error
    }

    await loadTodos()
}

/**
 * Update todo project
 * @param {string} todoId - Todo ID
 * @param {string|null} projectId - Project ID or null
 */
export async function updateTodoProject(todoId, projectId) {
    const { error } = await supabase
        .from('todos')
        .update({ project_id: projectId })
        .eq('id', todoId)

    if (error) {
        console.error('Error updating todo project:', error)
        throw error
    }

    await loadTodos()
}

/**
 * Get filtered todos based on current state
 * @returns {Array} Filtered and sorted todos
 */
export function getFilteredTodos() {
    const state = store.state
    let filtered = state.todos

    // Filter by search query (searches in title and comment/notes)
    if (state.searchQuery) {
        filtered = filtered.filter(t => {
            const title = (t.text || '').toLowerCase()
            const comment = (t.comment || '').toLowerCase()
            return title.includes(state.searchQuery) || comment.includes(state.searchQuery)
        })
    }

    // Filter by categories (if any selected)
    if (state.selectedCategoryIds.size > 0) {
        filtered = filtered.filter(t => {
            // 'uncategorized' matches todos with no category
            if (state.selectedCategoryIds.has('uncategorized') && !t.category_id) {
                return true
            }
            // Match any selected category
            return t.category_id && state.selectedCategoryIds.has(t.category_id)
        })
    }

    // Filter by contexts (if any selected)
    if (state.selectedContextIds.size > 0) {
        filtered = filtered.filter(t => t.context_id && state.selectedContextIds.has(t.context_id))
    }

    // Filter by project (if selected)
    if (state.selectedProjectId !== null) {
        filtered = filtered.filter(t => t.project_id === state.selectedProjectId)
    }

    // Filter by area (through project.area_id)
    // Inbox items are always shown regardless of area selection
    if (state.selectedAreaId !== 'all') {
        filtered = filtered.filter(t => {
            // Inbox items are always visible
            if (t.gtd_status === 'inbox') {
                return true
            }

            // Get the project's area
            const project = t.project_id ? state.projects.find(p => p.id === t.project_id) : null

            if (state.selectedAreaId === 'unassigned') {
                // Show items where the project has no area, or item has no project
                return !project || project.area_id === null
            } else {
                // Show items where the project belongs to the selected area
                return project && project.area_id === state.selectedAreaId
            }
        })
    }

    // Filter by GTD status
    if (state.selectedGtdStatus === 'scheduled') {
        // Show items with 'scheduled' GTD status, sorted by due date
        filtered = filtered.filter(t => t.gtd_status === 'scheduled')
        // Sort by due date (earliest first), items without dates go last
        return filtered.slice().sort((a, b) => {
            if (!a.due_date && !b.due_date) return 0
            if (!a.due_date) return 1
            if (!b.due_date) return -1
            return a.due_date.localeCompare(b.due_date)
        })
    } else if (state.selectedGtdStatus === 'done') {
        // Show only done items when Done tab is selected
        filtered = filtered.filter(t => t.gtd_status === 'done')
    } else if (state.selectedGtdStatus !== 'all') {
        // Show items matching the selected status (excludes done)
        filtered = filtered.filter(t => t.gtd_status === state.selectedGtdStatus)
    } else {
        // 'all' - exclude done items from the normal view
        filtered = filtered.filter(t => t.gtd_status !== 'done')
    }

    // Sort by priority level (lower level = higher priority)
    // Use slice() to avoid mutating the original array
    return filtered.slice().sort((a, b) => {
        const priorities = state.priorities
        const priorityA = a.priority_id ? priorities.find(p => p.id === a.priority_id) : null
        const priorityB = b.priority_id ? priorities.find(p => p.id === b.priority_id) : null

        if (!priorityA && !priorityB) return 0
        if (!priorityA) return 1
        if (!priorityB) return -1

        return priorityA.level - priorityB.level
    })
}

/**
 * Get todo count for a project (excluding done items)
 * @param {string} projectId - Project ID
 * @returns {number} Todo count
 */
export function getProjectTodoCount(projectId) {
    const todos = store.get('todos')
    return todos.filter(t => t.project_id === projectId && t.gtd_status !== 'done').length
}

/**
 * Get todo count for a GTD status
 * @param {string} status - GTD status
 * @returns {number} Todo count
 */
export function getGtdCount(status) {
    const todos = store.get('todos')
    if (status === 'all') {
        // Count all non-done items
        return todos.filter(t => t.gtd_status !== 'done').length
    }
    if (status === 'scheduled') {
        // Count all non-done items with a due date
        return todos.filter(t => t.due_date && t.gtd_status !== 'done').length
    }
    return todos.filter(t => t.gtd_status === status).length
}
