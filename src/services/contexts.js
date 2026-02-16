import { Events } from '../core/events.js'
import { loadCollection, getById } from './data-loader.js'

/**
 * Load all contexts for the current user
 * @returns {Promise<Array>} Array of decrypted contexts
 */
export async function loadContexts() {
    return loadCollection({
        table: 'contexts',
        storeKey: 'contexts',
        event: Events.CONTEXTS_LOADED,
        orderBy: 'created_at',
        decryptFields: ['name']
    })
}

/**
 * Get context by ID
 * @param {string} id - Context ID
 * @returns {Object|null} Context object or null
 */
export function getContextById(id) {
    return getById('contexts', id)
}
