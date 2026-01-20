import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { decrypt } from './auth.js'

/**
 * Load all categories for the current user
 * @returns {Promise<Array>} Array of decrypted categories
 */
export async function loadCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error loading categories:', error)
        throw error
    }

    // Decrypt category names
    const categories = await Promise.all(data.map(async (category) => ({
        ...category,
        name: await decrypt(category.name)
    })))

    store.set('categories', categories)
    events.emit(Events.CATEGORIES_LOADED, categories)
    return categories
}

/**
 * Get category by ID
 * @param {string} id - Category ID
 * @returns {Object|null} Category object or null
 */
export function getCategoryById(id) {
    const categories = store.get('categories')
    return categories.find(c => c.id === id) || null
}
