# Cursor DeepSeek 故障排除指南

## 🔴 当前问题

错误信息：**"The model DeepSeek-V2 does not work with your current plan or api key"**

虽然 API Key 测试成功，但 Cursor 仍然无法识别模型。

---

## 🔍 可能的原因

### 1. Cursor 版本问题
- Cursor 可能不支持通过配置文件添加自定义模型
- 某些版本可能需要通过 UI 界面添加

### 2. 配置格式问题
- Cursor 可能使用不同的配置键名
- 可能需要特定的配置结构

### 3. API Key 权限问题
- API Key 可能需要特定权限
- 账户可能需要特定计划

---

## ✅ 解决方案

### 方案一：通过 Cursor UI 界面添加（推荐）

1. **完全删除配置文件中的自定义模型配置**
   - 移除 `cursor.models.custom` 配置项
   - 恢复为原始配置

2. **在 Cursor 中通过 UI 添加**
   - 打开 Cursor 设置 → Models
   - 点击 "+ Add Custom Model"
   - **如果弹出表单**，填写：
     - Model Name: `DeepSeek-V2`
     - API Type: `OpenAI Compatible`
     - API URL: `https://api.deepseek.com/v1`
     - API Key: `sk-d847788e676640afab6a9a5dd94dd423`
     - Model ID: `deepseek-chat`
   - 点击 "Test Connection"
   - 保存配置

3. **如果仍然没有弹出表单**
   - 尝试点击模型列表中的 "DeepSeek-V2"（如果已存在）
   - 查看是否有编辑/配置选项
   - 或者尝试右键点击模型，查看是否有配置选项

---

### 方案二：检查 Cursor 版本和更新

1. **检查 Cursor 版本**
   - 打开 Cursor → About Cursor
   - 查看当前版本号

2. **更新到最新版本**
   - 如果有更新，请更新到最新版本
   - 新版本可能支持自定义模型配置

---

### 方案三：使用 Cursor 原生支持的 DeepSeek 模型

根据最新信息，Cursor 可能原生支持 DeepSeek，但需要使用特定的模型名称：

1. **检查模型列表**
   - 在 Cursor 设置 → Models 中
   - 查看是否有以下模型：
     - `deepseek-r1`
     - `deepseek-v3`
     - `deepseek-chat`（原生支持）

2. **如果存在原生支持的模型**
   - 启用该模型
   - 在 API Keys 区域配置 DeepSeek API Key
   - 测试使用

---

### 方案四：使用环境变量启动 Cursor

如果 Cursor 支持环境变量，可以尝试：

1. **设置环境变量**
   ```bash
   export DEEPSEEK_API_KEY="sk-d847788e676640afab6a9a5dd94dd423"
   ```

2. **从终端启动 Cursor**
   ```bash
   open -a Cursor
   ```

3. **在 Cursor 中配置**
   - 打开设置 → Models
   - 尝试添加自定义模型
   - 使用环境变量 `${DEEPSEEK_API_KEY}`

---

### 方案五：检查 API Key 和账户状态

1. **验证 API Key**
   - 访问：https://developer.deepseek.com
   - 登录账户
   - 检查 API Key 状态
   - 确认账户余额充足
   - 确认账户已完成实名认证

2. **测试 API Key**
   ```bash
   curl https://api.deepseek.com/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer sk-d847788e676640afab6a9a5dd94dd423" \
     -d '{
       "model": "deepseek-chat",
       "messages": [{"role": "user", "content": "你好"}],
       "max_tokens": 50
     }'
   ```

---

## 📝 当前配置文件状态

配置文件位置：`/Users/fengzheng/Library/Application Support/Cursor/User/settings.json`

当前配置：
```json
{
    "cursor.models.custom": [
        {
            "name": "DeepSeek-V2",
            "provider": "openai",
            "baseURL": "https://api.deepseek.com/v1",
            "apiKey": "sk-d847788e676640afab6a9a5dd94dd423",
            "model": "deepseek-chat"
        }
    ]
}
```

---

## 🔧 下一步操作建议

### 步骤 1：尝试通过 UI 添加
1. 移除配置文件中的自定义模型配置
2. 重启 Cursor
3. 通过 UI 界面添加模型

### 步骤 2：检查 Cursor 版本
1. 查看 Cursor 版本
2. 更新到最新版本
3. 重新尝试配置

### 步骤 3：联系 Cursor 支持
如果以上方法都不行，建议：
1. 访问 Cursor 官方文档：https://cursor.sh/docs
2. 联系 Cursor 技术支持
3. 在 Cursor 社区论坛提问

---

## 📞 获取帮助

- **Cursor 官方文档**：https://cursor.sh/docs
- **DeepSeek API 文档**：https://api-docs.deepseek.com/
- **DeepSeek 控制台**：https://developer.deepseek.com

---

## ⚠️ 重要提示

1. **API Key 安全**：不要将 API Key 提交到 Git 仓库
2. **备份配置**：修改前已备份配置文件：`settings.json.backup`
3. **费用监控**：定期检查 DeepSeek 使用量和费用

