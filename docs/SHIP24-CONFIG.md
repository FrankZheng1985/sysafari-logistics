# Ship24 跟踪API配置指南

## 简介

Ship24 是一个聚合物流跟踪服务，支持 **1200+ 船公司和快递公司** 的实时跟踪。配置后，系统可以自动获取集装箱的真实跟踪信息，包括：

- 📍 **码头信息** - 到港码头/堆场名称
- 🚢 **船名航次** - 船舶名称和航次号
- 📅 **时间信息** - ETD（预计离港）、ETA（预计到港）、ATA（实际到港）
- 📦 **货物信息** - 件数、毛重、体积
- 🏷️ **集装箱信息** - 柜号、柜型、封号
- 📊 **实时事件** - 装船、启航、到港、卸船等全程跟踪

## 获取 API Key

1. 访问 [Ship24 官网](https://www.ship24.com/)
2. 点击 **Sign Up** 注册账号
3. 登录后进入 **Dashboard** → **API Keys**
4. 创建新的 API Key（免费套餐每月有 500 次查询额度）

## 配置方式

### 方式一：环境变量配置（推荐）

在服务器启动时设置环境变量：

```bash
# Linux/Mac
export SHIP24_API_KEY=你的API密钥
cd server && node index.js

# 或者在启动命令中直接设置
SHIP24_API_KEY=你的API密钥 node server/index.js
```

### 方式二：数据库配置

通过 API 添加配置：

```bash
curl -X POST http://localhost:3001/api/tracking/api-configs \
  -H "Content-Type: application/json" \
  -d '{
    "providerCode": "ship24",
    "providerName": "Ship24 聚合跟踪服务",
    "transportType": "sea",
    "apiUrl": "https://api.ship24.com/public/v1",
    "apiKey": "你的API密钥",
    "status": "active",
    "description": "Ship24 聚合跟踪服务，支持1200+船公司"
  }'
```

或者执行 SQL：

```sql
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type,
  api_type, api_url, api_key, status, description,
  created_at, updated_at
) VALUES (
  'ship24', 'Ship24 聚合跟踪服务', 'sea',
  'rest', 'https://api.ship24.com/public/v1',
  '你的API密钥', 'active', 'Ship24聚合跟踪',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
```

## 验证配置

配置完成后，在创建提单时输入真实的提单号或集装箱号，系统会自动查询并填充：
- 码头
- 船名航次
- ETA/ETD
- 件数、毛重、体积
- 集装箱号、柜型

如果看到真实数据而非模拟数据（如"COSCO TAURUS"、"45.8 CBM"），说明配置成功。

## 支持的船公司

Ship24 支持所有主流船公司，包括但不限于：

| 船公司 | 代码 |
|--------|------|
| 马士基 (Maersk) | MAEU, MSKU |
| 中远海运 (COSCO) | COSU |
| 地中海航运 (MSC) | MSCU |
| 达飞轮船 (CMA CGM) | CMAU |
| 长荣海运 (Evergreen) | EGLV |
| 赫伯罗特 (Hapag-Lloyd) | HLCU |
| 阳明海运 (Yang Ming) | YMLU |
| 现代商船 (HMM) | HDMU |
| ONE | ONEY |
| 以星航运 (ZIM) | ZIMU |
| 太平船务 (PIL) | PCIU |
| 万海航运 (Wan Hai) | WHLC |

## 定价

| 套餐 | 月查询次数 | 价格 |
|------|-----------|------|
| Free | 500 | 免费 |
| Startup | 5,000 | $49/月 |
| Business | 50,000 | $249/月 |
| Enterprise | 无限 | 联系销售 |

## 常见问题

### Q: 为什么显示模拟数据？
A: 检查是否正确配置了 `SHIP24_API_KEY` 环境变量或数据库配置。

### Q: API 调用失败怎么办？
A: 检查控制台日志，常见原因：
- API Key 无效或过期
- 超出月度查询限额
- 网络连接问题

### Q: 支持哪些运输方式？
A: 目前主要支持海运（sea）。空运、铁路等后续扩展。

## 相关文件

- `server/modules/tracking/adapters/ship24Adapter.js` - Ship24 适配器
- `server/modules/tracking/trackingService.js` - 跟踪服务
- `server/scripts/seed-ship24-config.sql` - SQL 配置脚本
