#!/bin/bash
# ============================================
# 一键启用脚本 - 在当前项目启用经验积累
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCODE_DIR="$HOME/.config/opencode"
PLUGIN_DIR="$OPENCODE_DIR/experience-agent"

echo -e "${YELLOW}=== Experience Agent 启用 ===${NC}"
echo "项目: $PROJECT_DIR"
echo ""

# 1. 检查插件是否存在
if [ ! -d "$PLUGIN_DIR" ]; then
    echo -e "${RED}✗ 插件目录不存在: $PLUGIN_DIR${NC}"
    echo "请先创建插件"
    exit 1
fi

# 2. 启用插件配置
CONFIG_JSON="$PLUGIN_DIR/config.json"
if [ -f "$CONFIG_JSON" ]; then
    node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$CONFIG_JSON', 'utf-8'));
    config.enabled = true;
    fs.writeFileSync('$CONFIG_JSON', JSON.stringify(config, null, 2));
    "
    echo -e "${GREEN}✓ 已启用插件配置${NC}"
else
    echo -e "${RED}✗ 配置文件不存在${NC}"
    exit 1
fi

# 3. 添加插件到 OpenCode 配置
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
        echo -e "${GREEN}✓ 已添加插件到 OpenCode 配置${NC}"
    else
        echo -e "${YELLOW}! 插件已在配置中${NC}"
    fi
else
    echo -e "${RED}✗ OpenCode 配置文件不存在${NC}"
    exit 1
fi

# 4. 创建用户偏好文件（如果不存在）
if [ ! -f "$PROJECT_DIR/experience-data/user-profile.json" ]; then
    mkdir -p "$PROJECT_DIR/experience-data"
    cat > "$PROJECT_DIR/experience-data/user-profile.json" << 'EOF'
{
  "id": "user-profile",
  "type": "user_preference",
  "key": "user:profile",
  "value": {
    "note": "请编辑此文件添加用户偏好"
  },
  "tags": ["user_profile"],
  "created_at": "2026-02-27T00:00:00Z",
  "updated_at": "2026-02-27T00:00:00Z"
}
EOF
    echo -e "${YELLOW}! 已创建用户偏好模板，请编辑添加信息${NC}"
fi

echo ""
echo -e "${GREEN}=== 启用完成 ===${NC}"
echo ""
echo "请重启 OpenCode 使配置生效"
