import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Events } from '../../src/core/events.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLoadCollection = vi.fn()
const mockGetById = vi.fn()

vi.mock('../../src/services/data-loader.js', () => ({
    loadCollection: mockLoadCollection,
    getById: mockGetById
}))

const { loadPriorities, getPriorityById } = await import('../../src/services/priorities.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('priorities', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ─── loadPriorities ───────────────────────────────────────────────────────

    describe('loadPriorities', () => {
        it('calls loadCollection with correct config', async () => {
            mockLoadCollection.mockResolvedValue([])

            await loadPriorities()

            expect(mockLoadCollection).toHaveBeenCalledWith({
                table: 'priorities',
                storeKey: 'priorities',
                event: Events.PRIORITIES_LOADED,
                orderBy: 'level',
                decryptFields: []
            })
        })

        it('uses empty decryptFields (priorities are not encrypted)', async () => {
            mockLoadCollection.mockResolvedValue([])

            await loadPriorities()

            const config = mockLoadCollection.mock.calls[0][0]
            expect(config.decryptFields).toEqual([])
        })

        it('orders by level instead of created_at', async () => {
            mockLoadCollection.mockResolvedValue([])

            await loadPriorities()

            const config = mockLoadCollection.mock.calls[0][0]
            expect(config.orderBy).toBe('level')
        })

        it('returns the result from loadCollection', async () => {
            const priorities = [
                { id: '1', name: 'High', level: 1, color: '#ff0000' },
                { id: '2', name: 'Medium', level: 2, color: '#ffaa00' },
                { id: '3', name: 'Low', level: 3, color: '#00aa00' }
            ]
            mockLoadCollection.mockResolvedValue(priorities)

            const result = await loadPriorities()

            expect(result).toEqual(priorities)
        })

        it('calls loadCollection exactly once', async () => {
            mockLoadCollection.mockResolvedValue([])

            await loadPriorities()

            expect(mockLoadCollection).toHaveBeenCalledTimes(1)
        })

        it('propagates errors from loadCollection', async () => {
            mockLoadCollection.mockRejectedValue(new Error('DB error'))

            await expect(loadPriorities()).rejects.toThrow('DB error')
        })
    })

    // ─── getPriorityById ──────────────────────────────────────────────────────

    describe('getPriorityById', () => {
        it('calls getById with correct store key and id', () => {
            mockGetById.mockReturnValue({ id: 'pri-1', name: 'High' })

            getPriorityById('pri-1')

            expect(mockGetById).toHaveBeenCalledWith('priorities', 'pri-1')
        })

        it('returns the found priority', () => {
            const priority = { id: 'pri-1', name: 'High', level: 1, color: '#ff0000' }
            mockGetById.mockReturnValue(priority)

            const result = getPriorityById('pri-1')

            expect(result).toEqual(priority)
        })

        it('returns null when priority is not found', () => {
            mockGetById.mockReturnValue(null)

            const result = getPriorityById('nonexistent')

            expect(result).toBeNull()
        })

        it('calls getById exactly once', () => {
            mockGetById.mockReturnValue(null)

            getPriorityById('pri-1')

            expect(mockGetById).toHaveBeenCalledTimes(1)
        })
    })
})
