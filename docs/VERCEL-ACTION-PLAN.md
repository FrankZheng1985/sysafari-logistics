# Vercel 优化行动计划

## 🎯 目标
1. 关闭 Observability，节省 $10/月
2. 优化配置，提升性能和安全性
3. 确保配置最佳实践

## ✅ 已完成的工作

### 1. 配置文件优化
- ✅ 已更新 `vercel.json`，添加了：
  - 更多安全头（X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy）
  - 静态资源缓存配置（1年缓存）
  - HTML 文件不缓存配置

### 2. 文档创建
- ✅ 创建了 Observability 关闭指南
- ✅ 创建了优化检查清单
- ✅ 创建了本行动计划

## 📋 待执行的操作

### 步骤 1：关闭 Observability（立即执行）

**操作步骤：**

1. **登录 Vercel Dashboard**
   ```
   访问：https://vercel.com/dashboard
   ```

2. **进入 Observability 设置**
   - 点击左侧导航栏的 **"Observability"**
   - 或直接访问：https://vercel.com/dashboard/observability
   - 在页面右上角，点击时间范围选择器旁边的按钮
   - 选择 **"Observability Settings"**

3. **关闭功能**
   - 找到 **"Observability Plus"** 开关
   - 将其关闭（Toggle Off）
   - 在确认对话框中点击 **"Confirm"**

4. **验证**
   - 等待几秒钟，刷新页面
   - 确认开关处于关闭状态
   - 检查计费页面，确认下个周期不再收费

**预期结果：**
- ✅ Observability Plus 已关闭
- ✅ 下个计费周期节省 $10

---

### 步骤 2：部署更新的配置（可选，但推荐）

**操作步骤：**

1. **提交配置更改**
   ```bash
   cd /Users/fengzheng/sysafari-logistics
   git add vercel.json docs/
   git commit -m "优化 Vercel 配置：添加安全头和缓存策略"
   git push origin main
   ```

2. **自动部署**
   - Vercel 会自动检测到 GitHub 推送
   - 自动触发新的部署
   - 等待部署完成（约 1-2 分钟）

3. **验证部署**
   - 访问你的网站
   - 打开浏览器开发者工具 → Network 标签
   - 刷新页面，检查响应头：
     - `X-Frame-Options: SAMEORIGIN`
     - `X-XSS-Protection: 1; mode=block`
     - `Cache-Control: public, max-age=31536000, immutable`（静态资源）

**预期结果：**
- ✅ 新配置已部署
- ✅ 安全头已生效
- ✅ 缓存策略已生效

---

### 步骤 3：检查环境变量（建议执行）

**操作步骤：**

1. **访问项目设置**
   ```
   访问：https://vercel.com/dashboard/[你的项目名]/settings/environment-variables
   ```

2. **检查项目**
   - [ ] 确认没有敏感信息（API keys, passwords）
   - [ ] 检查不同环境的变量是否正确隔离
   - [ ] 确认生产环境和演示环境的变量不同

3. **如果需要添加环境变量**
   - 点击 "Add New"
   - 输入变量名和值
   - 选择适用的环境（Production, Preview, Development）
   - 保存

**预期结果：**
- ✅ 环境变量配置正确
- ✅ 没有敏感信息泄露风险

---

### 步骤 4：监控使用量（每月检查）

**操作步骤：**

1. **访问计费页面**
   ```
   访问：https://vercel.com/dashboard/settings/billing
   ```

2. **检查使用量**
   - Edge 请求：当前 12,638/月（免费额度：100,000/月）✅ 安全
   - 数据传输：当前 0.43GB/月（免费额度：100GB/月）✅ 安全
   - 构建分钟：当前 140分钟/月（免费额度：6,000分钟/月）✅ 安全

3. **设置提醒**
   - 建议每月 15 号检查一次
   - 如果接近免费额度，考虑优化

**预期结果：**
- ✅ 使用量在免费额度内
- ✅ 没有意外费用

---

## 📊 成本对比

| 项目 | 优化前 | 优化后 | 节省 |
|------|--------|--------|------|
| Pro 套餐 | $20/月 | $20/月 | - |
| Observability | $10/月 | $0/月 | **$10/月** |
| **总计** | **$30/月** | **$20/月** | **$10/月** |
| **年节省** | - | - | **$120/年** |

---

## 🔍 验证清单

完成所有步骤后，请确认：

- [ ] Observability Plus 已关闭
- [ ] 新配置已部署（如果执行了步骤2）
- [ ] 安全头已生效（检查浏览器 Network 标签）
- [ ] 环境变量配置正确
- [ ] 使用量在免费额度内
- [ ] 下个计费周期费用为 $20（而不是 $30）

---

## 📞 需要帮助？

如果遇到问题：

1. **Vercel 文档**
   - https://vercel.com/docs

2. **Vercel 支持**
   - https://vercel.com/support
   - 或发送邮件至：support@vercel.com

3. **检查项目文档**
   - `docs/VERCEL-OBSERVABILITY-CLOSE.md` - 关闭 Observability 详细步骤
   - `docs/VERCEL-OPTIMIZATION-CHECKLIST.md` - 完整检查清单

---

**创建时间：** 2025-01-19  
**预计完成时间：** 15-30 分钟
