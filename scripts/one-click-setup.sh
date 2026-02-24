#!/bin/bash

set -e

echo "=========================================="
echo "  Experience Memory - 一键部署与 MCP 配置"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 自动检测项目路径
MCP_SERVER_PATH="$PROJECT_DIR/src/mcp-server.js"
MEMORY_API_URL="http://localhost:3000"

echo ""
echo "[1/7] 检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi
echo "✅ Node.js 版本: $(node --version)"

echo ""
echo "[2/7] 安装项目依赖..."
npm install

# 安装 MCP SDK
echo ""
echo "[3/7] 安装 MCP SDK..."
npm install @modelcontextprotocol/sdk

echo ""
echo "[4/7] 创建数据目录..."
mkdir -p data

echo ""
echo "[5/7] 启动记忆服务 (端口 3000)..."
# 检查端口是否已被占用
if lsof -i :3000 &> /dev/null; then
    echo "⚠️  端口 3000 已被占用，尝试停止现有进程..."
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# 启动服务
node index.js &
SERVER_PID=$!
echo "✅ 服务已启动 (PID: $SERVER_PID)"

# 等待服务启动
sleep 2

# 验证服务是否启动
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "❌ 服务启动失败"
    exit 1
fi
echo "✅ 服务健康检查通过"

echo ""
echo "[6/7] 配置 MCP 服务器..."

# 支持多种客户端配置
CLAUDE_CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
OPENCLAW_CONFIG_FILE="$HOME/.openclaw/mcp.json"

# 配置 Claude Desktop
if [ -d "$HOME/Library/Application Support/Claude" ]; then
    mkdir -p "$HOME/Library/Application Support/Claude"
    if [ -f "$CLAUDE_CONFIG_FILE" ]; then
        node -e "
const fs = require('fs');
let config = {};
try { config = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG_FILE', 'utf8')); } catch (e) {}
if (!config.mcpServers) config.mcpServers = {};
config.mcpServers['experience-memory'] = {
    command: 'node',
    args: ['$MCP_SERVER_PATH'],
    env: { 'MEMORY_API_URL': '$MEMORY_API_URL' }
};
fs.writeFileSync('$CLAUDE_CONFIG_FILE', JSON.stringify(config, null, 2));
"
        echo "✅ Claude Desktop MCP 配置已更新"
    else
        cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "experience-memory": {
      "command": "node",
      "args": ["$MCP_SERVER_PATH"],
      "env": { "MEMORY_API_URL": "$MEMORY_API_URL" }
    }
  }
}
EOF
        echo "✅ Claude Desktop MCP 配置已创建"
    fi
fi

# 配置 OpenClaw
if [ -d "$HOME/.openclaw" ]; then
    mkdir -p "$HOME/.openclaw"
    if [ -f "$OPENCLAW_CONFIG_FILE" ]; then
        node -e "
const fs = require('fs');
let config = {};
try { config = JSON.parse(fs.readFileSync('$OPENCLAW_CONFIG_FILE', 'utf8')); } catch (e) { config = []; }
if (!Array.isArray(config)) config = [];
config.push({
    name: 'experience-memory',
    command: 'node',
    args: ['$MCP_SERVER_PATH'],
    env: { 'MEMORY_API_URL': '$MEMORY_API_URL' }
});
fs.writeFileSync('$OPENCLAW_CONFIG_FILE', JSON.stringify(config, null, 2));
"
        echo "✅ OpenClaw MCP 配置已更新"
    else
        cat > "$OPENCLAW_CONFIG_FILE" << EOF
[
  {
    "name": "experience-memory",
    "command": "node",
    "args": ["$MCP_SERVER_PATH"],
    "env": { "MEMORY_API_URL": "$MEMORY_API_URL" }
  }
]
EOF
        echo "✅ OpenClaw MCP 配置已创建"
    fi
fi

# 提示用户配置其他客户端
echo ""
echo "ℹ️  如果使用其他 MCP 客户端 (如 Cline, Cursor)，请手动添加以下配置:"
echo "    command: node"
echo "    args: $MCP_SERVER_PATH"
echo "    env: MEMORY_API_URL=$MEMORY_API_URL"

echo ""
echo "[7/7] 完成！"
echo ""
echo "=========================================="
echo "  部署与配置完成！"
echo "=========================================="
echo ""
echo "  记忆服务:"
echo "    - API 地址: http://localhost:3000"
echo "    - 健康检查: http://localhost:3000/health"
echo ""
echo "  MCP 工具 (Claude Desktop):"
echo "    - memory_add: 添加记忆"
echo "    - memory_search: 语义搜索"
echo "    - memory_list: 列出记忆"
echo "    - memory_learn: 从对话学习"
echo "    - memory_smart_forget: 智能遗忘"
echo ""
echo "  下一步:"
echo "    1. 重启你的 AI 助手 (Claude Desktop/OpenClaw/Cline等)"
echo "    2. 在对话中使用 MCP 工具管理记忆"
echo ""
echo "  停止服务: lsof -ti :3000 | xargs kill"
echo ""
