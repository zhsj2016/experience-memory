#!/bin/bash
# ============================================
# 初始化脚本 - 为新用户配置 Experience Agent
# 智能检测已有数据，不覆盖用户现有配置
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${1:-.}"

echo -e "${BLUE}=== Experience Agent 初始化 ===${NC}"
echo "初始化目录: $TARGET_DIR"
echo ""

cd "$TARGET_DIR"

EXPERIENCE_DATA_DIR="experience-data"

if [ ! -d "$EXPERIENCE_DATA_DIR" ]; then
    echo -e "${YELLOW}! 经验数据目录不存在，创建新目录${NC}"
    mkdir -p "$EXPERIENCE_DATA_DIR"
fi

check_and_create() {
    local file="$1"
    local template="$2"
    local desc="$3"
    
    if [ -f "$EXPERIENCE_DATA_DIR/$file" ]; then
        echo -e "${GREEN}✓${NC} $desc 已存在，跳过创建"
        return 1
    else
        echo -e "${YELLOW}→${NC} 创建 $desc ..."
        cat > "$EXPERIENCE_DATA_DIR/$file" << 'EOF'
EOF
        echo "$template" >> "$EXPERIENCE_DATA_DIR/$file"
        echo -e "${GREEN}✓${NC} $desc 已创建"
        return 0
    fi
}

echo -e "${BLUE}--- 检查并初始化配置文件 ---${NC}"
echo ""

USER_PROFILE_TEMPLATE='{
  "id": "user-profile",
  "type": "user_preference",
  "key": "user:profile",
  "value": {
    "note": "请编辑此文件添加用户偏好",
    "name": "",
    "nationality": "",
    "location": "",
    "network": {
      "needs_proxy": false,
      "proxy_port": 1087,
      "proxy_status": "always_on/dynamic/not_available",
      "preference": "描述你的网络偏好"
    },
    "device": {
      "type": "设备类型",
      "priority": "性能优先/兼容优先/其他"
    },
    "priorities": ["你的优先级1", "你的优先级2"],
    "project_preferences": {
      "data_privacy": {
        "rule": "上传github时仅上传模板，不上传个人真实数据",
        "description": "个人数据保护规则"
      },
      "experience_capture": {
        "rule": "自动捕捉经验，禁止手动记录",
        "description": "经验自动化原则"
      }
    },
    "personal_taboos": ["禁忌1", "禁忌2"],
    "reply_style_preference": {
      "brevity": "high/medium/low",
      "tone": "collaborative/directive",
      "emoji": "avoid/allow",
      "intro_outro": "avoid/allow"
    }
  },
  "tags": ["user_profile", "preference"],
  "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "updated_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
}'

EXPERIENCE_DATA_TEMPLATE='{
  "experiences": [
    {
      "id": "example-first-experience",
      "problem_background": "示例问题背景 - 描述你遇到问题的场景",
      "core_problem": "示例核心问题 - 描述问题的本质",
      "failed_solutions": [
        {
          "approach": "示例失败方案",
          "result": "fail",
          "reason": "失败原因"
        }
      ],
      "successful_solution": {
        "content": "成功方案描述",
        "usability_rating": {
          "time_cost": "低/中/高",
          "steps": 1,
          "universality": "高/中/低",
          "difficulty": "低/中/高",
          "dependencies": "无/低/高",
          "hardware_os_requirement": "无特殊要求",
          "duration": "一次性/短期/长期",
          "success_count": 1
        }
      },
      "lessons": [
        "教训1：xxx",
        "教训2：xxx"
      ],
      "contexts": ["example", "template"],
      "success_rate": 1,
      "usage_count": 0,
      "last_used": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    {
      "id": "error-example-user-correction",
      "problem_background": "示例：用户纠正场景",
      "core_problem": "用户指出你的理解有误",
      "failed_solutions": [
        {
          "approach": "错误方案",
          "result": "fail",
          "reason": "用户纠正"
        }
      ],
      "successful_solution": null,
      "lessons": [
        "错误类型：用户纠正错误",
        "该方案已被证明不可行，需避免重复尝试"
      ],
      "contexts": ["error_experience", "user_correction"],
      "success_rate": 0,
      "usage_count": 0,
      "last_used": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    {
      "id": "error-example-self-correction",
      "problem_background": "示例：模型自我认错场景",
      "core_problem": "AI 自己意识到之前的方案有问题",
      "failed_solutions": [
        {
          "approach": "错误方案",
          "result": "fail",
          "reason": "模型自我认错"
        }
      ],
      "successful_solution": null,
      "lessons": [
        "错误类型：模型自我认错",
        "该方案已被证明不可行，需避免重复尝试"
      ],
      "contexts": ["error_experience", "model_self_correction"],
      "success_rate": 0,
      "usage_count": 0,
      "last_used": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    {
      "id": "error-example-abandon-plan",
      "problem_background": "示例：模型放弃方案场景",
      "core_problem": "执行中发现方案行不通而放弃",
      "failed_solutions": [
        {
          "approach": "被放弃的方案",
          "result": "fail",
          "reason": "模型放弃方案"
        }
      ],
      "successful_solution": null,
      "lessons": [
        "错误类型：模型放弃方案",
        "该方案已被证明不可行，需避免重复尝试"
      ],
      "contexts": ["error_experience", "model_abandon_plan"],
      "success_rate": 0,
      "usage_count": 0,
      "last_used": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  ],
  "config": {
    "enabled": true,
    "autoCapture": true,
    "autoRecall": true
  }
}'

PENDING_ISSUES_TEMPLATE='# 遗留问题记录

> 此文档记录待解决的问题，不上传 GitHub

## 问题列表

### 待解决

| 问题 | 优先级 | 创建时间 | 状态 |
|------|--------|----------|------|
| 示例：添加新功能X | 高 | '$(date -u +%Y-%m-%d)' | 进行中 |

### 已解决

| 问题 | 解决时间 | 方案 |
|------|----------|------|
| 示例：修复Y | 2026-01-01 | 方案描述 |

---

*此文件为模板，请编辑添加你的遗留问题*
'

check_and_create "user-profile.json" "$USER_PROFILE_TEMPLATE" "用户配置"
check_and_create "experience-data.json" "$EXPERIENCE_DATA_TEMPLATE" "经验数据"
check_and_create "pending-issues.md" "$PENDING_ISSUES_TEMPLATE" "遗留问题"

if [ ! -f "$EXPERIENCE_DATA_DIR/credentials.json" ]; then
    if [ ! -f "$EXPERIENCE_DATA_DIR/credentials.json.example" ]; then
        echo -e "${YELLOW}→${NC} 创建凭证模板 ..."
        cat > "$EXPERIENCE_DATA_DIR/credentials.json.example" << 'EOF'
{
  "note": "请复制此文件为 credentials.json 并填入你的真实信息",
  "github": "your_github_token_here",
  "deepseek": "your_deepseek_key_here",
  "minimax": "your_minimax_key_here",
  "feishu": {
    "app_id": "your_feishu_app_id",
    "secret": "your_feishu_secret"
  },
  "proxy": {
    "host": "127.0.0.1",
    "port": 1087
  }
}
EOF
        echo -e "${GREEN}✓${NC} 凭证模板已创建"
    else
        echo -e "${GREEN}✓${NC} 凭证模板已存在"
    fi
    echo -e "${YELLOW}! 请运行以下命令配置凭证:${NC}"
    echo "  cp experience-data/credentials.json.example experience-data/credentials.json"
else
    echo -e "${GREEN}✓${NC} 凭证配置已存在"
fi

echo ""
echo -e "${GREEN}=== 初始化完成 ===${NC}"
echo ""
echo "下一步："
echo "  1. 编辑 experience-data/user-profile.json 填入你的偏好"
echo "  2. 如需凭证: cp experience-data/credentials.json.example experience-data/credentials.json"
echo "  3. 运行: bash experience-data/enable.sh"
echo ""
