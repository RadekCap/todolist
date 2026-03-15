import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'

vi.mock('../../src/services/auth.js', () => ({
    encrypt: vi.fn(v => Promise.resolve(`enc:${v}`)),
    decrypt: vi.fn(v => Promise.resolve(v?.startsWith?.('enc:') ? v.slice(4) : v))
}))

vi.mock('../../src/services/projects.js', () => ({
    addProject: vi.fn((name) => Promise.resolve({ id: 'proj-new', name, parent_id: null, sort_order: 0 })),
    reorderProjects: vi.fn(() => Promise.resolve())
}))

vi.mock('../../src/services/todos.js', () => ({
    addTodo: vi.fn(() => Promise.resolve({ id: 'todo-new' }))
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

const mockSupabase = createSupabaseMock()
vi.mock('../../src/core/supabase.js', () => ({
    supabase: mockSupabase
}))

const {
    loadProjectTemplates, addProjectTemplate, addTemplateItem,
    deleteTemplateItem, deleteProjectTemplate, renameProjectTemplate,
    createProjectFromTemplate
} = await import('../../src/services/project-templates.js')

const { addProject, reorderProjects } = await import('../../src/services/projects.js')
const { addTodo } = await import('../../src/services/todos.js')

describe('project-templates', () => {
    beforeEach(() => {
        store.reset()
        mockSupabase._reset()
        vi.clearAllMocks()
        store.set('currentUser', { id: 'user-1' })
        store.set('projectTemplates', [
            {
                id: 'tmpl-1', name: 'Sprint Template', items: [
                    { id: 'item-1', template_id: 'tmpl-1', text: 'Design', sort_order: 0 },
                    { id: 'item-2', template_id: 'tmpl-1', text: 'Implement', sort_order: 1 }
                ]
            },
            {
                id: 'tmpl-2', name: 'Empty Template', items: []
            }
        ])
        store.set('projects', [
            { id: 'proj-1', name: 'Existing', parent_id: null, sort_order: 0 }
        ])
    })

    // ─── loadProjectTemplates ─────────────────────────────────────────────

    describe('loadProjectTemplates', () => {
        it('fetches templates and items from Supabase', async () => {
            mockSupabase._queueResult([
                { id: 'tmpl-a', name: 'enc:Alpha' }
            ])
            mockSupabase._queueResult([
                { id: 'itm-1', template_id: 'tmpl-a', text: 'enc:Task A', sort_order: 0 }
            ])

            await loadProjectTemplates()

            expect(mockSupabase.from).toHaveBeenCalledWith('project_templates')
            expect(mockSupabase.from).toHaveBeenCalledWith('project_template_items')
        })

        it('decrypts template names and item texts', async () => {
            mockSupabase._queueResult([
                { id: 'tmpl-a', name: 'enc:Alpha' }
            ])
            mockSupabase._queueResult([
                { id: 'itm-1', template_id: 'tmpl-a', text: 'enc:Task A', sort_order: 0 }
            ])

            const result = await loadProjectTemplates()

            expect(result[0].name).toBe('Alpha')
            expect(result[0].items[0].text).toBe('Task A')
        })

        it('nests items into their parent templates', async () => {
            mockSupabase._queueResult([
                { id: 'tmpl-a', name: 'enc:A' },
                { id: 'tmpl-b', name: 'enc:B' }
            ])
            mockSupabase._queueResult([
                { id: 'itm-1', template_id: 'tmpl-a', text: 'enc:X', sort_order: 0 },
                { id: 'itm-2', template_id: 'tmpl-b', text: 'enc:Y', sort_order: 0 },
                { id: 'itm-3', template_id: 'tmpl-a', text: 'enc:Z', sort_order: 1 }
            ])

            const result = await loadProjectTemplates()

            expect(result[0].items).toHaveLength(2)
            expect(result[1].items).toHaveLength(1)
            expect(result[0].items[0].text).toBe('X')
            expect(result[0].items[1].text).toBe('Z')
            expect(result[1].items[0].text).toBe('Y')
        })

        it('stores result in store as projectTemplates', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-a', name: 'enc:A' }])
            mockSupabase._queueResult([])

            await loadProjectTemplates()

            const stored = store.get('projectTemplates')
            expect(stored).toHaveLength(1)
            expect(stored[0].name).toBe('A')
        })

        it('emits PROJECT_TEMPLATES_LOADED event', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-a', name: 'enc:A' }])
            mockSupabase._queueResult([])
            const spy = vi.fn()
            events.on(Events.PROJECT_TEMPLATES_LOADED, spy)

            await loadProjectTemplates()

            expect(spy).toHaveBeenCalledTimes(1)
            events.off(Events.PROJECT_TEMPLATES_LOADED, spy)
        })

        it('returns the decrypted templates with nested items', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-a', name: 'enc:A' }])
            mockSupabase._queueResult([
                { id: 'itm-1', template_id: 'tmpl-a', text: 'enc:Task', sort_order: 0 }
            ])

            const result = await loadProjectTemplates()

            expect(result).toHaveLength(1)
            expect(result[0]).toEqual(expect.objectContaining({
                id: 'tmpl-a',
                name: 'A',
                items: [expect.objectContaining({ id: 'itm-1', text: 'Task' })]
            }))
        })

        it('throws on templates fetch error', async () => {
            mockSupabase._queueResult(null, { message: 'DB error' })

            await expect(loadProjectTemplates()).rejects.toEqual({ message: 'DB error' })
        })

        it('throws on items fetch error', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-a', name: 'enc:A' }])
            mockSupabase._queueResult(null, { message: 'Items error' })

            await expect(loadProjectTemplates()).rejects.toEqual({ message: 'Items error' })
        })

        it('handles templates with no items', async () => {
            mockSupabase._queueResult([
                { id: 'tmpl-a', name: 'enc:Lonely' }
            ])
            mockSupabase._queueResult([])

            const result = await loadProjectTemplates()

            expect(result[0].items).toEqual([])
            expect(result[0].name).toBe('Lonely')
        })
    })

    // ─── addProjectTemplate ───────────────────────────────────────────────

    describe('addProjectTemplate', () => {
        it('encrypts name before inserting', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new', name: 'enc:My Template' }])

            await addProjectTemplate('My Template')

            expect(mockSupabase.insert).toHaveBeenCalledWith({
                user_id: 'user-1',
                name: 'enc:My Template'
            })
        })

        it('inserts to Supabase with user_id', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new', name: 'enc:Test' }])

            await addProjectTemplate('Test')

            expect(mockSupabase.from).toHaveBeenCalledWith('project_templates')
            expect(mockSupabase.insert).toHaveBeenCalled()
        })

        it('adds template with empty items array to store', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new', name: 'enc:New' }])

            await addProjectTemplate('New')

            const templates = store.get('projectTemplates')
            const added = templates.find(t => t.id === 'tmpl-new')
            expect(added).toBeDefined()
            expect(added.items).toEqual([])
        })

        it('stores decrypted name in local state', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new', name: 'enc:Decrypted Name' }])

            await addProjectTemplate('Decrypted Name')

            const templates = store.get('projectTemplates')
            const added = templates.find(t => t.id === 'tmpl-new')
            expect(added.name).toBe('Decrypted Name')
        })

        it('emits PROJECT_TEMPLATE_ADDED event', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new', name: 'enc:Test' }])
            const spy = vi.fn()
            events.on(Events.PROJECT_TEMPLATE_ADDED, spy)

            await addProjectTemplate('Test')

            expect(spy).toHaveBeenCalledTimes(1)
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'tmpl-new', name: 'Test' }))
            events.off(Events.PROJECT_TEMPLATE_ADDED, spy)
        })

        it('returns the created template', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new', name: 'enc:Result' }])

            const result = await addProjectTemplate('Result')

            expect(result).toEqual(expect.objectContaining({
                id: 'tmpl-new',
                name: 'Result',
                items: []
            }))
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'Insert failed' })

            await expect(addProjectTemplate('Fail')).rejects.toEqual({ message: 'Insert failed' })
        })
    })

    // ─── addTemplateItem ──────────────────────────────────────────────────

    describe('addTemplateItem', () => {
        it('encrypts text before inserting', async () => {
            mockSupabase._queueResult([{ id: 'itm-new', template_id: 'tmpl-1', text: 'enc:New Task', sort_order: 2 }])

            await addTemplateItem('tmpl-1', 'New Task')

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                text: 'enc:New Task'
            }))
        })

        it('sets sort_order based on existing items count', async () => {
            mockSupabase._queueResult([{ id: 'itm-new', template_id: 'tmpl-1', text: 'enc:Third', sort_order: 2 }])

            await addTemplateItem('tmpl-1', 'Third')

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                sort_order: 2
            }))
        })

        it('inserts to Supabase with template_id, user_id, text, sort_order', async () => {
            mockSupabase._queueResult([{ id: 'itm-new', template_id: 'tmpl-1', text: 'enc:Task', sort_order: 2 }])

            await addTemplateItem('tmpl-1', 'Task')

            expect(mockSupabase.from).toHaveBeenCalledWith('project_template_items')
            expect(mockSupabase.insert).toHaveBeenCalledWith({
                template_id: 'tmpl-1',
                user_id: 'user-1',
                text: 'enc:Task',
                sort_order: 2
            })
        })

        it('adds item to correct template in store', async () => {
            mockSupabase._queueResult([{ id: 'itm-new', template_id: 'tmpl-1', text: 'enc:Added', sort_order: 2 }])

            await addTemplateItem('tmpl-1', 'Added')

            const templates = store.get('projectTemplates')
            const tmpl1 = templates.find(t => t.id === 'tmpl-1')
            expect(tmpl1.items).toHaveLength(3)
            expect(tmpl1.items[2].id).toBe('itm-new')
        })

        it('stores decrypted text in local state', async () => {
            mockSupabase._queueResult([{ id: 'itm-new', template_id: 'tmpl-1', text: 'enc:Plain', sort_order: 2 }])

            await addTemplateItem('tmpl-1', 'Plain')

            const templates = store.get('projectTemplates')
            const tmpl1 = templates.find(t => t.id === 'tmpl-1')
            const item = tmpl1.items.find(i => i.id === 'itm-new')
            expect(item.text).toBe('Plain')
        })

        it('emits PROJECT_TEMPLATES_LOADED event', async () => {
            mockSupabase._queueResult([{ id: 'itm-new', template_id: 'tmpl-1', text: 'enc:X', sort_order: 2 }])
            const spy = vi.fn()
            events.on(Events.PROJECT_TEMPLATES_LOADED, spy)

            await addTemplateItem('tmpl-1', 'X')

            expect(spy).toHaveBeenCalledTimes(1)
            events.off(Events.PROJECT_TEMPLATES_LOADED, spy)
        })

        it('returns the created item', async () => {
            mockSupabase._queueResult([{ id: 'itm-new', template_id: 'tmpl-1', text: 'enc:Result', sort_order: 2 }])

            const result = await addTemplateItem('tmpl-1', 'Result')

            expect(result).toEqual(expect.objectContaining({
                id: 'itm-new',
                text: 'Result'
            }))
        })

        it('sets sort_order to 0 for first item', async () => {
            mockSupabase._queueResult([{ id: 'itm-new', template_id: 'tmpl-2', text: 'enc:First', sort_order: 0 }])

            await addTemplateItem('tmpl-2', 'First')

            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                sort_order: 0
            }))
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'Item insert failed' })

            await expect(addTemplateItem('tmpl-1', 'Fail')).rejects.toEqual({ message: 'Item insert failed' })
        })
    })

    // ─── deleteTemplateItem ───────────────────────────────────────────────

    describe('deleteTemplateItem', () => {
        it('deletes from Supabase by item ID', async () => {
            mockSupabase._queueResult(null)

            await deleteTemplateItem('tmpl-1', 'item-1')

            expect(mockSupabase.from).toHaveBeenCalledWith('project_template_items')
            expect(mockSupabase.delete).toHaveBeenCalled()
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'item-1')
        })

        it('removes item from correct template in store', async () => {
            mockSupabase._queueResult(null)

            await deleteTemplateItem('tmpl-1', 'item-1')

            const templates = store.get('projectTemplates')
            const tmpl1 = templates.find(t => t.id === 'tmpl-1')
            expect(tmpl1.items).toHaveLength(1)
            expect(tmpl1.items[0].id).toBe('item-2')
        })

        it('emits PROJECT_TEMPLATES_LOADED event', async () => {
            mockSupabase._queueResult(null)
            const spy = vi.fn()
            events.on(Events.PROJECT_TEMPLATES_LOADED, spy)

            await deleteTemplateItem('tmpl-1', 'item-1')

            expect(spy).toHaveBeenCalledTimes(1)
            events.off(Events.PROJECT_TEMPLATES_LOADED, spy)
        })

        it('does not affect items in other templates', async () => {
            mockSupabase._queueResult(null)

            await deleteTemplateItem('tmpl-1', 'item-1')

            const templates = store.get('projectTemplates')
            const tmpl2 = templates.find(t => t.id === 'tmpl-2')
            expect(tmpl2.items).toEqual([])
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'Delete failed' })

            await expect(deleteTemplateItem('tmpl-1', 'item-1')).rejects.toEqual({ message: 'Delete failed' })
        })
    })

    // ─── deleteProjectTemplate ────────────────────────────────────────────

    describe('deleteProjectTemplate', () => {
        it('deletes from Supabase by template ID', async () => {
            mockSupabase._queueResult(null)

            await deleteProjectTemplate('tmpl-1')

            expect(mockSupabase.from).toHaveBeenCalledWith('project_templates')
            expect(mockSupabase.delete).toHaveBeenCalled()
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'tmpl-1')
        })

        it('removes template from store', async () => {
            mockSupabase._queueResult(null)

            await deleteProjectTemplate('tmpl-1')

            const templates = store.get('projectTemplates')
            expect(templates).toHaveLength(1)
            expect(templates[0].id).toBe('tmpl-2')
        })

        it('emits PROJECT_TEMPLATE_DELETED event with templateId', async () => {
            mockSupabase._queueResult(null)
            const spy = vi.fn()
            events.on(Events.PROJECT_TEMPLATE_DELETED, spy)

            await deleteProjectTemplate('tmpl-1')

            expect(spy).toHaveBeenCalledWith('tmpl-1')
            events.off(Events.PROJECT_TEMPLATE_DELETED, spy)
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'Delete template failed' })

            await expect(deleteProjectTemplate('tmpl-1')).rejects.toEqual({ message: 'Delete template failed' })
        })
    })

    // ─── renameProjectTemplate ────────────────────────────────────────────

    describe('renameProjectTemplate', () => {
        it('encrypts new name before updating', async () => {
            mockSupabase._queueResult(null)

            await renameProjectTemplate('tmpl-1', 'Renamed')

            expect(mockSupabase.update).toHaveBeenCalledWith({ name: 'enc:Renamed' })
        })

        it('updates name in Supabase', async () => {
            mockSupabase._queueResult(null)

            await renameProjectTemplate('tmpl-1', 'New Name')

            expect(mockSupabase.from).toHaveBeenCalledWith('project_templates')
            expect(mockSupabase.update).toHaveBeenCalled()
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'tmpl-1')
        })

        it('updates name in store with decrypted value', async () => {
            mockSupabase._queueResult(null)

            await renameProjectTemplate('tmpl-1', 'Updated Name')

            const templates = store.get('projectTemplates')
            const tmpl1 = templates.find(t => t.id === 'tmpl-1')
            expect(tmpl1.name).toBe('Updated Name')
        })

        it('emits PROJECT_TEMPLATES_LOADED event', async () => {
            mockSupabase._queueResult(null)
            const spy = vi.fn()
            events.on(Events.PROJECT_TEMPLATES_LOADED, spy)

            await renameProjectTemplate('tmpl-1', 'Renamed')

            expect(spy).toHaveBeenCalledTimes(1)
            events.off(Events.PROJECT_TEMPLATES_LOADED, spy)
        })

        it('does not affect other templates', async () => {
            mockSupabase._queueResult(null)

            await renameProjectTemplate('tmpl-1', 'Changed')

            const templates = store.get('projectTemplates')
            const tmpl2 = templates.find(t => t.id === 'tmpl-2')
            expect(tmpl2.name).toBe('Empty Template')
        })

        it('throws on Supabase error', async () => {
            mockSupabase._queueResult(null, { message: 'Update failed' })

            await expect(renameProjectTemplate('tmpl-1', 'Fail')).rejects.toEqual({ message: 'Update failed' })
        })
    })

    // ─── createProjectFromTemplate ────────────────────────────────────────

    describe('createProjectFromTemplate', () => {
        it('throws when template not found', async () => {
            await expect(createProjectFromTemplate('non-existent')).rejects.toThrow('Template not found')
        })

        it('calls addProject with template name', async () => {
            await createProjectFromTemplate('tmpl-1')

            expect(addProject).toHaveBeenCalledWith('Sprint Template')
        })

        it('calls reorderProjects to move new project to top', async () => {
            await createProjectFromTemplate('tmpl-1')

            expect(reorderProjects).toHaveBeenCalledWith(['proj-new', 'proj-1'])
        })

        it('creates todos from template items with projectId and inbox status', async () => {
            await createProjectFromTemplate('tmpl-1')

            expect(addTodo).toHaveBeenCalledWith({
                text: 'Design',
                projectId: 'proj-new',
                gtdStatus: 'inbox'
            })
            expect(addTodo).toHaveBeenCalledWith({
                text: 'Implement',
                projectId: 'proj-new',
                gtdStatus: 'inbox'
            })
        })

        it('emits PROJECT_TEMPLATE_APPLIED event with templateId and projectId', async () => {
            const spy = vi.fn()
            events.on(Events.PROJECT_TEMPLATE_APPLIED, spy)

            await createProjectFromTemplate('tmpl-1')

            expect(spy).toHaveBeenCalledWith({ templateId: 'tmpl-1', projectId: 'proj-new' })
            events.off(Events.PROJECT_TEMPLATE_APPLIED, spy)
        })

        it('returns the created project', async () => {
            const result = await createProjectFromTemplate('tmpl-1')

            expect(result).toEqual({ id: 'proj-new', name: 'Sprint Template', parent_id: null, sort_order: 0 })
        })

        it('calls addTodo for each template item in order', async () => {
            await createProjectFromTemplate('tmpl-1')

            expect(addTodo).toHaveBeenCalledTimes(2)
            const firstCall = addTodo.mock.calls[0][0]
            const secondCall = addTodo.mock.calls[1][0]
            expect(firstCall.text).toBe('Design')
            expect(secondCall.text).toBe('Implement')
        })

        it('works with template that has no items', async () => {
            const result = await createProjectFromTemplate('tmpl-2')

            expect(addProject).toHaveBeenCalledWith('Empty Template')
            expect(addTodo).not.toHaveBeenCalled()
            expect(result).toEqual(expect.objectContaining({ id: 'proj-new' }))
        })
    })
})
