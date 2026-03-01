import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'

/**
 * Load notification settings from database
 * @returns {Promise<{enabled: boolean, time: string, timezone: string}>}
 */
export async function loadNotificationSettings() {
    const currentUser = store.get('currentUser')
    if (!currentUser) return { enabled: false, time: '08:00:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }

    const { data, error } = await supabase
        .from('user_settings')
        .select('email_notifications_enabled, email_notification_time, timezone')
        .eq('user_id', currentUser.id)
        .single()

    if (error) {
        return {
            enabled: false,
            time: '08:00:00',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
    }

    return {
        enabled: data?.email_notifications_enabled || false,
        time: data?.email_notification_time || '08:00:00',
        timezone: data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    }
}

/**
 * Save notification settings to database
 * @param {Object} settings - { enabled, time, timezone }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveNotificationSettings(settings) {
    const currentUser = store.get('currentUser')
    if (!currentUser) return { success: false, error: 'Not logged in' }

    const updateData = {
        email_notifications_enabled: settings.enabled,
        email_notification_time: settings.time,
        timezone: settings.timezone,
        updated_at: new Date().toISOString()
    }

    const { data, error: updateError } = await supabase
        .from('user_settings')
        .update(updateData)
        .eq('user_id', currentUser.id)
        .select()

    if (updateError) {
        console.error('Error updating notification settings:', updateError)
    }

    if (updateError || !data || data.length === 0) {
        const { error: insertError } = await supabase
            .from('user_settings')
            .insert({
                user_id: currentUser.id,
                ...updateData
            })
        if (insertError) {
            console.error('Error inserting notification settings:', insertError)
            return { success: false, error: 'Failed to save notification settings' }
        }
    }

    return { success: true }
}
