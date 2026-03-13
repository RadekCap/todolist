import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'
import { checkPendingRecurrences, generateNextRecurrence } from './todos-recurrence.js'
import { pushUndo } from './undo.js'

// Re-export all sub-modules so existing imports continue to work
export * from './todos-filters.js'
export * from './todos-selection.js'
export * from './todos-bulk.js'
export * from './todos-recurrence.js'

/**
 * Load all todos for the current user.
 * Uses pagination to fetch beyond PostgREST's server-side row limit.
 * @returns {Promise<Array>} Array of decrypted todos
 */
export async function loadTodos() {
    const PAGE_SIZE = 1000
    let allData = []
    let from = 0

    while (true) {
        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .order('created_at', { ascending: true })
            .range(from, from + PAGE_SIZE - 1)

        if (error) {
            console.error('Error loading todos:', error)
            throw error
        }

        allData = allData.concat(data)
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
    }

    const data = allData

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

    events.emit(Events.TODO_UPDATED, todos[todoIndex])
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
    events.emit(Events.TODO_UPDATED, todo)

    // Push undo action
    const actionLabel = newCompleted ? 'Completed' : 'Uncompleted'
    pushUndo(`${actionLabel} "${truncate(todo.text)}"`, async () => {
        await toggleTodo(todoId)
    })

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
    // Capture todo data before deletion for undo
    const deletedTodo = store.get('todos').find(t => t.id === todoId)

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

    // Push undo action
    if (deletedTodo) {
        const todoText = deletedTodo.text
        pushUndo(`Deleted "${truncate(todoText)}"`, async () => {
            await restoreTodo(deletedTodo)
        })
    }
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

    const todos = store.get('todos')
    const todo = todos.find(t => t.id === todoId)
    if (todo) {
        todo.category_id = categoryId
        store.set('todos', [...todos])
        events.emit(Events.TODO_UPDATED, todo)
    } else {
        console.warn(`updateTodoCategory: todo ${todoId} not found in local store`)
    }
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

    const todos = store.get('todos')
    const todo = todos.find(t => t.id === todoId)
    if (todo) {
        todo.context_id = contextId
        store.set('todos', [...todos])
        events.emit(Events.TODO_UPDATED, todo)
    } else {
        console.warn(`updateTodoContext: todo ${todoId} not found in local store`)
    }
}

/**
 * Update todo GTD status
 * @param {string} todoId - Todo ID
 * @param {string} gtdStatus - GTD status
 */
export async function updateTodoGtdStatus(todoId, gtdStatus) {
    // Capture previous state for undo
    const todos = store.get('todos')
    const todo = todos.find(t => t.id === todoId)
    const previousGtdStatus = todo ? todo.gtd_status : null

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

    if (todo) {
        todo.gtd_status = gtdStatus
        todo.completed = isCompleted
        store.set('todos', [...todos])
        events.emit(Events.TODO_UPDATED, todo)

        if (previousGtdStatus && previousGtdStatus !== gtdStatus) {
            pushUndo(`Moved "${truncate(todo.text)}" to ${gtdStatus}`, async () => {
                await updateTodoGtdStatus(todoId, previousGtdStatus)
            })
        }
    } else {
        console.warn(`updateTodoGtdStatus: todo ${todoId} not found in local store`)
    }
}

/**
 * Update todo project
 * @param {string} todoId - Todo ID
 * @param {string|null} projectId - Project ID or null
 */
/**
 * Truncate a string for display in undo messages
 * @param {string} str - String to truncate
 * @param {number} maxLen - Max length
 * @returns {string}
 */
function truncate(str, maxLen = 30) {
    if (!str) return ''
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

/**
 * Restore a previously deleted todo by re-inserting it
 * @param {Object} todo - The todo data to restore (with decrypted text)
 */
async function restoreTodo(todo) {
    const encryptedText = await encrypt(todo.text)
    const encryptedComment = todo.comment ? await encrypt(todo.comment) : null

    const { data, error } = await supabase
        .from('todos')
        .insert({
            user_id: todo.user_id,
            text: encryptedText,
            completed: todo.completed,
            category_id: todo.category_id || null,
            project_id: todo.project_id || null,
            priority_id: todo.priority_id || null,
            gtd_status: todo.gtd_status || 'inbox',
            context_id: todo.context_id || null,
            due_date: todo.due_date || null,
            comment: encryptedComment
        })
        .select()

    if (error) {
        console.error('Error restoring todo:', error)
        throw error
    }

    const restoredTodo = { ...data[0], text: todo.text, comment: todo.comment }
    const todos = [...store.get('todos'), restoredTodo]
    store.set('todos', todos)
    events.emit(Events.TODO_ADDED, restoredTodo)
}

export async function updateTodoProject(todoId, projectId) {
    const { error } = await supabase
        .from('todos')
        .update({ project_id: projectId })
        .eq('id', todoId)

    if (error) {
        console.error('Error updating todo project:', error)
        throw error
    }

    const todos = store.get('todos')
    const todo = todos.find(t => t.id === todoId)
    if (todo) {
        todo.project_id = projectId
        store.set('todos', [...todos])
        events.emit(Events.TODO_UPDATED, todo)
    } else {
        console.warn(`updateTodoProject: todo ${todoId} not found in local store`)
    }
}
