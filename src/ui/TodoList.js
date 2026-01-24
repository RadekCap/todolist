import { store } from '../core/store.js'
import { escapeHtml, validateColor } from '../utils/security.js'
import { formatDateBadge, getDateGroup, getDateGroupLabel } from '../utils/dates.js'
import { getFilteredTodos, toggleTodo, deleteTodo, updateTodoProject, updateTodoGtdStatus, getProjectTodoCount } from '../services/todos.js'
import { getCategoryById } from '../services/categories.js'
import { getPriorityById } from '../services/priorities.js'
import { getContextById } from '../services/contexts.js'

/**
 * Get human-readable label for a GTD status
 * @param {string} status - GTD status
 * @returns {string} Human-readable label
 */
export function getGtdStatusLabel(status) {
    const labels = {
        'inbox': 'Inbox',
        'next_action': 'Next',
        'scheduled': 'Scheduled',
        'waiting_for': 'Waiting',
        'someday_maybe': 'Someday',
        'done': 'Done'
    }
    return labels[status] || status
}

/**
 * Render the projects view (when "All Projects" is selected)
 * @param {HTMLElement} container - Container element
 * @param {Function} onProjectClick - Callback when a project is clicked
 */
export function renderProjectsView(container, onProjectClick) {
    const projects = store.get('projects')

    if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state">No projects yet. Create one in the sidebar!</div>'
        return
    }

    projects.forEach(project => {
        const count = getProjectTodoCount(project.id)
        const li = document.createElement('li')
        li.className = 'project-card'
        li.innerHTML = `
            <span class="project-card-color" style="background-color: ${validateColor(project.color)}"></span>
            <span class="project-card-name">${escapeHtml(project.name)}</span>
            <span class="project-card-count">${count} ${count === 1 ? 'item' : 'items'}</span>
        `
        li.addEventListener('click', () => onProjectClick(project.id))
        container.appendChild(li)
    })
}

/**
 * Render the todo list
 * @param {HTMLElement} container - Container element
 * @param {Object} options - Render options
 * @param {Function} options.onEditTodo - Callback to edit a todo
 * @param {Function} options.onProjectClick - Callback when a project card is clicked
 */
export function renderTodos(container, options = {}) {
    const { onEditTodo, onProjectClick } = options
    const state = store.state

    container.innerHTML = ''

    // Show projects view when "All Projects" is selected
    if (state.showProjectsView) {
        renderProjectsView(container, onProjectClick)
        return
    }

    // Show project title header when a project is selected
    if (state.selectedProjectId !== null) {
        const project = state.projects.find(p => p.id === state.selectedProjectId)
        if (project) {
            const header = document.createElement('li')
            header.className = 'project-title-header'
            header.innerHTML = `<span class="project-title-text">${escapeHtml(project.name)}</span>`
            container.appendChild(header)
        }
    }

    const filteredTodos = getFilteredTodos()

    if (filteredTodos.length === 0) {
        // Special zen state for empty Inbox
        if (state.selectedGtdStatus === 'inbox') {
            const zenState = document.createElement('li')
            zenState.className = 'inbox-zen-state-wrapper'
            zenState.innerHTML = `
                <div class="inbox-zen-state">
                    <svg class="zen-illustration" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <!-- Calm water ripples -->
                        <ellipse cx="60" cy="95" rx="50" ry="8" fill="url(#waterGradient)" opacity="0.3"/>
                        <ellipse cx="60" cy="95" rx="35" ry="5" fill="url(#waterGradient)" opacity="0.5"/>
                        <ellipse cx="60" cy="95" rx="20" ry="3" fill="url(#waterGradient)" opacity="0.7"/>
                        <!-- Lotus flower -->
                        <g transform="translate(60, 70)">
                            <!-- Back petals -->
                            <ellipse cx="-18" cy="-5" rx="12" ry="20" fill="#E8B4D8" transform="rotate(-30)"/>
                            <ellipse cx="18" cy="-5" rx="12" ry="20" fill="#E8B4D8" transform="rotate(30)"/>
                            <!-- Middle petals -->
                            <ellipse cx="-10" cy="-8" rx="10" ry="22" fill="#F0C4E4" transform="rotate(-15)"/>
                            <ellipse cx="10" cy="-8" rx="10" ry="22" fill="#F0C4E4" transform="rotate(15)"/>
                            <!-- Front petal -->
                            <ellipse cx="0" cy="-10" rx="9" ry="24" fill="#F8D8EE"/>
                            <!-- Center -->
                            <circle cx="0" cy="0" r="6" fill="#FFE4A0"/>
                            <circle cx="-2" cy="-1" r="1" fill="#E8C870"/>
                            <circle cx="2" cy="-1" r="1" fill="#E8C870"/>
                            <circle cx="0" cy="2" r="1" fill="#E8C870"/>
                        </g>
                        <!-- Gradient definitions -->
                        <defs>
                            <linearGradient id="waterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style="stop-color:#667eea;stop-opacity:0.3"/>
                                <stop offset="50%" style="stop-color:#764ba2;stop-opacity:0.5"/>
                                <stop offset="100%" style="stop-color:#667eea;stop-opacity:0.3"/>
                            </linearGradient>
                        </defs>
                    </svg>
                    <h3 class="zen-title">Inbox Zero</h3>
                    <p class="zen-message">Your mind is clear. All items have been processed. Take a moment to breathe.</p>
                </div>
            `
            container.appendChild(zenState)
        } else {
            let emptyMsg
            if (state.searchQuery) {
                emptyMsg = 'No todos match your search.'
            } else if (state.selectedCategoryIds.size === 0) {
                emptyMsg = 'No todos yet. Add one above!'
            } else {
                emptyMsg = 'No todos in selected categories.'
            }
            const emptyState = document.createElement('li')
            emptyState.className = 'empty-state-wrapper'
            emptyState.innerHTML = `<div class="empty-state">${emptyMsg}</div>`
            container.appendChild(emptyState)
        }
        return
    }

    // Track current date group for section headers in Scheduled view
    let currentDateGroup = null

    filteredTodos.forEach(todo => {
        // Add section header for Scheduled view
        if (state.selectedGtdStatus === 'scheduled' && todo.due_date) {
            const dateGroup = getDateGroup(todo.due_date)
            if (dateGroup !== currentDateGroup) {
                currentDateGroup = dateGroup
                const header = document.createElement('li')
                header.className = `scheduled-section-header ${dateGroup}`
                header.innerHTML = `<span class="section-header-text">${escapeHtml(getDateGroupLabel(dateGroup))}</span>`
                container.appendChild(header)
            }
        }

        const li = document.createElement('li')
        // Derive completed state from gtd_status (unified status)
        const isCompleted = todo.gtd_status === 'done'
        li.className = `todo-item ${isCompleted ? 'completed' : ''}`
        li.dataset.todoId = todo.id

        const category = todo.category_id ? (getCategoryById(todo.category_id) ?? null) : null
        const categoryBadge = category
            ? `<span class="todo-category-badge" style="background-color: ${validateColor(category.color)}">${escapeHtml(category.name)}</span>`
            : ''

        const priority = todo.priority_id ? (getPriorityById(todo.priority_id) ?? null) : null
        const priorityBadge = priority
            ? `<span class="todo-priority-badge" style="background-color: ${validateColor(priority.color)}">${escapeHtml(priority.name)}</span>`
            : ''

        const gtdStatus = todo.gtd_status || 'inbox'
        const gtdBadge = `<span class="todo-gtd-badge ${gtdStatus}">${escapeHtml(getGtdStatusLabel(gtdStatus))}</span>`

        const context = todo.context_id ? (getContextById(todo.context_id) ?? null) : null
        const contextBadge = context
            ? `<span class="todo-context-badge">${escapeHtml(context.name)}</span>`
            : ''

        const dateBadge = todo.due_date ? formatDateBadge(todo.due_date) : ''

        const commentHtml = todo.comment
            ? `<div class="todo-comment">${escapeHtml(todo.comment)}</div>`
            : ''

        // Recurring icon for todos linked to a template
        const recurringIcon = todo.template_id
            ? `<span class="recurring-icon" title="Recurring">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="17 1 21 5 17 9"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
               </span>`
            : ''

        if (category) {
            li.style.borderLeftColor = validateColor(category.color)
        }

        li.innerHTML = `
            <span class="drag-handle" draggable="true">\u22ee\u22ee</span>
            <input
                type="checkbox"
                class="todo-checkbox"
                ${isCompleted ? 'checked' : ''}
                data-id="${todo.id}"
            >
            ${recurringIcon}
            <div class="todo-content">
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                ${commentHtml}
            </div>
            ${gtdBadge}
            ${priorityBadge}
            ${contextBadge}
            ${dateBadge}
            ${categoryBadge}
            <button class="delete-btn" data-id="${todo.id}">Delete</button>
        `

        // Drag handle events
        const dragHandle = li.querySelector('.drag-handle')
        dragHandle.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', todo.id)
            e.dataTransfer.effectAllowed = 'move'
            li.classList.add('dragging')
        })
        dragHandle.addEventListener('dragend', () => {
            li.classList.remove('dragging')
        })

        const checkbox = li.querySelector('.todo-checkbox')
        checkbox.addEventListener('change', () => toggleTodo(todo.id))

        // Click on todo text opens edit modal
        const todoText = li.querySelector('.todo-text')
        todoText.addEventListener('click', () => {
            if (onEditTodo) onEditTodo(todo.id)
        })

        const deleteBtn = li.querySelector('.delete-btn')
        deleteBtn.addEventListener('click', () => deleteTodo(todo.id))

        container.appendChild(li)
    })
}
