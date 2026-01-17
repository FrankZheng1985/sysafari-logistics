# 先锋物流 Internal API 对接文档

> **文档版本**: 1.0.0  
> **最后更新**: 2026-01-17  
> **API 基础地址**: `https://api.xianfeng-eu.com`

---

## 📋 目录

1. [概述](#概述)
2. [认证方式](#认证方式)
3. [通用说明](#通用说明)
4. [接口列表](#接口列表)
   - [健康检查](#1-健康检查)
   - [订单接口](#2-订单接口)
   - [发票接口](#3-发票接口)
   - [付款接口](#4-付款接口)
   - [客户接口](#5-客户接口)
   - [统计接口](#6-统计接口)
5. [错误码说明](#错误码说明)
6. [数据字典](#数据字典)
7. [对接示例](#对接示例)

---

## 概述

先锋物流 Internal API 是专为集团 ERP 等内部系统设计的数据同步接口。通过该 API，您可以：

- ✅ 同步订单数据（提单、运输状态等）
- ✅ 同步发票数据（应收/应付发票）
- ✅ 同步付款记录
- ✅ 同步客户数据（客户信息、联系人）
- ✅ 获取统计报表数据

### 特性

- **RESTful 风格**: 使用标准 HTTP 方法和状态码
- **JSON 格式**: 请求和响应均使用 JSON 格式
- **API Key 认证**: 安全的 API Key 认证机制
- **速率限制**: 默认每分钟 1000 次请求
- **增量同步**: 支持通过 `updatedAfter` 参数进行增量数据同步

---

## 认证方式

所有 API 请求都需要携带有效的 API Key 进行认证。

### 认证方式（三选一）

| 方式 | Header/参数 | 示例 |
|------|-------------|------|
| **X-API-Key** (推荐) | `X-API-Key` Header | `X-API-Key: sk_xxxxxxxx` |
| **Bearer Token** | `Authorization` Header | `Authorization: Bearer sk_xxxxxxxx` |
| **Query 参数** | `api_key` 参数 | `?api_key=sk_xxxxxxxx` |

### 请求示例

```bash
# 方式1: X-API-Key Header (推荐)
curl -X GET "https://api.xianfeng-eu.com/internal-api/health" \
  -H "X-API-Key: sk_your_api_key_here"

# 方式2: Authorization Bearer
curl -X GET "https://api.xianfeng-eu.com/internal-api/health" \
  -H "Authorization: Bearer sk_your_api_key_here"

# 方式3: Query 参数
curl -X GET "https://api.xianfeng-eu.com/internal-api/health?api_key=sk_your_api_key_here"
```

### 认证失败响应

```json
{
  "errCode": 401,
  "msg": "API Key无效或已过期",
  "data": null
}
```

---

## 通用说明

### 请求头

| Header | 必填 | 说明 |
|--------|------|------|
| `X-API-Key` | 是 | API 密钥 |
| `Content-Type` | 否 | `application/json`（POST/PUT 请求时需要） |

### 响应格式

所有响应均为 JSON 格式，结构如下：

```json
{
  "errCode": 0,        // 错误码，0 表示成功
  "msg": "success",    // 提示信息
  "data": { ... }      // 响应数据
}
```

### 分页参数

支持分页的接口统一使用以下参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | int | 1 | 页码（从 1 开始） |
| `pageSize` | int | 100 | 每页数量（最大 100） |

### 分页响应

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "list": [...],           // 数据列表
    "total": 1234,           // 总记录数
    "page": 1,               // 当前页码
    "pageSize": 100,         // 每页数量
    "totalPages": 13         // 总页数
  }
}
```

### 增量同步

支持 `updatedAfter` 参数的接口可以进行增量数据同步：

```bash
# 获取 2026-01-15 之后更新的数据
GET /internal-api/customers?updatedAfter=2026-01-15T00:00:00Z
```

---

## 接口列表

### 1. 健康检查

检查 API 服务是否正常运行。

**请求**

```
GET /internal-api/health
```

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-17T10:30:00.000Z",
    "version": "1.0.0"
  }
}
```

---

### 2. 订单接口

#### 2.1 获取订单列表

**请求**

```
GET /internal-api/orders
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | int | 否 | 页码，默认 1 |
| `pageSize` | int | 否 | 每页数量，默认 100 |
| `startDate` | string | 否 | 创建开始日期（ISO 8601） |
| `endDate` | string | 否 | 创建结束日期（ISO 8601） |
| `updatedAfter` | string | 否 | 更新时间之后（增量同步） |
| `status` | string | 否 | 订单状态筛选 |
| `type` | string | 否 | `history`=已完成, `active`=进行中, `all`=全部 |

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "list": [
      {
        "id": "order_001",
        "billNumber": "BL2026010001",
        "orderNumber": "ORD2026010001",
        "containerNumber": "EGHU9389750",
        "status": "delivered",
        "deliveryStatus": "completed",
        "transportMethod": "sea",
        "portOfLoading": "CNSHA",
        "portOfDischarge": "DEHAM",
        "etd": "2026-01-10",
        "eta": "2026-02-15",
        "ata": "2026-02-14",
        "pieces": 100,
        "weight": 5000.00,
        "volume": 25.5,
        "description": "电子产品",
        "customerName": "测试客户公司",
        "customerCode": "CUST001",
        "shipper": "深圳发货人",
        "consignee": "汉堡收货人",
        "vessel": "EVER GIVEN",
        "voyage": "123E",
        "createdAt": "2026-01-05T08:00:00.000Z",
        "updatedAt": "2026-01-15T10:30:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 100,
    "totalPages": 2
  }
}
```

#### 2.2 获取订单详情

**请求**

```
GET /internal-api/orders/:id
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 订单 ID（路径参数） |

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "id": "order_001",
    "billNumber": "BL2026010001",
    "orderNumber": "ORD2026010001",
    "containerNumber": "EGHU9389750",
    "status": "delivered",
    "deliveryStatus": "completed",
    "transportMethod": "sea",
    "portOfLoading": "CNSHA",
    "portOfDischarge": "DEHAM",
    "etd": "2026-01-10",
    "eta": "2026-02-15",
    "ata": "2026-02-14",
    "pieces": 100,
    "weight": 5000.00,
    "volume": 25.5,
    "description": "电子产品",
    "customerName": "测试客户公司",
    "customerCode": "CUST001",
    "shipper": "深圳发货人",
    "consignee": "汉堡收货人",
    "vessel": "EVER GIVEN",
    "voyage": "123E",
    "remark": "备注信息",
    "createdAt": "2026-01-05T08:00:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  }
}
```

#### 2.3 获取订单统计

**请求**

```
GET /internal-api/orders/stats
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startDate` | string | 否 | 统计开始日期 |
| `endDate` | string | 否 | 统计结束日期 |

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "totalOrders": 1500,
    "completedOrders": 1200,
    "activeOrders": 280,
    "cancelledOrders": 20,
    "totalPieces": 150000,
    "totalWeight": 750000.00,
    "totalCbm": 3500.00
  }
}
```

---

### 3. 发票接口

#### 3.1 获取发票列表

**请求**

```
GET /internal-api/invoices
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | int | 否 | 页码，默认 1 |
| `pageSize` | int | 否 | 每页数量，默认 100 |
| `startDate` | string | 否 | 创建开始日期 |
| `endDate` | string | 否 | 创建结束日期 |
| `updatedAfter` | string | 否 | 更新时间之后（增量同步） |
| `status` | string | 否 | 发票状态 |
| `type` | string | 否 | `receivable`=应收, `payable`=应付 |

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "list": [
      {
        "id": "inv_001",
        "invoiceNumber": "INV2026010001",
        "invoiceType": "receivable",
        "status": "unpaid",
        "customerId": "cust_001",
        "customerName": "测试客户公司",
        "amount": 5000.00,
        "currency": "EUR",
        "paidAmount": 0,
        "dueDate": "2026-02-15",
        "invoiceDate": "2026-01-15",
        "billId": "order_001",
        "billNumber": "BL2026010001",
        "createdAt": "2026-01-15T08:00:00.000Z",
        "updatedAt": "2026-01-15T08:00:00.000Z"
      }
    ],
    "total": 500,
    "page": 1,
    "pageSize": 100,
    "totalPages": 5
  }
}
```

#### 3.2 获取发票详情

**请求**

```
GET /internal-api/invoices/:id
```

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "id": "inv_001",
    "invoiceNumber": "INV2026010001",
    "invoiceType": "receivable",
    "status": "unpaid",
    "customerId": "cust_001",
    "customerName": "测试客户公司",
    "amount": 5000.00,
    "currency": "EUR",
    "paidAmount": 0,
    "dueDate": "2026-02-15",
    "invoiceDate": "2026-01-15",
    "billId": "order_001",
    "billNumber": "BL2026010001",
    "items": [
      {
        "description": "海运费",
        "quantity": 1,
        "unitPrice": 4000.00,
        "amount": 4000.00
      },
      {
        "description": "报关费",
        "quantity": 1,
        "unitPrice": 1000.00,
        "amount": 1000.00
      }
    ],
    "notes": "备注信息",
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-01-15T08:00:00.000Z"
  }
}
```

---

### 4. 付款接口

#### 4.1 获取付款记录列表

**请求**

```
GET /internal-api/payments
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | int | 否 | 页码，默认 1 |
| `pageSize` | int | 否 | 每页数量，默认 100 |
| `startDate` | string | 否 | 付款开始日期 |
| `endDate` | string | 否 | 付款结束日期 |
| `updatedAfter` | string | 否 | 更新时间之后（增量同步） |
| `status` | string | 否 | 付款状态 |

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "list": [
      {
        "id": "pay_001",
        "paymentNumber": "PAY2026010001",
        "invoiceId": "inv_001",
        "invoiceNumber": "INV2026010001",
        "amount": 5000.00,
        "currency": "EUR",
        "paymentMethod": "bank_transfer",
        "paymentDate": "2026-01-20",
        "status": "completed",
        "bankAccount": "DE89370400440532013000",
        "reference": "TXN123456",
        "notes": "付款备注",
        "createdAt": "2026-01-20T10:00:00.000Z",
        "updatedAt": "2026-01-20T10:00:00.000Z"
      }
    ],
    "total": 200,
    "page": 1,
    "pageSize": 100,
    "totalPages": 2
  }
}
```

#### 4.2 获取付款详情

**请求**

```
GET /internal-api/payments/:id
```

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "id": "pay_001",
    "paymentNumber": "PAY2026010001",
    "invoiceId": "inv_001",
    "invoiceNumber": "INV2026010001",
    "customerName": "测试客户公司",
    "supplierName": null,
    "amount": 5000.00,
    "currency": "EUR",
    "paymentMethod": "bank_transfer",
    "paymentDate": "2026-01-20",
    "status": "completed",
    "bankAccount": "DE89370400440532013000",
    "reference": "TXN123456",
    "notes": "付款备注",
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:00:00.000Z"
  }
}
```

---

### 5. 客户接口

#### 5.1 获取客户列表

**请求**

```
GET /internal-api/customers
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | int | 否 | 页码，默认 1 |
| `pageSize` | int | 否 | 每页数量，默认 100 |
| `updatedAfter` | string | 否 | 更新时间之后（增量同步） |
| `status` | string | 否 | 客户状态（active/inactive） |
| `customerType` | string | 否 | 客户类型 |
| `customerLevel` | string | 否 | 客户等级 |
| `customerRegion` | string | 否 | 客户区域（china/overseas） |
| `keyword` | string | 否 | 关键词搜索（客户名/编码/公司名） |

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "list": [
      {
        "id": "cust_001",
        "customerCode": "CUST001",
        "customerName": "测试客户",
        "companyName": "测试客户有限公司",
        "companyNameEn": "Test Customer Co., Ltd.",
        "customerType": "shipper",
        "customerLevel": "vip",
        "customerRegion": "china",
        "countryCode": "CN",
        "province": "广东省",
        "city": "深圳市",
        "address": "南山区科技园路100号",
        "postalCode": "518000",
        "contactPerson": "张三",
        "contactPhone": "13800138000",
        "contactEmail": "zhangsan@test.com",
        "taxNumber": "91440300MA5XXXXXX",
        "legalPerson": "李四",
        "paymentTerms": "30 days",
        "creditLimit": 100000.00,
        "currency": "EUR",
        "bankName": "中国银行",
        "bankAccount": "6222000000000000000",
        "website": "https://www.test.com",
        "industry": "电子产品",
        "source": "referral",
        "assignedSales": 1,
        "assignedSalesName": "王五",
        "assignedOperator": 2,
        "assignedOperatorName": "赵六",
        "tags": ["VIP", "大客户"],
        "notes": "备注信息",
        "status": "active",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-15T10:00:00.000Z"
      }
    ],
    "total": 500,
    "page": 1,
    "pageSize": 100,
    "totalPages": 5
  }
}
```

#### 5.2 获取客户详情

**请求**

```
GET /internal-api/customers/:id
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 客户 ID（路径参数） |
| `includeContacts` | string | 否 | 设为 `true` 返回联系人列表 |

**响应示例（不含联系人）**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "id": "cust_001",
    "customerCode": "CUST001",
    "customerName": "测试客户",
    "companyName": "测试客户有限公司",
    "companyNameEn": "Test Customer Co., Ltd.",
    "customerType": "shipper",
    "customerLevel": "vip",
    "customerRegion": "china",
    "countryCode": "CN",
    "province": "广东省",
    "city": "深圳市",
    "address": "南山区科技园路100号",
    "postalCode": "518000",
    "contactPerson": "张三",
    "contactPhone": "13800138000",
    "contactEmail": "zhangsan@test.com",
    "taxNumber": "91440300MA5XXXXXX",
    "legalPerson": "李四",
    "registeredCapital": "1000万人民币",
    "establishmentDate": "2010-01-01",
    "businessScope": "电子产品研发、生产、销售",
    "paymentTerms": "30 days",
    "creditLimit": 100000.00,
    "currency": "EUR",
    "bankName": "中国银行",
    "bankAccount": "6222000000000000000",
    "website": "https://www.test.com",
    "industry": "电子产品",
    "source": "referral",
    "assignedSales": 1,
    "assignedSalesName": "王五",
    "assignedOperator": 2,
    "assignedOperatorName": "赵六",
    "tags": ["VIP", "大客户"],
    "notes": "备注信息",
    "status": "active",
    "createdBy": 1,
    "createdByName": "管理员",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  }
}
```

**响应示例（含联系人，`?includeContacts=true`）**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "id": "cust_001",
    "customerCode": "CUST001",
    "customerName": "测试客户",
    "...": "（其他字段同上）",
    "contacts": [
      {
        "id": "contact_001",
        "contactName": "张三",
        "contactType": "business",
        "position": "采购经理",
        "department": "采购部",
        "phone": "0755-12345678",
        "mobile": "13800138000",
        "email": "zhangsan@test.com",
        "wechat": "zhangsan_wx",
        "isPrimary": true,
        "notes": "主要联系人",
        "status": "active",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-15T10:00:00.000Z"
      },
      {
        "id": "contact_002",
        "contactName": "李四",
        "contactType": "finance",
        "position": "财务主管",
        "department": "财务部",
        "phone": "0755-12345679",
        "mobile": "13800138001",
        "email": "lisi@test.com",
        "wechat": null,
        "isPrimary": false,
        "notes": null,
        "status": "active",
        "createdAt": "2025-03-01T00:00:00.000Z",
        "updatedAt": "2026-01-10T08:00:00.000Z"
      }
    ]
  }
}
```

---

### 6. 统计接口

#### 6.1 获取综合统计

**请求**

```
GET /internal-api/stats
```

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "orders": {
      "total": 1500,
      "completed": 1200,
      "active": 280,
      "monthlyNew": 50
    },
    "finance": {
      "accountsReceivable": 250000.00,
      "accountsPayable": 180000.00,
      "currency": "EUR"
    },
    "timestamp": "2026-01-17T10:30:00.000Z"
  }
}
```

#### 6.2 获取财务汇总

**请求**

```
GET /internal-api/financial-summary
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startDate` | string | 否 | 统计开始日期 |
| `endDate` | string | 否 | 统计结束日期 |

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "receivables": {
      "count": 200,
      "totalAmount": 500000.00,
      "paidAmount": 250000.00,
      "outstanding": 250000.00
    },
    "payables": {
      "count": 150,
      "totalAmount": 380000.00,
      "paidAmount": 200000.00,
      "outstanding": 180000.00
    },
    "collections": {
      "count": 180,
      "total": 250000.00
    },
    "disbursements": {
      "count": 120,
      "total": 200000.00
    },
    "netPosition": 70000.00,
    "currency": "EUR",
    "period": {
      "startDate": "2026-01-01",
      "endDate": "2026-01-17"
    }
  }
}
```

#### 6.3 获取月度统计

**请求**

```
GET /internal-api/monthly-stats
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `months` | int | 否 | 统计月数，默认 12 |

**响应示例**

```json
{
  "errCode": 0,
  "msg": "success",
  "data": {
    "orderStats": [
      {
        "month": "2026-01",
        "orderCount": 50,
        "totalPieces": 5000,
        "totalWeight": 25000.00
      },
      {
        "month": "2025-12",
        "orderCount": 65,
        "totalPieces": 6500,
        "totalWeight": 32500.00
      }
    ],
    "revenueStats": [
      {
        "month": "2026-01",
        "revenue": 80000.00,
        "cost": 60000.00,
        "profit": 20000.00
      },
      {
        "month": "2025-12",
        "revenue": 95000.00,
        "cost": 70000.00,
        "profit": 25000.00
      }
    ],
    "currency": "EUR"
  }
}
```

---

## 错误码说明

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| 0 | 200 | 成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 认证失败（API Key 无效或缺失） |
| 403 | 403 | 权限不足 |
| 404 | 404 | 资源不存在 |
| 429 | 429 | 请求过于频繁（超出速率限制） |
| 500 | 500 | 服务器内部错误 |
| 503 | 503 | 服务不可用 |

### 错误响应示例

```json
{
  "errCode": 401,
  "msg": "API Key无效或已过期",
  "data": null
}
```

```json
{
  "errCode": 404,
  "msg": "客户不存在",
  "data": null
}
```

```json
{
  "errCode": 429,
  "msg": "超出速率限制，请在60秒后重试",
  "data": null
}
```

---

## 数据字典

### 订单状态 (Order Status)

| 值 | 说明 |
|----|------|
| `pending` | 待处理 |
| `confirmed` | 已确认 |
| `in_transit` | 运输中 |
| `arrived` | 已到港 |
| `customs_clearing` | 清关中 |
| `delivered` | 已交付 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |
| `closed` | 已关闭 |

### 发票类型 (Invoice Type)

| 值 | 说明 |
|----|------|
| `receivable` | 应收发票 |
| `payable` | 应付发票 |

### 发票状态 (Invoice Status)

| 值 | 说明 |
|----|------|
| `draft` | 草稿 |
| `unpaid` | 未付款 |
| `partial` | 部分付款 |
| `paid` | 已付款 |
| `overdue` | 已逾期 |
| `cancelled` | 已取消 |

### 客户类型 (Customer Type)

| 值 | 说明 |
|----|------|
| `shipper` | 发货人 |
| `consignee` | 收货人 |
| `both` | 两者皆是 |
| `agent` | 代理 |

### 客户等级 (Customer Level)

| 值 | 说明 |
|----|------|
| `normal` | 普通客户 |
| `silver` | 银牌客户 |
| `gold` | 金牌客户 |
| `vip` | VIP客户 |

### 客户区域 (Customer Region)

| 值 | 说明 |
|----|------|
| `china` | 中国 |
| `overseas` | 海外 |

### 联系人类型 (Contact Type)

| 值 | 说明 |
|----|------|
| `business` | 业务联系人 |
| `finance` | 财务联系人 |
| `logistics` | 物流联系人 |
| `legal` | 法务联系人 |
| `other` | 其他 |

---

## 对接示例

### Python 示例

```python
import requests

API_BASE = "https://api.xianfeng-eu.com"
API_KEY = "sk_your_api_key_here"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# 健康检查
def health_check():
    response = requests.get(f"{API_BASE}/internal-api/health", headers=headers)
    return response.json()

# 获取客户列表（增量同步）
def get_customers(updated_after=None, page=1, page_size=100):
    params = {
        "page": page,
        "pageSize": page_size
    }
    if updated_after:
        params["updatedAfter"] = updated_after
    
    response = requests.get(
        f"{API_BASE}/internal-api/customers",
        headers=headers,
        params=params
    )
    return response.json()

# 获取客户详情（含联系人）
def get_customer_detail(customer_id, include_contacts=True):
    params = {"includeContacts": "true"} if include_contacts else {}
    response = requests.get(
        f"{API_BASE}/internal-api/customers/{customer_id}",
        headers=headers,
        params=params
    )
    return response.json()

# 示例：增量同步客户数据
def sync_customers():
    # 获取上次同步时间（从数据库或文件读取）
    last_sync_time = "2026-01-15T00:00:00Z"
    
    page = 1
    while True:
        result = get_customers(updated_after=last_sync_time, page=page)
        
        if result["errCode"] != 0:
            print(f"Error: {result['msg']}")
            break
        
        customers = result["data"]["list"]
        if not customers:
            break
        
        for customer in customers:
            # 处理客户数据（保存到本地数据库等）
            print(f"同步客户: {customer['customerCode']} - {customer['customerName']}")
        
        if page >= result["data"]["totalPages"]:
            break
        page += 1
    
    # 更新同步时间
    # save_last_sync_time(datetime.now().isoformat())

if __name__ == "__main__":
    print(health_check())
    sync_customers()
```

### Java 示例

```java
import java.net.http.*;
import java.net.URI;

public class XianfengApiClient {
    private static final String API_BASE = "https://api.xianfeng-eu.com";
    private static final String API_KEY = "sk_your_api_key_here";
    
    private final HttpClient client = HttpClient.newHttpClient();
    
    public String healthCheck() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/internal-api/health"))
            .header("X-API-Key", API_KEY)
            .GET()
            .build();
        
        HttpResponse<String> response = client.send(request, 
            HttpResponse.BodyHandlers.ofString());
        return response.body();
    }
    
    public String getCustomers(String updatedAfter, int page, int pageSize) throws Exception {
        StringBuilder url = new StringBuilder(API_BASE + "/internal-api/customers");
        url.append("?page=").append(page);
        url.append("&pageSize=").append(pageSize);
        if (updatedAfter != null) {
            url.append("&updatedAfter=").append(updatedAfter);
        }
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url.toString()))
            .header("X-API-Key", API_KEY)
            .GET()
            .build();
        
        HttpResponse<String> response = client.send(request,
            HttpResponse.BodyHandlers.ofString());
        return response.body();
    }
}
```

### cURL 示例

```bash
# 健康检查
curl -X GET "https://api.xianfeng-eu.com/internal-api/health" \
  -H "X-API-Key: sk_your_api_key_here"

# 获取客户列表（分页 + 增量同步）
curl -X GET "https://api.xianfeng-eu.com/internal-api/customers?page=1&pageSize=50&updatedAfter=2026-01-15T00:00:00Z" \
  -H "X-API-Key: sk_your_api_key_here"

# 获取客户详情（含联系人）
curl -X GET "https://api.xianfeng-eu.com/internal-api/customers/cust_001?includeContacts=true" \
  -H "X-API-Key: sk_your_api_key_here"

# 获取订单列表（按日期筛选）
curl -X GET "https://api.xianfeng-eu.com/internal-api/orders?startDate=2026-01-01&endDate=2026-01-31&type=history" \
  -H "X-API-Key: sk_your_api_key_here"

# 获取财务汇总
curl -X GET "https://api.xianfeng-eu.com/internal-api/financial-summary?startDate=2026-01-01&endDate=2026-01-31" \
  -H "X-API-Key: sk_your_api_key_here"
```

---

## 📞 技术支持

如有对接问题，请联系：

- **技术支持邮箱**: support@xianfeng-eu.com
- **API 状态页**: https://api.xianfeng-eu.com/internal-api/health

---

> 📝 **文档更新记录**
> 
> | 版本 | 日期 | 更新内容 |
> |------|------|----------|
> | 1.0.0 | 2026-01-17 | 初始版本，包含订单、发票、付款、客户、统计接口 |
