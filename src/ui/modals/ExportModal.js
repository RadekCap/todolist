import { exportTodos } from '../../services/export.js'
import { getFilteredTodos } from '../../services/todos.js'

/**
 * ExportModal controller
 * Manages the export modal for exporting todos in different formats
 */
export class ExportModal {
    constructor(elements) {
        this.modal = elements.modal
        this.formatSelect = elements.formatSelect
        this.confirmBtn = elements.confirmBtn
        this.closeBtn = elements.closeBtn
        this.cancelBtn = elements.cancelBtn

        this.handleEscapeKey = null

        this.initEventListeners()
    }

    initEventListeners() {
        // Modal controls
        this.closeBtn.addEventListener('click', () => this.close())
        this.cancelBtn.addEventListener('click', () => this.close())
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close()
        })

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
     * Open the export modal
     */
    open() {
        this.modal.classList.add('active')

        // Add escape key listener
        this.handleEscapeKey = (e) => {
            if (e.key === 'Escape') this.close()
        }
        document.addEventListener('keydown', this.handleEscapeKey)

        // Focus format select
        setTimeout(() => this.formatSelect.focus(), 50)
    }

    /**
     * Close the export modal
     */
    close() {
        this.modal.classList.remove('active')
        if (this.handleEscapeKey) {
            document.removeEventListener('keydown', this.handleEscapeKey)
            this.handleEscapeKey = null
        }
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
