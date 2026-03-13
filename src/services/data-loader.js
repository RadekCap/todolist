import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events } from '../core/events.js'
import { decrypt } from './auth.js'

/**
 * Generic loader for encrypted collections from Supabase.
 * Handles the common pattern: fetch → decrypt → store → emit.
 *
 * @param {Object} options
 * @param {string} options.table - Supabase table name
 * @param {string} options.storeKey - Key to set in the store
 * @param {string} options.event - Event name to emit after loading
 * @param {string} options.orderBy - Column to order by
 * @param {boolean} [options.ascending=true] - Sort direction
 * @param {string[]} [options.decryptFields=['name']] - Fields to decrypt
 * @returns {Promise<Array>} The loaded and decrypted items
 */
export async function loadCollection({ table, storeKey, event, orderBy, ascending = true, decryptFields = ['name'] }) {
    const { data, error } = await supabase
        .from(table)
        .select('*')
        .order(orderBy, { ascending })

    if (error) {
        console.error(`Error loading ${table}:`, error)
        throw error
    }

    let items = data
    if (decryptFields.length > 0) {
        items = await Promise.all(data.map(async (item) => {
            const decrypted = { ...item }
            for (const field of decryptFields) {
                if (item[field]) {
                    decrypted[field] = await decrypt(item[field])
                }
            }
            return decrypted
        }))
    }

    store.set(storeKey, items)
    events.emit(event, items)
    return items
}

/**
 * Get an item by ID from a store collection
 * @param {string} storeKey - Store key for the collection
 * @param {string} id - Item ID
 * @returns {Object|null} Found item or null
 */
export function getById(storeKey, id) {
    const items = store.get(storeKey)
    return items.find(item => item.id === id) || null
}
