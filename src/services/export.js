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
 * Download content as a file
 * @param {string} content - File content
 * @param {string} filename - File name with extension
 * @param {string} mimeType - MIME type for the file
 */
export function downloadFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType })
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
export function exportTodosAsText(filteredTodos) {
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
    downloadFile(content, `todolist-export-${getExportFileName()}.txt`, 'text/plain;charset=utf-8')
}

/**
 * Export filtered todos as JSON
 * @param {Array} filteredTodos - Array of todo objects to export
 */
export function exportTodosAsJSON(filteredTodos) {
    const state = store.state

    if (filteredTodos.length === 0) {
        alert('No todos to export')
        return
    }

    const exportData = {
        metadata: {
            view: getExportViewName(),
            exportedAt: new Date().toISOString(),
            totalCount: filteredTodos.length,
            completedCount: filteredTodos.filter(t => t.gtd_status === 'done').length
        },
        todos: filteredTodos.map(todo => {
            const category = todo.category_id ? state.categories.find(c => c.id === todo.category_id) : null
            const project = todo.project_id ? state.projects.find(p => p.id === todo.project_id) : null
            const context = todo.context_id ? state.contexts.find(c => c.id === todo.context_id) : null
            const priority = todo.priority_id ? state.priorities.find(p => p.id === todo.priority_id) : null

            return {
                id: todo.id,
                text: todo.text,
                completed: todo.gtd_status === 'done',
                gtdStatus: todo.gtd_status,
                dueDate: todo.due_date || null,
                category: category ? category.name : null,
                project: project ? project.name : null,
                context: context ? context.name : null,
                priority: priority ? priority.name : null,
                comment: todo.comment || null,
                createdAt: todo.created_at
            }
        })
    }

    const content = JSON.stringify(exportData, null, 2)
    downloadFile(content, `todolist-export-${getExportFileName()}.json`, 'application/json;charset=utf-8')
}

/**
 * Export filtered todos as CSV
 * @param {Array} filteredTodos - Array of todo objects to export
 */
export function exportTodosAsCSV(filteredTodos) {
    const state = store.state

    if (filteredTodos.length === 0) {
        alert('No todos to export')
        return
    }

    // Helper function to escape CSV values
    const escapeCSV = (value) => {
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
    }

    // CSV header
    const headers = ['ID', 'Text', 'Completed', 'GTD Status', 'Due Date', 'Category', 'Project', 'Context', 'Priority', 'Comment', 'Created At']
    const csvLines = [headers.join(',')]

    // CSV rows
    filteredTodos.forEach(todo => {
        const category = todo.category_id ? state.categories.find(c => c.id === todo.category_id) : null
        const project = todo.project_id ? state.projects.find(p => p.id === todo.project_id) : null
        const context = todo.context_id ? state.contexts.find(c => c.id === todo.context_id) : null
        const priority = todo.priority_id ? state.priorities.find(p => p.id === todo.priority_id) : null

        const row = [
            escapeCSV(todo.id),
            escapeCSV(todo.text),
            todo.gtd_status === 'done' ? 'Yes' : 'No',
            escapeCSV(todo.gtd_status),
            escapeCSV(todo.due_date),
            escapeCSV(category ? category.name : ''),
            escapeCSV(project ? project.name : ''),
            escapeCSV(context ? context.name : ''),
            escapeCSV(priority ? priority.name : ''),
            escapeCSV(todo.comment),
            escapeCSV(todo.created_at)
        ]
        csvLines.push(row.join(','))
    })

    const content = csvLines.join('\n')
    downloadFile(content, `todolist-export-${getExportFileName()}.csv`, 'text/csv;charset=utf-8')
}

/**
 * Export filtered todos as XML
 * @param {Array} filteredTodos - Array of todo objects to export
 */
export function exportTodosAsXML(filteredTodos) {
    const state = store.state

    if (filteredTodos.length === 0) {
        alert('No todos to export')
        return
    }

    // Helper function to escape XML special characters
    const escapeXML = (value) => {
        if (value === null || value === undefined) return ''
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
    }

    const xmlLines = ['<?xml version="1.0" encoding="UTF-8"?>']
    xmlLines.push('<todolist>')
    xmlLines.push('  <metadata>')
    xmlLines.push(`    <view>${escapeXML(getExportViewName())}</view>`)
    xmlLines.push(`    <exportedAt>${escapeXML(new Date().toISOString())}</exportedAt>`)
    xmlLines.push(`    <totalCount>${filteredTodos.length}</totalCount>`)
    xmlLines.push(`    <completedCount>${filteredTodos.filter(t => t.gtd_status === 'done').length}</completedCount>`)
    xmlLines.push('  </metadata>')
    xmlLines.push('  <todos>')

    filteredTodos.forEach(todo => {
        const category = todo.category_id ? state.categories.find(c => c.id === todo.category_id) : null
        const project = todo.project_id ? state.projects.find(p => p.id === todo.project_id) : null
        const context = todo.context_id ? state.contexts.find(c => c.id === todo.context_id) : null
        const priority = todo.priority_id ? state.priorities.find(p => p.id === todo.priority_id) : null

        xmlLines.push('    <todo>')
        xmlLines.push(`      <id>${escapeXML(todo.id)}</id>`)
        xmlLines.push(`      <text>${escapeXML(todo.text)}</text>`)
        xmlLines.push(`      <completed>${todo.gtd_status === 'done'}</completed>`)
        xmlLines.push(`      <gtdStatus>${escapeXML(todo.gtd_status)}</gtdStatus>`)
        if (todo.due_date) {
            xmlLines.push(`      <dueDate>${escapeXML(todo.due_date)}</dueDate>`)
        }
        if (category) {
            xmlLines.push(`      <category>${escapeXML(category.name)}</category>`)
        }
        if (project) {
            xmlLines.push(`      <project>${escapeXML(project.name)}</project>`)
        }
        if (context) {
            xmlLines.push(`      <context>${escapeXML(context.name)}</context>`)
        }
        if (priority) {
            xmlLines.push(`      <priority>${escapeXML(priority.name)}</priority>`)
        }
        if (todo.comment) {
            xmlLines.push(`      <comment>${escapeXML(todo.comment)}</comment>`)
        }
        xmlLines.push(`      <createdAt>${escapeXML(todo.created_at)}</createdAt>`)
        xmlLines.push('    </todo>')
    })

    xmlLines.push('  </todos>')
    xmlLines.push('</todolist>')

    const content = xmlLines.join('\n')
    downloadFile(content, `todolist-export-${getExportFileName()}.xml`, 'application/xml;charset=utf-8')
}

/**
 * Export filtered todos in the specified format
 * @param {Array} filteredTodos - Array of todo objects to export
 * @param {string} format - Export format ('text', 'json', 'csv', 'xml')
 */
export function exportTodos(filteredTodos, format = 'text') {
    switch (format.toLowerCase()) {
        case 'json':
            exportTodosAsJSON(filteredTodos)
            break
        case 'csv':
            exportTodosAsCSV(filteredTodos)
            break
        case 'xml':
            exportTodosAsXML(filteredTodos)
            break
        case 'text':
        default:
            exportTodosAsText(filteredTodos)
            break
    }
}
