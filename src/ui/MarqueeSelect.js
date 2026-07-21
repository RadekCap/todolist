import { store } from '../core/store.js'
import { clearTodoSelection } from '../services/todos-selection.js'

const DRAG_THRESHOLD = 5
const SCROLL_EDGE_SIZE = 40
const SCROLL_SPEED_MIN = 2
const SCROLL_SPEED_MAX = 12

export class MarqueeSelect {
    constructor({ container, todoList }) {
        this.container = container
        this.todoList = todoList

        this.isDragging = false
        this.isTracking = false
        this.startX = 0
        this.startY = 0
        this.currentX = 0
        this.currentY = 0
        this.marqueeEl = null
        this.rafId = null
        this.scrollRafId = null
        this.shiftHeld = false
        this.preExistingSelection = new Set()
        this.lastIntersectedIds = new Set()

        this._onMouseDown = this._onMouseDown.bind(this)
        this._onMouseMove = this._onMouseMove.bind(this)
        this._onMouseUp = this._onMouseUp.bind(this)
    }

    init() {
        this.todoList.addEventListener('mousedown', this._onMouseDown)
        document.addEventListener('mousemove', this._onMouseMove)
        document.addEventListener('mouseup', this._onMouseUp)
    }

    destroy() {
        this.todoList.removeEventListener('mousedown', this._onMouseDown)
        document.removeEventListener('mousemove', this._onMouseMove)
        document.removeEventListener('mouseup', this._onMouseUp)
        this._cleanup()
    }

    _isInteractiveTarget(target) {
        return target.closest('.drag-handle') ||
            target.closest('.todo-checkbox') ||
            target.closest('.delete-btn') ||
            target.closest('.todo-text') ||
            target.closest('.todo-comment') ||
            target.closest('.selection-bar') ||
            target.closest('.content-toolbar') ||
            target.closest('button') ||
            target.closest('input') ||
            target.closest('select') ||
            target.closest('a')
    }

    _onMouseDown(e) {
        if (e.button !== 0) return
        if (this._isInteractiveTarget(e.target)) return
        if (e.target.closest('.scheduled-section-header') ||
            e.target.closest('.project-title-header') ||
            e.target.closest('.empty-state') ||
            e.target.closest('.inbox-zen-state')) return

        this.isTracking = true
        this.startX = e.clientX
        this.startY = e.clientY
        this.shiftHeld = e.shiftKey

        if (this.shiftHeld) {
            this.preExistingSelection = new Set(store.get('selectedTodoIds'))
        } else {
            this.preExistingSelection = new Set()
        }
    }

    _onMouseMove(e) {
        if (!this.isTracking && !this.isDragging) return

        this.currentX = e.clientX
        this.currentY = e.clientY

        if (this.isTracking && !this.isDragging) {
            const dx = this.currentX - this.startX
            const dy = this.currentY - this.startY
            if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
                this._startDrag()
            }
            return
        }

        if (this.isDragging) {
            e.preventDefault()
            if (!this.rafId) {
                this.rafId = requestAnimationFrame(() => {
                    this._updateMarquee()
                    this._computeIntersections()
                    this.rafId = null
                })
            }
            this._manageAutoScroll()
        }
    }

    _onMouseUp() {
        if (this.isDragging) {
            this._endDrag()
        }
        this.isTracking = false
    }

    _startDrag() {
        this.isTracking = false
        this.isDragging = true
        document.body.classList.add('marquee-dragging')

        if (!this.shiftHeld) {
            clearTodoSelection()
        }

        this._createMarqueeElement()
    }

    _endDrag() {
        this.isDragging = false
        document.body.classList.remove('marquee-dragging')

        const finalIds = new Set(this.preExistingSelection)
        this.lastIntersectedIds.forEach(id => finalIds.add(id))
        store.set('selectedTodoIds', finalIds)
        if (this.lastIntersectedIds.size > 0) {
            const arr = Array.from(this.lastIntersectedIds)
            store.set('lastSelectedTodoId', arr[arr.length - 1])
        }

        this.todoList.querySelectorAll('.todo-item.marquee-hover').forEach(el => {
            el.classList.remove('marquee-hover')
        })

        this._removeMarqueeElement()
        this._stopAutoScroll()

        if (this.rafId) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }

        // Prevent the click event that follows mouseup from triggering item handlers
        const preventClick = (e) => {
            e.stopPropagation()
            e.preventDefault()
        }
        document.addEventListener('click', preventClick, { capture: true, once: true })
    }

    _createMarqueeElement() {
        this.marqueeEl = document.createElement('div')
        this.marqueeEl.className = 'marquee-select-overlay'
        document.body.appendChild(this.marqueeEl)
        this._updateMarquee()
    }

    _removeMarqueeElement() {
        if (this.marqueeEl) {
            this.marqueeEl.remove()
            this.marqueeEl = null
        }
    }

    _updateMarquee() {
        if (!this.marqueeEl) return
        const left = Math.min(this.startX, this.currentX)
        const top = Math.min(this.startY, this.currentY)
        const width = Math.abs(this.currentX - this.startX)
        const height = Math.abs(this.currentY - this.startY)

        this.marqueeEl.style.left = left + 'px'
        this.marqueeEl.style.top = top + 'px'
        this.marqueeEl.style.width = width + 'px'
        this.marqueeEl.style.height = height + 'px'
    }

    _computeIntersections() {
        const marqueeRect = {
            left: Math.min(this.startX, this.currentX),
            top: Math.min(this.startY, this.currentY),
            right: Math.max(this.startX, this.currentX),
            bottom: Math.max(this.startY, this.currentY)
        }

        const items = this.todoList.querySelectorAll('.todo-item')
        const newIntersectedIds = new Set()

        items.forEach(item => {
            const rect = item.getBoundingClientRect()
            const intersects = !(
                rect.right < marqueeRect.left ||
                rect.left > marqueeRect.right ||
                rect.bottom < marqueeRect.top ||
                rect.top > marqueeRect.bottom
            )

            if (intersects) {
                const todoId = Number(item.dataset.todoId)
                if (todoId) {
                    newIntersectedIds.add(todoId)
                    item.classList.add('marquee-hover')
                }
            } else {
                item.classList.remove('marquee-hover')
            }
        })

        this.lastIntersectedIds = newIntersectedIds
    }

    _manageAutoScroll() {
        const listRect = this.todoList.getBoundingClientRect()
        const mouseY = this.currentY

        const distFromTop = mouseY - listRect.top
        const distFromBottom = listRect.bottom - mouseY

        let scrollDirection = 0
        let speed = 0

        if (distFromTop < SCROLL_EDGE_SIZE && distFromTop >= 0) {
            scrollDirection = -1
            speed = SCROLL_SPEED_MIN + (SCROLL_SPEED_MAX - SCROLL_SPEED_MIN) * (1 - distFromTop / SCROLL_EDGE_SIZE)
        } else if (distFromBottom < SCROLL_EDGE_SIZE && distFromBottom >= 0) {
            scrollDirection = 1
            speed = SCROLL_SPEED_MIN + (SCROLL_SPEED_MAX - SCROLL_SPEED_MIN) * (1 - distFromBottom / SCROLL_EDGE_SIZE)
        }

        if (scrollDirection !== 0) {
            if (!this.scrollRafId) {
                const doScroll = () => {
                    if (!this.isDragging) return
                    this.todoList.scrollTop += scrollDirection * speed
                    this._updateMarquee()
                    this._computeIntersections()
                    this.scrollRafId = requestAnimationFrame(doScroll)
                }
                this.scrollRafId = requestAnimationFrame(doScroll)
            }
        } else {
            this._stopAutoScroll()
        }
    }

    _stopAutoScroll() {
        if (this.scrollRafId) {
            cancelAnimationFrame(this.scrollRafId)
            this.scrollRafId = null
        }
    }

    _cleanup() {
        this._removeMarqueeElement()
        this._stopAutoScroll()
        if (this.rafId) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
        document.body.classList.remove('marquee-dragging')
    }
}
