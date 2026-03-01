import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'

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
    const currentUser = store.get('currentUser')
    if (!currentUser) return { success: false, error: 'Not logged in' }

    const { username } = settings

    // Try to update existing settings
    const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({ username: username || null, updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .select()

    if (updateError) {
        console.error('Error updating user_settings:', updateError)
    }

    // If no rows were updated, insert a new one
    if (updateError || !data || data.length === 0) {
        const { error: insertError } = await supabase
            .from('user_settings')
            .insert({
                user_id: currentUser.id,
                username: username || null,
                updated_at: new Date().toISOString()
            })
        if (insertError) {
            console.error('Error inserting into user_settings:', insertError)
            return { success: false, error: 'Failed to save settings' }
        }
    }

    return { success: true }
}
