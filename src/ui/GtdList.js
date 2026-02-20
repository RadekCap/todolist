import { store } from '../core/store.js'
import { escapeHtml } from '../utils/security.js'
import { getGtdCount, updateTodoGtdStatus } from '../services/todos.js'
import { getIcon } from '../utils/icons.js'

/**
 * Get icon for a GTD status
 * @param {string} status - GTD status
 * @returns {string} SVG icon markup
 */
export function getGtdIcon(status) {
    return getIcon(status, { size: 18 })
}

/**
 * Get keyboard shortcut for a GTD status
 * @param {string} status - GTD status
 * @returns {string} Shortcut key
 */
export function getGtdShortcut(status) {
    const shortcuts = {
        'inbox': '1',
        'next_action': '2',
        'scheduled': '3',
        'waiting_for': '4',
        'someday_maybe': '5',
        'done': '6',
        'all': '0'
    }
    return shortcuts[status] || ''
}

/**
 * Select a GTD status
 * @param {string} status - GTD status
 */
export function selectGtdStatus(status) {
    store.set('selectedGtdStatus', status)
    // Exit projects view when selecting a GTD status
    store.set('showProjectsView', false)
}

/**
 * Select GTD status by keyboard shortcut
 * @param {number} digit - Digit pressed (0-9)
 */
export function selectGtdStatusByShortcut(digit) {
    const statusMap = {
        1: 'inbox',
        2: 'next_action',
        3: 'scheduled',
        4: 'waiting_for',
        5: 'someday_maybe',
        6: 'done',
        0: 'all'
    }

    const status = statusMap[digit]
    if (status) {
        selectGtdStatus(status)
    }
}

/**
 * Render the GTD status list
 * @param {HTMLElement} container - Container element
 */
export function renderGtdList(container) {
    const state = store.state

    // Global statuses (always visible)
    const globalStatuses = [
        { id: 'inbox', label: 'Inbox' }
    ]

    // Area-specific statuses
    const areaStatuses = [
        { id: 'next_action', label: 'Next' },
        { id: 'scheduled', label: 'Scheduled', isVirtual: true },
        { id: 'waiting_for', label: 'Waiting' },
        { id: 'someday_maybe', label: 'Someday' },
        { id: 'done', label: 'Done' },
        { id: 'all', label: 'All' }
    ]

    container.innerHTML = ''

    // Helper function to render a GTD item
    const renderGtdItem = (status) => {
        const li = document.createElement('li')
        const isActive = state.selectedGtdStatus === status.id
        li.className = `gtd-item ${status.id} ${isActive ? 'active' : ''}`

        const count = getGtdCount(status.id)
        const countDisplay = count > 0 ? count : ''
        const shortcut = getGtdShortcut(status.id)

        li.innerHTML = `
            <span class="gtd-icon">${getGtdIcon(status.id)}</span>
            <span class="gtd-label">${escapeHtml(status.label)}</span>
            <span class="gtd-shortcut">${shortcut}</span>
            <span class="gtd-count">${countDisplay}</span>
        `

        li.addEventListener('click', () => selectGtdStatus(status.id))

        // Drop target for assigning GTD status (except 'all' and 'scheduled')
        if (status.id !== 'all' && !status.isVirtual) {
            li.addEventListener('dragover', (e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                li.classList.add('drag-over')
            })
            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over')
            })
            li.addEventListener('drop', (e) => {
                e.preventDefault()
                li.classList.remove('drag-over')
                const todoId = e.dataTransfer.getData('text/plain')
                if (todoId) {
                    updateTodoGtdStatus(todoId, status.id)
                }
            })
        }

        container.appendChild(li)
    }

    // Render global Inbox
    globalStatuses.forEach(status => renderGtdItem(status))

    // Add separator between Inbox and area-specific items
    const separator = document.createElement('li')
    separator.className = 'gtd-inbox-separator'
    container.appendChild(separator)

    // Add area label if a specific area is selected
    if (state.selectedAreaId !== 'all' && state.selectedAreaId !== 'unassigned') {
        const area = state.areas.find(a => a.id === state.selectedAreaId)
        if (area) {
            const label = document.createElement('li')
            label.className = 'gtd-section-label'
            label.textContent = area.name
            container.appendChild(label)
        }
    } else if (state.selectedAreaId === 'unassigned') {
        const label = document.createElement('li')
        label.className = 'gtd-section-label'
        label.textContent = 'Unassigned'
        container.appendChild(label)
    }

    // Render area-specific statuses
    areaStatuses.forEach(status => renderGtdItem(status))
}
