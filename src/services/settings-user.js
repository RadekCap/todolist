import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { upsertUserSetting } from './settings-helpers.js'

/**
 * Load user settings (username, etc.)
 * @returns {Promise<{username: string|null}>}
 */
export async function loadUserSettings() {
    const currentUser = store.get('currentUser')
    if (!currentUser) return { username: null }

    const { data, error } = await supabase
        .from('user_settings')
        .select('username')
        .eq('user_id', currentUser.id)
        .single()

    if (error) {
        return { username: null }
    }

    return { username: data?.username || null }
}

/**
 * Save user settings
 * @param {Object} settings - Settings object with username
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveUserSettings(settings) {
    return upsertUserSetting({ username: settings.username || null })
}
