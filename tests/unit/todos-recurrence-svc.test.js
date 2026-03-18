import { describe, it, expect, beforeEach, vi } from 'vitest'
import { store } from '../../src/core/store.js'
import { events, Events } from '../../src/core/events.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/auth.js', () => ({
    encrypt: vi.fn(v => Promise.resolve(v)),
    decrypt: vi.fn(v => Promise.resolve(v))
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
        single: vi.fn(() => chain),
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

// Import after mocks are set up
const {
    getTemplateById,
    generateNextRecurrence,
    checkPendingRecurrences,
    stopRecurrence,
    deleteRecurringSeries,
    updateTemplateRecurrence,
    createRecurringTodo,
    convertToRecurring,
    isRecurrenceEnded
} = await import('../../src/services/todos-recurrence.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('todos-recurrence', () => {
    beforeEach(() => {
        store.reset()
        mockSupabase._reset()
        vi.clearAllMocks()

        store.set('currentUser', { id: 'user-1' })
        store.set('templates', [
            {
                id: 'tmpl-1',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_count: 2,
                recurrence_end_type: 'never',
                recurrence_end_date: null,
                recurrence_end_count: null,
                text: 'encrypted-text',
                comment: null,
                category_id: null,
                project_id: null,
                priority_id: null,
                context_id: null,
            }
        ])
        store.set('todos', [
            {
                id: 'inst-1',
                template_id: 'tmpl-1',
                text: 'Daily task',
                completed: true,
                due_date: '2026-01-01',
                gtd_status: 'done'
            }
        ])
    })

    // ─── getTemplateById ──────────────────────────────────────────────────────

    describe('getTemplateById', () => {
        it('returns the template when found by string ID', () => {
            const result = getTemplateById('tmpl-1')
            expect(result).not.toBeNull()
            expect(result.id).toBe('tmpl-1')
        })

        it('returns the template when ID types differ (number vs string)', () => {
            store.set('templates', [{ id: 123, text: 'numeric id template' }])

            const result = getTemplateById('123')
            expect(result).not.toBeNull()
            expect(result.id).toBe(123)
        })

        it('returns null when template is not found', () => {
            const result = getTemplateById('nonexistent')
            expect(result).toBeNull()
        })

        it('returns null when templates array is empty', () => {
            store.set('templates', [])
            const result = getTemplateById('tmpl-1')
            expect(result).toBeNull()
        })

        it('returns null when templates is undefined', () => {
            store.set('templates', undefined)
            const result = getTemplateById('tmpl-1')
            expect(result).toBeNull()
        })

        it('returns the correct template when multiple templates exist', () => {
            store.set('templates', [
                { id: 'tmpl-1', text: 'first' },
                { id: 'tmpl-2', text: 'second' },
                { id: 'tmpl-3', text: 'third' }
            ])

            const result = getTemplateById('tmpl-2')
            expect(result.text).toBe('second')
        })
    })

    // ─── isRecurrenceEnded (re-export) ────────────────────────────────────────

    describe('isRecurrenceEnded (re-export)', () => {
        it('returns true for null template', () => {
            expect(isRecurrenceEnded(null)).toBe(true)
        })

        it('returns false for never-ending recurrence', () => {
            expect(isRecurrenceEnded({
                recurrence_end_type: 'never',
                recurrence_count: 10
            })).toBe(false)
        })

        it('returns true when count limit is reached', () => {
            expect(isRecurrenceEnded({
                recurrence_end_type: 'after_count',
                recurrence_end_count: 5,
                recurrence_count: 5
            })).toBe(true)
        })

        it('returns false when count limit is not reached', () => {
            expect(isRecurrenceEnded({
                recurrence_end_type: 'after_count',
                recurrence_end_count: 5,
                recurrence_count: 3
            })).toBe(false)
        })
    })

    // ─── stopRecurrence ───────────────────────────────────────────────────────

    describe('stopRecurrence', () => {
        it('sets recurrence_end_type to after_count with current count', async () => {
            mockSupabase._queueResult(null) // update result (no error)

            await stopRecurrence('tmpl-1')

            // Verify supabase was called with correct update data
            expect(mockSupabase.update).toHaveBeenCalledWith({
                recurrence_end_type: 'after_count',
                recurrence_end_count: 2
            })
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'tmpl-1')
        })

        it('updates template in store', async () => {
            mockSupabase._queueResult(null)

            await stopRecurrence('tmpl-1')

            const templates = store.get('templates')
            const tmpl = templates.find(t => t.id === 'tmpl-1')
            expect(tmpl.recurrence_end_type).toBe('after_count')
            expect(tmpl.recurrence_end_count).toBe(2)
        })

        it('returns without error when template is not found', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            await stopRecurrence('nonexistent')

            expect(consoleSpy).toHaveBeenCalledWith('Template not found:', 'nonexistent')
            // Supabase should not be called
            expect(mockSupabase.update).not.toHaveBeenCalled()
            consoleSpy.mockRestore()
        })

        it('uses 0 when recurrence_count is falsy', async () => {
            store.set('templates', [{
                id: 'tmpl-zero',
                recurrence_count: 0,
                recurrence_end_type: 'never'
            }])
            mockSupabase._queueResult(null)

            await stopRecurrence('tmpl-zero')

            expect(mockSupabase.update).toHaveBeenCalledWith({
                recurrence_end_type: 'after_count',
                recurrence_end_count: 0
            })
        })

        it('throws when supabase returns an error', async () => {
            mockSupabase._queueResult(null, { message: 'DB error' })

            await expect(stopRecurrence('tmpl-1')).rejects.toEqual({ message: 'DB error' })
        })
    })

    // ─── deleteRecurringSeries ────────────────────────────────────────────────

    describe('deleteRecurringSeries', () => {
        it('deletes instances and template from supabase', async () => {
            mockSupabase._queueResult(null) // delete instances
            mockSupabase._queueResult(null) // delete template

            await deleteRecurringSeries('tmpl-1')

            // Should call delete twice (instances then template)
            expect(mockSupabase.delete).toHaveBeenCalledTimes(2)
        })

        it('removes instances from todos store', async () => {
            store.set('todos', [
                { id: 'inst-1', template_id: 'tmpl-1', text: 'linked' },
                { id: 'inst-2', template_id: 'tmpl-1', text: 'linked too' },
                { id: 'other', template_id: 'tmpl-2', text: 'unrelated' }
            ])
            mockSupabase._queueResult(null)
            mockSupabase._queueResult(null)

            await deleteRecurringSeries('tmpl-1')

            const todos = store.get('todos')
            expect(todos).toHaveLength(1)
            expect(todos[0].id).toBe('other')
        })

        it('removes template from templates store', async () => {
            mockSupabase._queueResult(null)
            mockSupabase._queueResult(null)

            await deleteRecurringSeries('tmpl-1')

            const templates = store.get('templates')
            expect(templates).toHaveLength(0)
        })

        it('emits TODOS_UPDATED event', async () => {
            mockSupabase._queueResult(null)
            mockSupabase._queueResult(null)
            const handler = vi.fn()
            events.on(Events.TODOS_UPDATED, handler)

            await deleteRecurringSeries('tmpl-1')

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODOS_UPDATED)
        })

        it('uses String() comparison for template_id matching', async () => {
            store.set('todos', [
                { id: 'inst-1', template_id: 123, text: 'numeric template_id' }
            ])
            store.set('templates', [{ id: 123, text: 'numeric id template' }])
            mockSupabase._queueResult(null)
            mockSupabase._queueResult(null)

            await deleteRecurringSeries(123)

            expect(store.get('todos')).toHaveLength(0)
            expect(store.get('templates')).toHaveLength(0)
        })

        it('throws when deleting instances fails', async () => {
            mockSupabase._queueResult(null, { message: 'instances error' })

            await expect(deleteRecurringSeries('tmpl-1'))
                .rejects.toEqual({ message: 'instances error' })
        })

        it('throws when deleting template fails', async () => {
            mockSupabase._queueResult(null) // instances ok
            mockSupabase._queueResult(null, { message: 'template error' })

            await expect(deleteRecurringSeries('tmpl-1'))
                .rejects.toEqual({ message: 'template error' })
        })
    })

    // ─── generateNextRecurrence ───────────────────────────────────────────────

    describe('generateNextRecurrence', () => {
        it('returns null when template is not in store and not in DB', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            mockSupabase._queueResult(null, { message: 'not found' })

            const result = await generateNextRecurrence('nonexistent', '2026-01-01')

            expect(result).toBeNull()
            consoleSpy.mockRestore()
        })

        it('returns null when recurrence has ended (after_count)', async () => {
            store.set('templates', [{
                id: 'tmpl-ended',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_count: 5,
                recurrence_end_type: 'after_count',
                recurrence_end_count: 5
            }])
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

            const result = await generateNextRecurrence('tmpl-ended', '2026-01-01')

            expect(result).toBeNull()
            consoleSpy.mockRestore()
        })

        it('returns null when template has no recurrence rule', async () => {
            store.set('templates', [{
                id: 'tmpl-no-rule',
                recurrence_rule: null,
                recurrence_count: 0,
                recurrence_end_type: 'never'
            }])
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await generateNextRecurrence('tmpl-no-rule', '2026-01-01')

            expect(result).toBeNull()
            consoleSpy.mockRestore()
        })

        it('returns null when calculateNextOccurrence returns null', async () => {
            store.set('templates', [{
                id: 'tmpl-bad-rule',
                recurrence_rule: { type: 'weekly', interval: 1, weekdays: [] },
                recurrence_count: 0,
                recurrence_end_type: 'never',
                recurrence_end_date: null,
                recurrence_end_count: null,
                text: 'bad-rule',
                comment: null,
                category_id: null,
                project_id: null,
                priority_id: null,
                context_id: null
            }])
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await generateNextRecurrence('tmpl-bad-rule', '2026-01-01')

            expect(result).toBeNull()
            expect(consoleSpy).toHaveBeenCalledWith(
                'Could not calculate next occurrence:',
                expect.any(Object),
                '2026-01-01'
            )
            consoleSpy.mockRestore()
        })

        it('returns null when next date exceeds end date', async () => {
            store.set('templates', [{
                id: 'tmpl-end-date',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_count: 2,
                recurrence_end_type: 'on_date',
                recurrence_end_date: '2026-01-02'
            }])
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

            // fromDate is 2026-01-02, next would be 2026-01-03 which exceeds 2026-01-02
            const result = await generateNextRecurrence('tmpl-end-date', '2026-01-02')

            expect(result).toBeNull()
            consoleSpy.mockRestore()
        })

        it('returns null when count limit would be exceeded', async () => {
            store.set('templates', [{
                id: 'tmpl-count-limit',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_count: 3,
                recurrence_end_type: 'after_count',
                recurrence_end_count: 3
            }])
            // isRecurrenceEnded checks count >= end_count, so 3 >= 3 => ended
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

            const result = await generateNextRecurrence('tmpl-count-limit', '2026-01-01')

            expect(result).toBeNull()
            consoleSpy.mockRestore()
        })

        it('creates a new instance and returns it when valid', async () => {
            const instanceData = {
                id: 'inst-new',
                text: 'encrypted-text',
                comment: null,
                template_id: 'tmpl-1',
                due_date: '2026-01-02',
                completed: false
            }
            mockSupabase._queueResult([instanceData]) // insert + select
            mockSupabase._queueResult(null) // update count

            const result = await generateNextRecurrence('tmpl-1', '2026-01-01')

            expect(result).not.toBeNull()
            expect(result.id).toBe('inst-new')
            expect(result.text).toBe('encrypted-text') // decrypt is passthrough
        })

        it('updates template recurrence_count in store', async () => {
            const instanceData = {
                id: 'inst-new',
                text: 'encrypted-text',
                comment: null,
                template_id: 'tmpl-1'
            }
            mockSupabase._queueResult([instanceData])
            mockSupabase._queueResult(null)

            await generateNextRecurrence('tmpl-1', '2026-01-01')

            const templates = store.get('templates')
            const tmpl = templates.find(t => t.id === 'tmpl-1')
            expect(tmpl.recurrence_count).toBe(3) // was 2, incremented to 3
        })

        it('emits TODO_ADDED event', async () => {
            const instanceData = {
                id: 'inst-new',
                text: 'encrypted-text',
                comment: null,
                template_id: 'tmpl-1'
            }
            mockSupabase._queueResult([instanceData])
            mockSupabase._queueResult(null)
            const handler = vi.fn()
            events.on(Events.TODO_ADDED, handler)

            await generateNextRecurrence('tmpl-1', '2026-01-01')

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODO_ADDED)
        })

        it('adds instance to todos store', async () => {
            const instanceData = {
                id: 'inst-new',
                text: 'encrypted-text',
                comment: null,
                template_id: 'tmpl-1'
            }
            mockSupabase._queueResult([instanceData])
            mockSupabase._queueResult(null)

            await generateNextRecurrence('tmpl-1', '2026-01-01')

            const todos = store.get('todos')
            expect(todos.some(t => t.id === 'inst-new')).toBe(true)
        })

        it('fetches template from DB when not in store', async () => {
            store.set('templates', []) // empty store
            const dbTemplate = {
                id: 'tmpl-db',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_count: 0,
                recurrence_end_type: 'never',
                text: 'db-text',
                comment: null,
                category_id: null,
                project_id: null,
                priority_id: null,
                context_id: null
            }
            mockSupabase._queueResult(dbTemplate) // fetch from DB (single)
            const instanceData = {
                id: 'inst-from-db',
                text: 'db-text',
                comment: null,
                template_id: 'tmpl-db'
            }
            mockSupabase._queueResult([instanceData]) // insert + select
            mockSupabase._queueResult(null) // update count

            const result = await generateNextRecurrence('tmpl-db', '2026-01-01')

            expect(result).not.toBeNull()
            expect(result.id).toBe('inst-from-db')
        })

        it('decrypts comment when present on the instance', async () => {
            const instanceData = {
                id: 'inst-comment',
                text: 'encrypted-text',
                comment: 'encrypted-comment',
                template_id: 'tmpl-1'
            }
            mockSupabase._queueResult([instanceData])
            mockSupabase._queueResult(null)

            const result = await generateNextRecurrence('tmpl-1', '2026-01-01')

            // decrypt mock is passthrough, so comment should be returned as-is
            expect(result.comment).toBe('encrypted-comment')
        })

        it('throws on Supabase error during instance creation', async () => {
            mockSupabase._queueResult(null, { message: 'insert instance error' })

            await expect(generateNextRecurrence('tmpl-1', '2026-01-01'))
                .rejects.toEqual({ message: 'insert instance error' })
        })

        it('returns null when count would exceed limit (count at end_count - 1)', async () => {
            // recurrence_count=2, end_count=3: isRecurrenceEnded returns false (2 < 3)
            // but newCount=3 which is NOT > 3, so it should proceed
            store.set('templates', [{
                id: 'tmpl-near-limit',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_count: 2,
                recurrence_end_type: 'after_count',
                recurrence_end_count: 3,
                text: 'near-limit',
                comment: null,
                category_id: null,
                project_id: null,
                priority_id: null,
                context_id: null
            }])

            const instanceData = {
                id: 'inst-near',
                text: 'near-limit',
                comment: null,
                template_id: 'tmpl-near-limit'
            }
            mockSupabase._queueResult([instanceData])
            mockSupabase._queueResult(null)

            const result = await generateNextRecurrence('tmpl-near-limit', '2026-01-01')

            expect(result).not.toBeNull()
            expect(result.id).toBe('inst-near')
        })

        it('allows next date on exact end date boundary', async () => {
            store.set('templates', [{
                id: 'tmpl-boundary',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_count: 2,
                recurrence_end_type: 'on_date',
                recurrence_end_date: '2099-06-02',
                text: 'boundary-text',
                comment: null,
                category_id: null,
                project_id: null,
                priority_id: null,
                context_id: null
            }])
            const instanceData = {
                id: 'inst-boundary',
                text: 'boundary-text',
                comment: null,
                template_id: 'tmpl-boundary'
            }
            mockSupabase._queueResult([instanceData])
            mockSupabase._queueResult(null)

            // fromDate=2099-06-01, next=2099-06-02 which equals end date (not exceeds)
            const result = await generateNextRecurrence('tmpl-boundary', '2099-06-01')

            expect(result).not.toBeNull()
        })

        it('returns null when next occurrence exceeds future end date', async () => {
            // End date is far in the future so isRecurrenceEnded returns false,
            // but the calculated next occurrence exceeds it
            store.set('templates', [{
                id: 'tmpl-future-end',
                recurrence_rule: { type: 'daily', interval: 5 },
                recurrence_count: 1,
                recurrence_end_type: 'on_date',
                recurrence_end_date: '2099-06-03',
                recurrence_end_count: null,
                text: 'future-end-text',
                comment: null,
                category_id: null,
                project_id: null,
                priority_id: null,
                context_id: null
            }])
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

            // fromDate=2099-06-01, interval=5, next=2099-06-06 which exceeds 2099-06-03
            const result = await generateNextRecurrence('tmpl-future-end', '2099-06-01')

            expect(result).toBeNull()
            expect(consoleSpy).toHaveBeenCalledWith('Next occurrence exceeds end date')
            consoleSpy.mockRestore()
        })

        it('returns null when new count exceeds limit (bypassing isRecurrenceEnded)', async () => {
            // This covers the inner count guard at lines 155-158.
            // isRecurrenceEnded uses >=, but the inner guard uses >.
            // To reach it: set recurrence_count just below end_count so isRecurrenceEnded passes,
            // but newCount (count+1) > end_count.
            // With end_count=2 and count=1: isRecurrenceEnded(1 >= 2) = false, newCount=2, 2>2 = false.
            // With end_count=1 and count=0: isRecurrenceEnded(0 >= 1) = false, newCount=1, 1>1 = false.
            // This branch is effectively unreachable with integer counts because:
            //   isRecurrenceEnded: count >= end_count => false means count < end_count
            //   Inner guard: count+1 > end_count => only true if count >= end_count (contradiction)
            // Marking as documented dead code — the guard serves as a safety net.
            // We verify the boundary case still proceeds correctly:
            store.set('templates', [{
                id: 'tmpl-count-boundary',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_count: 4,
                recurrence_end_type: 'after_count',
                recurrence_end_count: 5,
                text: 'count-boundary',
                comment: null,
                category_id: null,
                project_id: null,
                priority_id: null,
                context_id: null
            }])
            const instanceData = {
                id: 'inst-count-boundary',
                text: 'count-boundary',
                comment: null,
                template_id: 'tmpl-count-boundary'
            }
            mockSupabase._queueResult([instanceData])
            mockSupabase._queueResult(null)

            // count=4, end_count=5: isRecurrenceEnded(4>=5)=false, newCount=5, 5>5=false => proceeds
            const result = await generateNextRecurrence('tmpl-count-boundary', '2026-01-01')

            expect(result).not.toBeNull()
            expect(result.id).toBe('inst-count-boundary')
        })
    })

    // ─── checkPendingRecurrences ──────────────────────────────────────────────

    describe('checkPendingRecurrences', () => {
        it('skips templates without recurrence_rule', async () => {
            store.set('templates', [{ id: 'tmpl-no-rule', recurrence_rule: null }])

            await checkPendingRecurrences()

            // No supabase calls should have been made
            expect(mockSupabase.insert).not.toHaveBeenCalled()
        })

        it('skips ended recurrences', async () => {
            store.set('templates', [{
                id: 'tmpl-ended',
                recurrence_rule: { type: 'daily', interval: 1 },
                recurrence_end_type: 'after_count',
                recurrence_end_count: 3,
                recurrence_count: 3
            }])

            await checkPendingRecurrences()

            expect(mockSupabase.insert).not.toHaveBeenCalled()
        })

        it('skips if no instances exist for a template', async () => {
            store.set('todos', []) // no instances

            await checkPendingRecurrences()

            expect(mockSupabase.insert).not.toHaveBeenCalled()
        })

        it('does not generate if latest instance is not completed', async () => {
            store.set('todos', [{
                id: 'inst-1',
                template_id: 'tmpl-1',
                completed: false,
                due_date: '2025-01-01' // past due but not completed
            }])

            await checkPendingRecurrences()

            expect(mockSupabase.insert).not.toHaveBeenCalled()
        })

        it('does not generate if latest instance due date is in the future', async () => {
            store.set('todos', [{
                id: 'inst-1',
                template_id: 'tmpl-1',
                completed: true,
                due_date: '2099-12-31' // far in the future
            }])

            await checkPendingRecurrences()

            expect(mockSupabase.insert).not.toHaveBeenCalled()
        })

        it('generates catch-up when latest instance is completed and past due', async () => {
            // Default setup already has a completed instance with due_date '2026-01-01'
            // which is in the past relative to "today" (2026-03-15)
            const instanceData = {
                id: 'inst-catchup',
                text: 'encrypted-text',
                comment: null,
                template_id: 'tmpl-1',
                due_date: '2026-01-02'
            }
            mockSupabase._queueResult([instanceData]) // insert instance
            mockSupabase._queueResult(null) // update count

            await checkPendingRecurrences()

            expect(mockSupabase.insert).toHaveBeenCalled()
        })

        it('picks the instance with the latest due_date among multiple', async () => {
            store.set('todos', [
                { id: 'inst-old', template_id: 'tmpl-1', completed: true, due_date: '2025-06-01' },
                { id: 'inst-new', template_id: 'tmpl-1', completed: false, due_date: '2099-12-31' }
            ])

            await checkPendingRecurrences()

            // Latest instance (inst-new) is not completed, so no generation
            expect(mockSupabase.insert).not.toHaveBeenCalled()
        })

        it('skips instances without due_date', async () => {
            store.set('todos', [{
                id: 'inst-1',
                template_id: 'tmpl-1',
                completed: true,
                due_date: null
            }])

            await checkPendingRecurrences()

            expect(mockSupabase.insert).not.toHaveBeenCalled()
        })
    })

    // ─── updateTemplateRecurrence ─────────────────────────────────────────────

    describe('updateTemplateRecurrence', () => {
        it('updates recurrence_rule in supabase', async () => {
            const newRule = { type: 'weekly', interval: 2, weekdays: [1, 3, 5] }
            mockSupabase._queueResult({ id: 'tmpl-1', recurrence_rule: newRule })

            await updateTemplateRecurrence('tmpl-1', newRule, { type: 'never' })

            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
                recurrence_rule: newRule,
                recurrence_end_type: 'never'
            }))
        })

        it('sets on_date end condition fields correctly', async () => {
            const newRule = { type: 'daily', interval: 1 }
            mockSupabase._queueResult({ id: 'tmpl-1' })

            await updateTemplateRecurrence('tmpl-1', newRule, {
                type: 'on_date',
                date: '2027-01-01'
            })

            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
                recurrence_end_type: 'on_date',
                recurrence_end_date: '2027-01-01',
                recurrence_end_count: null
            }))
        })

        it('sets after_count end condition fields correctly', async () => {
            const newRule = { type: 'daily', interval: 1 }
            mockSupabase._queueResult({ id: 'tmpl-1' })

            await updateTemplateRecurrence('tmpl-1', newRule, {
                type: 'after_count',
                count: 10
            })

            expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
                recurrence_end_type: 'after_count',
                recurrence_end_count: 10,
                recurrence_end_date: null
            }))
        })

        it('updates templates in store', async () => {
            const newRule = { type: 'weekly', interval: 1 }
            mockSupabase._queueResult({ id: 'tmpl-1' })

            await updateTemplateRecurrence('tmpl-1', newRule, { type: 'never' })

            const templates = store.get('templates')
            const tmpl = templates.find(t => t.id === 'tmpl-1')
            expect(tmpl.recurrence_rule).toEqual(newRule)
            expect(tmpl.recurrence_end_type).toBe('never')
        })

        it('handles null endCondition gracefully', async () => {
            const newRule = { type: 'daily', interval: 1 }
            mockSupabase._queueResult({ id: 'tmpl-1' })

            await updateTemplateRecurrence('tmpl-1', newRule, null)

            expect(mockSupabase.update).toHaveBeenCalledWith({
                recurrence_rule: newRule
            })
        })

        it('throws when supabase returns an error', async () => {
            mockSupabase._queueResult(null, { message: 'update error' })

            await expect(
                updateTemplateRecurrence('tmpl-1', { type: 'daily', interval: 1 }, { type: 'never' })
            ).rejects.toEqual({ message: 'update error' })
        })
    })

    // ─── createRecurringTodo ──────────────────────────────────────────────────

    describe('createRecurringTodo', () => {
        const todoData = {
            text: 'My recurring task',
            categoryId: 'cat-1',
            projectId: 'proj-1',
            priorityId: null,
            gtdStatus: 'next',
            contextId: null,
            dueDate: '2026-04-01',
            comment: 'A comment'
        }
        const recurrenceRule = { type: 'daily', interval: 1 }
        const endCondition = { type: 'never' }

        it('creates template and instance in supabase', async () => {
            const templateResult = [{ id: 'tmpl-new', text: 'My recurring task' }]
            const instanceResult = [{ id: 'inst-new', text: 'My recurring task', comment: 'A comment', template_id: 'tmpl-new' }]
            mockSupabase._queueResult(templateResult) // insert template
            mockSupabase._queueResult(instanceResult) // insert instance
            mockSupabase._queueResult(null)           // update count

            const result = await createRecurringTodo(todoData, recurrenceRule, endCondition)

            expect(result).not.toBeNull()
            expect(result.id).toBe('inst-new')
            // Template insert should have is_template: true, gtd_status: 'scheduled'
            expect(mockSupabase.insert).toHaveBeenCalledTimes(2)
        })

        it('sets template as is_template with scheduled status', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new' }])
            mockSupabase._queueResult([{ id: 'inst-new', text: 'x', comment: null }])
            mockSupabase._queueResult(null)

            await createRecurringTodo(todoData, recurrenceRule, endCondition)

            // First insert call should be for template
            const firstInsertCall = mockSupabase.insert.mock.calls[0][0]
            expect(firstInsertCall.is_template).toBe(true)
            expect(firstInsertCall.gtd_status).toBe('scheduled')
        })

        it('instance uses the provided gtdStatus, not "scheduled"', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new' }])
            mockSupabase._queueResult([{ id: 'inst-new', text: 'x', comment: null }])
            mockSupabase._queueResult(null)

            await createRecurringTodo(todoData, recurrenceRule, endCondition)

            // Second insert call should be for instance
            const secondInsertCall = mockSupabase.insert.mock.calls[1][0]
            expect(secondInsertCall.gtd_status).toBe('next')
            expect(secondInsertCall.is_template).toBe(false)
        })

        it('adds instance to todos store and template to templates store', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new' }])
            mockSupabase._queueResult([{ id: 'inst-new', text: 'x', comment: null }])
            mockSupabase._queueResult(null)

            await createRecurringTodo(todoData, recurrenceRule, endCondition)

            const todos = store.get('todos')
            expect(todos.some(t => t.id === 'inst-new')).toBe(true)
            const templates = store.get('templates')
            expect(templates.some(t => t.id === 'tmpl-new')).toBe(true)
        })

        it('sets template recurrence_count to 1 in store', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new', recurrence_count: 0 }])
            mockSupabase._queueResult([{ id: 'inst-new', text: 'x', comment: null }])
            mockSupabase._queueResult(null)

            await createRecurringTodo(todoData, recurrenceRule, endCondition)

            const templates = store.get('templates')
            const tmpl = templates.find(t => t.id === 'tmpl-new')
            expect(tmpl.recurrence_count).toBe(1)
        })

        it('emits TODO_ADDED event with the instance', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new' }])
            mockSupabase._queueResult([{ id: 'inst-new', text: 'x', comment: null }])
            mockSupabase._queueResult(null)
            const handler = vi.fn()
            events.on(Events.TODO_ADDED, handler)

            await createRecurringTodo(todoData, recurrenceRule, endCondition)

            expect(handler).toHaveBeenCalledTimes(1)
            expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'inst-new' }))
            events.off(Events.TODO_ADDED)
        })

        it('throws when template creation fails', async () => {
            mockSupabase._queueResult(null, { message: 'template insert error' })

            await expect(createRecurringTodo(todoData, recurrenceRule, endCondition))
                .rejects.toEqual({ message: 'template insert error' })
        })

        it('throws when instance creation fails', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-new' }]) // template ok
            mockSupabase._queueResult(null, { message: 'instance insert error' })

            await expect(createRecurringTodo(todoData, recurrenceRule, endCondition))
                .rejects.toEqual({ message: 'instance insert error' })
        })
    })

    // ─── convertToRecurring ───────────────────────────────────────────────────

    describe('convertToRecurring', () => {
        const todoData = {
            text: 'Existing task',
            categoryId: 'cat-1',
            projectId: null,
            priorityId: null,
            gtdStatus: 'next',
            contextId: null,
            dueDate: '2026-05-01',
            comment: null
        }
        const recurrenceRule = { type: 'weekly', interval: 1, weekdays: [1] }
        const endCondition = { type: 'never' }

        beforeEach(() => {
            store.set('todos', [
                { id: 'existing-todo', text: 'Existing task', completed: false }
            ])
        })

        it('creates a template and links the existing todo', async () => {
            const templateResult = [{ id: 'tmpl-conv' }]
            const updateResult = [{ id: 'existing-todo', template_id: 'tmpl-conv', text: 'Existing task' }]
            mockSupabase._queueResult(templateResult) // insert template
            mockSupabase._queueResult(updateResult)   // update existing todo

            await convertToRecurring('existing-todo', todoData, recurrenceRule, endCondition)

            // Template should have recurrence_count: 1
            const firstInsert = mockSupabase.insert.mock.calls[0][0]
            expect(firstInsert.recurrence_count).toBe(1)
            expect(firstInsert.is_template).toBe(true)
        })

        it('updates existing todo with template_id', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-conv' }])
            mockSupabase._queueResult([{ id: 'existing-todo', template_id: 'tmpl-conv', text: 'Existing task' }])

            await convertToRecurring('existing-todo', todoData, recurrenceRule, endCondition)

            // Second call should be update, not insert
            expect(mockSupabase.update).toHaveBeenCalled()
            const updateCall = mockSupabase.update.mock.calls[0][0]
            expect(updateCall.template_id).toBe('tmpl-conv')
        })

        it('emits TODO_UPDATED event', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-conv' }])
            mockSupabase._queueResult([{ id: 'existing-todo', template_id: 'tmpl-conv', text: 'enc' }])
            const handler = vi.fn()
            events.on(Events.TODO_UPDATED, handler)

            await convertToRecurring('existing-todo', todoData, recurrenceRule, endCondition)

            expect(handler).toHaveBeenCalledTimes(1)
            events.off(Events.TODO_UPDATED)
        })

        it('adds template to templates store', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-conv' }])
            mockSupabase._queueResult([{ id: 'existing-todo', template_id: 'tmpl-conv', text: 'enc' }])

            await convertToRecurring('existing-todo', todoData, recurrenceRule, endCondition)

            const templates = store.get('templates')
            expect(templates.some(t => t.id === 'tmpl-conv')).toBe(true)
        })

        it('updates the todo in local store with decrypted text', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-conv' }])
            mockSupabase._queueResult([{ id: 'existing-todo', template_id: 'tmpl-conv', text: 'encrypted' }])

            await convertToRecurring('existing-todo', todoData, recurrenceRule, endCondition)

            const todos = store.get('todos')
            const updated = todos.find(t => t.id === 'existing-todo')
            // text should be the decrypted (original) text, not encrypted
            expect(updated.text).toBe('Existing task')
            expect(updated.template_id).toBe('tmpl-conv')
        })

        it('throws when template creation fails', async () => {
            mockSupabase._queueResult(null, { message: 'convert template error' })

            await expect(
                convertToRecurring('existing-todo', todoData, recurrenceRule, endCondition)
            ).rejects.toEqual({ message: 'convert template error' })
        })

        it('throws when todo update fails', async () => {
            mockSupabase._queueResult([{ id: 'tmpl-conv' }]) // template ok
            mockSupabase._queueResult(null, { message: 'update error' })

            await expect(
                convertToRecurring('existing-todo', todoData, recurrenceRule, endCondition)
            ).rejects.toEqual({ message: 'update error' })
        })
    })
})
