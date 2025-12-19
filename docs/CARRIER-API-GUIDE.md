# 船公司官方 API 申请指南

本文档介绍如何申请各主流船公司的官方跟踪 API，用于获取集装箱实时位置、ETA/ETD、码头等信息。

## 为什么要用官方 API？

| 数据来源 | 准确性 | 实时性 | 成本 |
|---------|-------|-------|------|
| 船公司官方 API | ⭐⭐⭐⭐⭐ | 实时 | 通常免费或低成本 |
| Ship24 等第三方 | ⭐⭐⭐ | 可能延迟 | 按量计费 |

官方 API 是一手数据源，ETA、码头等关键信息更准确。

---

## 一、COSCO 中远海运

### 申请步骤

1. 访问 **SynconHub 开发者门户**：https://synconhub.coscoshipping.com/developer
2. 点击 **Sign Up** 注册账号
3. 完善企业信息（营业执照、联系人等）
4. 申请 **Cargo Tracking API** 权限
5. 等待审核（通常 1-3 个工作日）

### API 信息

| 项目 | 内容 |
|-----|------|
| 官网 | https://synconhub.coscoshipping.com/ |
| API 基础 URL | `https://api.coscoshipping.com` |
| 认证方式 | API Key (Header: `apiKey`) |
| 主要端点 | `/cargoTracking/queryTrans?billNo={提单号}` |
| 免费额度 | 有试用期，具体咨询客服 |

### 示例请求

```bash
curl -X GET "https://api.coscoshipping.com/cargoTracking/queryTrans?billNo=COSU6435174570" \
  -H "apiKey: YOUR_API_KEY" \
  -H "Accept: application/json"
```

---

## 二、Maersk 马士基

### 申请步骤

1. 访问 **Maersk 开发者门户**：https://developer.maersk.com/
2. 点击 **Sign Up** 创建账号
3. 登录后进入 **Apps** 页面
4. 创建新应用，选择 **Track & Trace API**
5. 获取 **Consumer Key**

### API 信息

| 项目 | 内容 |
|-----|------|
| 官网 | https://developer.maersk.com/ |
| API 基础 URL | `https://api.maersk.com` |
| 认证方式 | Consumer-Key (Header) |
| 主要端点 | `/track?billOfLadingNumber={提单号}` |
| 免费额度 | 有免费套餐 |

### 示例请求

```bash
curl -X GET "https://api.maersk.com/track?billOfLadingNumber=MAEU1234567" \
  -H "Consumer-Key: YOUR_CONSUMER_KEY" \
  -H "Accept: application/json"
```

---

## 三、MSC 地中海航运

### 申请步骤

1. 访问 **MSC 数字解决方案**：https://www.msc.com/en/digital-solutions/apis
2. 填写 **API Access Request** 表单
3. 或联系 MSC 当地商务代表
4. 签署 API 使用协议
5. 获取 API 凭证

### API 信息

| 项目 | 内容 |
|-----|------|
| 官网 | https://www.msc.com/ |
| API 基础 URL | `https://api.msc.com` |
| 认证方式 | Bearer Token (OAuth 2.0) |
| 主要端点 | `/track-and-trace/containers/{集装箱号}` |
| 免费额度 | 需咨询 |

### 示例请求

```bash
curl -X GET "https://api.msc.com/track-and-trace/containers/MSCU1234567" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

---

## 四、CMA CGM 达飞轮船

### 申请步骤

1. 访问 **CMA CGM 开发者门户**：https://developer.cma-cgm.com/
2. 注册开发者账号
3. 创建应用并申请 **Tracking API**
4. 配置 OAuth 2.0 回调地址
5. 获取 Client ID 和 Client Secret

### API 信息

| 项目 | 内容 |
|-----|------|
| 官网 | https://developer.cma-cgm.com/ |
| API 基础 URL | `https://api.cma-cgm.com` |
| 认证方式 | OAuth 2.0 (Client Credentials) |
| 主要端点 | `/tracking/v1/shipments/{提单号}` |
| 免费额度 | 有开发者套餐 |

### 示例请求

```bash
# 1. 获取 Access Token
curl -X POST "https://api.cma-cgm.com/oauth/token" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET"

# 2. 查询跟踪
curl -X GET "https://api.cma-cgm.com/tracking/v1/shipments/CMAU1234567" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Accept: application/json"
```

---

## 五、OOCL 东方海外

### 申请步骤

1. 访问 **OOCL 官网**：https://www.oocl.com/
2. 联系 **OOCL 客户服务** 或当地销售代表
3. 说明 API 集成需求
4. 签署 API 使用协议
5. 获取 API 凭证

### API 信息

| 项目 | 内容 |
|-----|------|
| 官网 | https://www.oocl.com/ |
| API 基础 URL | `https://api.oocl.com` |
| 认证方式 | API Key |
| 主要端点 | `/cargoTracking/query?blNo={提单号}` |
| 备注 | 需要合作伙伴关系 |

### 联系方式

- 邮箱：ecommerce@oocl.com
- 网页：https://www.oocl.com/eng/ourservices/eservices/

---

## 六、Hapag-Lloyd 赫伯罗特

### 申请步骤

1. 访问 **Hapag-Lloyd 开发者门户**：https://developer.hlag.com/
2. 点击 **Register** 注册账号
3. 验证邮箱后登录
4. 进入 **My Apps** 创建应用
5. 订阅 **Tracking API v1**
6. 获取 API Key

### API 信息

| 项目 | 内容 |
|-----|------|
| 官网 | https://developer.hlag.com/ |
| API 基础 URL | `https://api.hlag.com` |
| 认证方式 | API Key (Header: `X-API-Key`) |
| 主要端点 | `/track/v1/containers/{集装箱号}` |
| 免费额度 | 有免费开发者套餐 |

### 示例请求

```bash
curl -X GET "https://api.hlag.com/track/v1/containers/HLCU1234567" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Accept: application/json"
```

---

## 七、Evergreen 长荣海运

### 申请步骤

1. 访问 **Evergreen 官网**：https://www.evergreen-line.com/
2. 联系当地代理或客户服务部门
3. 说明 API 集成需求和业务背景
4. 可能需要提供合作伙伴资质证明
5. 签署保密协议和 API 使用协议

### API 信息

| 项目 | 内容 |
|-----|------|
| 官网 | https://www.evergreen-line.com/ |
| API 基础 URL | `https://api.evergreen-line.com` |
| 认证方式 | API Key |
| 主要端点 | `/tracking/cargo?blNo={提单号}` |
| 备注 | 可能仅对合作伙伴开放 |

### 联系方式

- 通过官网联系表单提交请求
- 或联系当地长荣代理

---

## 八、其他船公司

### Yang Ming 阳明海运
- 官网：https://www.yangming.com/
- 联系客服申请 API 权限

### ZIM 以星航运
- 开发者门户：https://developers.zim.com/
- 支持 REST API

### ONE (Ocean Network Express)
- 官网：https://www.one-line.com/
- 联系当地代表

---

## 配置到系统

获取 API Key 后，通过以下方式配置到系统：

### 方式一：环境变量

```bash
export COSCO_API_KEY=你的密钥
export MAERSK_API_KEY=你的密钥
export MSC_API_KEY=你的密钥
# ... 其他船公司
```

### 方式二：数据库配置

```sql
INSERT INTO tracking_api_configs 
  (provider_code, provider_name, transport_type, api_url, api_key, status)
VALUES 
  ('cosco', 'COSCO 中远海运', 'sea', 'https://api.coscoshipping.com', '你的密钥', 'active');
```

### 方式三：系统管理界面

进入 **系统设置 > API配置**，添加船公司 API 配置。

---

## 常见问题

### Q: 申请需要多长时间？
A: 通常 1-5 个工作日，具体看各船公司审核流程。

### Q: 没有企业资质能申请吗？
A: 部分船公司（如 Maersk、Hapag-Lloyd）对个人开发者开放，其他可能需要企业资质。

### Q: API 调用有次数限制吗？
A: 各船公司不同，免费套餐通常有月度限额，超出需付费或升级套餐。

### Q: 如果官方 API 申请失败怎么办？
A: 系统会自动回退到 Ship24 等第三方服务获取数据。

---

## 相关文件

- [Ship24 配置指南](./SHIP24-CONFIG.md)
- [API 适配器代码](../server/modules/tracking/adapters/shipAdapter.js)
- [数据库配置脚本](../server/scripts/seed-carrier-apis.sql)
