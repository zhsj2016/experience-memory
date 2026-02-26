#!/bin/bash
# ============================================
# 一键回滚脚本 - 禁用 experience-agent 插件
# 如遇 OpenCode 异常，运行此脚本恢复
# 使用方法: bash experience-data/rollback.sh
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}=== Experience Agent 一键回滚 ===${NC}"
echo ""

# 1. 恢复 OpenCode 配置
CONFIG_FILE="$HOME/.config/opencode/opencode.json"
BACKUP_FILE="$HOME/.config/opencode/opencode.json.backup"

if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    echo -e "${GREEN}✓ 已恢复 OpenCode 配置${NC}"
else
    echo -e "${YELLOW}! 备份文件不存在，尝试手动清理配置...${NC}"
    
    # 手动移除插件引用
    if [ -f "$CONFIG_FILE" ]; then
        # 移除 plugin 数组中的 experience-agent
        if grep -q '"experience-agent"' "$CONFIG_FILE"; then
            # 使用 node 来更安全地修改 JSON
            node -e "
            const fs = require('fs');
            const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf-8'));
            if (config.plugin) {
                config.plugin = config.plugin.filter(p => p !== 'experience-agent');
                if (config.plugin.length === 0) delete config.plugin;
            }
            fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
            "
            echo -e "${GREEN}✓ 已从配置中移除插件${NC}"
        fi
    fi
fi

# 2. 删除插件目录（可选，防止加载）
PLUGIN_DIR="$HOME/.config/opencode/experience-agent"
if [ -d "$PLUGIN_DIR" ]; then
    read -p "是否删除插件目录? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$PLUGIN_DIR"
        echo -e "${GREEN}✓ 已删除插件目录${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=== 回滚完成 ===${NC}"
echo ""
echo "请重启 OpenCode"
