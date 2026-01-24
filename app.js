// TodoList Application - Modular Entry Point
// This file serves as the orchestrator, importing and coordinating all modules

import { supabase } from './src/core/supabase.js'
import { store } from './src/core/store.js'
import { events, Events } from './src/core/events.js'
import { escapeHtml, validateColor } from './src/utils/security.js'
import { CryptoUtils, isEncrypted } from './src/utils/crypto.js'

// Services
import {
    login, signup, logout, unlock, lock, getSession, getStoredPassword,
    onAuthStateChange, initializeEncryption, encrypt, decrypt
} from './src/services/auth.js'
import {
    initTheme, loadThemeFromDatabase, changeTheme, applyTheme,
    loadUserSettings, saveUserSettings
} from './src/services/settings.js'
import { exportTodos } from './src/services/export.js'
import { loadTodos, addTodo, toggleTodo, deleteTodo, getFilteredTodos, getGtdCount } from './src/services/todos.js'
import { loadProjects, addProject, deleteProject, selectProject } from './src/services/projects.js'
import { loadAreas, addArea, selectArea, selectAreaByShortcut } from './src/services/areas.js'
import { loadCategories } from './src/services/categories.js'
import { loadContexts } from './src/services/contexts.js'
import { loadPriorities } from './src/services/priorities.js'

// UI Components
import { renderTodos } from './src/ui/TodoList.js'
import { renderProjects, updateProjectSelect } from './src/ui/ProjectList.js'
import { renderGtdList, selectGtdStatus, selectGtdStatusByShortcut } from './src/ui/GtdList.js'
import { renderAreasDropdown, updateAreasLabel, updateAreaHeader, renderManageAreasList } from './src/ui/AreasDropdown.js'
import { TodoModal } from './src/ui/modals/TodoModal.js'
import { ImportModal } from './src/ui/modals/ImportModal.js'

// Application version
const APP_VERSION = '2.0.21'

class TodoApp {
    constructor() {
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
        this.todoList = document.getElementById('todoList')
        this.projectList = document.getElementById('projectList')
        this.newProjectInput = document.getElementById('newProjectInput')
        this.addProjectBtn = document.getElementById('addProjectBtn')
        this.projectsSection = document.getElementById('projectsSection')
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
        this.areaHeader = document.getElementById('areaHeader')

        // Keyboard shortcuts modal elements
        this.keyboardShortcutsModal = document.getElementById('keyboardShortcutsModal')
        this.closeKeyboardShortcutsModalBtn = document.getElementById('closeKeyboardShortcutsModal')
        this.closeKeyboardShortcutsModalBtn2 = document.getElementById('closeKeyboardShortcutsModalBtn')

        // Initialize TodoModal
        this.todoModal = new TodoModal({
            modal: document.getElementById('addTodoModal'),
            form: document.getElementById('addTodoForm'),
            todoInput: document.getElementById('modalTodoInput'),
            categorySelect: document.getElementById('modalCategorySelect'),
            projectSelect: document.getElementById('modalProjectSelect'),
            prioritySelect: document.getElementById('modalPrioritySelect'),
            gtdStatusSelect: document.getElementById('modalGtdStatusSelect'),
            contextSelect: document.getElementById('modalContextSelect'),
            dueDateInput: document.getElementById('modalDueDateInput'),
            commentInput: document.getElementById('modalCommentInput'),
            priorityToggle: document.getElementById('modalPriorityToggle'),
            addBtn: document.getElementById('modalAddBtn'),
            title: document.getElementById('modalTitle'),
            closeBtn: document.getElementById('closeModal'),
            cancelBtn: document.getElementById('cancelModal'),
            openBtn: document.getElementById('openAddTodoModal')
        })

        // Set callback for when modal closes
        this.todoModal.onClose = () => this.render()

        // Initialize ImportModal
        this.importModal = new ImportModal({
            modal: document.getElementById('importModal'),
            form: document.getElementById('importForm'),
            textarea: document.getElementById('importTextarea'),
            projectSelect: document.getElementById('importProjectSelect'),
            categorySelect: document.getElementById('importCategorySelect'),
            contextSelect: document.getElementById('importContextSelect'),
            prioritySelect: document.getElementById('importPrioritySelect'),
            gtdStatusSelect: document.getElementById('importGtdStatusSelect'),
            dueDateInput: document.getElementById('importDueDateInput'),
            importBtn: document.getElementById('importBtn'),
            closeBtn: document.getElementById('closeImportModal'),
            cancelBtn: document.getElementById('cancelImportModal'),
            openBtn: document.getElementById('openImportModal')
        })

        this.initAuth()
        this.initEventListeners()
        this.setVersion()
        initTheme(this.themeSelect)
        this.subscribeToEvents()
    }

    setVersion() {
        if (this.versionNumberEl) {
            this.versionNumberEl.textContent = APP_VERSION
        }
    }

    subscribeToEvents() {
        // Subscribe to store changes and re-render
        store.subscribe('selectedGtdStatus', () => this.render())
        store.subscribe('selectedProjectId', () => this.render())
        store.subscribe('selectedAreaId', () => {
            renderAreasDropdown(this.areaListContainer, this.toolbarAreasDropdown, this.areaListDivider)
            updateAreasLabel(this.toolbarAreasLabel)
            this.render()
        })
        store.subscribe('showProjectsView', () => this.render())
        store.subscribe('todos', () => this.renderAll())
        store.subscribe('projects', () => {
            renderProjects(this.projectList)
            this.todoModal.updateProjectSelect()
        })
        store.subscribe('areas', () => {
            renderAreasDropdown(this.areaListContainer, this.toolbarAreasDropdown, this.areaListDivider)
            updateAreasLabel(this.toolbarAreasLabel)
            updateAreaHeader(this.areaHeader)
        })
        store.subscribe('categories', () => this.todoModal.updateCategorySelect())
        store.subscribe('contexts', () => this.todoModal.updateContextSelect())
        store.subscribe('priorities', () => this.todoModal.updatePrioritySelect())
    }

    async initAuth() {
        const { session, user } = await getSession()

        if (session) {
            const storedPassword = getStoredPassword()
            if (storedPassword) {
                try {
                    await initializeEncryption(user, storedPassword)
                    await this.handleAuthSuccess(user)
                } catch (e) {
                    console.error('Auto-unlock failed:', e)
                    sessionStorage.removeItem('_ep')
                    store.set('pendingUser', user)
                    this.showUnlockModal()
                    this.hideLoadingScreen()
                }
            } else {
                store.set('pendingUser', user)
                this.showUnlockModal()
                this.hideLoadingScreen()
            }
        } else {
            this.authContainer.classList.add('active')
            this.hideLoadingScreen()
        }

        onAuthStateChange(() => this.handleSignOut())
    }

    initEventListeners() {
        // Auth tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchAuthTab(e.target.dataset.tab)
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
            await logout()
        })

        // Refresh data
        this.refreshBtn.addEventListener('click', () => {
            this.closeToolbarMenu()
            this.refreshData()
        })

        // Settings modal
        this.settingsBtn.addEventListener('click', () => {
            this.closeToolbarMenu()
            this.openSettingsModal()
        })
        this.closeSettingsModalBtn.addEventListener('click', () => this.closeSettingsModal())
        this.cancelSettingsModalBtn.addEventListener('click', () => this.closeSettingsModal())
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettingsModal()
        })

        // Save settings
        this.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault()
            this.saveSettings()
        })

        // Migrate data
        this.migrateDataBtn.addEventListener('click', () => this.migrateExistingData())

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcut(e))

        // Add project
        this.addProjectBtn.addEventListener('click', () => this.handleAddProject())
        this.newProjectInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddProject()
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
        this.unlockLogoutBtn.addEventListener('click', () => logout())

        // Theme selector
        this.themeSelect.addEventListener('change', () => changeTheme(this.themeSelect.value))

        // Export button
        this.exportBtn.addEventListener('click', () => exportTodos(getFilteredTodos()))

        // Search input
        this.searchInput.addEventListener('input', () => {
            store.set('searchQuery', this.searchInput.value.trim().toLowerCase())
            this.render()
        })

        // Toolbar user menu toggle
        this.toolbarUserBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this.toggleToolbarMenu()
        })

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (this.toolbarUserMenu && !this.toolbarUserMenu.contains(e.target)) {
                this.closeToolbarMenu()
            }
            if (this.toolbarAreasMenu && !this.toolbarAreasMenu.contains(e.target)) {
                this.closeAreasMenu()
            }
        })

        // Areas dropdown
        this.toolbarAreasBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this.toggleAreasMenu()
        })

        this.toolbarAreasDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('[data-area-id]')
            if (item) {
                selectArea(item.dataset.areaId)
                this.closeAreasMenu()
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
        this.addNewAreaBtn.addEventListener('click', () => this.handleAddArea())
        this.newAreaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddArea()
        })

        // Keyboard shortcuts modal
        this.closeKeyboardShortcutsModalBtn.addEventListener('click', () => this.closeKeyboardShortcutsModal())
        this.closeKeyboardShortcutsModalBtn2.addEventListener('click', () => this.closeKeyboardShortcutsModal())
        this.keyboardShortcutsModal.addEventListener('click', (e) => {
            if (e.target === this.keyboardShortcutsModal) this.closeKeyboardShortcutsModal()
        })

        // Initialize sidebar resize
        this.initSidebarResize()
    }

    handleKeyboardShortcut(e) {
        const activeElement = document.activeElement
        const isTyping = activeElement.tagName === 'INPUT' ||
                       activeElement.tagName === 'TEXTAREA' ||
                       activeElement.tagName === 'SELECT' ||
                       activeElement.isContentEditable

        const modalOpen = this.todoModal.modal.classList.contains('active') ||
                        this.unlockModal.classList.contains('active') ||
                        this.settingsModal.classList.contains('active') ||
                        this.manageAreasModal.classList.contains('active') ||
                        this.keyboardShortcutsModal.classList.contains('active')

        // 'n' to create new item
        if (e.code === 'KeyN' && !isTyping && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
            e.preventDefault()
            this.todoModal.open()
        }

        // Shift+0-9 to quickly switch areas
        if (e.shiftKey && !isTyping && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
            const digitMatch = e.code.match(/^Digit(\d)$/)
            if (digitMatch) {
                const digit = parseInt(digitMatch[1], 10)
                e.preventDefault()
                selectAreaByShortcut(digit)
            }
        }

        // 0-9 (no shift) to quickly switch GTD views
        if (!e.shiftKey && !isTyping && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
            const digitMatch = e.code.match(/^Digit(\d)$/)
            if (digitMatch) {
                const digit = parseInt(digitMatch[1], 10)
                e.preventDefault()
                selectGtdStatusByShortcut(digit)
            }
        }

        // '/' to focus search input
        if (e.key === '/' && !isTyping && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
            e.preventDefault()
            this.searchInput.focus()
        }

        // '?' to show keyboard shortcuts help
        if (e.key === '?' && !isTyping && !modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
            e.preventDefault()
            this.openKeyboardShortcutsModal()
        }

        // Escape to unfocus text inputs
        if (e.key === 'Escape' && isTyping && !modalOpen) {
            e.preventDefault()
            document.activeElement.blur()
        }
    }

    toggleToolbarMenu() {
        const isOpen = this.toolbarUserMenu.classList.toggle('open')
        this.toolbarUserBtn.setAttribute('aria-expanded', isOpen)
    }

    closeToolbarMenu() {
        this.toolbarUserMenu.classList.remove('open')
        this.toolbarUserBtn.setAttribute('aria-expanded', 'false')
    }

    toggleAreasMenu() {
        const isOpen = this.toolbarAreasMenu.classList.toggle('open')
        this.toolbarAreasBtn.setAttribute('aria-expanded', isOpen)
    }

    closeAreasMenu() {
        this.toolbarAreasMenu.classList.remove('open')
        this.toolbarAreasBtn.setAttribute('aria-expanded', 'false')
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
        this.authMessage.innerHTML = `<div class="${className}">${escapeHtml(message)}</div>`
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value
        const password = document.getElementById('loginPassword').value

        const submitBtn = this.loginForm.querySelector('button[type="submit"]')
        submitBtn.disabled = true
        submitBtn.textContent = 'Logging in...'

        const result = await login(email, password)

        submitBtn.disabled = false
        submitBtn.textContent = 'Login'

        if (!result.success) {
            this.showMessage(result.error, 'error')
        } else {
            this.loadingScreen.classList.remove('hidden')
            await this.handleAuthSuccess(result.user)
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

        const result = await signup(email, password)

        submitBtn.disabled = false
        submitBtn.textContent = 'Sign Up'

        if (!result.success) {
            this.showMessage(result.error, 'error')
        } else {
            this.showMessage('Account created! Please check your email to confirm your account.', 'success')
            this.switchAuthTab('login')
        }
    }

    async handleAuthSuccess(user) {
        store.set('currentUser', user)
        this.authContainer.classList.remove('active')
        this.appContainer.classList.add('active')
        this.mainContainer.classList.remove('auth-mode')
        document.body.classList.add('fullscreen-mode')

        // Load all data
        await Promise.all([
            loadAreas(),
            loadCategories(),
            loadPriorities(),
            loadContexts(),
            loadProjects(),
            loadTodos()
        ])

        // Load non-essential items without waiting
        loadThemeFromDatabase()
        this.loadUserSettingsDisplay()

        this.hideLoadingScreen()
    }

    async loadUserSettingsDisplay() {
        const settings = await loadUserSettings()
        const currentUser = store.get('currentUser')
        this.toolbarUsername.textContent = settings.username || currentUser.email
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
                loadAreas(),
                loadCategories(),
                loadPriorities(),
                loadContexts(),
                loadProjects(),
                loadTodos()
            ])
        } catch (error) {
            console.error('Error refreshing data:', error)
        } finally {
            this.refreshBtn.disabled = false
            this.refreshBtn.textContent = 'Refresh'
        }
    }

    handleSignOut() {
        store.reset()
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
        lock()
        this.todoList.innerHTML = ''
        this.appContainer.classList.remove('active')
        this.mainContainer.classList.add('auth-mode')
        this.showUnlockModal()
    }

    showUnlockModal() {
        const pendingUser = store.get('pendingUser')
        this.unlockModal.classList.add('active')
        this.unlockError.style.display = 'none'
        this.unlockEmail.value = pendingUser?.email || ''
        this.unlockPassword.value = ''
        setTimeout(() => this.unlockPassword.focus(), 100)
    }

    closeUnlockModal() {
        this.unlockModal.classList.remove('active')
        this.unlockPassword.value = ''
        this.unlockError.style.display = 'none'
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
            const result = await unlock(password)

            if (!result.success) {
                this.unlockError.textContent = result.error
                this.unlockError.style.display = 'block'
                this.unlockBtn.disabled = false
                this.unlockBtn.textContent = 'Unlock'
                return
            }

            this.closeUnlockModal()
            this.loadingScreen.classList.remove('hidden')
            await this.handleAuthSuccess(result.user)
        } catch (e) {
            console.error('Unlock error:', e)
            this.unlockError.textContent = 'Failed to unlock. Please try again.'
            this.unlockError.style.display = 'block'
        } finally {
            this.unlockBtn.disabled = false
            this.unlockBtn.textContent = 'Unlock'
        }
    }

    toggleSidebarSection(section) {
        const header = section.querySelector('.sidebar-section-header')
        const isCollapsed = section.classList.toggle('collapsed')
        header.setAttribute('aria-expanded', !isCollapsed)
    }

    async handleAddProject() {
        const name = this.newProjectInput.value.trim()
        if (!name) return

        this.addProjectBtn.disabled = true
        this.addProjectBtn.textContent = 'Adding...'

        try {
            await addProject(name)
            this.newProjectInput.value = ''
        } catch (error) {
            alert('Failed to add project')
        } finally {
            this.addProjectBtn.disabled = false
            this.addProjectBtn.textContent = 'Add Project'
        }
    }

    async handleAddArea() {
        const name = this.newAreaInput.value.trim()
        if (!name) return

        this.addNewAreaBtn.disabled = true
        this.addNewAreaBtn.textContent = 'Adding...'

        try {
            await addArea(name)
            this.newAreaInput.value = ''
            renderManageAreasList(this.manageAreasList)
        } catch (error) {
            alert('Failed to add area')
        } finally {
            this.addNewAreaBtn.disabled = false
            this.addNewAreaBtn.textContent = 'Add'
        }
    }

    openManageAreasModal() {
        this.manageAreasModal.classList.add('active')
        renderManageAreasList(this.manageAreasList)

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

    openKeyboardShortcutsModal() {
        this.keyboardShortcutsModal.classList.add('active')

        this.handleKeyboardShortcutsEscapeKey = (e) => {
            if (e.key === 'Escape') this.closeKeyboardShortcutsModal()
        }
        document.addEventListener('keydown', this.handleKeyboardShortcutsEscapeKey)
    }

    closeKeyboardShortcutsModal() {
        this.keyboardShortcutsModal.classList.remove('active')

        if (this.handleKeyboardShortcutsEscapeKey) {
            document.removeEventListener('keydown', this.handleKeyboardShortcutsEscapeKey)
        }
    }

    openSettingsModal() {
        this.settingsModal.classList.add('active')

        const currentUser = store.get('currentUser')
        const currentUsername = this.toolbarUsername.textContent
        if (currentUsername !== currentUser.email) {
            this.usernameInput.value = currentUsername
        } else {
            this.usernameInput.value = ''
        }

        this.handleSettingsEscapeKey = (e) => {
            if (e.key === 'Escape') this.closeSettingsModal()
        }
        document.addEventListener('keydown', this.handleSettingsEscapeKey)

        setTimeout(() => this.usernameInput.focus(), 100)
    }

    closeSettingsModal() {
        this.settingsModal.classList.remove('active')

        if (this.handleSettingsEscapeKey) {
            document.removeEventListener('keydown', this.handleSettingsEscapeKey)
        }

        this.usernameInput.value = ''

        if (this.settingsBtn && typeof this.settingsBtn.focus === 'function') {
            this.settingsBtn.focus()
        }
    }

    async saveSettings() {
        const username = this.usernameInput.value.trim()

        this.saveSettingsBtn.disabled = true
        this.saveSettingsBtn.textContent = 'Saving...'

        const result = await saveUserSettings({ username })

        this.saveSettingsBtn.disabled = false
        this.saveSettingsBtn.textContent = 'Save Settings'

        if (!result.success) {
            alert(result.error || 'Failed to save settings')
            return
        }

        const currentUser = store.get('currentUser')
        this.toolbarUsername.textContent = username || currentUser.email

        this.closeSettingsModal()
    }

    async migrateExistingData() {
        const encryptionKey = store.get('encryptionKey')
        if (!encryptionKey) {
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
            const { data: todos, error: todosError } = await supabase
                .from('todos')
                .select('id, text')

            if (todosError) throw new Error('Failed to load todos: ' + todosError.message)

            for (const todo of todos) {
                if (!isEncrypted(todo.text)) {
                    try {
                        const encryptedText = await CryptoUtils.encrypt(todo.text, encryptionKey)
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

            const { data: categories, error: categoriesError } = await supabase
                .from('categories')
                .select('id, name')

            if (categoriesError) throw new Error('Failed to load categories: ' + categoriesError.message)

            for (const category of categories) {
                if (!isEncrypted(category.name)) {
                    try {
                        const encryptedName = await CryptoUtils.encrypt(category.name, encryptionKey)
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

            await loadCategories()
            await loadTodos()

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

    initSidebarResize() {
        if (!this.sidebarResizeHandle || !this.sidebar || !this.mainContent) return

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

            const clampedPercent = Math.min(30, Math.max(15, newWidthPercent))
            this.sidebar.style.width = `${clampedPercent}%`
        }

        const stopResize = () => {
            if (!isResizing) return
            isResizing = false
            document.body.classList.remove('sidebar-resizing')
            this.sidebarResizeHandle.classList.remove('resizing')

            const containerWidth = this.mainContent.getBoundingClientRect().width
            const currentWidth = this.sidebar.getBoundingClientRect().width
            const widthPercent = (currentWidth / containerWidth) * 100
            localStorage.setItem('sidebarWidth', widthPercent.toFixed(2))
        }

        this.sidebarResizeHandle.addEventListener('mousedown', startResize)
        document.addEventListener('mousemove', doResize)
        document.addEventListener('mouseup', stopResize)

        this.sidebarResizeHandle.addEventListener('touchstart', startResize, { passive: false })
        document.addEventListener('touchmove', doResize, { passive: false })
        document.addEventListener('touchend', stopResize)
    }

    render() {
        renderGtdList(this.gtdList)
        renderProjects(this.projectList)
        updateAreaHeader(this.areaHeader)
        renderTodos(this.todoList, {
            onEditTodo: (todoId) => this.todoModal.openEdit(todoId),
            onProjectClick: (projectId) => selectProject(projectId)
        })
    }

    renderAll() {
        renderGtdList(this.gtdList)
        renderProjects(this.projectList)
        renderAreasDropdown(this.areaListContainer, this.toolbarAreasDropdown, this.areaListDivider)
        updateAreasLabel(this.toolbarAreasLabel)
        updateAreaHeader(this.areaHeader)
        renderTodos(this.todoList, {
            onEditTodo: (todoId) => this.todoModal.openEdit(todoId),
            onProjectClick: (projectId) => selectProject(projectId)
        })
    }
}

// Initialize the app
new TodoApp()
