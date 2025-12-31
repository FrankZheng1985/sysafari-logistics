# Cursor 模型配置快速参考

## 🔑 API Key 获取地址

| 模型 | 控制台地址 | 说明 |
|------|-----------|------|
| **通义千问** | https://bailian.console.aliyun.com/ | 需要阿里云账号，完成实名认证 |
| **DeepSeek** | https://developer.deepseek.com | 需要注册账号，完成实名认证 |

---

## ⚙️ Cursor 配置参数

### 通义千问（Qwen）

```
Model Name: Qwen-Plus
API Type: OpenAI Compatible
API URL: https://dashscope.aliyuncs.com/compatible-mode/v1
API Key: [从百炼控制台获取]
Model ID: qwen-plus
```

**其他可用模型 ID：**
- `qwen-turbo` - 快速响应
- `qwen-max` - 最强性能
- `qwen-2.5-coder` - 代码专用

---

### DeepSeek-V2

```
Model Name: DeepSeek-V2
API Type: OpenAI Compatible
API URL: https://api.deepseek.com/v1
API Key: [从 DeepSeek 控制台获取]
Model ID: deepseek-chat
```

**其他可用模型 ID：**
- `deepseek-coder` - 代码专用

---

## 🚀 快速配置步骤

1. **获取 API Key**
   - 访问上述控制台地址
   - 创建项目并生成 API Key

2. **在 Cursor 中配置**
   - 打开设置 (`Cmd + ,`)
   - 找到 "Models" 设置
   - 点击 "Add Custom Model"
   - 填入上述参数
   - 测试连接并保存

3. **（可选）使用环境变量**
   ```bash
   # 运行配置脚本
   ./setup-cursor-models.sh
   
   # 或手动设置
   export DASHSCOPE_API_KEY="your-qwen-key"
   export DEEPSEEK_API_KEY="your-deepseek-key"
   ```

---

## 💰 价格对比

| 模型 | 输入价格 | 输出价格 | 备注 |
|------|---------|---------|------|
| **DeepSeek-V2** | ¥1/百万tokens | ¥2/百万tokens | ⭐ 性价比最高 |
| **Qwen-Plus** | ¥0.008/千tokens | ¥0.008/千tokens | 约 ¥8/百万tokens |
| **Qwen-Turbo** | ¥0.002/千tokens | ¥0.002/千tokens | 约 ¥2/百万tokens |

**结论**：DeepSeek-V2 在价格上最具优势！

---

## ✅ 测试连接

配置完成后，在 Cursor 聊天中发送：
```
你好，请介绍一下你自己
```

如果收到正常回复，说明配置成功！

---

## 📚 详细文档

完整配置指南请查看：[Cursor大模型配置指南.md](./Cursor大模型配置指南.md)
