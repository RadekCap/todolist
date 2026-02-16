import { store } from '../core/store.js'

/**
 * Toggle selection of a single todo
 * @param {string} todoId - Todo ID to toggle
 */
export function toggleTodoSelection(todoId) {
    const selectedIds = new Set(store.get('selectedTodoIds'))
    if (selectedIds.has(todoId)) {
        selectedIds.delete(todoId)
    } else {
        selectedIds.add(todoId)
    }
    store.set('selectedTodoIds', selectedIds)
    store.set('lastSelectedTodoId', todoId)
}

/**
 * Select a range of todos (for shift-click)
 * @param {string} todoId - End of range todo ID
 * @param {Array<string>} visibleTodoIds - Array of currently visible todo IDs in order
 */
export function selectTodoRange(todoId, visibleTodoIds) {
    const lastSelectedId = store.get('lastSelectedTodoId')
    if (!lastSelectedId) {
        // No previous selection, just select this one
        const selectedIds = new Set([todoId])
        store.set('selectedTodoIds', selectedIds)
        store.set('lastSelectedTodoId', todoId)
        return
    }

    const startIndex = visibleTodoIds.indexOf(lastSelectedId)
    const endIndex = visibleTodoIds.indexOf(todoId)

    if (startIndex === -1 || endIndex === -1) {
        // One of the items not found, just select the clicked one
        const selectedIds = new Set([todoId])
        store.set('selectedTodoIds', selectedIds)
        store.set('lastSelectedTodoId', todoId)
        return
    }

    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    const idsToSelect = visibleTodoIds.slice(from, to + 1)

    const selectedIds = new Set(store.get('selectedTodoIds'))
    idsToSelect.forEach(id => selectedIds.add(id))
    store.set('selectedTodoIds', selectedIds)
}

/**
 * Select all visible todos
 * @param {Array<string>} visibleTodoIds - Array of currently visible todo IDs
 */
export function selectAllTodos(visibleTodoIds) {
    const selectedIds = new Set(visibleTodoIds)
    store.set('selectedTodoIds', selectedIds)
    if (visibleTodoIds.length > 0) {
        store.set('lastSelectedTodoId', visibleTodoIds[visibleTodoIds.length - 1])
    }
}

/**
 * Clear all todo selections
 */
export function clearTodoSelection() {
    store.set('selectedTodoIds', new Set())
    store.set('lastSelectedTodoId', null)
}
