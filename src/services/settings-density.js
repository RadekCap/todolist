import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { upsertUserSetting } from './settings-helpers.js'

const VALID_DENSITIES = ['comfortable', 'compact']
const DEFAULT_DENSITY = 'comfortable'

/**
 * Load density from localStorage for instant display
 * @returns {string} The current density
 */
function loadDensityFromStorage() {
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
function applyDensity(density) {
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
async function saveDensityToDatabase(density) {
    await upsertUserSetting({ density_mode: density })
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
