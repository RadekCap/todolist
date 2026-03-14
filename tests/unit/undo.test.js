import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the events module before importing undo
vi.mock('../../src/core/events.js', () => ({
    events: {
        emit: vi.fn()
    },
    Events: {
        UNDO_PUSHED: 'undo:pushed',
        UNDO_PERFORMED: 'undo:performed',
        UNDO_FAILED: 'undo:failed'
    }
}))

import {
    pushUndo,
    performUndo,
    getUndoStackSize,
    peekUndoDescription,
    clearUndoStack
} from '../../src/services/undo.js'
import { events, Events } from '../../src/core/events.js'

// ─── pushUndo ─────────────────────────────────────────────────────────────────

describe('pushUndo', () => {
    beforeEach(() => {
        clearUndoStack()
        vi.clearAllMocks()
    })

    it('pushes a single item onto the stack', () => {
        pushUndo('Delete todo', vi.fn())
        expect(getUndoStackSize()).toBe(1)
    })

    it('pushes multiple items onto the stack', () => {
        pushUndo('Delete todo 1', vi.fn())
        pushUndo('Delete todo 2', vi.fn())
        pushUndo('Delete todo 3', vi.fn())
        expect(getUndoStackSize()).toBe(3)
    })

    it('stack grows correctly with each push', () => {
        for (let i = 1; i <= 5; i++) {
            pushUndo(`Action ${i}`, vi.fn())
            expect(getUndoStackSize()).toBe(i)
        }
    })

    it('emits UNDO_PUSHED event with description and stack size', () => {
        pushUndo('Delete todo', vi.fn())
        expect(events.emit).toHaveBeenCalledWith(Events.UNDO_PUSHED, {
            description: 'Delete todo',
            stackSize: 1
        })
    })

    it('trims stack when exceeding max size of 20', () => {
        for (let i = 1; i <= 21; i++) {
            pushUndo(`Action ${i}`, vi.fn())
        }
        expect(getUndoStackSize()).toBe(20)
        // The first item should have been trimmed; top should be the latest
        expect(peekUndoDescription()).toBe('Action 21')
    })
})

// ─── performUndo ──────────────────────────────────────────────────────────────

describe('performUndo', () => {
    beforeEach(() => {
        clearUndoStack()
        vi.clearAllMocks()
    })

    it('pops and executes the undo function', async () => {
        const undoFn = vi.fn()
        pushUndo('Delete todo', undoFn)

        const result = await performUndo()

        expect(result).toBe(true)
        expect(undoFn).toHaveBeenCalledOnce()
        expect(getUndoStackSize()).toBe(0)
    })

    it('executes in LIFO order', async () => {
        const order = []
        pushUndo('First', vi.fn(() => order.push('first')))
        pushUndo('Second', vi.fn(() => order.push('second')))
        pushUndo('Third', vi.fn(() => order.push('third')))

        await performUndo()
        await performUndo()
        await performUndo()

        expect(order).toEqual(['third', 'second', 'first'])
    })

    it('returns true on successful undo', async () => {
        pushUndo('Action', vi.fn())
        const result = await performUndo()
        expect(result).toBe(true)
    })

    it('returns false for empty stack', async () => {
        const result = await performUndo()
        expect(result).toBe(false)
    })

    it('emits UNDO_PERFORMED event on success', async () => {
        pushUndo('Delete todo', vi.fn())
        vi.clearAllMocks()

        await performUndo()

        expect(events.emit).toHaveBeenCalledWith(Events.UNDO_PERFORMED, {
            description: 'Delete todo',
            stackSize: 0
        })
    })

    it('handles async undo functions', async () => {
        const asyncUndoFn = vi.fn(async () => {
            return 'restored'
        })
        pushUndo('Async action', asyncUndoFn)

        const result = await performUndo()

        expect(result).toBe(true)
        expect(asyncUndoFn).toHaveBeenCalledOnce()
    })

    it('returns false and emits UNDO_FAILED when undo function throws', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const error = new Error('restore failed')
        pushUndo('Failing action', vi.fn(() => { throw error }))
        vi.clearAllMocks()

        const result = await performUndo()

        expect(result).toBe(false)
        expect(events.emit).toHaveBeenCalledWith(Events.UNDO_FAILED, {
            description: 'Failing action',
            error
        })

        consoleSpy.mockRestore()
    })

    it('returns false when async undo function rejects', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const error = new Error('async failure')
        pushUndo('Async failing', vi.fn(async () => { throw error }))
        vi.clearAllMocks()

        const result = await performUndo()

        expect(result).toBe(false)
        expect(events.emit).toHaveBeenCalledWith(Events.UNDO_FAILED, {
            description: 'Async failing',
            error
        })

        consoleSpy.mockRestore()
    })

    it('suppresses pushUndo calls during undo execution', async () => {
        // The undo function tries to push a new undo entry (simulating a reverse operation)
        const undoFn = vi.fn(() => {
            pushUndo('Reverse action', vi.fn())
        })
        pushUndo('Original action', undoFn)

        await performUndo()

        // The reverse push should have been suppressed
        expect(getUndoStackSize()).toBe(0)
    })

    it('re-enables pushUndo after undo completes', async () => {
        pushUndo('Action', vi.fn())
        await performUndo()

        pushUndo('New action', vi.fn())
        expect(getUndoStackSize()).toBe(1)
    })

    it('re-enables pushUndo even after undo function throws', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        pushUndo('Failing', vi.fn(() => { throw new Error('fail') }))

        await performUndo()

        pushUndo('After failure', vi.fn())
        expect(getUndoStackSize()).toBe(1)

        consoleSpy.mockRestore()
    })
})

// ─── getUndoStackSize ─────────────────────────────────────────────────────────

describe('getUndoStackSize', () => {
    beforeEach(() => {
        clearUndoStack()
    })

    it('returns 0 for empty stack', () => {
        expect(getUndoStackSize()).toBe(0)
    })

    it('returns correct count after pushes', () => {
        pushUndo('A', vi.fn())
        pushUndo('B', vi.fn())
        expect(getUndoStackSize()).toBe(2)
    })

    it('returns correct count after push and pop', async () => {
        pushUndo('A', vi.fn())
        pushUndo('B', vi.fn())
        await performUndo()
        expect(getUndoStackSize()).toBe(1)
    })

    it('returns 0 after clear', () => {
        pushUndo('A', vi.fn())
        pushUndo('B', vi.fn())
        clearUndoStack()
        expect(getUndoStackSize()).toBe(0)
    })
})

// ─── peekUndoDescription ──────────────────────────────────────────────────────

describe('peekUndoDescription', () => {
    beforeEach(() => {
        clearUndoStack()
    })

    it('returns null for empty stack', () => {
        expect(peekUndoDescription()).toBeNull()
    })

    it('returns the latest description', () => {
        pushUndo('First action', vi.fn())
        pushUndo('Second action', vi.fn())
        expect(peekUndoDescription()).toBe('Second action')
    })

    it('updates after pop', async () => {
        pushUndo('First action', vi.fn())
        pushUndo('Second action', vi.fn())

        await performUndo()

        expect(peekUndoDescription()).toBe('First action')
    })

    it('returns null after all items popped', async () => {
        pushUndo('Only action', vi.fn())
        await performUndo()
        expect(peekUndoDescription()).toBeNull()
    })

    it('does not modify the stack', () => {
        pushUndo('Action', vi.fn())
        peekUndoDescription()
        peekUndoDescription()
        expect(getUndoStackSize()).toBe(1)
    })
})

// ─── clearUndoStack ───────────────────────────────────────────────────────────

describe('clearUndoStack', () => {
    beforeEach(() => {
        clearUndoStack()
    })

    it('empties the stack', () => {
        pushUndo('A', vi.fn())
        pushUndo('B', vi.fn())
        pushUndo('C', vi.fn())

        clearUndoStack()

        expect(getUndoStackSize()).toBe(0)
    })

    it('results in size 0', () => {
        pushUndo('Action', vi.fn())
        clearUndoStack()
        expect(getUndoStackSize()).toBe(0)
    })

    it('makes peekUndoDescription return null', () => {
        pushUndo('Action', vi.fn())
        clearUndoStack()
        expect(peekUndoDescription()).toBeNull()
    })

    it('makes performUndo return false', async () => {
        pushUndo('Action', vi.fn())
        clearUndoStack()
        const result = await performUndo()
        expect(result).toBe(false)
    })

    it('can be called on an already empty stack without error', () => {
        expect(() => clearUndoStack()).not.toThrow()
        expect(getUndoStackSize()).toBe(0)
    })

    it('allows new pushes after clearing', () => {
        pushUndo('Before clear', vi.fn())
        clearUndoStack()
        pushUndo('After clear', vi.fn())
        expect(getUndoStackSize()).toBe(1)
        expect(peekUndoDescription()).toBe('After clear')
    })
})
