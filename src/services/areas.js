import { supabase } from '../core/supabase.js'
import { store } from '../core/store.js'
import { events, Events } from '../core/events.js'
import { encrypt, decrypt } from './auth.js'

/**
 * Load all areas for the current user
 * @returns {Promise<Array>} Array of decrypted areas
 */
export async function loadAreas() {
    const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('sort_order', { ascending: true })

    if (error) {
        console.error('Error loading areas:', error)
        throw error
    }

    // Decrypt area names
    const areas = await Promise.all(data.map(async (area) => ({
        ...area,
        name: await decrypt(area.name)
    })))

    store.set('areas', areas)
    events.emit(Events.AREAS_LOADED, areas)
    return areas
}

/**
 * Add a new area
 * @param {string} name - Area name
 * @returns {Promise<Object>} The created area
 */
export async function addArea(name) {
    const currentUser = store.get('currentUser')
    const areas = store.get('areas')

    // Get next sort order
    const maxSortOrder = areas.reduce((max, a) => Math.max(max, a.sort_order || 0), 0)

    // Encrypt area name before storing
    const encryptedName = await encrypt(name)

    const { data, error } = await supabase
        .from('areas')
        .insert({
            user_id: currentUser.id,
            name: encryptedName,
            sort_order: maxSortOrder + 1
        })
        .select()

    if (error) {
        console.error('Error adding area:', error)
        throw error
    }

    await loadAreas()
    events.emit(Events.AREA_ADDED, data[0])
    return data[0]
}

/**
 * Rename an area
 * @param {string} areaId - Area ID
 * @param {string} newName - New area name
 */
export async function renameArea(areaId, newName) {
    const encryptedName = await encrypt(newName)

    const { error } = await supabase
        .from('areas')
        .update({ name: encryptedName })
        .eq('id', areaId)

    if (error) {
        console.error('Error renaming area:', error)
        throw error
    }

    // Update local state
    const areas = store.get('areas')
    const area = areas.find(a => a.id === areaId)
    if (area) {
        area.name = newName
        store.set('areas', [...areas])
    }

    events.emit(Events.AREAS_LOADED, store.get('areas'))
}

/**
 * Delete an area
 * @param {string} areaId - Area ID
 */
export async function deleteArea(areaId) {
    const { error } = await supabase
        .from('areas')
        .delete()
        .eq('id', areaId)

    if (error) {
        console.error('Error deleting area:', error)
        throw error
    }

    // Update local state
    const areas = store.get('areas').filter(a => a.id !== areaId)
    store.set('areas', areas)

    // If deleted area was selected, switch to All
    if (store.get('selectedAreaId') === areaId) {
        store.set('selectedAreaId', 'all')
    }

    events.emit(Events.AREA_DELETED, areaId)
}

/**
 * Reorder areas
 * @param {Array<string>} orderedIds - Array of area IDs in new order
 */
export async function reorderAreas(orderedIds) {
    const areas = store.get('areas')

    // Update local state first for immediate feedback
    const reorderedAreas = orderedIds.map((id, index) => {
        const area = areas.find(a => a.id === id)
        return { ...area, sort_order: index }
    })
    store.set('areas', reorderedAreas)

    // Update database
    for (let i = 0; i < orderedIds.length; i++) {
        await supabase
            .from('areas')
            .update({ sort_order: i })
            .eq('id', orderedIds[i])
    }

    events.emit(Events.AREAS_LOADED, store.get('areas'))
}

/**
 * Select an area
 * @param {string} areaId - Area ID ('all', 'unassigned', or UUID)
 */
export function selectArea(areaId) {
    store.set('selectedAreaId', areaId)
    events.emit(Events.VIEW_CHANGED)
}

/**
 * Select area by keyboard shortcut
 * @param {number} digit - Digit pressed (0-9)
 */
export function selectAreaByShortcut(digit) {
    const areas = store.get('areas')

    // Shift+0 = All Areas
    if (digit === 0) {
        selectArea('all')
        return
    }

    // Shift+1-9 = User-created areas by display order (1-indexed)
    const areaIndex = digit - 1
    if (areaIndex < areas.length) {
        selectArea(areas[areaIndex].id)
    }
}
