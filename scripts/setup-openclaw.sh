#!/bin/bash

set -e

echo "=========================================="
echo "  Experience Memory - OpenClaw 配置脚本"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# 自动检测项目路径
MCP_SERVER_PATH="$PROJECT_DIR/src/mcp-server.js"
MEMORY_API_URL="http://localhost:3000"

echo ""
echo "[1/4] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "❌ 依赖未安装，请先运行 deploy.sh"
    exit 1
fi

# 检查 @modelcontextprotocol/sdk
if [ ! -d "node_modules/@modelcontextprotocol/sdk" ]; then
    echo "📦 安装 MCP SDK..."
    npm install @modelcontextprotocol/sdk
fi

echo "✅ 依赖检查完成"

echo ""
echo "[2/4] 创建 MCP 配置文件..."

# Claude Desktop 配置路径
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

# 创建目录
mkdir -p "$CLAUDE_CONFIG_DIR"

# 创建 MCP 配置
cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "experience-memory": {
      "command": "node",
      "args": [
        "$MCP_SERVER_PATH"
      ],
      "env": {
        "MEMORY_API_URL": "$MEMORY_API_URL"
      }
    }
  }
}
EOF

echo "✅ MCP 配置已创建: $CLAUDE_CONFIG_FILE"

echo ""
echo "[3/4] 启动记忆服务..."
# 检查端口是否已被占用
if lsof -i :3000 &> /dev/null; then
    echo "⚠️  端口 3000 已被占用，跳过启动"
else
    node index.js &
    echo "✅ 记忆服务已启动 (PID: $!)"
fi

echo ""
echo "[4/4] 验证 Claude Desktop 配置..."
echo ""
echo "请重启 Claude Desktop 以加载 MCP 服务器"
echo ""
echo "=========================================="
echo "  配置完成！"
echo "=========================================="
echo ""
echo "可用的 MCP 工具:"
echo "  - memory_add: 添加记忆"
echo "  - memory_search: 语义搜索"
echo "  - memory_list: 列出记忆"
echo "  - memory_learn: 从对话学习"
echo "  - memory_smart_forget: 智能遗忘"
echo ""
