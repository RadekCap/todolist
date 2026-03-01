/**
 * ModalManager - Centralized management for simple modals
 *
 * Handles open/close, Escape key, backdrop click, and focus management
 * for modals that follow a standard pattern. Complex modals with their
 * own controllers (TodoModal, ImportModal, etc.) are tracked for
 * isAnyOpen() but not managed.
 */
export class ModalManager {
    constructor() {
        this._modals = new Map()
        this._trackedModals = []
    }

    /**
     * Register a modal for full lifecycle management
     * @param {string} name - Unique modal identifier
     * @param {Object} config - Modal configuration
     * @param {HTMLElement} config.element - The modal DOM element
     * @param {HTMLElement[]} [config.closeButtons=[]] - Buttons that close the modal
     * @param {HTMLElement} [config.focusOnOpen] - Element to focus when opened
     * @param {Function} [config.onOpen] - Callback before modal is shown
     * @param {Function} [config.onClose] - Callback after modal is hidden
     */
    register(name, config) {
        const modal = {
            name,
            element: config.element,
            closeButtons: config.closeButtons || [],
            focusOnOpen: config.focusOnOpen || null,
            onOpen: config.onOpen || null,
            onClose: config.onClose || null,
            escapeHandler: null
        }

        // Wire up close buttons
        modal.closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.close(name))
        })

        // Wire up backdrop click
        modal.element.addEventListener('click', (e) => {
            if (e.target === modal.element) this.close(name)
        })

        this._modals.set(name, modal)
    }

    /**
     * Track an externally-managed modal for isAnyOpen() checks
     * @param {HTMLElement} element - The modal DOM element
     */
    track(element) {
        this._trackedModals.push(element)
    }

    /**
     * Open a registered modal
     * @param {string} name - Modal identifier
     */
    async open(name) {
        const modal = this._modals.get(name)
        if (!modal) {
            console.warn(`ModalManager: unknown modal "${name}"`)
            return
        }

        if (modal.onOpen) await modal.onOpen()

        modal.element.classList.add('active')

        modal.escapeHandler = (e) => {
            if (e.key === 'Escape') this.close(name)
        }
        document.addEventListener('keydown', modal.escapeHandler)

        if (modal.focusOnOpen) {
            setTimeout(() => modal.focusOnOpen.focus(), 100)
        }
    }

    /**
     * Close a registered modal
     * @param {string} name - Modal identifier
     */
    close(name) {
        const modal = this._modals.get(name)
        if (!modal) {
            console.warn(`ModalManager: unknown modal "${name}"`)
            return
        }

        if (!modal.element.classList.contains('active')) return

        modal.element.classList.remove('active')

        if (modal.escapeHandler) {
            document.removeEventListener('keydown', modal.escapeHandler)
            modal.escapeHandler = null
        }

        if (modal.onClose) modal.onClose()
    }

    /**
     * Check if any managed or tracked modal is currently open
     * @returns {boolean}
     */
    isAnyOpen() {
        for (const modal of this._modals.values()) {
            if (modal.element.classList.contains('active')) return true
        }
        for (const element of this._trackedModals) {
            if (element.classList.contains('active')) return true
        }
        return false
    }
}
