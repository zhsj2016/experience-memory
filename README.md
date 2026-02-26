# Experience Agent

> OpenCode 插件 - 智能经验积累系统

## 功能特性

- **自动捕获** - 对话压缩时自动记录多次尝试的方案
- **自动回忆** - 新会话开始时自动注入相关历史经验
- **失败记录** - 工具执行错误自动记录，避免重复犯错
- **用户偏好** - 记住用户信息（姓名、设备、网络环境等）
- **跨会话记忆** - 无论切换多少个模型，都能记住曾经的弯路

## 快速开始

### 1. 初始化项目

```bash
# 复制经验数据目录到你的项目
cp -r /path/to/Experience/experience-data/ ./你的项目/

# 启用插件
cd 你的项目
bash experience-data/enable.sh
```

### 2. 配置用户偏好

编辑 `experience-data/user-profile.json` 添加你的信息。

### 3. 重启 OpenCode

## 项目结构

```
你的项目/
├── experience-data/           # 经验数据目录（可见）
│   ├── user-profile.json      # 用户偏好
│   ├── experience-data.json   # 经验库（自动生成）
│   ├── rollback.sh            # 一键回滚脚本
│   └── enable.sh              # 一键启用脚本
└── experience-agent/          # 插件（全局 ~/.config/opencode/）
```

## 工作原理

1. **session.compacted** - 对话被压缩时，记录多次尝试的方案
2. **session.created** - 新会话开始时，检索并注入相关经验
3. **tool.execute.after** - 工具执行报错时，自动记录失败经验
4. 用户偏好会在每次新会话时自动注入上下文

## 回滚

如遇异常，运行：

```bash
bash experience-data/rollback.sh
```

## License

MIT
