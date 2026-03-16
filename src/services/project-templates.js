import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'
import { addProject, reorderProjects } from './projects.js'
import { addTodo } from './todos.js'

/**
 * Load all project templates and their items for the current user.
 * Decrypts names and item texts, then stores as nested objects.
 * @returns {Promise<Array>} Array of templates with nested items
 */
export async function loadProjectTemplates() {
    const { data: templates, error: tErr } = await supabase
        .from('project_templates')
        .select('*')
        .order('created_at', { ascending: true })

    if (tErr) {
        console.error('Error loading project templates:', tErr)
        throw tErr
    }

    const { data: items, error: iErr } = await supabase
        .from('project_template_items')
        .select('*')
        .order('sort_order', { ascending: true })

    if (iErr) {
        console.error('Error loading template items:', iErr)
        throw iErr
    }

    // Decrypt and nest items into templates
    const result = await Promise.all(templates.map(async (tmpl) => {
        const tmplItems = items.filter(i => i.template_id === tmpl.id)
        const decryptedItems = await Promise.all(tmplItems.map(async (item) => ({
            ...item,
            text: await decrypt(item.text)
        })))
        return {
            ...tmpl,
            name: await decrypt(tmpl.name),
            items: decryptedItems
        }
    }))

    store.set('projectTemplates', result)
    events.emit(Events.PROJECT_TEMPLATES_LOADED, result)
    return result
}

/**
 * Create a new project template
 * @param {string} name - Template name (plaintext)
 * @returns {Promise<Object>} The created template
 */
export async function addProjectTemplate(name) {
    const currentUser = store.get('currentUser')
    const encryptedName = await encrypt(name)

    const { data, error } = await supabase
        .from('project_templates')
        .insert({
            user_id: currentUser.id,
            name: encryptedName
        })
        .select()

    if (error) {
        console.error('Error adding project template:', error)
        throw error
    }

    const template = { ...data[0], name, items: [] }
    const templates = [...store.get('projectTemplates'), template]
    store.set('projectTemplates', templates)
    events.emit(Events.PROJECT_TEMPLATE_ADDED, template)
    return template
}

/**
 * Add an item to a project template
 * @param {string} templateId - Template ID
 * @param {string} text - Item text (plaintext)
 * @returns {Promise<Object>} The created item
 */
export async function addTemplateItem(templateId, text) {
    const currentUser = store.get('currentUser')
    const templates = store.get('projectTemplates')
    const template = templates.find(t => t.id === templateId)
    const sortOrder = template ? template.items.length : 0

    const encryptedText = await encrypt(text)

    const { data, error } = await supabase
        .from('project_template_items')
        .insert({
            template_id: templateId,
            user_id: currentUser.id,
            text: encryptedText,
            sort_order: sortOrder
        })
        .select()

    if (error) {
        console.error('Error adding template item:', error)
        throw error
    }

    const item = { ...data[0], text }
    const updated = templates.map(t => {
        if (t.id === templateId) {
            return { ...t, items: [...t.items, item] }
        }
        return t
    })
    store.set('projectTemplates', updated)
    events.emit(Events.PROJECT_TEMPLATES_LOADED, updated)
    return item
}

/**
 * Delete an item from a project template
 * @param {string} templateId - Template ID
 * @param {string} itemId - Item ID
 */
export async function deleteTemplateItem(templateId, itemId) {
    const { error } = await supabase
        .from('project_template_items')
        .delete()
        .eq('id', itemId)

    if (error) {
        console.error('Error deleting template item:', error)
        throw error
    }

    const templates = store.get('projectTemplates').map(t => {
        if (t.id === templateId) {
            return { ...t, items: t.items.filter(i => i.id !== itemId) }
        }
        return t
    })
    store.set('projectTemplates', templates)
    events.emit(Events.PROJECT_TEMPLATES_LOADED, templates)
}

/**
 * Delete a project template (items cascade-deleted by DB)
 * @param {string} templateId - Template ID
 */
export async function deleteProjectTemplate(templateId) {
    const { error } = await supabase
        .from('project_templates')
        .delete()
        .eq('id', templateId)

    if (error) {
        console.error('Error deleting project template:', error)
        throw error
    }

    const templates = store.get('projectTemplates').filter(t => t.id !== templateId)
    store.set('projectTemplates', templates)
    events.emit(Events.PROJECT_TEMPLATE_DELETED, templateId)
}

/**
 * Rename a project template
 * @param {string} templateId - Template ID
 * @param {string} newName - New name (plaintext)
 */
export async function renameProjectTemplate(templateId, newName) {
    const encryptedName = await encrypt(newName)

    const { error } = await supabase
        .from('project_templates')
        .update({ name: encryptedName })
        .eq('id', templateId)

    if (error) {
        console.error('Error renaming project template:', error)
        throw error
    }

    const templates = store.get('projectTemplates').map(t => {
        if (t.id === templateId) {
            return { ...t, name: newName }
        }
        return t
    })
    store.set('projectTemplates', templates)
    events.emit(Events.PROJECT_TEMPLATES_LOADED, templates)
}

/**
 * Reorder items within a project template.
 * Updates sort_order in both local state and Supabase.
 * @param {string} templateId - Template ID
 * @param {Array<string>} orderedItemIds - Item IDs in desired order
 */
export async function reorderTemplateItems(templateId, orderedItemIds) {
    const templates = store.get('projectTemplates')
    const updated = templates.map(t => {
        if (t.id !== templateId) return t
        const reorderedItems = t.items.map(item => {
            const index = orderedItemIds.indexOf(item.id)
            if (index !== -1) {
                return { ...item, sort_order: index }
            }
            return item
        }).sort((a, b) => a.sort_order - b.sort_order)
        return { ...t, items: reorderedItems }
    })
    store.set('projectTemplates', updated)
    events.emit(Events.PROJECT_TEMPLATES_LOADED, updated)

    for (let i = 0; i < orderedItemIds.length; i++) {
        const { error } = await supabase
            .from('project_template_items')
            .update({ sort_order: i })
            .eq('id', orderedItemIds[i])

        if (error) {
            console.error('Error reordering template item:', error)
            throw error
        }
    }
}

/**
 * Create a new project from a template.
 * Copies template name as project name and all items as inbox todos.
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} The created project
 */
export async function createProjectFromTemplate(templateId) {
    const templates = store.get('projectTemplates')
    const template = templates.find(t => t.id === templateId)
    if (!template) {
        throw new Error('Template not found')
    }

    // Create project with template name
    const project = await addProject(template.name)

    // Move new project to the top of the root project list
    const allProjects = store.get('projects')
    const rootProjects = allProjects
        .filter(p => !p.parent_id)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const reorderedIds = [project.id, ...rootProjects.filter(p => p.id !== project.id).map(p => p.id)]
    await reorderProjects(reorderedIds)

    // Create todos from template items
    for (const item of template.items) {
        await addTodo({
            text: item.text,
            projectId: project.id,
            gtdStatus: 'inbox'
        })
    }

    events.emit(Events.PROJECT_TEMPLATE_APPLIED, { templateId, projectId: project.id })
    return project
}
