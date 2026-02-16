import { Events } from '../core/events.js'
import { loadCollection, getById } from './data-loader.js'

/**
 * Load all categories for the current user
 * @returns {Promise<Array>} Array of decrypted categories
 */
export async function loadCategories() {
    return loadCollection({
        table: 'categories',
        storeKey: 'categories',
        event: Events.CATEGORIES_LOADED,
        orderBy: 'created_at',
        decryptFields: ['name']
    })
}

/**
 * Get category by ID
 * @param {string} id - Category ID
 * @returns {Object|null} Category object or null
 */
export function getCategoryById(id) {
    return getById('categories', id)
}
