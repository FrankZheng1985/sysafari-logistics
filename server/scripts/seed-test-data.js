/**
 * 测试数据初始化脚本
 * 为单证管理模块插入测试用的税率数据
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function seedTestData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()
  
  try {
    console.log('🌱 开始插入测试数据...')

    // 测试税率数据 - 使用正确的列名 goods_description, goods_description_cn
    const tariffRates = [
      // 纺织服装类
      { hs_code: '61091000', goods_description: "Cotton knitted T-shirts for men", goods_description_cn: '棉制针织或钩编男式T恤衫', material: '100%棉', duty_rate: 12.0, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '62044300', goods_description: 'Synthetic fiber dresses for women', goods_description_cn: '合成纤维制女式连衣裙', material: '合成纤维/丝绸', duty_rate: 12.0, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '64041900', goods_description: 'Sports footwear with plastic/rubber outer soles', goods_description_cn: '其他塑料或橡胶外底运动鞋', material: '合成革+橡胶', duty_rate: 8.0, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PR', unit_name: '双' },
      { hs_code: '63026000', goods_description: 'Cotton terry towels for toilet or kitchen', goods_description_cn: '棉制盥洗及厨房用棉质毛巾', material: '100%棉', duty_rate: 8.0, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      
      // 厨具餐具类
      { hs_code: '73239300', goods_description: 'Stainless steel household kitchen articles', goods_description_cn: '不锈钢制餐桌厨房等家用器具', material: '不锈钢', duty_rate: 6.5, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'SET', unit_name: '套' },
      { hs_code: '69111000', goods_description: 'Porcelain or china tableware and kitchenware', goods_description_cn: '瓷制餐桌及厨房用器具', material: '陶瓷', duty_rate: 12.0, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'SET', unit_name: '套' },
      { hs_code: '70139900', goods_description: 'Other glassware', goods_description_cn: '其他玻璃器皿', material: '玻璃', duty_rate: 5.0, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      
      // 电子产品类
      { hs_code: '94052100', goods_description: 'LED lamps and lighting fittings', goods_description_cn: 'LED照明灯具', material: '塑料+金属', duty_rate: 4.7, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '85183000', goods_description: 'Headphones and earphones', goods_description_cn: '耳机及头戴式受话器', material: '塑料+电子元件', duty_rate: 0, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '91021200', goods_description: 'Other wrist-watches with digital display', goods_description_cn: '其他电子显示手表', material: '金属+塑料', duty_rate: 4.5, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '85444290', goods_description: 'Other electric conductors', goods_description_cn: '其他电导体', material: '铜+PVC', duty_rate: 3.3, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '85076000', goods_description: 'Lithium-ion accumulators', goods_description_cn: '锂离子蓄电池', material: '锂电池', duty_rate: 2.7, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      
      // 塑料及木制品类
      { hs_code: '39269099', goods_description: 'Other articles of plastics', goods_description_cn: '其他塑料制品', material: '塑料/硅胶', duty_rate: 6.5, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '39241000', goods_description: 'Plastic tableware and kitchenware', goods_description_cn: '塑料制餐具及厨房用具', material: 'PP塑料', duty_rate: 6.5, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '44140090', goods_description: 'Other wooden frames', goods_description_cn: '其他木框架', material: '木材', duty_rate: 3.0, vat_rate: 19.0, anti_dumping_rate: 0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      
      // 反倾销税测试数据
      { hs_code: '69120090', goods_description: 'Other ceramic tableware', goods_description_cn: '其他陶制餐具', material: '陶瓷', duty_rate: 12.0, vat_rate: 19.0, anti_dumping_rate: 17.6, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' },
      { hs_code: '85011000', goods_description: 'Electric motors for toys', goods_description_cn: '玩具用电动机', material: '电子元件', duty_rate: 2.7, vat_rate: 19.0, anti_dumping_rate: 30.0, countervailing_rate: 0, unit_code: 'PCS', unit_name: '件' }
    ]

    const now = new Date().toISOString()

    for (const rate of tariffRates) {
      // 检查是否已存在
      const existing = await client.query('SELECT hs_code FROM tariff_rates WHERE hs_code = $1', [rate.hs_code])
      
      if (existing.rows.length > 0) {
        // 更新
        await client.query(`
          UPDATE tariff_rates SET
            goods_description = $1,
            goods_description_cn = $2,
            material = $3,
            duty_rate = $4,
            vat_rate = $5,
            anti_dumping_rate = $6,
            countervailing_rate = $7,
            unit_code = $8,
            unit_name = $9,
            updated_at = $10
          WHERE hs_code = $11
        `, [
          rate.goods_description, rate.goods_description_cn, rate.material,
          rate.duty_rate, rate.vat_rate, rate.anti_dumping_rate, rate.countervailing_rate,
          rate.unit_code, rate.unit_name, now, rate.hs_code
        ])
        console.log(`  ✅ 更新税率: ${rate.hs_code} - ${rate.goods_description_cn}`)
      } else {
        // 插入
        await client.query(`
          INSERT INTO tariff_rates (
            hs_code, goods_description, goods_description_cn, material,
            duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
            unit_code, unit_name, data_source, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
        `, [
          rate.hs_code, rate.goods_description, rate.goods_description_cn, rate.material,
          rate.duty_rate, rate.vat_rate, rate.anti_dumping_rate, rate.countervailing_rate,
          rate.unit_code, rate.unit_name, 'test', 1, now
        ])
        console.log(`  ✅ 新增税率: ${rate.hs_code} - ${rate.goods_description_cn}`)
      }
    }

    console.log(`\n✅ 测试数据插入完成！共 ${tariffRates.length} 条税率记录`)
    console.log('\n📋 测试CSV文件已创建: server/uploads/cargo-imports/test-cargo-data.csv')
    console.log('   你可以在前端上传此文件测试导入功能')

  } catch (error) {
    console.error('❌ 插入测试数据失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 运行
seedTestData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
