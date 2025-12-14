# Sysafari Logistics Backend Server

后端服务器，提供订单管理和海运公司信息 API。

## 功能

- 订单管理（提单 CRUD）
- 海运公司信息管理
- 集装箱代码查询

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 初始化数据库

```bash
# 初始化订单数据库
npm run init-db

# 初始化海运公司和集装箱代码数据库
npm run init-shipping
```

### 3. 启动服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

## API 接口

### 订单管理

- `GET /api/bills` - 获取提单列表
- `GET /api/bills/:id` - 获取提单详情
- `POST /api/bills` - 创建提单
- `PUT /api/bills/:id` - 更新提单
- `DELETE /api/bills/:id` - 删除提单

### 海运公司

- `GET /api/shipping-companies` - 获取所有海运公司列表
- `GET /api/shipping-companies/by-container-code/:code` - 根据集装箱代码获取海运公司
- `GET /api/shipping-companies/:companyCode/container-codes` - 获取指定公司的集装箱代码
- `GET /api/container-codes/search?q=xxx` - 搜索集装箱代码

## 数据库结构

### shipping_companies 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| company_name | TEXT | 公司名称 |
| company_code | TEXT | 公司代码（唯一） |
| country | TEXT | 国家 |
| website | TEXT | 网站 |

### container_codes 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| shipping_company_id | INTEGER | 海运公司ID（外键） |
| container_code | TEXT | 集装箱代码（如 COSU） |
| description | TEXT | 描述 |

## 数据初始化

已包含 20 家主要海运公司和 325+ 个集装箱代码，包括：

- COSCO（中远海运）
- MSC（地中海航运）
- MAERSK（马士基）
- CMA CGM（达飞轮船）
- HAPAG-LLOYD（赫伯罗特）
- EVERGREEN（长荣海运）
- ONE（海洋网联）
- 等等...
