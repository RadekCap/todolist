import { store } from '../core/store.js'
import { escapeHtml, validateColor } from '../utils/security.js'
import {
    bulkDeleteTodos,
    bulkUpdateTodosStatus,
    bulkUpdateTodosProject,
    bulkUpdateTodosPriority,
    selectAllTodos,
    clearTodoSelection,
    getFilteredTodos
} from '../services/todos.js'

/**
 * Get human-readable label for a GTD status
 * @param {string} status - GTD status
 * @returns {string} Human-readable label
 */
function getGtdStatusLabel(status) {
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
 * Initialize the selection bar with event listeners
 * @param {Object} elements - DOM elements for the selection bar
 */
export function initSelectionBar(elements) {
    const {
        selectionBar,
        selectionCount,
        selectAllBtn,
        clearSelectionBtn,
        deleteSelectedBtn,
        completeSelectedBtn,
        gtdStatusSelect,
        projectSelect,
        prioritySelect
    } = elements

    // Select All button
    selectAllBtn.addEventListener('click', () => {
        const filteredTodos = getFilteredTodos()
        const visibleIds = filteredTodos.map(t => t.id)
        selectAllTodos(visibleIds)
    })

    // Clear Selection button
    clearSelectionBtn.addEventListener('click', () => {
        clearTodoSelection()
    })

    // Delete Selected button
    deleteSelectedBtn.addEventListener('click', async () => {
        const selectedIds = Array.from(store.get('selectedTodoIds'))
        if (selectedIds.length === 0) return

        const confirmed = confirm(`Delete ${selectedIds.length} selected item(s)?`)
        if (!confirmed) return

        deleteSelectedBtn.disabled = true
        deleteSelectedBtn.textContent = 'Deleting...'

        try {
            await bulkDeleteTodos(selectedIds)
        } catch (error) {
            console.error('Error deleting selected todos:', error)
            alert('Failed to delete some items')
        } finally {
            deleteSelectedBtn.disabled = false
            deleteSelectedBtn.textContent = 'Delete'
        }
    })

    // Complete Selected button
    completeSelectedBtn.addEventListener('click', async () => {
        const selectedIds = Array.from(store.get('selectedTodoIds'))
        if (selectedIds.length === 0) return

        completeSelectedBtn.disabled = true
        completeSelectedBtn.textContent = 'Completing...'

        try {
            await bulkUpdateTodosStatus(selectedIds, 'done')
        } catch (error) {
            console.error('Error completing selected todos:', error)
            alert('Failed to complete some items')
        } finally {
            completeSelectedBtn.disabled = false
            completeSelectedBtn.textContent = 'Complete'
        }
    })

    // GTD Status select
    gtdStatusSelect.addEventListener('change', async () => {
        const newStatus = gtdStatusSelect.value
        if (!newStatus) return

        const selectedIds = Array.from(store.get('selectedTodoIds'))
        if (selectedIds.length === 0) return

        try {
            await bulkUpdateTodosStatus(selectedIds, newStatus)
        } catch (error) {
            console.error('Error updating status:', error)
            alert('Failed to update status')
        }

        gtdStatusSelect.value = ''
    })

    // Project select
    projectSelect.addEventListener('change', async () => {
        const newProjectId = projectSelect.value
        const selectedIds = Array.from(store.get('selectedTodoIds'))
        if (selectedIds.length === 0) return

        try {
            await bulkUpdateTodosProject(selectedIds, newProjectId || null)
        } catch (error) {
            console.error('Error updating project:', error)
            alert('Failed to update project')
        }

        projectSelect.value = ''
    })

    // Priority select
    prioritySelect.addEventListener('change', async () => {
        const newPriorityId = prioritySelect.value
        const selectedIds = Array.from(store.get('selectedTodoIds'))
        if (selectedIds.length === 0) return

        try {
            await bulkUpdateTodosPriority(selectedIds, newPriorityId || null)
        } catch (error) {
            console.error('Error updating priority:', error)
            alert('Failed to update priority')
        }

        prioritySelect.value = ''
    })

    // Subscribe to selection changes
    store.subscribe('selectedTodoIds', (selectedIds) => {
        updateSelectionBar(elements, selectedIds)
    })

    // Initial state
    updateSelectionBar(elements, store.get('selectedTodoIds'))
}

/**
 * Update the selection bar visibility and content
 * @param {Object} elements - DOM elements
 * @param {Set} selectedIds - Currently selected todo IDs
 */
function updateSelectionBar(elements, selectedIds) {
    const { selectionBar, selectionCount } = elements
    const count = selectedIds ? selectedIds.size : 0

    if (count > 0) {
        selectionBar.classList.add('visible')
        selectionCount.textContent = `${count} selected`
    } else {
        selectionBar.classList.remove('visible')
    }
}

/**
 * Update the project select dropdown in selection bar
 * @param {HTMLSelectElement} selectElement - The project select element
 */
export function updateSelectionBarProjectSelect(selectElement) {
    const projects = store.get('projects') || []

    // Keep the first option (placeholder)
    selectElement.innerHTML = '<option value="">Move to Project...</option>'

    // Add "No Project" option
    const noProjectOption = document.createElement('option')
    noProjectOption.value = ''
    noProjectOption.textContent = 'No Project'
    selectElement.appendChild(noProjectOption)

    // Add project options
    projects.forEach(project => {
        const option = document.createElement('option')
        option.value = project.id
        option.textContent = project.name
        selectElement.appendChild(option)
    })
}

/**
 * Update the priority select dropdown in selection bar
 * @param {HTMLSelectElement} selectElement - The priority select element
 */
export function updateSelectionBarPrioritySelect(selectElement) {
    const priorities = store.get('priorities') || []

    // Keep the first option (placeholder)
    selectElement.innerHTML = '<option value="">Set Priority...</option>'

    // Add "No Priority" option
    const noPriorityOption = document.createElement('option')
    noPriorityOption.value = ''
    noPriorityOption.textContent = 'No Priority'
    selectElement.appendChild(noPriorityOption)

    // Add priority options
    priorities.forEach(priority => {
        const option = document.createElement('option')
        option.value = priority.id
        option.textContent = priority.name
        selectElement.appendChild(option)
    })
}
