/**
 * Simple event bus for decoupled cross-module communication
 * Allows modules to emit and listen to events without direct dependencies
 */
class EventBus {
    constructor() {
        this._listeners = new Map()
    }

    /**
     * Subscribe to an event
     * @param {string} event - The event name
     * @param {Function} callback - Function to call when event is emitted
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set())
        }
        this._listeners.get(event).add(callback)

        // Return unsubscribe function
        return () => {
            const eventListeners = this._listeners.get(event)
            if (eventListeners) {
                eventListeners.delete(callback)
            }
        }
    }

    /**
     * Subscribe to an event for a single emission
     * @param {string} event - The event name
     * @param {Function} callback - Function to call when event is emitted
     * @returns {Function} Unsubscribe function
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (...args) => {
            unsubscribe()
            callback(...args)
        })
        return unsubscribe
    }

    /**
     * Emit an event with optional data
     * @param {string} event - The event name
     * @param {*} data - Optional data to pass to listeners
     */
    emit(event, data) {
        const eventListeners = this._listeners.get(event)
        if (eventListeners) {
            for (const callback of eventListeners) {
                try {
                    callback(data)
                } catch (error) {
                    console.error(`Error in event listener for "${event}":`, error)
                }
            }
        }
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - The event name
     */
    off(event) {
        this._listeners.delete(event)
    }

    /**
     * Remove all listeners
     */
    clear() {
        this._listeners.clear()
    }
}

// Export singleton instance
export const events = new EventBus()

// Event name constants for type safety and discoverability
export const Events = {
    // Auth events
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_UNLOCK: 'auth:unlock',
    AUTH_LOCK: 'auth:lock',

    // Data events
    // Single-item events carry the affected entity as payload
    // Plural events (TODOS_UPDATED, TODOS_LOADED) carry the full array
    TODOS_LOADED: 'todos:loaded',
    TODOS_UPDATED: 'todos:updated',
    TODO_ADDED: 'todo:added',
    TODO_UPDATED: 'todo:updated',
    TODO_DELETED: 'todo:deleted',

    PROJECTS_LOADED: 'projects:loaded',
    PROJECT_ADDED: 'project:added',
    PROJECT_UPDATED: 'project:updated',
    PROJECT_DELETED: 'project:deleted',

    AREAS_LOADED: 'areas:loaded',
    AREA_ADDED: 'area:added',
    AREA_UPDATED: 'area:updated',
    AREA_DELETED: 'area:deleted',

    CATEGORIES_LOADED: 'categories:loaded',
    CONTEXTS_LOADED: 'contexts:loaded',
    PRIORITIES_LOADED: 'priorities:loaded',

    // UI events
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',
    VIEW_CHANGED: 'view:changed',
    THEME_CHANGED: 'theme:changed',
    DENSITY_CHANGED: 'density:changed',
    OPEN_GTD_GUIDE: 'ui:openGtdGuide',

    // Render events
    RENDER_TODOS: 'render:todos',
    RENDER_PROJECTS: 'render:projects',
    RENDER_GTD_LIST: 'render:gtdList',
    RENDER_AREAS: 'render:areas',
    RENDER_ALL: 'render:all'
}
