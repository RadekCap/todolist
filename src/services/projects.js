import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'

/**
 * Load all projects for the current user
 * @returns {Promise<Array>} Array of decrypted projects
 */
export async function loadProjects() {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('sort_order', { ascending: true })

    if (error) {
        console.error('Error loading projects:', error)
        throw error
    }

    // Decrypt project names and descriptions
    const projects = await Promise.all(data.map(async (project) => ({
        ...project,
        name: await decrypt(project.name),
        description: project.description ? await decrypt(project.description) : null
    })))

    store.set('projects', projects)
    events.emit(Events.PROJECTS_LOADED, projects)
    return projects
}

/**
 * Add a new project
 * @param {string} name - Project name
 * @returns {Promise<Object>} The created project
 */
export async function addProject(name) {
    const currentUser = store.get('currentUser')
    const selectedAreaId = store.get('selectedAreaId')
    const projects = store.get('projects')

    // Get next sort order
    const maxSortOrder = projects.reduce((max, p) => Math.max(max, p.sort_order || 0), 0)

    // Encrypt project name before storing
    const encryptedName = await encrypt(name)

    // Generate a random color
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    // Assign to current area if a specific area is selected
    const areaId = (selectedAreaId !== 'all' && selectedAreaId !== 'unassigned')
        ? selectedAreaId
        : null

    const { data, error } = await supabase
        .from('projects')
        .insert({
            user_id: currentUser.id,
            name: encryptedName,
            color: randomColor,
            area_id: areaId,
            sort_order: maxSortOrder + 1
        })
        .select()

    if (error) {
        console.error('Error adding project:', error)
        throw error
    }

    const project = { ...data[0], name }
    const updatedProjects = [...store.get('projects'), project]
    store.set('projects', updatedProjects)
    events.emit(Events.PROJECT_ADDED, project)
    return project
}

/**
 * Delete a project
 * @param {string} projectId - Project ID
 */
export async function deleteProject(projectId) {
    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

    if (error) {
        console.error('Error deleting project:', error)
        throw error
    }

    const projects = store.get('projects').filter(p => p.id !== projectId)
    store.set('projects', projects)

    // Clear selection if deleted project was selected
    if (store.get('selectedProjectId') === projectId) {
        store.set('selectedProjectId', null)
    }

    events.emit(Events.PROJECT_DELETED, projectId)
}

/**
 * Select a project
 * @param {string|null} projectId - Project ID or null for all projects
 */
export function selectProject(projectId) {
    if (projectId === null) {
        // "All Projects" shows the project list view
        store.set('selectedProjectId', null)
        store.set('showProjectsView', true)
    } else {
        // Clicking a specific project shows its todos
        store.set('selectedProjectId', projectId)
        store.set('showProjectsView', false)
        // Switch GTD filter to 'all' to show all items in this project
        store.set('selectedGtdStatus', 'all')
    }
    events.emit(Events.VIEW_CHANGED)
}

/**
 * Get filtered projects based on selected area
 * @returns {Array} Filtered projects
 */
export function getFilteredProjects() {
    const projects = store.get('projects')
    const selectedAreaId = store.get('selectedAreaId')

    if (selectedAreaId === 'all') {
        return projects
    }

    if (selectedAreaId === 'unassigned') {
        return projects.filter(p => p.area_id === null)
    }

    return projects.filter(p => p.area_id === selectedAreaId)
}

/**
 * Update a project (name, color, description, area_id)
 * @param {string} projectId - Project ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.name] - New project name
 * @param {string} [updates.color] - New project color
 * @param {string} [updates.description] - New project description
 * @param {string|null} [updates.area_id] - New area ID or null
 */
export async function updateProject(projectId, updates) {
    const updateData = {}

    if (updates.name !== undefined) {
        updateData.name = await encrypt(updates.name)
    }
    if (updates.color !== undefined) {
        updateData.color = updates.color
    }
    if (updates.description !== undefined) {
        updateData.description = updates.description ? await encrypt(updates.description) : null
    }
    if (updates.area_id !== undefined) {
        updateData.area_id = updates.area_id
    }

    const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)

    if (error) {
        console.error('Error updating project:', error)
        throw error
    }

    // Update local state
    const projects = store.get('projects')
    const project = projects.find(p => p.id === projectId)
    if (project) {
        if (updates.name !== undefined) project.name = updates.name
        if (updates.color !== undefined) project.color = updates.color
        if (updates.description !== undefined) project.description = updates.description
        if (updates.area_id !== undefined) project.area_id = updates.area_id
        store.set('projects', [...projects])
    }

    events.emit(Events.PROJECT_UPDATED, project)
}

/**
 * Rename a project
 * @param {string} projectId - Project ID
 * @param {string} newName - New project name
 */
export async function renameProject(projectId, newName) {
    await updateProject(projectId, { name: newName })
}

/**
 * Reorder projects
 * @param {Array<string>} orderedIds - Array of project IDs in new order
 */
export async function reorderProjects(orderedIds) {
    const projects = store.get('projects')

    // Update local state first for immediate feedback
    const reorderedProjects = orderedIds.map((id, index) => {
        const project = projects.find(p => p.id === id)
        return { ...project, sort_order: index }
    })
    store.set('projects', reorderedProjects)

    // Update database
    for (let i = 0; i < orderedIds.length; i++) {
        await supabase
            .from('projects')
            .update({ sort_order: i })
            .eq('id', orderedIds[i])
    }

    events.emit(Events.PROJECTS_LOADED, store.get('projects'))
}
