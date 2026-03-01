import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { upsertUserSetting } from './settings-helpers.js'

const VALID_THEMES = ['glass', 'dark', 'clear']
const DEFAULT_THEME = 'glass'

/**
 * Load theme from localStorage for instant display
 * @returns {string} The current theme
 */
function loadThemeFromStorage() {
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
async function saveThemeToDatabase(theme) {
    await upsertUserSetting({ color_theme: theme })
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
