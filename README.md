# Experience Memory 智能记忆系统

> 支持语义搜索、自动学习、智能遗忘的 AI 记忆服务

[![GitHub stars](https://img.shields.io/github/stars/zhsj2016/experience-memory)](https://github.com/zhsj2016/experience-memory)
[![GitHub license](https://img.shields.io/github/license/zhsj2016/experience-memory)](https://github.com/zhsj2016/experience-memory)

## 功能特性

- **语义搜索** - 基于 TF-IDF + Hash 的向量化，支持中文语义匹配
- **自动学习** - 从对话中自动提取用户偏好、习惯等信息
- **智能遗忘** - 动态计算记忆重要性，自动清理低价值记忆
- **重要性评分** - 基于频率、时效性、情感等因素的综合评分
- **向量索引** - 支持相似度检索，快速找到相关记忆
- **MCP 集成** - 支持 Model Context Protocol，可接入 Claude Desktop/OpenClaw
- **请求优化器** - 在请求发往 AI 前自动整合历史经验，避免重复犯错

## 核心功能：请求优化器

> 解决"AI 重复尝试失败方案"的问题

### 工作流程

```
用户发送请求 
    ↓
请求优化器拦截 → 查询历史经验
    ↓
生成优化后的请求（包含失败/成功经验）
    ↓
用户确认 → 发送优化后的请求 OR 用户拒绝 → 发送原始请求
```

### 启动请求优化器

```bash
# 方式1：只启动优化器 UI
npm run start:optimizer

# 方式2：同时启动记忆服务 + 优化器
npm run start:all
```

- 优化器 UI: http://localhost:3001
- 记忆服务 API: http://localhost:3000

### API

```bash
POST /api/optimize
Content-Type: application/json

{
  "query": "帮我修复 React 性能问题"
}
```

返回：
```json
{
  "original_query": "帮我修复 React 性能问题",
  "optimized_query": "帮我修复 React 性能问题\n\n## 历史经验\n\n### 已失败方案(请避免重复尝试)\n1. 问题: React 加载慢\n- 尝试方案: 使用 Redux\n- 失败原因: Redux 对首屏性能帮助不大",
  "history": [...],
  "has_history": true
}
```

## 一键部署 (推荐)

> ⚠️ **注意**：配置完成后需要**重启 Claude Desktop** 才能加载 MCP 工具。

### 方式一：纯部署（仅启动服务）

```bash
./scripts/deploy.sh
```

### 方式二：部署 + 配置 OpenClaw/Claude Desktop

```bash
./scripts/one-click-setup.sh
```

此脚本会：
1. 安装依赖
2. 启动记忆服务 (端口 3000)
3. 自动配置 Claude Desktop MCP 服务器

### 手动启动服务

```bash
# 安装依赖
npm install

# 启动服务 (默认端口 3000)
node index.js

# 自定义端口
PORT=8080 node index.js
```

## OpenClaw/Claude Desktop/Cline 集成

> ⚠️ **注意**：配置完成后需要**重启对应的 AI 助手**才能加载 MCP 工具。

### MCP 工具

配置完成后，可在 Claude Desktop 中使用以下工具：

| 工具 | 说明 |
|-----|------|
| `memory_add` | 添加记忆 |
| `memory_search` | 语义搜索 |
| `memory_list` | 列出用户记忆 |
| `memory_learn` | 从对话学习 |
| `memory_smart_forget` | 智能遗忘低价值记忆 |

### 使用示例

```
用户: 记住我喜欢简洁的回答方式
Claude: [调用 memory_learn]
→ 已学习: 用户偏好简洁回答风格

用户: 我之前说过什么偏好?
Claude: [调用 memory_search]
→ 搜索结果: preference:回答风格 {"tone": "concise"}
```

## API 接口

### 健康检查
```bash
GET /health
```

### 添加记忆
```bash
POST /memory/add
Content-Type: application/json

{
  "user_id": "user1",
  "key": "preference:回答风格",
  "value": {"tone": "concise"},
  "type": "preference"
}
```

### 语义搜索
```bash
POST /memory/search
Content-Type: application/json

{
  "query": "我喜欢简洁的回答",
  "limit": 5
}
```

### 自动学习（从对话提取）
```bash
POST /memory/learn
Content-Type: application/json

{
  "user_id": "user1",
  "messages": [
    {"role": "user", "content": "我喜欢简洁的回答方式"},
    {"role": "assistant", "content": "好的，我会简洁一些"}
  ]
}
```

### 智能遗忘（清理低价值记忆）
```bash
POST /memory/smart-forget
Content-Type: application/json

{
  "user_id": "user1"
}
```

### 获取需复习的记忆
```bash
GET /memory/review?user_id=user1
```

### 重要性反馈
```bash
POST /memory/importance
Content-Type: application/json

{
  "memory_id": "xxx",
  "positive": true
}
```

## 项目结构

```
experience/
├── index.js              # HTTP 服务入口
├── src/
│   ├── MemoryStore.js    # 核心记忆存储
│   ├── semantic.js       # 向量化/搜索模块
│   └── mcp-server.js     # MCP 服务器 (OpenClaw集成)
├── scripts/
│   ├── deploy.sh         # 一键部署脚本
│   ├── setup-openclaw.sh # OpenClaw 配置脚本
│   └── one-click-setup.sh # 一键部署+配置
├── data/                 # 数据存储目录
└── package.json
```

## 配置说明

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| PORT | 3000 | 服务端口 |
| MEMORY_API_URL | http://localhost:3000 | MCP 服务器连接地址 |

## 扩展指南

### 接入真正的中文 Embedding

当前使用本地 TF-IDF 向量化，如需更强的语义理解能力，可集成：

1. **BGE 模型** (推荐)
```bash
npm install @xenova/transformers
```

2. **修改 semantic.js** 中的 EmbeddingService 使用 BGE 模型

### 接入向量数据库

当前使用本地 JSON 存储，生产环境可接入：

- **Chroma** - 轻量级向量数据库
- **Qdrant** - 高性能向量搜索引掣
- **Milvus** - 分布式向量数据库

## License

MIT
