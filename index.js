#!/usr/bin/env node
const http = require('http');
const path = require('path');
const MemoryStore = require('./src/MemoryStore');

const PORT = process.env.PORT || 3000;

const memoryStore = new MemoryStore({
  path: path.resolve(__dirname, 'data/memory-store.json'),
  disableVector: false,
  similarityThreshold: 0.1
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const send = (code, data) => { res.writeHead(code); res.end(JSON.stringify(data)); };

  try {
    let body = '';
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      body = await new Promise(r => { req.on('data', c => r(c)); req.on('end', () => r('')); });
    }
    const data = body ? JSON.parse(body) : {};

    if (pathname === '/health' && method === 'GET') {
      send(200, { status: 'ok', time: new Date().toISOString() });
      return;
    }

    if (pathname === '/memory/add' && method === 'POST') {
      const result = memoryStore.addMemory({ ...data, created_at: new Date().toISOString(), active: true });
      send(200, { success: true, id: result.id, memory: result });
      return;
    }

    if (pathname === '/memory/add-vector' && method === 'POST') {
      const result = await memoryStore.addMemoryWithVector({ ...data, created_at: new Date().toISOString(), active: true });
      send(200, { success: true, id: result.id, memory: result });
      return;
    }

    if (pathname === '/memory/list' && method === 'GET') {
      const user_id = url.searchParams.get('user_id') || 'default-user';
      send(200, memoryStore.listMemories(user_id));
      return;
    }

    if (pathname === '/memory/search' && method === 'POST') {
      const results = await memoryStore.semanticSearchMemories(data.query || '', { limit: data.limit || 5 });
      send(200, { results });
      return;
    }

    if (pathname === '/memory/learn' && method === 'POST') {
      const learned = await memoryStore.autoLearnFromConversation(data.messages || [], { userId: data.user_id || 'default-user' });
      send(200, { success: true, learned: learned.length, memories: learned });
      return;
    }

    if (pathname === '/memory/smart-forget' && method === 'POST') {
      const result = memoryStore.smartForget({ userId: data.user_id });
      send(200, { success: true, ...result });
      return;
    }

    if (pathname === '/memory/review' && method === 'GET') {
      const user_id = url.searchParams.get('user_id') || 'default-user';
      send(200, memoryStore.getMemoriesToReview(user_id));
      return;
    }

    if (pathname === '/memory/purge' && method === 'POST') {
      send(200, { success: true, purged: memoryStore.purgeExpired() });
      return;
    }

    if (pathname === '/memory/consolidate' && method === 'POST') {
      const result = memoryStore.consolidateMemories(data.user_id, data.key);
      send(200, { success: true, ...result });
      return;
    }

    if (pathname === '/query' && method === 'POST') {
      const { question, user_id = 'default-user', messages } = data;
      
      // 自动学习：如果传入了对话历史，自动提取记忆
      let learned = [];
      if (messages && messages.length > 0) {
        try {
          learned = await memoryStore.autoLearnFromConversation(messages, { userId: user_id });
        } catch (e) {
          console.error('Auto-learn error:', e.message);
        }
      }
      
      // 搜索相关记忆
      const memories = memoryStore.getMemoriesForUser(user_id, { activeOnly: true });
      
      // 语义搜索更相关的记忆
      let semanticMemories = [];
      if (question) {
        try {
          semanticMemories = await memoryStore.semanticSearchMemories(question, { limit: 3 });
        } catch (e) {
          console.error('Semantic search error:', e.message);
        }
      }
      
      const allMemories = [...semanticMemories, ...memories];
      const hints = allMemories.map(m => `${m.key}: ${JSON.stringify(m.value)}`).join('; ');
      
      const answer = allMemories.length > 0 
        ? `根据您的偏好：${hints}\n\n${question}` 
        : `关于"${question}"：暂无相关记忆，请提供更多信息。`;
      
      send(200, { 
        answer, 
        hints, 
        memories: allMemories.length,
        learned: learned.length,
        learned_memories: learned
      });
      return;
    }

    send(404, { error: 'Not Found', path: pathname, method });
  } catch (e) {
    console.error('Error:', e.message);
    send(500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`Memory Server running on http://localhost:${PORT}`);
  console.log(`Endpoints: /health, /query, /memory/add, /memory/add-vector, /memory/list, /memory/search, /memory/learn, /memory/smart-forget, /memory/review, /memory/purge, /memory/consolidate`);
});
