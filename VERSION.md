# Version History

This file tracks the version history of the TodoList application.

## Versioning System

The application follows [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.0.0)
- **MAJOR**: Breaking changes or major feature releases
- **MINOR**: New features added in a backward-compatible manner
- **PATCH**: Backward-compatible bug fixes

### How Versioning Works

**Automatic Version Increment (PATCH):**
- When a PR is merged to `main`, GitHub Actions automatically increments the PATCH version
- Example: 1.0.0 → 1.0.1 → 1.0.2
- The workflow updates both `app.js` and `VERSION.md`
- Changes are committed automatically by `github-actions[bot]`

**Manual Version Update (MINOR/MAJOR):**
When preparing a feature release or breaking change:

1. **New features**: Manually update to next MINOR version (e.g., 1.0.5 → 1.1.0)
2. **Breaking changes**: Manually update to next MAJOR version (e.g., 1.5.0 → 2.0.0)

---

## Changelog

### Version 2.2.0 (Current)
**Release Date:** 2026-02-05

**New Features:**
- **Multi-Format Export**: Export todos in multiple file formats
  - Plain Text (.txt) - Human-readable format with metadata
  - JSON (.json) - Structured data with metadata, ideal for programmatic use
  - CSV (.csv) - Spreadsheet-compatible format for Excel/Google Sheets
  - XML (.xml) - Hierarchical data format for systems integration
- **Export Modal**: New modal interface for selecting export format
- **Security**: All user-generated content is properly escaped in XML and CSV formats

---

### Version 2.1.0
**Release Date:** 2026-01-25

**New Features:**
- **Manage Projects Modal**: Comprehensive project management interface
  - Drag-and-drop reordering of projects
  - Inline rename projects with editable name field
  - Change project color with color picker
  - Add/edit project description field
  - Assign projects to areas via dropdown
  - Delete projects with confirmation
- **Project Description Display**: Project descriptions now appear in the header above todos when viewing a project
- **Improved UI**: "Manage Projects" button added to sidebar projects section

---

### Version 2.0.0
**Release Date:** 2026-01-19

**Major Release** - Complete GTD workflow, MCP integration, and enhanced organization features.

**New Features:**
- **MCP Server Integration**: Claude Code can now manage todos directly via MCP protocol
  - Full CRUD operations for todos, projects, and areas
  - Batch todo creation
  - End-to-end encryption compatibility
  - Comment/description field support for todos
- **Areas of Responsibility**: Organize projects into life areas (Work, Personal, Health, etc.)
  - Drag-and-drop reordering
  - Quick area switching with keyboard shortcuts (Shift+1-9)
  - Filter projects and todos by area
- **Project Todo Counts**: Display todo counts next to each project in sidebar
- **Enhanced GTD Workflow**:
  - Keyboard navigation for GTD views (1-6 keys)
  - Scheduled view with date-based sections
  - Context support (@home, @work, @errands, etc.)
- **Search Functionality**: Search todos by text content
- **Keyboard Shortcuts**:
  - `N` - New todo
  - `Ctrl+Enter` - Submit todo form
  - `Escape` - Close modals and unfocus inputs
  - `1-6` - Switch GTD views
  - `Shift+1-9` - Switch areas
- **Theme System**: Glass, dark, and clear themes moved to toolbar
- **UI/UX Improvements**:
  - Drag-and-drop todos to projects
  - Footer links moved to user menu
  - Improved sidebar organization

**Bug Fixes:**
- Sidebar counts refresh properly after todo deletion
- Firefox Linux keyboard shortcut compatibility
- Safari select element rendering issues
- CSS selector validation for dynamic elements

**Technical Improvements:**
- End-to-end encryption for todos, projects, areas, and contexts
- Separated CSS into styles.css
- Separated JavaScript into app.js
- CSS selector validation in CI
- Improved accessibility (ARIA labels, keyboard navigation)

---

### Version 1.0.0
**Release Date:** 2025-12-01

**Initial Release** - First versioned release of the TodoList application.

**Features:**
- User authentication (login/signup via Supabase)
- Todo CRUD operations (create, read, update, delete)
- Category management with color coding
- Priority system for todos
- Due date tracking with visual indicators (overdue, today, upcoming)
- Modal-based todo creation form
- Responsive design (mobile and desktop)
- Safari compatibility fixes
- Security features (XSS prevention, color validation)
- Accessibility support (ARIA labels, keyboard navigation)
- Application versioning system with auto-increment

**Technical Stack:**
- Frontend: Vanilla JavaScript (ES6+)
- Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth
- Styling: CSS3 with gradients and transitions
- Deployment: GitHub Pages

**Database Schema:**
- `todos` table: id, user_id, text, completed, category_id, priority_id, due_date, created_at
- `categories` table: id, user_id, name, color, created_at
- `priorities` table: id, user_id, name, color, level, created_at

---

## Future Versions

### Planned for 2.1.0
- Todo editing inline
- Recurring tasks
- Task notes/descriptions expansion
- Subtasks support

### Planned for 2.2.0
- Calendar view
- Time tracking
- Tags system
- Export/import functionality

---

## Version Update Details

### Automatic Updates (via GitHub Actions)
- **PATCH versions** are incremented automatically when PRs merge to `main`
- Workflow file: `.github/workflows/auto-version-bump.yml`
- Updates: `app.js` (APP_VERSION) and `VERSION.md` (Current Version)
- No manual intervention required

### Manual Release Checklist (MINOR/MAJOR versions)

When preparing a feature or breaking change release:

- [ ] Manually update `APP_VERSION` constant in `app.js`
- [ ] Update this `VERSION.md` file with changelog entry
- [ ] Update "Current Version" at bottom of this file
- [ ] Commit: `chore: Bump version to X.Y.Z`
- [ ] Push tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
- [ ] Create GitHub release with release notes

---

**Current Version:** 2.2.19
**Last Updated:** 2026-03-01
