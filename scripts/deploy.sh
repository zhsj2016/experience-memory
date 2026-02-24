#!/bin/bash

set -e

echo "=========================================="
echo "  Experience Memory - 一键部署脚本"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "[1/5] 检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi
echo "✅ Node.js 版本: $(node --version)"

echo ""
echo "[2/5] 安装项目依赖..."
npm install

echo ""
echo "[3/5] 创建数据目录..."
mkdir -p data

echo ""
echo "[4/5] 启动记忆服务 (端口 3000)..."
echo "    - 服务将在后台运行"
echo "    - 按 Ctrl+C 停止服务"
echo ""

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
echo ""
echo "=========================================="
echo "  记忆服务运行中"
echo "=========================================="
echo ""
echo "  API 端点:"
echo "    - 健康检查: http://localhost:3000/health"
echo "    - 添加记忆: POST http://localhost:3000/memory/add"
echo "    - 语义搜索: POST http://localhost:3000/memory/search"
echo "    - 自动学习: POST http://localhost:3000/memory/learn"
echo "    - 智能遗忘: POST http://localhost:3000/memory/smart-forget"
echo ""

# 等待用户中断
wait $SERVER_PID
