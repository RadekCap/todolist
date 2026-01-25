import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'

const VALID_THEMES = ['glass', 'dark', 'clear']
const DEFAULT_THEME = 'glass'

const VALID_DENSITIES = ['comfortable', 'compact']
const DEFAULT_DENSITY = 'comfortable'

/**
 * Load theme from localStorage for instant display
 * @returns {string} The current theme
 */
export function loadThemeFromStorage() {
    let savedTheme = localStorage.getItem('colorTheme') || DEFAULT_THEME

    // Migrate old themes to glass
    if (!VALID_THEMES.includes(savedTheme)) {
        savedTheme = DEFAULT_THEME
        localStorage.setItem('colorTheme', savedTheme)
    }

    return savedTheme
}

/**
 * Apply theme to the document
 * @param {string} theme - Theme name
 */
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
}

/**
 * Load theme from database and apply it
 * @returns {Promise<string>} The loaded theme
 */
export async function loadThemeFromDatabase() {
    const currentUser = store.get('currentUser')
    if (!currentUser) return DEFAULT_THEME

    const { data, error } = await supabase
        .from('user_settings')
        .select('color_theme')
        .eq('user_id', currentUser.id)
        .single()

    if (error) {
        console.error('Error loading theme:', error)
        return DEFAULT_THEME
    }

    if (data && data.color_theme) {
        let dbTheme = data.color_theme

        // Migrate old themes to glass
        if (!VALID_THEMES.includes(dbTheme)) {
            dbTheme = DEFAULT_THEME
            await saveThemeToDatabase(dbTheme)
        }

        applyTheme(dbTheme)
        localStorage.setItem('colorTheme', dbTheme)
        events.emit(Events.THEME_CHANGED, dbTheme)
        return dbTheme
    }

    return DEFAULT_THEME
}

/**
 * Save theme to database
 * @param {string} theme - Theme name
 */
export async function saveThemeToDatabase(theme) {
    const currentUser = store.get('currentUser')
    if (!currentUser) return

    // Try to update existing setting
    const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({ color_theme: theme, updated_at: new Date().toISOString() })
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
                color_theme: theme,
                updated_at: new Date().toISOString()
            })
        if (insertError) {
            console.error('Error inserting into user_settings:', insertError)
        }
    }
}

/**
 * Change theme and save it
 * @param {string} theme - Theme name
 */
export async function changeTheme(theme) {
    applyTheme(theme)
    localStorage.setItem('colorTheme', theme)
    events.emit(Events.THEME_CHANGED, theme)

    const currentUser = store.get('currentUser')
    if (currentUser) {
        await saveThemeToDatabase(theme)
    }
}

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

/**
 * Initialize theme on app load
 * @param {HTMLSelectElement} themeSelect - Theme select element
 */
export function initTheme(themeSelect) {
    const savedTheme = loadThemeFromStorage()
    applyTheme(savedTheme)
    if (themeSelect) {
        themeSelect.value = savedTheme
    }
}

// ========================================
// DENSITY SETTINGS
// ========================================

/**
 * Load density from localStorage for instant display
 * @returns {string} The current density
 */
export function loadDensityFromStorage() {
    let savedDensity = localStorage.getItem('densityMode') || DEFAULT_DENSITY

    if (!VALID_DENSITIES.includes(savedDensity)) {
        savedDensity = DEFAULT_DENSITY
        localStorage.setItem('densityMode', savedDensity)
    }

    return savedDensity
}

/**
 * Apply density to the document
 * @param {string} density - Density name
 */
export function applyDensity(density) {
    document.documentElement.setAttribute('data-density', density)
}

/**
 * Load density from database and apply it
 * @returns {Promise<string>} The loaded density
 */
export async function loadDensityFromDatabase() {
    const currentUser = store.get('currentUser')
    if (!currentUser) return DEFAULT_DENSITY

    const { data, error } = await supabase
        .from('user_settings')
        .select('density_mode')
        .eq('user_id', currentUser.id)
        .single()

    if (error) {
        console.error('Error loading density:', error)
        return DEFAULT_DENSITY
    }

    if (data && data.density_mode) {
        let dbDensity = data.density_mode

        if (!VALID_DENSITIES.includes(dbDensity)) {
            dbDensity = DEFAULT_DENSITY
            await saveDensityToDatabase(dbDensity)
        }

        applyDensity(dbDensity)
        localStorage.setItem('densityMode', dbDensity)
        events.emit(Events.DENSITY_CHANGED, dbDensity)
        return dbDensity
    }

    return DEFAULT_DENSITY
}

/**
 * Save density to database
 * @param {string} density - Density name
 */
export async function saveDensityToDatabase(density) {
    const currentUser = store.get('currentUser')
    if (!currentUser) return

    // Try to update existing setting
    const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({ density_mode: density, updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .select()

    if (updateError) {
        console.error('Error updating density in user_settings:', updateError)
    }

    // If no rows were updated, insert a new one
    if (updateError || !data || data.length === 0) {
        const { error: insertError } = await supabase
            .from('user_settings')
            .insert({
                user_id: currentUser.id,
                density_mode: density,
                updated_at: new Date().toISOString()
            })
        if (insertError) {
            console.error('Error inserting density into user_settings:', insertError)
        }
    }
}

/**
 * Change density and save it
 * @param {string} density - Density name
 */
export async function changeDensity(density) {
    applyDensity(density)
    localStorage.setItem('densityMode', density)
    events.emit(Events.DENSITY_CHANGED, density)

    const currentUser = store.get('currentUser')
    if (currentUser) {
        await saveDensityToDatabase(density)
    }
}

/**
 * Initialize density on app load
 * @param {HTMLSelectElement} densitySelect - Density select element
 */
export function initDensity(densitySelect) {
    const savedDensity = loadDensityFromStorage()
    applyDensity(savedDensity)
    if (densitySelect) {
        densitySelect.value = savedDensity
    }
}
