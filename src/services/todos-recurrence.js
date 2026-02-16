import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'
import { calculateNextOccurrence, isRecurrenceEnded } from '../utils/recurrence.js'

export { isRecurrenceEnded }

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
