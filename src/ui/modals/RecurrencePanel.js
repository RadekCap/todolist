import { buildRecurrenceRule, getNextNOccurrences, formatPreviewDate, calculateFirstOccurrence } from '../../utils/recurrence.js'
import { getTemplateById } from '../../services/todos.js'

/**
 * RecurrencePanel controller
 * Manages the recurrence UI panel within the TodoModal
 */
export class RecurrencePanel {
    /**
     * @param {Object} elements - DOM element references
     * @param {HTMLSelectElement} elements.repeatSelect
     * @param {HTMLElement} elements.recurrenceOptions
     * @param {HTMLInputElement} elements.recurrenceInterval
     * @param {HTMLElement} elements.recurrenceIntervalLabel
     * @param {HTMLElement} elements.weekdayOptions
     * @param {NodeList} elements.weekdayCheckboxes
     * @param {HTMLElement} elements.monthlyOptions
     * @param {HTMLSelectElement} elements.recurrenceOrdinal
     * @param {HTMLSelectElement} elements.recurrenceDayType
     * @param {HTMLElement} elements.weekdaySelect
     * @param {HTMLSelectElement} elements.recurrenceWeekday
     * @param {HTMLElement} elements.yearlyOptions
     * @param {HTMLSelectElement} elements.recurrenceMonth
     * @param {HTMLSelectElement} elements.recurrenceEndType
     * @param {HTMLInputElement} elements.recurrenceEndDate
     * @param {HTMLElement} elements.recurrenceEndCountWrapper
     * @param {HTMLInputElement} elements.recurrenceEndCount
     * @param {HTMLElement} elements.recurrencePreviewList
     * @param {HTMLInputElement} elements.dueDateInput - Reference to the due date input (shared with TodoModal)
     */
    constructor(elements) {
        this.repeatSelect = elements.repeatSelect
        this.recurrenceOptions = elements.recurrenceOptions
        this.recurrenceInterval = elements.recurrenceInterval
        this.recurrenceIntervalLabel = elements.recurrenceIntervalLabel
        this.weekdayOptions = elements.weekdayOptions
        this.weekdayCheckboxes = elements.weekdayCheckboxes
        this.monthlyOptions = elements.monthlyOptions
        this.recurrenceOrdinal = elements.recurrenceOrdinal
        this.recurrenceDayType = elements.recurrenceDayType
        this.weekdaySelect = elements.weekdaySelect
        this.recurrenceWeekday = elements.recurrenceWeekday
        this.yearlyOptions = elements.yearlyOptions
        this.recurrenceMonth = elements.recurrenceMonth
        this.recurrenceEndType = elements.recurrenceEndType
        this.recurrenceEndDate = elements.recurrenceEndDate
        this.recurrenceEndCountWrapper = elements.recurrenceEndCountWrapper
        this.recurrenceEndCount = elements.recurrenceEndCount
        this.recurrencePreviewList = elements.recurrencePreviewList
        this.dueDateInput = elements.dueDateInput

        this._dueDateAutoFilled = false

        this.initListeners()
    }

    /**
     * Initialize recurrence panel event listeners
     */
    initListeners() {
        if (!this.repeatSelect) {
            console.warn('Recurrence panel elements not found, skipping initialization')
            return
        }

        // Repeat type change
        this.repeatSelect.addEventListener('change', () => this.updatePanel())

        // Interval change
        if (this.recurrenceInterval) {
            this.recurrenceInterval.addEventListener('input', () => this.updatePreview())
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
                this.updatePreview()
            })
        })

        // Monthly day type change
        if (this.recurrenceDayType) {
            this.recurrenceDayType.addEventListener('change', () => {
                if (this.weekdaySelect) {
                    this.weekdaySelect.style.display = this.recurrenceDayType.value === 'weekday' ? 'block' : 'none'
                }
                this.updatePreview()
            })
        }

        // Ordinal, weekday, month changes
        if (this.recurrenceOrdinal) {
            this.recurrenceOrdinal.addEventListener('change', () => this.updatePreview())
        }
        if (this.recurrenceWeekday) {
            this.recurrenceWeekday.addEventListener('change', () => this.updatePreview())
        }
        if (this.recurrenceMonth) {
            this.recurrenceMonth.addEventListener('change', () => this.updatePreview())
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
        this.dueDateInput.addEventListener('change', () => this.updatePreview())
    }

    /**
     * Update recurrence panel visibility based on repeat type
     */
    updatePanel() {
        if (!this.repeatSelect || !this.recurrenceOptions) return

        const type = this.repeatSelect.value

        if (type === 'none') {
            this.recurrenceOptions.style.display = 'none'
            return
        }

        this.recurrenceOptions.style.display = 'flex'

        // Weekdays and weekends are weekly variants
        const isWeeklyVariant = type === 'weekly' || type === 'weekdays' || type === 'weekends'

        // Update interval label
        const labels = {
            daily: 'day(s)',
            weekly: 'week(s)',
            weekdays: 'week(s)',
            weekends: 'week(s)',
            monthly: 'month(s)',
            yearly: 'year(s)'
        }
        if (this.recurrenceIntervalLabel) {
            this.recurrenceIntervalLabel.textContent = labels[type] || 'day(s)'
        }

        // Show/hide type-specific options
        if (this.weekdayOptions) {
            this.weekdayOptions.style.display = isWeeklyVariant ? 'block' : 'none'
        }
        if (this.monthlyOptions) {
            this.monthlyOptions.style.display = (type === 'monthly' || type === 'yearly') ? 'block' : 'none'
        }
        if (this.yearlyOptions) {
            this.yearlyOptions.style.display = type === 'yearly' ? 'block' : 'none'
        }

        // Auto-select weekdays for weekday/weekend presets
        if (type === 'weekdays') {
            // Mon-Fri (values 1-5)
            this.weekdayCheckboxes.forEach(cb => {
                const day = parseInt(cb.value, 10)
                cb.checked = day >= 1 && day <= 5
            })
        } else if (type === 'weekends') {
            // Sat-Sun (values 6, 0)
            this.weekdayCheckboxes.forEach(cb => {
                const day = parseInt(cb.value, 10)
                cb.checked = day === 0 || day === 6
            })
        } else if (type === 'weekly' && this.weekdayCheckboxes.length > 0) {
            // If switching to weekly, auto-select current day if none selected
            const dueDate = this.dueDateInput.value ? new Date(this.dueDateInput.value) : new Date()
            const currentDay = dueDate.getDay()
            const anySelected = Array.from(this.weekdayCheckboxes).some(cb => cb.checked)
            if (!anySelected) {
                this.weekdayCheckboxes.forEach(cb => {
                    cb.checked = parseInt(cb.value, 10) === currentDay
                })
            }
        }

        // Auto-fill due date from first occurrence
        this.autoFillDueDate()
        this.updatePreview()
    }

    /**
     * Auto-fill the due date from the first computed occurrence
     */
    autoFillDueDate() {
        // Only auto-fill if due date is empty
        if (this.dueDateInput.value) return

        const rule = this.buildRule()
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
    updatePreview() {
        if (!this.recurrencePreviewList) return

        const rule = this.buildRule()
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
     * @returns {Object|null} Recurrence rule or null if no recurrence
     */
    buildRule() {
        if (!this.repeatSelect) return null
        const type = this.repeatSelect.value
        if (!type || type === 'none') return null

        // Weekdays and weekends are stored as weekly with specific days
        const effectiveType = (type === 'weekdays' || type === 'weekends') ? 'weekly' : type
        const isWeeklyVariant = type === 'weekly' || type === 'weekdays' || type === 'weekends'

        const formValues = {
            type: effectiveType,
            interval: this.recurrenceInterval.value,
            startDate: this.dueDateInput.value || this.formatDate(new Date())
        }

        if (isWeeklyVariant) {
            formValues.weekdays = Array.from(this.weekdayCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => parseInt(cb.value, 10))
        }

        if (effectiveType === 'monthly' || effectiveType === 'yearly') {
            formValues.dayType = this.recurrenceDayType.value
            formValues.dayOfMonth = new Date(formValues.startDate).getDate()
            formValues.weekdayOrdinal = this.recurrenceOrdinal.value
            formValues.weekday = this.recurrenceWeekday.value
        }

        if (effectiveType === 'yearly') {
            formValues.month = this.recurrenceMonth.value
        }

        return buildRecurrenceRule(formValues)
    }

    /**
     * Get end condition from form values
     * @returns {Object} End condition { type, date?, count? }
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
    reset() {
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
    async loadFromTemplate(templateId) {
        if (!this.repeatSelect) return

        const template = await getTemplateById(templateId)
        if (!template || !template.recurrence_rule) {
            this.reset()
            return
        }

        const rule = template.recurrence_rule

        // Detect if this is a weekdays or weekends preset
        let displayType = rule.type || 'none'
        if (rule.type === 'weekly' && rule.weekdays) {
            const weekdays = [...rule.weekdays].sort((a, b) => a - b)
            const isWeekdays = weekdays.length === 5 &&
                weekdays.every((d, i) => d === i + 1) // [1,2,3,4,5]
            const isWeekends = weekdays.length === 2 &&
                weekdays.includes(0) && weekdays.includes(6) // [0,6]

            if (isWeekdays) {
                displayType = 'weekdays'
            } else if (isWeekends) {
                displayType = 'weekends'
            }
        }

        // Set repeat type
        this.repeatSelect.value = displayType

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
            weekdays: 'week(s)',
            weekends: 'week(s)',
            monthly: 'month(s)',
            yearly: 'year(s)'
        }
        if (this.recurrenceIntervalLabel) {
            this.recurrenceIntervalLabel.textContent = labels[displayType] || 'day(s)'
        }

        // Show/hide type-specific options
        const isWeeklyVariant = displayType === 'weekly' || displayType === 'weekdays' || displayType === 'weekends'
        if (this.weekdayOptions) {
            this.weekdayOptions.style.display = isWeeklyVariant ? 'block' : 'none'
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
        this.updatePreview()
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
}
