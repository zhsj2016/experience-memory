# Experience Memory - 智能请求拦截器

> 让 AI 不再重复犯错，每次请求前自动查询历史经验

## 核心功能

**ask_with_memory** - 智能提问工具

```
用户提问 → 查询历史经验 → 生成优化请求 → 用户确认 → 发送给 AI
```

## 使用方式

### 1. 配置系统提示词

在 OpenClaw 智能体配置中添加：

```
## 请求拦截规则

用户向你提问时，你**必须**使用 `ask_with_memory` 工具来响应，**禁止**直接回答。

工作流程：
1. 收到用户问题
2. 调用 ask_with_memory({ user_id: "xxx", question: "用户问题" })
3. 如果返回 action === "confirm"，展示优化后的请求，询问用户确认
4. 用户确认后，调用 memory_confirm_and_send 发送
5. 用户否定后，直接发送原始请求给模型

## 工具列表

| 工具 | 用途 |
|-----|------|
| ask_with_memory | 智能提问（查询经验+用户确认） |
| memory_confirm_and_send | 确认后发送 |
| memory_record_experience | 记录解决经验 |
```

### 2. 对话示例

```
用户: 帮我修复 React 性能问题

AI: [调用 ask_with_memory]
返回:
{
  "action": "confirm",
  "optimized_query": "帮我修复 React 性能问题\n\n📋 历史经验参考:\n⚠️ 已失败方案:\n1. React加载慢 → 使用Redux → 失败: 对首屏无帮助",
  "message": "检测到相关经验，是否确认..."
}

AI: "检测到相关历史经验：

⚠️ 你之前尝试用 Redux 解决加载慢问题但失败了。

是否确认以下优化后的请求？
---
原始: 帮我修复 React 性能问题

优化后: 帮我修复 React 性能问题

📋 历史经验参考:
⚠️ 已失败方案:
1. React加载慢 → 使用Redux → 失败

请回复"确认"发送优化后的请求，或直接发送原始请求。"

用户: 确认

AI: [调用 memory_confirm_and_send]
→ 发送优化后的请求给模型
→ 模型回复
```

## MCP 工具详情

### ask_with_memory

```javascript
{
  tool: 'ask_with_memory',
  args: {
    user_id: 'user1',
    question: '用户的问题'
  }
}
```

返回：
```javascript
// 需要确认
{
  action: 'confirm',
  original_query: '...',
  optimized_query: '... + 历史经验',
  message: '检测到相关经验，是否确认...'
}

// 自动发送（无历史经验）
{
  action: 'send_to_model', 
  query: '优化后的请求'
}
```

### memory_confirm_and_send

用户确认后调用：
```javascript
{
  tool: 'memory_confirm_and_send',
  args: {
    user_id: 'user1',
    optimized_query: '优化后的完整请求'
  }
}
```

### memory_record_experience

问题解决后记录：
```javascript
{
  tool: 'memory_record_experience', 
  args: {
    user_id: 'user1',
    problem: '原始问题',
    attempted_solution: '尝试的方案',
    result: 'success/failure',
    lesson: '学到的教训'
  }
}
```

## 自动记录经验

在系统提示词中添加：

```
## 经验记录规则

无论问题是否成功解决，你都必须调用 memory_record_experience 记录：
- problem: 原始问题
- attempted_solution: 尝试的方案
- result: success / failure
- lesson: 学到的教训

这样下次遇到类似问题，系统会自动避开失败的方案。
```

## 启动服务

```bash
# 确保记忆服务运行中
node index.js &

# 重启 OpenClaw 加载新 MCP
openclaw-cn gateway restart
```
