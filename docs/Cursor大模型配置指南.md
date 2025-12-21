# Cursor 大模型配置指南

本指南将帮助您在 Cursor IDE 中配置 **通义千问（阿里云）** 和 **DeepSeek-V2** 两个大模型。

---

## 📋 前置准备

### 1. 通义千问（阿里云）API Key 获取

#### 步骤：
1. **注册/登录阿里云账号**
   - 访问：https://www.aliyun.com/
   - 完成实名认证（必需）

2. **开通百炼服务**
   - 访问百炼控制台：https://bailian.console.aliyun.com/
   - 点击"去开通"，阅读并同意服务协议
   - 点击"立即开通"

3. **创建 API Key**
   - 在百炼控制台右上角，点击"API-KEY"
   - 点击"创建新的API-KEY"
   - **重要**：复制并妥善保存 API Key（只显示一次）

4. **获取 API 端点信息**
   - 通义千问使用 DashScope API
   - API 端点：`https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
   - 或使用 OpenAI 兼容端点：`https://dashscope.aliyuncs.com/compatible-mode/v1`

#### 推荐模型：
- `qwen-plus` - 通用对话模型
- `qwen-turbo` - 快速响应模型
- `qwen-max` - 最强性能模型
- `qwen-2.5-coder` - 代码专用模型

---

### 2. DeepSeek-V2 API Key 获取

#### 步骤：
1. **注册账户**
   - 访问：https://developer.deepseek.com
   - 使用邮箱或手机号注册
   - 完成实名认证（个人开发者）

2. **创建项目**
   - 登录控制台，进入"项目管理"
   - 创建新项目，填写项目名称和应用场景

3. **生成 API Key**
   - 在项目详情页，点击"API管理"
   - 选择"生成密钥"
   - 选择密钥类型（主密钥或子密钥）
   - 设置有效期（最长365天）
   - **重要**：复制并保存 AccessKey（SecretAccessKey 只显示一次）

#### API 端点：
- DeepSeek API：`https://api.deepseek.com/v1/chat/completions`
- 模型名称：`deepseek-chat` 或 `deepseek-coder`

---

## ⚙️ Cursor 配置步骤

### 方法一：通过 Cursor 设置界面（推荐）

1. **打开设置**
   - 点击右上角设置图标（⚙️）
   - 或使用快捷键：`Cmd + ,` (Mac) / `Ctrl + ,` (Windows)

2. **进入 Models 设置**
   - 在左侧菜单找到 "Models" 或 "AI Models"
   - 点击进入模型配置页面

3. **添加通义千问模型**
   - 点击 "Add Custom Model" 或 "添加自定义模型"
   - 填写以下信息：
     ```
     Model Name: Qwen-Plus (或自定义名称)
     API Type: OpenAI Compatible
     API URL: https://dashscope.aliyuncs.com/compatible-mode/v1
     API Key: [您的通义千问 API Key]
     Model ID: qwen-plus
     ```
   - 点击 "Test Connection" 测试连接
   - 连接成功后点击 "Save"

4. **添加 DeepSeek 模型**
   - 再次点击 "Add Custom Model"
   - 填写以下信息：
     ```
     Model Name: DeepSeek-V2 (或自定义名称)
     API Type: OpenAI Compatible
     API URL: https://api.deepseek.com/v1
     API Key: [您的 DeepSeek API Key]
     Model ID: deepseek-chat
     ```
   - 点击 "Test Connection" 测试连接
   - 连接成功后点击 "Save"

5. **设置为默认模型（可选）**
   - 在模型列表中找到刚添加的模型
   - 点击 "Set as Default" 设置为默认模型

---

### 方法二：通过配置文件（高级）

如果 Cursor 支持通过配置文件设置，可以在 `settings.json` 中添加：

```json
{
  "cursor.models.custom": [
    {
      "name": "Qwen-Plus",
      "provider": "openai",
      "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "apiKey": "${DASHSCOPE_API_KEY}",
      "model": "qwen-plus"
    },
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

**注意**：建议使用环境变量存储 API Key，而不是直接写在配置文件中。

---

## 🔐 安全配置（推荐）

### 使用环境变量存储 API Key

#### macOS/Linux:
```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
export DASHSCOPE_API_KEY="your-qwen-api-key"
export DEEPSEEK_API_KEY="your-deepseek-api-key"

# 使配置生效
source ~/.zshrc
```

#### Windows:
1. 打开"系统属性" → "高级" → "环境变量"
2. 新建系统变量：
   - `DASHSCOPE_API_KEY` = 您的通义千问 API Key
   - `DEEPSEEK_API_KEY` = 您的 DeepSeek API Key

---

## ✅ 验证配置

配置完成后，可以通过以下方式验证：

1. **在 Cursor 中测试**
   - 打开 Cursor 的聊天面板
   - 选择刚配置的模型
   - 发送一条测试消息，如："你好，请介绍一下你自己"

2. **检查响应**
   - 如果收到正常回复，说明配置成功
   - 如果出现错误，检查：
     - API Key 是否正确
     - API 端点是否正确
     - 网络连接是否正常
     - 账户余额是否充足

---

## 💰 价格参考（2024年）

### 通义千问
- Qwen-Plus: 约 ¥0.008/千tokens
- Qwen-Turbo: 约 ¥0.002/千tokens
- Qwen-Max: 约 ¥0.12/千tokens

### DeepSeek-V2
- 输入：¥1/百万tokens
- 输出：¥2/百万tokens

---

## 🐛 常见问题

### 1. 连接失败
- **检查 API Key**：确保 API Key 正确且未过期
- **检查网络**：确保可以访问 API 端点
- **检查格式**：确保 API URL 和 Model ID 格式正确

### 2. 认证错误
- 确认 API Key 已正确复制（无多余空格）
- 确认账户已完成实名认证
- 确认账户有足够余额

### 3. 模型不可用
- 检查模型名称是否正确
- 确认账户有权限使用该模型
- 尝试使用其他模型 ID

---

## 📞 获取帮助

- **通义千问**：https://help.aliyun.com/zh/model-studio/
- **DeepSeek**：https://api-docs.deepseek.com/
- **Cursor 支持**：https://cursor.sh/docs

---

## 📝 注意事项

1. ⚠️ **API Key 安全**：不要将 API Key 提交到 Git 仓库
2. 💰 **费用监控**：定期检查 API 使用量和费用
3. 🔄 **定期更新**：API Key 建议定期轮换（90天）
4. 📊 **使用统计**：在各自控制台查看使用统计和账单

---

配置完成后，您就可以在 Cursor 中使用这两个高性价比的大模型了！🎉
