# TodoList

[![E2E Tests](https://github.com/RadekCap/todolist/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/RadekCap/todolist/actions/workflows/e2e-tests.yml)
[![Unit Tests](https://github.com/RadekCap/todolist/actions/workflows/unit-tests.yml/badge.svg)](https://github.com/RadekCap/todolist/actions/workflows/unit-tests.yml)
[![CSS Selector Check](https://github.com/RadekCap/todolist/actions/workflows/css-selector-check.yml/badge.svg)](https://github.com/RadekCap/todolist/actions/workflows/css-selector-check.yml)
[![Deploy to GitHub Pages](https://github.com/RadekCap/todolist/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/RadekCap/todolist/actions/workflows/deploy-pages.yml)

A full-featured, single-page GTD (Getting Things Done) application with end-to-end encryption, cloud sync, and zero build step — built entirely with vanilla HTML, CSS, and JavaScript.

**Live at:** https://radekcap.github.io/todolist/

## Features

- **GTD Workflow** — Inbox, Next Action, Scheduled, Waiting For, Someday/Maybe, and Done views
- **Projects & Areas** — Organize tasks into projects, group projects into areas of responsibility
- **Project Templates** — Save reusable project blueprints and create new projects from them in one click
- **Recurring Tasks** — Daily, weekly, monthly, and custom recurrence rules
- **End-to-End Encryption** — AES-256-GCM encryption with PBKDF2 key derivation — your data is encrypted before it leaves the browser
- **User Authentication** — Secure email/password auth via Supabase
- **Cross-device Sync** — Real-time cloud sync across all your devices
- **Due Dates** — Smart date labels, overdue indicators, and date-grouped views
- **Categories, Contexts & Priorities** — Filter and organize with custom tags
- **Search** — Full-text search across all todos
- **Multi-format Export** — Export to Text, JSON, CSV, or XML
- **Keyboard Shortcuts** — `N` for new todo, `1-6` for GTD views, `Shift+1-9` for areas
- **Drag & Drop** — Reorder projects, assign todos to projects, reorder template items
- **Three Themes** — Glass, Dark, and Clear with comfortable/compact density modes
- **Session Lock** — Lock the app without signing out, unlock with your password
- **Responsive Design** — Works on desktop, tablet, and mobile

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (ES6 modules) — no build step, no framework
- **Backend:** Supabase (PostgreSQL + Auth + Row Level Security)
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions (E2E tests, unit tests, CSS validation, auto-deploy)

## Test Suite

This project maintains a comprehensive test suite spanning unit and end-to-end tests.

| Layer | Tests | Files | Coverage |
|-------|-------|-------|----------|
| **Unit** (Vitest) | 1,085 | 25 | 92% statements · 83% branches · 95% functions · 93% lines |
| **E2E** (Playwright) | 414 | 65 | Auth, todos, projects, navigation, settings, recurrence, and more |
| **Total** | **1,499** | **90** | |

- Unit tests run with the **v8 coverage provider** and cover all services, utilities, and core modules
- E2E tests run against the **live Supabase instance** in Chromium across **8 parallel shards**
- CSS selectors are validated against `index.html` on every commit via a pre-commit hook and CI

## Getting Started

1. Clone the repository
2. Run `npm install` (installs dev dependencies and pre-commit hook)
3. Open `index.html` in a browser
4. The app connects to Supabase cloud — no local database setup required

## Architecture

```
app.js (TodoApp)         ← Orchestrator: DOM refs, event listeners, modal management
    ↓
src/ui/                  ← Rendering: builds DOM, handles display logic
    ↓
src/services/            ← Business logic: Supabase CRUD, filtering, encryption
    ↓
src/core/                ← Foundation: Supabase client, reactive Store, EventBus
src/utils/               ← Shared helpers: security, crypto, dates, recurrence
```

No build step — all code runs as static ES6 modules served directly by GitHub Pages.

## License

Private repository.
