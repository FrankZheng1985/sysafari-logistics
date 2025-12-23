# Cursor DeepSeek 手动配置指南

## 📋 问题说明

如果在 Cursor 中点击 "Add Custom Model" 后没有弹出详细配置表单，可以使用以下手动配置方法。

---

## 🔧 方法一：通过 Cursor 设置界面（推荐先尝试）

### 步骤 1：检查模型是否已添加
1. 在 Cursor 设置 → Models 页面
2. 查看模型列表中是否有 "DeepSeek-V2"
3. 如果有，点击它查看是否有配置选项（齿轮图标、编辑按钮等）

### 步骤 2：尝试不同的操作
1. **重新启动 Cursor**：完全退出并重新打开 Cursor
2. **更新 Cursor**：确保使用最新版本
3. **检查网络连接**：确保网络稳定

---

## 🔧 方法二：手动编辑配置文件（高级）

### ⚠️ 重要提示
- **必须先备份配置文件**（已完成：`settings.json.backup`）
- **确保 JSON 格式正确**，否则 Cursor 可能无法启动
- **建议先获取 API Key** 再进行配置

### 步骤 1：获取 DeepSeek API Key
1. 访问：https://developer.deepseek.com
2. 注册/登录并完成实名认证
3. 创建项目 → API管理 → 生成密钥
4. 复制 API Key（只显示一次）

### 步骤 2：编辑配置文件

配置文件位置：
```
/Users/fengzheng/Library/Application Support/Cursor/User/settings.json
```

**当前配置内容：**
```json
{
    "window.commandCenter": true,
    "gitlens.ai.model": "gitkraken",
    "gitlens.ai.gitkraken.model": "gemini:gemini-2.0-flash",
    "git.enableSmartCommit": true,
    "git.autofetch": true,
    "workbench.editor.enablePreview": false,
    "cursor.models.default": "gemini-3-pro",
    "cursor.models.codeCompletion": "gemini-3-pro",
    "cursor.models.chat": {
        "simple": "gemini-3-pro",
        "complex": "gemini-3-pro",
        "reasoning": "gemini-3-pro"
    }
}
```

**添加 DeepSeek 配置（尝试以下格式）：**

#### 格式 A：使用 customModels（如果支持）
```json
{
    "window.commandCenter": true,
    "gitlens.ai.model": "gitkraken",
    "gitlens.ai.gitkraken.model": "gemini:gemini-2.0-flash",
    "git.enableSmartCommit": true,
    "git.autofetch": true,
    "workbench.editor.enablePreview": false,
    "cursor.models.default": "gemini-3-pro",
    "cursor.models.codeCompletion": "gemini-3-pro",
    "cursor.models.chat": {
        "simple": "gemini-3-pro",
        "complex": "gemini-3-pro",
        "reasoning": "gemini-3-pro"
    },
    "cursor.models.custom": [
        {
            "name": "DeepSeek-V2",
            "provider": "openai",
            "baseURL": "https://api.deepseek.com/v1",
            "apiKey": "YOUR_DEEPSEEK_API_KEY_HERE",
            "model": "deepseek-chat"
        }
    ]
}
```

#### 格式 B：使用环境变量（更安全）
```json
{
    "window.commandCenter": true,
    "gitlens.ai.model": "gitkraken",
    "gitlens.ai.gitkraken.model": "gemini:gemini-2.0-flash",
    "git.enableSmartCommit": true,
    "git.autofetch": true,
    "workbench.editor.enablePreview": false,
    "cursor.models.default": "gemini-3-pro",
    "cursor.models.codeCompletion": "gemini-3-pro",
    "cursor.models.chat": {
        "simple": "gemini-3-pro",
        "complex": "gemini-3-pro",
        "reasoning": "gemini-3-pro"
    },
    "cursor.models.custom": [
        {
            "name": "DeepSeek-V2",
            "provider": "openai",
            "baseURL": "https://api.deepseek.com/v1",
            "apiKey": "${DEEPSEEK_API_KEY}",
            "model": "deepseek-chat"
        }
    ]
}
```

如果使用环境变量，需要先设置：
```bash
export DEEPSEEK_API_KEY="your-api-key-here"
```

### 步骤 3：保存并重启
1. 保存 `settings.json` 文件
2. 完全退出 Cursor（`Cmd + Q`）
3. 重新打开 Cursor
4. 检查 Models 设置中是否出现 DeepSeek-V2

---

## 🔧 方法三：使用环境变量 + 配置脚本

### 步骤 1：设置环境变量
运行项目中的配置脚本：
```bash
./setup-cursor-models.sh
```

或手动添加到 `~/.zshrc`：
```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key"
source ~/.zshrc
```

### 步骤 2：在 Cursor 中配置
1. 打开 Cursor 设置 → Models
2. 尝试添加自定义模型
3. 在 API Key 字段中使用环境变量：`${DEEPSEEK_API_KEY}`

---

## ✅ 验证配置

配置完成后：
1. 打开 Cursor 的聊天面板
2. 在模型选择器中选择 "DeepSeek-V2"
3. 发送测试消息："你好，请介绍一下你自己"
4. 如果收到正常回复，说明配置成功

---

## 🐛 故障排除

### 问题 1：配置文件格式错误
- **症状**：Cursor 无法启动或设置页面无法打开
- **解决**：恢复备份文件
  ```bash
  cp "/Users/fengzheng/Library/Application Support/Cursor/User/settings.json.backup" \
     "/Users/fengzheng/Library/Application Support/Cursor/User/settings.json"
  ```

### 问题 2：模型未出现在列表中
- 检查 JSON 格式是否正确（使用 JSON 验证工具）
- 确认 API Key 是否正确
- 尝试重启 Cursor

### 问题 3：连接失败
- 检查 API Key 是否正确且未过期
- 确认网络可以访问 `https://api.deepseek.com`
- 确认账户有足够余额

---

## 📞 获取帮助

- **DeepSeek 文档**：https://api-docs.deepseek.com/
- **Cursor 支持**：https://cursor.sh/docs
- **DeepSeek 控制台**：https://developer.deepseek.com

---

## 📝 注意事项

1. ⚠️ **API Key 安全**：不要将 API Key 提交到 Git 仓库
2. 💰 **费用监控**：定期检查 API 使用量和费用
3. 🔄 **定期更新**：API Key 建议定期轮换（90天）
4. 📊 **使用统计**：在 DeepSeek 控制台查看使用统计和账单

