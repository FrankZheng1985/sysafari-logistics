# TARIC数据导入指南

## 概述

本指南说明如何下载和导入TARIC（欧盟综合关税数据库）数据到系统的HS Code数据库中。

## 数据源

**官方来源**: 欧盟关税和海关联盟 (European Commission - Taxation and Customs Union)

**数据库名称**: TARIC (Integrated Tariff of the European Union)

**访问地址**: https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa

## 下载步骤

### 方法1: 手动下载（推荐）

1. **访问TARIC数据页面**
   - 打开浏览器，访问上述URL
   - 如果需要，登录CIRCABC账户

2. **下载主要文件**
   - **Nomenclature EN.xlsx** (1.30 MB) - 英文商品分类编码（必需）
   - **Duties Import 01-99(1).xlsx** (7.64 MB) - 进口关税数据（可选）

3. **保存文件**
   - 将下载的文件保存到: `server/data/taric/`
   - 如果目录不存在，脚本会自动创建

### 方法2: 使用命令行下载（如果URL可直接访问）

如果文件URL可以直接访问（不需要登录），可以使用以下命令：

```bash
# 下载Nomenclature文件
curl -L -o server/data/taric/Nomenclature_EN.xlsx "文件直接下载URL"

# 下载关税文件
curl -L -o server/data/taric/Duties_Import.xlsx "文件直接下载URL"
```

**注意**: 由于CIRCABC平台通常需要登录，直接下载可能不工作。

## 导入数据

### 导入商品分类编码

```bash
cd server
npm run import-taric data/taric/Nomenclature\ EN.xlsx
```

或者使用完整路径：

```bash
npm run import-taric /path/to/Nomenclature\ EN.xlsx
```

### 导入过程说明

导入脚本会：

1. **自动识别列结构**
   - 检测编码列（CN8, CN Code, Code等）
   - 检测描述列（Description, Desc等）
   - 检测章节列（Chapter, Ch等）

2. **数据转换**
   - 将编码格式化为10位TARIC标准格式
   - 从编码中提取章节、标题、子标题信息
   - 处理空值和特殊字符

3. **数据验证**
   - 跳过无效编码（长度不足6位）
   - 处理重复编码（使用INSERT OR REPLACE）
   - 记录错误和跳过统计

4. **进度显示**
   - 每处理1000条显示进度
   - 显示导入统计信息

## Excel文件格式要求

TARIC Excel文件应包含以下列（至少需要编码列）：

- **编码列**: CN8, CN Code, Code, TARIC, HS Code等
- **描述列**: Description, Desc, Text, Name等（可选）
- **章节列**: Chapter, Ch等（可选，可从编码中提取）
- **标题列**: Heading, Head等（可选，可从编码中提取）
- **子标题列**: Subheading, Sub等（可选，可从编码中提取）

## 导入后验证

导入完成后，可以验证数据：

```bash
# 查看数据库中的HS Code数量
sqlite3 server/data/orders.db "SELECT COUNT(*) FROM hs_codes;"

# 查看章节分布
sqlite3 server/data/orders.db "SELECT chapter, COUNT(*) as count FROM hs_codes WHERE chapter IS NOT NULL GROUP BY chapter ORDER BY chapter;"

# 查看示例数据
sqlite3 server/data/orders.db "SELECT hs_code, description_en, chapter FROM hs_codes LIMIT 10;"
```

## 常见问题

### Q: 导入时提示"无法识别编码列"

**A**: 检查Excel文件是否包含编码相关的列名。可以查看脚本输出的"检测到的列名"列表，确认文件格式。

### Q: 导入的数据没有中文描述

**A**: TARIC Excel文件通常只包含英文描述。中文描述需要：
1. 使用翻译API批量翻译
2. 从其他数据源导入
3. 手动添加

### Q: 如何更新数据？

**A**: TARIC数据每月更新一次。更新时：
1. 下载最新版本的Excel文件
2. 运行导入命令（会自动替换重复的编码）
3. 或者先清空数据库再导入

### Q: 导入速度慢？

**A**: 如果数据量很大（数万条），导入可能需要几分钟。可以：
- 使用事务批量处理
- 分批导入（修改脚本添加LIMIT）

## 数据字段说明

导入后的HS Code数据包含以下字段：

- `hs_code`: HS编码（10位TARIC标准格式）
- `cn_code`: CN编码（通常与HS编码相同）
- `description_en`: 英文描述
- `description_cn`: 中文描述（需要单独导入或翻译）
- `chapter`: 章节（1-97）
- `heading`: 标题（2位数字）
- `subheading`: 子标题（2位数字）
- `tariff_rate`: 关税税率（需要从Duties文件导入）
- `inspection_rate`: 查验率（需要从其他数据源获取）

## 下一步

导入商品分类编码后，可以：

1. **导入关税数据**
   - 解析Duties Import Excel文件
   - 匹配HS Code并更新关税税率

2. **添加中文翻译**
   - 使用翻译服务批量翻译描述
   - 或从其他数据源导入中文描述

3. **导入查验率数据**
   - 从海关统计数据中获取
   - 或手动维护

## 技术支持

如有问题，请检查：
1. Excel文件格式是否正确
2. 文件路径是否正确
3. 数据库连接是否正常
4. 查看脚本输出的错误信息

