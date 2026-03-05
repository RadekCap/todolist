import { events, Events } from '../core/events.js'

const UNDO_STACK_MAX = 20

/**
 * Undo stack - stores reversible actions
 * Each entry: { description: string, undo: async () => void, timestamp: number }
 */
const undoStack = []

/**
 * Push an undoable action onto the stack
 * @param {string} description - Human-readable description (e.g. "Deleted 'Buy milk'")
 * @param {Function} undoFn - Async function that reverses the action
 */
export function pushUndo(description, undoFn) {
    undoStack.push({
        description,
        undo: undoFn,
        timestamp: Date.now()
    })

    // Trim stack if too large
    if (undoStack.length > UNDO_STACK_MAX) {
        undoStack.shift()
    }

    events.emit(Events.UNDO_PUSHED, { description, stackSize: undoStack.length })
}

/**
 * Pop and execute the most recent undo action
 * @returns {Promise<boolean>} True if an action was undone
 */
export async function performUndo() {
    if (undoStack.length === 0) return false

    const entry = undoStack.pop()
    try {
        await entry.undo()
        events.emit(Events.UNDO_PERFORMED, { description: entry.description, stackSize: undoStack.length })
        return true
    } catch (error) {
        console.error('Undo failed:', error)
        events.emit(Events.UNDO_FAILED, { description: entry.description, error })
        return false
    }
}

/**
 * Get the current undo stack size
 * @returns {number}
 */
export function getUndoStackSize() {
    return undoStack.length
}

/**
 * Peek at the most recent undo entry description
 * @returns {string|null}
 */
export function peekUndoDescription() {
    if (undoStack.length === 0) return null
    return undoStack[undoStack.length - 1].description
}

/**
 * Clear the undo stack (e.g. on logout)
 */
export function clearUndoStack() {
    undoStack.length = 0
}
