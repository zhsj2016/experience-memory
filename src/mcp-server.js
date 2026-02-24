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
    version: '1.1.0',
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
      {
        name: 'memory_record_experience',
        description: 'Automatically record a problem-solving experience (problem, attempted solution, result). Call this after solving a problem to build an经验知识库.',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID' },
            problem: { type: 'string', description: 'The problem or task description' },
            attempted_solution: { type: 'string', description: 'The solution/approach that was tried' },
            result: { type: 'string', description: 'Result: success, failure, or partial' },
            lesson: { type: 'string', description: 'Key lesson learned (why it worked or why it failed)' },
            context: { type: 'string', description: 'Additional context (environment, tools used, etc.)' },
          },
          required: ['user_id', 'problem', 'attempted_solution', 'result'],
        },
      },
      {
        name: 'memory_record_error',
        description: 'Automatically record an error or failed attempt. This is called when a solution fails or an error is encountered. The system will learn to avoid this approach in the future.',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID' },
            error_type: { type: 'string', description: 'Type of error (e.g., syntax_error, logic_error, timeout, dependency_missing)' },
            error_message: { type: 'string', description: 'The error message or description' },
            attempted_approach: { type: 'string', description: 'What approach was tried that led to this error' },
            suggestion: { type: 'string', description: 'How this error could be avoided in the future' },
          },
          required: ['user_id', 'error_type', 'error_message', 'attempted_approach'],
        },
      },
      {
        name: 'memory_get_lessons',
        description: 'Get accumulated lessons from past problem-solving experiences. Call this before solving a new problem to learn from past mistakes.',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID' },
            topic: { type: 'string', description: 'Topic to search for related lessons' },
            limit: { type: 'number', description: 'Maximum number of lessons (default 10)' },
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
      case 'memory_record_experience':
        result = await recordExperience(args);
        break;
      case 'memory_record_error':
        result = await recordError(args);
        break;
      case 'memory_get_lessons':
        result = await getLessons(args);
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

async function recordExperience(args) {
  const { user_id, problem, attempted_solution, result, lesson, context } = args;
  
  const memories = [];
  
  memories.push({
    user_id,
    key: `experience:problem:${Date.now()}`,
    value: { problem, attempted_solution, result, lesson, context },
    type: 'experience',
    tags: ['experience', result],
  });

  if (result === 'failure') {
    memories.push({
      user_id,
      key: `error:avoid:${Date.now()}`,
      value: { problem, failed_solution: attempted_solution, lesson: lesson || '避免这种方案', context },
      type: 'error',
      tags: ['error', 'to_avoid'],
    });
  }

  const results = [];
  for (const mem of memories) {
    const res = await callMemoryAPI('/memory/add', 'POST', mem);
    results.push(res);
  }

  return {
    success: true,
    recorded: memories.length,
    problem,
    result,
    lesson: lesson || '无',
  };
}

async function recordError(args) {
  const { user_id, error_type, error_message, attempted_approach, suggestion } = args;

  const memory = {
    user_id,
    key: `error:${error_type}:${Date.now()}`,
    value: { error_type, error_message, attempted_approach, suggestion, error_pattern: error_message },
    type: 'error',
    tags: ['error', error_type],
  };

  const result = await callMemoryAPI('/memory/add', 'POST', memory);

  return {
    success: true,
    recorded: 1,
    error_type,
    suggestion: suggestion || '检查错误信息，避免类似方案',
  };
}

async function getLessons(args) {
  const { user_id, topic, limit = 10 } = args;

  const searchQueries = [
    topic || '经验 教训 错误',
    topic ? `error ${topic}` : 'error avoid',
    topic ? `experience ${topic}` : 'experience',
  ];

  const allLessons = [];

  for (const query of searchQueries) {
    try {
      const res = await callMemoryAPI('/memory/search', 'POST', { query, limit: 5 });
      if (res.results) {
        allLessons.push(...res.results);
      }
    } catch (e) {}
  }

  const uniqueLessons = [];
  const seen = new Set();
  for (const lesson of allLessons) {
    const key = lesson.key || JSON.stringify(lesson.value);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLessons.push(lesson);
    }
  }

  return {
    lessons: uniqueLessons.slice(0, limit),
    count: uniqueLessons.length,
    topic,
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
