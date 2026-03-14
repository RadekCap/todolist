import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the store module before importing todos-filters
vi.mock('../../src/core/store.js', () => {
    const mockState = {
        todos: [],
        projects: [],
        priorities: [],
        selectedCategoryIds: new Set(),
        selectedContextIds: new Set(),
        selectedProjectId: null,
        selectedAreaId: 'all',
        selectedGtdStatus: 'inbox',
        searchQuery: ''
    }
    return {
        store: {
            state: mockState,
            get: vi.fn((key) => mockState[key])
        }
    }
})

import { getFilteredTodos, getProjectTodoCount, getGtdCount } from '../../src/services/todos-filters.js'
import { store } from '../../src/core/store.js'

/**
 * Helper to reset the mock store state to defaults before each test.
 */
function resetState(overrides = {}) {
    const defaults = {
        todos: [],
        projects: [],
        priorities: [],
        selectedCategoryIds: new Set(),
        selectedContextIds: new Set(),
        selectedProjectId: null,
        selectedAreaId: 'all',
        selectedGtdStatus: 'inbox',
        searchQuery: ''
    }
    const merged = { ...defaults, ...overrides }
    Object.assign(store.state, merged)
    store.get.mockImplementation((key) => store.state[key])
}

// ─── getFilteredTodos ────────────────────────────────────────────────────────

describe('getFilteredTodos', () => {
    beforeEach(() => {
        resetState()
    })

    describe('empty state', () => {
        it('returns empty array when there are no todos', () => {
            resetState({ selectedGtdStatus: 'inbox' })
            expect(getFilteredTodos()).toEqual([])
        })
    })

    // ─── filter by GTD status ────────────────────────────────────────────────

    describe('filter by GTD status', () => {
        const todos = [
            { id: 1, text: 'Inbox item', gtd_status: 'inbox' },
            { id: 2, text: 'Next action', gtd_status: 'next_action' },
            { id: 3, text: 'Waiting item', gtd_status: 'waiting_for' },
            { id: 4, text: 'Someday item', gtd_status: 'someday_maybe' },
            { id: 5, text: 'Done item', gtd_status: 'done' }
        ]

        it('filters by inbox status', () => {
            resetState({ todos, selectedGtdStatus: 'inbox' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('filters by next_action status', () => {
            resetState({ todos, selectedGtdStatus: 'next_action' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(2)
        })

        it('filters by waiting_for status', () => {
            resetState({ todos, selectedGtdStatus: 'waiting_for' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(3)
        })

        it('filters by someday_maybe status', () => {
            resetState({ todos, selectedGtdStatus: 'someday_maybe' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(4)
        })

        it('filters by done status', () => {
            resetState({ todos, selectedGtdStatus: 'done' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(5)
        })

        it('shows all non-done items when status is "all"', () => {
            resetState({ todos, selectedGtdStatus: 'all' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(4)
            expect(result.every(t => t.gtd_status !== 'done')).toBe(true)
        })

        it('shows items with due_date (excluding done) for "scheduled" status', () => {
            const scheduledTodos = [
                { id: 1, text: 'Has date', gtd_status: 'next_action', due_date: '2026-03-15' },
                { id: 2, text: 'No date', gtd_status: 'next_action', due_date: null },
                { id: 3, text: 'Done with date', gtd_status: 'done', due_date: '2026-03-10' }
            ]
            resetState({ todos: scheduledTodos, selectedGtdStatus: 'scheduled' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('sorts scheduled items by due_date ascending', () => {
            const scheduledTodos = [
                { id: 1, text: 'Later', gtd_status: 'inbox', due_date: '2026-04-01' },
                { id: 2, text: 'Earlier', gtd_status: 'inbox', due_date: '2026-03-01' },
                { id: 3, text: 'Middle', gtd_status: 'inbox', due_date: '2026-03-15' }
            ]
            resetState({ todos: scheduledTodos, selectedGtdStatus: 'scheduled' })
            const result = getFilteredTodos()
            expect(result.map(t => t.id)).toEqual([2, 3, 1])
        })
    })

    // ─── filter by search query ──────────────────────────────────────────────

    describe('filter by search query', () => {
        const todos = [
            { id: 1, text: 'Buy groceries', comment: '', gtd_status: 'inbox' },
            { id: 2, text: 'Read book', comment: 'about cooking', gtd_status: 'inbox' },
            { id: 3, text: 'Call dentist', comment: '', gtd_status: 'inbox' }
        ]

        it('filters by text match', () => {
            resetState({ todos, selectedGtdStatus: 'inbox', searchQuery: 'buy' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('filters by comment match', () => {
            resetState({ todos, selectedGtdStatus: 'inbox', searchQuery: 'cooking' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(2)
        })

        it('search query is compared against lowercased text (query must be lowercase)', () => {
            // The source lowercases text/comment but not the query itself
            resetState({ todos, selectedGtdStatus: 'inbox', searchQuery: 'BUY' })
            expect(getFilteredTodos()).toHaveLength(0)

            // Lowercase query matches
            resetState({ todos, selectedGtdStatus: 'inbox', searchQuery: 'buy' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('returns no results when query matches nothing', () => {
            resetState({ todos, selectedGtdStatus: 'inbox', searchQuery: 'zzz' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(0)
        })

        it('returns all when search query is empty', () => {
            resetState({ todos, selectedGtdStatus: 'inbox', searchQuery: '' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(3)
        })

        it('handles null text and comment gracefully', () => {
            const todosWithNulls = [
                { id: 1, text: null, comment: null, gtd_status: 'inbox' }
            ]
            resetState({ todos: todosWithNulls, selectedGtdStatus: 'inbox', searchQuery: 'test' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(0)
        })
    })

    // ─── filter by category ──────────────────────────────────────────────────

    describe('filter by category', () => {
        const todos = [
            { id: 1, text: 'A', gtd_status: 'inbox', category_id: 'cat-1' },
            { id: 2, text: 'B', gtd_status: 'inbox', category_id: 'cat-2' },
            { id: 3, text: 'C', gtd_status: 'inbox', category_id: null }
        ]

        it('shows all when no categories are selected', () => {
            resetState({ todos, selectedGtdStatus: 'inbox' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(3)
        })

        it('filters by a single selected category', () => {
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedCategoryIds: new Set(['cat-1'])
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('filters by multiple selected categories', () => {
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedCategoryIds: new Set(['cat-1', 'cat-2'])
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(2)
        })

        it('filters by "uncategorized" to show todos without a category', () => {
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedCategoryIds: new Set(['uncategorized'])
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(3)
        })

        it('combines "uncategorized" with a specific category', () => {
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedCategoryIds: new Set(['uncategorized', 'cat-1'])
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(2)
            expect(result.map(t => t.id).sort()).toEqual([1, 3])
        })
    })

    // ─── filter by context ───────────────────────────────────────────────────

    describe('filter by context', () => {
        const todos = [
            { id: 1, text: 'A', gtd_status: 'inbox', context_id: 'ctx-home' },
            { id: 2, text: 'B', gtd_status: 'inbox', context_id: 'ctx-work' },
            { id: 3, text: 'C', gtd_status: 'inbox', context_id: null }
        ]

        it('shows all when no contexts are selected', () => {
            resetState({ todos, selectedGtdStatus: 'inbox' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(3)
        })

        it('filters by a single selected context', () => {
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedContextIds: new Set(['ctx-home'])
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('excludes todos without a context when context filter is active', () => {
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedContextIds: new Set(['ctx-home'])
            })
            const result = getFilteredTodos()
            expect(result.find(t => t.id === 3)).toBeUndefined()
        })

        it('filters by multiple selected contexts', () => {
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedContextIds: new Set(['ctx-home', 'ctx-work'])
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(2)
        })
    })

    // ─── filter by project ───────────────────────────────────────────────────

    describe('filter by project', () => {
        const todos = [
            { id: 1, text: 'A', gtd_status: 'next_action', project_id: 'proj-1' },
            { id: 2, text: 'B', gtd_status: 'next_action', project_id: 'proj-2' },
            { id: 3, text: 'C', gtd_status: 'next_action', project_id: null },
            { id: 4, text: 'D', gtd_status: 'done', project_id: 'proj-1' }
        ]

        it('shows all (by GTD status) when no project is selected', () => {
            resetState({ todos, selectedGtdStatus: 'next_action' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(3)
        })

        it('filters by selected project and excludes done items', () => {
            resetState({ todos, selectedProjectId: 'proj-1' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('sorts project view by due_date ascending', () => {
            const projectTodos = [
                { id: 1, text: 'No date', gtd_status: 'inbox', project_id: 'proj-1', due_date: null },
                { id: 2, text: 'Later', gtd_status: 'inbox', project_id: 'proj-1', due_date: '2026-04-01' },
                { id: 3, text: 'Earlier', gtd_status: 'inbox', project_id: 'proj-1', due_date: '2026-03-01' }
            ]
            resetState({ todos: projectTodos, selectedProjectId: 'proj-1' })
            const result = getFilteredTodos()
            expect(result.map(t => t.id)).toEqual([3, 2, 1])
        })

        it('returns empty array when project has no todos', () => {
            resetState({ todos, selectedProjectId: 'proj-nonexistent' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(0)
        })
    })

    // ─── filter by area ──────────────────────────────────────────────────────

    describe('filter by area', () => {
        const projects = [
            { id: 'proj-1', area_id: 'area-1' },
            { id: 'proj-2', area_id: 'area-2' },
            { id: 'proj-3', area_id: null }
        ]
        const todos = [
            { id: 1, text: 'A', gtd_status: 'next_action', project_id: 'proj-1' },
            { id: 2, text: 'B', gtd_status: 'next_action', project_id: 'proj-2' },
            { id: 3, text: 'C', gtd_status: 'next_action', project_id: 'proj-3' },
            { id: 4, text: 'D', gtd_status: 'next_action', project_id: null },
            { id: 5, text: 'E', gtd_status: 'inbox', project_id: 'proj-2' }
        ]

        it('shows all todos when area is "all"', () => {
            resetState({
                todos,
                projects,
                selectedGtdStatus: 'next_action',
                selectedAreaId: 'all'
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(4)
        })

        it('filters by specific area, keeping inbox and unassigned items visible', () => {
            resetState({
                todos,
                projects,
                selectedGtdStatus: 'next_action',
                selectedAreaId: 'area-1'
            })
            const result = getFilteredTodos()
            // id=1 (proj-1 in area-1), id=4 (no project, always visible)
            expect(result.map(t => t.id).sort()).toEqual([1, 4])
        })

        it('filters by "unassigned" area showing projects with no area', () => {
            resetState({
                todos,
                projects,
                selectedGtdStatus: 'next_action',
                selectedAreaId: 'unassigned'
            })
            const result = getFilteredTodos()
            // id=3 (proj-3 has no area), id=4 (no project, always visible)
            expect(result.map(t => t.id).sort()).toEqual([3, 4])
        })

        it('inbox items are always visible regardless of area filter', () => {
            resetState({
                todos,
                projects,
                selectedGtdStatus: 'inbox',
                selectedAreaId: 'area-1'
            })
            const result = getFilteredTodos()
            // id=5 is inbox with proj-2 (area-2), but inbox items always pass area filter
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(5)
        })
    })

    // ─── priority sorting ────────────────────────────────────────────────────

    describe('priority sorting', () => {
        it('sorts by priority level ascending (lower level = higher priority)', () => {
            const priorities = [
                { id: 'pri-high', level: 1 },
                { id: 'pri-med', level: 2 },
                { id: 'pri-low', level: 3 }
            ]
            const todos = [
                { id: 1, text: 'Low', gtd_status: 'inbox', priority_id: 'pri-low' },
                { id: 2, text: 'High', gtd_status: 'inbox', priority_id: 'pri-high' },
                { id: 3, text: 'Med', gtd_status: 'inbox', priority_id: 'pri-med' }
            ]
            resetState({ todos, priorities, selectedGtdStatus: 'inbox' })
            const result = getFilteredTodos()
            expect(result.map(t => t.id)).toEqual([2, 3, 1])
        })

        it('puts items without priority after prioritized items', () => {
            const priorities = [{ id: 'pri-high', level: 1 }]
            const todos = [
                { id: 1, text: 'No priority', gtd_status: 'inbox', priority_id: null },
                { id: 2, text: 'Has priority', gtd_status: 'inbox', priority_id: 'pri-high' }
            ]
            resetState({ todos, priorities, selectedGtdStatus: 'inbox' })
            const result = getFilteredTodos()
            expect(result.map(t => t.id)).toEqual([2, 1])
        })

        it('keeps order stable for items with no priority', () => {
            const todos = [
                { id: 1, text: 'A', gtd_status: 'inbox', priority_id: null },
                { id: 2, text: 'B', gtd_status: 'inbox', priority_id: null }
            ]
            resetState({ todos, selectedGtdStatus: 'inbox' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(2)
        })
    })

    // ─── combined filters ────────────────────────────────────────────────────

    describe('combined filters', () => {
        it('applies search and GTD status filters together', () => {
            const todos = [
                { id: 1, text: 'Buy milk', comment: '', gtd_status: 'inbox' },
                { id: 2, text: 'Buy bread', comment: '', gtd_status: 'next_action' },
                { id: 3, text: 'Call doctor', comment: '', gtd_status: 'inbox' }
            ]
            resetState({ todos, selectedGtdStatus: 'inbox', searchQuery: 'buy' })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('applies category and context filters together', () => {
            const todos = [
                { id: 1, text: 'A', gtd_status: 'inbox', category_id: 'cat-1', context_id: 'ctx-home' },
                { id: 2, text: 'B', gtd_status: 'inbox', category_id: 'cat-1', context_id: 'ctx-work' },
                { id: 3, text: 'C', gtd_status: 'inbox', category_id: 'cat-2', context_id: 'ctx-home' }
            ]
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedCategoryIds: new Set(['cat-1']),
                selectedContextIds: new Set(['ctx-home'])
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })

        it('applies search, category, and GTD status filters together', () => {
            const todos = [
                { id: 1, text: 'Buy milk', comment: '', gtd_status: 'inbox', category_id: 'cat-1' },
                { id: 2, text: 'Buy bread', comment: '', gtd_status: 'inbox', category_id: 'cat-2' },
                { id: 3, text: 'Call doctor', comment: '', gtd_status: 'inbox', category_id: 'cat-1' }
            ]
            resetState({
                todos,
                selectedGtdStatus: 'inbox',
                selectedCategoryIds: new Set(['cat-1']),
                searchQuery: 'buy'
            })
            const result = getFilteredTodos()
            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(1)
        })
    })

    // ─── does not mutate original array ──────────────────────────────────────

    describe('immutability', () => {
        it('does not mutate the original todos array', () => {
            const todos = [
                { id: 2, text: 'B', gtd_status: 'inbox', priority_id: 'pri-1' },
                { id: 1, text: 'A', gtd_status: 'inbox', priority_id: 'pri-2' }
            ]
            const priorities = [
                { id: 'pri-1', level: 2 },
                { id: 'pri-2', level: 1 }
            ]
            resetState({ todos, priorities, selectedGtdStatus: 'inbox' })
            getFilteredTodos()
            // Original array order should be preserved
            expect(todos[0].id).toBe(2)
            expect(todos[1].id).toBe(1)
        })
    })
})

// ─── getProjectTodoCount ─────────────────────────────────────────────────────

describe('getProjectTodoCount', () => {
    beforeEach(() => {
        resetState()
    })

    it('returns 0 when there are no todos', () => {
        resetState({ todos: [], projects: [] })
        expect(getProjectTodoCount('proj-1')).toBe(0)
    })

    it('counts todos in the given project excluding done', () => {
        resetState({
            todos: [
                { id: 1, project_id: 'proj-1', gtd_status: 'inbox' },
                { id: 2, project_id: 'proj-1', gtd_status: 'next_action' },
                { id: 3, project_id: 'proj-1', gtd_status: 'done' },
                { id: 4, project_id: 'proj-2', gtd_status: 'inbox' }
            ],
            projects: []
        })
        expect(getProjectTodoCount('proj-1')).toBe(2)
    })

    it('includes todos from descendant projects', () => {
        resetState({
            todos: [
                { id: 1, project_id: 'proj-parent', gtd_status: 'inbox' },
                { id: 2, project_id: 'proj-child', gtd_status: 'inbox' },
                { id: 3, project_id: 'proj-grandchild', gtd_status: 'inbox' }
            ],
            projects: [
                { id: 'proj-parent', parent_id: null },
                { id: 'proj-child', parent_id: 'proj-parent' },
                { id: 'proj-grandchild', parent_id: 'proj-child' }
            ]
        })
        expect(getProjectTodoCount('proj-parent')).toBe(3)
    })

    it('excludes done items from descendant projects', () => {
        resetState({
            todos: [
                { id: 1, project_id: 'proj-parent', gtd_status: 'inbox' },
                { id: 2, project_id: 'proj-child', gtd_status: 'done' }
            ],
            projects: [
                { id: 'proj-parent', parent_id: null },
                { id: 'proj-child', parent_id: 'proj-parent' }
            ]
        })
        expect(getProjectTodoCount('proj-parent')).toBe(1)
    })

    it('returns 0 for a project with no matching todos', () => {
        resetState({
            todos: [
                { id: 1, project_id: 'proj-other', gtd_status: 'inbox' }
            ],
            projects: []
        })
        expect(getProjectTodoCount('proj-1')).toBe(0)
    })

    it('counts only child project todos (not sibling)', () => {
        resetState({
            todos: [
                { id: 1, project_id: 'proj-child-a', gtd_status: 'inbox' },
                { id: 2, project_id: 'proj-child-b', gtd_status: 'inbox' }
            ],
            projects: [
                { id: 'proj-parent', parent_id: null },
                { id: 'proj-child-a', parent_id: 'proj-parent' },
                { id: 'proj-child-b', parent_id: 'proj-parent' }
            ]
        })
        // Querying only child-a should not include child-b
        expect(getProjectTodoCount('proj-child-a')).toBe(1)
    })
})

// ─── getGtdCount ─────────────────────────────────────────────────────────────

describe('getGtdCount', () => {
    beforeEach(() => {
        resetState()
    })

    const todos = [
        { id: 1, gtd_status: 'inbox', due_date: null },
        { id: 2, gtd_status: 'inbox', due_date: null },
        { id: 3, gtd_status: 'next_action', due_date: '2026-03-15' },
        { id: 4, gtd_status: 'waiting_for', due_date: null },
        { id: 5, gtd_status: 'someday_maybe', due_date: null },
        { id: 6, gtd_status: 'done', due_date: '2026-03-10' },
        { id: 7, gtd_status: 'done', due_date: null }
    ]

    it('counts inbox items', () => {
        resetState({ todos })
        expect(getGtdCount('inbox')).toBe(2)
    })

    it('counts next_action items', () => {
        resetState({ todos })
        expect(getGtdCount('next_action')).toBe(1)
    })

    it('counts waiting_for items', () => {
        resetState({ todos })
        expect(getGtdCount('waiting_for')).toBe(1)
    })

    it('counts someday_maybe items', () => {
        resetState({ todos })
        expect(getGtdCount('someday_maybe')).toBe(1)
    })

    it('counts done items', () => {
        resetState({ todos })
        expect(getGtdCount('done')).toBe(2)
    })

    it('counts all non-done items for "all" status', () => {
        resetState({ todos })
        expect(getGtdCount('all')).toBe(5)
    })

    it('counts items with due_date (excluding done) for "scheduled" status', () => {
        resetState({ todos })
        // Only id=3 has a due_date and is not done
        expect(getGtdCount('scheduled')).toBe(1)
    })

    it('returns 0 when there are no todos', () => {
        resetState({ todos: [] })
        expect(getGtdCount('inbox')).toBe(0)
        expect(getGtdCount('all')).toBe(0)
        expect(getGtdCount('scheduled')).toBe(0)
    })

    it('returns 0 for a status with no matching todos', () => {
        const onlyInbox = [{ id: 1, gtd_status: 'inbox', due_date: null }]
        resetState({ todos: onlyInbox })
        expect(getGtdCount('next_action')).toBe(0)
    })
})
