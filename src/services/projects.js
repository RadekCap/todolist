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
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error loading projects:', error)
        throw error
    }

    // Decrypt project names
    const projects = await Promise.all(data.map(async (project) => ({
        ...project,
        name: await decrypt(project.name)
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
            area_id: areaId
        })
        .select()

    if (error) {
        console.error('Error adding project:', error)
        throw error
    }

    await loadProjects()
    events.emit(Events.PROJECT_ADDED, data[0])
    return data[0]
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
