# 隐私口令设置

本项目包含加密的敏感凭证文件。

## 设置步骤

1. 复制模板文件：
```bash
cp experience-data/credentials.json.example experience-data/credentials.json
```

2. 编辑 credentials.json，填入你的真实信息

3. 运行加密脚本：
```bash
node ../.config/opencode/experience-agent/encrypt-credentials.js
```

## 凭证说明

| 字段 | 说明 |
|------|------|
| github | GitHub Personal Access Token |
| deepseek | DeepSeek API Key |
| minimax | MiniMax API Key |
| feishu.app_id | 飞书应用 ID |
| feishu.secret | 飞书应用密钥 |
| proxy.host | 代理主机 |
| proxy.port | 代理端口 |

## 注意

- credentials.json 已在 .gitignore 中，不会提交到 GitHub
- 每次修改凭证后需要重新加密
