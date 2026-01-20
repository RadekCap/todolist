import { store } from '../core/store.js'

/**
 * Get human-readable view name for export header
 * @returns {string} View description
 */
export function getExportViewName() {
    const parts = []
    const state = store.state

    // GTD status
    const gtdLabels = {
        'inbox': 'Inbox',
        'next_action': 'Next Actions',
        'scheduled': 'Scheduled',
        'waiting_for': 'Waiting For',
        'someday_maybe': 'Someday/Maybe',
        'done': 'Done',
        'all': 'All'
    }
    parts.push(gtdLabels[state.selectedGtdStatus] || state.selectedGtdStatus)

    // Categories
    if (state.selectedCategoryIds.size > 0) {
        const catNames = [...state.selectedCategoryIds].map(id => {
            if (id === 'uncategorized') return 'Uncategorized'
            const cat = state.categories.find(c => c.id === id)
            return cat ? cat.name : id
        })
        parts.push(`Categories: ${catNames.join(', ')}`)
    }

    // Contexts
    if (state.selectedContextIds.size > 0) {
        const ctxNames = [...state.selectedContextIds].map(id => {
            const ctx = state.contexts.find(c => c.id === id)
            return ctx ? ctx.name : id
        })
        parts.push(`Contexts: ${ctxNames.join(', ')}`)
    }

    // Project
    if (state.selectedProjectId) {
        const project = state.projects.find(p => p.id === state.selectedProjectId)
        if (project) {
            parts.push(`Project: ${project.name}`)
        }
    }

    return parts.join(' | ')
}

/**
 * Get filename for export
 * @returns {string} Filename without extension
 */
export function getExportFileName() {
    const state = store.state
    const date = new Date().toISOString().split('T')[0]
    const status = state.selectedGtdStatus.replace('_', '-')
    return `${date}-${status}`
}

/**
 * Download content as a text file
 * @param {string} content - File content
 * @param {string} filename - File name with extension
 */
export function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
}

/**
 * Export filtered todos as plain text
 * @param {Array} filteredTodos - Array of todo objects to export
 */
export function exportTodos(filteredTodos) {
    const state = store.state

    if (filteredTodos.length === 0) {
        alert('No todos to export')
        return
    }

    // Build plain text export
    const lines = []

    // Add header with current view info
    const viewName = getExportViewName()
    lines.push(`TodoList Export - ${viewName}`)
    lines.push(`Exported: ${new Date().toLocaleString()}`)
    lines.push('\u2500'.repeat(40))
    lines.push('')

    filteredTodos.forEach(todo => {
        const checkbox = todo.gtd_status === 'done' ? '[x]' : '[ ]'
        lines.push(`${checkbox} ${todo.text}`)

        // Add metadata on indented lines
        const meta = []

        if (todo.due_date) {
            meta.push(`Due: ${todo.due_date}`)
        }

        const category = todo.category_id ? state.categories.find(c => c.id === todo.category_id) : null
        if (category) {
            meta.push(`Category: ${category.name}`)
        }

        const project = todo.project_id ? state.projects.find(p => p.id === todo.project_id) : null
        if (project) {
            meta.push(`Project: ${project.name}`)
        }

        const context = todo.context_id ? state.contexts.find(c => c.id === todo.context_id) : null
        if (context) {
            meta.push(`Context: ${context.name}`)
        }

        const priority = todo.priority_id ? state.priorities.find(p => p.id === todo.priority_id) : null
        if (priority) {
            meta.push(`Priority: ${priority.name}`)
        }

        if (meta.length > 0) {
            lines.push(`    ${meta.join(' | ')}`)
        }

        if (todo.comment) {
            lines.push(`    Note: ${todo.comment}`)
        }

        lines.push('')
    })

    // Add summary
    lines.push('\u2500'.repeat(40))
    const completed = filteredTodos.filter(t => t.gtd_status === 'done').length
    lines.push(`Total: ${filteredTodos.length} | Completed: ${completed}`)

    const content = lines.join('\n')

    // Download as file
    downloadTextFile(content, `todolist-export-${getExportFileName()}.txt`)
}
