import { store } from '../core/store.js'

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
