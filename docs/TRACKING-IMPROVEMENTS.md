# 物流追踪系统改进说明

## 改进时间
2025-12-23

## 改进内容

### 1. 修复路由配置问题 ✅

**问题**：路由路径重复添加 `/tracking` 前缀

**解决方案**：
- 修改 `server/modules/tracking/routes.js`
- 移除重复的 `/tracking` 前缀
- 正确的 API 路径：`/api/tracking/scrape`

### 2. 智能追踪增强 🚀

**新功能**：提单号和集装箱号双向关联查询

#### 工作原理

**场景 1：输入集装箱号**
```
用户输入: COSU1234567（集装箱号）
↓
1. 通过集装箱号查询获取基本信息
2. 如果返回结果中包含提单号，自动用提单号再查询一次
3. 合并两次查询的结果
↓
返回：完整的追踪信息（包含提单和集装箱的所有数据）
```

**场景 2：输入提单号**
```
用户输入: COSU6435174570（提单号）
↓
1. 通过提单号查询获取基本信息
2. 如果返回结果中包含集装箱号，自动用集装箱号再查询一次
3. 合并两次查询的结果
↓
返回：完整的追踪信息（包含提单和集装箱的所有数据）
```

#### 数据合并策略

1. **事件合并**
   - 合并两次查询的所有事件
   - 自动去重（基于日期+地点+事件描述）
   - 按时间倒序排列（最新的在前）

2. **字段合并**
   - 优先使用有值的字段
   - 如果两次查询都有值，保留主查询的结果
   - 合并后标记 `merged: true`

3. **数据源追踪**
   - 记录数据来源（`sources` 数组）
   - 方便后续调试和数据验证

### 3. 改进错误提示 💬

**旧提示**：
```
未找到追踪信息
```

**新提示**：
```
未找到追踪信息。可能原因：
1. 提单号/集装箱号不存在或已过期
2. 船公司网站暂时无法访问
3. 提单号/集装箱号格式不正确
建议：请确认号码是否正确，或联系船公司核实
```

## 使用示例

### API 调用示例

```javascript
// 智能追踪（自动判断类型并双向查询）
GET /api/tracking/scrape?trackingNumber=COSU6435174570&shippingCompany=中远海运

// 返回结果示例
{
  "errCode": 200,
  "msg": "success",
  "data": {
    "billNumber": "COSU6435174570",
    "containerNumber": "COSU1234567",
    "vessel": "COSCO SHIPPING UNIVERSE",
    "voyage": "123E",
    "portOfLoading": "SHANGHAI, CHINA",
    "portOfDischarge": "LOS ANGELES, USA",
    "eta": "2025-01-15",
    "events": [
      {
        "date": "2025-01-01",
        "location": "SHANGHAI",
        "event": "Container loaded on vessel"
      },
      // ... 更多事件
    ],
    "merged": true,  // 表示这是合并后的结果
    "sources": ["cosco_scraper", "trackipi_scraper"]
  }
}
```

### 前端调用示例

```typescript
import { smartTrack } from '@/utils/api'

// 使用智能追踪
const result = await smartTrack('COSU6435174570', '中远海运')

if (result.errCode === 200 && result.data) {
  const trackingData = result.data
  
  // 检查是否是合并结果
  if (trackingData.merged) {
    console.log('✅ 已通过多种方式获取完整数据')
    console.log('数据来源:', trackingData.sources)
  }
  
  // 显示追踪信息
  console.log('提单号:', trackingData.billNumber)
  console.log('集装箱号:', trackingData.containerNumber)
  console.log('船名:', trackingData.vessel)
  console.log('事件数量:', trackingData.events.length)
}
```

## 技术实现

### 修改的文件

1. **server/modules/tracking/routes.js**
   - 修复路由前缀重复问题

2. **server/modules/tracking/scrapers/index.js**
   - 增强 `smartTrack` 函数
   - 添加 `mergeTrackingResults` 函数
   - 实现双向查询逻辑

3. **server/modules/tracking/controller.js**
   - 改进错误提示信息

### 关键函数

#### smartTrack(trackingNumber, shippingCompany)

**功能**：智能识别追踪号类型并执行双向查询

**流程**：
1. 识别输入类型（集装箱号 vs 提单号）
2. 执行主查询
3. 从主查询结果中提取关联号码
4. 执行次查询获取更多信息
5. 合并两次查询的结果

#### mergeTrackingResults(primary, secondary)

**功能**：合并两次查询的结果

**特性**：
- 事件去重（基于日期+地点+事件）
- 字段智能合并（优先有值的字段）
- 保留数据来源信息

## 已知问题

### COSCO API 失效

**问题**：COSCO 的追踪 API 端点已失效
```
https://elines.coscoshipping.com/ebtracking/public/cargoTrackingByBl
返回 404 Not Found
```

**影响**：无法通过 COSCO 官方 API 获取中远海运的追踪数据

**临时解决方案**：使用 Trackipi 作为备选爬虫

**长期解决方案**：
1. 分析 COSCO 新的 API 架构
2. 更新 `coscoScraper.js` 中的 API 端点
3. 适配新的请求/响应格式

## 测试建议

### 使用真实数据测试

建议使用以下类型的提单号进行测试：

1. **正在运输中的货物** ✅ 推荐
   - 可以获取完整的追踪信息
   - 验证实时数据更新

2. **最近送达的货物** ✅ 可用
   - 可以获取完整的历史记录
   - 验证事件合并功能

3. **避免使用**：
   - 过期超过 6 个月的提单
   - 测试数据或无效单号
   - 已被系统清理的历史数据

### 测试用例

```bash
# 测试 1：集装箱号追踪
curl "http://localhost:3001/api/tracking/scrape?trackingNumber=COSU1234567&shippingCompany=中远海运"

# 测试 2：提单号追踪
curl "http://localhost:3001/api/tracking/scrape?trackingNumber=COSU6435174570&shippingCompany=中远海运"

# 测试 3：不指定船公司（自动识别）
curl "http://localhost:3001/api/tracking/scrape?trackingNumber=MAEU1234567"
```

## 后续优化建议

### 1. 添加更多爬虫源

- MSC（地中海航运）爬虫
- CMA CGM（达飞轮船）爬虫
- Hapag-Lloyd（赫伯罗特）爬虫
- ONE（海洋网联船务）爬虫

### 2. 实现智能重试机制

- 当一个爬虫失败时，自动尝试其他爬虫
- 记录爬虫成功率，优先使用可靠的爬虫

### 3. 添加数据缓存

- 缓存查询结果（15-30分钟）
- 减少对船公司网站的请求
- 提高响应速度

### 4. 实现异步查询

- 对于大量查询，使用队列系统
- 避免阻塞主线程
- 提供查询进度反馈

### 5. 添加数据验证

- 验证集装箱号格式（校验位）
- 验证提单号格式
- 检测明显的错误数据

## 维护说明

### 定期检查

1. **每月检查**：各船公司 API 是否可用
2. **每周检查**：爬虫成功率统计
3. **实时监控**：异常请求和错误日志

### 更新流程

1. 发现 API 变更
2. 在本地环境测试新 API
3. 更新爬虫代码
4. 运行测试用例
5. 部署到生产环境

### 故障排查

**问题**：追踪查询返回 null

**排查步骤**：
1. 检查后端日志（`server/server.log`）
2. 确认 API 端点是否可访问
3. 验证请求参数格式
4. 测试爬虫直接调用

**常见错误代码**：
- `404 Not Found`: API 端点已变更
- `403 Forbidden`: 需要添加请求头或Cookie
- `500 Internal Server Error`: 服务器内部错误
- `Timeout`: 网络超时或服务器响应慢

## 总结

本次改进实现了：
✅ 修复了路由配置问题
✅ 实现了提单号和集装箱号的双向关联查询
✅ 改进了用户错误提示
✅ 提供了完整的文档和测试指南

系统现在能够：
- 自动识别输入类型
- 智能获取关联信息
- 合并多个数据源
- 提供更完整的追踪数据

