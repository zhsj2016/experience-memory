# Experience Agent

> OpenCode 插件 - 智能经验积累系统

## 功能特性

- **自动捕获** - 对话压缩时自动记录多次尝试的方案
- **自动回忆** - 新会话开始时自动注入相关历史经验
- **失败记录** - 工具执行错误自动记录，避免重复犯错
- **用户偏好** - 记住用户信息（姓名、设备、网络环境等）
- **跨会话记忆** - 无论切换多少个模型，都能记住曾经的弯路
- **智能归纳** - 相似失败经验自动归纳差异

## 快速开始

### 1. 克隆项目后初始化

```bash
# 复制经验数据目录到你的项目
cp -r experience-data/ ./你的项目/

# 启用插件
cd 你的项目
bash experience-data/enable.sh
```

### 2. 配置用户偏好

编辑 `experience-data/user-profile.json`，填入你的真实信息。

### 3. 重启 OpenCode

### 4. 可选：设置凭证（API Keys）

```bash
# 复制凭证模板
cp experience-data/credentials.json.example experience-data/credentials.json

# 编辑并加密
# （功能开发中）
```

## 项目结构

```
你的项目/
├── experience-data/           # 经验数据目录（可见）
│   ├── user-profile.json      # 用户偏好（模板）
│   ├── experience-data.json  # 经验库（自动生成，本地）
│   ├── credentials.json       # 敏感凭证（本地，不提交）
│   ├── credentials.json.example # 凭证模板
│   ├── rollback.sh           # 一键回滚脚本
│   └── enable.sh             # 一键启用脚本
└── experience-agent/          # 插件（全局 ~/.config/opencode/）
```

## 经验结构

| 维度 | 说明 |
|------|------|
| 问题背景 | 问题的环境/上下文 |
| 核心问题 | 问题的本质描述 |
| 失败方案 | 尝试过但失败的方案 |
| 失败原因 | 每个失败方案的原因 |
| 成功方案 | 最终成功的方案 |
| 实用性评分 | 用时/步骤/难度/通用性等 |
| 教训 | 后期参考的要点 |

## 回滚

如遇异常，运行：

```bash
bash experience-data/rollback.sh
```

## License

MIT
