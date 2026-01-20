import { store } from '../core/store.js'
import { escapeHtml, validateColor } from '../utils/security.js'
import { getFilteredProjects, selectProject, deleteProject } from '../services/projects.js'
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
