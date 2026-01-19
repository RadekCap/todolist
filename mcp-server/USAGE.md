# Todolist MCP Server Usage Guide

This guide provides detailed examples for using the todolist MCP server with Claude Code.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Managing Todos](#managing-todos)
- [Managing Projects](#managing-projects)
- [Managing Areas](#managing-areas)
- [GTD Workflow Examples](#gtd-workflow-examples)
- [Batch Operations](#batch-operations)
- [Filtering and Queries](#filtering-and-queries)

## Getting Started

After configuring the MCP server (see README.md), you can interact with your todolist using natural language in Claude Code.

## Authentication

### Login

Before performing any operations, you must authenticate:

```
Login to todolist with email john@example.com and password mypassword123
```

Response:
```json
{
  "success": true,
  "message": "Logged in as john@example.com",
  "user_id": "abc123..."
}
```

### Logout

When finished, logout to clear your session:

```
Logout from todolist
```

## Managing Todos

### Creating a Single Todo

**Basic todo (goes to inbox):**
```
Create a todo "Buy milk"
```

**Todo with GTD status:**
```
Create a todo "Call dentist" with status next_action
```

**Todo with project assignment:**
```
Create a todo "Research competitors" in project [project-id]
```

**Todo with due date:**
```
Create a todo "Submit report" with due date 2024-03-15
```

**Todo with comment/description:**
```
Create a todo "Review API endpoints" with comment "Check authentication and rate limiting"
```

**Full example with all options:**
```
Create a todo "Review Q1 budget" with:
- status: next_action
- project: [project-id]
- due date: 2024-02-28
- priority: [priority-id]
- comment: "Focus on marketing spend vs ROI"
```

### Listing Todos

**List all active todos:**
```
List my todos
```

**List todos by GTD status:**
```
List my inbox todos
List my next actions
List my waiting for items
List my someday/maybe items
```

**List todos in a specific project:**
```
List todos in project [project-id]
```

**Include completed todos:**
```
List all my todos including completed ones
```

### Updating Todos

**Change GTD status:**
```
Move todo [id] to next_action
Mark todo [id] as waiting_for
Move todo [id] to someday_maybe
```

**Mark as complete:**
```
Mark todo [id] as done
Complete todo [id]
```

**Update todo text:**
```
Update todo [id] text to "Buy groceries and milk"
```

**Assign to project:**
```
Move todo [id] to project [project-id]
Remove todo [id] from its project
```

**Set due date:**
```
Set due date of todo [id] to 2024-04-01
Remove due date from todo [id]
```

**Update comment:**
```
Update todo [id] comment to "Waiting for client feedback"
Remove comment from todo [id]
```

### Deleting Todos

```
Delete todo [id]
```

## Managing Projects

### Listing Projects

**List all projects:**
```
List my projects
```

**List projects in an area:**
```
List projects in area [area-id]
```

### Creating Projects

**Basic project:**
```
Create a project called "Home Renovation"
```

**Project with color:**
```
Create a project "Marketing Campaign" with color #e74c3c
```

**Project assigned to an area:**
```
Create a project "Q2 Goals" in area [area-id]
```

### Updating Projects

**Rename project:**
```
Rename project [id] to "Website Redesign v2"
```

**Change project color:**
```
Change project [id] color to #3498db
```

**Assign to area:**
```
Move project [id] to area [area-id]
```

### Deleting Projects

```
Delete project [id]
```

## Managing Areas

### Listing Areas

```
List my areas
```

### Creating Areas

**Basic area:**
```
Create an area called "Work"
Create an area called "Personal"
Create an area called "Health"
```

**Area with color:**
```
Create an area "Finance" with color #f39c12
```

### Updating Areas

**Rename area:**
```
Rename area [id] to "Career Development"
```

**Change area color:**
```
Change area [id] color to #9b59b6
```

### Deleting Areas

```
Delete area [id]
```

## GTD Workflow Examples

### Weekly Review Workflow

```
1. List my inbox todos
   (Review each item and decide its fate)

2. For items needing action soon:
   Move todo [id] to next_action

3. For items waiting on others:
   Move todo [id] to waiting_for

4. For items to consider later:
   Move todo [id] to someday_maybe

5. For completed items:
   Mark todo [id] as done
```

### Processing New Tasks

```
# Quickly capture multiple ideas to inbox
Create these todos:
- Research new CRM options
- Schedule team outing
- Review insurance policy
- Book dentist appointment

# Then process them one by one
List my inbox todos
Move todo [inbox-item-1] to next_action
Move todo [inbox-item-2] to someday_maybe
...
```

### Project Planning

```
# Create a new project
Create a project called "Q1 Product Launch"

# Add all related tasks
Create these todos in project [project-id]:
- Define target audience
- Create marketing materials
- Set up landing page
- Configure analytics
- Plan launch event
- Prepare press release

# Set priority tasks as next actions
Move todo [first-task-id] to next_action
Move todo [second-task-id] to next_action
```

## Batch Operations

### Create Multiple Todos at Once

**Simple batch:**
```
Create these todos:
- Buy groceries
- Call mom
- Pay electric bill
- Schedule car service
```

**Batch with status:**
```
Create these todos with status next_action:
- Review pull request
- Update documentation
- Fix login bug
```

**Batch with project:**
```
Create these todos in project [project-id]:
- Research competitors
- Analyze market trends
- Draft proposal
- Schedule stakeholder meeting
```

**Batch with comments:**
```
Create these todos with descriptions:
- login... (comment: Authenticate with email and password)
- logout... (comment: Sign out of the current session)
- list_todos... (comment: List todos with optional filters)
```

## Filtering and Queries

### Complex Queries

**Todos in a specific project with a status:**
```
List next actions in project [project-id]
```

**Todos in an area:**
```
List todos in area [area-id]
```

**Count todos:**
```
How many items are in my inbox?
How many next actions do I have?
```

### Reference Data

**List categories:**
```
List my categories
```

**List contexts:**
```
List my contexts
```

**List priorities:**
```
List my priorities
```

## Tips and Best Practices

1. **Always login first** - All operations require authentication

2. **Use batch operations** - When adding multiple todos, use `batch_create_todos` for efficiency

3. **Keep inbox clean** - Process inbox items regularly by moving them to appropriate GTD statuses

4. **Organize with projects** - Group related todos into projects for better organization

5. **Use areas for life domains** - Create areas like "Work", "Personal", "Health" to organize projects

6. **Set due dates sparingly** - Only set due dates for truly time-sensitive items

## Error Handling

### Common Errors

**Not authenticated:**
```
Error: Not authenticated. Please login first using the login tool.
Solution: Run the login command with your credentials
```

**Invalid ID:**
```
Error: Todo/Project/Area not found
Solution: List items first to get valid IDs
```

**Permission denied:**
```
Error: Row level security policy violation
Solution: You can only access your own data
```

## Example Session

Here's a complete example session:

```
# Login
Login to todolist with email john@example.com and password secret123

# Check current state
List my todos
List my projects
List my areas

# Create an area for work
Create an area called "Work"

# Create a project under work
Create a project "Website Redesign" in area [work-area-id]

# Add tasks to the project
Create these todos in project [website-project-id]:
- Audit current website
- Design new homepage mockup
- Set up staging environment
- Migrate content
- Test responsive design
- Launch new site

# Set the first task as a next action
Move todo [audit-task-id] to next_action

# Complete a task
Mark todo [audit-task-id] as done

# Move to next task
Move todo [design-task-id] to next_action

# End session
Logout from todolist
```
