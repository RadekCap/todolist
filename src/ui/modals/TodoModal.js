import { store } from '../../core/store.js'
import { addTodo, updateTodo, createRecurringTodo, convertToRecurring, getTemplateById } from '../../services/todos.js'
import { buildRecurrenceRule, getNextNOccurrences, formatPreviewDate, calculateFirstOccurrence } from '../../utils/recurrence.js'

/**
 * TodoModal controller
 * Manages the add/edit todo modal
 */
export class TodoModal {
    constructor(elements) {
        this.modal = elements.modal
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
        this.closeBtn = elements.closeBtn
        this.cancelBtn = elements.cancelBtn
        this.openBtn = elements.openBtn

        // Recurrence elements
        this.repeatSelect = document.getElementById('modalRepeatSelect')
        this.recurrenceOptions = document.getElementById('recurrenceOptions')
        this.recurrenceInterval = document.getElementById('recurrenceInterval')
        this.recurrenceIntervalLabel = document.getElementById('recurrenceIntervalLabel')
        this.weekdayOptions = document.getElementById('weekdayOptions')
        this.weekdayCheckboxes = document.querySelectorAll('input[name="weekday"]')
        this.monthlyOptions = document.getElementById('monthlyOptions')
        this.recurrenceOrdinal = document.getElementById('recurrenceOrdinal')
        this.recurrenceDayType = document.getElementById('recurrenceDayType')
        this.weekdaySelect = document.getElementById('weekdaySelect')
        this.recurrenceWeekday = document.getElementById('recurrenceWeekday')
        this.yearlyOptions = document.getElementById('yearlyOptions')
        this.recurrenceMonth = document.getElementById('recurrenceMonth')
        this.recurrenceEndType = document.getElementById('recurrenceEndType')
        this.recurrenceEndDate = document.getElementById('recurrenceEndDate')
        this.recurrenceEndCountWrapper = document.getElementById('recurrenceEndCountWrapper')
        this.recurrenceEndCount = document.getElementById('recurrenceEndCount')
        this.recurrencePreviewList = document.getElementById('recurrencePreviewList')

        // Tab elements
        this.tabs = document.querySelectorAll('.modal-tab')
        this.tabPanels = document.querySelectorAll('.modal-tab-panel')

        this.handleEscapeKey = null
        this.onClose = null

        this.initEventListeners()
        this.initRecurrenceListeners()
        this.initTabListeners()
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
     * Initialize recurrence panel event listeners
     */
    initRecurrenceListeners() {
        // Check if recurrence elements exist (they may not in some contexts)
        if (!this.repeatSelect) {
            console.warn('Recurrence panel elements not found, skipping initialization')
            return
        }

        // Repeat type change
        this.repeatSelect.addEventListener('change', () => this.updateRecurrencePanel())

        // Interval change
        if (this.recurrenceInterval) {
            this.recurrenceInterval.addEventListener('input', () => this.updateRecurrencePreview())
        }

        // Weekday checkboxes
        this.weekdayCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                // Recalculate due date if it was auto-filled
                if (!this.dueDateInput.value || this._dueDateAutoFilled) {
                    this.dueDateInput.value = ''
                    this._dueDateAutoFilled = false
                    this.autoFillDueDate()
                }
                this.updateRecurrencePreview()
            })
        })

        // Monthly day type change
        if (this.recurrenceDayType) {
            this.recurrenceDayType.addEventListener('change', () => {
                if (this.weekdaySelect) {
                    this.weekdaySelect.style.display = this.recurrenceDayType.value === 'weekday' ? 'block' : 'none'
                }
                this.updateRecurrencePreview()
            })
        }

        // Ordinal, weekday, month changes
        if (this.recurrenceOrdinal) {
            this.recurrenceOrdinal.addEventListener('change', () => this.updateRecurrencePreview())
        }
        if (this.recurrenceWeekday) {
            this.recurrenceWeekday.addEventListener('change', () => this.updateRecurrencePreview())
        }
        if (this.recurrenceMonth) {
            this.recurrenceMonth.addEventListener('change', () => this.updateRecurrencePreview())
        }

        // End type change
        if (this.recurrenceEndType) {
            this.recurrenceEndType.addEventListener('change', () => {
                const endType = this.recurrenceEndType.value
                if (this.recurrenceEndDate) {
                    this.recurrenceEndDate.style.display = endType === 'on_date' ? 'inline-block' : 'none'
                }
                if (this.recurrenceEndCountWrapper) {
                    this.recurrenceEndCountWrapper.style.display = endType === 'after_count' ? 'flex' : 'none'
                }
            })
        }

        // Due date change should update preview
        this.dueDateInput.addEventListener('change', () => this.updateRecurrencePreview())
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
     * Update recurrence panel visibility based on repeat type
     */
    updateRecurrencePanel() {
        if (!this.repeatSelect || !this.recurrenceOptions) return

        const type = this.repeatSelect.value

        if (type === 'none') {
            this.recurrenceOptions.style.display = 'none'
            return
        }

        this.recurrenceOptions.style.display = 'flex'

        // Update interval label
        const labels = {
            daily: 'day(s)',
            weekly: 'week(s)',
            monthly: 'month(s)',
            yearly: 'year(s)'
        }
        if (this.recurrenceIntervalLabel) {
            this.recurrenceIntervalLabel.textContent = labels[type] || 'day(s)'
        }

        // Show/hide type-specific options
        if (this.weekdayOptions) {
            this.weekdayOptions.style.display = type === 'weekly' ? 'block' : 'none'
        }
        if (this.monthlyOptions) {
            this.monthlyOptions.style.display = (type === 'monthly' || type === 'yearly') ? 'block' : 'none'
        }
        if (this.yearlyOptions) {
            this.yearlyOptions.style.display = type === 'yearly' ? 'block' : 'none'
        }

        // If switching to weekly, auto-select current day
        if (type === 'weekly' && this.weekdayCheckboxes.length > 0) {
            const dueDate = this.dueDateInput.value ? new Date(this.dueDateInput.value) : new Date()
            const currentDay = dueDate.getDay()
            // Check if any day is selected
            const anySelected = Array.from(this.weekdayCheckboxes).some(cb => cb.checked)
            if (!anySelected && this.weekdayCheckboxes[currentDay]) {
                this.weekdayCheckboxes[currentDay].checked = true
            }
        }

        // Auto-fill due date from first occurrence
        this.autoFillDueDate()
        this.updateRecurrencePreview()
    }

    /**
     * Auto-fill the due date from the first computed occurrence
     */
    autoFillDueDate() {
        // Only auto-fill if due date is empty
        if (this.dueDateInput.value) return

        const rule = this.buildRecurrenceRule()
        if (!rule) return

        const firstOccurrence = calculateFirstOccurrence(rule)
        if (firstOccurrence) {
            this.dueDateInput.value = firstOccurrence
            this._dueDateAutoFilled = true
        }
    }

    /**
     * Update the recurrence preview with next occurrences
     */
    updateRecurrencePreview() {
        if (!this.recurrencePreviewList) return

        const rule = this.buildRecurrenceRule()
        if (!rule) {
            this.recurrencePreviewList.innerHTML = ''
            return
        }

        const startDate = this.dueDateInput.value || this.formatDate(new Date())
        const occurrences = getNextNOccurrences(rule, 4, startDate)

        this.recurrencePreviewList.innerHTML = occurrences
            .map(date => `<li>${formatPreviewDate(date)}</li>`)
            .join('')
    }

    /**
     * Build recurrence rule from form values
     */
    buildRecurrenceRule() {
        if (!this.repeatSelect) return null
        const type = this.repeatSelect.value
        if (!type || type === 'none') return null

        const formValues = {
            type,
            interval: this.recurrenceInterval.value,
            startDate: this.dueDateInput.value || this.formatDate(new Date())
        }

        if (type === 'weekly') {
            formValues.weekdays = Array.from(this.weekdayCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value, 10))
        }

        if (type === 'monthly' || type === 'yearly') {
            formValues.dayType = this.recurrenceDayType.value
            formValues.dayOfMonth = new Date(formValues.startDate).getDate()
            formValues.weekdayOrdinal = this.recurrenceOrdinal.value
            formValues.weekday = this.recurrenceWeekday.value
        }

        if (type === 'yearly') {
            formValues.month = this.recurrenceMonth.value
        }

        return buildRecurrenceRule(formValues)
    }

    /**
     * Get end condition from form values
     */
    getEndCondition() {
        const type = this.recurrenceEndType.value
        return {
            type,
            date: type === 'on_date' ? this.recurrenceEndDate.value : null,
            count: type === 'after_count' ? parseInt(this.recurrenceEndCount.value, 10) : null
        }
    }

    /**
     * Reset recurrence panel to defaults
     */
    resetRecurrence() {
        this._dueDateAutoFilled = false
        if (!this.repeatSelect) return
        this.repeatSelect.value = 'none'
        if (this.recurrenceOptions) this.recurrenceOptions.style.display = 'none'
        if (this.recurrenceInterval) this.recurrenceInterval.value = '1'
        this.weekdayCheckboxes.forEach(cb => cb.checked = false)
        if (this.recurrenceOrdinal) this.recurrenceOrdinal.value = '1'
        if (this.recurrenceDayType) this.recurrenceDayType.value = 'day_of_month'
        if (this.weekdaySelect) this.weekdaySelect.style.display = 'none'
        if (this.recurrenceWeekday) this.recurrenceWeekday.value = '1'
        if (this.recurrenceMonth) this.recurrenceMonth.value = '1'
        if (this.recurrenceEndType) this.recurrenceEndType.value = 'never'
        if (this.recurrenceEndDate) {
            this.recurrenceEndDate.style.display = 'none'
            this.recurrenceEndDate.value = ''
        }
        if (this.recurrenceEndCountWrapper) this.recurrenceEndCountWrapper.style.display = 'none'
        if (this.recurrenceEndCount) this.recurrenceEndCount.value = '10'
        if (this.recurrencePreviewList) this.recurrencePreviewList.innerHTML = ''
    }

    /**
     * Load recurrence settings from a template into the form
     * @param {string|number} templateId - Template todo ID
     */
    async loadRecurrenceFromTemplate(templateId) {
        if (!this.repeatSelect) return

        const template = await getTemplateById(templateId)
        if (!template || !template.recurrence_rule) {
            this.resetRecurrence()
            return
        }

        const rule = template.recurrence_rule

        // Set repeat type
        this.repeatSelect.value = rule.type || 'none'

        // Show recurrence options
        if (this.recurrenceOptions) {
            this.recurrenceOptions.style.display = rule.type && rule.type !== 'none' ? 'flex' : 'none'
        }

        // Set interval
        if (this.recurrenceInterval) {
            this.recurrenceInterval.value = rule.interval || 1
        }

        // Update interval label
        const labels = {
            daily: 'day(s)',
            weekly: 'week(s)',
            monthly: 'month(s)',
            yearly: 'year(s)'
        }
        if (this.recurrenceIntervalLabel) {
            this.recurrenceIntervalLabel.textContent = labels[rule.type] || 'day(s)'
        }

        // Show/hide type-specific options
        if (this.weekdayOptions) {
            this.weekdayOptions.style.display = rule.type === 'weekly' ? 'block' : 'none'
        }
        if (this.monthlyOptions) {
            this.monthlyOptions.style.display = (rule.type === 'monthly' || rule.type === 'yearly') ? 'block' : 'none'
        }
        if (this.yearlyOptions) {
            this.yearlyOptions.style.display = rule.type === 'yearly' ? 'block' : 'none'
        }

        // Set weekday checkboxes for weekly recurrence
        if (rule.type === 'weekly' && rule.weekdays) {
            this.weekdayCheckboxes.forEach(cb => {
                const dayValue = parseInt(cb.value, 10)
                cb.checked = rule.weekdays.includes(dayValue)
            })
        } else {
            this.weekdayCheckboxes.forEach(cb => cb.checked = false)
        }

        // Set monthly/yearly options
        if (rule.type === 'monthly' || rule.type === 'yearly') {
            if (this.recurrenceDayType) {
                this.recurrenceDayType.value = rule.dayType || 'day_of_month'
            }
            if (this.recurrenceOrdinal && rule.weekdayOrdinal !== undefined) {
                this.recurrenceOrdinal.value = String(rule.weekdayOrdinal)
            }
            if (this.recurrenceWeekday && rule.weekday !== undefined) {
                this.recurrenceWeekday.value = String(rule.weekday)
            }
            if (this.weekdaySelect) {
                this.weekdaySelect.style.display = rule.dayType === 'weekday' ? 'block' : 'none'
            }
        }

        // Set yearly month
        if (rule.type === 'yearly' && this.recurrenceMonth && rule.month !== undefined) {
            this.recurrenceMonth.value = String(rule.month)
        }

        // Set end condition from template
        const endType = template.recurrence_end_type || 'never'
        if (this.recurrenceEndType) {
            this.recurrenceEndType.value = endType
        }
        if (this.recurrenceEndDate) {
            this.recurrenceEndDate.style.display = endType === 'on_date' ? 'inline-block' : 'none'
            this.recurrenceEndDate.value = template.recurrence_end_date || ''
        }
        if (this.recurrenceEndCountWrapper) {
            this.recurrenceEndCountWrapper.style.display = endType === 'after_count' ? 'flex' : 'none'
        }
        if (this.recurrenceEndCount && template.recurrence_end_count) {
            this.recurrenceEndCount.value = String(template.recurrence_end_count)
        }

        // Update preview
        this.updateRecurrencePreview()
    }

    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    /**
     * Open the modal for adding a new todo
     */
    open() {
        store.set('editingTodoId', null)
        this.title.textContent = 'Add New Todo'
        this.addBtn.textContent = 'Add Todo'
        this.modal.classList.add('active')
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
        this.resetRecurrence()
        this.switchTab('details')

        // Handle Escape key
        this.handleEscapeKey = (e) => {
            if (e.key === 'Escape') this.close()
        }
        document.addEventListener('keydown', this.handleEscapeKey)

        setTimeout(() => this.todoInput.focus(), 100)
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
        this.modal.classList.add('active')

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
            this.loadRecurrenceFromTemplate(todo.template_id)
            this.switchTab('repeat')
        } else {
            this.resetRecurrence()
            this.switchTab('details')
        }

        // Handle Escape key
        this.handleEscapeKey = (e) => {
            if (e.key === 'Escape') this.close()
        }
        document.addEventListener('keydown', this.handleEscapeKey)

        setTimeout(() => this.todoInput.focus(), 100)
    }

    /**
     * Close the modal
     */
    close() {
        this.modal.classList.remove('active')
        store.set('editingTodoId', null)

        if (this.handleEscapeKey) {
            document.removeEventListener('keydown', this.handleEscapeKey)
        }

        this.todoInput.value = ''
        this.categorySelect.value = ''
        this.projectSelect.value = ''
        this.prioritySelect.value = ''
        this.gtdStatusSelect.value = 'inbox'
        this.contextSelect.value = ''
        this.dueDateInput.value = ''
        this.commentInput.value = ''
        this.priorityToggle.classList.remove('active')
        this.resetRecurrence()

        // Reset to add mode
        this.title.textContent = 'Add New Todo'
        this.addBtn.textContent = 'Add Todo'

        // Return focus to trigger button
        if (this.openBtn && typeof this.openBtn.focus === 'function') {
            this.openBtn.focus()
        }

        if (this.onClose) {
            this.onClose()
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
            const recurrenceRule = this.buildRecurrenceRule()

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
                        const endCondition = this.getEndCondition()
                        await convertToRecurring(editingTodoId, todoData, recurrenceRule, endCondition)
                    } else {
                        // Already recurring, just update the todo data (not the recurrence)
                        await updateTodo(editingTodoId, todoData)
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
                    const endCondition = this.getEndCondition()
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
}
