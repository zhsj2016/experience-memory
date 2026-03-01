#!/bin/bash
# ============================================
# 全局安装脚本 - 将插件安装到 OpenCode 全局目录
# 安装后可在所有项目中使用本插件
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCODE_DIR="$HOME/.config/opencode"
PLUGIN_DIR="$OPENCODE_DIR/experience-agent"
PLUGIN_SOURCE="$PROJECT_DIR/.opencode"

echo -e "${BLUE}=== Experience Agent 全局安装 ===${NC}"
echo "项目: $PROJECT_DIR"
echo "目标: $PLUGIN_DIR"
echo ""

# 1. 创建全局插件目录
if [ ! -d "$PLUGIN_DIR" ]; then
    mkdir -p "$PLUGIN_DIR"
    echo -e "${GREEN}✓ 创建全局插件目录${NC}"
fi

# 2. 使用符号链接方式链接插件
echo -e "${YELLOW}→ 创建符号链接...${NC}"

# 链接 plugins 目录
ln -sf "$PLUGIN_SOURCE/plugins" "$PLUGIN_DIR/plugins"

# 链接 package.json（用于依赖管理）
ln -sf "$PLUGIN_SOURCE/package.json" "$PLUGIN_DIR/package.json"

# 链接 .gitignore
ln -sf "$PLUGIN_SOURCE/.gitignore" "$PLUGIN_DIR/.gitignore"

echo -e "${GREEN}✓ 符号链接创建完成${NC}"

# 3. 安装全局依赖
echo -e "${BLUE}--- 安装全局依赖 ---${NC}"
cd "$PLUGIN_DIR"
if command -v bun &> /dev/null; then
    bun install
elif command -v npm &> /dev/null; then
    npm install
elif command -v yarn &> /dev/null; then
    yarn install
else
    echo -e "${YELLOW}! 未检测到 bun/npm/yarn，请手动安装依赖${NC}"
fi
echo -e "${GREEN}✓ 全局依赖已安装${NC}"
cd "$PROJECT_DIR"

# 4. 创建/更新全局配置文件
CONFIG_JSON="$PLUGIN_DIR/config.json"
if [ ! -f "$CONFIG_JSON" ]; then
    cat > "$CONFIG_JSON" << 'EOF'
{
  "enabled": true,
  "dataDir": "experience-data"
}
EOF
    echo -e "${GREEN}✓ 创建配置文件${NC}"
fi

# 5. 添加插件到 OpenCode 全局配置
CONFIG_FILE="$OPENCODE_DIR/opencode.json"
if [ -f "$CONFIG_FILE" ]; then
    if ! grep -q '"experience-agent"' "$CONFIG_FILE"; then
        node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf-8'));
        if (!config.plugin) config.plugin = [];
        if (!config.plugin.includes('experience-agent')) {
            config.plugin.push('experience-agent');
        }
        fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
        "
        echo -e "${GREEN}✓ 已添加插件到 OpenCode 全局配置${NC}"
    else
        echo -e "${YELLOW}! 插件已在全局配置中${NC}"
    fi
else
    # 创建新的全局配置
    mkdir -p "$OPENCODE_DIR"
    cat > "$CONFIG_FILE" << 'EOF'
{
  "plugin": ["experience-agent"]
}
EOF
    echo -e "${GREEN}✓ 创建全局配置并添加插件${NC}"
fi

echo ""
echo -e "${GREEN}=== 全局安装完成 ===${NC}"
echo ""
echo "注意："
echo "  - 插件使用符号链接，项目更新后全局自动同步"
echo "  - 每个使用插件的项目需在项目目录下创建 experience-data/ 目录"
echo "  - 重启 OpenCode 使配置生效"
echo ""
