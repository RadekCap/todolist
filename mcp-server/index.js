#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Supabase configuration
const SUPABASE_URL = 'https://rkvmujdayjmszmyzbhal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdm11amRheWptc3pteXpiaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc2MDcsImV4cCI6MjA3OTc2MzYwN30.55RoV1mmHeykVz9waU7Jz6-JSkrRqlNa-ABBE8SN-jA';

// Session state
let supabase = null;
let currentUser = null;
let encryptionKey = null;

// Encryption utilities compatible with the web app
const CryptoUtils = {
  async deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  },

  generateSalt() {
    return crypto.randomBytes(16);
  },

  arrayToBase64(buffer) {
    return Buffer.from(buffer).toString('base64');
  },

  base64ToArray(base64) {
    return Buffer.from(base64, 'base64');
  },

  async encrypt(plaintext, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Combine IV + ciphertext + authTag (same format as web app)
    const combined = Buffer.concat([iv, encrypted, authTag]);
    return combined.toString('base64');
  },

  async decrypt(encryptedBase64, key) {
    const combined = Buffer.from(encryptedBase64, 'base64');

    // Extract IV (first 12 bytes), ciphertext, and auth tag (last 16 bytes)
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(combined.length - 16);
    const ciphertext = combined.subarray(12, combined.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  },

  isEncrypted(text) {
    if (!text || text.length < 24) return false;
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    return base64Regex.test(text) && text.length >= 32;
  }
};

// Helper to encrypt text
async function encrypt(plaintext) {
  if (!encryptionKey) return plaintext;
  return await CryptoUtils.encrypt(plaintext, encryptionKey);
}

// Helper to decrypt text
async function decrypt(ciphertext) {
  if (!encryptionKey) return ciphertext;
  if (!ciphertext || !CryptoUtils.isEncrypted(ciphertext)) return ciphertext;
  try {
    return await CryptoUtils.decrypt(ciphertext, encryptionKey);
  } catch (e) {
    return ciphertext;
  }
}

// Initialize encryption from user settings
async function initializeEncryption(user, password) {
  const { data: settings } = await supabase
    .from('user_settings')
    .select('encryption_salt')
    .eq('user_id', user.id)
    .single();

  let salt;
  if (settings && settings.encryption_salt) {
    salt = CryptoUtils.base64ToArray(settings.encryption_salt);
  } else {
    salt = CryptoUtils.generateSalt();
    const saltBase64 = CryptoUtils.arrayToBase64(salt);

    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        encryption_salt: saltBase64,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
  }

  encryptionKey = await CryptoUtils.deriveKey(password, salt);
}

// Tool definitions
const tools = [
  {
    name: 'login',
    description: 'Login to the todolist application with email and password',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'User email address' },
        password: { type: 'string', description: 'User password' }
      },
      required: ['email', 'password']
    }
  },
  {
    name: 'logout',
    description: 'Logout from the todolist application',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_todos',
    description: 'List all todos, optionally filtered by project, area, or GTD status',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Filter by project ID (optional)' },
        area_id: { type: 'string', description: 'Filter by area ID (optional)' },
        gtd_status: {
          type: 'string',
          enum: ['inbox', 'next_action', 'waiting_for', 'someday_maybe', 'done'],
          description: 'Filter by GTD status (optional)'
        },
        include_done: { type: 'boolean', description: 'Include completed todos (default: false)' }
      }
    }
  },
  {
    name: 'create_todo',
    description: 'Create a new todo item',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Todo text content' },
        comment: { type: 'string', description: 'Additional comment or description (optional)' },
        project_id: { type: 'string', description: 'Project ID (optional)' },
        category_id: { type: 'string', description: 'Category ID (optional)' },
        priority_id: { type: 'string', description: 'Priority ID (optional)' },
        context_id: { type: 'string', description: 'Context ID (optional)' },
        gtd_status: {
          type: 'string',
          enum: ['inbox', 'next_action', 'waiting_for', 'someday_maybe', 'done'],
          description: 'GTD status (default: inbox)'
        },
        due_date: { type: 'string', description: 'Due date in ISO format (optional)' }
      },
      required: ['text']
    }
  },
  {
    name: 'update_todo',
    description: 'Update an existing todo item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Todo ID' },
        text: { type: 'string', description: 'New todo text (optional)' },
        comment: { type: 'string', description: 'Additional comment or description (optional, use null to remove)' },
        completed: { type: 'boolean', description: 'Completion status (optional)' },
        project_id: { type: 'string', description: 'Project ID (optional, use null to remove)' },
        category_id: { type: 'string', description: 'Category ID (optional)' },
        priority_id: { type: 'string', description: 'Priority ID (optional)' },
        context_id: { type: 'string', description: 'Context ID (optional)' },
        gtd_status: {
          type: 'string',
          enum: ['inbox', 'next_action', 'waiting_for', 'someday_maybe', 'done'],
          description: 'GTD status (optional)'
        },
        due_date: { type: 'string', description: 'Due date in ISO format (optional)' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_todo',
    description: 'Delete a todo item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Todo ID to delete' }
      },
      required: ['id']
    }
  },
  {
    name: 'batch_create_todos',
    description: 'Create multiple todos at once',
    inputSchema: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Todo text content' },
              comment: { type: 'string', description: 'Additional comment or description (optional)' },
              project_id: { type: 'string', description: 'Project ID (optional)' },
              gtd_status: { type: 'string', description: 'GTD status (default: inbox)' },
              due_date: { type: 'string', description: 'Due date (optional)' }
            },
            required: ['text']
          },
          description: 'Array of todos to create'
        }
      },
      required: ['todos']
    }
  },
  {
    name: 'list_projects',
    description: 'List all projects, optionally filtered by area',
    inputSchema: {
      type: 'object',
      properties: {
        area_id: { type: 'string', description: 'Filter by area ID (optional)' }
      }
    }
  },
  {
    name: 'create_project',
    description: 'Create a new project',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
        color: { type: 'string', description: 'Hex color code (optional, e.g., #3498db)' },
        area_id: { type: 'string', description: 'Area ID to assign project to (optional)' }
      },
      required: ['name']
    }
  },
  {
    name: 'update_project',
    description: 'Update an existing project',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project ID' },
        name: { type: 'string', description: 'New project name (optional)' },
        color: { type: 'string', description: 'New hex color code (optional)' },
        area_id: { type: 'string', description: 'Area ID (optional, use null to remove)' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_project',
    description: 'Delete a project',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project ID to delete' }
      },
      required: ['id']
    }
  },
  {
    name: 'list_areas',
    description: 'List all areas of responsibility',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_area',
    description: 'Create a new area of responsibility',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Area name' },
        color: { type: 'string', description: 'Hex color code (optional)' }
      },
      required: ['name']
    }
  },
  {
    name: 'update_area',
    description: 'Update an existing area',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Area ID' },
        name: { type: 'string', description: 'New area name (optional)' },
        color: { type: 'string', description: 'New hex color code (optional)' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_area',
    description: 'Delete an area',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Area ID to delete' }
      },
      required: ['id']
    }
  },
  {
    name: 'list_categories',
    description: 'List all categories/tags',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_contexts',
    description: 'List all contexts (e.g., @home, @work)',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_priorities',
    description: 'List all priority levels',
    inputSchema: { type: 'object', properties: {} }
  }
];

// Tool handlers
async function handleLogin(email, password) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { success: false, error: error.message };
  }

  currentUser = data.user;
  await initializeEncryption(currentUser, password);

  return {
    success: true,
    message: `Logged in as ${email}`,
    user_id: currentUser.id
  };
}

async function handleLogout() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  currentUser = null;
  encryptionKey = null;
  return { success: true, message: 'Logged out successfully' };
}

function requireAuth() {
  if (!currentUser) {
    throw new Error('Not authenticated. Please login first using the login tool.');
  }
}

async function handleListTodos(args) {
  requireAuth();

  let query = supabase
    .from('todos')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (args.project_id) {
    query = query.eq('project_id', args.project_id);
  }
  if (args.gtd_status) {
    query = query.eq('gtd_status', args.gtd_status);
  }
  if (!args.include_done) {
    query = query.neq('gtd_status', 'done');
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  // Decrypt todo texts
  const todos = await Promise.all(data.map(async (todo) => ({
    ...todo,
    text: await decrypt(todo.text)
  })));

  // Filter by area if specified (requires joining with projects)
  let filteredTodos = todos;
  if (args.area_id) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('area_id', args.area_id);

    const projectIds = new Set(projects?.map(p => p.id) || []);
    filteredTodos = todos.filter(t => projectIds.has(t.project_id));
  }

  return { success: true, todos: filteredTodos, count: filteredTodos.length };
}

async function handleCreateTodo(args) {
  requireAuth();

  const encryptedText = await encrypt(args.text);
  const encryptedComment = args.comment ? await encrypt(args.comment) : null;

  const todoData = {
    user_id: currentUser.id,
    text: encryptedText,
    comment: encryptedComment,
    completed: false,
    gtd_status: args.gtd_status || 'inbox',
    project_id: args.project_id || null,
    category_id: args.category_id || null,
    priority_id: args.priority_id || null,
    context_id: args.context_id || null,
    due_date: args.due_date || null
  };

  const { data, error } = await supabase
    .from('todos')
    .insert(todoData)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: 'Todo created successfully',
    todo: { ...data, text: args.text }
  };
}

async function handleUpdateTodo(args) {
  requireAuth();

  const updateData = {};

  if (args.text !== undefined) {
    updateData.text = await encrypt(args.text);
  }
  if (args.comment !== undefined) {
    updateData.comment = args.comment ? await encrypt(args.comment) : null;
  }
  if (args.completed !== undefined) {
    updateData.completed = args.completed;
    if (args.completed) {
      updateData.gtd_status = 'done';
    }
  }
  if (args.gtd_status !== undefined) {
    updateData.gtd_status = args.gtd_status;
    updateData.completed = args.gtd_status === 'done';
  }
  if (args.project_id !== undefined) {
    updateData.project_id = args.project_id;
  }
  if (args.category_id !== undefined) {
    updateData.category_id = args.category_id;
  }
  if (args.priority_id !== undefined) {
    updateData.priority_id = args.priority_id;
  }
  if (args.context_id !== undefined) {
    updateData.context_id = args.context_id;
  }
  if (args.due_date !== undefined) {
    updateData.due_date = args.due_date;
  }

  const { data, error } = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', args.id)
    .eq('user_id', currentUser.id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: 'Todo updated successfully',
    todo: { ...data, text: args.text || await decrypt(data.text) }
  };
}

async function handleDeleteTodo(args) {
  requireAuth();

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', args.id)
    .eq('user_id', currentUser.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, message: 'Todo deleted successfully' };
}

async function handleBatchCreateTodos(args) {
  requireAuth();

  const todosToInsert = await Promise.all(args.todos.map(async (todo) => ({
    user_id: currentUser.id,
    text: await encrypt(todo.text),
    comment: todo.comment ? await encrypt(todo.comment) : null,
    completed: false,
    gtd_status: todo.gtd_status || 'inbox',
    project_id: todo.project_id || null,
    due_date: todo.due_date || null
  })));

  const { data, error } = await supabase
    .from('todos')
    .insert(todosToInsert)
    .select();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: `Created ${data.length} todos successfully`,
    count: data.length
  };
}

async function handleListProjects(args) {
  requireAuth();

  let query = supabase
    .from('projects')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (args.area_id) {
    query = query.eq('area_id', args.area_id);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  // Decrypt project names
  const projects = await Promise.all(data.map(async (project) => ({
    ...project,
    name: await decrypt(project.name)
  })));

  return { success: true, projects, count: projects.length };
}

async function handleCreateProject(args) {
  requireAuth();

  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const projectData = {
    user_id: currentUser.id,
    name: await encrypt(args.name),
    color: args.color || randomColor,
    area_id: args.area_id || null
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: 'Project created successfully',
    project: { ...data, name: args.name }
  };
}

async function handleUpdateProject(args) {
  requireAuth();

  const updateData = {};

  if (args.name !== undefined) {
    updateData.name = await encrypt(args.name);
  }
  if (args.color !== undefined) {
    updateData.color = args.color;
  }
  if (args.area_id !== undefined) {
    updateData.area_id = args.area_id;
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', args.id)
    .eq('user_id', currentUser.id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: 'Project updated successfully',
    project: { ...data, name: args.name || await decrypt(data.name) }
  };
}

async function handleDeleteProject(args) {
  requireAuth();

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', args.id)
    .eq('user_id', currentUser.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, message: 'Project deleted successfully' };
}

async function handleListAreas() {
  requireAuth();

  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  // Decrypt area names
  const areas = await Promise.all(data.map(async (area) => ({
    ...area,
    name: await decrypt(area.name)
  })));

  return { success: true, areas, count: areas.length };
}

async function handleCreateArea(args) {
  requireAuth();

  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const areaData = {
    user_id: currentUser.id,
    name: await encrypt(args.name),
    color: args.color || randomColor
  };

  const { data, error } = await supabase
    .from('areas')
    .insert(areaData)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: 'Area created successfully',
    area: { ...data, name: args.name }
  };
}

async function handleUpdateArea(args) {
  requireAuth();

  const updateData = {};

  if (args.name !== undefined) {
    updateData.name = await encrypt(args.name);
  }
  if (args.color !== undefined) {
    updateData.color = args.color;
  }

  const { data, error } = await supabase
    .from('areas')
    .update(updateData)
    .eq('id', args.id)
    .eq('user_id', currentUser.id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: 'Area updated successfully',
    area: { ...data, name: args.name || await decrypt(data.name) }
  };
}

async function handleDeleteArea(args) {
  requireAuth();

  const { error } = await supabase
    .from('areas')
    .delete()
    .eq('id', args.id)
    .eq('user_id', currentUser.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, message: 'Area deleted successfully' };
}

async function handleListCategories() {
  requireAuth();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  // Decrypt category names
  const categories = await Promise.all(data.map(async (cat) => ({
    ...cat,
    name: await decrypt(cat.name)
  })));

  return { success: true, categories, count: categories.length };
}

async function handleListContexts() {
  requireAuth();

  const { data, error } = await supabase
    .from('contexts')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  // Decrypt context names
  const contexts = await Promise.all(data.map(async (ctx) => ({
    ...ctx,
    name: await decrypt(ctx.name)
  })));

  return { success: true, contexts, count: contexts.length };
}

async function handleListPriorities() {
  requireAuth();

  const { data, error } = await supabase
    .from('priorities')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('level', { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  // Decrypt priority names
  const priorities = await Promise.all(data.map(async (priority) => ({
    ...priority,
    name: await decrypt(priority.name)
  })));

  return { success: true, priorities, count: priorities.length };
}

// Create MCP server
const server = new Server(
  {
    name: 'todolist-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'login':
        result = await handleLogin(args.email, args.password);
        break;
      case 'logout':
        result = await handleLogout();
        break;
      case 'list_todos':
        result = await handleListTodos(args || {});
        break;
      case 'create_todo':
        result = await handleCreateTodo(args);
        break;
      case 'update_todo':
        result = await handleUpdateTodo(args);
        break;
      case 'delete_todo':
        result = await handleDeleteTodo(args);
        break;
      case 'batch_create_todos':
        result = await handleBatchCreateTodos(args);
        break;
      case 'list_projects':
        result = await handleListProjects(args || {});
        break;
      case 'create_project':
        result = await handleCreateProject(args);
        break;
      case 'update_project':
        result = await handleUpdateProject(args);
        break;
      case 'delete_project':
        result = await handleDeleteProject(args);
        break;
      case 'list_areas':
        result = await handleListAreas();
        break;
      case 'create_area':
        result = await handleCreateArea(args);
        break;
      case 'update_area':
        result = await handleUpdateArea(args);
        break;
      case 'delete_area':
        result = await handleDeleteArea(args);
        break;
      case 'list_categories':
        result = await handleListCategories();
        break;
      case 'list_contexts':
        result = await handleListContexts();
        break;
      case 'list_priorities':
        result = await handleListPriorities();
        break;
      default:
        result = { success: false, error: `Unknown tool: ${name}` };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
