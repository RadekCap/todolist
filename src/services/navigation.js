import { store } from '../core/store.js'

let isRestoringState = false

const VALID_GTD_STATUSES = [
    'inbox', 'next_action', 'scheduled', 'waiting_for',
    'someday_maybe', 'done', 'all'
]

/**
 * Get the current navigation state
 */
function getCurrentState() {
    return {
        gtdStatus: store.get('selectedGtdStatus'),
        projectId: store.get('selectedProjectId'),
        showProjectsView: store.get('showProjectsView')
    }
}

/**
 * Build URL from navigation state
 */
function buildUrl(state) {
    const params = new URLSearchParams()

    if (state.showProjectsView) {
        params.set('view', 'projects')
    } else if (state.projectId) {
        params.set('project', state.projectId)
    } else if (state.gtdStatus && state.gtdStatus !== 'inbox') {
        params.set('gtd', state.gtdStatus)
    }

    const search = params.toString()
    return search ? `${window.location.pathname}?${search}` : window.location.pathname
}

/**
 * Push current navigation state to browser history
 * Called after GTD status or project selection changes
 */
export function pushNavigationState() {
    if (isRestoringState) return
    const state = getCurrentState()
    window.history.pushState(state, '', buildUrl(state))
}

/**
 * Replace current history entry with current navigation state
 * Used for initial page load to set the starting state
 */
function replaceNavigationState() {
    const state = getCurrentState()
    window.history.replaceState(state, '', buildUrl(state))
}

/**
 * Initialize browser history navigation
 * Sets up popstate listener and handles URL parameters on load
 */
export function initNavigation() {
    // Listen for browser back/forward
    window.addEventListener('popstate', (e) => {
        const state = e.state
        if (!state) return

        isRestoringState = true

        if (state.showProjectsView) {
            store.set('selectedProjectId', null)
            store.set('showProjectsView', true)
        } else if (state.projectId) {
            store.set('selectedProjectId', state.projectId)
            store.set('showProjectsView', false)
            store.set('selectedGtdStatus', 'all')
        } else {
            store.set('selectedGtdStatus', state.gtdStatus || 'inbox')
            store.set('showProjectsView', false)
            store.set('selectedProjectId', null)
        }

        isRestoringState = false
    })

    // Handle URL parameters on initial load
    const urlParams = new URLSearchParams(window.location.search)
    const view = urlParams.get('view')

    if (view === 'today' || view === 'tomorrow') {
        // Notification email links — select scheduled and scroll to section
        store.set('selectedGtdStatus', 'scheduled')
        store.set('showProjectsView', false)
        setTimeout(() => {
            const section = document.querySelector(`.scheduled-section-header.${view}`)
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }, 100)
    } else if (urlParams.has('gtd')) {
        const gtd = urlParams.get('gtd')
        if (VALID_GTD_STATUSES.includes(gtd)) {
            store.set('selectedGtdStatus', gtd)
            store.set('showProjectsView', false)
        }
    } else if (urlParams.has('project')) {
        store.set('selectedProjectId', urlParams.get('project'))
        store.set('showProjectsView', false)
        store.set('selectedGtdStatus', 'all')
    } else if (view === 'projects') {
        store.set('selectedProjectId', null)
        store.set('showProjectsView', true)
    }

    // Set initial history entry
    replaceNavigationState()
}
