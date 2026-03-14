import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'

vi.mock('../../src/core/supabase.js', () => ({
    supabase: {}
}))

vi.mock('../../src/services/auth.js', () => ({
    encrypt: vi.fn(v => v),
    decrypt: vi.fn(v => v)
}))

vi.mock('../../src/services/navigation.js', () => ({
    pushNavigationState: vi.fn()
}))

vi.mock('../../src/services/undo.js', () => ({
    pushUndo: vi.fn()
}))

import {
    getProjectDepth,
    getDescendantIds,
    wouldCreateCycle,
    getProjectPath,
    getFilteredProjects,
    selectProject
} from '../../src/services/projects.js'

describe('projects', () => {
    beforeEach(() => {
        store.reset()
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
})
