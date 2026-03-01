import { store } from '../../core/store.js'
import { batchAddTodos } from '../../services/todos.js'
import { populateSelectOptions } from '../helpers.js'
import { BaseModal } from './BaseModal.js'

/**
 * ImportModal controller
 * Manages the bulk import modal for adding multiple todos at once
 */
export class ImportModal extends BaseModal {
    constructor(elements) {
        super(elements.modal, {
            closeButtons: [elements.closeBtn, elements.cancelBtn],
            focusOnOpen: elements.textarea,
            focusDelay: 50
        })

        this.form = elements.form
        this.textarea = elements.textarea
        this.projectSelect = elements.projectSelect
        this.categorySelect = elements.categorySelect
        this.contextSelect = elements.contextSelect
        this.prioritySelect = elements.prioritySelect
        this.gtdStatusSelect = elements.gtdStatusSelect
        this.dueDateInput = elements.dueDateInput
        this.importBtn = elements.importBtn

        if (elements.openBtn) {
            elements.openBtn.addEventListener('click', () => this.open())
        }

        this.initEventListeners()
    }

    initEventListeners() {
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

    onOpen() {
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

    updateProjectSelect() {
        populateSelectOptions(this.projectSelect, store.get('projects'), { emptyLabel: 'No Project' })
    }

    updateCategorySelect() {
        populateSelectOptions(this.categorySelect, store.get('categories'), { emptyLabel: 'No Category' })
    }

    updateContextSelect() {
        populateSelectOptions(this.contextSelect, store.get('contexts'), { emptyLabel: 'No Context' })
    }

    updatePrioritySelect() {
        populateSelectOptions(this.prioritySelect, store.get('priorities'), { emptyLabel: 'No Priority' })
    }
}
