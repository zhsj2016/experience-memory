#!/usr/bin/env node

const http = require('http');
const path = require('path');
const MemoryStore = require('./src/MemoryStore');

const MEMORY_API_PORT = process.env.MEMORY_API_PORT || 3000;
const UI_PORT = process.env.UI_PORT || 3001;

const memoryStore = new MemoryStore({
  path: path.resolve(__dirname, 'data/memory-store.json'),
  disableVector: false,
  similarityThreshold: 0.1
});

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Experience Memory - 请求优化器</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 20px; }
    .card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    textarea { width: 100%; height: 100px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical; font-family: inherit; }
    button { padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; margin-right: 10px; }
    .btn-primary { background: #007AFF; color: white; }
    .btn-primary:hover { background: #0056b3; }
    .btn-success { background: #28a745; color: white; }
    .btn-success:hover { background: #218838; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-danger:hover { background: #c82333; }
    .btn-secondary { background: #6c757d; color: white; }
    .hidden { display: none; }
    .history-item { border-left: 3px solid #dc3545; padding: 12px; margin-bottom: 12px; background: #fff5f5; border-radius: 0 8px 8px 0; }
    .history-item.success { border-color: #28a745; background: #f0fff4; }
    .history-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .history-content { font-size: 14px; color: #333; }
    .result-area { background: #f8f9fa; padding: 16px; border-radius: 8px; white-space: pre-wrap; word-break: break-all; font-size: 14px; line-height: 1.6; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .comparison h3 { margin-bottom: 12px; font-size: 14px; color: #666; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .badge-failure { background: #f8d7da; color: #721c24; }
    .badge-success { background: #d4edda; color: #155724; }
    @media (max-width: 600px) { .comparison { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Experience Memory 请求优化器</h1>
    <p style="color:#666;margin-bottom:20px;">输入你的请求，系统会自动查询历史经验，帮你优化问题描述</p>
    
    <div class="card">
      <div id="status"></div>
      <textarea id="userInput" placeholder="输入你的请求... (例如: 帮我修复 React 组件的性能问题)"></textarea>
      <div style="margin-top: 16px;">
        <button class="btn-primary" onclick="optimizeRequest()">分析并优化请求</button>
      </div>
    </div>

    <div id="resultSection" class="hidden">
      <div class="comparison">
        <div class="card">
          <h3>原始请求</h3>
          <div id="originalRequest" class="result-area"></div>
        </div>
        <div class="card">
          <h3>优化后请求 <span id="historyBadge" class="badge badge-success">已整合历史经验</span></h3>
          <div id="optimizedRequest" class="result-area" style="background:#e8f5e9;"></div>
        </div>
      </div>
      
      <div class="card">
        <h3>相关历史经验</h3>
        <div id="historySection"></div>
      </div>

      <div style="text-align:center;padding:20px;">
        <button class="btn-success" onclick="confirmSend()">确认发送优化后的请求</button>
        <button class="btn-danger" onclick="sendOriginal()">发送原始请求</button>
        <button class="btn-secondary" onclick="reset()">重新输入</button>
      </div>
    </div>

    <div id="responseSection" class="card hidden">
      <h3>模型回复</h3>
      <div id="modelResponse" class="result-area"></div>
    </div>
  </div>

  <script>
    let optimizedData = null;
    let originalRequest = '';

    function showStatus(msg, type) {
      const el = document.getElementById('status');
      if (!msg) { el.className = 'hidden'; return; }
      el.textContent = msg;
      el.style.cssText = 'padding:12px;border-radius:8px;margin-bottom:16px;background:' + 
        (type === 'loading' ? '#fff3cd;color:#856404' : 
         type === 'success' ? '#d4edda;color:#155724' : 
         type === 'error' ? '#f8d7da;color:#721c24' : '#e2e3e5;color:#383d41');
    }

    async function optimizeRequest() {
      const input = document.getElementById('userInput').value.trim();
      if (!input) return;

      originalRequest = input;
      showStatus('正在分析历史经验...', 'loading');
      document.getElementById('resultSection').classList.add('hidden');
      document.getElementById('responseSection').classList.add('hidden');

      try {
        const res = await fetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: input })
        });
        const data = await res.json();
        
        optimizedData = data;
        
        document.getElementById('originalRequest').textContent = data.original_query;
        document.getElementById('optimizedRequest').textContent = data.optimized_query;
        
        const badge = document.getElementById('historyBadge');
        if (data.has_history) {
          badge.textContent = '已整合 ' + data.history.length + ' 条经验';
          badge.className = 'badge badge-failure';
        } else {
          badge.textContent = '暂无历史经验';
          badge.className = 'badge';
        }
        
        const historyHtml = data.history.length ? data.history.map(h => 
          '<div class="history-item ' + (h.result === 'success' ? 'success' : '') + '">' +
            '<div class="history-label">问题</div>' +
            '<div class="history-content">' + (h.problem || h.key || '') + '</div>' +
            '<div class="history-label" style="margin-top:8px">尝试方案</div>' +
            '<div class="history-content">' + (h.attempted_solution || h.attempted_approach || '') + '</div>' +
            '<div class="history-label" style="margin-top:8px">结果</div>' +
            '<div class="history-content"><span class="badge ' + (h.result === 'success' ? 'badge-success' : 'badge-failure') + '">' + (h.result || '') + '</span> ' + (h.lesson || h.suggestion || '') + '</div>' +
          '</div>'
        ).join('') : '<p style="color:#666;">暂无相关历史经验</p>';
        
        document.getElementById('historySection').innerHTML = historyHtml;
        
        showStatus('已找到相关经验，请确认', 'success');
        document.getElementById('resultSection').classList.remove('hidden');
      } catch (e) {
        showStatus('错误: ' + e.message, 'error');
      }
    }

    async function confirmSend() {
      if (!optimizedData) return;
      
      const response = '优化后的请求:\\n' + optimizedData.optimized_query + '\\n\\n[此处会调用 OpenClaw/Claude API 处理]';
      
      document.getElementById('modelResponse').textContent = response;
      document.getElementById('responseSection').classList.remove('hidden');
    }

    async function sendOriginal() {
      const response = '原始请求:\\n' + originalRequest + '\\n\\n[此处会调用 OpenClaw/Claude API 处理]';
      
      document.getElementById('modelResponse').textContent = response;
      document.getElementById('responseSection').classList.remove('hidden');
    }

    function reset() {
      document.getElementById('userInput').value = '';
      document.getElementById('resultSection').classList.add('hidden');
      document.getElementById('responseSection').classList.add('hidden');
      showStatus('', '');
      optimizedData = null;
      originalRequest = '';
    }
  </script>
</body>
</html>`;

async function semanticSearchMemories(query, limit = 5) {
  return await memoryStore.semanticSearchMemories(query, { limit });
}

function buildOptimizedQuery(originalQuery, history) {
  if (!history || history.length === 0) {
    return originalQuery;
  }

  let context = '\n## 历史经验\n';
  
  const failures = history.filter(h => h.result === 'failure' || h.result === 'error');
  const successes = history.filter(h => h.result === 'success');

  if (failures.length > 0) {
    context += '\n### 已失败方案(请避免重复尝试)\n';
    failures.forEach((f, i) => {
      context += `\n${i + 1}. 问题: ${f.problem || f.key || ''}
- 尝试方案: ${f.attempted_solution || f.attempted_approach || ''}
- 失败原因: ${f.lesson || f.suggestion || '未知'}
`;
    });
  }

  if (successes.length > 0) {
    context += '\n### 成功方案(可参考)\n';
    successes.forEach((s, i) => {
      context += `\n${i + 1}. 问题: ${s.problem || s.key || ''}
- 成功方案: ${s.attempted_solution || ''}
- 经验: ${s.lesson || ''}
`;
    });
  }

  return `${originalQuery}${context}\n\n请根据以上历史经验回答，避免重复尝试已知失败的方案，并在成功后清理残留文件。`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${UI_PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (pathname === '/api/optimize' && req.method === 'POST') {
    let body = await new Promise(r => {
      let data = '';
      req.on('data', c => data += c);
      req.on('end', () => r(data));
    });
    
    const { query } = JSON.parse(body);
    
    const searchQueries = [query, query + ' 错误 失败', query + ' 经验 教训'];
    
    let allHistory = [];
    for (const q of searchQueries) {
      try {
        const results = await semanticSearchMemories(q, 5);
        allHistory.push(...results);
      } catch (e) {
        console.error('Search error:', e);
      }
    }
    
    const uniqueHistory = [];
    const seen = new Set();
    for (const h of allHistory) {
      const key = h.key || JSON.stringify(h.value);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueHistory.push(h.value);
      }
    }

    const optimized_query = buildOptimizedQuery(query, uniqueHistory.slice(0, 5));

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      original_query: query,
      optimized_query,
      history: uniqueHistory.slice(0, 5),
      has_history: uniqueHistory.length > 0
    }));
    return;
  }

  if (pathname === '/api/history' && req.method === 'GET') {
    const user_id = url.searchParams.get('user_id') || 'default-user';
    const memories = memoryStore.listMemories(user_id);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(memories));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(UI_PORT, () => {
  console.log(`🎨 Experience Memory 请求优化器`);
  console.log(`   UI: http://localhost:${UI_PORT}`);
  console.log(`   API: http://localhost:${UI_PORT}/api/optimize`);
  console.log(`   记忆服务: http://localhost:${MEMORY_API_PORT}`);
});
