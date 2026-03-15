// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the store module
vi.mock('../../src/core/store.js', () => {
    const mockState = {
        selectedGtdStatus: 'inbox',
        selectedProjectId: null,
        showProjectsView: false
    }
    return {
        store: {
            state: mockState,
            get: vi.fn((key) => mockState[key]),
            set: vi.fn((key, value) => { mockState[key] = value })
        }
    }
})

import { pushNavigationState, initNavigation } from '../../src/services/navigation.js'
import { store } from '../../src/core/store.js'

/**
 * Helper to reset mock store state to defaults.
 */
function resetState(overrides = {}) {
    const defaults = {
        selectedGtdStatus: 'inbox',
        selectedProjectId: null,
        showProjectsView: false
    }
    const merged = { ...defaults, ...overrides }
    Object.assign(store.state, merged)
    store.get.mockImplementation((key) => store.state[key])
    store.set.mockImplementation((key, value) => { store.state[key] = value })
}

describe('pushNavigationState', () => {
    let pushStateSpy

    beforeEach(() => {
        resetState()
        pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
        vi.clearAllMocks()
        // Re-bind store mocks after clearAllMocks
        store.get.mockImplementation((key) => store.state[key])
        store.set.mockImplementation((key, value) => { store.state[key] = value })
    })

    afterEach(() => {
        pushStateSpy.mockRestore()
    })

    it('pushes URL without parameters for inbox (default) GTD status', () => {
        resetState({ selectedGtdStatus: 'inbox' })
        pushNavigationState()
        expect(pushStateSpy).toHaveBeenCalledTimes(1)
        const [state, , url] = pushStateSpy.mock.calls[0]
        expect(state.gtdStatus).toBe('inbox')
        // inbox is the default so no ?gtd= param
        expect(url).not.toContain('gtd=')
    })

    it('pushes correct URL for non-default GTD status', () => {
        resetState({ selectedGtdStatus: 'next_action' })
        pushNavigationState()
        const [state, , url] = pushStateSpy.mock.calls[0]
        expect(state.gtdStatus).toBe('next_action')
        expect(url).toContain('gtd=next_action')
    })

    it('pushes correct URL for project selection', () => {
        resetState({ selectedProjectId: 'proj-123' })
        pushNavigationState()
        const [state, , url] = pushStateSpy.mock.calls[0]
        expect(state.projectId).toBe('proj-123')
        expect(url).toContain('project=proj-123')
    })

    it('pushes correct URL for projects view mode', () => {
        resetState({ showProjectsView: true })
        pushNavigationState()
        const [state, , url] = pushStateSpy.mock.calls[0]
        expect(state.showProjectsView).toBe(true)
        expect(url).toContain('view=projects')
    })

    it('does not include project or gtd params in projects view mode', () => {
        resetState({ showProjectsView: true, selectedProjectId: 'proj-1', selectedGtdStatus: 'done' })
        pushNavigationState()
        const [, , url] = pushStateSpy.mock.calls[0]
        expect(url).toContain('view=projects')
        expect(url).not.toContain('project=')
        expect(url).not.toContain('gtd=')
    })

    it('pushes combined state with project and GTD status', () => {
        resetState({ selectedProjectId: 'proj-5', selectedGtdStatus: 'done' })
        pushNavigationState()
        const [state, , url] = pushStateSpy.mock.calls[0]
        expect(state.projectId).toBe('proj-5')
        expect(state.gtdStatus).toBe('done')
        expect(url).toContain('project=proj-5')
        expect(url).toContain('gtd=done')
    })

    it('clears URL when returning to default state (inbox, no project)', () => {
        resetState({ selectedGtdStatus: 'inbox', selectedProjectId: null, showProjectsView: false })
        pushNavigationState()
        const [, , url] = pushStateSpy.mock.calls[0]
        expect(url).not.toContain('?')
    })

    it('includes pathname in the URL', () => {
        resetState({ selectedGtdStatus: 'done' })
        pushNavigationState()
        const [, , url] = pushStateSpy.mock.calls[0]
        // Should start with the pathname
        expect(url).toMatch(/^\//)
    })
})

describe('initNavigation', () => {
    let replaceStateSpy
    let addEventListenerSpy
    let popstateHandler

    beforeEach(() => {
        resetState()
        vi.clearAllMocks()
        // Re-bind store mocks after clearAllMocks
        store.get.mockImplementation((key) => store.state[key])
        store.set.mockImplementation((key, value) => { store.state[key] = value })

        replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})

        // Capture the popstate handler
        popstateHandler = null
        addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
            if (event === 'popstate') {
                popstateHandler = handler
            }
        })
    })

    afterEach(() => {
        replaceStateSpy.mockRestore()
        addEventListenerSpy.mockRestore()
    })

    function setLocationSearch(search) {
        Object.defineProperty(window, 'location', {
            value: { ...window.location, search, pathname: '/' },
            writable: true,
            configurable: true
        })
    }

    // ─── URL parameter parsing ──────────────────────────────────────────────

    describe('URL parameter parsing', () => {
        it('parses ?gtd= parameter and sets correct GTD status', () => {
            setLocationSearch('?gtd=next_action')
            initNavigation()
            expect(store.set).toHaveBeenCalledWith('selectedGtdStatus', 'next_action')
            expect(store.set).toHaveBeenCalledWith('showProjectsView', false)
        })

        it('parses ?project= parameter and sets selected project', () => {
            setLocationSearch('?project=proj-42')
            initNavigation()
            expect(store.set).toHaveBeenCalledWith('selectedProjectId', 'proj-42')
            expect(store.set).toHaveBeenCalledWith('showProjectsView', false)
        })

        it('sets GTD status to all when project is selected without gtd param', () => {
            setLocationSearch('?project=proj-42')
            initNavigation()
            expect(store.set).toHaveBeenCalledWith('selectedGtdStatus', 'all')
        })

        it('parses combined project and gtd parameters', () => {
            setLocationSearch('?project=proj-1&gtd=done')
            initNavigation()
            expect(store.set).toHaveBeenCalledWith('selectedProjectId', 'proj-1')
            expect(store.set).toHaveBeenCalledWith('selectedGtdStatus', 'done')
        })

        it('parses ?view=projects and enters projects view', () => {
            setLocationSearch('?view=projects')
            initNavigation()
            expect(store.set).toHaveBeenCalledWith('showProjectsView', true)
            expect(store.set).toHaveBeenCalledWith('selectedProjectId', null)
        })

        it('parses ?view=today and sets scheduled status', () => {
            setLocationSearch('?view=today')
            initNavigation()
            expect(store.set).toHaveBeenCalledWith('selectedGtdStatus', 'scheduled')
            expect(store.set).toHaveBeenCalledWith('showProjectsView', false)
        })

        it('parses ?view=tomorrow and sets scheduled status', () => {
            setLocationSearch('?view=tomorrow')
            initNavigation()
            expect(store.set).toHaveBeenCalledWith('selectedGtdStatus', 'scheduled')
            expect(store.set).toHaveBeenCalledWith('showProjectsView', false)
        })

        it('ignores invalid GTD status values', () => {
            setLocationSearch('?gtd=invalid_status')
            initNavigation()
            expect(store.set).not.toHaveBeenCalledWith('selectedGtdStatus', 'invalid_status')
        })

        it('handles empty search string gracefully', () => {
            setLocationSearch('')
            initNavigation()
            // Should not set any navigation state, just replaceState
            expect(replaceStateSpy).toHaveBeenCalled()
        })

        it('handles unknown query parameters gracefully', () => {
            setLocationSearch('?foo=bar')
            initNavigation()
            // Should not crash, just call replaceState
            expect(replaceStateSpy).toHaveBeenCalled()
        })
    })

    // ─── replaceState on init ───────────────────────────────────────────────

    describe('initial history entry', () => {
        it('calls replaceState to set initial history entry', () => {
            setLocationSearch('')
            initNavigation()
            expect(replaceStateSpy).toHaveBeenCalledTimes(1)
        })

        it('replaceState receives the current navigation state', () => {
            setLocationSearch('')
            resetState({ selectedGtdStatus: 'inbox', selectedProjectId: null, showProjectsView: false })
            initNavigation()
            const [state] = replaceStateSpy.mock.calls[0]
            expect(state).toHaveProperty('gtdStatus')
            expect(state).toHaveProperty('projectId')
            expect(state).toHaveProperty('showProjectsView')
        })
    })

    // ─── popstate (browser back/forward) ────────────────────────────────────

    describe('popstate event handling', () => {
        it('registers a popstate event listener', () => {
            setLocationSearch('')
            initNavigation()
            expect(addEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
        })

        it('restores GTD status from popstate event state', () => {
            setLocationSearch('')
            initNavigation()
            vi.clearAllMocks()
            store.set.mockImplementation((key, value) => { store.state[key] = value })

            popstateHandler({ state: { gtdStatus: 'waiting_for', projectId: null, showProjectsView: false } })
            expect(store.set).toHaveBeenCalledWith('selectedGtdStatus', 'waiting_for')
            expect(store.set).toHaveBeenCalledWith('showProjectsView', false)
            expect(store.set).toHaveBeenCalledWith('selectedProjectId', null)
        })

        it('restores project selection from popstate event state', () => {
            setLocationSearch('')
            initNavigation()
            vi.clearAllMocks()
            store.set.mockImplementation((key, value) => { store.state[key] = value })

            popstateHandler({ state: { projectId: 'proj-99', gtdStatus: 'all', showProjectsView: false } })
            expect(store.set).toHaveBeenCalledWith('selectedProjectId', 'proj-99')
            expect(store.set).toHaveBeenCalledWith('showProjectsView', false)
        })

        it('restores projects view from popstate event state', () => {
            setLocationSearch('')
            initNavigation()
            vi.clearAllMocks()
            store.set.mockImplementation((key, value) => { store.state[key] = value })

            popstateHandler({ state: { showProjectsView: true } })
            expect(store.set).toHaveBeenCalledWith('showProjectsView', true)
            expect(store.set).toHaveBeenCalledWith('selectedProjectId', null)
        })

        it('defaults GTD status to inbox when popstate has no gtdStatus', () => {
            setLocationSearch('')
            initNavigation()
            vi.clearAllMocks()
            store.set.mockImplementation((key, value) => { store.state[key] = value })

            popstateHandler({ state: { projectId: null, showProjectsView: false } })
            expect(store.set).toHaveBeenCalledWith('selectedGtdStatus', 'inbox')
        })

        it('defaults GTD status to all when popstate has a projectId but no gtdStatus', () => {
            setLocationSearch('')
            initNavigation()
            vi.clearAllMocks()
            store.set.mockImplementation((key, value) => { store.state[key] = value })

            popstateHandler({ state: { projectId: 'proj-1', showProjectsView: false } })
            expect(store.set).toHaveBeenCalledWith('selectedGtdStatus', 'all')
        })

        it('ignores popstate events with null state', () => {
            setLocationSearch('')
            initNavigation()
            vi.clearAllMocks()
            store.set.mockImplementation((key, value) => { store.state[key] = value })

            popstateHandler({ state: null })
            expect(store.set).not.toHaveBeenCalled()
        })
    })
})
