import { store } from '../../core/store.js'
import { batchAddTodos } from '../../services/todos.js'

/**
 * ImportModal controller
 * Manages the bulk import modal for adding multiple todos at once
 */
export class ImportModal {
    constructor(elements) {
        this.modal = elements.modal
        this.form = elements.form
        this.textarea = elements.textarea
        this.projectSelect = elements.projectSelect
        this.categorySelect = elements.categorySelect
        this.contextSelect = elements.contextSelect
        this.prioritySelect = elements.prioritySelect
        this.gtdStatusSelect = elements.gtdStatusSelect
        this.dueDateInput = elements.dueDateInput
        this.importBtn = elements.importBtn
        this.closeBtn = elements.closeBtn
        this.cancelBtn = elements.cancelBtn
        this.openBtn = elements.openBtn

        this.handleEscapeKey = null

        this.initEventListeners()
    }

    initEventListeners() {
        // Modal controls
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => this.open())
        }
        this.closeBtn.addEventListener('click', () => this.close())
        this.cancelBtn.addEventListener('click', () => this.close())
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close()
        })

        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault()
            this.submit()
        })

        // Ctrl+Enter to submit
        this.form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                this.submit()
            }
        })
    }

    /**
     * Open the import modal
     */
    open() {
        this.modal.classList.add('active')
        this.textarea.value = ''
        this.dueDateInput.value = ''
        this.gtdStatusSelect.value = 'inbox'
        this.projectSelect.value = ''
        this.categorySelect.value = ''
        this.contextSelect.value = ''
        this.prioritySelect.value = ''

        const state = store.state

        // Pre-select project if one is selected
        if (state.selectedProjectId) {
            this.projectSelect.value = state.selectedProjectId
        }

        // Pre-select GTD status based on current view
        if (state.selectedGtdStatus && state.selectedGtdStatus !== 'all') {
            this.gtdStatusSelect.value = state.selectedGtdStatus
        }

        // Update select options
        this.updateProjectSelect()
        this.updateCategorySelect()
        this.updateContextSelect()
        this.updatePrioritySelect()

        // Add escape key listener
        this.handleEscapeKey = (e) => {
            if (e.key === 'Escape') this.close()
        }
        document.addEventListener('keydown', this.handleEscapeKey)

        // Focus textarea
        setTimeout(() => this.textarea.focus(), 50)
    }

    /**
     * Close the import modal
     */
    close() {
        this.modal.classList.remove('active')
        if (this.handleEscapeKey) {
            document.removeEventListener('keydown', this.handleEscapeKey)
            this.handleEscapeKey = null
        }
    }

    /**
     * Submit the import form
     */
    async submit() {
        const text = this.textarea.value.trim()
        if (!text) return

        // Parse lines - each non-empty line is a todo
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)

        if (lines.length === 0) return

        // Get shared settings
        const projectId = this.projectSelect.value || null
        const categoryId = this.categorySelect.value || null
        const contextId = this.contextSelect.value || null
        const priorityId = this.prioritySelect.value || null
        const gtdStatus = this.gtdStatusSelect.value || 'inbox'
        const dueDate = this.dueDateInput.value || null

        // Disable button during import
        this.importBtn.disabled = true
        this.importBtn.textContent = `Importing ${lines.length} todos...`

        try {
            // Prepare all todos for batch import
            const todosData = lines.map(line => ({
                text: line,
                projectId,
                categoryId,
                contextId,
                priorityId,
                gtdStatus,
                dueDate,
                comment: null
            }))

            // Import all at once - only one store update, no flickering
            await batchAddTodos(todosData)

            this.close()
        } catch (error) {
            console.error('Error importing todos:', error)
            alert(`Error importing todos: ${error.message}`)
        } finally {
            this.importBtn.disabled = false
            this.importBtn.textContent = 'Import Todos'
        }
    }

    /**
     * Update project select options
     */
    updateProjectSelect() {
        const projects = store.get('projects')
        this.projectSelect.innerHTML = '<option value="">No Project</option>'

        projects.forEach(project => {
            const option = document.createElement('option')
            option.value = project.id
            option.textContent = project.name
            this.projectSelect.appendChild(option)
        })
    }

    /**
     * Update category select options
     */
    updateCategorySelect() {
        const categories = store.get('categories')
        this.categorySelect.innerHTML = '<option value="">No Category</option>'

        categories.forEach(category => {
            const option = document.createElement('option')
            option.value = category.id
            option.textContent = category.name
            this.categorySelect.appendChild(option)
        })
    }

    /**
     * Update context select options
     */
    updateContextSelect() {
        const contexts = store.get('contexts')
        this.contextSelect.innerHTML = '<option value="">No Context</option>'

        contexts.forEach(context => {
            const option = document.createElement('option')
            option.value = context.id
            option.textContent = context.name
            this.contextSelect.appendChild(option)
        })
    }

    /**
     * Update priority select options
     */
    updatePrioritySelect() {
        const priorities = store.get('priorities')
        this.prioritySelect.innerHTML = '<option value="">No Priority</option>'

        priorities.forEach(priority => {
            const option = document.createElement('option')
            option.value = priority.id
            option.textContent = priority.name
            this.prioritySelect.appendChild(option)
        })
    }
}
