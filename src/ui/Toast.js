import { events, Events } from '../core/events.js'
import { performUndo } from '../services/undo.js'

const TOAST_DURATION = 5000
const TOAST_MAX_VISIBLE = 3

let toastContainer = null
const activeToasts = []

/**
 * Initialize the toast system
 * Creates the container and subscribes to undo events
 */
export function initToast() {
    toastContainer = document.getElementById('toastContainer')
    if (!toastContainer) {
        toastContainer = document.createElement('div')
        toastContainer.id = 'toastContainer'
        toastContainer.className = 'toast-container'
        toastContainer.setAttribute('aria-live', 'polite')
        toastContainer.setAttribute('aria-atomic', 'false')
        document.body.appendChild(toastContainer)
    }

    events.on(Events.UNDO_PUSHED, ({ description }) => {
        showToast(description)
    })

    events.on(Events.UNDO_PERFORMED, ({ description }) => {
        showToast(`Undone: ${description}`, false)
    })

    events.on(Events.UNDO_FAILED, () => {
        showToast('Undo failed', false)
    })
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {boolean} showUndoButton - Whether to show an undo button
 */
function showToast(message, showUndoButton = true) {
    if (!toastContainer) return

    const toast = document.createElement('div')
    toast.className = 'toast'
    toast.setAttribute('role', 'status')

    const messageSpan = document.createElement('span')
    messageSpan.className = 'toast-message'
    messageSpan.textContent = message
    toast.appendChild(messageSpan)

    if (showUndoButton) {
        const undoBtn = document.createElement('button')
        undoBtn.className = 'toast-undo-btn'
        undoBtn.textContent = 'Undo'
        undoBtn.setAttribute('aria-label', `Undo: ${message}`)
        undoBtn.addEventListener('click', async () => {
            undoBtn.disabled = true
            await performUndo()
            removeToast(toast)
        })
        toast.appendChild(undoBtn)
    }

    const closeBtn = document.createElement('button')
    closeBtn.className = 'toast-close-btn'
    closeBtn.innerHTML = '&times;'
    closeBtn.setAttribute('aria-label', 'Dismiss notification')
    closeBtn.addEventListener('click', () => removeToast(toast))
    toast.appendChild(closeBtn)

    // Remove oldest if at limit
    while (activeToasts.length >= TOAST_MAX_VISIBLE) {
        removeToast(activeToasts[0].element)
    }

    toastContainer.appendChild(toast)

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible')
    })

    const timerId = setTimeout(() => removeToast(toast), TOAST_DURATION)
    activeToasts.push({ element: toast, timerId })
}

/**
 * Remove a toast from the DOM
 * @param {HTMLElement} toast - The toast element to remove
 */
function removeToast(toast) {
    const index = activeToasts.findIndex(t => t.element === toast)
    if (index === -1) return

    clearTimeout(activeToasts[index].timerId)
    activeToasts.splice(index, 1)

    toast.classList.remove('toast-visible')
    toast.classList.add('toast-hiding')
    toast.addEventListener('transitionend', () => {
        toast.remove()
    }, { once: true })

    // Fallback removal if transition doesn't fire
    setTimeout(() => {
        if (toast.parentNode) toast.remove()
    }, 300)
}
