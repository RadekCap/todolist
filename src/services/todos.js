import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'
import { calculateNextOccurrence, isRecurrenceEnded } from '../utils/recurrence.js'

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

    // Filter out template todos (they're not shown in the list)
    const visibleTodos = data.filter(todo => !todo.is_template)

    // Store templates separately for recurrence generation
    const templates = data.filter(todo => todo.is_template)
    store.set('templates', templates)

    // Decrypt todo texts and comments
    const todos = await Promise.all(visibleTodos.map(async (todo) => ({
        ...todo,
        text: await decrypt(todo.text),
        comment: todo.comment ? await decrypt(todo.comment) : null
    })))

    store.set('todos', todos)
    events.emit(Events.TODOS_LOADED, todos)

    // Check for any pending recurrences that need catch-up
    await checkPendingRecurrences()

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
 * Add multiple todos at once (batch import)
 * Only updates the store once after all todos are inserted
 * @param {Array<Object>} todosData - Array of todo data objects
 * @returns {Promise<Array>} The created todos
 */
export async function batchAddTodos(todosData) {
    const currentUser = store.get('currentUser')

    // Prepare all todos for insertion
    const insertData = await Promise.all(todosData.map(async (todoData) => {
        const { text, categoryId, projectId, priorityId, gtdStatus, contextId, dueDate, comment } = todoData
        const encryptedText = await encrypt(text)
        const encryptedComment = comment ? await encrypt(comment) : null
        const isCompleted = gtdStatus === 'done'

        return {
            user_id: currentUser.id,
            text: encryptedText,
            completed: isCompleted,
            category_id: categoryId || null,
            project_id: projectId || null,
            priority_id: priorityId || null,
            gtd_status: gtdStatus || 'inbox',
            context_id: contextId || null,
            due_date: dueDate || null,
            comment: encryptedComment,
            // Store original text for later use
            _originalText: text,
            _originalComment: comment
        }
    }))

    // Insert all at once
    const { data, error } = await supabase
        .from('todos')
        .insert(insertData.map(({ _originalText, _originalComment, ...rest }) => rest))
        .select()

    if (error) {
        console.error('Error batch adding todos:', error)
        throw error
    }

    // Create todos with decrypted text for local state
    const newTodos = data.map((dbTodo, index) => ({
        ...dbTodo,
        text: insertData[index]._originalText,
        comment: insertData[index]._originalComment
    }))

    // Update store only once
    const todos = [...store.get('todos'), ...newTodos]
    store.set('todos', todos)
    events.emit(Events.TODOS_LOADED, todos)

    return newTodos
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

    // If completing a recurring instance, generate the next occurrence
    if (newCompleted && todo.template_id) {
        await generateNextRecurrence(todo.template_id, todo.due_date)
    }

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

    events.emit(Events.TODOS_UPDATED)
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

    events.emit(Events.TODOS_UPDATED)
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

    events.emit(Events.TODOS_UPDATED)
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

    events.emit(Events.TODOS_UPDATED)
}

/**
 * Toggle selection of a single todo
 * @param {string} todoId - Todo ID to toggle
 */
export function toggleTodoSelection(todoId) {
    const selectedIds = new Set(store.get('selectedTodoIds'))
    if (selectedIds.has(todoId)) {
        selectedIds.delete(todoId)
    } else {
        selectedIds.add(todoId)
    }
    store.set('selectedTodoIds', selectedIds)
    store.set('lastSelectedTodoId', todoId)
}

/**
 * Select a range of todos (for shift-click)
 * @param {string} todoId - End of range todo ID
 * @param {Array<string>} visibleTodoIds - Array of currently visible todo IDs in order
 */
export function selectTodoRange(todoId, visibleTodoIds) {
    const lastSelectedId = store.get('lastSelectedTodoId')
    if (!lastSelectedId) {
        // No previous selection, just select this one
        const selectedIds = new Set([todoId])
        store.set('selectedTodoIds', selectedIds)
        store.set('lastSelectedTodoId', todoId)
        return
    }

    const startIndex = visibleTodoIds.indexOf(lastSelectedId)
    const endIndex = visibleTodoIds.indexOf(todoId)

    if (startIndex === -1 || endIndex === -1) {
        // One of the items not found, just select the clicked one
        const selectedIds = new Set([todoId])
        store.set('selectedTodoIds', selectedIds)
        store.set('lastSelectedTodoId', todoId)
        return
    }

    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    const idsToSelect = visibleTodoIds.slice(from, to + 1)

    const selectedIds = new Set(store.get('selectedTodoIds'))
    idsToSelect.forEach(id => selectedIds.add(id))
    store.set('selectedTodoIds', selectedIds)
}

/**
 * Select all visible todos
 * @param {Array<string>} visibleTodoIds - Array of currently visible todo IDs
 */
export function selectAllTodos(visibleTodoIds) {
    const selectedIds = new Set(visibleTodoIds)
    store.set('selectedTodoIds', selectedIds)
    if (visibleTodoIds.length > 0) {
        store.set('lastSelectedTodoId', visibleTodoIds[visibleTodoIds.length - 1])
    }
}

/**
 * Clear all todo selections
 */
export function clearTodoSelection() {
    store.set('selectedTodoIds', new Set())
    store.set('lastSelectedTodoId', null)
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
    // Inbox items and items without a project are always shown regardless of area selection
    if (state.selectedAreaId !== 'all') {
        filtered = filtered.filter(t => {
            // Inbox items are always visible
            if (t.gtd_status === 'inbox') {
                return true
            }

            // Todos without a project are always visible (they're unassigned to any area)
            if (!t.project_id) {
                return true
            }

            // Get the project's area
            const project = state.projects.find(p => p.id === t.project_id)

            if (state.selectedAreaId === 'unassigned') {
                // Show items where the project has no area
                return !project || project.area_id === null
            } else {
                // Show items where the project belongs to the selected area
                return project && project.area_id === state.selectedAreaId
            }
        })
    }

    // Filter by GTD status
    if (state.selectedGtdStatus === 'scheduled') {
        // Show all items with a due date (excluding done) - this is a virtual/computed view
        filtered = filtered.filter(t => t.due_date && t.gtd_status !== 'done')
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
        // Count all items with a due date (excluding done) - matches getFilteredTodos display logic
        return todos.filter(t => t.due_date && t.gtd_status !== 'done').length
    }
    return todos.filter(t => t.gtd_status === status).length
}

// ============================================
// Recurring Todos Functions
// ============================================

/**
 * Create a recurring todo with a template and first instance
 * @param {Object} todoData - Todo data (text, categoryId, etc.)
 * @param {Object} recurrenceRule - Recurrence rule object
 * @param {Object} endCondition - End condition { type, date?, count? }
 * @returns {Promise<Object>} The created instance todo
 */
export async function createRecurringTodo(todoData, recurrenceRule, endCondition) {
    const currentUser = store.get('currentUser')
    const { text, categoryId, projectId, priorityId, gtdStatus, contextId, dueDate, comment } = todoData

    // Encrypt text and comment
    const encryptedText = await encrypt(text)
    const encryptedComment = comment ? await encrypt(comment) : null

    // Create the template first
    const { data: templateData, error: templateError } = await supabase
        .from('todos')
        .insert({
            user_id: currentUser.id,
            text: encryptedText,
            completed: false,
            category_id: categoryId || null,
            project_id: projectId || null,
            priority_id: priorityId || null,
            gtd_status: 'scheduled', // Templates are always scheduled
            context_id: contextId || null,
            due_date: dueDate || null,
            comment: encryptedComment,
            is_template: true,
            recurrence_rule: recurrenceRule,
            recurrence_end_type: endCondition.type || 'never',
            recurrence_end_date: endCondition.date || null,
            recurrence_end_count: endCondition.count || null,
            recurrence_count: 0
        })
        .select()

    if (templateError) {
        console.error('Error creating recurring template:', templateError)
        throw templateError
    }

    const template = templateData[0]

    // Create the first instance
    const { data: instanceData, error: instanceError } = await supabase
        .from('todos')
        .insert({
            user_id: currentUser.id,
            text: encryptedText,
            completed: false,
            category_id: categoryId || null,
            project_id: projectId || null,
            priority_id: priorityId || null,
            gtd_status: gtdStatus || 'scheduled',
            context_id: contextId || null,
            due_date: dueDate || null,
            comment: encryptedComment,
            is_template: false,
            template_id: template.id
        })
        .select()

    if (instanceError) {
        console.error('Error creating recurring instance:', instanceError)
        throw instanceError
    }

    // Update template recurrence count
    await supabase
        .from('todos')
        .update({ recurrence_count: 1 })
        .eq('id', template.id)

    // Add instance to local state
    const instance = { ...instanceData[0], text, comment }
    const todos = [...store.get('todos'), instance]
    store.set('todos', todos)

    // Update templates in store
    const templates = store.get('templates') || []
    templates.push({ ...template, recurrence_count: 1 })
    store.set('templates', templates)

    events.emit(Events.TODO_ADDED, instance)
    return instance
}

/**
 * Generate the next recurrence instance for a template
 * @param {string} templateId - Template todo ID
 * @param {string} fromDate - Date to calculate from (YYYY-MM-DD)
 * @returns {Promise<Object|null>} The created instance or null if ended
 */
export async function generateNextRecurrence(templateId, fromDate) {
    // Get template from store or fetch from DB
    let templates = store.get('templates') || []
    // Use string comparison to handle potential type mismatches (bigint vs string)
    let template = templates.find(t => String(t.id) === String(templateId))

    if (!template) {
        // Fetch from DB if not in store
        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('id', templateId)
            .single()

        if (error || !data) {
            console.error('Template not found:', templateId)
            return null
        }
        template = data
    }

    // Check if recurrence has ended
    if (isRecurrenceEnded(template)) {
        console.log('Recurrence ended for template:', templateId)
        return null
    }

    // Calculate next due date
    const rule = template.recurrence_rule
    if (!rule) {
        console.error('No recurrence rule on template:', templateId)
        return null
    }

    const nextDueDate = calculateNextOccurrence(rule, fromDate)
    if (!nextDueDate) {
        console.error('Could not calculate next occurrence:', rule, fromDate)
        return null
    }

    // Check if next date exceeds end date
    if (template.recurrence_end_type === 'on_date' && template.recurrence_end_date) {
        if (nextDueDate > template.recurrence_end_date) {
            console.log('Next occurrence exceeds end date')
            return null
        }
    }

    // Check if count limit reached
    const newCount = (template.recurrence_count || 0) + 1
    if (template.recurrence_end_type === 'after_count' && template.recurrence_end_count) {
        if (newCount > template.recurrence_end_count) {
            console.log('Recurrence count limit reached')
            return null
        }
    }

    const currentUser = store.get('currentUser')

    // Create new instance
    const { data: instanceData, error: instanceError } = await supabase
        .from('todos')
        .insert({
            user_id: currentUser.id,
            text: template.text, // Already encrypted
            completed: false,
            category_id: template.category_id,
            project_id: template.project_id,
            priority_id: template.priority_id,
            gtd_status: 'scheduled',
            context_id: template.context_id,
            due_date: nextDueDate,
            comment: template.comment,
            is_template: false,
            template_id: template.id
        })
        .select()

    if (instanceError) {
        console.error('Error creating next recurrence:', instanceError)
        throw instanceError
    }

    // Update template recurrence count
    await supabase
        .from('todos')
        .update({ recurrence_count: newCount })
        .eq('id', template.id)

    // Update template in store
    template.recurrence_count = newCount
    templates = templates.map(t => String(t.id) === String(templateId) ? template : t)
    store.set('templates', templates)

    // Decrypt and add instance to local state
    const instance = {
        ...instanceData[0],
        text: await decrypt(instanceData[0].text),
        comment: instanceData[0].comment ? await decrypt(instanceData[0].comment) : null
    }
    const todos = [...store.get('todos'), instance]
    store.set('todos', todos)

    events.emit(Events.TODO_ADDED, instance)
    return instance
}

/**
 * Check for pending recurrences that need catch-up generation
 * Called on app load to handle cases where user was offline
 */
export async function checkPendingRecurrences() {
    const templates = store.get('templates') || []
    const todos = store.get('todos') || []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const template of templates) {
        if (!template.recurrence_rule) continue
        if (isRecurrenceEnded(template)) continue

        // Find the latest instance for this template
        const instances = todos.filter(t => String(t.template_id) === String(template.id))
        if (instances.length === 0) continue

        // Get the most recent instance's due date
        const latestInstance = instances.reduce((latest, instance) => {
            if (!latest) return instance
            if (!instance.due_date) return latest
            if (!latest.due_date) return instance
            return instance.due_date > latest.due_date ? instance : latest
        }, null)

        if (!latestInstance || !latestInstance.due_date) continue

        // Check if latest instance is past due and completed
        const latestDate = new Date(latestInstance.due_date)
        latestDate.setHours(0, 0, 0, 0)

        // Only generate catch-up if the latest instance is completed and past due
        if (latestInstance.completed && latestDate < today) {
            console.log('Generating catch-up recurrence for:', template.id)
            await generateNextRecurrence(template.id, latestInstance.due_date)
        }
    }
}

/**
 * Stop a recurring series (no more instances will be generated)
 * @param {string} templateId - Template todo ID
 */
export async function stopRecurrence(templateId) {
    // Set end condition to "after_count" with current count
    const templates = store.get('templates') || []
    const template = templates.find(t => String(t.id) === String(templateId))

    if (!template) {
        console.error('Template not found:', templateId)
        return
    }

    const { error } = await supabase
        .from('todos')
        .update({
            recurrence_end_type: 'after_count',
            recurrence_end_count: template.recurrence_count || 0
        })
        .eq('id', templateId)

    if (error) {
        console.error('Error stopping recurrence:', error)
        throw error
    }

    // Update local state
    template.recurrence_end_type = 'after_count'
    template.recurrence_end_count = template.recurrence_count || 0
    store.set('templates', [...templates])
}

/**
 * Delete an entire recurring series (template + all instances)
 * @param {string} templateId - Template todo ID
 */
export async function deleteRecurringSeries(templateId) {
    // Delete all instances first
    const { error: instancesError } = await supabase
        .from('todos')
        .delete()
        .eq('template_id', templateId)

    if (instancesError) {
        console.error('Error deleting recurring instances:', instancesError)
        throw instancesError
    }

    // Delete the template
    const { error: templateError } = await supabase
        .from('todos')
        .delete()
        .eq('id', templateId)

    if (templateError) {
        console.error('Error deleting recurring template:', templateError)
        throw templateError
    }

    // Update local state
    const todos = store.get('todos').filter(t => String(t.template_id) !== String(templateId))
    store.set('todos', todos)

    const templates = (store.get('templates') || []).filter(t => String(t.id) !== String(templateId))
    store.set('templates', templates)

    events.emit(Events.TODOS_LOADED, todos)
}

/**
 * Get template for a recurring todo instance
 * @param {string} templateId - Template todo ID
 * @returns {Object|null} Template todo or null
 */
export function getTemplateById(templateId) {
    const templates = store.get('templates') || []
    return templates.find(t => String(t.id) === String(templateId)) || null
}

/**
 * Update the recurrence rule for a template
 * @param {string} templateId - Template todo ID
 * @param {Object} recurrenceRule - New recurrence rule object
 * @param {Object} endCondition - End condition { type, date?, count? }
 * @returns {Promise<Object>} Updated template
 */
export async function updateTemplateRecurrence(templateId, recurrenceRule, endCondition) {
    const updateData = {
        recurrence_rule: recurrenceRule
    }

    // Set end condition
    if (endCondition) {
        updateData.recurrence_end_type = endCondition.type || 'never'
        updateData.recurrence_end_date = endCondition.type === 'on_date' ? endCondition.date : null
        updateData.recurrence_end_count = endCondition.type === 'after_count' ? endCondition.count : null
    }

    const { data, error } = await supabase
        .from('todos')
        .update(updateData)
        .eq('id', templateId)
        .select()
        .single()

    if (error) {
        console.error('Error updating template recurrence:', error)
        throw error
    }

    // Update local templates state
    const templates = store.get('templates') || []
    const updatedTemplates = templates.map(t =>
        String(t.id) === String(templateId) ? { ...t, ...updateData } : t
    )
    store.set('templates', updatedTemplates)

    return data
}

/**
 * Convert an existing todo to a recurring todo
 * Creates a template and links the existing todo as the first instance
 * @param {string} todoId - Existing todo ID
 * @param {Object} todoData - Updated todo data
 * @param {Object} recurrenceRule - Recurrence rule object
 * @param {Object} endCondition - End condition { type, date?, count? }
 * @returns {Promise<Object>} The updated todo (now linked to template)
 */
export async function convertToRecurring(todoId, todoData, recurrenceRule, endCondition) {
    const currentUser = store.get('currentUser')
    const { text, categoryId, projectId, priorityId, gtdStatus, contextId, dueDate, comment } = todoData

    // Encrypt text and comment for the template
    const encryptedText = await encrypt(text)
    const encryptedComment = comment ? await encrypt(comment) : null

    // Create the template
    const { data: templateData, error: templateError } = await supabase
        .from('todos')
        .insert({
            user_id: currentUser.id,
            text: encryptedText,
            completed: false,
            category_id: categoryId || null,
            project_id: projectId || null,
            priority_id: priorityId || null,
            gtd_status: 'scheduled',
            context_id: contextId || null,
            due_date: dueDate || null,
            comment: encryptedComment,
            is_template: true,
            recurrence_rule: recurrenceRule,
            recurrence_end_type: endCondition.type || 'never',
            recurrence_end_date: endCondition.date || null,
            recurrence_end_count: endCondition.count || null,
            recurrence_count: 1 // This existing todo counts as instance 1
        })
        .select()

    if (templateError) {
        console.error('Error creating recurring template:', templateError)
        throw templateError
    }

    const template = templateData[0]

    // Update the existing todo to link to the template and update its data
    const { data: updatedData, error: updateError } = await supabase
        .from('todos')
        .update({
            text: encryptedText,
            category_id: categoryId || null,
            project_id: projectId || null,
            priority_id: priorityId || null,
            gtd_status: gtdStatus || 'scheduled',
            context_id: contextId || null,
            due_date: dueDate || null,
            comment: encryptedComment,
            template_id: template.id
        })
        .eq('id', todoId)
        .select()

    if (updateError) {
        console.error('Error updating todo with template link:', updateError)
        throw updateError
    }

    // Update local state
    const todos = store.get('todos')
    const todoIndex = todos.findIndex(t => String(t.id) === String(todoId))
    if (todoIndex !== -1) {
        todos[todoIndex] = {
            ...todos[todoIndex],
            ...updatedData[0],
            text, // Use decrypted text
            comment,
            template_id: template.id
        }
        store.set('todos', [...todos])
    }

    // Add template to store
    const templates = store.get('templates') || []
    templates.push(template)
    store.set('templates', templates)

    events.emit(Events.TODOS_UPDATED)
    return todos[todoIndex]
}
