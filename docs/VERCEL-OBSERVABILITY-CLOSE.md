# 关闭 Vercel Observability 操作指南

## 目的
关闭 Vercel Observability Plus 功能，节省每月 $10 的费用。

## 操作步骤

### 方法1：通过团队设置 > 计费页面关闭（推荐）⭐

这是最直接和可靠的方法：

1. **进入团队设置**
   - 在 Vercel Dashboard 顶部，确认你选择了正确的团队（如 "FrankZheng's projects"）
   - 点击右上角头像 → **"Settings"**（设置）
   - 或者直接访问：https://vercel.com/dashboard/settings/billing

2. **找到 Observability Plus 设置**
   - 在 **"Billing"**（计费）页面中
   - 向下滚动找到 **"Observability Plus"** 部分
   - 你会看到一个切换开关（Toggle）

3. **关闭功能**
   - 将 **"Observability Plus"** 的开关设置为 **关闭状态**（Disabled）
   - 系统可能会弹出确认对话框
   - 确认操作

### 方法2：通过 Observability 页面设置

1. **进入 Observability 页面**
   - 在左侧导航栏点击 **"Observability"** 标签
   - 或者直接访问：https://vercel.com/dashboard/observability

2. **打开设置**
   - 在 Observability 页面右上角，找到时间范围选择器旁边的设置按钮
   - 点击按钮，选择 **"Observability Settings"**（可观测性设置）

3. **关闭 Observability Plus**
   - 在设置页面中找到 **"Observability Plus"** 部分
   - 点击切换按钮将其关闭（Toggle Off）
   - 在确认对话框中点击 **"Confirm"**（确认）

### 方法3：通过项目设置关闭

1. **进入项目设置**
   - 在 Vercel Dashboard 中选择你的项目（如 `sysafari-logistics`）
   - 点击 **"Settings"**（设置）标签
   - 在左侧菜单中找到 **"Observability"** 选项

2. **关闭功能**
   - 找到 **"Observability Plus"** 开关
   - 将其关闭
   - 确认操作

## 重要提示

⚠️ **注意事项：**

1. **数据丢失**
   - 关闭后立即停止数据收集
   - 你将失去对现有数据的访问权限
   - 已收集的数据不会保留

2. **计费说明**
   - 关闭后，当前计费周期结束后停止收费
   - 关闭前已收集的事件仍会收费
   - 已支付的费用不会退款

3. **生效时间**
   - 关闭操作立即生效
   - 下个计费周期开始不再产生费用

## 预期效果

- ✅ 每月节省 $10 费用
- ✅ 停止 Observability Plus 数据收集
- ✅ 保留 Pro 套餐的其他功能（$20/月）

## 验证

关闭后，可以通过以下方式验证：

1. **检查账单**
   - 等待下个计费周期
   - 查看账单确认不再有 Observability 费用

2. **检查功能**
   - Observability 页面将显示免费版本的限制
   - 不再有高级监控功能

## 相关链接

- Vercel Observability 文档：https://vercel.com/docs/observability
- Vercel 计费页面：https://vercel.com/dashboard/settings/billing
- Vercel 支持：https://vercel.com/support

---

**创建时间：** 2025-01-19  
**目的：** 优化成本，关闭不必要的 Observability Plus 订阅
