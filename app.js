import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Application version - Update when preparing a new release
const APP_VERSION = '1.0.96'

// Initialize Supabase
const supabaseUrl = 'https://rkvmujdayjmszmyzbhal.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdm11amRheWptc3pteXpiaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc2MDcsImV4cCI6MjA3OTc2MzYwN30.55RoV1mmHeykVz9waU7Jz6-JSkrRqlNa-ABBE8SN-jA'
const supabase = createClient(supabaseUrl, supabaseKey)

// Encryption utilities using Web Crypto API
const CryptoUtils = {
    // Derive an encryption key from password and salt using PBKDF2
    async deriveKey(password, salt) {
        const encoder = new TextEncoder()
        const passwordBuffer = encoder.encode(password)

        // Import password as a key
        const baseKey = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveKey']
        )

        // Derive AES-GCM key using PBKDF2
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
    },

    // Generate a random salt for key derivation
    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(16))
    },

    // Convert Uint8Array to base64 string
    arrayToBase64(array) {
        return btoa(String.fromCharCode(...array))
    },

    // Convert base64 string to Uint8Array
    base64ToArray(base64) {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return bytes
    },

    // Encrypt plaintext using AES-GCM
    async encrypt(plaintext, key) {
        const encoder = new TextEncoder()
        const data = encoder.encode(plaintext)

        // Generate random IV for each encryption
        const iv = crypto.getRandomValues(new Uint8Array(12))

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        )

        // Combine IV + ciphertext and encode as base64
        const combined = new Uint8Array(iv.length + ciphertext.byteLength)
        combined.set(iv)
        combined.set(new Uint8Array(ciphertext), iv.length)

        return this.arrayToBase64(combined)
    },

    // Decrypt ciphertext using AES-GCM
    async decrypt(encryptedBase64, key) {
        const combined = this.base64ToArray(encryptedBase64)

        // Extract IV (first 12 bytes) and ciphertext
        const iv = combined.slice(0, 12)
        const ciphertext = combined.slice(12)

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        )

        const decoder = new TextDecoder()
        return decoder.decode(decrypted)
    }
}

class TodoApp {
    constructor() {
        this.currentUser = null
        this.encryptionKey = null
        this.todos = []
        this.categories = []
        this.priorities = []
        this.contexts = []
        this.projects = []
        this.selectedCategoryIds = new Set()
        this.selectedContextIds = new Set()
        this.selectedProjectId = null
        this.showProjectsView = false  // When true, show project list instead of todos
        this.selectedGtdStatus = 'inbox'
        this.editingTodoId = null
        this.areas = []
        this.selectedAreaId = 'all'  // 'all', 'unassigned', or UUID
        this.searchQuery = ''  // Search query for filtering todos

        // Get DOM elements
        this.loadingScreen = document.getElementById('loadingScreen')
        this.mainContainer = document.getElementById('mainContainer')
        this.authContainer = document.getElementById('authContainer')
        this.appContainer = document.getElementById('appContainer')
        this.authMessage = document.getElementById('authMessage')
        this.loginForm = document.getElementById('loginForm')
        this.signupForm = document.getElementById('signupForm')
        this.toolbarUsername = document.getElementById('toolbarUsername')
        this.toolbarUserMenu = document.getElementById('toolbarUserMenu')
        this.toolbarUserBtn = document.getElementById('toolbarUserBtn')
        this.settingsBtn = document.getElementById('settingsBtn')
        this.refreshBtn = document.getElementById('refreshBtn')
        this.lockBtn = document.getElementById('lockBtn')
        this.logoutBtn = document.getElementById('logoutBtn')
        this.settingsModal = document.getElementById('settingsModal')
        this.closeSettingsModalBtn = document.getElementById('closeSettingsModal')
        this.cancelSettingsModalBtn = document.getElementById('cancelSettingsModal')
        this.settingsForm = document.getElementById('settingsForm')
        this.usernameInput = document.getElementById('usernameInput')
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn')
        this.migrateDataBtn = document.getElementById('migrateDataBtn')
        this.migrateStatus = document.getElementById('migrateStatus')
        this.openAddTodoModalBtn = document.getElementById('openAddTodoModal')
        this.addTodoModal = document.getElementById('addTodoModal')
        this.closeModalBtn = document.getElementById('closeModal')
        this.cancelModalBtn = document.getElementById('cancelModal')
        this.addTodoForm = document.getElementById('addTodoForm')
        this.modalTodoInput = document.getElementById('modalTodoInput')
        this.modalCategorySelect = document.getElementById('modalCategorySelect')
        this.modalPrioritySelect = document.getElementById('modalPrioritySelect')
        this.modalGtdStatusSelect = document.getElementById('modalGtdStatusSelect')
        this.modalContextSelect = document.getElementById('modalContextSelect')
        this.modalDueDateInput = document.getElementById('modalDueDateInput')
        this.modalCommentInput = document.getElementById('modalCommentInput')
        this.modalPriorityToggle = document.getElementById('modalPriorityToggle')
        this.modalAddBtn = document.getElementById('modalAddBtn')
        this.modalTitle = document.getElementById('modalTitle')
        this.todoList = document.getElementById('todoList')
        this.projectList = document.getElementById('projectList')
        this.newProjectInput = document.getElementById('newProjectInput')
        this.addProjectBtn = document.getElementById('addProjectBtn')
        this.projectsSection = document.getElementById('projectsSection')
        this.modalProjectSelect = document.getElementById('modalProjectSelect')
        this.gtdList = document.getElementById('gtdList')
        this.exportBtn = document.getElementById('exportBtn')
        this.searchInput = document.getElementById('searchInput')
        this.versionNumberEl = document.getElementById('versionNumber')
        this.themeSelect = document.getElementById('themeSelect')
        this.unlockModal = document.getElementById('unlockModal')
        this.unlockForm = document.getElementById('unlockForm')
        this.unlockPassword = document.getElementById('unlockPassword')
        this.unlockEmail = document.getElementById('unlockEmail')
        this.unlockError = document.getElementById('unlockError')
        this.unlockBtn = document.getElementById('unlockBtn')
        this.unlockLogoutBtn = document.getElementById('unlockLogoutBtn')
        this.sidebar = document.querySelector('.sidebar')
        this.sidebarResizeHandle = document.getElementById('sidebarResizeHandle')
        this.mainContent = document.querySelector('.main-content')

        // Areas UI elements
        this.toolbarAreasMenu = document.getElementById('toolbarAreasMenu')
        this.toolbarAreasBtn = document.getElementById('toolbarAreasBtn')
        this.toolbarAreasLabel = document.getElementById('toolbarAreasLabel')
        this.toolbarAreasDropdown = document.getElementById('toolbarAreasDropdown')
        this.areaListContainer = document.getElementById('areaListContainer')
        this.areaListDivider = document.getElementById('areaListDivider')
        this.addAreaBtn = document.getElementById('addAreaBtn')
        this.manageAreasBtn = document.getElementById('manageAreasBtn')
        this.manageAreasModal = document.getElementById('manageAreasModal')
        this.closeManageAreasModalBtn = document.getElementById('closeManageAreasModal')
        this.closeManageAreasModalBtn2 = document.getElementById('closeManageAreasModalBtn')
        this.newAreaInput = document.getElementById('newAreaInput')
        this.addNewAreaBtn = document.getElementById('addNewAreaBtn')
        this.manageAreasList = document.getElementById('manageAreasList')

        this.initAuth()
        this.initEventListeners()
        this.setVersion()
        this.initTheme()
    }

    setVersion() {
        if (this.versionNumberEl) {
            this.versionNumberEl.textContent = APP_VERSION
        }
    }

    async initAuth() {
        // Check current session
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
            // Check if we have a stored password from a previous page load
            const storedPassword = sessionStorage.getItem('_ep')
            if (storedPassword) {
                // Auto-unlock using stored password
                try {
                    await this.initializeEncryption(session.user, storedPassword)
                    await this.handleAuthSuccess(session.user)
                    // handleAuthSuccess calls hideLoadingScreen after data loads
                } catch (e) {
                    // If auto-unlock fails, clear stored password and show modal
                    console.error('Auto-unlock failed:', e)
                    sessionStorage.removeItem('_ep')
                    this.pendingUser = session.user
                    this.showUnlockModal()
                    this.hideLoadingScreen()
                }
            } else {
                // No stored password, show unlock modal
                this.pendingUser = session.user
                this.showUnlockModal()
                this.hideLoadingScreen()
            }
        } else {
            // No session, show auth container
            this.authContainer.classList.add('active')
            this.hideLoadingScreen()
        }

        // Listen for auth changes (only for sign out, sign in handled by login form)
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                this.handleSignOut()
            }
        })
    }

    initEventListeners() {
        // Auth tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab
                this.switchAuthTab(tabName)
            })
        })

        // Login form
        this.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault()
            await this.handleLogin()
        })

        // Signup form
        this.signupForm.addEventListener('submit', async (e) => {
            e.preventDefault()
            await this.handleSignup()
        })

        // Lock
        this.lockBtn.addEventListener('click', () => {
            this.closeToolbarMenu()
            this.lockApp()
        })

        // Logout
        this.logoutBtn.addEventListener('click', async () => {
            this.closeToolbarMenu()
            await this.handleLogout()
        })

        // Refresh data
        this.refreshBtn.addEventListener('click', () => {
            this.closeToolbarMenu()
            this.refreshData()
        })

        // Settings modal controls
        this.settingsBtn.addEventListener('click', () => {
            this.closeToolbarMenu()
            this.openSettingsModal()
        })
        this.closeSettingsModalBtn.addEventListener('click', () => this.closeSettingsModal())
        this.cancelSettingsModalBtn.addEventListener('click', () => this.closeSettingsModal())
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettingsModal()
        })

        // Save settings via form
        this.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault()
            this.saveSettings()
        })

        // Migrate existing data
        this.migrateDataBtn.addEventListener('click', () => this.migrateExistingData())

        // Modal controls
        this.openAddTodoModalBtn.addEventListener('click', () => this.openModal())
        this.closeModalBtn.addEventListener('click', () => this.closeModal())
        this.cancelModalBtn.addEventListener('click', () => this.closeModal())
        this.addTodoModal.addEventListener('click', (e) => {
            if (e.target === this.addTodoModal) this.closeModal()
        })

        // Keyboard shortcut: 'n' to create new item
        document.addEventListener('keydown', (e) => {
            // Ignore if user is typing in an input field
            const activeElement = document.activeElement
            const isTyping = activeElement.tagName === 'INPUT' ||
                           activeElement.tagName === 'TEXTAREA' ||
                           activeElement.tagName === 'SELECT' ||
                           activeElement.isContentEditable

            // Ignore if any modal is open
            const modalOpen = this.addTodoModal.classList.contains('active') ||
                            this.unlockModal.classList.contains('active') ||
                            this.settingsModal.classList.contains('active') ||
                            this.manageAreasModal.classList.contains('active')

            if (e.code === 'KeyN' && !isTyping && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
                e.preventDefault()
                this.openModal()
            }
        })

        // Add/Edit todo via modal form
        this.addTodoForm.addEventListener('submit', (e) => {
            e.preventDefault()
            if (this.editingTodoId) {
                this.updateTodo()
            } else {
                this.addTodo()
            }
        })

        // Ctrl+Enter to submit todo form
        this.addTodoForm.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                if (this.editingTodoId) {
                    this.updateTodo()
                } else {
                    this.addTodo()
                }
            }
        })

        // Sync due date and scheduled status
        this.modalDueDateInput.addEventListener('change', () => {
            if (this.modalDueDateInput.value) {
                // Auto-set scheduled status when due date is filled
                this.modalGtdStatusSelect.value = 'scheduled'
            }
        })

        this.modalGtdStatusSelect.addEventListener('change', () => {
            if (this.modalGtdStatusSelect.value === 'scheduled' && !this.modalDueDateInput.value) {
                // Focus on due date input when scheduled is selected without a date
                this.modalDueDateInput.focus()
            }
        })

        // Priority star toggle
        this.modalPriorityToggle.addEventListener('click', () => this.togglePriorityStar())

        // Add project
        this.addProjectBtn.addEventListener('click', () => this.addProject())
        this.newProjectInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addProject()
        })

        // Collapsible sidebar sections
        this.projectsSection.querySelector('.sidebar-section-header').addEventListener('click', () => {
            this.toggleSidebarSection(this.projectsSection)
        })

        // Unlock modal
        this.unlockForm.addEventListener('submit', (e) => {
            e.preventDefault()
            this.handleUnlock()
        })
        this.unlockLogoutBtn.addEventListener('click', () => this.handleLogout())

        // Theme selector
        this.themeSelect.addEventListener('change', () => this.changeTheme())

        // Export button
        this.exportBtn.addEventListener('click', () => this.exportTodos())

        // Search input
        this.searchInput.addEventListener('input', () => this.handleSearchInput())

        // Toolbar user menu toggle
        this.toolbarUserBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this.toggleToolbarMenu()
        })

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.toolbarUserMenu && !this.toolbarUserMenu.contains(e.target)) {
                this.closeToolbarMenu()
            }
            // Also close areas menu when clicking outside
            if (this.toolbarAreasMenu && !this.toolbarAreasMenu.contains(e.target)) {
                this.closeAreasMenu()
            }
        })

        // Areas dropdown toggle
        this.toolbarAreasBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this.toggleAreasMenu()
        })

        // Areas dropdown item clicks
        this.toolbarAreasDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('[data-area-id]')
            if (item) {
                this.selectArea(item.dataset.areaId)
            }
        })

        // Add new area from dropdown
        this.addAreaBtn.addEventListener('click', () => {
            this.closeAreasMenu()
            this.openManageAreasModal()
            setTimeout(() => this.newAreaInput.focus(), 100)
        })

        // Open manage areas modal
        this.manageAreasBtn.addEventListener('click', () => {
            this.closeAreasMenu()
            this.openManageAreasModal()
        })

        // Manage areas modal controls
        this.closeManageAreasModalBtn.addEventListener('click', () => this.closeManageAreasModal())
        this.closeManageAreasModalBtn2.addEventListener('click', () => this.closeManageAreasModal())
        this.manageAreasModal.addEventListener('click', (e) => {
            if (e.target === this.manageAreasModal) this.closeManageAreasModal()
        })

        // Add new area
        this.addNewAreaBtn.addEventListener('click', () => this.addArea())
        this.newAreaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addArea()
        })

        // Initialize sidebar resize
        this.initSidebarResize()
    }

    toggleToolbarMenu() {
        const isOpen = this.toolbarUserMenu.classList.toggle('open')
        this.toolbarUserBtn.setAttribute('aria-expanded', isOpen)
    }

    closeToolbarMenu() {
        this.toolbarUserMenu.classList.remove('open')
        this.toolbarUserBtn.setAttribute('aria-expanded', 'false')
    }

    handleSearchInput() {
        this.searchQuery = this.searchInput.value.trim().toLowerCase()
        this.renderTodos()
    }

    // ========================================
    // Areas Methods
    // ========================================

    toggleAreasMenu() {
        const isOpen = this.toolbarAreasMenu.classList.toggle('open')
        this.toolbarAreasBtn.setAttribute('aria-expanded', isOpen)
    }

    closeAreasMenu() {
        this.toolbarAreasMenu.classList.remove('open')
        this.toolbarAreasBtn.setAttribute('aria-expanded', 'false')
    }

    async loadAreas() {
        const { data, error } = await supabase
            .from('areas')
            .select('*')
            .order('sort_order', { ascending: true })

        if (error) {
            console.error('Error loading areas:', error)
            return
        }

        // Decrypt area names
        this.areas = await Promise.all(data.map(async (area) => ({
            ...area,
            name: await this.decrypt(area.name)
        })))

        this.renderAreasDropdown()
    }

    renderAreasDropdown() {
        this.areaListContainer.innerHTML = ''

        // Hide divider if no areas
        if (this.areaListDivider) {
            this.areaListDivider.style.display = this.areas.length > 0 ? 'block' : 'none'
        }

        this.areas.forEach(area => {
            const button = document.createElement('button')
            const isActive = this.selectedAreaId === area.id
            button.className = `toolbar-dropdown-item toolbar-areas-item ${isActive ? 'active' : ''}`
            button.setAttribute('role', 'menuitem')
            button.dataset.areaId = area.id
            button.innerHTML = `
                <span class="areas-item-icon">📂</span>
                <span class="areas-item-label">${this.escapeHtml(area.name)}</span>
            `
            this.areaListContainer.appendChild(button)
        })

        // Update active state for All and Unassigned buttons
        const allBtn = this.toolbarAreasDropdown.querySelector('[data-area-id="all"]')
        const unassignedBtn = this.toolbarAreasDropdown.querySelector('[data-area-id="unassigned"]')

        if (allBtn) allBtn.classList.toggle('active', this.selectedAreaId === 'all')
        if (unassignedBtn) unassignedBtn.classList.toggle('active', this.selectedAreaId === 'unassigned')

        // Update toolbar label
        this.updateAreasLabel()
    }

    updateAreasLabel() {
        if (this.selectedAreaId === 'all') {
            this.toolbarAreasLabel.textContent = 'All Areas'
        } else if (this.selectedAreaId === 'unassigned') {
            this.toolbarAreasLabel.textContent = 'Unassigned'
        } else {
            const area = this.areas.find(a => a.id === this.selectedAreaId)
            this.toolbarAreasLabel.textContent = area ? area.name : 'All Areas'
        }
    }

    selectArea(areaId) {
        this.selectedAreaId = areaId
        this.closeAreasMenu()
        this.renderAreasDropdown()
        this.renderGtdList()
        this.renderProjects()
        this.renderTodos()
    }

    openManageAreasModal() {
        this.manageAreasModal.classList.add('active')
        this.renderManageAreasList()

        this.handleManageAreasEscapeKey = (e) => {
            if (e.key === 'Escape') this.closeManageAreasModal()
        }
        document.addEventListener('keydown', this.handleManageAreasEscapeKey)

        setTimeout(() => this.newAreaInput.focus(), 100)
    }

    closeManageAreasModal() {
        this.manageAreasModal.classList.remove('active')

        if (this.handleManageAreasEscapeKey) {
            document.removeEventListener('keydown', this.handleManageAreasEscapeKey)
        }

        this.newAreaInput.value = ''
    }

    renderManageAreasList() {
        this.manageAreasList.innerHTML = ''

        this.areas.forEach(area => {
            const li = document.createElement('li')
            li.className = 'manage-areas-item'
            li.dataset.areaId = area.id
            li.draggable = true
            li.innerHTML = `
                <span class="manage-areas-drag-handle">⋮⋮</span>
                <span class="manage-areas-name">${this.escapeHtml(area.name)}</span>
                <div class="manage-areas-actions">
                    <button class="manage-areas-edit" data-id="${area.id}" title="Rename">✎</button>
                    <button class="manage-areas-delete" data-id="${area.id}" title="Delete">×</button>
                </div>
            `

            // Drag events for reordering
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', area.id)
                li.classList.add('dragging')
            })
            li.addEventListener('dragend', () => {
                li.classList.remove('dragging')
                this.manageAreasList.querySelectorAll('.manage-areas-item').forEach(item => {
                    item.classList.remove('drag-over')
                })
            })
            li.addEventListener('dragover', (e) => {
                e.preventDefault()
                const dragging = this.manageAreasList.querySelector('.dragging')
                if (dragging && dragging !== li) {
                    li.classList.add('drag-over')
                }
            })
            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over')
            })
            li.addEventListener('drop', async (e) => {
                e.preventDefault()
                li.classList.remove('drag-over')
                const dragging = this.manageAreasList.querySelector('.dragging')
                if (dragging && dragging !== li) {
                    const rect = li.getBoundingClientRect()
                    const midY = rect.top + rect.height / 2
                    if (e.clientY < midY) {
                        li.before(dragging)
                    } else {
                        li.after(dragging)
                    }
                    const orderedIds = [...this.manageAreasList.querySelectorAll('.manage-areas-item')]
                        .map(item => item.dataset.areaId)
                    await this.reorderAreas(orderedIds)
                }
            })

            // Edit button
            li.querySelector('.manage-areas-edit').addEventListener('click', (e) => {
                e.stopPropagation()
                this.startEditingArea(area.id)
            })

            // Delete button
            li.querySelector('.manage-areas-delete').addEventListener('click', (e) => {
                e.stopPropagation()
                this.deleteArea(area.id)
            })

            this.manageAreasList.appendChild(li)
        })
    }

    startEditingArea(areaId) {
        const li = this.manageAreasList.querySelector(`[data-area-id="${areaId}"]`)
        if (!li) return

        const area = this.areas.find(a => a.id === areaId)
        if (!area) return

        const nameSpan = li.querySelector('.manage-areas-name')
        const currentName = area.name

        // Replace name with input
        const input = document.createElement('input')
        input.type = 'text'
        input.className = 'manage-areas-name-input'
        input.value = currentName
        input.maxLength = 50

        nameSpan.replaceWith(input)
        input.focus()
        input.select()

        const saveEdit = async () => {
            const newName = input.value.trim()
            if (newName && newName !== currentName) {
                await this.renameArea(areaId, newName)
            } else {
                // Restore original name
                const newSpan = document.createElement('span')
                newSpan.className = 'manage-areas-name'
                newSpan.textContent = currentName
                input.replaceWith(newSpan)
            }
        }

        input.addEventListener('blur', saveEdit)
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                input.blur()
            }
        })
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                const newSpan = document.createElement('span')
                newSpan.className = 'manage-areas-name'
                newSpan.textContent = currentName
                input.replaceWith(newSpan)
            }
        })
    }

    async renameArea(areaId, newName) {
        const encryptedName = await this.encrypt(newName)

        const { error } = await supabase
            .from('areas')
            .update({ name: encryptedName })
            .eq('id', areaId)

        if (error) {
            console.error('Error renaming area:', error)
            alert('Failed to rename area')
            return
        }

        // Update local state
        const area = this.areas.find(a => a.id === areaId)
        if (area) {
            area.name = newName
        }

        this.renderManageAreasList()
        this.renderAreasDropdown()
    }

    async addArea() {
        const name = this.newAreaInput.value.trim()
        if (!name) return

        this.addNewAreaBtn.disabled = true
        this.addNewAreaBtn.textContent = 'Adding...'

        // Get next sort order
        const maxSortOrder = this.areas.reduce((max, a) => Math.max(max, a.sort_order || 0), 0)

        // Encrypt area name before storing
        const encryptedName = await this.encrypt(name)

        const { data, error } = await supabase
            .from('areas')
            .insert({
                user_id: this.currentUser.id,
                name: encryptedName,
                sort_order: maxSortOrder + 1
            })
            .select()

        this.addNewAreaBtn.disabled = false
        this.addNewAreaBtn.textContent = 'Add'

        if (error) {
            console.error('Error adding area:', error)
            alert('Failed to add area')
            return
        }

        this.newAreaInput.value = ''
        await this.loadAreas()
        this.renderManageAreasList()
    }

    async deleteArea(areaId) {
        const area = this.areas.find(a => a.id === areaId)
        if (!area) return

        if (!confirm(`Delete "${area.name}"? Projects in this area will become unassigned.`)) {
            return
        }

        const { error } = await supabase
            .from('areas')
            .delete()
            .eq('id', areaId)

        if (error) {
            console.error('Error deleting area:', error)
            alert('Failed to delete area')
            return
        }

        // Update local state
        this.areas = this.areas.filter(a => a.id !== areaId)

        // If deleted area was selected, switch to All
        if (this.selectedAreaId === areaId) {
            this.selectedAreaId = 'all'
        }

        this.renderAreasDropdown()
        this.renderManageAreasList()
        await this.loadProjects()  // Reload to get updated area assignments
    }

    async reorderAreas(orderedIds) {
        // Update local state first for immediate feedback
        const reorderedAreas = orderedIds.map((id, index) => {
            const area = this.areas.find(a => a.id === id)
            return { ...area, sort_order: index }
        })
        this.areas = reorderedAreas

        // Update database
        for (let i = 0; i < orderedIds.length; i++) {
            await supabase
                .from('areas')
                .update({ sort_order: i })
                .eq('id', orderedIds[i])
        }

        this.renderAreasDropdown()
    }

    initSidebarResize() {
        if (!this.sidebarResizeHandle || !this.sidebar || !this.mainContent) return

        // Restore saved width from localStorage
        const savedWidth = localStorage.getItem('sidebarWidth')
        if (savedWidth) {
            const width = parseFloat(savedWidth)
            if (width >= 15 && width <= 30) {
                this.sidebar.style.width = `${width}%`
            }
        }

        let isResizing = false
        let startX = 0
        let startWidth = 0

        const startResize = (e) => {
            isResizing = true
            startX = e.clientX || e.touches[0].clientX
            startWidth = this.sidebar.getBoundingClientRect().width
            document.body.classList.add('sidebar-resizing')
            this.sidebarResizeHandle.classList.add('resizing')
            e.preventDefault()
        }

        const doResize = (e) => {
            if (!isResizing) return
            const clientX = e.clientX || (e.touches && e.touches[0].clientX)
            if (clientX === undefined) return

            const deltaX = clientX - startX
            const containerWidth = this.mainContent.getBoundingClientRect().width
            const newWidth = startWidth + deltaX
            const newWidthPercent = (newWidth / containerWidth) * 100

            // Clamp between 15% and 30%
            const clampedPercent = Math.min(30, Math.max(15, newWidthPercent))
            this.sidebar.style.width = `${clampedPercent}%`
        }

        const stopResize = () => {
            if (!isResizing) return
            isResizing = false
            document.body.classList.remove('sidebar-resizing')
            this.sidebarResizeHandle.classList.remove('resizing')

            // Save width to localStorage
            const containerWidth = this.mainContent.getBoundingClientRect().width
            const currentWidth = this.sidebar.getBoundingClientRect().width
            const widthPercent = (currentWidth / containerWidth) * 100
            localStorage.setItem('sidebarWidth', widthPercent.toFixed(2))
        }

        // Mouse events
        this.sidebarResizeHandle.addEventListener('mousedown', startResize)
        document.addEventListener('mousemove', doResize)
        document.addEventListener('mouseup', stopResize)

        // Touch events for mobile/tablet
        this.sidebarResizeHandle.addEventListener('touchstart', startResize, { passive: false })
        document.addEventListener('touchmove', doResize, { passive: false })
        document.addEventListener('touchend', stopResize)
    }

    switchAuthTab(tabName) {
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName)
        })
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tabName}Form`)
        })
        this.authMessage.innerHTML = ''
    }

    showMessage(message, type = 'error') {
        const className = type === 'error' ? 'error-message' : 'success-message'
        this.authMessage.innerHTML = `<div class="${className}">${this.escapeHtml(message)}</div>`
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value
        const password = document.getElementById('loginPassword').value

        const submitBtn = this.loginForm.querySelector('button[type="submit"]')
        submitBtn.disabled = true
        submitBtn.textContent = 'Logging in...'

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        submitBtn.disabled = false
        submitBtn.textContent = 'Login'

        if (error) {
            this.showMessage(error.message, 'error')
        } else {
            await this.initializeEncryption(data.user, password)
            // Store password in sessionStorage for page reload persistence
            sessionStorage.setItem('_ep', password)

            // Show loading screen while data loads
            this.loadingScreen.classList.remove('hidden')

            await this.handleAuthSuccess(data.user)
        }
    }

    async handleSignup() {
        const email = document.getElementById('signupEmail').value
        const password = document.getElementById('signupPassword').value
        const passwordConfirm = document.getElementById('signupPasswordConfirm').value

        if (password !== passwordConfirm) {
            this.showMessage('Passwords do not match', 'error')
            return
        }

        const submitBtn = this.signupForm.querySelector('button[type="submit"]')
        submitBtn.disabled = true
        submitBtn.textContent = 'Signing up...'

        const { data, error } = await supabase.auth.signUp({
            email,
            password
        })

        submitBtn.disabled = false
        submitBtn.textContent = 'Sign Up'

        if (error) {
            this.showMessage(error.message, 'error')
        } else {
            this.showMessage('Account created! Please check your email to confirm your account. You can now login.', 'success')
            this.switchAuthTab('login')
        }
    }

    async handleLogout() {
        await supabase.auth.signOut()
    }

    async handleAuthSuccess(user) {
        this.currentUser = user
        this.authContainer.classList.remove('active')
        this.appContainer.classList.add('active')
        this.mainContainer.classList.remove('auth-mode')
        document.body.classList.add('fullscreen-mode')

        // Load data and wait for essential items
        await Promise.all([
            this.loadAreas(),
            this.loadCategories(),
            this.loadPriorities(),
            this.loadContexts(),
            this.loadProjects(),
            this.loadTodos()
        ])

        // Load non-essential items without waiting
        this.loadThemeFromDatabase()
        this.loadUserSettings()

        // Hide loading screen after data is ready
        this.hideLoadingScreen()
    }

    hideLoadingScreen() {
        this.loadingScreen.classList.add('hidden')
        this.mainContainer.classList.remove('loading')
        this.mainContainer.classList.add('loaded')
    }

    async refreshData() {
        this.refreshBtn.disabled = true
        this.refreshBtn.textContent = 'Refreshing...'

        try {
            await Promise.all([
                this.loadAreas(),
                this.loadCategories(),
                this.loadPriorities(),
                this.loadContexts(),
                this.loadProjects(),
                this.loadTodos()
            ])
        } catch (error) {
            console.error('Error refreshing data:', error)
        } finally {
            this.refreshBtn.disabled = false
            this.refreshBtn.textContent = 'Refresh'
        }
    }

    handleSignOut() {
        this.currentUser = null
        this.encryptionKey = null
        this.todos = []
        this.categories = []
        this.priorities = []
        this.areas = []
        this.selectedAreaId = 'all'
        this.contexts = []
        this.selectedCategoryIds = new Set()
        this.selectedContextIds = new Set()
        this.selectedGtdStatus = 'inbox'
        sessionStorage.removeItem('_ep')
        this.authContainer.classList.add('active')
        this.appContainer.classList.remove('active')
        this.mainContainer.classList.add('auth-mode')
        document.body.classList.remove('fullscreen-mode')
        this.loginForm.reset()
        this.signupForm.reset()
        this.authMessage.innerHTML = ''
        this.closeUnlockModal()
    }

    lockApp() {
        // Store current user for unlock verification
        this.pendingUser = this.currentUser

        // Clear sensitive data from memory and storage
        this.encryptionKey = null
        this.todos = []
        this.categories = []
        this.priorities = []
        this.contexts = []
        sessionStorage.removeItem('_ep')

        // Clear the UI
        this.todoList.innerHTML = ''

        // Hide app and show unlock modal
        this.appContainer.classList.remove('active')
        this.mainContainer.classList.add('auth-mode')
        this.showUnlockModal()
    }

    showUnlockModal() {
        this.unlockModal.classList.add('active')
        this.unlockError.style.display = 'none'
        this.unlockEmail.value = this.pendingUser?.email || ''
        this.unlockPassword.value = ''
        setTimeout(() => this.unlockPassword.focus(), 100)
    }

    closeUnlockModal() {
        this.unlockModal.classList.remove('active')
        this.unlockPassword.value = ''
        this.unlockError.style.display = 'none'
        this.pendingUser = null
    }

    async handleUnlock() {
        const password = this.unlockPassword.value

        if (!password) {
            this.unlockError.textContent = 'Please enter your password'
            this.unlockError.style.display = 'block'
            return
        }

        this.unlockBtn.disabled = true
        this.unlockBtn.textContent = 'Unlocking...'
        this.unlockError.style.display = 'none'

        try {
            // Verify password by attempting to sign in
            const { error } = await supabase.auth.signInWithPassword({
                email: this.pendingUser.email,
                password: password
            })

            if (error) {
                this.unlockError.textContent = 'Incorrect password'
                this.unlockError.style.display = 'block'
                this.unlockBtn.disabled = false
                this.unlockBtn.textContent = 'Unlock'
                return
            }

            // Initialize encryption with the verified password
            await this.initializeEncryption(this.pendingUser, password)

            // Store password in sessionStorage for page reload persistence
            sessionStorage.setItem('_ep', password)

            // Save user reference before closing modal (closeUnlockModal clears pendingUser)
            const user = this.pendingUser

            // Close modal and proceed to app
            this.closeUnlockModal()

            // Show loading screen while data loads
            this.loadingScreen.classList.remove('hidden')

            await this.handleAuthSuccess(user)
        } catch (e) {
            console.error('Unlock error:', e)
            this.unlockError.textContent = 'Failed to unlock. Please try again.'
            this.unlockError.style.display = 'block'
        } finally {
            this.unlockBtn.disabled = false
            this.unlockBtn.textContent = 'Unlock'
        }
    }

    // Initialize encryption key from password
    async initializeEncryption(user, password) {
        // Try to load existing salt from user_settings
        const { data: settings } = await supabase
            .from('user_settings')
            .select('encryption_salt')
            .eq('user_id', user.id)
            .single()

        let salt
        if (settings && settings.encryption_salt) {
            // Use existing salt
            salt = CryptoUtils.base64ToArray(settings.encryption_salt)
        } else {
            // Generate new salt for new users
            salt = CryptoUtils.generateSalt()
            const saltBase64 = CryptoUtils.arrayToBase64(salt)

            // Save salt to user_settings
            const { error: updateError } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    encryption_salt: saltBase64,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' })

            if (updateError) {
                console.error('Error saving encryption salt:', updateError)
            }
        }

        // Derive encryption key from password and salt
        this.encryptionKey = await CryptoUtils.deriveKey(password, salt)
    }

    // Encrypt text if encryption is enabled
    async encrypt(plaintext) {
        if (!this.encryptionKey) return plaintext
        return await CryptoUtils.encrypt(plaintext, this.encryptionKey)
    }

    // Decrypt text if encryption is enabled
    async decrypt(ciphertext) {
        if (!this.encryptionKey) return ciphertext
        // Check if this looks like encrypted data (base64 with minimum length for IV + data)
        if (!ciphertext || ciphertext.length < 20) return ciphertext
        try {
            return await CryptoUtils.decrypt(ciphertext, this.encryptionKey)
        } catch (e) {
            // If decryption fails, return original (might be unencrypted legacy data)
            console.warn('Decryption failed, returning original text:', e)
            return ciphertext
        }
    }

    async loadCategories() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error loading categories:', error)
            return
        }

        // Decrypt category names
        this.categories = await Promise.all(data.map(async (category) => ({
            ...category,
            name: await this.decrypt(category.name)
        })))
        this.updateCategorySelect()
    }

    async loadPriorities() {
        const { data, error } = await supabase
            .from('priorities')
            .select('*')
            .order('level', { ascending: true })

        if (error) {
            console.error('Error loading priorities:', error)
            return
        }

        this.priorities = data
        this.updatePrioritySelect()
    }

    updatePrioritySelect() {
        // Keep first option (No Priority)
        this.modalPrioritySelect.innerHTML = '<option value="">No Priority</option>'

        this.priorities.forEach(priority => {
            const option = document.createElement('option')
            option.value = priority.id
            option.textContent = priority.name
            this.modalPrioritySelect.appendChild(option)
        })
    }

    async loadContexts() {
        const { data, error } = await supabase
            .from('contexts')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error loading contexts:', error)
            return
        }

        // Decrypt context names
        this.contexts = await Promise.all(data.map(async (context) => ({
            ...context,
            name: await this.decrypt(context.name)
        })))
        this.updateContextSelect()
    }

    toggleSidebarSection(section) {
        const header = section.querySelector('.sidebar-section-header')
        const isCollapsed = section.classList.toggle('collapsed')
        header.setAttribute('aria-expanded', !isCollapsed)
    }

    updateContextSelect() {
        this.modalContextSelect.innerHTML = '<option value="">No Context</option>'

        this.contexts.forEach(context => {
            const option = document.createElement('option')
            option.value = context.id
            option.textContent = context.name
            this.modalContextSelect.appendChild(option)
        })
    }

    // ========================================
    // Projects Methods
    // ========================================

    async loadProjects() {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error loading projects:', error)
            return
        }

        // Decrypt project names
        this.projects = await Promise.all(data.map(async (project) => ({
            ...project,
            name: await this.decrypt(project.name)
        })))
        this.renderProjects()
        this.updateProjectSelect()
    }

    renderProjects() {
        this.projectList.innerHTML = ''

        // Filter projects by selected area
        let filteredProjects = this.projects
        if (this.selectedAreaId !== 'all') {
            if (this.selectedAreaId === 'unassigned') {
                filteredProjects = this.projects.filter(p => p.area_id === null)
            } else {
                filteredProjects = this.projects.filter(p => p.area_id === this.selectedAreaId)
            }
        }

        // Add "All Projects" option
        const allItem = document.createElement('li')
        allItem.className = `project-item ${this.selectedProjectId === null ? 'active' : ''}`
        allItem.innerHTML = `<span class="project-name">All Projects</span>`
        allItem.addEventListener('click', () => this.selectProject(null))

        // Drop target for removing project
        allItem.addEventListener('dragover', (e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            allItem.classList.add('drag-over')
        })
        allItem.addEventListener('dragleave', () => {
            allItem.classList.remove('drag-over')
        })
        allItem.addEventListener('drop', (e) => {
            e.preventDefault()
            allItem.classList.remove('drag-over')
            const todoId = e.dataTransfer.getData('text/plain')
            if (todoId) {
                this.updateTodoProject(todoId, null)
            }
        })
        this.projectList.appendChild(allItem)

        // Add user projects (filtered by area)
        filteredProjects.forEach(project => {
            const li = document.createElement('li')
            li.className = `project-item ${this.selectedProjectId === project.id ? 'active' : ''}`
            li.innerHTML = `
                <span class="project-name">
                    <span class="project-color" style="background-color: ${this.validateColor(project.color)}"></span>
                    ${this.escapeHtml(project.name)}
                </span>
                <button class="project-delete" data-id="${project.id}">×</button>
            `

            li.addEventListener('click', (e) => {
                if (!e.target.classList.contains('project-delete')) {
                    this.selectProject(project.id)
                }
            })

            // Drop target for assigning project
            li.addEventListener('dragover', (e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                li.classList.add('drag-over')
            })
            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over')
            })
            li.addEventListener('drop', (e) => {
                e.preventDefault()
                li.classList.remove('drag-over')
                const todoId = e.dataTransfer.getData('text/plain')
                if (todoId) {
                    this.updateTodoProject(todoId, project.id)
                }
            })

            const deleteBtn = li.querySelector('.project-delete')
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                this.deleteProject(project.id)
            })

            this.projectList.appendChild(li)
        })
    }

    updateProjectSelect() {
        this.modalProjectSelect.innerHTML = '<option value="">No Project</option>'

        this.projects.forEach(project => {
            const option = document.createElement('option')
            option.value = project.id
            option.textContent = project.name
            this.modalProjectSelect.appendChild(option)
        })
    }

    selectProject(projectId) {
        if (projectId === null) {
            // "All Projects" shows the project list view
            this.selectedProjectId = null
            this.showProjectsView = true
        } else {
            // Clicking a specific project shows its todos
            this.selectedProjectId = projectId
            this.showProjectsView = false
            // Switch GTD filter to 'all' to show all items in this project
            this.selectedGtdStatus = 'all'
            this.renderGtdList()
        }
        this.renderProjects()
        this.renderTodos()
    }

    async addProject() {
        const name = this.newProjectInput.value.trim()
        if (!name) return

        this.addProjectBtn.disabled = true
        this.addProjectBtn.textContent = 'Adding...'

        // Encrypt project name before storing
        const encryptedName = await this.encrypt(name)

        // Generate a random color
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140']
        const randomColor = colors[Math.floor(Math.random() * colors.length)]

        // Assign to current area if a specific area is selected
        const areaId = (this.selectedAreaId !== 'all' && this.selectedAreaId !== 'unassigned')
            ? this.selectedAreaId
            : null

        const { data, error } = await supabase
            .from('projects')
            .insert({
                user_id: this.currentUser.id,
                name: encryptedName,
                color: randomColor,
                area_id: areaId
            })
            .select()

        this.addProjectBtn.disabled = false
        this.addProjectBtn.textContent = 'Add Project'

        if (error) {
            console.error('Error adding project:', error)
            alert('Failed to add project')
            return
        }

        this.newProjectInput.value = ''
        await this.loadProjects()
    }

    async deleteProject(projectId) {
        if (!confirm('Delete this project? Todos in this project will become projectless.')) {
            return
        }

        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId)

        if (error) {
            console.error('Error deleting project:', error)
            alert('Failed to delete project')
            return
        }

        this.projects = this.projects.filter(p => p.id !== projectId)
        if (this.selectedProjectId === projectId) {
            this.selectedProjectId = null
        }
        this.renderProjects()
        this.updateProjectSelect()
        this.loadTodos()
    }

    async updateTodoProject(todoId, projectId) {
        const { error } = await supabase
            .from('todos')
            .update({ project_id: projectId })
            .eq('id', todoId)

        if (error) {
            console.error('Error updating todo project:', error)
            alert('Failed to update todo project')
            return
        }

        // Reload todos to ensure UI is in sync
        await this.loadTodos()
        this.renderProjects()
    }

    selectGtdStatus(status) {
        this.selectedGtdStatus = status
        this.renderGtdList()
        this.renderTodos()
    }

    getGtdCount(status) {
        if (status === 'all') {
            // Count all non-done items
            return this.todos.filter(t => t.gtd_status !== 'done').length
        }
        if (status === 'scheduled') {
            // Count all non-done items with a due date
            return this.todos.filter(t => t.due_date && t.gtd_status !== 'done').length
        }
        return this.todos.filter(t => t.gtd_status === status).length
    }

    getGtdIcon(status) {
        const icons = {
            'inbox': '📥',
            'next_action': '»',
            'scheduled': '📆',
            'waiting_for': '⏳',
            'someday_maybe': '📅',
            'done': '✓',
            'all': '☰'
        }
        return icons[status] || '•'
    }

    renderGtdList() {
        // Global statuses (always visible)
        const globalStatuses = [
            { id: 'inbox', label: 'Inbox' }
        ]

        // Area-specific statuses
        const areaStatuses = [
            { id: 'next_action', label: 'Next' },
            { id: 'scheduled', label: 'Scheduled', isVirtual: true },
            { id: 'waiting_for', label: 'Waiting' },
            { id: 'someday_maybe', label: 'Someday' },
            { id: 'done', label: 'Done' },
            { id: 'all', label: 'All' }
        ]

        this.gtdList.innerHTML = ''

        // Helper function to render a GTD item
        const renderGtdItem = (status) => {
            const li = document.createElement('li')
            const isActive = this.selectedGtdStatus === status.id
            li.className = `gtd-item ${status.id} ${isActive ? 'active' : ''}`

            const count = this.getGtdCount(status.id)
            const countDisplay = count > 0 ? count : ''

            li.innerHTML = `
                <span class="gtd-icon">${this.getGtdIcon(status.id)}</span>
                <span class="gtd-label">${this.escapeHtml(status.label)}</span>
                <span class="gtd-count">${countDisplay}</span>
            `

            li.addEventListener('click', () => this.selectGtdStatus(status.id))

            // Drop target for assigning GTD status (except 'all' and 'scheduled')
            if (status.id !== 'all' && !status.isVirtual) {
                li.addEventListener('dragover', (e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    li.classList.add('drag-over')
                })
                li.addEventListener('dragleave', () => {
                    li.classList.remove('drag-over')
                })
                li.addEventListener('drop', (e) => {
                    e.preventDefault()
                    li.classList.remove('drag-over')
                    const todoId = e.dataTransfer.getData('text/plain')
                    if (todoId) {
                        this.updateTodoGtdStatus(todoId, status.id)
                    }
                })
            }

            this.gtdList.appendChild(li)
        }

        // Render global Inbox
        globalStatuses.forEach(status => renderGtdItem(status))

        // Add separator between Inbox and area-specific items
        const separator = document.createElement('li')
        separator.className = 'gtd-inbox-separator'
        this.gtdList.appendChild(separator)

        // Add area label if a specific area is selected
        if (this.selectedAreaId !== 'all' && this.selectedAreaId !== 'unassigned') {
            const area = this.areas.find(a => a.id === this.selectedAreaId)
            if (area) {
                const label = document.createElement('li')
                label.className = 'gtd-section-label'
                label.textContent = area.name
                this.gtdList.appendChild(label)
            }
        } else if (this.selectedAreaId === 'unassigned') {
            const label = document.createElement('li')
            label.className = 'gtd-section-label'
            label.textContent = 'Unassigned'
            this.gtdList.appendChild(label)
        }

        // Render area-specific statuses
        areaStatuses.forEach(status => renderGtdItem(status))
    }

    async loadTodos() {
        this.todoList.innerHTML = '<div class="loading-state">Loading todos...</div>'

        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error loading todos:', error)
            this.todoList.innerHTML = '<div class="error-message">Failed to load todos</div>'
            return
        }

        // Decrypt todo texts and comments
        this.todos = await Promise.all(data.map(async (todo) => ({
            ...todo,
            text: await this.decrypt(todo.text),
            comment: todo.comment ? await this.decrypt(todo.comment) : null
        })))
        this.renderGtdList()
        this.renderTodos()
    }

    updateCategorySelect() {
        // Update modal category select
        this.modalCategorySelect.innerHTML = '<option value="">No Category</option>'

        this.categories.forEach(category => {
            const option = document.createElement('option')
            option.value = category.id
            option.textContent = category.name
            this.modalCategorySelect.appendChild(option)
        })
    }

    openModal() {
        this.editingTodoId = null
        this.modalTitle.textContent = 'Add New Todo'
        this.modalAddBtn.textContent = 'Add Todo'
        this.addTodoModal.classList.add('active')
        this.modalTodoInput.value = ''
        this.modalDueDateInput.value = ''
        this.modalCommentInput.value = ''
        this.modalPrioritySelect.value = ''
        this.modalGtdStatusSelect.value = 'inbox'
        this.modalContextSelect.value = ''
        this.modalPriorityToggle.classList.remove('active')

        // Pre-select category if exactly one is selected (not 'uncategorized')
        if (this.selectedCategoryIds.size === 1) {
            const selectedId = [...this.selectedCategoryIds][0]
            if (selectedId !== 'uncategorized') {
                this.modalCategorySelect.value = selectedId
            } else {
                this.modalCategorySelect.value = ''
            }
        } else {
            this.modalCategorySelect.value = ''
        }

        // Pre-select project if one is selected in the sidebar
        if (this.selectedProjectId !== null) {
            this.modalProjectSelect.value = this.selectedProjectId
        } else {
            this.modalProjectSelect.value = ''
        }

        // Handle Escape key to close modal
        this.handleEscapeKey = (e) => {
            if (e.key === 'Escape') this.closeModal()
        }
        document.addEventListener('keydown', this.handleEscapeKey)

        // Focus on the input
        setTimeout(() => this.modalTodoInput.focus(), 100)
    }

    openEditModal(todoId) {
        const todo = this.todos.find(t => t.id === todoId)
        if (!todo) return

        this.editingTodoId = todoId
        this.modalTitle.textContent = 'Edit Todo'
        this.modalAddBtn.textContent = 'Save Changes'
        this.addTodoModal.classList.add('active')

        // Pre-populate fields with existing todo data
        this.modalTodoInput.value = todo.text
        this.modalCategorySelect.value = todo.category_id || ''
        this.modalProjectSelect.value = todo.project_id || ''
        this.modalPrioritySelect.value = todo.priority_id || ''
        this.modalGtdStatusSelect.value = todo.gtd_status || 'inbox'
        this.modalContextSelect.value = todo.context_id || ''
        this.modalDueDateInput.value = todo.due_date || ''
        this.modalCommentInput.value = todo.comment || ''

        // Set priority star state
        if (todo.priority_id) {
            this.modalPriorityToggle.classList.add('active')
        } else {
            this.modalPriorityToggle.classList.remove('active')
        }

        // Handle Escape key to close modal
        this.handleEscapeKey = (e) => {
            if (e.key === 'Escape') this.closeModal()
        }
        document.addEventListener('keydown', this.handleEscapeKey)

        // Focus on the input
        setTimeout(() => this.modalTodoInput.focus(), 100)
    }

    closeModal() {
        this.addTodoModal.classList.remove('active')
        this.editingTodoId = null

        // Remove escape key listener
        if (this.handleEscapeKey) {
            document.removeEventListener('keydown', this.handleEscapeKey)
        }

        this.modalTodoInput.value = ''
        this.modalCategorySelect.value = ''
        this.modalProjectSelect.value = ''
        this.modalPrioritySelect.value = ''
        this.modalGtdStatusSelect.value = 'inbox'
        this.modalContextSelect.value = ''
        this.modalDueDateInput.value = ''
        this.modalCommentInput.value = ''
        this.modalPriorityToggle.classList.remove('active')

        // Reset modal to add mode
        this.modalTitle.textContent = 'Add New Todo'
        this.modalAddBtn.textContent = 'Add Todo'

        // Return focus to the trigger button for accessibility
        if (this.openAddTodoModalBtn && typeof this.openAddTodoModalBtn.focus === 'function') {
            this.openAddTodoModalBtn.focus()
        }
    }

    togglePriorityStar() {
        this.modalPriorityToggle.classList.toggle('active')
        // When star is active, select the first priority if available
        if (this.modalPriorityToggle.classList.contains('active')) {
            if (this.priorities.length > 0 && !this.modalPrioritySelect.value) {
                this.modalPrioritySelect.value = this.priorities[0].id
            }
        } else {
            this.modalPrioritySelect.value = ''
        }
    }

    async addTodo() {
        const text = this.modalTodoInput.value.trim()
        if (!text) return

        const gtdStatus = this.modalGtdStatusSelect.value || 'inbox'
        const dueDate = this.modalDueDateInput.value || null

        // Validate: scheduled status requires a due date
        if (gtdStatus === 'scheduled' && !dueDate) {
            alert('A due date is required for scheduled todos')
            this.modalDueDateInput.focus()
            return
        }

        this.modalAddBtn.disabled = true
        this.modalAddBtn.textContent = 'Adding...'

        const categoryId = this.modalCategorySelect.value || null
        const projectId = this.modalProjectSelect.value || null
        const priorityId = this.modalPrioritySelect.value || null
        const contextId = this.modalContextSelect.value || null
        const comment = this.modalCommentInput.value.trim() || null

        // Encrypt todo text before storing
        const encryptedText = await this.encrypt(text)
        const encryptedComment = comment ? await this.encrypt(comment) : null

        // Sync completed with gtd_status (unified status)
        const isCompleted = gtdStatus === 'done'

        const { data, error } = await supabase
            .from('todos')
            .insert({
                user_id: this.currentUser.id,
                text: encryptedText,
                completed: isCompleted,
                category_id: categoryId,
                project_id: projectId,
                priority_id: priorityId,
                gtd_status: gtdStatus,
                context_id: contextId,
                due_date: dueDate,
                comment: encryptedComment
            })
            .select()

        this.modalAddBtn.disabled = false
        this.modalAddBtn.textContent = 'Add Todo'

        if (error) {
            console.error('Error adding todo:', error)
            alert('Failed to add todo')
            return
        }

        // Store decrypted text in local state for rendering
        const todoWithDecryptedText = { ...data[0], text: text, comment: comment }
        this.todos.push(todoWithDecryptedText)
        this.closeModal()
        this.renderTodos()
    }

    async updateTodo() {
        const text = this.modalTodoInput.value.trim()
        if (!text || !this.editingTodoId) return

        const gtdStatus = this.modalGtdStatusSelect.value || 'inbox'
        const dueDate = this.modalDueDateInput.value || null

        // Validate: scheduled status requires a due date
        if (gtdStatus === 'scheduled' && !dueDate) {
            alert('A due date is required for scheduled todos')
            this.modalDueDateInput.focus()
            return
        }

        this.modalAddBtn.disabled = true
        this.modalAddBtn.textContent = 'Saving...'

        const categoryId = this.modalCategorySelect.value || null
        const projectId = this.modalProjectSelect.value || null
        const priorityId = this.modalPrioritySelect.value || null
        const contextId = this.modalContextSelect.value || null
        const comment = this.modalCommentInput.value.trim() || null

        // Encrypt todo text before storing
        const encryptedText = await this.encrypt(text)
        const encryptedComment = comment ? await this.encrypt(comment) : null

        // Sync completed with gtd_status (unified status)
        const isCompleted = gtdStatus === 'done'

        const { error } = await supabase
            .from('todos')
            .update({
                text: encryptedText,
                category_id: categoryId,
                project_id: projectId,
                priority_id: priorityId,
                gtd_status: gtdStatus,
                completed: isCompleted,
                context_id: contextId,
                due_date: dueDate,
                comment: encryptedComment
            })
            .eq('id', this.editingTodoId)

        this.modalAddBtn.disabled = false
        this.modalAddBtn.textContent = 'Save Changes'

        if (error) {
            console.error('Error updating todo:', error)
            alert('Failed to update todo')
            return
        }

        // Update local state
        const todoIndex = this.todos.findIndex(t => t.id === this.editingTodoId)
        if (todoIndex !== -1) {
            this.todos[todoIndex] = {
                ...this.todos[todoIndex],
                text: text,
                category_id: categoryId,
                project_id: projectId,
                priority_id: priorityId,
                gtd_status: gtdStatus,
                completed: isCompleted,
                context_id: contextId,
                due_date: dueDate
            }
        }

        this.closeModal()
        this.renderTodos()
    }

    async toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id)
        if (!todo) return

        // Unify completed and gtd_status: checking marks as 'done', unchecking restores to 'inbox'
        const isDone = todo.gtd_status === 'done'
        const newGtdStatus = isDone ? 'inbox' : 'done'
        const newCompleted = !isDone

        const { error } = await supabase
            .from('todos')
            .update({ completed: newCompleted, gtd_status: newGtdStatus })
            .eq('id', id)

        if (error) {
            console.error('Error updating todo:', error)
            alert('Failed to update todo')
            return
        }

        todo.completed = newCompleted
        todo.gtd_status = newGtdStatus
        this.renderTodos()
    }

    async deleteTodo(id) {
        const { error } = await supabase
            .from('todos')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting todo:', error)
            alert('Failed to delete todo')
            return
        }

        this.todos = this.todos.filter(t => t.id !== id)
        this.renderTodos()
    }

    // Drag-and-drop update methods
    async updateTodoCategory(todoId, categoryId) {
        const { error } = await supabase
            .from('todos')
            .update({ category_id: categoryId })
            .eq('id', todoId)

        if (error) {
            console.error('Error updating todo category:', error)
            alert('Failed to update todo category')
            return
        }

        // Reload todos to ensure UI is in sync
        await this.loadTodos()
    }

    async updateTodoContext(todoId, contextId) {
        const { error } = await supabase
            .from('todos')
            .update({ context_id: contextId })
            .eq('id', todoId)

        if (error) {
            console.error('Error updating todo context:', error)
            alert('Failed to update todo context')
            return
        }

        // Reload todos to ensure UI is in sync
        await this.loadTodos()
    }

    async updateTodoGtdStatus(todoId, gtdStatus) {
        // Sync completed with gtd_status (unified status)
        const isCompleted = gtdStatus === 'done'

        const { error } = await supabase
            .from('todos')
            .update({ gtd_status: gtdStatus, completed: isCompleted })
            .eq('id', todoId)

        if (error) {
            console.error('Error updating todo GTD status:', error)
            alert('Failed to update todo GTD status')
            return
        }

        // Reload todos to ensure UI is in sync
        await this.loadTodos()
    }

    getFilteredTodos() {
        let filtered = this.todos

        // Filter by search query (searches in title and comment/notes)
        if (this.searchQuery) {
            filtered = filtered.filter(t => {
                const title = (t.text || '').toLowerCase()
                const comment = (t.comment || '').toLowerCase()
                return title.includes(this.searchQuery) || comment.includes(this.searchQuery)
            })
        }

        // Filter by categories (if any selected)
        if (this.selectedCategoryIds.size > 0) {
            filtered = filtered.filter(t => {
                // 'uncategorized' matches todos with no category
                if (this.selectedCategoryIds.has('uncategorized') && !t.category_id) {
                    return true
                }
                // Match any selected category
                return t.category_id && this.selectedCategoryIds.has(t.category_id)
            })
        }

        // Filter by contexts (if any selected)
        if (this.selectedContextIds.size > 0) {
            filtered = filtered.filter(t => t.context_id && this.selectedContextIds.has(t.context_id))
        }

        // Filter by project (if selected)
        if (this.selectedProjectId !== null) {
            filtered = filtered.filter(t => t.project_id === this.selectedProjectId)
        }

        // Filter by area (through project.area_id)
        // Inbox items are always shown regardless of area selection
        if (this.selectedAreaId !== 'all') {
            filtered = filtered.filter(t => {
                // Inbox items are always visible
                if (t.gtd_status === 'inbox') {
                    return true
                }

                // Get the project's area
                const project = t.project_id ? this.projects.find(p => p.id === t.project_id) : null

                if (this.selectedAreaId === 'unassigned') {
                    // Show items where the project has no area, or item has no project
                    return !project || project.area_id === null
                } else {
                    // Show items where the project belongs to the selected area
                    return project && project.area_id === this.selectedAreaId
                }
            })
        }

        // Filter by GTD status
        if (this.selectedGtdStatus === 'scheduled') {
            // Show items with 'scheduled' GTD status, sorted by due date
            filtered = filtered.filter(t => t.gtd_status === 'scheduled')
            // Sort by due date (earliest first), items without dates go last
            return filtered.slice().sort((a, b) => {
                if (!a.due_date && !b.due_date) return 0
                if (!a.due_date) return 1
                if (!b.due_date) return -1
                return a.due_date.localeCompare(b.due_date)
            })
        } else if (this.selectedGtdStatus === 'done') {
            // Show only done items when Done tab is selected
            filtered = filtered.filter(t => t.gtd_status === 'done')
        } else if (this.selectedGtdStatus !== 'all') {
            // Show items matching the selected status (excludes done)
            filtered = filtered.filter(t => t.gtd_status === this.selectedGtdStatus)
        } else {
            // 'all' - exclude done items from the normal view
            filtered = filtered.filter(t => t.gtd_status !== 'done')
        }

        // Sort by priority level (lower level = higher priority)
        // Use slice() to avoid mutating the original array
        return filtered.slice().sort((a, b) => {
            const priorityA = a.priority_id ? this.getPriorityById(a.priority_id) : null
            const priorityB = b.priority_id ? this.getPriorityById(b.priority_id) : null

            if (!priorityA && !priorityB) return 0
            if (!priorityA) return 1
            if (!priorityB) return -1

            return priorityA.level - priorityB.level
        })
    }

    getCategoryById(id) {
        return this.categories.find(c => c.id === id)
    }

    getPriorityById(id) {
        return this.priorities.find(p => p.id === id)
    }

    getContextById(id) {
        return this.contexts.find(c => c.id === id)
    }

    getGtdStatusLabel(status) {
        const labels = {
            'inbox': 'Inbox',
            'next_action': 'Next',
            'scheduled': 'Scheduled',
            'waiting_for': 'Waiting',
            'someday_maybe': 'Someday',
            'done': 'Done'
        }
        return labels[status] || status
    }

    getProjectById(id) {
        return this.projects.find(p => p.id === id)
    }

    getProjectTodoCount(projectId) {
        return this.todos.filter(t => t.project_id === projectId && t.gtd_status !== 'done').length
    }

    updateStats() {
        const filteredTodos = this.getFilteredTodos()
    }

    renderProjectsView() {
        if (this.projects.length === 0) {
            this.todoList.innerHTML = '<div class="empty-state">No projects yet. Create one in the sidebar!</div>'
            this.updateProjectsViewStats()
            return
        }

        this.projects.forEach(project => {
            const count = this.getProjectTodoCount(project.id)
            const li = document.createElement('li')
            li.className = 'project-card'
            li.innerHTML = `
                <span class="project-card-color" style="background-color: ${this.validateColor(project.color)}"></span>
                <span class="project-card-name">${this.escapeHtml(project.name)}</span>
                <span class="project-card-count">${count} ${count === 1 ? 'item' : 'items'}</span>
            `
            li.addEventListener('click', () => this.selectProject(project.id))
            this.todoList.appendChild(li)
        })

        this.updateProjectsViewStats()
    }

    updateProjectsViewStats() {
        // Stats display removed - method kept for compatibility
    }

    renderTodos() {
        this.todoList.innerHTML = ''

        // Show projects view when "All Projects" is selected
        if (this.showProjectsView) {
            this.renderProjectsView()
            return
        }

        const filteredTodos = this.getFilteredTodos()

        if (filteredTodos.length === 0) {
            // Special zen state for empty Inbox
            if (this.selectedGtdStatus === 'inbox') {
                this.todoList.innerHTML = `
                    <div class="inbox-zen-state">
                        <svg class="zen-illustration" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <!-- Calm water ripples -->
                            <ellipse cx="60" cy="95" rx="50" ry="8" fill="url(#waterGradient)" opacity="0.3"/>
                            <ellipse cx="60" cy="95" rx="35" ry="5" fill="url(#waterGradient)" opacity="0.5"/>
                            <ellipse cx="60" cy="95" rx="20" ry="3" fill="url(#waterGradient)" opacity="0.7"/>
                            <!-- Lotus flower -->
                            <g transform="translate(60, 70)">
                                <!-- Back petals -->
                                <ellipse cx="-18" cy="-5" rx="12" ry="20" fill="#E8B4D8" transform="rotate(-30)"/>
                                <ellipse cx="18" cy="-5" rx="12" ry="20" fill="#E8B4D8" transform="rotate(30)"/>
                                <!-- Middle petals -->
                                <ellipse cx="-10" cy="-8" rx="10" ry="22" fill="#F0C4E4" transform="rotate(-15)"/>
                                <ellipse cx="10" cy="-8" rx="10" ry="22" fill="#F0C4E4" transform="rotate(15)"/>
                                <!-- Front petal -->
                                <ellipse cx="0" cy="-10" rx="9" ry="24" fill="#F8D8EE"/>
                                <!-- Center -->
                                <circle cx="0" cy="0" r="6" fill="#FFE4A0"/>
                                <circle cx="-2" cy="-1" r="1" fill="#E8C870"/>
                                <circle cx="2" cy="-1" r="1" fill="#E8C870"/>
                                <circle cx="0" cy="2" r="1" fill="#E8C870"/>
                            </g>
                            <!-- Gradient definitions -->
                            <defs>
                                <linearGradient id="waterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" style="stop-color:#667eea;stop-opacity:0.3"/>
                                    <stop offset="50%" style="stop-color:#764ba2;stop-opacity:0.5"/>
                                    <stop offset="100%" style="stop-color:#667eea;stop-opacity:0.3"/>
                                </linearGradient>
                            </defs>
                        </svg>
                        <h3 class="zen-title">Inbox Zero</h3>
                        <p class="zen-message">Your mind is clear. All items have been processed. Take a moment to breathe.</p>
                    </div>
                `
            } else {
                let emptyMsg
                if (this.searchQuery) {
                    emptyMsg = 'No todos match your search.'
                } else if (this.selectedCategoryIds.size === 0) {
                    emptyMsg = 'No todos yet. Add one above!'
                } else {
                    emptyMsg = 'No todos in selected categories.'
                }
                this.todoList.innerHTML = `<div class="empty-state">${emptyMsg}</div>`
            }
        } else {
            // Track current date group for section headers in Scheduled view
            let currentDateGroup = null

            filteredTodos.forEach(todo => {
                // Add section header for Scheduled view
                if (this.selectedGtdStatus === 'scheduled' && todo.due_date) {
                    const dateGroup = this.getDateGroup(todo.due_date)
                    if (dateGroup !== currentDateGroup) {
                        currentDateGroup = dateGroup
                        const header = document.createElement('li')
                        header.className = `scheduled-section-header ${dateGroup}`
                        header.innerHTML = `<span class="section-header-text">${this.escapeHtml(this.getDateGroupLabel(dateGroup))}</span>`
                        this.todoList.appendChild(header)
                    }
                }

                const li = document.createElement('li')
                // Derive completed state from gtd_status (unified status)
                const isCompleted = todo.gtd_status === 'done'
                li.className = `todo-item ${isCompleted ? 'completed' : ''}`
                li.dataset.todoId = todo.id

                const category = todo.category_id ? (this.getCategoryById(todo.category_id) ?? null) : null
                const categoryBadge = category
                    ? `<span class="todo-category-badge" style="background-color: ${this.validateColor(category.color)}">${this.escapeHtml(category.name)}</span>`
                    : ''

                const priority = todo.priority_id ? (this.getPriorityById(todo.priority_id) ?? null) : null
                const priorityBadge = priority
                    ? `<span class="todo-priority-badge" style="background-color: ${this.validateColor(priority.color)}">${this.escapeHtml(priority.name)}</span>`
                    : ''

                const gtdStatus = todo.gtd_status || 'inbox'
                const gtdBadge = `<span class="todo-gtd-badge ${gtdStatus}">${this.escapeHtml(this.getGtdStatusLabel(gtdStatus))}</span>`

                const context = todo.context_id ? (this.getContextById(todo.context_id) ?? null) : null
                const contextBadge = context
                    ? `<span class="todo-context-badge">${this.escapeHtml(context.name)}</span>`
                    : ''

                const dateBadge = todo.due_date ? this.formatDateBadge(todo.due_date) : ''

                const commentHtml = todo.comment
                    ? `<div class="todo-comment">${this.escapeHtml(todo.comment)}</div>`
                    : ''

                if (category) {
                    li.style.borderLeftColor = this.validateColor(category.color)
                }

                li.innerHTML = `
                    <span class="drag-handle" draggable="true">⋮⋮</span>
                    <input
                        type="checkbox"
                        class="todo-checkbox"
                        ${isCompleted ? 'checked' : ''}
                        data-id="${todo.id}"
                    >
                    <div class="todo-content">
                        <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                        ${commentHtml}
                    </div>
                    ${gtdBadge}
                    ${priorityBadge}
                    ${contextBadge}
                    ${dateBadge}
                    ${categoryBadge}
                    <button class="delete-btn" data-id="${todo.id}">Delete</button>
                `

                // Drag handle events
                const dragHandle = li.querySelector('.drag-handle')
                dragHandle.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', todo.id)
                    e.dataTransfer.effectAllowed = 'move'
                    li.classList.add('dragging')
                })
                dragHandle.addEventListener('dragend', () => {
                    li.classList.remove('dragging')
                })

                const checkbox = li.querySelector('.todo-checkbox')
                checkbox.addEventListener('change', () => this.toggleTodo(todo.id))

                // Click on todo text opens edit modal
                const todoText = li.querySelector('.todo-text')
                todoText.addEventListener('click', () => this.openEditModal(todo.id))

                const deleteBtn = li.querySelector('.delete-btn')
                deleteBtn.addEventListener('click', () => this.deleteTodo(todo.id))

                this.todoList.appendChild(li)
            })
        }

        this.updateStats()
    }

    escapeHtml(text) {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
    }

    validateColor(color) {
        // Validate hex color format to prevent CSS injection
        const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
        return hexColorRegex.test(color) ? color : '#667eea'
    }

    formatDateBadge(dateString) {
        // Parse dateString as YYYY-MM-DD in a timezone-agnostic way
        const [year, month, day] = dateString.split('-')
        const dueDate = new Date(year, month - 1, day)

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const diffTime = dueDate - today
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let className = 'todo-date'
        let label = ''

        if (diffDays < 0) {
            className += ' overdue'
            label = diffDays === -1 ? 'Yesterday' : `${Math.abs(diffDays)} days ago`
        } else if (diffDays === 0) {
            className += ' today'
            label = 'Today'
        } else if (diffDays === 1) {
            label = 'Tomorrow'
        } else if (diffDays <= 7) {
            label = `In ${diffDays} days`
        } else {
            // Format as readable date with consistent format
            const monthName = dueDate.toLocaleDateString('en-US', { month: 'short' })
            const dayNum = dueDate.getDate()
            label = `${monthName} ${dayNum}`
        }

        return `<span class="${className}">${this.escapeHtml(label)}</span>`
    }

    // Get date group for Scheduled view section headers
    getDateGroup(dateString) {
        const [year, month, day] = dateString.split('-')
        const dueDate = new Date(year, month - 1, day)

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const diffTime = dueDate - today
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        // Calculate end of this week (Sunday)
        const dayOfWeek = today.getDay()
        const daysUntilEndOfWeek = 7 - dayOfWeek

        if (diffDays < 0) {
            return 'overdue'
        } else if (diffDays === 0) {
            return 'today'
        } else if (diffDays === 1) {
            return 'tomorrow'
        } else if (diffDays <= daysUntilEndOfWeek) {
            return 'this-week'
        } else if (diffDays <= daysUntilEndOfWeek + 7) {
            return 'next-week'
        } else {
            return 'later'
        }
    }

    getDateGroupLabel(group) {
        const labels = {
            'overdue': 'Overdue',
            'today': 'Today',
            'tomorrow': 'Tomorrow',
            'this-week': 'This Week',
            'next-week': 'Next Week',
            'later': 'Later'
        }
        return labels[group] || group
    }

    initTheme() {
        // Load theme from localStorage first (instant)
        let savedTheme = localStorage.getItem('colorTheme') || 'glass'

        // Migrate old themes to glass
        const validThemes = ['glass', 'dark', 'clear']
        if (!validThemes.includes(savedTheme)) {
            savedTheme = 'glass'
            localStorage.setItem('colorTheme', savedTheme)
        }

        this.applyTheme(savedTheme)
        this.themeSelect.value = savedTheme

        // If user is logged in, load from database
        if (this.currentUser) {
            this.loadThemeFromDatabase()
        }
    }

    async loadThemeFromDatabase() {
        const { data, error } = await supabase
            .from('user_settings')
            .select('color_theme')
            .eq('user_id', this.currentUser.id)
            .single()

        if (error) {
            console.error('Error loading theme:', error)
            return
        }

        if (data && data.color_theme) {
            let dbTheme = data.color_theme

            // Migrate old themes to glass
            const validThemes = ['glass', 'dark', 'clear']
            if (!validThemes.includes(dbTheme)) {
                dbTheme = 'glass'
                this.saveThemeToDatabase(dbTheme)
            }

            this.applyTheme(dbTheme)
            this.themeSelect.value = dbTheme
            localStorage.setItem('colorTheme', dbTheme)
        }
    }

    async changeTheme() {
        const selectedTheme = this.themeSelect.value
        this.applyTheme(selectedTheme)

        // Save to localStorage for instant loading
        localStorage.setItem('colorTheme', selectedTheme)

        // Save to database if user is logged in
        if (this.currentUser) {
            await this.saveThemeToDatabase(selectedTheme)
        }
    }

    async saveThemeToDatabase(theme) {
        // Try to update existing setting
        const { data, error: updateError } = await supabase
            .from('user_settings')
            .update({ color_theme: theme, updated_at: new Date().toISOString() })
            .eq('user_id', this.currentUser.id)
            .select()

        if (updateError) {
            console.error('Error updating user_settings:', updateError)
        }

        // If no rows were updated, insert a new one
        if (updateError || !data || data.length === 0) {
            const { error: insertError } = await supabase
                .from('user_settings')
                .insert({
                    user_id: this.currentUser.id,
                    color_theme: theme,
                    updated_at: new Date().toISOString()
                })
            if (insertError) {
                console.error('Error inserting into user_settings:', insertError)
            }
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme)
    }

    async loadUserSettings() {
        const { data, error } = await supabase
            .from('user_settings')
            .select('username')
            .eq('user_id', this.currentUser.id)
            .single()

        if (error) {
            // No settings yet, use email as display
            this.toolbarUsername.textContent = this.currentUser.email
            return
        }

        if (data && data.username) {
            this.toolbarUsername.textContent = data.username
        } else {
            this.toolbarUsername.textContent = this.currentUser.email
        }
    }

    openSettingsModal() {
        this.settingsModal.classList.add('active')

        // Load current username into input
        const currentUsername = this.toolbarUsername.textContent
        if (currentUsername !== this.currentUser.email) {
            this.usernameInput.value = currentUsername
        } else {
            this.usernameInput.value = ''
        }

        // Handle Escape key to close modal
        this.handleSettingsEscapeKey = (e) => {
            if (e.key === 'Escape') this.closeSettingsModal()
        }
        document.addEventListener('keydown', this.handleSettingsEscapeKey)

        // Focus on the input
        setTimeout(() => this.usernameInput.focus(), 100)
    }

    closeSettingsModal() {
        this.settingsModal.classList.remove('active')

        // Remove escape key listener
        if (this.handleSettingsEscapeKey) {
            document.removeEventListener('keydown', this.handleSettingsEscapeKey)
        }

        this.usernameInput.value = ''

        // Return focus to settings button for accessibility
        if (this.settingsBtn && typeof this.settingsBtn.focus === 'function') {
            this.settingsBtn.focus()
        }
    }

    async saveSettings() {
        const username = this.usernameInput.value.trim()

        this.saveSettingsBtn.disabled = true
        this.saveSettingsBtn.textContent = 'Saving...'

        // Try to update existing settings
        const { data, error: updateError } = await supabase
            .from('user_settings')
            .update({ username: username || null, updated_at: new Date().toISOString() })
            .eq('user_id', this.currentUser.id)
            .select()

        if (updateError) {
            console.error('Error updating user_settings:', updateError)
        }

        // If no rows were updated, insert a new one
        if (updateError || !data || data.length === 0) {
            const { error: insertError } = await supabase
                .from('user_settings')
                .insert({
                    user_id: this.currentUser.id,
                    username: username || null,
                    updated_at: new Date().toISOString()
                })
            if (insertError) {
                console.error('Error inserting into user_settings:', insertError)
                alert('Failed to save settings')
                this.saveSettingsBtn.disabled = false
                this.saveSettingsBtn.textContent = 'Save Settings'
                return
            }
        }

        this.saveSettingsBtn.disabled = false
        this.saveSettingsBtn.textContent = 'Save Settings'

        // Update display
        if (username) {
            this.toolbarUsername.textContent = username
        } else {
            this.toolbarUsername.textContent = this.currentUser.email
        }

        this.closeSettingsModal()
    }

    // Check if a string looks like encrypted data (base64 with IV prefix)
    isEncrypted(text) {
        if (!text || text.length < 24) return false
        // Encrypted data is base64 with at least 12 bytes IV + some ciphertext
        // Base64 of 24+ bytes = 32+ characters
        const base64Regex = /^[A-Za-z0-9+/]+=*$/
        return base64Regex.test(text) && text.length >= 32
    }

    async migrateExistingData() {
        if (!this.encryptionKey) {
            this.migrateStatus.textContent = 'Error: Encryption key not available. Please log out and log in again.'
            this.migrateStatus.style.color = '#c33'
            this.migrateStatus.style.display = 'block'
            return
        }

        this.migrateDataBtn.disabled = true
        this.migrateDataBtn.textContent = 'Encrypting...'
        this.migrateStatus.style.display = 'none'

        let todosEncrypted = 0
        let categoriesEncrypted = 0
        let errors = 0

        try {
            // Load todos directly from database (not using cached decrypted data)
            const { data: todos, error: todosError } = await supabase
                .from('todos')
                .select('id, text')

            if (todosError) {
                throw new Error('Failed to load todos: ' + todosError.message)
            }

            // Encrypt unencrypted todos
            for (const todo of todos) {
                if (!this.isEncrypted(todo.text)) {
                    try {
                        const encryptedText = await CryptoUtils.encrypt(todo.text, this.encryptionKey)
                        const { error } = await supabase
                            .from('todos')
                            .update({ text: encryptedText })
                            .eq('id', todo.id)

                        if (error) {
                            console.error('Error encrypting todo:', error)
                            errors++
                        } else {
                            todosEncrypted++
                        }
                    } catch (e) {
                        console.error('Encryption error for todo:', e)
                        errors++
                    }
                }
            }

            // Load categories directly from database
            const { data: categories, error: categoriesError } = await supabase
                .from('categories')
                .select('id, name')

            if (categoriesError) {
                throw new Error('Failed to load categories: ' + categoriesError.message)
            }

            // Encrypt unencrypted categories
            for (const category of categories) {
                if (!this.isEncrypted(category.name)) {
                    try {
                        const encryptedName = await CryptoUtils.encrypt(category.name, this.encryptionKey)
                        const { error } = await supabase
                            .from('categories')
                            .update({ name: encryptedName })
                            .eq('id', category.id)

                        if (error) {
                            console.error('Error encrypting category:', error)
                            errors++
                        } else {
                            categoriesEncrypted++
                        }
                    } catch (e) {
                        console.error('Encryption error for category:', e)
                        errors++
                    }
                }
            }

            // Reload data to show encrypted versions
            await this.loadCategories()
            await this.loadTodos()

            // Show result
            if (todosEncrypted === 0 && categoriesEncrypted === 0) {
                this.migrateStatus.textContent = 'All data is already encrypted!'
                this.migrateStatus.style.color = '#3c3'
            } else {
                let message = `Encrypted ${todosEncrypted} todo(s) and ${categoriesEncrypted} category(ies).`
                if (errors > 0) {
                    message += ` ${errors} error(s) occurred.`
                    this.migrateStatus.style.color = '#f90'
                } else {
                    this.migrateStatus.style.color = '#3c3'
                }
                this.migrateStatus.textContent = message
            }
        } catch (e) {
            console.error('Migration error:', e)
            this.migrateStatus.textContent = 'Error: ' + e.message
            this.migrateStatus.style.color = '#c33'
        } finally {
            this.migrateDataBtn.disabled = false
            this.migrateDataBtn.textContent = 'Encrypt Existing Data'
            this.migrateStatus.style.display = 'block'
        }
    }

    // Export currently displayed todos as plain text
    exportTodos() {
        const filteredTodos = this.getFilteredTodos()

        if (filteredTodos.length === 0) {
            alert('No todos to export')
            return
        }

        // Build plain text export
        const lines = []

        // Add header with current view info
        const viewName = this.getExportViewName()
        lines.push(`TodoList Export - ${viewName}`)
        lines.push(`Exported: ${new Date().toLocaleString()}`)
        lines.push('─'.repeat(40))
        lines.push('')

        filteredTodos.forEach(todo => {
            const checkbox = todo.gtd_status === 'done' ? '[x]' : '[ ]'
            lines.push(`${checkbox} ${todo.text}`)

            // Add metadata on indented lines
            const meta = []

            if (todo.due_date) {
                meta.push(`Due: ${todo.due_date}`)
            }

            const category = todo.category_id ? this.getCategoryById(todo.category_id) : null
            if (category) {
                meta.push(`Category: ${category.name}`)
            }

            const project = todo.project_id ? this.projects.find(p => p.id === todo.project_id) : null
            if (project) {
                meta.push(`Project: ${project.name}`)
            }

            const context = todo.context_id ? this.getContextById(todo.context_id) : null
            if (context) {
                meta.push(`Context: ${context.name}`)
            }

            const priority = todo.priority_id ? this.getPriorityById(todo.priority_id) : null
            if (priority) {
                meta.push(`Priority: ${priority.name}`)
            }

            if (meta.length > 0) {
                lines.push(`    ${meta.join(' | ')}`)
            }

            if (todo.comment) {
                lines.push(`    Note: ${todo.comment}`)
            }

            lines.push('')
        })

        // Add summary
        lines.push('─'.repeat(40))
        const completed = filteredTodos.filter(t => t.gtd_status === 'done').length
        lines.push(`Total: ${filteredTodos.length} | Completed: ${completed}`)

        const content = lines.join('\n')

        // Download as file
        this.downloadTextFile(content, `todolist-export-${this.getExportFileName()}.txt`)
    }

    getExportViewName() {
        const parts = []

        // GTD status
        const gtdLabels = {
            'inbox': 'Inbox',
            'next_action': 'Next Actions',
            'scheduled': 'Scheduled',
            'waiting_for': 'Waiting For',
            'someday_maybe': 'Someday/Maybe',
            'done': 'Done',
            'all': 'All'
        }
        parts.push(gtdLabels[this.selectedGtdStatus] || this.selectedGtdStatus)

        // Categories
        if (this.selectedCategoryIds.size > 0) {
            const catNames = [...this.selectedCategoryIds].map(id => {
                if (id === 'uncategorized') return 'Uncategorized'
                const cat = this.getCategoryById(id)
                return cat ? cat.name : id
            })
            parts.push(`Categories: ${catNames.join(', ')}`)
        }

        // Contexts
        if (this.selectedContextIds.size > 0) {
            const ctxNames = [...this.selectedContextIds].map(id => {
                const ctx = this.getContextById(id)
                return ctx ? ctx.name : id
            })
            parts.push(`Contexts: ${ctxNames.join(', ')}`)
        }

        // Project
        if (this.selectedProjectId) {
            const project = this.projects.find(p => p.id === this.selectedProjectId)
            if (project) {
                parts.push(`Project: ${project.name}`)
            }
        }

        return parts.join(' | ')
    }

    getExportFileName() {
        const date = new Date().toISOString().split('T')[0]
        const status = this.selectedGtdStatus.replace('_', '-')
        return `${date}-${status}`
    }

    downloadTextFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(url)
    }
}

// Initialize the app
new TodoApp()
