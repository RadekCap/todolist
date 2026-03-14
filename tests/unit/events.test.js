import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus, events, Events } from '../../src/core/events.js'

describe('EventBus', () => {
    let bus

    beforeEach(() => {
        bus = new EventBus()
    })

    // ─── on ─────────────────────────────────────────────────────────────────

    describe('on', () => {
        it('subscribes and receives emitted events', () => {
            const callback = vi.fn()
            bus.on('test', callback)

            bus.emit('test', 'hello')

            expect(callback).toHaveBeenCalledOnce()
            expect(callback).toHaveBeenCalledWith('hello')
        })

        it('supports multiple listeners on the same event', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            bus.on('test', callback1)
            bus.on('test', callback2)

            bus.emit('test', 'data')

            expect(callback1).toHaveBeenCalledOnce()
            expect(callback2).toHaveBeenCalledOnce()
        })

        it('does not trigger listeners of different events', () => {
            const alphaListener = vi.fn()
            const betaListener = vi.fn()
            bus.on('alpha', alphaListener)
            bus.on('beta', betaListener)

            bus.emit('alpha', 'data')

            expect(alphaListener).toHaveBeenCalledOnce()
            expect(betaListener).not.toHaveBeenCalled()
        })

        it('returns an unsubscribe function', () => {
            const callback = vi.fn()
            const unsubscribe = bus.on('test', callback)

            expect(typeof unsubscribe).toBe('function')
        })

        it('stops receiving events after unsubscribe', () => {
            const callback = vi.fn()
            const unsubscribe = bus.on('test', callback)

            bus.emit('test', 'first')
            expect(callback).toHaveBeenCalledTimes(1)

            unsubscribe()

            bus.emit('test', 'second')
            expect(callback).toHaveBeenCalledTimes(1)
        })

        it('only unsubscribes the specific listener', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            const unsub1 = bus.on('test', callback1)
            bus.on('test', callback2)

            unsub1()
            bus.emit('test', 'data')

            expect(callback1).not.toHaveBeenCalled()
            expect(callback2).toHaveBeenCalledOnce()
        })

        it('handles double unsubscribe gracefully', () => {
            const callback = vi.fn()
            const unsubscribe = bus.on('test', callback)

            unsubscribe()
            expect(() => unsubscribe()).not.toThrow()
        })

        it('receives events on every emit', () => {
            const callback = vi.fn()
            bus.on('test', callback)

            bus.emit('test', 'a')
            bus.emit('test', 'b')
            bus.emit('test', 'c')

            expect(callback).toHaveBeenCalledTimes(3)
        })
    })

    // ─── once ───────────────────────────────────────────────────────────────

    describe('once', () => {
        it('fires the callback only once', () => {
            const callback = vi.fn()
            bus.once('test', callback)

            bus.emit('test', 'first')
            bus.emit('test', 'second')
            bus.emit('test', 'third')

            expect(callback).toHaveBeenCalledOnce()
            expect(callback).toHaveBeenCalledWith('first')
        })

        it('returns an unsubscribe function', () => {
            const callback = vi.fn()
            const unsubscribe = bus.once('test', callback)

            expect(typeof unsubscribe).toBe('function')
        })

        it('can be unsubscribed before firing', () => {
            const callback = vi.fn()
            const unsubscribe = bus.once('test', callback)

            unsubscribe()
            bus.emit('test', 'data')

            expect(callback).not.toHaveBeenCalled()
        })

        it('does not interfere with other listeners on the same event', () => {
            const onceCallback = vi.fn()
            const onCallback = vi.fn()
            bus.once('test', onceCallback)
            bus.on('test', onCallback)

            bus.emit('test', 'first')
            bus.emit('test', 'second')

            expect(onceCallback).toHaveBeenCalledOnce()
            expect(onCallback).toHaveBeenCalledTimes(2)
        })
    })

    // ─── emit ───────────────────────────────────────────────────────────────

    describe('emit', () => {
        it('passes data to callbacks', () => {
            const callback = vi.fn()
            bus.on('test', callback)

            const payload = { id: 1, text: 'hello' }
            bus.emit('test', payload)

            expect(callback).toHaveBeenCalledWith(payload)
        })

        it('does not throw when emitting with no listeners', () => {
            expect(() => bus.emit('nonexistent', 'data')).not.toThrow()
        })

        it('does not throw when emitting with no data', () => {
            const callback = vi.fn()
            bus.on('test', callback)

            expect(() => bus.emit('test')).not.toThrow()
            expect(callback).toHaveBeenCalledWith(undefined)
        })

        it('passes complex data structures', () => {
            const callback = vi.fn()
            bus.on('test', callback)

            const complexData = { items: [1, 2, 3], nested: { a: true } }
            bus.emit('test', complexData)

            expect(callback).toHaveBeenCalledWith(complexData)
        })

        it('passes null and falsy values correctly', () => {
            const callback = vi.fn()
            bus.on('test', callback)

            bus.emit('test', null)
            expect(callback).toHaveBeenCalledWith(null)

            bus.emit('test', 0)
            expect(callback).toHaveBeenCalledWith(0)

            bus.emit('test', false)
            expect(callback).toHaveBeenCalledWith(false)

            bus.emit('test', '')
            expect(callback).toHaveBeenCalledWith('')
        })
    })

    // ─── off ────────────────────────────────────────────────────────────────

    describe('off', () => {
        it('removes all listeners for an event', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            bus.on('test', callback1)
            bus.on('test', callback2)

            bus.off('test')
            bus.emit('test', 'data')

            expect(callback1).not.toHaveBeenCalled()
            expect(callback2).not.toHaveBeenCalled()
        })

        it('does not affect listeners of other events', () => {
            const alphaCallback = vi.fn()
            const betaCallback = vi.fn()
            bus.on('alpha', alphaCallback)
            bus.on('beta', betaCallback)

            bus.off('alpha')

            bus.emit('alpha', 'data')
            bus.emit('beta', 'data')

            expect(alphaCallback).not.toHaveBeenCalled()
            expect(betaCallback).toHaveBeenCalledOnce()
        })

        it('does not throw when removing listeners for event with none', () => {
            expect(() => bus.off('nonexistent')).not.toThrow()
        })
    })

    // ─── clear ──────────────────────────────────────────────────────────────

    describe('clear', () => {
        it('removes all listeners for all events', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            const callback3 = vi.fn()
            bus.on('alpha', callback1)
            bus.on('beta', callback2)
            bus.on('gamma', callback3)

            bus.clear()

            bus.emit('alpha', 'data')
            bus.emit('beta', 'data')
            bus.emit('gamma', 'data')

            expect(callback1).not.toHaveBeenCalled()
            expect(callback2).not.toHaveBeenCalled()
            expect(callback3).not.toHaveBeenCalled()
        })

        it('does not throw when clearing with no listeners', () => {
            expect(() => bus.clear()).not.toThrow()
        })

        it('allows re-subscribing after clear', () => {
            const callback = vi.fn()
            bus.on('test', callback)
            bus.clear()

            const newCallback = vi.fn()
            bus.on('test', newCallback)
            bus.emit('test', 'after-clear')

            expect(callback).not.toHaveBeenCalled()
            expect(newCallback).toHaveBeenCalledOnce()
            expect(newCallback).toHaveBeenCalledWith('after-clear')
        })
    })

    // ─── error handling ─────────────────────────────────────────────────────

    describe('error handling in listeners', () => {
        it('continues notifying other listeners if one throws', () => {
            const errorCallback = vi.fn(() => { throw new Error('boom') })
            const normalCallback = vi.fn()

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            bus.on('test', errorCallback)
            bus.on('test', normalCallback)

            bus.emit('test', 'data')

            expect(errorCallback).toHaveBeenCalledOnce()
            expect(normalCallback).toHaveBeenCalledOnce()

            consoleSpy.mockRestore()
        })

        it('logs error to console when listener throws', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            bus.on('test', () => { throw new Error('listener error') })
            bus.emit('test', 'data')

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('test'),
                expect.any(Error)
            )

            consoleSpy.mockRestore()
        })
    })
})

// ─── Events enum ────────────────────────────────────────────────────────────

describe('Events enum', () => {
    it('has auth event constants', () => {
        expect(Events.AUTH_LOGIN).toBe('auth:login')
        expect(Events.AUTH_LOGOUT).toBe('auth:logout')
        expect(Events.AUTH_UNLOCK).toBe('auth:unlock')
        expect(Events.AUTH_LOCK).toBe('auth:lock')
    })

    it('has todo event constants', () => {
        expect(Events.TODOS_LOADED).toBe('todos:loaded')
        expect(Events.TODOS_UPDATED).toBe('todos:updated')
        expect(Events.TODO_ADDED).toBe('todo:added')
        expect(Events.TODO_UPDATED).toBe('todo:updated')
        expect(Events.TODO_DELETED).toBe('todo:deleted')
    })

    it('has project event constants', () => {
        expect(Events.PROJECTS_LOADED).toBe('projects:loaded')
        expect(Events.PROJECT_ADDED).toBe('project:added')
        expect(Events.PROJECT_UPDATED).toBe('project:updated')
        expect(Events.PROJECT_DELETED).toBe('project:deleted')
    })

    it('has area event constants', () => {
        expect(Events.AREAS_LOADED).toBe('areas:loaded')
        expect(Events.AREA_ADDED).toBe('area:added')
        expect(Events.AREA_UPDATED).toBe('area:updated')
        expect(Events.AREA_DELETED).toBe('area:deleted')
    })

    it('has data loading event constants', () => {
        expect(Events.CATEGORIES_LOADED).toBe('categories:loaded')
        expect(Events.CONTEXTS_LOADED).toBe('contexts:loaded')
        expect(Events.PRIORITIES_LOADED).toBe('priorities:loaded')
    })

    it('has UI event constants', () => {
        expect(Events.MODAL_OPEN).toBe('modal:open')
        expect(Events.MODAL_CLOSE).toBe('modal:close')
        expect(Events.VIEW_CHANGED).toBe('view:changed')
        expect(Events.THEME_CHANGED).toBe('theme:changed')
        expect(Events.DENSITY_CHANGED).toBe('density:changed')
        expect(Events.OPEN_GTD_GUIDE).toBe('ui:openGtdGuide')
    })

    it('has undo event constants', () => {
        expect(Events.UNDO_PUSHED).toBe('undo:pushed')
        expect(Events.UNDO_PERFORMED).toBe('undo:performed')
        expect(Events.UNDO_FAILED).toBe('undo:failed')
    })

    it('has project template event constants', () => {
        expect(Events.PROJECT_TEMPLATES_LOADED).toBe('projectTemplates:loaded')
        expect(Events.PROJECT_TEMPLATE_ADDED).toBe('projectTemplate:added')
        expect(Events.PROJECT_TEMPLATE_DELETED).toBe('projectTemplate:deleted')
        expect(Events.PROJECT_TEMPLATE_APPLIED).toBe('projectTemplate:applied')
    })

    it('has render event constants', () => {
        expect(Events.RENDER_TODOS).toBe('render:todos')
        expect(Events.RENDER_PROJECTS).toBe('render:projects')
        expect(Events.RENDER_GTD_LIST).toBe('render:gtdList')
        expect(Events.RENDER_AREAS).toBe('render:areas')
        expect(Events.RENDER_ALL).toBe('render:all')
    })

    it('has all values as strings', () => {
        for (const [key, value] of Object.entries(Events)) {
            expect(typeof value).toBe('string')
        }
    })
})

// ─── events singleton ───────────────────────────────────────────────────────

describe('events singleton', () => {
    it('is an instance of EventBus', () => {
        expect(events).toBeInstanceOf(EventBus)
    })

    it('has all EventBus methods', () => {
        expect(typeof events.on).toBe('function')
        expect(typeof events.once).toBe('function')
        expect(typeof events.emit).toBe('function')
        expect(typeof events.off).toBe('function')
        expect(typeof events.clear).toBe('function')
    })
})
