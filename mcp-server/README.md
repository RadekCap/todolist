# Todolist MCP Server

An MCP (Model Context Protocol) server that allows Claude Code and other AI assistants to manage your todolist application data directly.

## Features

- **Authentication**: Login with your todolist credentials
- **Todo Management**: Create, read, update, delete todos
- **Batch Operations**: Create multiple todos at once
- **Project Management**: Create, update, delete projects
- **Area Management**: Create, update, delete areas of responsibility
- **End-to-End Encryption**: All data is encrypted/decrypted using your password

## Prerequisites

- Node.js 18 or higher
- npm
- A todolist account (create one at https://radekcap.github.io/todolist/)

## Installation

1. Navigate to the mcp-server directory:
   ```bash
   cd mcp-server
   npm install
   ```

2. Configure Claude Code to use this MCP server by adding it to your `~/.claude/claude_desktop_config.json` or `~/.claude/settings.json`:

   ```json
   {
     "mcpServers": {
       "todolist": {
         "command": "node",
         "args": ["/path/to/todolist/mcp-server/index.js"]
       }
     }
   }
   ```

   Replace `/path/to/todolist` with the actual path to your cloned repository.

3. Restart Claude Code to load the new MCP server.

## Usage

Once configured, you can interact with the todolist through Claude Code:

### Authentication

First, login with your credentials:
```
Use the todolist login tool with my email and password
```

### Managing Todos

```
# List all todos
List my todos

# Create a new todo
Create a todo "Buy groceries" with status next_action

# Create multiple todos at once
Create these todos in my inbox:
- Review quarterly report
- Schedule team meeting
- Update project documentation

# Mark a todo as done
Mark todo [id] as done

# Delete a todo
Delete todo [id]
```

### Managing Projects

```
# List projects
List my projects

# Create a project
Create a new project called "Home Renovation" with color #e74c3c

# Delete a project
Delete project [id]
```

### Managing Areas

```
# List areas
List my areas

# Create an area
Create a new area called "Work"

# Delete an area
Delete area [id]
```

## Available Tools

| Tool | Description |
|------|-------------|
| `login` | Authenticate with email and password |
| `logout` | Sign out of the current session |
| `list_todos` | List todos with optional filters (project, area, GTD status) |
| `create_todo` | Create a single todo |
| `update_todo` | Update todo properties |
| `delete_todo` | Delete a todo |
| `batch_create_todos` | Create multiple todos at once |
| `list_projects` | List all projects |
| `create_project` | Create a new project |
| `update_project` | Update project properties |
| `delete_project` | Delete a project |
| `list_areas` | List all areas of responsibility |
| `create_area` | Create a new area |
| `update_area` | Update area properties |
| `delete_area` | Delete an area |
| `list_categories` | List all categories/tags |
| `list_contexts` | List all contexts |
| `list_priorities` | List all priority levels |

## GTD Status Values

The following GTD (Getting Things Done) status values are supported:

- `inbox` - Items that need to be processed
- `next_action` - Next actionable items
- `waiting_for` - Items waiting on someone/something
- `someday_maybe` - Items to consider later
- `done` - Completed items

## Security Notes

- Your password is used to derive an encryption key locally
- All todo text, project names, and area names are encrypted before being stored
- The MCP server maintains encryption compatibility with the web app
- Session state is kept in memory and not persisted to disk

## Troubleshooting

### "Not authenticated" error
Make sure to login first using the `login` tool before performing any other operations.

### Decryption errors
If you see garbled text, ensure you're using the same password as you use in the web app.

### Connection errors
Check that the MCP server is properly configured in your Claude settings and that the path to `index.js` is correct.
