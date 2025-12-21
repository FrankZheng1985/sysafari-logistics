#!/bin/bash

# Cursor 大模型环境变量配置脚本
# 用于设置通义千问和 DeepSeek 的 API Key

echo "🚀 Cursor 大模型配置助手"
echo "================================"
echo ""

# 检测 shell 类型
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    SHELL_CONFIG="$HOME/.profile"
fi

echo "📝 检测到 Shell 配置文件: $SHELL_CONFIG"
echo ""

# 检查是否已存在配置
if grep -q "DASHSCOPE_API_KEY" "$SHELL_CONFIG" 2>/dev/null; then
    echo "⚠️  检测到已存在 DASHSCOPE_API_KEY 配置"
    read -p "是否要更新通义千问 API Key? (y/n): " update_qwen
    if [ "$update_qwen" = "y" ]; then
        # 删除旧配置
        sed -i.bak '/DASHSCOPE_API_KEY/d' "$SHELL_CONFIG"
    fi
fi

if grep -q "DEEPSEEK_API_KEY" "$SHELL_CONFIG" 2>/dev/null; then
    echo "⚠️  检测到已存在 DEEPSEEK_API_KEY 配置"
    read -p "是否要更新 DeepSeek API Key? (y/n): " update_deepseek
    if [ "$update_deepseek" = "y" ]; then
        # 删除旧配置
        sed -i.bak '/DEEPSEEK_API_KEY/d' "$SHELL_CONFIG"
    fi
fi

echo ""
echo "请输入您的 API Keys（如果不想设置某个，直接按回车跳过）"
echo ""

# 设置通义千问 API Key
read -p "🔑 通义千问 (Qwen) API Key: " qwen_key
if [ -n "$qwen_key" ]; then
    echo "" >> "$SHELL_CONFIG"
    echo "# 通义千问 API Key (配置于 $(date '+%Y-%m-%d %H:%M:%S'))" >> "$SHELL_CONFIG"
    echo "export DASHSCOPE_API_KEY=\"$qwen_key\"" >> "$SHELL_CONFIG"
    echo "✅ 通义千问 API Key 已添加到 $SHELL_CONFIG"
fi

# 设置 DeepSeek API Key
read -p "🔑 DeepSeek API Key: " deepseek_key
if [ -n "$deepseek_key" ]; then
    echo "" >> "$SHELL_CONFIG"
    echo "# DeepSeek API Key (配置于 $(date '+%Y-%m-%d %H:%M:%S'))" >> "$SHELL_CONFIG"
    echo "export DEEPSEEK_API_KEY=\"$deepseek_key\"" >> "$SHELL_CONFIG"
    echo "✅ DeepSeek API Key 已添加到 $SHELL_CONFIG"
fi

echo ""
echo "📋 配置完成！"
echo ""
echo "⚠️  重要提示："
echo "1. 请运行以下命令使配置生效："
echo "   source $SHELL_CONFIG"
echo ""
echo "2. 或者在 Cursor 中配置时，可以直接使用这些环境变量："
if [ -n "$qwen_key" ]; then
    echo "   DASHSCOPE_API_KEY"
fi
if [ -n "$deepseek_key" ]; then
    echo "   DEEPSEEK_API_KEY"
fi
echo ""
echo "3. 详细配置步骤请查看: docs/Cursor大模型配置指南.md"
echo ""
echo "🎉 配置完成！现在可以在 Cursor 中设置模型了。"
