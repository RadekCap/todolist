/**
 * BaseModal - Base class for modal controllers that have their own class
 * (TodoModal, ExportModal, ImportModal, GtdGuideModal).
 *
 * Centralizes shared open/close, Escape key, and backdrop click logic.
 * Subclasses override onOpen() and onClose() hooks for modal-specific behavior.
 *
 * For simple modals without a dedicated controller (settings, manage areas,
 * manage projects, keyboard shortcuts), use ModalManager instead — it manages
 * modals via config objects registered at setup time.
 */
export class BaseModal {
    /**
     * @param {HTMLElement} modalElement - The modal DOM element
     * @param {Object} [options={}]
     * @param {HTMLElement[]} [options.closeButtons=[]] - Buttons that close the modal
     * @param {HTMLElement} [options.focusOnOpen] - Element to focus when opened
     * @param {number} [options.focusDelay=100] - Delay in ms before focusing
     */
    constructor(modalElement, options = {}) {
        this.modal = modalElement
        this.closeButtons = options.closeButtons || []
        this.focusOnOpen = options.focusOnOpen || null
        this.focusDelay = options.focusDelay ?? 100
        this._escapeHandler = null

        this._wireBaseListeners()
    }

    _wireBaseListeners() {
        // Close buttons
        this.closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.close())
        })

        // Backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close()
        })
    }

    /**
     * Open the modal
     * Adds 'active' class, registers Escape handler, and focuses target element.
     * Subclasses should call super.open() then do their own setup,
     * or override onOpen() for setup that runs after the modal is visible.
     */
    open() {
        if (this.modal.classList.contains('active')) return

        // Clean up any stale handler from a previous open
        this._removeEscapeHandler()

        this.modal.classList.add('active')

        this._escapeHandler = (e) => {
            if (e.key === 'Escape') this.close()
        }
        document.addEventListener('keydown', this._escapeHandler)

        this.onOpen()

        if (this.focusOnOpen) {
            setTimeout(() => this.focusOnOpen.focus(), this.focusDelay)
        }
    }

    /**
     * Close the modal
     * Removes 'active' class and cleans up Escape handler.
     * Subclasses should call super.close() then do their own cleanup,
     * or override onClose() for cleanup that runs after the modal is hidden.
     */
    close() {
        this.modal.classList.remove('active')
        this._removeEscapeHandler()
        this.onClose()
    }

    _removeEscapeHandler() {
        if (this._escapeHandler) {
            document.removeEventListener('keydown', this._escapeHandler)
            this._escapeHandler = null
        }
    }

    /**
     * Hook called after modal is shown. Override in subclasses.
     */
    onOpen() {}

    /**
     * Hook called after modal is hidden. Override in subclasses.
     */
    onClose() {}
}
