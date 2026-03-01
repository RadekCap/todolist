import { store } from '../../core/store.js'
import { addTodo, updateTodo, createRecurringTodo, convertToRecurring, updateTemplateRecurrence } from '../../services/todos.js'
import { populateSelectOptions } from '../helpers.js'
import { RecurrencePanel } from './RecurrencePanel.js'
import { BaseModal } from './BaseModal.js'

/**
 * TodoModal controller
 * Manages the add/edit todo modal
 */
export class TodoModal extends BaseModal {
    constructor(elements) {
        super(elements.modal, {
            closeButtons: [elements.closeBtn, elements.cancelBtn],
            focusOnOpen: elements.todoInput
        })

        this.form = elements.form
        this.todoInput = elements.todoInput
        this.categorySelect = elements.categorySelect
        this.projectSelect = elements.projectSelect
        this.prioritySelect = elements.prioritySelect
        this.gtdStatusSelect = elements.gtdStatusSelect
        this.contextSelect = elements.contextSelect
        this.dueDateInput = elements.dueDateInput
        this.commentInput = elements.commentInput
        this.priorityToggle = elements.priorityToggle
        this.addBtn = elements.addBtn
        this.title = elements.title
        this.openBtn = elements.openBtn

        // Tab elements
        this.tabs = document.querySelectorAll('.modal-tab')
        this.tabPanels = document.querySelectorAll('.modal-tab-panel')

        this.onCloseCallback = null

        // Initialize recurrence panel as a separate controller
        this.recurrencePanel = new RecurrencePanel({
            repeatSelect: document.getElementById('modalRepeatSelect'),
            recurrenceOptions: document.getElementById('recurrenceOptions'),
            recurrenceInterval: document.getElementById('recurrenceInterval'),
            recurrenceIntervalLabel: document.getElementById('recurrenceIntervalLabel'),
            weekdayOptions: document.getElementById('weekdayOptions'),
            weekdayCheckboxes: document.querySelectorAll('input[name="weekday"]'),
            monthlyOptions: document.getElementById('monthlyOptions'),
            recurrenceOrdinal: document.getElementById('recurrenceOrdinal'),
            recurrenceDayType: document.getElementById('recurrenceDayType'),
            weekdaySelect: document.getElementById('weekdaySelect'),
            recurrenceWeekday: document.getElementById('recurrenceWeekday'),
            yearlyOptions: document.getElementById('yearlyOptions'),
            recurrenceMonth: document.getElementById('recurrenceMonth'),
            recurrenceEndType: document.getElementById('recurrenceEndType'),
            recurrenceEndDate: document.getElementById('recurrenceEndDate'),
            recurrenceEndCountWrapper: document.getElementById('recurrenceEndCountWrapper'),
            recurrenceEndCount: document.getElementById('recurrenceEndCount'),
            recurrencePreviewList: document.getElementById('recurrencePreviewList'),
            dueDateInput: this.dueDateInput
        })

        this.initEventListeners()
        this.initTabListeners()
    }

    /**
     * Set callback for when modal closes (used by app.js to trigger re-render)
     */
    set onClose(callback) {
        this.onCloseCallback = callback
    }

    get onClose() {
        return this.onCloseCallback || (() => {})
    }

    initEventListeners() {
        // Open button
        if (this.openBtn) {
            this.openBtn.addEventListener('click', () => this.open())
        }

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

        // Sync due date and scheduled status
        this.dueDateInput.addEventListener('change', () => {
            if (this.dueDateInput.value) {
                this.gtdStatusSelect.value = 'scheduled'
            }
        })

        this.gtdStatusSelect.addEventListener('change', () => {
            if (this.gtdStatusSelect.value === 'scheduled' && !this.dueDateInput.value) {
                this.dueDateInput.focus()
            }
        })

        // Priority star toggle
        this.priorityToggle.addEventListener('click', () => this.togglePriorityStar())
    }

    /**
     * Initialize tab switching event listeners
     */
    initTabListeners() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab))
        })
    }

    /**
     * Switch to a specific tab
     * @param {string} tabName - The tab name to switch to ('details' or 'repeat')
     */
    switchTab(tabName) {
        this.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName))
        this.tabPanels.forEach(p => p.classList.toggle('active', p.dataset.panel === tabName))
    }

    /**
     * Open the modal for adding a new todo
     */
    open() {
        store.set('editingTodoId', null)
        this.title.textContent = 'Add New Todo'
        this.addBtn.textContent = 'Add Todo'
        this.todoInput.value = ''
        this.dueDateInput.value = ''
        this.commentInput.value = ''
        this.prioritySelect.value = ''
        this.gtdStatusSelect.value = 'inbox'
        this.contextSelect.value = ''
        this.priorityToggle.classList.remove('active')

        const state = store.state

        // Pre-select category if exactly one is selected
        if (state.selectedCategoryIds.size === 1) {
            const selectedId = [...state.selectedCategoryIds][0]
            if (selectedId !== 'uncategorized') {
                this.categorySelect.value = selectedId
            } else {
                this.categorySelect.value = ''
            }
        } else {
            this.categorySelect.value = ''
        }

        // Pre-select project if one is selected in the sidebar
        if (state.selectedProjectId !== null) {
            this.projectSelect.value = state.selectedProjectId
        } else {
            this.projectSelect.value = ''
        }

        // Reset recurrence panel and switch to Details tab
        this.recurrencePanel.reset()
        this.switchTab('details')

        super.open()
    }

    /**
     * Open the modal for editing an existing todo
     * @param {string} todoId - Todo ID
     */
    openEdit(todoId) {
        const todos = store.get('todos')
        const todo = todos.find(t => t.id === todoId)
        if (!todo) return

        store.set('editingTodoId', todoId)
        this.title.textContent = 'Edit Todo'
        this.addBtn.textContent = 'Save Changes'

        // Pre-populate fields
        this.todoInput.value = todo.text
        this.categorySelect.value = todo.category_id || ''
        this.projectSelect.value = todo.project_id || ''
        this.prioritySelect.value = todo.priority_id || ''
        this.gtdStatusSelect.value = todo.gtd_status || 'inbox'
        this.contextSelect.value = todo.context_id || ''
        this.dueDateInput.value = todo.due_date || ''
        this.commentInput.value = todo.comment || ''

        // Set priority star state
        if (todo.priority_id) {
            this.priorityToggle.classList.add('active')
        } else {
            this.priorityToggle.classList.remove('active')
        }

        // Load recurrence settings if this is a recurring todo
        if (todo.template_id) {
            this.recurrencePanel.loadFromTemplate(todo.template_id)
            this.switchTab('repeat')
        } else {
            this.recurrencePanel.reset()
            this.switchTab('details')
        }

        super.open()
    }

    /**
     * Close the modal — clears fields and resets state
     */
    close() {
        super.close()

        store.set('editingTodoId', null)

        this.todoInput.value = ''
        this.categorySelect.value = ''
        this.projectSelect.value = ''
        this.prioritySelect.value = ''
        this.gtdStatusSelect.value = 'inbox'
        this.contextSelect.value = ''
        this.dueDateInput.value = ''
        this.commentInput.value = ''
        this.priorityToggle.classList.remove('active')
        this.recurrencePanel.reset()

        // Reset to add mode
        this.title.textContent = 'Add New Todo'
        this.addBtn.textContent = 'Add Todo'

        // Return focus to trigger button
        if (this.openBtn && typeof this.openBtn.focus === 'function') {
            this.openBtn.focus()
        }

        if (this.onCloseCallback) {
            this.onCloseCallback()
        }
    }

    /**
     * Submit the form (add or update)
     */
    async submit() {
        const text = this.todoInput.value.trim()
        if (!text) return

        const gtdStatus = this.gtdStatusSelect.value || 'inbox'
        const dueDate = this.dueDateInput.value || null

        // Validate: scheduled status requires a due date
        if (gtdStatus === 'scheduled' && !dueDate) {
            alert('A due date is required for scheduled todos')
            this.dueDateInput.focus()
            return
        }

        this.addBtn.disabled = true

        const todoData = {
            text,
            categoryId: this.categorySelect.value || null,
            projectId: this.projectSelect.value || null,
            priorityId: this.prioritySelect.value || null,
            gtdStatus,
            contextId: this.contextSelect.value || null,
            dueDate,
            comment: this.commentInput.value.trim() || null
        }

        try {
            const editingTodoId = store.get('editingTodoId')
            const recurrenceRule = this.recurrencePanel.buildRule()

            if (editingTodoId) {
                this.addBtn.textContent = 'Saving...'

                // Check if adding recurrence to an existing non-recurring todo
                if (recurrenceRule) {
                    // Recurring todos require a due date
                    if (!dueDate) {
                        alert('A due date is required for recurring todos')
                        this.dueDateInput.focus()
                        this.addBtn.disabled = false
                        this.addBtn.textContent = 'Save Changes'
                        return
                    }

                    // Check if this todo is already recurring
                    const todos = store.get('todos')
                    const existingTodo = todos.find(t => String(t.id) === String(editingTodoId))

                    if (existingTodo && !existingTodo.template_id) {
                        // Convert non-recurring todo to recurring
                        const endCondition = this.recurrencePanel.getEndCondition()
                        await convertToRecurring(editingTodoId, todoData, recurrenceRule, endCondition)
                    } else if (existingTodo && existingTodo.template_id) {
                        // Already recurring - update both todo data and template recurrence
                        const endCondition = this.recurrencePanel.getEndCondition()
                        await updateTodo(editingTodoId, todoData)
                        await updateTemplateRecurrence(existingTodo.template_id, recurrenceRule, endCondition)
                    }
                } else {
                    await updateTodo(editingTodoId, todoData)
                }
            } else {
                this.addBtn.textContent = 'Adding...'

                // Check if this is a recurring todo
                if (recurrenceRule) {
                    // Recurring todos require a due date
                    if (!dueDate) {
                        alert('A due date is required for recurring todos')
                        this.dueDateInput.focus()
                        this.addBtn.disabled = false
                        this.addBtn.textContent = 'Add Todo'
                        return
                    }
                    const endCondition = this.recurrencePanel.getEndCondition()
                    await createRecurringTodo(todoData, recurrenceRule, endCondition)
                } else {
                    await addTodo(todoData)
                }
            }
            this.close()
        } catch (error) {
            console.error('Error saving todo:', error)
            alert('Failed to save todo')
        } finally {
            this.addBtn.disabled = false
            this.addBtn.textContent = store.get('editingTodoId') ? 'Save Changes' : 'Add Todo'
        }
    }

    togglePriorityStar() {
        const priorities = store.get('priorities')
        this.priorityToggle.classList.toggle('active')

        if (this.priorityToggle.classList.contains('active')) {
            if (priorities.length > 0 && !this.prioritySelect.value) {
                this.prioritySelect.value = priorities[0].id
            }
        } else {
            this.prioritySelect.value = ''
        }
    }

    updateCategorySelect() {
        populateSelectOptions(this.categorySelect, store.get('categories'), { emptyLabel: 'No Category' })
    }

    updatePrioritySelect() {
        populateSelectOptions(this.prioritySelect, store.get('priorities'), { emptyLabel: 'No Priority' })
    }

    updateContextSelect() {
        populateSelectOptions(this.contextSelect, store.get('contexts'), { emptyLabel: 'No Context' })
    }

    updateProjectSelect() {
        populateSelectOptions(this.projectSelect, store.get('projects'), { emptyLabel: 'No Project' })
    }
}
