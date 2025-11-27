# Version History

This file tracks the version history of the TodoList application.

## Versioning System

The application follows [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.0.0)
- **MAJOR**: Breaking changes or major feature releases
- **MINOR**: New features added in a backward-compatible manner
- **PATCH**: Backward-compatible bug fixes

### How to Update Version

When preparing a new release:

1. **Bug fixes**: Increment PATCH version (e.g., 1.0.0 → 1.0.1)
2. **New features**: Increment MINOR version (e.g., 1.0.1 → 1.1.0)
3. **Breaking changes**: Increment MAJOR version (e.g., 1.1.0 → 2.0.0)

Update the `APP_VERSION` constant in `index.html` (line ~856) and document the change below.

---

## Changelog

### Version 1.0.0 (Current)
**Release Date:** TBD

**Initial Release** - First versioned release of the TodoList application.

**Features:**
- User authentication (login/signup)
- Todo CRUD operations (create, read, update, delete)
- Category management with color coding
- Priority system for todos
- Due date tracking with visual indicators (overdue, today, upcoming)
- Modal-based todo creation form
- Responsive design (mobile and desktop)
- Safari compatibility fixes
- Security features (XSS prevention, color validation)
- Accessibility support (ARIA labels, keyboard navigation)
- Application versioning system

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

**Known Issues:**
- None currently identified

---

## Future Versions

### Planned for 1.1.0
- Settings page for priority management
- Priority filter in sidebar
- Default priorities for new users
- Drag-and-drop priority reordering

### Planned for 1.2.0
- Todo editing functionality
- Recurring tasks
- Task notes/descriptions
- Search and filter improvements

---

## Version Update Checklist

When preparing a new release:

- [ ] Update `APP_VERSION` constant in `index.html`
- [ ] Update this `VERSION.md` file with changelog
- [ ] Create a git tag: `git tag v1.0.0`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Create GitHub release with release notes
- [ ] Update README.md if needed

---

**Current Version:** 1.0.0
**Last Updated:** 2025-11-27
