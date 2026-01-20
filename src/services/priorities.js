import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'

/**
 * Load all priorities for the current user
 * @returns {Promise<Array>} Array of priorities
 */
export async function loadPriorities() {
    const { data, error } = await supabase
        .from('priorities')
        .select('*')
        .order('level', { ascending: true })

    if (error) {
        console.error('Error loading priorities:', error)
        throw error
    }

    store.set('priorities', data)
    events.emit(Events.PRIORITIES_LOADED, data)
    return data
}

/**
 * Get priority by ID
 * @param {string} id - Priority ID
 * @returns {Object|null} Priority object or null
 */
export function getPriorityById(id) {
    const priorities = store.get('priorities')
    return priorities.find(p => p.id === id) || null
}
