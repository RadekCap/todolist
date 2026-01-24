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

// Default colors for areas
const AREA_COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140']

/**
 * Add a new area
 * @param {string} name - Area name
 * @param {string} [color] - Optional color (hex)
 * @returns {Promise<Object>} The created area
 */
export async function addArea(name, color = null) {
    const currentUser = store.get('currentUser')
    const areas = store.get('areas')

    // Get next sort order
    const maxSortOrder = areas.reduce((max, a) => Math.max(max, a.sort_order || 0), 0)

    // Encrypt area name before storing
    const encryptedName = await encrypt(name)

    // Use provided color or generate random one
    const areaColor = color || AREA_COLORS[Math.floor(Math.random() * AREA_COLORS.length)]

    const { data, error } = await supabase
        .from('areas')
        .insert({
            user_id: currentUser.id,
            name: encryptedName,
            color: areaColor,
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
 * Update an area (name and/or color)
 * @param {string} areaId - Area ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.name] - New area name
 * @param {string} [updates.color] - New area color
 */
export async function updateArea(areaId, updates) {
    const updateData = {}

    if (updates.name !== undefined) {
        updateData.name = await encrypt(updates.name)
    }
    if (updates.color !== undefined) {
        updateData.color = updates.color
    }

    const { error } = await supabase
        .from('areas')
        .update(updateData)
        .eq('id', areaId)

    if (error) {
        console.error('Error updating area:', error)
        throw error
    }

    // Update local state
    const areas = store.get('areas')
    const area = areas.find(a => a.id === areaId)
    if (area) {
        if (updates.name !== undefined) area.name = updates.name
        if (updates.color !== undefined) area.color = updates.color
        store.set('areas', [...areas])
    }

    events.emit(Events.AREAS_LOADED, store.get('areas'))
}

/**
 * Rename an area
 * @param {string} areaId - Area ID
 * @param {string} newName - New area name
 */
export async function renameArea(areaId, newName) {
    await updateArea(areaId, { name: newName })
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
