import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'

/**
 * Upsert a user_settings row: tries update first, inserts if no row exists.
 * @param {Object} updates - Column values to set (e.g. { color_theme: 'dark' })
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function upsertUserSetting(updates) {
    const currentUser = store.get('currentUser')
    if (!currentUser) return { success: false, error: 'Not logged in' }

    const payload = { ...updates, updated_at: new Date().toISOString() }

    const { data, error: updateError } = await supabase
        .from('user_settings')
        .update(payload)
        .eq('user_id', currentUser.id)
        .select()

    if (updateError) {
        console.error('Error updating user_settings:', updateError)
    }

    if (updateError || !data || data.length === 0) {
        const { error: insertError } = await supabase
            .from('user_settings')
            .insert({ user_id: currentUser.id, ...payload })
        if (insertError) {
            console.error('Error inserting into user_settings:', insertError)
            return { success: false, error: 'Failed to save settings' }
        }
    }

    return { success: true }
}
