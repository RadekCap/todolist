/**
 * Simple reactive state store for the TodoApp
 * Provides centralized state management with change notifications
 */
class Store {
    constructor() {
        this._state = {
            // User state
            currentUser: null,
            encryptionKey: null,
            pendingUser: null,

            // Data collections
            todos: [],
            categories: [],
            priorities: [],
            contexts: [],
            projects: [],
            areas: [],

            // Filter/selection state
            selectedCategoryIds: new Set(),
            selectedContextIds: new Set(),
            selectedProjectId: null,
            selectedAreaId: 'all',  // 'all', 'unassigned', or UUID
            selectedGtdStatus: 'inbox',

            // UI state
            showProjectsView: false,
            editingTodoId: null,
            searchQuery: ''
        }

        this._listeners = new Map()
    }

    /**
     * Get the current state (read-only access)
     * @returns {Object} The current state object
     */
    get state() {
        return this._state
    }

    /**
     * Get a specific state value
     * @param {string} key - The state key to retrieve
     * @returns {*} The value for the given key
     */
    get(key) {
        return this._state[key]
    }

    /**
     * Set a state value and notify listeners
     * @param {string} key - The state key to set
     * @param {*} value - The new value
     */
    set(key, value) {
        const oldValue = this._state[key]
        this._state[key] = value
        this._notify(key, value, oldValue)
    }

    /**
     * Update multiple state values at once
     * @param {Object} updates - Object with key-value pairs to update
     */
    update(updates) {
        for (const [key, value] of Object.entries(updates)) {
            const oldValue = this._state[key]
            this._state[key] = value
            this._notify(key, value, oldValue)
        }
    }

    /**
     * Subscribe to changes on a specific state key
     * @param {string} key - The state key to watch
     * @param {Function} callback - Function to call on changes: (newValue, oldValue) => void
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set())
        }
        this._listeners.get(key).add(callback)

        // Return unsubscribe function
        return () => {
            const keyListeners = this._listeners.get(key)
            if (keyListeners) {
                keyListeners.delete(callback)
            }
        }
    }

    /**
     * Notify listeners of a state change
     * @private
     */
    _notify(key, newValue, oldValue) {
        const keyListeners = this._listeners.get(key)
        if (keyListeners) {
            for (const callback of keyListeners) {
                try {
                    callback(newValue, oldValue)
                } catch (error) {
                    console.error(`Error in store listener for key "${key}":`, error)
                }
            }
        }
    }

    /**
     * Reset state to initial values (used on logout)
     */
    reset() {
        this._state = {
            currentUser: null,
            encryptionKey: null,
            pendingUser: null,
            todos: [],
            categories: [],
            priorities: [],
            contexts: [],
            projects: [],
            areas: [],
            selectedCategoryIds: new Set(),
            selectedContextIds: new Set(),
            selectedProjectId: null,
            selectedAreaId: 'all',
            selectedGtdStatus: 'inbox',
            showProjectsView: false,
            editingTodoId: null,
            searchQuery: ''
        }
    }
}

// Export singleton instance
export const store = new Store()
