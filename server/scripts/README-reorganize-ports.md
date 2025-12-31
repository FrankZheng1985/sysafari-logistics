# 起运地数据整理脚本使用说明

## 功能说明

此脚本用于重新整理起运地数据，按照以下规则分类：

1. **第一级分类**：运输方式
   - `sea` - 海运
   - `air` - 空运
   - `rail` - 铁路（中欧班列）
   - `truck` - 卡车运输（卡航）

2. **第二级分类**：5大洲
   - 亚洲
   - 欧洲
   - 非洲
   - 美洲
   - 大洋洲

## 数据内容

### 海运（sea）
- 主要集装箱码头，带码头名
- 例如：南沙港、盐田港、外高桥码头、洋山港等
- 包含主港口和子码头（terminal）的层级关系

### 空运（air）
- 货运机场名和城市名
- 例如：上海浦东国际机场、北京首都国际机场等
- 包含中国主要货运机场和亚洲、欧洲、美洲的主要机场

### 铁路（rail）
- 有中欧班列的中国城市名
- 例如：西安国际港、郑州圃田站、重庆团结村站等
- 包含20个主要中欧班列站点

### 卡航（truck）
- 有发欧洲卡航的中国城市名
- 例如：西安、郑州、重庆、成都等
- 包含20个主要卡航城市

## 使用方法

### 1. 本地开发环境

```bash
cd server
node scripts/reorganize-ports-of-loading.js
```

### 2. 注意事项

⚠️ **重要提示**：
- 脚本会检查每个港口代码是否存在
- 如果存在，会更新数据；如果不存在，会插入新数据
- **不会删除现有数据**，只会更新或新增
- 如果需要完全重新整理，请先手动清空 `ports_of_loading` 表

### 3. 数据验证

运行脚本后，可以通过以下方式验证：

```sql
-- 查看各运输方式的数据量
SELECT transport_type, COUNT(*) as count 
FROM ports_of_loading 
GROUP BY transport_type;

-- 查看各洲的数据量
SELECT continent, COUNT(*) as count 
FROM ports_of_loading 
GROUP BY continent;

-- 查看海运码头层级关系
SELECT port_code, port_name_cn, port_type, parent_port_code 
FROM ports_of_loading 
WHERE transport_type = 'sea' 
ORDER BY port_code;
```

## 数据统计

脚本会插入/更新约 **300+** 条起运地记录：

- 海运：约 80+ 条（包含主港口和码头）
- 空运：约 50+ 条
- 铁路：约 20 条
- 卡航：约 20 条

## 后续维护

如果需要添加新的起运地数据，可以：

1. 直接编辑 `server/scripts/reorganize-ports-of-loading.js` 文件
2. 在对应的数组中添加新数据
3. 重新运行脚本

或者通过前端界面手动添加。
