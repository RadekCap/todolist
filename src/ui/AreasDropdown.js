import { store } from '../core/store.js'
import { escapeHtml } from '../utils/security.js'
import { selectArea, reorderAreas, renameArea, deleteArea, loadAreas } from '../services/areas.js'
import { loadProjects } from '../services/projects.js'

/**
 * Render the areas dropdown menu
 * @param {HTMLElement} listContainer - Container for area list items
 * @param {HTMLElement} dropdown - The dropdown element
 * @param {HTMLElement} divider - The divider element (shown when areas exist)
 */
export function renderAreasDropdown(listContainer, dropdown, divider) {
    const state = store.state
    listContainer.innerHTML = ''

    // Hide divider if no areas
    if (divider) {
        divider.style.display = state.areas.length > 0 ? 'block' : 'none'
    }

    state.areas.forEach((area, index) => {
        const button = document.createElement('button')
        const isActive = state.selectedAreaId === area.id
        button.className = `toolbar-dropdown-item toolbar-areas-item ${isActive ? 'active' : ''}`
        button.setAttribute('role', 'menuitem')
        button.dataset.areaId = area.id
        // Add keyboard shortcut hint (shift+1-9) for the first 9 areas
        const shortcutHint = index < 9 ? `<span class="areas-item-shortcut">\u21e7${index + 1}</span>` : ''
        button.innerHTML = `
            <span class="areas-item-icon">\ud83d\udcc2</span>
            <span class="areas-item-label">${escapeHtml(area.name)}</span>
            ${shortcutHint}
        `
        listContainer.appendChild(button)
    })

    // Update active state for All and Unassigned buttons
    const allBtn = dropdown.querySelector('[data-area-id="all"]')
    const unassignedBtn = dropdown.querySelector('[data-area-id="unassigned"]')

    if (allBtn) allBtn.classList.toggle('active', state.selectedAreaId === 'all')
    if (unassignedBtn) unassignedBtn.classList.toggle('active', state.selectedAreaId === 'unassigned')
}

/**
 * Update the areas label in the toolbar
 * @param {HTMLElement} labelElement - The label element
 */
export function updateAreasLabel(labelElement) {
    const state = store.state

    if (state.selectedAreaId === 'all') {
        labelElement.textContent = 'All Areas'
    } else if (state.selectedAreaId === 'unassigned') {
        labelElement.textContent = 'Unassigned'
    } else {
        const area = state.areas.find(a => a.id === state.selectedAreaId)
        labelElement.textContent = area ? area.name : 'All Areas'
    }
}

/**
 * Render the manage areas list in the modal
 * @param {HTMLElement} container - Container element
 */
export function renderManageAreasList(container) {
    const areas = store.get('areas')
    container.innerHTML = ''

    areas.forEach(area => {
        const li = document.createElement('li')
        li.className = 'manage-areas-item'
        li.dataset.areaId = area.id
        li.draggable = true
        li.innerHTML = `
            <span class="manage-areas-drag-handle">\u22ee\u22ee</span>
            <span class="manage-areas-name">${escapeHtml(area.name)}</span>
            <div class="manage-areas-actions">
                <button class="manage-areas-edit" data-id="${area.id}" title="Rename">\u270e</button>
                <button class="manage-areas-delete" data-id="${area.id}" title="Delete">\u00d7</button>
            </div>
        `

        // Drag events for reordering
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', area.id)
            li.classList.add('dragging')
        })
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging')
            container.querySelectorAll('.manage-areas-item').forEach(item => {
                item.classList.remove('drag-over')
            })
        })
        li.addEventListener('dragover', (e) => {
            e.preventDefault()
            const dragging = container.querySelector('.dragging')
            if (dragging && dragging !== li) {
                li.classList.add('drag-over')
            }
        })
        li.addEventListener('dragleave', () => {
            li.classList.remove('drag-over')
        })
        li.addEventListener('drop', async (e) => {
            e.preventDefault()
            li.classList.remove('drag-over')
            const dragging = container.querySelector('.dragging')
            if (dragging && dragging !== li) {
                const rect = li.getBoundingClientRect()
                const midY = rect.top + rect.height / 2
                if (e.clientY < midY) {
                    li.before(dragging)
                } else {
                    li.after(dragging)
                }
                const orderedIds = [...container.querySelectorAll('.manage-areas-item')]
                    .map(item => item.dataset.areaId)
                await reorderAreas(orderedIds)
            }
        })

        // Edit button
        li.querySelector('.manage-areas-edit').addEventListener('click', (e) => {
            e.stopPropagation()
            startEditingArea(area.id, container)
        })

        // Delete button
        li.querySelector('.manage-areas-delete').addEventListener('click', async (e) => {
            e.stopPropagation()
            if (confirm(`Delete "${area.name}"? Projects in this area will become unassigned.`)) {
                await deleteArea(area.id)
                await loadProjects()  // Reload to get updated area assignments
                renderManageAreasList(container)
            }
        })

        container.appendChild(li)
    })
}

/**
 * Start editing an area name inline
 * @param {string} areaId - Area ID
 * @param {HTMLElement} container - Container element
 */
function startEditingArea(areaId, container) {
    const li = container.querySelector(`[data-area-id="${areaId}"]`)
    if (!li) return

    const areas = store.get('areas')
    const area = areas.find(a => a.id === areaId)
    if (!area) return

    const nameSpan = li.querySelector('.manage-areas-name')
    const currentName = area.name

    // Replace name with input
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'manage-areas-name-input'
    input.value = currentName
    input.maxLength = 50

    nameSpan.replaceWith(input)
    input.focus()
    input.select()

    const saveEdit = async () => {
        const newName = input.value.trim()
        if (newName && newName !== currentName) {
            await renameArea(areaId, newName)
            renderManageAreasList(container)
        } else {
            // Restore original name
            const newSpan = document.createElement('span')
            newSpan.className = 'manage-areas-name'
            newSpan.textContent = currentName
            input.replaceWith(newSpan)
        }
    }

    input.addEventListener('blur', saveEdit)
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            input.blur()
        }
    })
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            const newSpan = document.createElement('span')
            newSpan.className = 'manage-areas-name'
            newSpan.textContent = currentName
            input.replaceWith(newSpan)
        }
    })
}
