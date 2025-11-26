# TodoList

A modern single-page todo list application with user authentication, categories, and cloud sync, built with vanilla HTML, CSS, JavaScript, and Supabase.

## Features

- **User Authentication**: Secure email/password authentication
- **Categories**: Organize todos with custom categories
  - Create, delete, and manage categories
  - Assign colors to categories for visual organization
  - Filter todos by category
  - View all todos or uncategorized items
- **Cross-device Sync**: Your todos sync across all your devices
- **Cloud Storage**: Todos are stored in Supabase PostgreSQL database
- **Private & Secure**: Each user has their own private todo list with Row Level Security
- **Add, complete, and delete todos**: Full CRUD functionality
- **Clean, modern UI**: Beautiful gradient design with smooth animations and color-coded categories
- **Responsive design**: Works on desktop and mobile with adaptive sidebar
- **Real-time statistics**: Track total and completed todos filtered by category

## Live Demo

Visit: https://radekcap.github.io/todolist/

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (ES6 modules)
- **Backend/Database**: Supabase (PostgreSQL + Authentication)
- **Hosting**: GitHub Pages

## Usage

1. Visit the deployed URL
2. Sign up with your email and password
3. Create categories to organize your todos (optional)
4. Add todos and assign them to categories
5. Click on categories in the sidebar to filter your view
6. Your todos and categories will sync across all devices where you're logged in

## Local Development

1. Clone the repository
2. Open `index.html` in your browser
3. The app connects to Supabase cloud - no local setup required!

No build process or dependencies required.
