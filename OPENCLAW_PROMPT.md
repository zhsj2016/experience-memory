# Experience Memory - OpenClaw 集成指南

> 智能经验记忆系统 - 让 AI 不再重复犯错

## 核心问题

你描述的问题正是 Experience Memory 要解决的：

> 模型给出方案A → 失败 → 方案B → 成功
> 但方案A的残留没有清理
> 下次问同样的问题，模型还是先尝试方案A

## 解决方案

### 1. 自动记录所有尝试（无论成功或失败）

**遇到错误时**：立即记录
```javascript
memory_record_error({
  user_id: "xxx",
  error_type: "syntax_error",          // 错误类型
  error_message: "Unexpected token",    // 错误信息
  attempted_approach: "使用正则表达式解析", // 失败的方案
  suggestion: "改用专门的解析库"          // 改进建议
})
```

**问题解决后**：记录完整经验
```javascript
memory_record_experience({
  user_id: "xxx",
  problem: "解析用户输入的表达式",
  attempted_solution: "方案A: 使用正则表达式",
  result: "failure",                    // 失败！
  lesson: "正则无法处理嵌套表达式，改用AST解析器",
  context: "项目环境: Node.js + JavaScript"
})
```

### 2. 解决问题前必须查询历史

**在给出任何方案前**，先调用：
```javascript
memory_get_lessons({
  user_id: "xxx",
  topic: "解析表达式",  // 当前问题关键词
  limit: 5
})
```

如果返回结果中有 `result: "failure` 的记录，**必须避免**使用相同的方案。

---

## 系统级指令（添加到你的智能体配置）

```
## 经验记忆系统规则（必须遵守）

你有一个智能经验记忆系统。在解决问题时，你必须遵守以下规则：

### 黄金法则：在给出任何方案前，必须先查询历史教训

在思考解决方案之前，你必须先调用 `memory_get_lessons` 查询相关问题的历史经验。
如果历史中有失败的尝试记录，你必须明确告诉用户："根据历史经验，方案X已经尝试过并失败，原因 是Y，建议使用方案Z"。

### 规则1：记录所有尝试

- 任何方案尝试后，无论成功还是失败，都必须记录
- 失败记录使用 `memory_record_error`
- 成功记录使用 `memory_record_experience`（包含 result: "success"）

### 规则2：清理失败方案的残留

当一个方案失败后，在尝试新方案之前，你必须：
1. 列出失败方案创建的所有文件/配置
2. 主动删除这些残留（使用 shell 命令清理）
3. 然后再尝试新方案

### 规则3：诚实报告历史

当查询到历史经验时，你必须：
- 明确告知用户这个方案之前尝试过
- 解释为什么失败
- 建议不同的方案

## 工具列表

| 工具 | 用途 | 调用时机 |
|-----|------|---------|
| `memory_get_lessons` | 查询历史经验教训 | **在给出任何方案前必须调用** |
| `memory_record_error` | 记录失败的尝试 | 任何错误或失败后 |
| `memory_record_experience` | 记录成功经验 | 问题完全解决后 |
| `memory_search` | 语义搜索记忆 | 需要时 |
```

---

## 实际工作流示例

### 场景：用户要求解决一个 React 性能问题

```
用户: 我的 React 应用加载很慢

[调用 memory_get_lessons]
返回: [
  {
    key: "experience:...,
    value: {
      problem: "React 应用加载慢",
      attempted_solution: "使用 Redux",
      result: "failure",
      lesson: "Redux 对首屏性能帮助不大，改用代码分割"
    }
  }
]

你的回应:
> 根据历史经验，我之前尝试过使用 Redux 来解决加载慢问题，但失败了（Redux 对首屏性能帮助不大）。这次我会尝试不同的方案：
> 1. 代码分割 (code splitting)
> 2. 懒加载组件
> 3. 优化 bundle 大小

[开始尝试方案1：代码分割]
如果失败 → 调用 memory_record_error
如果成功 → 调用 memory_record_experience(result: "success")，并清理 Redux 相关文件
```

---

## 配置方法

### 方法1：添加到智能体配置

将上面的"系统级指令"内容复制到你的 OpenClaw 智能体配置文件的 `description` 或 `prompt` 字段中。

### 方法2：添加到 BOOTSTRAP.md

在项目根目录创建或编辑 `BOOTSTRAP.md`，在开头加入上述指令。

### 方法3：使用 system_prompt 工具

如果你的智能体支持动态 system prompt，可以在每次会话开始时注入上述指令。

---

## 预期效果

实施后，你的 AI 将会：

1. ✅ **不再重复犯错** - 方案失败过？下次直接跳过
2. ✅ **自动清理残留** - 失败方案的文件会被主动删除
3. ✅ **节省 Token** - 不再重复尝试已知失败的方案
4. ✅ **积累知识** - 每次失败都是学习机会

---

## 测试一下

你可以用以下方式测试：

```
用户: 我想实现文件上传功能

AI: [自动查询历史]
→ 返回: 之前尝试过方案X并失败
→ 回应: "根据历史经验，方案X已经失败过，因为..."
→ 给出新方案Y
→ 尝试Y → 成功 → 记录经验
→ 清理X的残留文件
```
