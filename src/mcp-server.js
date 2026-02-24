#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const http = require('http');

const MEMORY_API_URL = process.env.MEMORY_API_URL || 'http://localhost:3000';

async function callMemoryAPI(endpoint, method = 'POST', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, MEMORY_API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const server = new Server(
  {
    name: 'experience-memory',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'memory_add',
        description: 'Add a new memory to the Experience Memory system',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID' },
            key: { type: 'string', description: 'Memory key (e.g., preference:style)' },
            value: { type: 'object', description: 'Memory value' },
            type: { type: 'string', description: 'Memory type (preference, fact, habit)' },
          },
          required: ['user_id', 'key', 'value'],
        },
      },
      {
        name: 'memory_search',
        description: 'Search memories using semantic search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Maximum results (default 5)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'memory_list',
        description: 'List all memories for a user',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID (default: default-user)' },
          },
        },
      },
      {
        name: 'memory_learn',
        description: 'Automatically learn from conversation messages',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID' },
            messages: {
              type: 'array',
              description: 'Array of messages with role and content',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
          },
          required: ['user_id', 'messages'],
        },
      },
      {
        name: 'memory_smart_forget',
        description: 'Automatically forget low-value memories',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID' },
          },
          required: ['user_id'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case 'memory_add':
        result = await callMemoryAPI('/memory/add', 'POST', args);
        break;
      case 'memory_search':
        result = await callMemoryAPI('/memory/search', 'POST', args);
        break;
      case 'memory_list':
        result = await callMemoryAPI(`/memory/list?user_id=${args.user_id || 'default-user'}`);
        break;
      case 'memory_learn':
        result = await callMemoryAPI('/memory/learn', 'POST', args);
        break;
      case 'memory_smart_forget':
        result = await callMemoryAPI('/memory/smart-forget', 'POST', args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
