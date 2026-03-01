import { exportTodos } from '../../services/export.js'
import { getFilteredTodos } from '../../services/todos.js'
import { BaseModal } from './BaseModal.js'

/**
 * ExportModal controller
 * Manages the export modal for exporting todos in different formats
 */
export class ExportModal extends BaseModal {
    constructor(elements) {
        super(elements.modal, {
            closeButtons: [elements.closeBtn, elements.cancelBtn],
            focusOnOpen: elements.formatSelect,
            focusDelay: 50
        })

        this.formatSelect = elements.formatSelect
        this.confirmBtn = elements.confirmBtn

        this.initEventListeners()
    }

    initEventListeners() {
        // Confirm export
        this.confirmBtn.addEventListener('click', () => this.export())

        // Enter key to confirm
        this.formatSelect.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                this.export()
            }
        })
    }

    /**
     * Execute the export
     */
    export() {
        const format = this.formatSelect.value
        const filteredTodos = getFilteredTodos()

        exportTodos(filteredTodos, format)
        this.close()
    }
}
