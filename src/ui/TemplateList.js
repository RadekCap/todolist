import { store } from '../core/store.js'
import { escapeHtml } from '../utils/security.js'
import {
    addProjectTemplate, addTemplateItem, deleteTemplateItem,
    deleteProjectTemplate, renameProjectTemplate, createProjectFromTemplate,
    reorderTemplateItems
} from '../services/project-templates.js'
import { getIcon } from '../utils/icons.js'
import { showToast } from './Toast.js'

/**
 * Render the templates list inside the manage templates modal.
 * @param {HTMLElement} container - The #templatesList element
 */
export function renderTemplatesList(container) {
    const templates = store.get('projectTemplates') || []
    container.innerHTML = ''

    if (templates.length === 0) {
        container.innerHTML = '<li class="manage-templates-empty">No templates yet. Create one above.</li>'
        return
    }

    templates.forEach(template => {
        const li = document.createElement('li')
        li.className = 'manage-templates-item'
        li.dataset.templateId = template.id

        const itemsHtml = template.items.map(item => `
            <li class="manage-templates-todo" data-item-id="${item.id}" draggable="true">
                <span class="manage-templates-todo-drag-handle">${getIcon('drag-handle', { size: 14 })}</span>
                <span class="manage-templates-todo-text">${escapeHtml(item.text)}</span>
                <button class="manage-templates-todo-delete" data-item-id="${item.id}" title="Remove item">&times;</button>
            </li>
        `).join('')

        li.innerHTML = `
            <div class="manage-templates-header">
                <span class="manage-templates-name">${escapeHtml(template.name)}</span>
                <span class="manage-templates-count">${template.items.length} item${template.items.length !== 1 ? 's' : ''}</span>
                <div class="manage-templates-actions">
                    <button class="manage-templates-apply" data-id="${template.id}" title="Create project from this template">Create Project</button>
                    <button class="manage-templates-rename" data-id="${template.id}" title="Rename template">Rename</button>
                    <button class="manage-templates-delete" data-id="${template.id}" title="Delete template">&times;</button>
                </div>
            </div>
            <ul class="manage-templates-items">${itemsHtml}</ul>
            <div class="manage-templates-add-item">
                <input type="text" class="manage-templates-item-input" placeholder="Add item..." maxlength="200" autocomplete="off">
                <button class="manage-templates-item-add-btn">Add</button>
            </div>
        `

        // Wire up item add
        const itemInput = li.querySelector('.manage-templates-item-input')
        const itemAddBtn = li.querySelector('.manage-templates-item-add-btn')

        const addItem = async () => {
            const text = itemInput.value.trim()
            if (!text) return
            itemInput.disabled = true
            itemAddBtn.disabled = true
            try {
                await addTemplateItem(template.id, text)
                renderTemplatesList(container)
            } catch (err) {
                console.error('Failed to add template item:', err)
            }
            itemInput.disabled = false
            itemAddBtn.disabled = false
        }

        itemAddBtn.addEventListener('click', addItem)
        itemInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addItem()
        })

        // Wire up item delete buttons
        li.querySelectorAll('.manage-templates-todo-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = btn.dataset.itemId
                try {
                    await deleteTemplateItem(template.id, itemId)
                    renderTemplatesList(container)
                } catch (err) {
                    console.error('Failed to delete template item:', err)
                }
            })
        })

        // Wire up drag-and-drop reordering for template items
        const itemsList = li.querySelector('.manage-templates-items')
        li.querySelectorAll('.manage-templates-todo').forEach(todoLi => {
            todoLi.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', todoLi.dataset.itemId)
                e.dataTransfer.effectAllowed = 'move'
                todoLi.classList.add('dragging')
            })
            todoLi.addEventListener('dragend', () => {
                todoLi.classList.remove('dragging')
                itemsList.querySelectorAll('.manage-templates-todo').forEach(item => {
                    item.classList.remove('drag-over')
                })
            })
            todoLi.addEventListener('dragover', (e) => {
                e.preventDefault()
                const dragging = itemsList.querySelector('.dragging')
                if (dragging && dragging !== todoLi) {
                    todoLi.classList.add('drag-over')
                }
            })
            todoLi.addEventListener('dragleave', () => {
                todoLi.classList.remove('drag-over')
            })
            todoLi.addEventListener('drop', async (e) => {
                e.preventDefault()
                e.stopPropagation()
                todoLi.classList.remove('drag-over')
                const dragging = itemsList.querySelector('.dragging')
                if (dragging && dragging !== todoLi) {
                    const rect = todoLi.getBoundingClientRect()
                    const midY = rect.top + rect.height / 2
                    if (e.clientY < midY) {
                        todoLi.before(dragging)
                    } else {
                        todoLi.after(dragging)
                    }
                    const orderedIds = [...itemsList.querySelectorAll('.manage-templates-todo')]
                        .map(item => item.dataset.itemId)
                    await reorderTemplateItems(template.id, orderedIds)
                }
            })
        })

        // Wire up template delete
        li.querySelector('.manage-templates-delete').addEventListener('click', async () => {
            if (!confirm(`Delete template "${template.name}" and all its items?`)) return
            try {
                await deleteProjectTemplate(template.id)
                renderTemplatesList(container)
            } catch (err) {
                console.error('Failed to delete template:', err)
            }
        })

        // Wire up rename
        li.querySelector('.manage-templates-rename').addEventListener('click', () => {
            const nameEl = li.querySelector('.manage-templates-name')
            const currentName = template.name
            const input = document.createElement('input')
            input.type = 'text'
            input.className = 'manage-templates-rename-input'
            input.value = currentName
            input.maxLength = 100
            nameEl.replaceWith(input)
            input.focus()
            input.select()

            const save = async () => {
                const newName = input.value.trim()
                if (newName && newName !== currentName) {
                    try {
                        await renameProjectTemplate(template.id, newName)
                    } catch (err) {
                        console.error('Failed to rename template:', err)
                    }
                }
                renderTemplatesList(container)
            }

            input.addEventListener('blur', save)
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur()
                if (e.key === 'Escape') {
                    input.value = currentName
                    input.blur()
                }
            })
        })

        // Wire up apply (create project from template)
        li.querySelector('.manage-templates-apply').addEventListener('click', async () => {
            const applyBtn = li.querySelector('.manage-templates-apply')
            applyBtn.disabled = true
            applyBtn.textContent = 'Creating...'
            try {
                const project = await createProjectFromTemplate(template.id)
                showToast(`Project "${escapeHtml(project.name)}" created from template`)
            } catch (err) {
                console.error('Failed to create project from template:', err)
                alert('Failed to create project from template.')
            }
            applyBtn.disabled = false
            applyBtn.textContent = 'Create Project'
        })

        container.appendChild(li)
    })
}
