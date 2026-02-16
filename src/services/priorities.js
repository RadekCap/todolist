import { Events } from '../core/events.js'
import { loadCollection, getById } from './data-loader.js'

/**
 * Load all priorities for the current user
 * @returns {Promise<Array>} Array of priorities
 */
export async function loadPriorities() {
    return loadCollection({
        table: 'priorities',
        storeKey: 'priorities',
        event: Events.PRIORITIES_LOADED,
        orderBy: 'level',
        decryptFields: []
    })
}

/**
 * Get priority by ID
 * @param {string} id - Priority ID
 * @returns {Object|null} Priority object or null
 */
export function getPriorityById(id) {
    return getById('priorities', id)
}
