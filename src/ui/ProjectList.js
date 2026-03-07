import { store } from '../core/store.js'
import { escapeHtml, validateColor } from '../utils/security.js'
import { getFilteredProjects, selectProject, deleteProject, addProject, updateProject, reorderProjects, getDescendantIds } from '../services/projects.js'
import { getProjectTodoCount, updateTodoProject } from '../services/todos.js'
import { getIcon } from '../utils/icons.js'

/**
 * Count ALL todos (including done) in a project and its descendants
 */
function getAllProjectTodoCount(projectId) {
    const todos = store.get('todos')
    const ids = new Set([projectId, ...getDescendantIds(projectId)])
    return todos.filter(t => ids.has(t.project_id)).length
}

/**
 * Count non-closed todos in a project and its descendants
 */
function getNonClosedProjectTodoCount(projectId) {
    const todos = store.get('todos')
    const ids = new Set([projectId, ...getDescendantIds(projectId)])
    return todos.filter(t => ids.has(t.project_id) && t.gtd_status !== 'done').length
}

/**
 * Build project select options excluding a project and its descendants
 */
function buildProjectOptions(excludeProjectId) {
    const projects = store.get('projects')
    const excludeIds = new Set([excludeProjectId, ...getDescendantIds(excludeProjectId)])
    const available = projects.filter(p => !excludeIds.has(p.id))

    if (available.length === 0) return ''

    return available
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
        .join('')
}

/**
 * Show a delete project dialog with options when project has todos.
 * Returns a promise that resolves to { confirmed, deleteTodos, moveToProjectId }.
 */
function showDeleteProjectDialog(projectName, todoCount, descendantCount, projectId) {
    return new Promise(resolve => {
        const noResult = { confirmed: false, deleteTodos: false, moveToProjectId: null }

        // No todos — use simple confirm
        if (todoCount === 0) {
            const msg = descendantCount > 0
                ? `Delete "${projectName}" and its ${descendantCount} subproject(s)?`
                : `Delete "${projectName}"?`
            resolve({ confirmed: confirm(msg), deleteTodos: false, moveToProjectId: null })
            return
        }

        const overlay = document.createElement('div')
        overlay.className = 'delete-project-dialog-overlay'

        const projectLabel = descendantCount > 0
            ? `"${escapeHtml(projectName)}" and its ${descendantCount} subproject(s)`
            : `"${escapeHtml(projectName)}"`

        const nonClosedCount = getNonClosedProjectTodoCount(projectId)
        const projectOptions = buildProjectOptions(projectId)
        const showMoveOption = nonClosedCount > 0 && projectOptions

        overlay.innerHTML = `
            <div class="delete-project-dialog" role="dialog" aria-modal="true" aria-label="Delete project">
                <div class="delete-project-dialog-title">Delete ${projectLabel}</div>
                <p class="delete-project-dialog-text">This project has <strong>${todoCount}</strong> task${todoCount !== 1 ? 's' : ''}. What would you like to do with them?</p>
                <div class="delete-project-dialog-actions">
                    <button class="delete-project-dialog-btn delete-project-dialog-btn-keep" data-action="keep">
                        ${getIcon('x', { size: 16 })}
                        Remove from project
                        <span class="delete-project-dialog-btn-desc">Tasks will become projectless</span>
                    </button>
                    ${showMoveOption ? `
                    <div class="delete-project-dialog-btn delete-project-dialog-btn-move">
                        ${getIcon('folder', { size: 16 })}
                        Move to another project
                        <span class="delete-project-dialog-btn-desc">${nonClosedCount} non-closed task${nonClosedCount !== 1 ? 's' : ''} will be moved</span>
                        <div class="delete-project-dialog-move-select">
                            <select class="delete-project-dialog-select" aria-label="Target project">
                                ${projectOptions}
                            </select>
                            <button class="delete-project-dialog-move-confirm" data-action="move-confirm">Move & Delete</button>
                        </div>
                    </div>
                    ` : ''}
                    <button class="delete-project-dialog-btn delete-project-dialog-btn-delete" data-action="delete">
                        ${getIcon('trash', { size: 16 })}
                        Delete tasks
                        <span class="delete-project-dialog-btn-desc">Tasks will be permanently deleted</span>
                    </button>
                </div>
                <button class="delete-project-dialog-cancel" data-action="cancel">Cancel</button>
            </div>
        `

        const cleanup = (result) => {
            overlay.remove()
            document.removeEventListener('keydown', onKey)
            resolve(result)
        }

        const onKey = (e) => {
            if (e.key === 'Escape') cleanup(noResult)
        }
        document.addEventListener('keydown', onKey)

        overlay.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action
            if (action === 'keep') cleanup({ confirmed: true, deleteTodos: false, moveToProjectId: null })
            else if (action === 'move-confirm') {
                const select = overlay.querySelector('.delete-project-dialog-select')
                cleanup({ confirmed: true, deleteTodos: false, moveToProjectId: select.value })
            }
            else if (action === 'delete') cleanup({ confirmed: true, deleteTodos: true, moveToProjectId: null })
            else if (action === 'cancel' || e.target === overlay) cleanup(noResult)
        })

        document.body.appendChild(overlay)
    })
}

// Track collapsed state for project tree nodes (not persisted)
const collapsedProjects = new Set()

/**
 * Render the project list in the sidebar as a tree
 * @param {HTMLElement} container - Container element
 */
export function renderProjects(container) {
    const state = store.state
    container.innerHTML = ''

    const filteredProjects = getFilteredProjects()

    // Add "All Projects" option
    const allItem = document.createElement('li')
    allItem.className = `project-item ${state.selectedProjectId === null ? 'active' : ''}`
    const totalCount = state.todos.filter(t => t.gtd_status !== 'done').length
    const totalCountDisplay = totalCount > 0 ? totalCount : ''
    allItem.innerHTML = `
        <span class="project-name">All Projects</span>
        <span class="project-count">${totalCountDisplay}</span>
    `
    allItem.addEventListener('click', () => selectProject(null))

    // Drop target for removing project
    allItem.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        allItem.classList.add('drag-over')
    })
    allItem.addEventListener('dragleave', () => {
        allItem.classList.remove('drag-over')
    })
    allItem.addEventListener('drop', (e) => {
        e.preventDefault()
        allItem.classList.remove('drag-over')
        const todoId = e.dataTransfer.getData('text/plain')
        if (todoId) {
            updateTodoProject(todoId, null)
        }
    })
    container.appendChild(allItem)

    // Render project tree recursively
    renderProjectTree(container, filteredProjects, null, 0)
}

/**
 * Recursively render project tree nodes
 * @param {HTMLElement} container - Container element
 * @param {Array} projects - All projects (flat, filtered by area)
 * @param {string|null} parentId - Parent project ID (null for roots)
 * @param {number} depth - Current depth level
 */
function renderProjectTree(container, projects, parentId, depth) {
    const state = store.state
    const children = projects
        .filter(p => (p.parent_id || null) === parentId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    children.forEach(project => {
        const li = document.createElement('li')
        li.className = `project-item ${state.selectedProjectId === project.id ? 'active' : ''}`
        li.style.paddingLeft = `${12 + depth * 20}px`
        li.dataset.projectId = project.id
        li.dataset.depth = depth

        const count = getProjectTodoCount(project.id)
        const countDisplay = count > 0 ? count : ''

        const hasChildren = projects.some(p => p.parent_id === project.id)
        const isCollapsed = collapsedProjects.has(project.id)

        let expandHtml
        if (hasChildren) {
            const chevronClass = isCollapsed ? 'collapsed' : ''
            expandHtml = `<span class="project-expand ${chevronClass}">${getIcon('chevron-down', { size: 12 })}</span>`
        } else {
            expandHtml = '<span class="project-expand-spacer"></span>'
        }

        li.innerHTML = `
            ${expandHtml}
            <span class="project-name">
                <span class="project-color" style="background-color: ${validateColor(project.color)}"></span>
                ${escapeHtml(project.name)}
            </span>
            <span class="project-count">${countDisplay}</span>
            <button class="project-delete" data-id="${project.id}">${getIcon('x', { size: 12 })}</button>
        `

        // Expand/collapse toggle
        if (hasChildren) {
            const expandBtn = li.querySelector('.project-expand')
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                if (collapsedProjects.has(project.id)) {
                    collapsedProjects.delete(project.id)
                } else {
                    collapsedProjects.add(project.id)
                }
                renderProjects(container)
            })
        }

        // Click to select project
        li.addEventListener('click', (e) => {
            if (!e.target.closest('.project-delete') && !e.target.closest('.project-expand')) {
                selectProject(project.id)
            }
        })

        // Right-click context menu
        li.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            showProjectContextMenu(e, project, depth, container)
        })

        // Drop target for assigning project
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
                updateTodoProject(todoId, project.id)
            }
        })

        // Delete button
        const deleteBtn = li.querySelector('.project-delete')
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation()
            const descendantCount = getDescendantIds(project.id).length
            const todoCount = getAllProjectTodoCount(project.id)
            const { confirmed, deleteTodos, moveToProjectId } = await showDeleteProjectDialog(project.name, todoCount, descendantCount, project.id)
            if (confirmed) {
                await deleteProject(project.id, { deleteTodos, moveToProjectId })
            }
        })

        container.appendChild(li)

        // Render children recursively (if not collapsed)
        if (hasChildren && !isCollapsed) {
            renderProjectTree(container, projects, project.id, depth + 1)
        }
    })
}

/**
 * Show context menu for a project
 * @param {MouseEvent} event - Right-click event
 * @param {Object} project - Project object
 * @param {number} depth - Current depth level
 * @param {HTMLElement} projectContainer - The project list container for re-rendering
 */
function showProjectContextMenu(event, project, depth, projectContainer) {
    // Remove any existing context menu
    document.querySelector('.project-context-menu')?.remove()

    const menu = document.createElement('div')
    menu.className = 'project-context-menu'
    menu.setAttribute('role', 'menu')

    // "Add subproject" option (only if depth < 2, max 3 levels)
    if (depth < 2) {
        const addSubItem = document.createElement('div')
        addSubItem.className = 'context-menu-item'
        addSubItem.setAttribute('role', 'menuitem')
        addSubItem.innerHTML = `${getIcon('plus', { size: 14 })} Add subproject`
        addSubItem.addEventListener('click', async () => {
            menu.remove()
            const name = prompt('Subproject name:')
            if (name && name.trim()) {
                try {
                    await addProject(name.trim(), project.id)
                    // Ensure parent is expanded
                    collapsedProjects.delete(project.id)
                } catch (err) {
                    alert(err.message)
                }
            }
        })
        menu.appendChild(addSubItem)
    }

    // "Delete" option
    const deleteItem = document.createElement('div')
    deleteItem.className = 'context-menu-item context-menu-item-danger'
    deleteItem.setAttribute('role', 'menuitem')
    const descendantCount = getDescendantIds(project.id).length
    deleteItem.innerHTML = `${getIcon('x', { size: 14 })} Delete project`
    deleteItem.addEventListener('click', async () => {
        menu.remove()
        const todoCount = getAllProjectTodoCount(project.id)
        const { confirmed, deleteTodos, moveToProjectId } = await showDeleteProjectDialog(project.name, todoCount, descendantCount, project.id)
        if (confirmed) {
            await deleteProject(project.id, { deleteTodos, moveToProjectId })
        }
    })
    menu.appendChild(deleteItem)

    // Position menu at cursor, clamped to viewport
    menu.style.left = `${event.clientX}px`
    menu.style.top = `${event.clientY}px`
    document.body.appendChild(menu)

    // Adjust position if menu overflows viewport
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect()
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 8}px`
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 8}px`
        }
    })

    // Close on click outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove()
            document.removeEventListener('click', closeMenu)
            document.removeEventListener('contextmenu', closeMenu)
        }
    }
    setTimeout(() => {
        document.addEventListener('click', closeMenu)
        document.addEventListener('contextmenu', closeMenu)
    }, 0)
}

/**
 * Update a project select dropdown with hierarchical options
 * @param {HTMLSelectElement} selectElement - Select element
 */
export function updateProjectSelect(selectElement) {
    const projects = store.get('projects')
    selectElement.innerHTML = ''

    const emptyOption = document.createElement('option')
    emptyOption.value = ''
    emptyOption.textContent = 'No Project'
    selectElement.appendChild(emptyOption)

    addHierarchicalOptions(selectElement, projects, null, 0)
}

/**
 * Add hierarchical options to a select element
 * @param {HTMLSelectElement} selectElement - Select element
 * @param {Array} projects - All projects
 * @param {string|null} parentId - Parent ID filter
 * @param {number} depth - Indentation depth
 */
function addHierarchicalOptions(selectElement, projects, parentId, depth) {
    const children = projects
        .filter(p => (p.parent_id || null) === parentId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    children.forEach(project => {
        const option = document.createElement('option')
        option.value = project.id
        option.textContent = '\u00A0\u00A0'.repeat(depth) + project.name
        selectElement.appendChild(option)
        addHierarchicalOptions(selectElement, projects, project.id, depth + 1)
    })
}

/**
 * Render the manage projects list in the modal
 * @param {HTMLElement} container - Container element
 */
export function renderManageProjectsList(container) {
    const projects = store.get('projects')
    const areas = store.get('areas')
    container.innerHTML = ''

    renderManageProjectsTree(container, projects, areas, null, 0)
}

/**
 * Recursively render manage projects tree
 * @param {HTMLElement} container - Container element
 * @param {Array} projects - All projects
 * @param {Array} areas - All areas
 * @param {string|null} parentId - Parent project ID
 * @param {number} depth - Current depth level
 */
function renderManageProjectsTree(container, projects, areas, parentId, depth) {
    const children = projects
        .filter(p => (p.parent_id || null) === parentId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    children.forEach(project => {
        const li = document.createElement('li')
        li.className = 'manage-projects-item'
        li.dataset.projectId = project.id
        li.dataset.parentId = parentId || ''
        li.dataset.depth = depth
        li.draggable = true
        li.style.paddingLeft = `${12 + depth * 24}px`
        const projectColor = project.color || '#667eea'
        const descriptionHtml = project.description
            ? `<span class="manage-projects-description">${escapeHtml(project.description)}</span>`
            : `<span class="manage-projects-description" style="font-style: italic; opacity: 0.6;">No description</span>`

        // Build area options
        let areaOptions = '<option value="">No Area</option>'
        areas.forEach(area => {
            const selected = project.area_id === area.id ? 'selected' : ''
            areaOptions += `<option value="${area.id}" ${selected}>${escapeHtml(area.name)}</option>`
        })

        li.innerHTML = `
            <span class="manage-projects-drag-handle">${getIcon('drag-handle', { size: 16 })}</span>
            <input type="color" class="manage-projects-color" value="${validateColor(projectColor)}" title="Change color">
            <div class="manage-projects-details">
                <span class="manage-projects-name">${escapeHtml(project.name)}</span>
                ${descriptionHtml}
            </div>
            <select class="manage-projects-area" title="Assign to area">${areaOptions}</select>
            <div class="manage-projects-actions">
                <button class="manage-projects-edit" data-id="${project.id}" title="Edit">${getIcon('edit', { size: 14 })}</button>
                <button class="manage-projects-delete" data-id="${project.id}" title="Delete">${getIcon('x', { size: 14 })}</button>
            </div>
        `

        // Drag events for reordering (scoped to siblings)
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', project.id)
            e.dataTransfer.setData('application/x-parent-id', parentId || '')
            li.classList.add('dragging')
        })
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging')
            container.querySelectorAll('.manage-projects-item').forEach(item => {
                item.classList.remove('drag-over')
            })
        })
        li.addEventListener('dragover', (e) => {
            e.preventDefault()
            const dragging = container.querySelector('.dragging')
            if (dragging && dragging !== li) {
                // Only allow reordering among siblings
                const dragParentId = dragging.dataset.parentId
                if (dragParentId === li.dataset.parentId) {
                    li.classList.add('drag-over')
                }
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
                // Only reorder among siblings
                const dragParentId = dragging.dataset.parentId
                if (dragParentId !== li.dataset.parentId) return

                const rect = li.getBoundingClientRect()
                const midY = rect.top + rect.height / 2
                if (e.clientY < midY) {
                    li.before(dragging)
                } else {
                    li.after(dragging)
                }
                // Collect sibling IDs in new order
                const siblingParentId = dragParentId || ''
                const orderedIds = [...container.querySelectorAll(`.manage-projects-item[data-parent-id="${siblingParentId}"]`)]
                    .map(item => item.dataset.projectId)
                await reorderProjects(orderedIds)
            }
        })

        // Color picker change
        li.querySelector('.manage-projects-color').addEventListener('change', async (e) => {
            e.stopPropagation()
            await updateProject(project.id, { color: e.target.value })
        })

        // Prevent drag when interacting with color picker
        li.querySelector('.manage-projects-color').addEventListener('mousedown', (e) => {
            e.stopPropagation()
            li.draggable = false
        })
        li.querySelector('.manage-projects-color').addEventListener('mouseup', () => {
            li.draggable = true
        })

        // Area dropdown change
        li.querySelector('.manage-projects-area').addEventListener('change', async (e) => {
            e.stopPropagation()
            const newAreaId = e.target.value || null
            await updateProject(project.id, { area_id: newAreaId })
        })

        // Prevent drag when interacting with area dropdown
        li.querySelector('.manage-projects-area').addEventListener('mousedown', (e) => {
            e.stopPropagation()
            li.draggable = false
        })
        li.querySelector('.manage-projects-area').addEventListener('mouseup', () => {
            li.draggable = true
        })

        // Edit button
        li.querySelector('.manage-projects-edit').addEventListener('click', (e) => {
            e.stopPropagation()
            startEditingProject(project.id, container)
        })

        // Delete button
        li.querySelector('.manage-projects-delete').addEventListener('click', async (e) => {
            e.stopPropagation()
            const descendantCount = getDescendantIds(project.id).length
            const todoCount = getAllProjectTodoCount(project.id)
            const { confirmed, deleteTodos, moveToProjectId } = await showDeleteProjectDialog(project.name, todoCount, descendantCount, project.id)
            if (confirmed) {
                await deleteProject(project.id, { deleteTodos, moveToProjectId })
                renderManageProjectsList(container)
            }
        })

        container.appendChild(li)

        // Render children recursively
        renderManageProjectsTree(container, projects, areas, project.id, depth + 1)
    })
}

/**
 * Start editing a project name and description inline
 * @param {string} projectId - Project ID
 * @param {HTMLElement} container - Container element
 */
function startEditingProject(projectId, container) {
    const li = container.querySelector(`[data-project-id="${projectId}"]`)
    if (!li) return

    const projects = store.get('projects')
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const detailsDiv = li.querySelector('.manage-projects-details')
    const currentName = project.name
    const currentDescription = project.description || ''

    // Create edit form
    const editContainer = document.createElement('div')
    editContainer.className = 'manage-projects-details'
    editContainer.innerHTML = `
        <input type="text" class="manage-projects-name-input" value="${escapeHtml(currentName)}" maxlength="100" placeholder="Project name">
        <input type="text" class="manage-projects-description-input" value="${escapeHtml(currentDescription)}" maxlength="500" placeholder="Description (optional)">
    `

    detailsDiv.replaceWith(editContainer)
    const nameInput = editContainer.querySelector('.manage-projects-name-input')
    const descInput = editContainer.querySelector('.manage-projects-description-input')
    nameInput.focus()
    nameInput.select()

    const saveEdit = async () => {
        const newName = nameInput.value.trim()
        const newDescription = descInput.value.trim()

        if (newName && (newName !== currentName || newDescription !== currentDescription)) {
            await updateProject(projectId, {
                name: newName,
                description: newDescription || null
            })
        }
        renderManageProjectsList(container)
    }

    const cancelEdit = () => {
        renderManageProjectsList(container)
    }

    // Save on blur (with delay to allow clicking between inputs)
    let blurTimeout
    const handleBlur = () => {
        blurTimeout = setTimeout(() => {
            if (!editContainer.contains(document.activeElement)) {
                saveEdit()
            }
        }, 100)
    }

    nameInput.addEventListener('blur', handleBlur)
    descInput.addEventListener('blur', handleBlur)

    nameInput.addEventListener('focus', () => clearTimeout(blurTimeout))
    descInput.addEventListener('focus', () => clearTimeout(blurTimeout))

    // Handle keyboard events
    const handleKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            saveEdit()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            cancelEdit()
        }
    }

    nameInput.addEventListener('keydown', handleKeydown)
    descInput.addEventListener('keydown', handleKeydown)
}
