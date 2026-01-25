import { store } from '../core/store.js'
import { escapeHtml, validateColor } from '../utils/security.js'
import { getFilteredProjects, selectProject, deleteProject, updateProject, reorderProjects } from '../services/projects.js'
import { getProjectTodoCount, updateTodoProject } from '../services/todos.js'

/**
 * Render the project list in the sidebar
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

    // Add user projects (filtered by area)
    filteredProjects.forEach(project => {
        const li = document.createElement('li')
        li.className = `project-item ${state.selectedProjectId === project.id ? 'active' : ''}`
        const count = getProjectTodoCount(project.id)
        const countDisplay = count > 0 ? count : ''
        li.innerHTML = `
            <span class="project-name">
                <span class="project-color" style="background-color: ${validateColor(project.color)}"></span>
                ${escapeHtml(project.name)}
            </span>
            <span class="project-count">${countDisplay}</span>
            <button class="project-delete" data-id="${project.id}">\u00d7</button>
        `

        li.addEventListener('click', (e) => {
            if (!e.target.classList.contains('project-delete')) {
                selectProject(project.id)
            }
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

        const deleteBtn = li.querySelector('.project-delete')
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation()
            if (confirm('Delete this project? Todos in this project will become projectless.')) {
                await deleteProject(project.id)
            }
        })

        container.appendChild(li)
    })
}

/**
 * Update the project select dropdown
 * @param {HTMLSelectElement} selectElement - Select element
 */
export function updateProjectSelect(selectElement) {
    const projects = store.get('projects')
    selectElement.innerHTML = '<option value="">No Project</option>'

    projects.forEach(project => {
        const option = document.createElement('option')
        option.value = project.id
        option.textContent = project.name
        selectElement.appendChild(option)
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

    projects.forEach(project => {
        const li = document.createElement('li')
        li.className = 'manage-projects-item'
        li.dataset.projectId = project.id
        li.draggable = true
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
            <span class="manage-projects-drag-handle">\u22ee\u22ee</span>
            <input type="color" class="manage-projects-color" value="${validateColor(projectColor)}" title="Change color">
            <div class="manage-projects-details">
                <span class="manage-projects-name">${escapeHtml(project.name)}</span>
                ${descriptionHtml}
            </div>
            <select class="manage-projects-area" title="Assign to area">${areaOptions}</select>
            <div class="manage-projects-actions">
                <button class="manage-projects-edit" data-id="${project.id}" title="Edit">\u270e</button>
                <button class="manage-projects-delete" data-id="${project.id}" title="Delete">\u00d7</button>
            </div>
        `

        // Drag events for reordering
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', project.id)
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
                const orderedIds = [...container.querySelectorAll('.manage-projects-item')]
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
            if (confirm(`Delete "${project.name}"? Todos in this project will become projectless.`)) {
                await deleteProject(project.id)
                renderManageProjectsList(container)
            }
        })

        container.appendChild(li)
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
