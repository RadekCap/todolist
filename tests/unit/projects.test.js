import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/auth.js', () => ({
    encrypt: vi.fn(v => Promise.resolve(`enc:${v}`)),
    decrypt: vi.fn(v => Promise.resolve(v?.startsWith?.('enc:') ? v.slice(4) : v))
}))

vi.mock('../../src/services/navigation.js', () => ({
    pushNavigationState: vi.fn()
}))

vi.mock('../../src/services/undo.js', () => ({
    pushUndo: vi.fn()
}))

function createSupabaseMock() {
    const results = []
    let callIndex = 0

    const chain = {
        from: vi.fn(() => chain),
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        neq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        then: vi.fn((resolve) => {
            const result = results[callIndex] || { data: null, error: null }
            callIndex++
            resolve(result)
        }),
        _queueResult(data, error = null) {
            results.push({ data, error })
        },
        _reset() {
            results.length = 0
            callIndex = 0
        }
    }
    return chain
}

const mockChain = createSupabaseMock()

vi.mock('../../src/core/supabase.js', () => ({
    supabase: mockChain
}))

// Import after mocks are set up
const {
    getProjectDepth,
    getDescendantIds,
    wouldCreateCycle,
    getProjectPath,
    getFilteredProjects,
    selectProject,
    loadProjects,
    addProject,
    deleteProject,
    updateProject,
    renameProject,
    reorderProjects
} = await import('../../src/services/projects.js')

const { pushUndo } = await import('../../src/services/undo.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('projects', () => {
    beforeEach(() => {
        store.reset()
        mockChain._reset()
        vi.clearAllMocks()

        store.set('projects', [
            { id: 'p1', name: 'Root A', parent_id: null, area_id: 'area-1', sort_order: 0 },
            { id: 'p2', name: 'Child of A', parent_id: 'p1', area_id: 'area-1', sort_order: 0 },
            { id: 'p3', name: 'Grandchild', parent_id: 'p2', area_id: 'area-1', sort_order: 0 },
            { id: 'p4', name: 'Root B', parent_id: null, area_id: null, sort_order: 1 },
            { id: 'p5', name: 'Root C', parent_id: null, area_id: 'area-2', sort_order: 2 },
        ])
    })

    // ─── getProjectDepth ─────────────────────────────────────────────────────

    describe('getProjectDepth', () => {
        it('returns 0 for a root project', () => {
            expect(getProjectDepth('p1')).toBe(0)
        })

        it('returns 1 for a direct child', () => {
            expect(getProjectDepth('p2')).toBe(1)
        })

        it('returns 2 for a grandchild', () => {
            expect(getProjectDepth('p3')).toBe(2)
        })

        it('returns 0 for a non-existent project', () => {
            expect(getProjectDepth('non-existent')).toBe(0)
        })

        it('does not infinite loop on circular parent chain', () => {
            store.set('projects', [
                { id: 'c1', name: 'Cycle 1', parent_id: 'c2', area_id: null, sort_order: 0 },
                { id: 'c2', name: 'Cycle 2', parent_id: 'c3', area_id: null, sort_order: 0 },
                { id: 'c3', name: 'Cycle 3', parent_id: 'c1', area_id: null, sort_order: 0 },
            ])

            const depth = getProjectDepth('c1')
            expect(depth).toBeLessThanOrEqual(4)
        })

        it('returns 0 for another root project', () => {
            expect(getProjectDepth('p4')).toBe(0)
        })
    })

    // ─── getDescendantIds ────────────────────────────────────────────────────

    describe('getDescendantIds', () => {
        it('returns all descendants for a root with children', () => {
            const ids = getDescendantIds('p1')
            expect(ids).toContain('p2')
            expect(ids).toContain('p3')
            expect(ids).toHaveLength(2)
        })

        it('returns empty array for a leaf project', () => {
            const ids = getDescendantIds('p3')
            expect(ids).toEqual([])
        })

        it('returns empty array for a non-existent project', () => {
            const ids = getDescendantIds('non-existent')
            expect(ids).toEqual([])
        })

        it('returns direct children only when no grandchildren exist', () => {
            const ids = getDescendantIds('p2')
            expect(ids).toEqual(['p3'])
        })

        it('collects all levels of a deep hierarchy', () => {
            store.set('projects', [
                { id: 'd1', name: 'Level 0', parent_id: null, area_id: null, sort_order: 0 },
                { id: 'd2', name: 'Level 1', parent_id: 'd1', area_id: null, sort_order: 0 },
                { id: 'd3', name: 'Level 2', parent_id: 'd2', area_id: null, sort_order: 0 },
                { id: 'd4', name: 'Level 3', parent_id: 'd3', area_id: null, sort_order: 0 },
            ])

            const ids = getDescendantIds('d1')
            expect(ids).toContain('d2')
            expect(ids).toContain('d3')
            expect(ids).toContain('d4')
            expect(ids).toHaveLength(3)
        })

        it('does not include the project itself', () => {
            const ids = getDescendantIds('p1')
            expect(ids).not.toContain('p1')
        })

        it('does not include unrelated projects', () => {
            const ids = getDescendantIds('p1')
            expect(ids).not.toContain('p4')
            expect(ids).not.toContain('p5')
        })
    })

    // ─── wouldCreateCycle ────────────────────────────────────────────────────

    describe('wouldCreateCycle', () => {
        it('returns false when moving to null parent', () => {
            expect(wouldCreateCycle('p2', null)).toBe(false)
        })

        it('returns true when moving project under itself', () => {
            expect(wouldCreateCycle('p1', 'p1')).toBe(true)
        })

        it('returns true when moving parent under its own child', () => {
            expect(wouldCreateCycle('p1', 'p2')).toBe(true)
        })

        it('returns true when moving parent under its own grandchild', () => {
            expect(wouldCreateCycle('p1', 'p3')).toBe(true)
        })

        it('returns false when moving between unrelated projects', () => {
            expect(wouldCreateCycle('p4', 'p5')).toBe(false)
        })

        it('returns false when moving a leaf under an unrelated root', () => {
            expect(wouldCreateCycle('p3', 'p4')).toBe(false)
        })

        it('returns false when moving a child to a different root', () => {
            expect(wouldCreateCycle('p2', 'p5')).toBe(false)
        })

        it('returns false for non-existent project as parent', () => {
            expect(wouldCreateCycle('p1', 'non-existent')).toBe(false)
        })
    })

    // ─── getProjectPath ─────────────────────────────────────────────────────

    describe('getProjectPath', () => {
        it('returns single-element path for a root project', () => {
            const path = getProjectPath('p1')
            expect(path).toEqual([{ id: 'p1', name: 'Root A' }])
        })

        it('returns path from root to child', () => {
            const path = getProjectPath('p2')
            expect(path).toEqual([
                { id: 'p1', name: 'Root A' },
                { id: 'p2', name: 'Child of A' }
            ])
        })

        it('returns path from root to grandchild', () => {
            const path = getProjectPath('p3')
            expect(path).toEqual([
                { id: 'p1', name: 'Root A' },
                { id: 'p2', name: 'Child of A' },
                { id: 'p3', name: 'Grandchild' }
            ])
        })

        it('returns empty array for a non-existent project', () => {
            const path = getProjectPath('non-existent')
            expect(path).toEqual([])
        })

        it('returns correct path for another root project', () => {
            const path = getProjectPath('p4')
            expect(path).toEqual([{ id: 'p4', name: 'Root B' }])
        })

        it('path elements are ordered from root to leaf', () => {
            const path = getProjectPath('p3')
            expect(path[0].id).toBe('p1')
            expect(path[path.length - 1].id).toBe('p3')
        })
    })

    // ─── getFilteredProjects ─────────────────────────────────────────────────

    describe('getFilteredProjects', () => {
        it('returns all projects when selectedAreaId is "all"', () => {
            store.set('selectedAreaId', 'all')

            const result = getFilteredProjects()
            expect(result).toHaveLength(5)
        })

        it('returns only projects with null area_id when selectedAreaId is "unassigned"', () => {
            store.set('selectedAreaId', 'unassigned')

            const result = getFilteredProjects()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('p4')
        })

        it('returns projects matching a specific area ID', () => {
            store.set('selectedAreaId', 'area-1')

            const result = getFilteredProjects()
            expect(result).toHaveLength(3)
            result.forEach(p => {
                expect(p.area_id).toBe('area-1')
            })
        })

        it('returns projects matching another specific area ID', () => {
            store.set('selectedAreaId', 'area-2')

            const result = getFilteredProjects()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('p5')
        })

        it('returns empty array when no projects match the area', () => {
            store.set('selectedAreaId', 'area-nonexistent')

            const result = getFilteredProjects()
            expect(result).toEqual([])
        })

        it('returns empty array when projects list is empty and area is "all"', () => {
            store.set('projects', [])
            store.set('selectedAreaId', 'all')

            const result = getFilteredProjects()
            expect(result).toEqual([])
        })
    })

    // ─── selectProject ───────────────────────────────────────────────────────

    describe('selectProject', () => {
        it('sets selectedProjectId to null when called with null', () => {
            selectProject(null)
            expect(store.get('selectedProjectId')).toBeNull()
        })

        it('sets showProjectsView to true when called with null', () => {
            selectProject(null)
            expect(store.get('showProjectsView')).toBe(true)
        })

        it('sets selectedProjectId to the given ID', () => {
            selectProject('p1')
            expect(store.get('selectedProjectId')).toBe('p1')
        })

        it('sets showProjectsView to false when selecting a specific project', () => {
            selectProject('p1')
            expect(store.get('showProjectsView')).toBe(false)
        })

        it('sets selectedGtdStatus to "all" when selecting a specific project', () => {
            store.set('selectedGtdStatus', 'inbox')
            selectProject('p1')
            expect(store.get('selectedGtdStatus')).toBe('all')
        })

        it('does not set selectedGtdStatus when selecting null', () => {
            store.set('selectedGtdStatus', 'inbox')
            selectProject(null)
            expect(store.get('selectedGtdStatus')).toBe('inbox')
        })

        it('emits VIEW_CHANGED event when selecting a project', () => {
            const handler = vi.fn()
            events.on(Events.VIEW_CHANGED, handler)

            selectProject('p1')

            expect(handler).toHaveBeenCalledTimes(1)

            events.off(Events.VIEW_CHANGED)
        })

        it('emits VIEW_CHANGED event when selecting null', () => {
            const handler = vi.fn()
            events.on(Events.VIEW_CHANGED, handler)

            selectProject(null)

            expect(handler).toHaveBeenCalledTimes(1)

            events.off(Events.VIEW_CHANGED)
        })
    })

    // ─── loadProjects ────────────────────────────────────────────────────────

    describe('loadProjects', () => {
        it('loads projects from Supabase and stores them', async () => {
            mockChain._queueResult([
                { id: 'lp1', name: 'enc:Project One', description: null, color: '#667eea', sort_order: 0, parent_id: null, area_id: null },
                { id: 'lp2', name: 'enc:Project Two', description: 'enc:A description', color: '#764ba2', sort_order: 1, parent_id: null, area_id: null }
            ])

            const result = await loadProjects()

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe('Project One')
            expect(result[1].name).toBe('Project Two')
            expect(result[1].description).toBe('A description')
            expect(store.get('projects')).toEqual(result)
        })

        it('decrypts project names and descriptions', async () => {
            mockChain._queueResult([
                { id: 'lp1', name: 'enc:Secret', description: 'enc:Hidden', color: '#000', sort_order: 0, parent_id: null, area_id: null }
            ])

            const result = await loadProjects()

            expect(result[0].name).toBe('Secret')
            expect(result[0].description).toBe('Hidden')
        })

        it('handles null descriptions without decrypting', async () => {
            mockChain._queueResult([
                { id: 'lp1', name: 'enc:Test', description: null, color: '#000', sort_order: 0, parent_id: null, area_id: null }
            ])

            const result = await loadProjects()

            expect(result[0].description).toBeNull()
        })

        it('emits PROJECTS_LOADED event', async () => {
            const handler = vi.fn()
            events.on(Events.PROJECTS_LOADED, handler)

            mockChain._queueResult([
                { id: 'lp1', name: 'enc:Test', description: null, color: '#000', sort_order: 0, parent_id: null, area_id: null }
            ])

            await loadProjects()

            expect(handler).toHaveBeenCalledTimes(1)
            expect(handler).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ id: 'lp1', name: 'Test' })
            ]))

            events.off(Events.PROJECTS_LOADED)
        })

        it('throws on Supabase error', async () => {
            mockChain._queueResult(null, { message: 'Network error' })

            await expect(loadProjects()).rejects.toEqual({ message: 'Network error' })
        })

        it('calls supabase with correct table and ordering', async () => {
            mockChain._queueResult([])

            await loadProjects()

            expect(mockChain.from).toHaveBeenCalledWith('projects')
            expect(mockChain.select).toHaveBeenCalledWith('*')
            expect(mockChain.order).toHaveBeenCalledWith('sort_order', { ascending: true })
        })
    })

    // ─── addProject ──────────────────────────────────────────────────────────

    describe('addProject', () => {
        beforeEach(() => {
            store.set('currentUser', { id: 'user-1' })
            store.set('selectedAreaId', 'all')
        })

        it('encrypts name and inserts into Supabase', async () => {
            mockChain._queueResult([
                { id: 'new-1', name: 'enc:My Project', color: '#667eea', sort_order: 3, parent_id: null, area_id: null, user_id: 'user-1' }
            ])

            const result = await addProject('My Project')

            expect(mockChain.from).toHaveBeenCalledWith('projects')
            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'user-1',
                name: 'enc:My Project'
            }))
            expect(result.name).toBe('My Project')
        })

        it('adds project to store', async () => {
            mockChain._queueResult([
                { id: 'new-1', name: 'enc:Added', color: '#667eea', sort_order: 3, parent_id: null, area_id: null, user_id: 'user-1' }
            ])

            await addProject('Added')

            const projects = store.get('projects')
            expect(projects.find(p => p.id === 'new-1')).toBeDefined()
            expect(projects.find(p => p.id === 'new-1').name).toBe('Added')
        })

        it('emits PROJECT_ADDED event', async () => {
            const handler = vi.fn()
            events.on(Events.PROJECT_ADDED, handler)

            mockChain._queueResult([
                { id: 'new-1', name: 'enc:Test', color: '#667eea', sort_order: 3, parent_id: null, area_id: null, user_id: 'user-1' }
            ])

            await addProject('Test')

            expect(handler).toHaveBeenCalledTimes(1)
            expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-1', name: 'Test' }))

            events.off(Events.PROJECT_ADDED)
        })

        it('assigns parent_id when parentId is provided', async () => {
            mockChain._queueResult([
                { id: 'new-child', name: 'enc:Child', color: '#667eea', sort_order: 1, parent_id: 'p4', area_id: null, user_id: 'user-1' }
            ])

            await addProject('Child', 'p4')

            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                parent_id: 'p4'
            }))
        })

        it('inherits color from parent when parentId is provided', async () => {
            // p1 has area_id 'area-1'
            mockChain._queueResult([
                { id: 'new-child', name: 'enc:Sub', color: '#667eea', sort_order: 1, parent_id: 'p1', area_id: 'area-1', user_id: 'user-1' }
            ])

            await addProject('Sub', 'p1')

            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                area_id: 'area-1'
            }))
        })

        it('assigns area from selectedAreaId for root projects', async () => {
            store.set('selectedAreaId', 'area-99')

            mockChain._queueResult([
                { id: 'new-1', name: 'enc:Test', color: '#667eea', sort_order: 3, parent_id: null, area_id: 'area-99', user_id: 'user-1' }
            ])

            await addProject('Test')

            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                area_id: 'area-99'
            }))
        })

        it('does not assign area when selectedAreaId is "all"', async () => {
            store.set('selectedAreaId', 'all')

            mockChain._queueResult([
                { id: 'new-1', name: 'enc:Test', color: '#667eea', sort_order: 3, parent_id: null, area_id: null, user_id: 'user-1' }
            ])

            await addProject('Test')

            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                area_id: null
            }))
        })

        it('does not assign area when selectedAreaId is "unassigned"', async () => {
            store.set('selectedAreaId', 'unassigned')

            mockChain._queueResult([
                { id: 'new-1', name: 'enc:Test', color: '#667eea', sort_order: 3, parent_id: null, area_id: null, user_id: 'user-1' }
            ])

            await addProject('Test')

            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                area_id: null
            }))
        })

        it('throws when nesting depth exceeds limit', async () => {
            // p3 is at depth 2, so adding a child to it should fail
            await expect(addProject('Too Deep', 'p3')).rejects.toThrow('maximum nesting depth')
        })

        it('throws on Supabase error', async () => {
            mockChain._queueResult(null, { message: 'Insert failed' })

            await expect(addProject('Fail')).rejects.toEqual({ message: 'Insert failed' })
        })

        it('calculates sort_order from siblings', async () => {
            // p4 has sort_order 1, p5 has sort_order 2 — both are root (parent_id null)
            // p1 has sort_order 0
            // max sort_order among root siblings = 2, so next = 3
            mockChain._queueResult([
                { id: 'new-1', name: 'enc:Test', color: '#667eea', sort_order: 3, parent_id: null, area_id: null, user_id: 'user-1' }
            ])

            await addProject('Test')

            expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
                sort_order: 3
            }))
        })
    })

    // ─── deleteProject ───────────────────────────────────────────────────────

    describe('deleteProject', () => {
        beforeEach(() => {
            store.set('todos', [
                { id: 't1', text: 'Task in p1', project_id: 'p1', gtd_status: 'next', user_id: 'user-1' },
                { id: 't2', text: 'Done in p1', project_id: 'p1', gtd_status: 'done', user_id: 'user-1' },
                { id: 't3', text: 'Task in p4', project_id: 'p4', gtd_status: 'inbox', user_id: 'user-1' }
            ])
            store.set('selectedProjectId', null)
        })

        it('deletes a project from Supabase and store', async () => {
            // deleteProject('p4') — a leaf project with no descendants
            // 1 Supabase call: delete project
            mockChain._queueResult(null) // delete project

            await deleteProject('p4')

            expect(mockChain.from).toHaveBeenCalledWith('projects')
            expect(mockChain.delete).toHaveBeenCalled()
            const projects = store.get('projects')
            expect(projects.find(p => p.id === 'p4')).toBeUndefined()
        })

        it('removes descendants from store', async () => {
            // Delete p1, which has descendants p2 and p3
            mockChain._queueResult(null) // delete project p1

            await deleteProject('p1')

            const projects = store.get('projects')
            expect(projects.find(p => p.id === 'p1')).toBeUndefined()
            expect(projects.find(p => p.id === 'p2')).toBeUndefined()
            expect(projects.find(p => p.id === 'p3')).toBeUndefined()
            // Unrelated projects remain
            expect(projects.find(p => p.id === 'p4')).toBeDefined()
        })

        it('emits PROJECT_DELETED event', async () => {
            const handler = vi.fn()
            events.on(Events.PROJECT_DELETED, handler)

            mockChain._queueResult(null) // delete project

            await deleteProject('p4')

            expect(handler).toHaveBeenCalledTimes(1)
            expect(handler).toHaveBeenCalledWith('p4')

            events.off(Events.PROJECT_DELETED)
        })

        it('calls pushUndo with the project name', async () => {
            mockChain._queueResult(null) // delete project

            await deleteProject('p4')

            expect(pushUndo).toHaveBeenCalledTimes(1)
            expect(pushUndo).toHaveBeenCalledWith(
                expect.stringContaining('Root B'),
                expect.any(Function)
            )
        })

        it('clears selectedProjectId if deleted project was selected', async () => {
            store.set('selectedProjectId', 'p4')

            mockChain._queueResult(null) // delete project

            await deleteProject('p4')

            expect(store.get('selectedProjectId')).toBeNull()
        })

        it('does not clear selectedProjectId if different project was selected', async () => {
            store.set('selectedProjectId', 'p5')

            mockChain._queueResult(null) // delete project

            await deleteProject('p4')

            expect(store.get('selectedProjectId')).toBe('p5')
        })

        it('moves non-done todos when moveToProjectId is provided', async () => {
            // 2 Supabase calls: move todos, delete project
            mockChain._queueResult(null) // move todos update
            mockChain._queueResult(null) // delete project

            await deleteProject('p1', { moveToProjectId: 'p5' })

            // t1 was in p1 with status 'next' -> should be moved to p5
            const todos = store.get('todos')
            const t1 = todos.find(t => t.id === 't1')
            expect(t1.project_id).toBe('p5')
            // t2 was 'done' in p1 -> should NOT be moved
            const t2 = todos.find(t => t.id === 't2')
            expect(t2.project_id).toBe('p1')
        })

        it('deletes todos when deleteTodos option is true', async () => {
            // 2 Supabase calls: delete todos, delete project
            mockChain._queueResult(null) // delete todos
            mockChain._queueResult(null) // delete project

            await deleteProject('p1', { deleteTodos: true })

            const todos = store.get('todos')
            // Todos in p1 (t1, t2) should be removed
            expect(todos.find(t => t.id === 't1')).toBeUndefined()
            expect(todos.find(t => t.id === 't2')).toBeUndefined()
            // Unrelated todos remain
            expect(todos.find(t => t.id === 't3')).toBeDefined()
        })

        it('throws on Supabase delete error', async () => {
            mockChain._queueResult(null, { message: 'Delete failed' })

            await expect(deleteProject('p4')).rejects.toEqual({ message: 'Delete failed' })
        })

        it('truncates long project names in undo label', async () => {
            store.set('projects', [
                { id: 'long', name: 'A very long project name that exceeds thirty characters limit', parent_id: null, area_id: null, sort_order: 0 }
            ])

            mockChain._queueResult(null)

            await deleteProject('long')

            expect(pushUndo).toHaveBeenCalledWith(
                expect.stringContaining('...'),
                expect.any(Function)
            )
        })
    })

    // ─── updateProject ───────────────────────────────────────────────────────

    describe('updateProject', () => {
        it('encrypts name and updates Supabase', async () => {
            mockChain._queueResult(null) // update

            await updateProject('p4', { name: 'New Name' })

            expect(mockChain.from).toHaveBeenCalledWith('projects')
            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                name: 'enc:New Name'
            }))
        })

        it('updates project name in store', async () => {
            mockChain._queueResult(null)

            await updateProject('p4', { name: 'Renamed' })

            const project = store.get('projects').find(p => p.id === 'p4')
            expect(project.name).toBe('Renamed')
        })

        it('updates project color', async () => {
            mockChain._queueResult(null)

            await updateProject('p4', { color: '#ff0000' })

            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                color: '#ff0000'
            }))
            const project = store.get('projects').find(p => p.id === 'p4')
            expect(project.color).toBe('#ff0000')
        })

        it('encrypts description when provided', async () => {
            mockChain._queueResult(null)

            await updateProject('p4', { description: 'A desc' })

            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                description: 'enc:A desc'
            }))
        })

        it('sets description to null when empty string is provided', async () => {
            mockChain._queueResult(null)

            await updateProject('p4', { description: '' })

            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                description: null
            }))
        })

        it('updates area_id and propagates to descendants', async () => {
            // p1 has descendants p2, p3
            // 2 Supabase calls: update p2 area, update p3 area, then update p1
            mockChain._queueResult(null) // update child p2
            mockChain._queueResult(null) // update child p3
            mockChain._queueResult(null) // update p1

            await updateProject('p1', { area_id: 'area-99' })

            const projects = store.get('projects')
            expect(projects.find(p => p.id === 'p1').area_id).toBe('area-99')
            expect(projects.find(p => p.id === 'p2').area_id).toBe('area-99')
            expect(projects.find(p => p.id === 'p3').area_id).toBe('area-99')
        })

        it('emits PROJECT_UPDATED event', async () => {
            const handler = vi.fn()
            events.on(Events.PROJECT_UPDATED, handler)

            mockChain._queueResult(null)

            await updateProject('p4', { color: '#123456' })

            expect(handler).toHaveBeenCalledTimes(1)
            expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'p4' }))

            events.off(Events.PROJECT_UPDATED)
        })

        it('throws on circular parent_id', async () => {
            // p1 -> p2 -> p3; moving p1 under p3 would create cycle
            await expect(updateProject('p1', { parent_id: 'p3' }))
                .rejects.toThrow('circular reference')
        })

        it('throws on depth limit exceeded with parent_id', async () => {
            // p3 is at depth 2; moving p4 (which has no children) under p3
            // would make p4 at depth 3, which is > 2
            await expect(updateProject('p4', { parent_id: 'p3' }))
                .rejects.toThrow('maximum nesting depth')
        })

        it('throws on Supabase update error', async () => {
            mockChain._queueResult(null, { message: 'Update failed' })

            await expect(updateProject('p4', { color: '#000' })).rejects.toEqual({ message: 'Update failed' })
        })

        it('updates parent_id in store', async () => {
            // Move p4 under p1 (depth 0 + 1 = 1, which is ok)
            mockChain._queueResult(null) // update

            await updateProject('p4', { parent_id: 'p1' })

            const project = store.get('projects').find(p => p.id === 'p4')
            expect(project.parent_id).toBe('p1')
        })
    })

    // ─── renameProject ───────────────────────────────────────────────────────

    describe('renameProject', () => {
        it('delegates to updateProject with name', async () => {
            mockChain._queueResult(null)

            await renameProject('p4', 'Brand New Name')

            expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
                name: 'enc:Brand New Name'
            }))
            const project = store.get('projects').find(p => p.id === 'p4')
            expect(project.name).toBe('Brand New Name')
        })

        it('emits PROJECT_UPDATED event', async () => {
            const handler = vi.fn()
            events.on(Events.PROJECT_UPDATED, handler)

            mockChain._queueResult(null)

            await renameProject('p4', 'Renamed')

            expect(handler).toHaveBeenCalledTimes(1)

            events.off(Events.PROJECT_UPDATED)
        })

        it('throws on Supabase error', async () => {
            mockChain._queueResult(null, { message: 'Rename failed' })

            await expect(renameProject('p4', 'Fail')).rejects.toEqual({ message: 'Rename failed' })
        })
    })

    // ─── reorderProjects ─────────────────────────────────────────────────────

    describe('reorderProjects', () => {
        it('updates sort_order in store immediately', async () => {
            // Reorder: p5 first, p1 second, p4 third
            // Queue results for each update call
            mockChain._queueResult(null) // update p5 sort_order=0
            mockChain._queueResult(null) // update p1 sort_order=1
            mockChain._queueResult(null) // update p4 sort_order=2

            await reorderProjects(['p5', 'p1', 'p4'])

            const projects = store.get('projects')
            expect(projects.find(p => p.id === 'p5').sort_order).toBe(0)
            expect(projects.find(p => p.id === 'p1').sort_order).toBe(1)
            expect(projects.find(p => p.id === 'p4').sort_order).toBe(2)
        })

        it('sends update calls to Supabase for each project', async () => {
            mockChain._queueResult(null)
            mockChain._queueResult(null)

            await reorderProjects(['p4', 'p1'])

            // Should have called update for each ID
            expect(mockChain.update).toHaveBeenCalledWith({ sort_order: 0 })
            expect(mockChain.update).toHaveBeenCalledWith({ sort_order: 1 })
        })

        it('emits PROJECTS_LOADED event', async () => {
            const handler = vi.fn()
            events.on(Events.PROJECTS_LOADED, handler)

            mockChain._queueResult(null)
            mockChain._queueResult(null)

            await reorderProjects(['p4', 'p1'])

            expect(handler).toHaveBeenCalledTimes(1)

            events.off(Events.PROJECTS_LOADED)
        })

        it('does not change sort_order for projects not in orderedIds', async () => {
            mockChain._queueResult(null)

            await reorderProjects(['p1'])

            const projects = store.get('projects')
            // p4 was sort_order 1, should remain unchanged
            expect(projects.find(p => p.id === 'p4').sort_order).toBe(1)
        })

        it('handles empty orderedIds array', async () => {
            await reorderProjects([])

            // No Supabase calls should be made
            // PROJECTS_LOADED still emitted
            const projects = store.get('projects')
            expect(projects).toHaveLength(5)
        })
    })

    // ─── undo/restore operations ─────────────────────────────────────────────

    describe('deleteProject undo callbacks', () => {
        beforeEach(() => {
            store.set('currentUser', { id: 'user-1' })
            store.set('todos', [
                { id: 't1', text: 'Task in p1', project_id: 'p1', gtd_status: 'next', user_id: 'user-1' },
                { id: 't2', text: 'Done in p1', project_id: 'p1', gtd_status: 'done', user_id: 'user-1' },
                { id: 't3', text: 'Task in p4', project_id: 'p4', gtd_status: 'inbox', user_id: 'user-1' }
            ])
            store.set('selectedProjectId', null)
        })

        async function deleteAndGetUndoCallback(...args) {
            await deleteProject(...args)
            const undoCall = pushUndo.mock.calls[pushUndo.mock.calls.length - 1]
            return undoCall[1] // the undo callback
        }

        // ─── restoreProjects ──────────────────────────────────────────────

        describe('restoreProjects (via undo)', () => {
            it('restores a single deleted project', async () => {
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p4')

                expect(store.get('projects').find(p => p.id === 'p4')).toBeUndefined()

                // Undo: insert project back
                mockChain._queueResult(null) // insert project

                await undoFn()

                const restored = store.get('projects').find(p => p.id === 'p4')
                expect(restored).toBeDefined()
                expect(restored.name).toBe('Root B')
            })

            it('restores a project hierarchy (parent before children)', async () => {
                // Delete p1 which has descendants p2, p3
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1')

                expect(store.get('projects').find(p => p.id === 'p1')).toBeUndefined()
                expect(store.get('projects').find(p => p.id === 'p2')).toBeUndefined()
                expect(store.get('projects').find(p => p.id === 'p3')).toBeUndefined()

                // Undo: insert 3 projects (sorted by depth: p1 first, then p2, then p3)
                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3

                await undoFn()

                expect(store.get('projects').find(p => p.id === 'p1')).toBeDefined()
                expect(store.get('projects').find(p => p.id === 'p2')).toBeDefined()
                expect(store.get('projects').find(p => p.id === 'p3')).toBeDefined()
            })

            it('encrypts project names during restore', async () => {
                mockChain._queueResult(null) // delete
                const undoFn = await deleteAndGetUndoCallback('p4')

                mockChain._queueResult(null) // insert

                await undoFn()

                expect(mockChain.insert).toHaveBeenCalledWith(
                    expect.objectContaining({ name: 'enc:Root B' })
                )
            })

            it('encrypts project descriptions during restore', async () => {
                store.set('projects', [
                    ...store.get('projects').filter(p => p.id !== 'p4'),
                    { id: 'p4', name: 'Root B', description: 'A description', parent_id: null, area_id: null, sort_order: 1 }
                ])

                mockChain._queueResult(null) // delete
                const undoFn = await deleteAndGetUndoCallback('p4')

                mockChain._queueResult(null) // insert

                await undoFn()

                expect(mockChain.insert).toHaveBeenCalledWith(
                    expect.objectContaining({ description: 'enc:A description' })
                )
            })

            it('handles null descriptions during restore', async () => {
                mockChain._queueResult(null) // delete
                const undoFn = await deleteAndGetUndoCallback('p4')

                mockChain._queueResult(null) // insert

                await undoFn()

                expect(mockChain.insert).toHaveBeenCalledWith(
                    expect.objectContaining({ description: null })
                )
            })

            it('emits PROJECTS_LOADED after restoring', async () => {
                mockChain._queueResult(null) // delete
                const undoFn = await deleteAndGetUndoCallback('p4')

                const handler = vi.fn()
                events.on(Events.PROJECTS_LOADED, handler)

                mockChain._queueResult(null) // insert

                await undoFn()

                expect(handler).toHaveBeenCalledTimes(1)
                events.off(Events.PROJECTS_LOADED)
            })

            it('throws on Supabase insert error during restore', async () => {
                mockChain._queueResult(null) // delete
                const undoFn = await deleteAndGetUndoCallback('p4')

                mockChain._queueResult(null, { message: 'Insert failed' })

                await expect(undoFn()).rejects.toEqual({ message: 'Insert failed' })
            })

            it('restores selectedProjectId if deleted project was selected', async () => {
                store.set('selectedProjectId', 'p4')

                mockChain._queueResult(null) // delete
                const undoFn = await deleteAndGetUndoCallback('p4')

                expect(store.get('selectedProjectId')).toBeNull()

                mockChain._queueResult(null) // insert

                await undoFn()

                expect(store.get('selectedProjectId')).toBe('p4')
            })
        })

        // ─── restoreTodoProjectAssignments ────────────────────────────────

        describe('restoreTodoProjectAssignments (via undo)', () => {
            it('restores todo project assignments after move', async () => {
                // Delete p1 with moveToProjectId: move todos to p5
                mockChain._queueResult(null) // move todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { moveToProjectId: 'p5' })

                // t1 was moved from p1 to p5
                expect(store.get('todos').find(t => t.id === 't1').project_id).toBe('p5')

                // Undo: restore projects (p1, p2, p3) + restore todo assignments
                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                mockChain._queueResult(null) // update t1 project_id back

                await undoFn()

                // t1 should be back to p1
                expect(store.get('todos').find(t => t.id === 't1').project_id).toBe('p1')
            })

            it('emits TODOS_LOADED after restoring assignments', async () => {
                mockChain._queueResult(null) // move todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { moveToProjectId: 'p5' })

                const handler = vi.fn()
                events.on(Events.TODOS_LOADED, handler)

                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                mockChain._queueResult(null) // update todo assignment

                await undoFn()

                expect(handler).toHaveBeenCalled()
                events.off(Events.TODOS_LOADED)
            })

            it('throws on Supabase error during assignment restore', async () => {
                mockChain._queueResult(null) // move todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { moveToProjectId: 'p5' })

                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                mockChain._queueResult(null, { message: 'Update failed' }) // assignment error

                await expect(undoFn()).rejects.toEqual({ message: 'Update failed' })
            })
        })

        // ─── restoreDeletedTodos ──────────────────────────────────────────

        describe('restoreDeletedTodos (via undo)', () => {
            it('restores deleted todos when deleteTodos was used', async () => {
                mockChain._queueResult(null) // delete todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { deleteTodos: true })

                // t1 and t2 were in p1 and should be deleted
                expect(store.get('todos').find(t => t.id === 't1')).toBeUndefined()
                expect(store.get('todos').find(t => t.id === 't2')).toBeUndefined()

                // Undo: restore projects (p1, p2, p3) then restore todos (t1, t2)
                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                // Each todo restore returns data from .select()
                mockChain._queueResult([{ id: 't1-new', user_id: 'user-1', text: 'enc:Task in p1' }]) // insert todo t1
                mockChain._queueResult([{ id: 't2-new', user_id: 'user-1', text: 'enc:Done in p1' }]) // insert todo t2

                await undoFn()

                const todos = store.get('todos')
                // Restored todos should be in the store with decrypted text
                expect(todos.find(t => t.id === 't1-new')).toBeDefined()
                expect(todos.find(t => t.id === 't2-new')).toBeDefined()
            })

            it('encrypts todo text during restore', async () => {
                mockChain._queueResult(null) // delete todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { deleteTodos: true })

                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                mockChain._queueResult([{ id: 'r1', user_id: 'user-1' }])
                mockChain._queueResult([{ id: 'r2', user_id: 'user-1' }])

                await undoFn()

                // insert should have been called with encrypted text
                const insertCalls = mockChain.insert.mock.calls
                const todoInserts = insertCalls.filter(call =>
                    call[0] && call[0].text && call[0].text.startsWith('enc:')
                )
                expect(todoInserts.length).toBeGreaterThanOrEqual(2)
            })

            it('encrypts todo comments during restore', async () => {
                store.set('todos', [
                    { id: 't1', text: 'Task', comment: 'A comment', project_id: 'p1', gtd_status: 'next', user_id: 'user-1' },
                    { id: 't3', text: 'Other', project_id: 'p4', gtd_status: 'inbox', user_id: 'user-1' }
                ])

                mockChain._queueResult(null) // delete todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { deleteTodos: true })

                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                mockChain._queueResult([{ id: 'r1', user_id: 'user-1' }])

                await undoFn()

                const insertCalls = mockChain.insert.mock.calls
                const commentInsert = insertCalls.find(call =>
                    call[0] && call[0].comment === 'enc:A comment'
                )
                expect(commentInsert).toBeDefined()
            })

            it('handles null comments during restore', async () => {
                mockChain._queueResult(null) // delete todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { deleteTodos: true })

                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                mockChain._queueResult([{ id: 'r1', user_id: 'user-1' }])
                mockChain._queueResult([{ id: 'r2', user_id: 'user-1' }])

                await undoFn()

                const insertCalls = mockChain.insert.mock.calls
                const nullCommentInsert = insertCalls.find(call =>
                    call[0] && call[0].hasOwnProperty('comment') && call[0].comment === null && call[0].hasOwnProperty('text')
                )
                expect(nullCommentInsert).toBeDefined()
            })

            it('emits TODOS_LOADED after restoring todos', async () => {
                mockChain._queueResult(null) // delete todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { deleteTodos: true })

                const handler = vi.fn()
                events.on(Events.TODOS_LOADED, handler)

                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                mockChain._queueResult([{ id: 'r1', user_id: 'user-1' }])
                mockChain._queueResult([{ id: 'r2', user_id: 'user-1' }])

                await undoFn()

                expect(handler).toHaveBeenCalled()
                events.off(Events.TODOS_LOADED)
            })

            it('throws on Supabase error during todo restore', async () => {
                mockChain._queueResult(null) // delete todos
                mockChain._queueResult(null) // delete project
                const undoFn = await deleteAndGetUndoCallback('p1', { deleteTodos: true })

                mockChain._queueResult(null) // insert p1
                mockChain._queueResult(null) // insert p2
                mockChain._queueResult(null) // insert p3
                mockChain._queueResult(null, { message: 'Insert todo failed' }) // todo insert error

                await expect(undoFn()).rejects.toEqual({ message: 'Insert todo failed' })
            })
        })
    })
})
