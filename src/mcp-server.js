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
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const server = new Server(
  { name: 'experience-memory', version: '1.2.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ask_with_memory',
        description: '向 AI 提问时会自动查询历史经验，并让用户确认优化后的请求。用户的原始问题会被优化（整合成功/失败经验），确认后才会发送给 AI 模型。',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: '用户 ID' },
            question: { type: 'string', description: '用户的问题或请求' },
            auto_send: { type: 'boolean', description: '是否自动发送（跳过确认）', default: false }
          },
          required: ['user_id', 'question']
        }
      },
      {
        name: 'memory_optimize',
        description: '查询历史经验并生成优化后的请求（不发送给 AI，仅返回优化内容供用户确认）',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: '用户 ID' },
            query: { type: 'string', description: '需要优化的请求' }
          },
          required: ['user_id', 'query']
        }
      },
      {
        name: 'memory_confirm_and_send',
        description: '用户确认优化后的请求后，使用此工具发送给 AI 模型",
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: '用户 ID' },
            optimized_query: { type: 'string', description: '优化后的请求内容' },
            original_query: { type: 'string', description: '原始请求（备用）' }
          },
          required: ['user_id', 'optimized_query']
        }
      },
      {
        name: 'memory_record_experience',
        description: '记录问题解决经验',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            problem: { type: 'string' },
            attempted_solution: { type: 'string' },
            result: { type: 'string', enum: ['success', 'failure', 'partial'] },
            lesson: { type: 'string' }
          },
          required: ['user_id', 'problem', 'attempted_solution', 'result']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case 'memory_optimize':
        result = await optimizeQuery(args.user_id, args.query);
        break;
      case 'ask_with_memory':
        result = await askWithMemory(args.user_id, args.question, args.auto_send);
        break;
      case 'memory_confirm_and_send':
        result = await confirmAndSend(args);
        break;
      case 'memory_record_experience':
        result = await callMemoryAPI('/memory/add', 'POST', {
          user_id: args.user_id,
          key: `experience:${Date.now()}`,
          value: { problem: args.problem, attempted_solution: args.attempted_solution, result: args.result, lesson: args.lesson },
          type: 'experience'
        });
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

async function optimizeQuery(user_id, query) {
  const searchQueries = [query, query + ' 错误 失败', query + ' 经验'];
  let allHistory = [];
  
  for (const q of searchQueries) {
    try {
      const res = await callMemoryAPI('/memory/search', 'POST', { query: q, limit: 5 });
      if (res.results) allHistory.push(...res.results);
    } catch (e) {}
  }

  const uniqueHistory = [];
  const seen = new Set();
  for (const h of allHistory) {
    const key = h.key || JSON.stringify(h.value);
    if (!seen.has(key)) { seen.add(key); uniqueHistory.push(h.value); }
  }

  const failures = uniqueHistory.filter(h => h.result === 'failure' || h.result === 'error');
  const successes = uniqueHistory.filter(h => h.result === 'success');

  let optimized = query;
  if (uniqueHistory.length > 0) {
    let context = '\n\n📋 历史经验参考:\n';
    
    if (failures.length > 0) {
      context += '\n⚠️ 已失败方案（请避免）:\n';
      failures.slice(0, 3).forEach((f, i) => {
        context += `  ${i + 1}. ${f.problem || f.key} → ${f.attempted_solution} → 失败: ${f.lesson || f.suggestion}\n`;
      });
    }
    
    if (successes.length > 0) {
      context += '\n✅ 成功方案（可参考）:\n';
      successes.slice(0, 2).forEach((s, i) => {
        context += `  ${i + 1}. ${s.problem} → ${s.attempted_solution} → 成功: ${s.lesson}\n`;
      });
    }

    optimized = query + context + '\n请根据以上经验回答，避免重复尝试已知失败的方案。';
  }

  return {
    original_query: query,
    optimized_query: optimized,
    history_count: uniqueHistory.length,
    failures_count: failures.length,
    successes_count: successes.length,
    needs_confirmation: uniqueHistory.length > 0
  };
}

async function askWithMemory(user_id, question, auto_send = false) {
  const optimization = await optimizeQuery(user_id, question);

  if (auto_send || !optimization.needs_confirmation) {
    return {
      action: 'send_to_model',
      query: optimization.optimized_query,
      message: optimization.needs_confirmation 
        ? '已自动发送（无相关历史经验）'
        : '已自动发送'
    };
  }

  return {
    action: 'confirm',
    original_query: question,
    optimized_query: optimization.optimized_query,
    summary: `${optimization.failures_count}个失败经验, ${optimization.successes_count}个成功经验`,
    message: `检测到相关历史经验，是否确认以下优化后的请求？
    
---
原始: ${question}

优化后: ${optimization.optimized_query}
---

请回复"确认"发送优化后的请求，或直接发送原始请求。`
  };
}

async function confirmAndSend(args) {
  return {
    action: 'send_to_model',
    query: args.optimized_query,
    message: '优化后的请求已发送给 AI 模型'
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
