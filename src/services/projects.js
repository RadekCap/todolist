import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'
import { pushNavigationState } from './navigation.js'

/**
 * Get the depth of a project (0 = root, 1 = child, 2 = grandchild)
 * @param {string} projectId - Project ID
 * @returns {number} Depth level
 */
export function getProjectDepth(projectId) {
    const projects = store.get('projects')
    let depth = 0
    let current = projects.find(p => p.id === projectId)
    while (current && current.parent_id) {
        depth++
        current = projects.find(p => p.id === current.parent_id)
        if (depth > 3) break // safety guard
    }
    return depth
}

/**
 * Get all descendant IDs of a project (children, grandchildren)
 * @param {string} projectId - Project ID
 * @returns {Array<string>} Array of descendant project IDs
 */
export function getDescendantIds(projectId) {
    const projects = store.get('projects')
    const ids = []
    const collect = (pid) => {
        projects.filter(p => p.parent_id === pid).forEach(child => {
            ids.push(child.id)
            collect(child.id)
        })
    }
    collect(projectId)
    return ids
}

/**
 * Check if moving projectId under newParentId would create a cycle
 * @param {string} projectId - Project being moved
 * @param {string|null} newParentId - Proposed parent
 * @returns {boolean} True if it would create a cycle
 */
export function wouldCreateCycle(projectId, newParentId) {
    if (!newParentId) return false
    if (newParentId === projectId) return true
    return getDescendantIds(projectId).includes(newParentId)
}

/**
 * Get the full path of project names from root to this project
 * @param {string} projectId - Project ID
 * @returns {Array<Object>} Array of {id, name} from root to project
 */
export function getProjectPath(projectId) {
    const projects = store.get('projects')
    const path = []
    let current = projects.find(p => p.id === projectId)
    while (current) {
        path.unshift({ id: current.id, name: current.name })
        current = current.parent_id ? projects.find(p => p.id === current.parent_id) : null
    }
    return path
}

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
 * @param {string|null} [parentId=null] - Parent project ID for subprojects
 * @returns {Promise<Object>} The created project
 */
export async function addProject(name, parentId = null) {
    const currentUser = store.get('currentUser')
    const selectedAreaId = store.get('selectedAreaId')
    const projects = store.get('projects')

    // Validate depth limit (max 3 levels: 0, 1, 2)
    if (parentId) {
        const parentDepth = getProjectDepth(parentId)
        if (parentDepth >= 2) {
            throw new Error('Cannot create subproject: maximum nesting depth (3 levels) reached')
        }
    }

    // Get next sort order among siblings
    const siblings = projects.filter(p => (p.parent_id || null) === parentId)
    const maxSortOrder = siblings.reduce((max, p) => Math.max(max, p.sort_order || 0), 0)

    // Encrypt project name before storing
    const encryptedName = await encrypt(name)

    // Generate a random color, or inherit from parent
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140']
    let projectColor
    let areaId

    if (parentId) {
        // Inherit color and area from parent
        const parent = projects.find(p => p.id === parentId)
        projectColor = parent ? parent.color : colors[Math.floor(Math.random() * colors.length)]
        areaId = parent ? parent.area_id : null
    } else {
        projectColor = colors[Math.floor(Math.random() * colors.length)]
        // Assign to current area if a specific area is selected
        areaId = (selectedAreaId !== 'all' && selectedAreaId !== 'unassigned')
            ? selectedAreaId
            : null
    }

    const insertData = {
        user_id: currentUser.id,
        name: encryptedName,
        color: projectColor,
        area_id: areaId,
        sort_order: maxSortOrder + 1
    }
    if (parentId) {
        insertData.parent_id = parentId
    }

    const { data, error } = await supabase
        .from('projects')
        .insert(insertData)
        .select()

    if (error) {
        console.error('Error adding project:', error)
        throw error
    }

    // Overlay decrypted name (DB returns encrypted value)
    const project = { ...data[0], name }
    const updatedProjects = [...store.get('projects'), project]
    store.set('projects', updatedProjects)
    events.emit(Events.PROJECT_ADDED, project)
    return project
}

/**
 * Delete a project and all its descendants
 * @param {string} projectId - Project ID
 * @param {Object} [options] - Delete options
 * @param {boolean} [options.deleteTodos=false] - Also delete todos in these projects
 */
export async function deleteProject(projectId, { deleteTodos = false } = {}) {
    const descendantIds = getDescendantIds(projectId)
    const removedIds = new Set([projectId, ...descendantIds])

    // Delete todos in these projects if requested
    if (deleteTodos) {
        const { error: todosError } = await supabase
            .from('todos')
            .delete()
            .in('project_id', [...removedIds])

        if (todosError) {
            console.error('Error deleting project todos:', todosError)
            throw todosError
        }

        const todos = store.get('todos').filter(t => !removedIds.has(t.project_id))
        store.set('todos', todos)
    }

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

    if (error) {
        console.error('Error deleting project:', error)
        throw error
    }

    // Remove project and all descendants from local store
    const projects = store.get('projects').filter(p => !removedIds.has(p.id))
    store.set('projects', projects)

    // Clear selection if deleted project or any descendant was selected
    if (removedIds.has(store.get('selectedProjectId'))) {
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
    pushNavigationState()
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
 * Update a project (name, color, description, area_id, parent_id)
 * @param {string} projectId - Project ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.name] - New project name
 * @param {string} [updates.color] - New project color
 * @param {string} [updates.description] - New project description
 * @param {string|null} [updates.area_id] - New area ID or null
 * @param {string|null} [updates.parent_id] - New parent project ID or null
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

        // Propagate area change to all descendants
        const descendantIds = getDescendantIds(projectId)
        if (descendantIds.length > 0) {
            for (const childId of descendantIds) {
                await supabase
                    .from('projects')
                    .update({ area_id: updates.area_id })
                    .eq('id', childId)
            }
        }
    }
    if (updates.parent_id !== undefined) {
        // Validate no circular reference
        if (wouldCreateCycle(projectId, updates.parent_id)) {
            throw new Error('Cannot move project: would create circular reference')
        }
        // Validate depth limit
        if (updates.parent_id) {
            const parentDepth = getProjectDepth(updates.parent_id)
            const subtreeDepth = getMaxSubtreeDepth(projectId)
            if (parentDepth + 1 + subtreeDepth > 2) {
                throw new Error('Cannot move project: would exceed maximum nesting depth (3 levels)')
            }
        }
        updateData.parent_id = updates.parent_id
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
        if (updates.area_id !== undefined) {
            project.area_id = updates.area_id
            // Update descendants locally too
            const descendantIds = getDescendantIds(projectId)
            descendantIds.forEach(id => {
                const child = projects.find(p => p.id === id)
                if (child) child.area_id = updates.area_id
            })
        }
        if (updates.parent_id !== undefined) project.parent_id = updates.parent_id
        store.set('projects', [...projects])
    }

    events.emit(Events.PROJECT_UPDATED, project)
}

/**
 * Get the maximum depth of a project's subtree (0 if no children)
 * @param {string} projectId - Project ID
 * @returns {number} Maximum subtree depth
 */
function getMaxSubtreeDepth(projectId) {
    const projects = store.get('projects')
    const children = projects.filter(p => p.parent_id === projectId)
    if (children.length === 0) return 0
    return 1 + Math.max(...children.map(c => getMaxSubtreeDepth(c.id)))
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
 * Reorder projects (among siblings with same parent)
 * @param {Array<string>} orderedIds - Array of project IDs in new order
 */
export async function reorderProjects(orderedIds) {
    const projects = store.get('projects')

    // Update local state first for immediate feedback
    const updatedProjects = projects.map(p => {
        const index = orderedIds.indexOf(p.id)
        if (index !== -1) {
            return { ...p, sort_order: index }
        }
        return p
    })
    store.set('projects', updatedProjects)

    // Update database
    for (let i = 0; i < orderedIds.length; i++) {
        await supabase
            .from('projects')
            .update({ sort_order: i })
            .eq('id', orderedIds[i])
    }

    events.emit(Events.PROJECTS_LOADED, store.get('projects'))
}
