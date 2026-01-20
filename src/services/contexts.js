import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { decrypt } from './auth.js'

/**
 * Load all contexts for the current user
 * @returns {Promise<Array>} Array of decrypted contexts
 */
export async function loadContexts() {
    const { data, error } = await supabase
        .from('contexts')
        .select('*')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error loading contexts:', error)
        throw error
    }

    // Decrypt context names
    const contexts = await Promise.all(data.map(async (context) => ({
        ...context,
        name: await decrypt(context.name)
    })))

    store.set('contexts', contexts)
    events.emit(Events.CONTEXTS_LOADED, contexts)
    return contexts
}

/**
 * Get context by ID
 * @param {string} id - Context ID
 * @returns {Object|null} Context object or null
 */
export function getContextById(id) {
    const contexts = store.get('contexts')
    return contexts.find(c => c.id === id) || null
}
