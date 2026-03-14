// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the store module
vi.mock('../../src/core/store.js', () => ({
    store: {
        state: {
            selectedGtdStatus: 'inbox',
            selectedCategoryIds: new Set(),
            selectedContextIds: new Set(),
            selectedProjectId: null,
            categories: [],
            contexts: [],
            priorities: [],
            projects: []
        }
    }
}))

// Mock the projects module
vi.mock('../../src/services/projects.js', () => ({
    getProjectPath: vi.fn(() => [])
}))

import {
    getExportViewName,
    getExportFileName,
    downloadFile,
    exportTodosAsText,
    exportTodosAsJSON,
    exportTodosAsCSV,
    exportTodosAsXML,
    exportTodos
} from '../../src/services/export.js'
import { store } from '../../src/core/store.js'
import { getProjectPath } from '../../src/services/projects.js'

// ─── Test helpers ────────────────────────────────────────────────────────────

function resetStoreState(overrides = {}) {
    Object.assign(store.state, {
        selectedGtdStatus: 'inbox',
        selectedCategoryIds: new Set(),
        selectedContextIds: new Set(),
        selectedProjectId: null,
        categories: [],
        contexts: [],
        priorities: [],
        projects: [],
        ...overrides
    })
}

function makeTodo(overrides = {}) {
    return {
        id: 'todo-1',
        text: 'Buy groceries',
        gtd_status: 'inbox',
        due_date: null,
        category_id: null,
        project_id: null,
        context_id: null,
        priority_id: null,
        comment: null,
        created_at: '2025-06-01T10:00:00Z',
        ...overrides
    }
}

// ─── getExportViewName ───────────────────────────────────────────────────────

describe('getExportViewName', () => {
    beforeEach(() => {
        resetStoreState()
        vi.clearAllMocks()
        getProjectPath.mockReturnValue([])
    })

    it('returns GTD label for inbox', () => {
        expect(getExportViewName()).toBe('Inbox')
    })

    it('returns GTD label for next_action', () => {
        resetStoreState({ selectedGtdStatus: 'next_action' })
        expect(getExportViewName()).toBe('Next Actions')
    })

    it('returns GTD label for scheduled', () => {
        resetStoreState({ selectedGtdStatus: 'scheduled' })
        expect(getExportViewName()).toBe('Scheduled')
    })

    it('returns GTD label for waiting_for', () => {
        resetStoreState({ selectedGtdStatus: 'waiting_for' })
        expect(getExportViewName()).toBe('Waiting For')
    })

    it('returns GTD label for someday_maybe', () => {
        resetStoreState({ selectedGtdStatus: 'someday_maybe' })
        expect(getExportViewName()).toBe('Someday/Maybe')
    })

    it('returns GTD label for done', () => {
        resetStoreState({ selectedGtdStatus: 'done' })
        expect(getExportViewName()).toBe('Done')
    })

    it('returns GTD label for all', () => {
        resetStoreState({ selectedGtdStatus: 'all' })
        expect(getExportViewName()).toBe('All')
    })

    it('falls back to raw status for unknown GTD status', () => {
        resetStoreState({ selectedGtdStatus: 'custom_status' })
        expect(getExportViewName()).toBe('custom_status')
    })

    it('includes category names when categories are selected', () => {
        resetStoreState({
            selectedCategoryIds: new Set(['cat-1']),
            categories: [{ id: 'cat-1', name: 'Work' }]
        })
        expect(getExportViewName()).toBe('Inbox | Categories: Work')
    })

    it('handles uncategorized category', () => {
        resetStoreState({
            selectedCategoryIds: new Set(['uncategorized'])
        })
        expect(getExportViewName()).toBe('Inbox | Categories: Uncategorized')
    })

    it('handles multiple categories', () => {
        resetStoreState({
            selectedCategoryIds: new Set(['cat-1', 'cat-2']),
            categories: [
                { id: 'cat-1', name: 'Work' },
                { id: 'cat-2', name: 'Personal' }
            ]
        })
        const result = getExportViewName()
        expect(result).toContain('Categories: ')
        expect(result).toContain('Work')
        expect(result).toContain('Personal')
    })

    it('falls back to id for unknown category', () => {
        resetStoreState({
            selectedCategoryIds: new Set(['unknown-id']),
            categories: []
        })
        expect(getExportViewName()).toBe('Inbox | Categories: unknown-id')
    })

    it('includes context names when contexts are selected', () => {
        resetStoreState({
            selectedContextIds: new Set(['ctx-1']),
            contexts: [{ id: 'ctx-1', name: '@home' }]
        })
        expect(getExportViewName()).toBe('Inbox | Contexts: @home')
    })

    it('falls back to id for unknown context', () => {
        resetStoreState({
            selectedContextIds: new Set(['unknown-ctx']),
            contexts: []
        })
        expect(getExportViewName()).toBe('Inbox | Contexts: unknown-ctx')
    })

    it('includes project name when project is selected', () => {
        resetStoreState({ selectedProjectId: 'proj-1' })
        getProjectPath.mockReturnValue([{ name: 'My Project' }])
        expect(getExportViewName()).toBe('Inbox | Project: My Project')
    })

    it('includes full project hierarchy path', () => {
        resetStoreState({ selectedProjectId: 'proj-child' })
        getProjectPath.mockReturnValue([
            { name: 'Parent' },
            { name: 'Child' }
        ])
        expect(getExportViewName()).toBe('Inbox | Project: Parent > Child')
    })

    it('omits project when path is empty', () => {
        resetStoreState({ selectedProjectId: 'proj-1' })
        getProjectPath.mockReturnValue([])
        expect(getExportViewName()).toBe('Inbox')
    })

    it('combines all parts with pipe separator', () => {
        resetStoreState({
            selectedGtdStatus: 'next_action',
            selectedCategoryIds: new Set(['cat-1']),
            selectedContextIds: new Set(['ctx-1']),
            selectedProjectId: 'proj-1',
            categories: [{ id: 'cat-1', name: 'Work' }],
            contexts: [{ id: 'ctx-1', name: '@office' }]
        })
        getProjectPath.mockReturnValue([{ name: 'Big Project' }])
        const result = getExportViewName()
        expect(result).toBe('Next Actions | Categories: Work | Contexts: @office | Project: Big Project')
    })
})

// ─── getExportFileName ───────────────────────────────────────────────────────

describe('getExportFileName', () => {
    beforeEach(() => {
        resetStoreState()
    })

    it('returns date and status', () => {
        const result = getExportFileName()
        // Should match YYYY-MM-DD-status pattern
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-inbox$/)
    })

    it('replaces underscores with hyphens in status', () => {
        resetStoreState({ selectedGtdStatus: 'next_action' })
        const result = getExportFileName()
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-next-action$/)
    })

    it('handles status without underscores', () => {
        resetStoreState({ selectedGtdStatus: 'done' })
        const result = getExportFileName()
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-done$/)
    })
})

// ─── downloadFile ────────────────────────────────────────────────────────────

describe('downloadFile', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock URL methods
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock-url'),
            revokeObjectURL: vi.fn()
        })
    })

    it('creates a blob and triggers download', () => {
        const clickSpy = vi.fn()
        const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
        const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: clickSpy
        })

        downloadFile('test content', 'test.txt', 'text/plain')

        expect(URL.createObjectURL).toHaveBeenCalled()
        expect(clickSpy).toHaveBeenCalled()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

        appendChildSpy.mockRestore()
        removeChildSpy.mockRestore()
    })

    it('sets correct filename on link', () => {
        let capturedLink = null
        const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
        const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: vi.fn(),
            set _download(val) { this.download = val }
        })

        const link = document.createElement('a')
        downloadFile('content', 'myfile.json', 'application/json')

        appendChildSpy.mockRestore()
        removeChildSpy.mockRestore()
    })
})

// ─── exportTodosAsText ───────────────────────────────────────────────────────

describe('exportTodosAsText', () => {
    let downloadSpy

    beforeEach(() => {
        resetStoreState()
        vi.clearAllMocks()
        getProjectPath.mockReturnValue([])
        // Mock downloadFile by stubbing URL and DOM
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn()
        })
        vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: vi.fn()
        })
        vi.stubGlobal('alert', vi.fn())
    })

    it('alerts when no todos to export', () => {
        exportTodosAsText([])
        expect(alert).toHaveBeenCalledWith('No todos to export')
    })

    it('does not download when no todos', () => {
        exportTodosAsText([])
        expect(URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('includes header with view name', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo()])
        })
        expect(blobContent).toContain('TodoList Export - Inbox')
    })

    it('includes separator line', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo()])
        })
        expect(blobContent).toContain('\u2500'.repeat(40))
    })

    it('shows unchecked checkbox for non-done todos', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ gtd_status: 'inbox' })])
        })
        expect(blobContent).toContain('[ ] Buy groceries')
    })

    it('shows checked checkbox for done todos', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ gtd_status: 'done' })])
        })
        expect(blobContent).toContain('[x] Buy groceries')
    })

    it('includes due date metadata', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ due_date: '2025-12-31' })])
        })
        expect(blobContent).toContain('Due: 2025-12-31')
    })

    it('includes category metadata', () => {
        resetStoreState({
            categories: [{ id: 'cat-1', name: 'Work' }]
        })
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ category_id: 'cat-1' })])
        })
        expect(blobContent).toContain('Category: Work')
    })

    it('includes project metadata', () => {
        getProjectPath.mockReturnValue([{ name: 'Project A' }])
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ project_id: 'proj-1' })])
        })
        expect(blobContent).toContain('Project: Project A')
    })

    it('includes context metadata', () => {
        resetStoreState({
            contexts: [{ id: 'ctx-1', name: '@home' }]
        })
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ context_id: 'ctx-1' })])
        })
        expect(blobContent).toContain('Context: @home')
    })

    it('includes priority metadata', () => {
        resetStoreState({
            priorities: [{ id: 'pri-1', name: 'High' }]
        })
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ priority_id: 'pri-1' })])
        })
        expect(blobContent).toContain('Priority: High')
    })

    it('includes comment as note', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ comment: 'Remember milk' })])
        })
        expect(blobContent).toContain('Note: Remember milk')
    })

    it('joins metadata with pipe separator', () => {
        resetStoreState({
            categories: [{ id: 'cat-1', name: 'Work' }],
            contexts: [{ id: 'ctx-1', name: '@office' }]
        })
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo({ category_id: 'cat-1', context_id: 'ctx-1' })])
        })
        expect(blobContent).toContain('Category: Work | Context: @office')
    })

    it('includes summary with total and completed counts', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsText([
                makeTodo({ id: '1', gtd_status: 'inbox' }),
                makeTodo({ id: '2', gtd_status: 'done' }),
                makeTodo({ id: '3', gtd_status: 'done' })
            ])
        })
        expect(blobContent).toContain('Total: 3 | Completed: 2')
    })

    it('handles todo with no metadata', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsText([makeTodo()])
        })
        expect(blobContent).toContain('[ ] Buy groceries')
        expect(blobContent).toContain('Total: 1 | Completed: 0')
    })
})

// ─── exportTodosAsJSON ───────────────────────────────────────────────────────

describe('exportTodosAsJSON', () => {
    beforeEach(() => {
        resetStoreState()
        vi.clearAllMocks()
        getProjectPath.mockReturnValue([])
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn()
        })
        vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: vi.fn()
        })
        vi.stubGlobal('alert', vi.fn())
    })

    it('alerts when no todos to export', () => {
        exportTodosAsJSON([])
        expect(alert).toHaveBeenCalledWith('No todos to export')
    })

    it('produces valid JSON', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsJSON([makeTodo()])
        })
        expect(() => JSON.parse(blobContent)).not.toThrow()
    })

    it('includes metadata with view name', () => {
        const data = captureJSON(() => {
            exportTodosAsJSON([makeTodo()])
        })
        expect(data.metadata.view).toBe('Inbox')
    })

    it('includes metadata with total count', () => {
        const data = captureJSON(() => {
            exportTodosAsJSON([makeTodo(), makeTodo({ id: '2' })])
        })
        expect(data.metadata.totalCount).toBe(2)
    })

    it('includes metadata with completed count', () => {
        const data = captureJSON(() => {
            exportTodosAsJSON([
                makeTodo({ id: '1', gtd_status: 'done' }),
                makeTodo({ id: '2', gtd_status: 'inbox' })
            ])
        })
        expect(data.metadata.completedCount).toBe(1)
    })

    it('maps todo fields correctly', () => {
        resetStoreState({
            categories: [{ id: 'cat-1', name: 'Work' }],
            contexts: [{ id: 'ctx-1', name: '@office' }],
            priorities: [{ id: 'pri-1', name: 'High' }]
        })
        getProjectPath.mockReturnValue([{ name: 'Project X' }])

        const data = captureJSON(() => {
            exportTodosAsJSON([makeTodo({
                category_id: 'cat-1',
                context_id: 'ctx-1',
                priority_id: 'pri-1',
                project_id: 'proj-1',
                due_date: '2025-12-31',
                comment: 'A note',
                gtd_status: 'done'
            })])
        })

        const todo = data.todos[0]
        expect(todo.id).toBe('todo-1')
        expect(todo.text).toBe('Buy groceries')
        expect(todo.completed).toBe(true)
        expect(todo.gtdStatus).toBe('done')
        expect(todo.dueDate).toBe('2025-12-31')
        expect(todo.category).toBe('Work')
        expect(todo.project).toBe('Project X')
        expect(todo.context).toBe('@office')
        expect(todo.priority).toBe('High')
        expect(todo.comment).toBe('A note')
        expect(todo.createdAt).toBe('2025-06-01T10:00:00Z')
    })

    it('sets null for missing optional fields', () => {
        const data = captureJSON(() => {
            exportTodosAsJSON([makeTodo()])
        })

        const todo = data.todos[0]
        expect(todo.dueDate).toBeNull()
        expect(todo.category).toBeNull()
        expect(todo.project).toBeNull()
        expect(todo.context).toBeNull()
        expect(todo.priority).toBeNull()
        expect(todo.comment).toBeNull()
    })

    it('sets completed to false for non-done status', () => {
        const data = captureJSON(() => {
            exportTodosAsJSON([makeTodo({ gtd_status: 'next_action' })])
        })
        expect(data.todos[0].completed).toBe(false)
    })
})

// ─── exportTodosAsCSV ────────────────────────────────────────────────────────

describe('exportTodosAsCSV', () => {
    beforeEach(() => {
        resetStoreState()
        vi.clearAllMocks()
        getProjectPath.mockReturnValue([])
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn()
        })
        vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: vi.fn()
        })
        vi.stubGlobal('alert', vi.fn())
    })

    it('alerts when no todos to export', () => {
        exportTodosAsCSV([])
        expect(alert).toHaveBeenCalledWith('No todos to export')
    })

    it('includes CSV header row', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([makeTodo()])
        })
        const firstLine = blobContent.split('\n')[0]
        expect(firstLine).toBe('ID,Text,Completed,GTD Status,Due Date,Category,Project,Context,Priority,Comment,Created At')
    })

    it('maps todo to correct CSV row', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([makeTodo()])
        })
        const lines = blobContent.split('\n')
        expect(lines.length).toBe(2) // header + 1 data row
        expect(lines[1]).toContain('todo-1')
        expect(lines[1]).toContain('Buy groceries')
        expect(lines[1]).toContain('No') // not completed
    })

    it('shows Yes for completed todos', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([makeTodo({ gtd_status: 'done' })])
        })
        const lines = blobContent.split('\n')
        expect(lines[1]).toContain('Yes')
    })

    it('escapes values containing commas', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([makeTodo({ text: 'Buy milk, eggs' })])
        })
        expect(blobContent).toContain('"Buy milk, eggs"')
    })

    it('escapes values containing double quotes', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([makeTodo({ text: 'Read "War and Peace"' })])
        })
        expect(blobContent).toContain('"Read ""War and Peace"""')
    })

    it('escapes values containing newlines', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([makeTodo({ comment: 'Line 1\nLine 2' })])
        })
        expect(blobContent).toContain('"Line 1\nLine 2"')
    })

    it('handles null and undefined values', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([makeTodo({ due_date: null, comment: undefined })])
        })
        // Should not contain "null" or "undefined" as strings
        const dataRow = blobContent.split('\n')[1]
        expect(dataRow).not.toContain('null')
        expect(dataRow).not.toContain('undefined')
    })

    it('includes category and context names', () => {
        resetStoreState({
            categories: [{ id: 'cat-1', name: 'Work' }],
            contexts: [{ id: 'ctx-1', name: '@home' }]
        })
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([makeTodo({ category_id: 'cat-1', context_id: 'ctx-1' })])
        })
        expect(blobContent).toContain('Work')
        expect(blobContent).toContain('@home')
    })

    it('exports multiple todos as multiple rows', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsCSV([
                makeTodo({ id: '1', text: 'Task 1' }),
                makeTodo({ id: '2', text: 'Task 2' }),
                makeTodo({ id: '3', text: 'Task 3' })
            ])
        })
        const lines = blobContent.split('\n')
        expect(lines.length).toBe(4) // header + 3 data rows
    })
})

// ─── exportTodosAsXML ────────────────────────────────────────────────────────

describe('exportTodosAsXML', () => {
    beforeEach(() => {
        resetStoreState()
        vi.clearAllMocks()
        getProjectPath.mockReturnValue([])
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn()
        })
        vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: vi.fn()
        })
        vi.stubGlobal('alert', vi.fn())
    })

    it('alerts when no todos to export', () => {
        exportTodosAsXML([])
        expect(alert).toHaveBeenCalledWith('No todos to export')
    })

    it('starts with XML declaration', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo()])
        })
        expect(blobContent).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    })

    it('wraps content in todolist root element', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo()])
        })
        expect(blobContent).toContain('<todolist>')
        expect(blobContent).toContain('</todolist>')
    })

    it('includes metadata section', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo()])
        })
        expect(blobContent).toContain('<metadata>')
        expect(blobContent).toContain('<view>Inbox</view>')
        expect(blobContent).toContain('<totalCount>1</totalCount>')
        expect(blobContent).toContain('<completedCount>0</completedCount>')
    })

    it('includes todo elements with correct fields', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo()])
        })
        expect(blobContent).toContain('<todo>')
        expect(blobContent).toContain('<id>todo-1</id>')
        expect(blobContent).toContain('<text>Buy groceries</text>')
        expect(blobContent).toContain('<completed>false</completed>')
        expect(blobContent).toContain('<gtdStatus>inbox</gtdStatus>')
    })

    it('shows completed true for done todos', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo({ gtd_status: 'done' })])
        })
        expect(blobContent).toContain('<completed>true</completed>')
    })

    it('includes optional fields only when present', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo()])
        })
        expect(blobContent).not.toContain('<dueDate>')
        expect(blobContent).not.toContain('<category>')
        expect(blobContent).not.toContain('<project>')
        expect(blobContent).not.toContain('<context>')
        expect(blobContent).not.toContain('<priority>')
        expect(blobContent).not.toContain('<comment>')
    })

    it('includes optional fields when present', () => {
        resetStoreState({
            categories: [{ id: 'cat-1', name: 'Work' }],
            contexts: [{ id: 'ctx-1', name: '@office' }],
            priorities: [{ id: 'pri-1', name: 'High' }]
        })
        getProjectPath.mockReturnValue([{ name: 'Project X' }])

        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo({
                due_date: '2025-12-31',
                category_id: 'cat-1',
                project_id: 'proj-1',
                context_id: 'ctx-1',
                priority_id: 'pri-1',
                comment: 'A note'
            })])
        })
        expect(blobContent).toContain('<dueDate>2025-12-31</dueDate>')
        expect(blobContent).toContain('<category>Work</category>')
        expect(blobContent).toContain('<project>Project X</project>')
        expect(blobContent).toContain('<context>@office</context>')
        expect(blobContent).toContain('<priority>High</priority>')
        expect(blobContent).toContain('<comment>A note</comment>')
    })

    it('escapes XML special characters in text', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo({ text: 'Buy <milk> & "eggs"' })])
        })
        expect(blobContent).toContain('<text>Buy &lt;milk&gt; &amp; &quot;eggs&quot;</text>')
    })

    it('escapes ampersand in comments', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo({ comment: 'Tom & Jerry' })])
        })
        expect(blobContent).toContain('<comment>Tom &amp; Jerry</comment>')
    })

    it('escapes single quotes', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([makeTodo({ text: "it's done" })])
        })
        expect(blobContent).toContain('<text>it&apos;s done</text>')
    })

    it('exports multiple todos', () => {
        const blobContent = captureBlob(() => {
            exportTodosAsXML([
                makeTodo({ id: '1', text: 'Task 1' }),
                makeTodo({ id: '2', text: 'Task 2' })
            ])
        })
        expect(blobContent).toContain('<totalCount>2</totalCount>')
        expect(blobContent).toContain('<text>Task 1</text>')
        expect(blobContent).toContain('<text>Task 2</text>')
    })
})

// ─── exportTodos (dispatcher) ────────────────────────────────────────────────

describe('exportTodos', () => {
    beforeEach(() => {
        resetStoreState()
        vi.clearAllMocks()
        getProjectPath.mockReturnValue([])
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn()
        })
        vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: vi.fn()
        })
        vi.stubGlobal('alert', vi.fn())
    })

    it('dispatches to text format by default', () => {
        const blobContent = captureBlob(() => {
            exportTodos([makeTodo()])
        })
        // Text format has the separator line
        expect(blobContent).toContain('TodoList Export')
    })

    it('dispatches to json format', () => {
        const blobContent = captureBlob(() => {
            exportTodos([makeTodo()], 'json')
        })
        expect(() => JSON.parse(blobContent)).not.toThrow()
    })

    it('dispatches to csv format', () => {
        const blobContent = captureBlob(() => {
            exportTodos([makeTodo()], 'csv')
        })
        expect(blobContent).toContain('ID,Text,Completed')
    })

    it('dispatches to xml format', () => {
        const blobContent = captureBlob(() => {
            exportTodos([makeTodo()], 'xml')
        })
        expect(blobContent).toContain('<?xml')
    })

    it('is case-insensitive for format', () => {
        const blobContent = captureBlob(() => {
            exportTodos([makeTodo()], 'JSON')
        })
        expect(() => JSON.parse(blobContent)).not.toThrow()
    })

    it('defaults to text for unknown format', () => {
        const blobContent = captureBlob(() => {
            exportTodos([makeTodo()], 'yaml')
        })
        expect(blobContent).toContain('TodoList Export')
    })
})

// ─── Blob capture helper ─────────────────────────────────────────────────────

/**
 * Captures the content passed to Blob constructor during the callback.
 * @param {Function} fn - Function that triggers a download
 * @returns {string} The content passed to Blob
 */
function captureBlob(fn) {
    let capturedContent = ''
    const OriginalBlob = globalThis.Blob
    vi.stubGlobal('Blob', class MockBlob {
        constructor(parts, options) {
            capturedContent = parts.join('')
        }
    })
    fn()
    vi.stubGlobal('Blob', OriginalBlob)
    return capturedContent
}

/**
 * Captures and parses JSON content from a Blob during the callback.
 * @param {Function} fn - Function that triggers a JSON download
 * @returns {object} Parsed JSON data
 */
function captureJSON(fn) {
    return JSON.parse(captureBlob(fn))
}
