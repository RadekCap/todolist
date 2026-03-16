import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Events } from '../../src/core/events.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLoadCollection = vi.fn()
const mockGetById = vi.fn()

vi.mock('../../src/services/data-loader.js', () => ({
    loadCollection: mockLoadCollection,
    getById: mockGetById
}))

const { loadContexts, getContextById } = await import('../../src/services/contexts.js')

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('contexts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ─── loadContexts ─────────────────────────────────────────────────────────

    describe('loadContexts', () => {
        it('calls loadCollection with correct config', async () => {
            mockLoadCollection.mockResolvedValue([])

            await loadContexts()

            expect(mockLoadCollection).toHaveBeenCalledWith({
                table: 'contexts',
                storeKey: 'contexts',
                event: Events.CONTEXTS_LOADED,
                orderBy: 'created_at',
                decryptFields: ['name']
            })
        })

        it('returns the result from loadCollection', async () => {
            const contexts = [
                { id: '1', name: '@home' },
                { id: '2', name: '@work' }
            ]
            mockLoadCollection.mockResolvedValue(contexts)

            const result = await loadContexts()

            expect(result).toEqual(contexts)
        })

        it('calls loadCollection exactly once', async () => {
            mockLoadCollection.mockResolvedValue([])

            await loadContexts()

            expect(mockLoadCollection).toHaveBeenCalledTimes(1)
        })

        it('propagates errors from loadCollection', async () => {
            mockLoadCollection.mockRejectedValue(new Error('DB error'))

            await expect(loadContexts()).rejects.toThrow('DB error')
        })
    })

    // ─── getContextById ───────────────────────────────────────────────────────

    describe('getContextById', () => {
        it('calls getById with correct store key and id', () => {
            mockGetById.mockReturnValue({ id: 'ctx-1', name: '@home' })

            getContextById('ctx-1')

            expect(mockGetById).toHaveBeenCalledWith('contexts', 'ctx-1')
        })

        it('returns the found context', () => {
            const context = { id: 'ctx-1', name: '@home' }
            mockGetById.mockReturnValue(context)

            const result = getContextById('ctx-1')

            expect(result).toEqual(context)
        })

        it('returns null when context is not found', () => {
            mockGetById.mockReturnValue(null)

            const result = getContextById('nonexistent')

            expect(result).toBeNull()
        })

        it('calls getById exactly once', () => {
            mockGetById.mockReturnValue(null)

            getContextById('ctx-1')

            expect(mockGetById).toHaveBeenCalledTimes(1)
        })
    })
})
