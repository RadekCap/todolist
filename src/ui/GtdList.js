import { store } from '../core/store.js'
import { getGtdCount, updateTodoGtdStatus } from '../services/todos.js'
import { getIcon } from '../utils/icons.js'

const GTD_STATUSES = [
    { id: 'inbox', label: 'Inbox' },
    { id: 'next_action', label: 'Next' },
    { id: 'scheduled', label: 'Scheduled', isVirtual: true },
    { id: 'waiting_for', label: 'Waiting' },
    { id: 'someday_maybe', label: 'Someday' },
    { id: 'done', label: 'Done' },
    { id: 'all', label: 'All' }
]

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
 * Render the GTD status tab bar (icon-only, horizontal)
 * @param {HTMLElement} container - The nav.gtd-tab-bar element
 */
export function renderGtdTabBar(container) {
    const state = store.state

    container.innerHTML = ''

    GTD_STATUSES.forEach(status => {
        const btn = document.createElement('button')
        const isActive = state.selectedGtdStatus === status.id
        const count = getGtdCount(status.id)
        const shortcut = getGtdShortcut(status.id)

        btn.className = `gtd-tab ${status.id}${isActive ? ' active' : ''}`
        btn.setAttribute('role', 'tab')
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false')
        btn.setAttribute('aria-label', `${status.label} (${shortcut})`)
        btn.setAttribute('title', `${status.label} (${shortcut})`)
        btn.setAttribute('tabindex', isActive ? '0' : '-1')

        const iconSpan = document.createElement('span')
        iconSpan.className = 'gtd-tab-icon'
        iconSpan.innerHTML = getIcon(status.id, { size: 20 })
        btn.appendChild(iconSpan)

        if (count > 0) {
            const badge = document.createElement('span')
            badge.className = 'gtd-tab-badge'
            badge.textContent = count > 99 ? '99+' : count
            btn.appendChild(badge)
        }

        btn.addEventListener('click', () => selectGtdStatus(status.id))

        // Drop target for assigning GTD status (except 'all' and 'scheduled')
        if (status.id !== 'all' && !status.isVirtual) {
            btn.addEventListener('dragover', (e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                btn.classList.add('drag-over')
            })
            btn.addEventListener('dragleave', () => {
                btn.classList.remove('drag-over')
            })
            btn.addEventListener('drop', (e) => {
                e.preventDefault()
                btn.classList.remove('drag-over')
                const todoId = e.dataTransfer.getData('text/plain')
                if (todoId) {
                    updateTodoGtdStatus(todoId, status.id)
                }
            })
        }

        container.appendChild(btn)
    })

    // Arrow key navigation for tablist pattern (attach once)
    if (!container.dataset.keynavAttached) {
        container.dataset.keynavAttached = 'true'
        container.addEventListener('keydown', (e) => {
            const tabs = Array.from(container.querySelectorAll('[role="tab"]'))
            const currentIndex = tabs.indexOf(document.activeElement)
            if (currentIndex === -1) return

            let nextIndex
            if (e.key === 'ArrowRight') {
                nextIndex = (currentIndex + 1) % tabs.length
            } else if (e.key === 'ArrowLeft') {
                nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
            } else if (e.key === 'Home') {
                nextIndex = 0
            } else if (e.key === 'End') {
                nextIndex = tabs.length - 1
            } else {
                return
            }

            e.preventDefault()
            tabs[nextIndex].focus()
        })
    }
}

/**
 * Update the GTD status header in the content area
 * @param {HTMLElement} headerElement - The #gtdStatusHeader element
 */
export function updateGtdStatusHeader(headerElement) {
    const status = store.state.selectedGtdStatus
    const statusInfo = GTD_STATUSES.find(s => s.id === status)
    if (!statusInfo) return

    const iconSpan = headerElement.querySelector('.gtd-status-header-icon')
    const nameSpan = headerElement.querySelector('.gtd-status-header-name')

    iconSpan.innerHTML = getIcon(status, { size: 20 })
    nameSpan.textContent = statusInfo.label
    headerElement.className = `gtd-status-header ${status}`
}
